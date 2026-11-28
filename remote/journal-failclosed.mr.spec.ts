import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import { createJournal } from './bridge/src/journal.ts'
import * as mainModule from './bridge/src/main.ts'
import { createLocal } from './bridge/src/local.ts'
import { startStub } from './stub/src/server.ts'

type Row = Record<string, unknown>
type Frame = Record<string, unknown>
type J = ReturnType<typeof createJournal>
type Release = (value: unknown, error: unknown) => boolean
type RunWith = (gid: string, requestId: string, ah: string, exec: () => Promise<unknown>, keep: (value: unknown) => boolean, release?: Release) => Promise<unknown>

const NUL = String.fromCharCode(0)
const k = (id: string): string => `g${NUL}${id}`
const MIB8 = 8 * 1024 * 1024
const UNKNOWN = { ok: true, outcomeUnknown: true }
const DURABLE_MESSAGE = 'the bridge could not record this operation durably, so it did not send it'
const PRE_WRITE_CODES = ['unknown-widget', 'unknown-action', 'invalid-args', 'bad-request', 'busy', 'safe-mode', 'widget-failed', 'mode-off', 'idempotency-conflict', 'conflict']

const open = (o: Record<string, unknown>): J => createJournal(o as never)
const run = (j: J, requestId: string, exec: () => Promise<unknown>, keep: (value: unknown) => boolean, release?: Release): Promise<unknown> =>
  (j.run as unknown as RunWith).call(j, 'g', requestId, 'h1', exec, keep, release)
const healthy = (j: J): unknown => (j as unknown as { healthy?: () => boolean }).healthy?.()
const kept = (value: unknown): boolean => {
  const r = value as { ok?: unknown; result?: { isError?: unknown } } | null
  return r?.ok === true && r.result?.isError !== true
}
const toolError = (code: string): Record<string, unknown> => {
  const body = { error: { code, message: `the ${code} failure`, nextStep: 'Read the state with widget_describe.' } }
  return { ok: true, result: { content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body, isError: true } }
}
function counter(value: unknown): { exec: () => Promise<unknown>; count: () => number } {
  let n = 0
  return { exec: async () => { n++; return value }, count: () => n }
}

let dir = ''
let file = ''

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.parse('2026-11-28T10:00:00.000Z'))
  dir = mkdtempSync(join(tmpdir(), 'journal-failclosed-'))
  file = join(dir, 'journal.json')
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(dir, { recursive: true, force: true })
  vi.useRealTimers()
})

const rowsFor = (key: string): Row[] => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { entries: Row[] }).entries : []).filter((r) => r.key === key)

describe('fail-closed durable journal', () => {
  it('returns unavailable and never calls exec when the pending row cannot be written', async () => {
    const j = open({ file, unknown: UNKNOWN })
    // A non-empty directory at <file> makes the atomic rename of the pending row fail.
    mkdirSync(file)
    writeFileSync(join(file, 'block'), 'x')
    const c = counter({ ok: true, result: { n: 1 } })
    const res = await run(j, 'r-1', c.exec, kept)
    expect(res).toEqual({ status: 'unavailable' })
    expect(c.count()).toBe(0)
    expect(j.size()).toBe(0)
    rmSync(file, { recursive: true, force: true })
    const again = await run(j, 'r-1', c.exec, kept)
    expect(again).toEqual({ status: 'ran', value: { ok: true, result: { n: 1 } } })
    expect(c.count()).toBe(1)
  })

  it('marks a corrupt journal file unhealthy and answers unavailable without calling exec or rewriting it', async () => {
    writeFileSync(file, 'not json{')
    let j!: J
    expect(() => { j = open({ file, unknown: UNKNOWN }) }).not.toThrow()
    expect(healthy(j)).toBe(false)
    const c = counter({ ok: true, result: { n: 1 } })
    expect(await run(j, 'r-1', c.exec, kept)).toEqual({ status: 'unavailable' })
    expect(await run(j, 'r-2', c.exec, kept)).toEqual({ status: 'unavailable' })
    expect(c.count()).toBe(0)
    expect(readFileSync(file, 'utf8')).toBe('not json{')
  })

  it('marks a journal file over 8 MiB unhealthy and answers unavailable', async () => {
    writeFileSync(file, 'x'.repeat(MIB8 + 1))
    const j = open({ file, unknown: UNKNOWN })
    expect(healthy(j)).toBe(false)
    const c = counter({ ok: true, result: { n: 1 } })
    expect(await run(j, 'r-1', c.exec, kept)).toEqual({ status: 'unavailable' })
    expect(c.count()).toBe(0)
  })

  it('treats a missing journal file as healthy and runs exec', async () => {
    const j = open({ file, unknown: UNKNOWN })
    expect(healthy(j)).toBe(true)
    const c = counter({ ok: true, result: { n: 1 } })
    expect(await run(j, 'r-1', c.exec, kept)).toEqual({ status: 'ran', value: { ok: true, result: { n: 1 } } })
    expect(c.count()).toBe(1)
  })

  it('keeps a memory-only journal healthy and dispatching', async () => {
    const j = open({})
    expect(healthy(j)).toBe(true)
    const c = counter({ ok: true, result: { n: 1 } })
    expect(await run(j, 'r-1', c.exec, kept)).toEqual({ status: 'ran', value: { ok: true, result: { n: 1 } } })
    expect(c.count()).toBe(1)
  })

  it('keeps the pending row when release says false, so a retry in the same process gets unknown without exec', async () => {
    const a = open({ file, unknown: UNKNOWN })
    const value = toolError('timeout-after-write')
    const c = counter(value)
    const release = vi.fn((_value: unknown, _error: unknown): boolean => false)
    expect(await run(a, 'r-1', c.exec, kept, release)).toEqual({ status: 'ran', value })
    expect(release).toHaveBeenCalledWith(value, undefined)
    const rows = rowsFor(k('r-1'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.pending).toBe(true)
    expect(await run(a, 'r-1', c.exec, kept, release)).toEqual({ status: 'ran', value: UNKNOWN })
    expect(c.count()).toBe(1)
  })

  it('answers unknown after a restart for a row that release kept', async () => {
    const a = open({ file, unknown: UNKNOWN })
    const value = toolError('timeout-after-write')
    const c = counter(value)
    await run(a, 'r-1', c.exec, kept, () => false)
    expect(c.count()).toBe(1)
    const b = open({ file, unknown: UNKNOWN })
    const c2 = counter({ ok: true, result: { n: 2 } })
    expect(await run(b, 'r-1', c2.exec, kept, () => false)).toEqual({ status: 'ran', value: UNKNOWN })
    expect(c2.count()).toBe(0)
  })

  it('keeps the pending row when exec rejects and release says false', async () => {
    const a = open({ file, unknown: UNKNOWN })
    const boom = new Error('socket reset')
    let n = 0
    const exec = async (): Promise<unknown> => { n++; throw boom }
    const release = vi.fn((_value: unknown, _error: unknown): boolean => false)
    await expect(run(a, 'r-1', exec, kept, release)).rejects.toThrow('socket reset')
    expect(release).toHaveBeenCalledWith(undefined, boom)
    expect(rowsFor(k('r-1'))).toHaveLength(1)
    expect(await run(a, 'r-1', exec, kept, release)).toEqual({ status: 'ran', value: UNKNOWN })
    expect(n).toBe(1)
  })

  it('drops the row when release says true and a retry runs exec again', async () => {
    const a = open({ file, unknown: UNKNOWN })
    const value = toolError('invalid-args')
    const c = counter(value)
    const release = vi.fn((_value: unknown, _error: unknown): boolean => true)
    expect(await run(a, 'r-1', c.exec, kept, release)).toEqual({ status: 'ran', value })
    expect(release).toHaveBeenCalledWith(value, undefined)
    expect(rowsFor(k('r-1'))).toHaveLength(0)
    expect(await run(a, 'r-1', c.exec, kept, release)).toEqual({ status: 'ran', value })
    expect(c.count()).toBe(2)
  })
})

describe('bridge release policy', () => {
  const policy = (): ((value: unknown, error: unknown) => boolean) | undefined =>
    (mainModule as unknown as Record<string, unknown>).isPreWriteFailure as ((value: unknown, error: unknown) => boolean) | undefined

  it('releases the reservation for each pre-write tool error code', () => {
    const fn = policy()
    expect(typeof fn).toBe('function')
    if (fn === undefined) return
    for (const code of PRE_WRITE_CODES) expect(fn(toolError(code), undefined), code).toBe(true)
  })

  it('keeps the reservation for timeout-after-write, handler-error, local failures, thrown errors and non-error results', () => {
    const fn = policy()
    expect(typeof fn).toBe('function')
    if (fn === undefined) return
    expect(fn(toolError('timeout-after-write'), undefined)).toBe(false)
    expect(fn(toolError('handler-error'), undefined)).toBe(false)
    expect(fn(toolError('internal-error'), undefined)).toBe(false)
    expect(fn({ ok: false, code: 'local-unavailable', message: 'deepWidgets is not reachable on this device right now' }, undefined)).toBe(false)
    expect(fn({ ok: false, code: 'local-error', message: 'deepWidgets could not complete the call' }, undefined)).toBe(false)
    expect(fn(undefined, new Error('fetch failed'))).toBe(false)
    expect(fn({ ok: true, result: { structuredContent: { error: { code: 'busy' } }, isError: false } }, undefined)).toBe(false)
    expect(fn({ ok: true, result: { isError: true } }, undefined)).toBe(false)
  })
})

const DEVICE = 'dev_test'
const keys = generateKeyPairSync('ed25519')
const publicKey = keys.publicKey.export({ format: 'jwk' })
const hash = (s: string): string => createHash('sha256').update(s).digest('base64url')
const callArgs = (item: string, requestId: string): string => JSON.stringify({ slug: 'groceries', action: 'add', args: { item }, requestId })

function jws(tool: string, argsJson: string, gid = 'grant_1'): string {
  const now = Math.floor(Date.now() / 1000)
  const c = { v: 1, iss: 'dw-relay', aud: DEVICE, sub: 'owner', cid: 'client_abc123', gid, scope: 'widgets:read widgets:call', wid: ['groceries'], tool, ah: hash(argsJson), iat: now, exp: now + 30, jti: randomBytes(16).toString('base64url') }
  const head = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'k', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(c)).toString('base64url')
  return `${head}.${body}.${sign(null, Buffer.from(`${head}.${body}`), keys.privateKey).toString('base64url')}`
}

describe('bridge with a fail-closed journal', () => {
  let stub: Awaited<ReturnType<typeof startStub>>
  let wss: WebSocketServer
  let bridge: Awaited<ReturnType<typeof mainModule.startBridge>> | undefined
  let n = 0

  beforeEach(async () => {
    stub = await startStub({ dshHome: join(dir, 'dsh'), port: 0 })
    writeFileSync(join(dir, 'credential'), 'cred-123\n', { mode: 0o600 })
    wss = new WebSocketServer({ host: '127.0.0.1', port: 0 })
    await once(wss, 'listening')
  })

  afterEach(async () => {
    await bridge?.close()
    bridge = undefined
    for (const c of wss.clients) c.terminate()
    await new Promise<void>((r) => { wss.close(() => r()) })
    await stub.close()
  })

  async function connect(dshHome: string): Promise<WebSocket> {
    const conn = new Promise<WebSocket>((resolve) => { wss.once('connection', (socket) => resolve(socket)) })
    bridge = await mainModule.startBridge({
      workerUrl: `http://127.0.0.1:${String((wss.address() as AddressInfo).port)}`, credentialFile: join(dir, 'credential'), publicKey,
      dshHome, killFile: join(dir, 'KILL'), journalFile: file, log: () => undefined,
    })
    const socket = await conn
    socket.send(JSON.stringify({ type: 'hello', deviceId: DEVICE }))
    return socket
  }

  function call(socket: WebSocket, tool: string, argsJson: string): Promise<Frame> {
    const id = `c${String(++n)}`
    return new Promise((resolve) => {
      const on = (data: unknown): void => {
        const frame = JSON.parse(String(data)) as Frame
        if (frame.type === 'result' && frame.id === id) { socket.off('message', on); resolve(frame) }
      }
      socket.on('message', on)
      socket.send(JSON.stringify({ type: 'call', id, assertion: jws(tool, argsJson), argsJson }))
    })
  }

  const adds = (): number => stub.calls().filter((c) => c.tool === 'widget_call').length

  it('rejects a widget_call with local-unavailable and sends nothing when the journal file is corrupt', async () => {
    writeFileSync(file, 'not json{')
    const socket = await connect(join(dir, 'dsh'))
    const frame = await call(socket, 'widget_call', callArgs('milk', 'req-00000001'))
    expect(frame.ok).toBe(false)
    expect(frame.error).toEqual({ code: 'local-unavailable', message: DURABLE_MESSAGE })
    expect(adds()).toBe(0)
    expect(readFileSync(file, 'utf8')).toBe('not json{')
  }, 20_000)

  it('answers outcome-unknown to a retry after a widget_call ended local-unavailable', async () => {
    const nowhere = join(dir, 'nodsh')
    mkdirSync(join(nowhere, 'deepwidgets'), { recursive: true })
    const socket = await connect(nowhere)
    const argsJson = callArgs('milk', 'req-00000002')
    const first = await call(socket, 'widget_call', argsJson)
    expect(first.ok).toBe(false)
    expect((first.error as { code?: unknown } | undefined)?.code).toBe('local-unavailable')
    const rows = (JSON.parse(readFileSync(file, 'utf8')) as { entries: Row[] }).entries.filter((r) => r.key === `grant_1${NUL}req-00000002`)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.pending).toBe(true)
    const retry = await call(socket, 'widget_call', argsJson)
    expect(retry.ok).toBe(true)
    const result = retry.result as { isError?: unknown; structuredContent?: { error?: { code?: unknown } } }
    expect(result.isError).toBe(true)
    expect(result.structuredContent?.error?.code).toBe('outcome-unknown')
  }, 20_000)
})

describe('one local session per grant', () => {
  it('gives two grants of one client two handshakes and reuses the session of each grant', async () => {
    const dsh = join(dir, 'dsh-local')
    const stub = await startStub({ dshHome: dsh, port: 0 })
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    try {
      const local = createLocal({ dshHome: dsh, log: () => undefined })
      const listAs = (gid: string): Promise<{ ok: boolean }> => local.call({ cid: 'client_abc123', gid, tool: 'widget_list' } as never, {})
      expect((await listAs('grant_a')).ok).toBe(true)
      expect((await listAs('grant_b')).ok).toBe(true)
      expect((await listAs('grant_a')).ok).toBe(true)
      const urlOf = (input: unknown): string => (input instanceof Request ? input.url : String(input))
      const tokenCalls = fetchSpy.mock.calls.filter(([input]) => urlOf(input).endsWith('/mcp/token'))
      expect(tokenCalls).toHaveLength(2)
      const by = stub.calls().filter((c) => c.tool === 'widget_list').map((c) => c.by)
      expect(by).toHaveLength(3)
      expect(by[0]).not.toBe(by[1])
      expect(by[2]).toBe(by[0])
    } finally {
      fetchSpy.mockRestore()
      await stub.close()
    }
  }, 20_000)
})

describe('README journal bullet', () => {
  it('documents DW_JOURNAL_FILE as at-most-once, fail closed and plaintext on the PC', () => {
    const line = readFileSync(new URL('./README.md', import.meta.url), 'utf8').split('\n').find((l) => l.includes('DW_JOURNAL_FILE')) ?? ''
    expect(line).toMatch(/at-most-once/i)
    expect(line).toMatch(/fails? closed/i)
    expect(line).toMatch(/plaintext/i)
    expect(line).toMatch(/0600/)
  })
})
