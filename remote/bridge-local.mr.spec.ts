import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import type { IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import { startStub } from './stub/src/server.ts'
import { startBridge } from './bridge/src/main.ts'

// Test helper: signs a compact JWS (alg EdDSA, Ed25519) the way the worker will.
function signAssertion(privateKey: KeyObject, claims: Record<string, unknown>, kid = 'test-key'): string {
  const head = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid, typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = sign(null, Buffer.from(`${head}.${body}`), privateKey)
  return `${head}.${body}.${signature.toString('base64url')}`
}
const argsHash = (argsJson: string): string => createHash('sha256').update(argsJson).digest('base64url')

type Frame = Record<string, unknown>
type Call = { tool: string; args: Record<string, unknown>; by: string }
type Link = { socket: WebSocket; req: IncomingMessage }

const T0 = Date.parse('2026-11-28T10:00:00.000Z')
const DEVICE = 'dev_test'
const keys = generateKeyPairSync('ed25519')
const publicKey = keys.publicKey.export({ format: 'jwk' })
const ADD_MILK = JSON.stringify({ slug: 'groceries', action: 'add', args: { item: 'milk' } })
const ADD_EGGS = JSON.stringify({ slug: 'groceries', action: 'add', args: { item: 'eggs' } })

let dir = ''
let dshHome = ''
let stub: Awaited<ReturnType<typeof startStub>>
let wss: WebSocketServer
let bridge: Awaited<ReturnType<typeof startBridge>> | undefined

function claims(tool: string, argsJson: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return { v: 1, iss: 'dw-relay', aud: DEVICE, sub: 'owner', cid: 'client_abc123', gid: 'grant_1', scope: 'widgets:read widgets:call', wid: ['groceries'], tool, ah: argsHash(argsJson), iat: now, exp: now + 30, jti: randomBytes(16).toString('base64url'), ...over }
}
const jws = (c: Record<string, unknown>): string => signAssertion(keys.privateKey, c)
const codeOf = (frame: Frame): unknown => (frame.error as { code?: unknown } | undefined)?.code
const recorded = async (): Promise<Call[]> => (await stub.calls()) as unknown as Call[]

async function connectBridge(): Promise<Link> {
  const conn = new Promise<Link>((resolve) => {
    wss.once('connection', (socket, req) => resolve({ socket, req }))
  })
  bridge = await startBridge({ workerUrl: `http://127.0.0.1:${(wss.address() as AddressInfo).port}`, credentialFile: join(dir, 'credential'), publicKey, dshHome, killFile: join(dir, 'KILL') })
  const link = await conn
  link.socket.send(JSON.stringify({ type: 'hello', serverTime: Date.now(), deviceId: DEVICE }))
  return link
}

function send(socket: WebSocket, id: string, assertion: string, argsJson: string, extra: Frame = {}): Promise<Frame> {
  return new Promise((resolve) => {
    const onMessage = (data: unknown): void => {
      const frame = JSON.parse(String(data)) as Frame
      if (frame.type === 'result' && frame.id === id) {
        socket.off('message', onMessage)
        resolve(frame)
      }
    }
    socket.on('message', onMessage)
    socket.send(JSON.stringify({ type: 'call', id, assertion, argsJson, ...extra }))
  })
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  dir = await mkdtemp(join(tmpdir(), 'mr-bridge-'))
  dshHome = join(dir, 'dsh')
  stub = await startStub({ dshHome, port: 0 })
  await writeFile(join(dir, 'credential'), 'cred-123\n', { mode: 0o600 })
  wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await once(wss, 'listening')
})

afterEach(async () => {
  await bridge?.close()
  bridge = undefined
  for (const client of wss.clients) client.terminate()
  await new Promise<void>((resolve) => { wss.close(() => resolve()) })
  await stub.close()
  await rm(dir, { recursive: true, force: true })
  vi.useRealTimers()
})

describe('bridge relay and local forwarding', () => {
  it('dials /device/connect with the device credential as a bearer', async () => {
    const { req } = await connectBridge()
    expect(req.url).toBe('/device/connect')
    expect(req.headers.authorization).toBe('Bearer cred-123')
  }, 20_000)

  it('forwards a verified widget_call to the stub as a remote- agent', async () => {
    const { socket } = await connectBridge()
    const reply = await send(socket, 'c1', jws(claims('widget_call', ADD_MILK)), ADD_MILK)
    expect(reply.ok).toBe(true)
    const seen = await recorded()
    expect(seen.length).toBe(1)
    expect(seen[0]?.tool).toBe('widget_call')
    expect(seen[0]?.by.startsWith('remote-')).toBe(true)
    expect(seen[0]?.args).toMatchObject({ slug: 'groceries', action: 'add' })
  }, 20_000)

  it('takes the tool name from the verified assertion, never from the frame', async () => {
    const { socket } = await connectBridge()
    const args = JSON.stringify({})
    const reply = await send(socket, 'c2', jws(claims('widget_list', args, { scope: 'widgets:read' })), args, { tool: 'widget_install', name: 'widget_install' })
    expect(reply.ok).toBe(true)
    expect((await recorded()).map((call) => call.tool)).toEqual(['widget_list'])
  }, 20_000)

  it('works again after a stub restart by re-handshaking', async () => {
    const { socket } = await connectBridge()
    expect((await send(socket, 'r1', jws(claims('widget_call', ADD_MILK)), ADD_MILK)).ok).toBe(true)
    await stub.restart()
    expect((await send(socket, 'r2', jws(claims('widget_call', ADD_EGGS)), ADD_EGGS)).ok).toBe(true)
    const seen = await recorded()
    expect(seen.length).toBe(2)
    expect(seen[0]?.by.startsWith('remote-')).toBe(true)
    expect(seen[1]?.by.startsWith('remote-')).toBe(true)
    expect(seen[1]?.by).not.toBe(seen[0]?.by)
  }, 20_000)

  it('strips source fields from widget_describe results', async () => {
    const { socket } = await connectBridge()
    const args = JSON.stringify({ slug: 'groceries' })
    const reply = await send(socket, 'd1', jws(claims('widget_describe', args, { scope: 'widgets:read' })), args)
    expect(reply.ok).toBe(true)
    const text = JSON.stringify(reply.result)
    expect(text).toContain('groceries')
    expect(text).not.toContain('source')
  }, 20_000)

  it('refuses every call with killed-locally while the kill file exists', async () => {
    const { socket } = await connectBridge()
    await writeFile(join(dir, 'KILL'), '')
    const reply = await send(socket, 'k1', jws(claims('widget_call', ADD_MILK)), ADD_MILK)
    expect(reply.ok).toBe(false)
    expect(codeOf(reply)).toBe('killed-locally')
    expect(await recorded()).toEqual([])
    await rm(join(dir, 'KILL'))
    const again = await send(socket, 'k2', jws(claims('widget_call', ADD_MILK)), ADD_MILK)
    expect(again.ok).toBe(true)
  }, 20_000)

  it('answers assertion-rejected for widget_install and never reaches the stub', async () => {
    const { socket } = await connectBridge()
    const args = JSON.stringify({ slug: 'groceries' })
    const reply = await send(socket, 'x1', jws(claims('widget_install', args)), args)
    expect(reply.ok).toBe(false)
    expect(codeOf(reply)).toBe('assertion-rejected')
    expect(typeof (reply.error as { message?: unknown } | undefined)?.message).toBe('string')
    expect(await recorded()).toEqual([])
  }, 20_000)

  it('refuses a local server whose proof does not match with local-unavailable', async () => {
    const file = join(dshHome, 'deepwidgets', 'mcp.json')
    const current = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
    await writeFile(file, JSON.stringify({ ...current, nonce: randomBytes(16).toString('base64url') }), { mode: 0o600 })
    const { socket } = await connectBridge()
    const reply = await send(socket, 'p1', jws(claims('widget_call', ADD_MILK)), ADD_MILK)
    expect(reply.ok).toBe(false)
    expect(codeOf(reply)).toBe('local-unavailable')
    expect(await recorded()).toEqual([])
  }, 20_000)
})
