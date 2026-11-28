import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import { startStub } from '../stub/src/server.ts'
import { startBridge } from '../bridge/src/main.ts'

type Frame = Record<string, unknown>
const DEVICE = 'dev_test'
const keys = generateKeyPairSync('ed25519')
const publicKey = keys.publicKey.export({ format: 'jwk' })
const hash = (s: string): string => createHash('sha256').update(s).digest('base64url')
const callArgs = (item: string, requestId?: string): string => JSON.stringify({ slug: 'groceries', action: 'add', args: { item }, ...(requestId === undefined ? {} : { requestId }) })
const LIST = '{}'

function jws(tool: string, argsJson: string, gid = 'grant_1'): string {
  const now = Math.floor(Date.now() / 1000)
  const c = { v: 1, iss: 'dw-relay', aud: DEVICE, sub: 'owner', cid: 'client_abc123', gid, scope: 'widgets:read widgets:call', wid: ['groceries'], tool, ah: hash(argsJson), iat: now, exp: now + 30, jti: randomBytes(16).toString('base64url') }
  const head = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'k', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(c)).toString('base64url')
  return `${head}.${body}.${sign(null, Buffer.from(`${head}.${body}`), keys.privateKey).toString('base64url')}`
}

let dir = ''
let stub: Awaited<ReturnType<typeof startStub>>
let wss: WebSocketServer
let bridge: Awaited<ReturnType<typeof startBridge>> | undefined
let n = 0

async function connect(approvedGrantsFile?: string): Promise<WebSocket> {
  const conn = new Promise<WebSocket>((resolve) => { wss.once('connection', (socket) => resolve(socket)) })
  bridge = await startBridge({
    workerUrl: `http://127.0.0.1:${(wss.address() as AddressInfo).port}`, credentialFile: join(dir, 'credential'), publicKey,
    dshHome: join(dir, 'dsh'), killFile: join(dir, 'KILL'), log: () => undefined,
    ...(approvedGrantsFile === undefined ? {} : { approvedGrantsFile }),
  })
  const socket = await conn
  socket.send(JSON.stringify({ type: 'hello', deviceId: DEVICE }))
  return socket
}

function call(socket: WebSocket, tool: string, argsJson: string, gid?: string): Promise<Frame> {
  const id = `c${String(++n)}`
  return new Promise((resolve) => {
    const on = (data: unknown): void => {
      const frame = JSON.parse(String(data)) as Frame
      if (frame.type === 'result' && frame.id === id) { socket.off('message', on); resolve(frame) }
    }
    socket.on('message', on)
    socket.send(JSON.stringify({ type: 'call', id, assertion: jws(tool, argsJson, gid), argsJson }))
  })
}
const code = (f: Frame): unknown => (f.error as { code?: unknown } | undefined)?.code
const adds = async (): Promise<number> => ((await stub.calls()) as unknown as { tool: string }[]).filter((c) => c.tool === 'widget_call').length

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.parse('2026-11-28T10:00:00.000Z'))
  dir = await mkdtemp(join(tmpdir(), 'dw-approval-'))
  stub = await startStub({ dshHome: join(dir, 'dsh'), port: 0 })
  await writeFile(join(dir, 'credential'), 'cred-123\n', { mode: 0o600 })
  wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(wss, 'listening')
})

afterEach(async () => {
  await bridge?.close()
  bridge = undefined
  for (const c of wss.clients) c.terminate()
  await new Promise<void>((r) => { wss.close(() => r()) })
  await stub.close()
  await rm(dir, { recursive: true, force: true })
  vi.useRealTimers()
})

describe('device-side grant approval (opt-in)', () => {
  it('refuses unlisted grants, capabilities and widgets the device did not approve', async () => {
    const file = join(dir, 'approved.json')
    await writeFile(file, JSON.stringify({ grants: { grant_ro: { scope: ['widgets:read'], widgets: ['groceries'] }, grant_other: { scope: ['widgets:read', 'widgets:call'], widgets: ['pantry'] } } }))
    const socket = await connect(file)
    expect(code(await call(socket, 'widget_call', callArgs('x'), 'grant_unknown'))).toBe('grant-not-approved-locally')
    expect(code(await call(socket, 'widget_call', callArgs('x'), 'grant_ro'))).toBe('grant-not-approved-locally')
    expect(code(await call(socket, 'widget_call', callArgs('x'), 'grant_other'))).toBe('grant-not-approved-locally')
    expect((await call(socket, 'widget_list', LIST, 'grant_ro')).ok).toBe(true)
    expect(await adds()).toBe(0)
  }, 20_000)

  it('an approved grant works, and a missing or malformed file refuses everything', async () => {
    const file = join(dir, 'approved.json')
    await writeFile(file, JSON.stringify({ grants: { grant_1: { scope: ['widgets:read', 'widgets:call'], widgets: ['groceries'] } } }))
    const socket = await connect(file)
    expect((await call(socket, 'widget_call', callArgs('milk'))).ok).toBe(true)
    await writeFile(file, 'not json')
    expect(code(await call(socket, 'widget_call', callArgs('eggs')))).toBe('grant-not-approved-locally')
    await rm(file)
    expect(code(await call(socket, 'widget_list', LIST))).toBe('grant-not-approved-locally')
    expect(await adds()).toBe(1)
  }, 20_000)

  it('without the file the bridge behaves as before', async () => {
    const socket = await connect()
    expect((await call(socket, 'widget_call', callArgs('milk'))).ok).toBe(true)
  }, 20_000)
})

describe('operation journal at the bridge', () => {
  it('applies a requestId once per grant, refuses different args, and keeps grants apart', async () => {
    const socket = await connect()
    expect((await call(socket, 'widget_call', callArgs('milk', 'req-00000001'))).ok).toBe(true)
    expect((await call(socket, 'widget_call', callArgs('milk', 'req-00000001'))).ok).toBe(true)
    expect(await adds()).toBe(1)
    expect(code(await call(socket, 'widget_call', callArgs('eggs', 'req-00000001')))).toBe('idempotency-conflict')
    expect(await adds()).toBe(1)
    expect((await call(socket, 'widget_call', callArgs('milk', 'req-00000001'), 'grant_2')).ok).toBe(true)
    expect(await adds()).toBe(2)
    expect((await call(socket, 'widget_call', callArgs('milk'))).ok).toBe(true)
    expect((await call(socket, 'widget_call', callArgs('milk'))).ok).toBe(true)
    expect(await adds()).toBe(4)
  }, 20_000)
})
