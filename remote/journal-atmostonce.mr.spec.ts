import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { once } from 'node:events'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WebSocketServer, type WebSocket } from 'ws'
import { createJournal } from './bridge/src/journal.ts'
import { startBridge } from './bridge/src/main.ts'
import { startStub } from './stub/src/server.ts'

type V = { ok: boolean; n?: number }
type Row = Record<string, unknown>
const ok = (r: V): boolean => r.ok
const NUL = String.fromCharCode(0)
const k = (id: string): string => `g${NUL}${id}`
const UNKNOWN = { ok: true, outcomeUnknown: true }
const LOST = { ok: true, replayed: true, resultLost: true }
const open = (o: Record<string, unknown>): ReturnType<typeof createJournal> => createJournal(o as never)
const MIB8 = 8 * 1024 * 1024

let dir = ''
let file = ''

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.parse('2026-11-28T10:00:00.000Z'))
  dir = mkdtempSync(join(tmpdir(), 'journal-atmostonce-'))
  file = join(dir, 'journal.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.useRealTimers()
})

const snapshot = (): Row[] | null => (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { entries: Row[] }).entries : null)

function gate(): { exec: () => Promise<V>; release: (v: V) => void } {
  let release: (v: V) => void = () => undefined
  const exec = (): Promise<V> => new Promise<V>((done) => { release = done })
  return { exec, release: (v: V) => release(v) }
}

describe('at-most-once durable journal', () => {
  it('writes a pending row before exec runs', async () => {
    const a = open({ file, now: () => 1000 })
    let during: Row[] | null | undefined
    await a.run<V>('g', 'r-1', 'h1', async () => { during = snapshot(); return { ok: true, n: 1 } }, ok)
    expect(during).toEqual([{ key: k('r-1'), ah: 'h1', at: 1000, pending: true }])
  })

  it('turns the pending row into a finished row when the value is kept', async () => {
    const a = open({ file, now: () => 1000 })
    let during: Row[] | null | undefined
    await a.run<V>('g', 'r-1', 'h1', async () => { during = snapshot(); return { ok: true, n: 1 } }, ok)
    expect(during).toEqual([{ key: k('r-1'), ah: 'h1', at: 1000, pending: true }])
    expect(snapshot()).toEqual([{ key: k('r-1'), ah: 'h1', at: 1000, value: { ok: true, n: 1 } }])
  })

  it('removes the pending row when the run ends not kept and release says no write', async () => {
    const a = open({ file, now: () => 1000 })
    let during: Row[] | null | undefined
    const res = await a.run<V>('g', 'r-1', 'h1', async () => { during = snapshot(); return { ok: false } }, ok, () => true)
    expect(res).toEqual({ status: 'ran', value: { ok: false } })
    expect(during).toEqual([{ key: k('r-1'), ah: 'h1', at: 1000, pending: true }])
    expect(snapshot()).toEqual([])
    const b = open({ file, unknown: UNKNOWN, now: () => 1000 })
    expect(b.size()).toBe(0)
    let runs = 0
    const again = await b.run<V>('g', 'r-1', 'h1', async () => { runs++; return { ok: true, n: 2 } }, ok)
    expect(again).toEqual({ status: 'ran', value: { ok: true, n: 2 } })
    expect(runs).toBe(1)
  })

  it('removes the pending row when exec rejects and release says no write', async () => {
    const a = open({ file, now: () => 1000 })
    let during: Row[] | null | undefined
    await expect(a.run<V>('g', 'r-1', 'h1', () => { during = snapshot(); return Promise.reject(new Error('boom')) }, ok, () => true)).rejects.toThrow('boom')
    expect(during).toEqual([{ key: k('r-1'), ah: 'h1', at: 1000, pending: true }])
    expect(snapshot()).toEqual([])
    const b = open({ file, unknown: UNKNOWN, now: () => 1000 })
    let runs = 0
    const again = await b.run<V>('g', 'r-1', 'h1', async () => { runs++; return { ok: true, n: 3 } }, ok)
    expect(again).toEqual({ status: 'ran', value: { ok: true, n: 3 } })
    expect(runs).toBe(1)
  })

  it('answers unknown after a restart for a pending row and does not run exec', async () => {
    const a = open({ file, now: () => 1000 })
    const g = gate()
    const first = a.run<V>('g', 'r-1', 'h1', g.exec, ok)
    const b = open({ file, unknown: UNKNOWN, now: () => 1000 })
    expect(b.size()).toBe(1)
    let runs = 0
    const res = await b.run<V>('g', 'r-1', 'h1', async () => { runs++; return { ok: true, n: 2 } }, ok)
    expect(res).toEqual({ status: 'ran', value: UNKNOWN })
    expect(runs).toBe(0)
    g.release({ ok: true, n: 1 })
    await first
  })

  it('answers conflict after a restart for a pending row with other args', async () => {
    const a = open({ file, now: () => 1000 })
    const g = gate()
    const first = a.run<V>('g', 'r-1', 'h1', g.exec, ok)
    const b = open({ file, unknown: UNKNOWN, now: () => 1000 })
    let runs = 0
    const res = await b.run<V>('g', 'r-1', 'h2', async () => { runs++; return { ok: true, n: 2 } }, ok)
    expect(res).toEqual({ status: 'conflict' })
    expect(runs).toBe(0)
    g.release({ ok: true, n: 1 })
    await first
  })

  it('expires a pending row with the ttl', async () => {
    const a = open({ file, ttlMs: 1000, now: () => 0 })
    const g = gate()
    const first = a.run<V>('g', 'r-1', 'h1', g.exec, ok)
    const fresh = open({ file, ttlMs: 1000, now: () => 500, unknown: UNKNOWN })
    let runsFresh = 0
    const early = await fresh.run<V>('g', 'r-1', 'h1', async () => { runsFresh++; return { ok: true, n: 2 } }, ok)
    expect(early).toEqual({ status: 'ran', value: UNKNOWN })
    expect(runsFresh).toBe(0)
    const late = open({ file, ttlMs: 1000, now: () => 5000, unknown: UNKNOWN })
    expect(late.size()).toBe(0)
    let runsLate = 0
    const res = await late.run<V>('g', 'r-1', 'h1', async () => { runsLate++; return { ok: true, n: 2 } }, ok)
    expect(res).toEqual({ status: 'ran', value: { ok: true, n: 2 } })
    expect(runsLate).toBe(1)
    g.release({ ok: true, n: 1 })
    await first
  })

  it('never evicts an in-flight entry past max in memory mode', async () => {
    const j = open({ max: 2 })
    const gates = ['r1', 'r2', 'r3'].map((id) => ({ id, g: gate() }))
    const runs = gates.map(({ id, g }) => j.run<V>('g', id, 'h', g.exec, ok))
    expect(j.size()).toBe(3)
    gates.forEach(({ g }, i) => { g.release({ ok: true, n: i }) })
    await Promise.all(runs)
    let reruns = 0
    const again = await j.run<V>('g', 'r1', 'h', async () => { reruns++; return { ok: true, n: 99 } }, ok)
    expect(again).toEqual({ status: 'ran', value: { ok: true, n: 0 } })
    expect(reruns).toBe(0)
  })

  it('drops only the oldest finished entry when over max', async () => {
    const j = open({ max: 2 })
    const g0 = gate()
    const p0 = j.run<V>('g', 'r0', 'h', g0.exec, ok)
    await j.run<V>('g', 'r1', 'h', async () => ({ ok: true, n: 1 }), ok)
    const g2 = gate()
    const p2 = j.run<V>('g', 'r2', 'h', g2.exec, ok)
    expect(j.size()).toBe(2)
    g0.release({ ok: true, n: 0 })
    g2.release({ ok: true, n: 2 })
    await Promise.all([p0, p2])
    let runs0 = 0
    const again0 = await j.run<V>('g', 'r0', 'h', async () => { runs0++; return { ok: true, n: 50 } }, ok)
    expect(again0).toEqual({ status: 'ran', value: { ok: true, n: 0 } })
    expect(runs0).toBe(0)
    let runs1 = 0
    const again1 = await j.run<V>('g', 'r1', 'h', async () => { runs1++; return { ok: true, n: 7 } }, ok)
    expect(again1).toEqual({ status: 'ran', value: { ok: true, n: 7 } })
    expect(runs1).toBe(1)
  })

  it('never evicts a pending entry past max in file mode', async () => {
    const a = open({ file, max: 2, now: () => 1000 })
    const gates = ['r1', 'r2', 'r3'].map((id) => ({ id, g: gate() }))
    const runs = gates.map(({ id, g }) => a.run<V>('g', id, 'h', g.exec, ok))
    expect(a.size()).toBe(3)
    const rows = snapshot() ?? []
    expect(rows.length).toBe(3)
    expect(rows.every((r) => r.pending === true)).toBe(true)
    const b = open({ file, max: 2, unknown: UNKNOWN, now: () => 1000 })
    expect(b.size()).toBe(3)
    gates.forEach(({ g }, i) => { g.release({ ok: true, n: i }) })
    await Promise.all(runs)
  })

  it('loads an oversized file as empty and fails closed', async () => {
    const pad = 'x'.repeat(MIB8 + 1)
    writeFileSync(file, JSON.stringify({ v: 1, entries: [{ key: k('r-1'), ah: 'h1', at: 1000, value: { pad } }] }))
    expect(statSync(file).size).toBeGreaterThan(MIB8)
    let j!: ReturnType<typeof createJournal>
    expect(() => { j = open({ file, now: () => 1000 }) }).not.toThrow()
    expect(j.size()).toBe(0)
    expect(j.healthy()).toBe(false)
    let runs = 0
    const res = await j.run<V>('g', 'r-1', 'h1', async () => { runs++; return { ok: true, n: 1 } }, ok)
    expect(res).toEqual({ status: 'unavailable' })
    expect(runs).toBe(0)
    expect(statSync(file).size).toBeGreaterThan(MIB8)
  })

  it('skips malformed rows when loading', async () => {
    const rows = [
      JSON.stringify({ key: k('r-ok'), ah: 'h1', at: 1000, value: { ok: true, n: 1 } }),
      JSON.stringify({ key: `g${NUL}${'x'.repeat(510)}`, ah: 'h1', at: 1000 }),
      JSON.stringify({ key: k('r-ah512'), ah: 'a'.repeat(512), at: 1000 }),
      JSON.stringify({ key: `g${NUL}${'x'.repeat(511)}`, ah: 'h1', at: 1000 }),
      JSON.stringify({ key: k('r-ah513'), ah: 'a'.repeat(513), at: 1000 }),
      JSON.stringify({ key: k('r-str'), ah: 'h1', at: '1000' }),
      JSON.stringify({ key: k('r-inf'), ah: 'h1', at: 7 }).replace(':7}', ':1e999}'),
      JSON.stringify({ key: k('r-noah'), at: 1000 }),
      JSON.stringify({ key: 5, ah: 'h1', at: 1000 }),
      JSON.stringify({ key: k('r-ahnum'), ah: 7, at: 1000 }),
      'null',
      '7',
      JSON.stringify('str'),
    ]
    writeFileSync(file, JSON.stringify({ v: 1, entries: [] }).replace('[]', `[${rows.join(',')}]`))
    let j!: ReturnType<typeof createJournal>
    expect(() => { j = open({ file, now: () => 1000, lost: LOST }) }).not.toThrow()
    expect(j.size()).toBe(3)
    let runs = 0
    const res = await j.run<V>('g', 'r-ok', 'h1', async () => { runs++; return { ok: true, n: 2 } }, ok)
    expect(res).toEqual({ status: 'ran', value: { ok: true, n: 1 } })
    expect(runs).toBe(0)
  })

  it('does not write through a pre-existing temp symlink and leaves no stray temp file', async () => {
    const victim = join(dir, 'victim.txt')
    writeFileSync(victim, 'keep')
    symlinkSync(victim, `${file}.tmp`)
    const a = open({ file, now: () => 1000 })
    await a.run<V>('g', 'r-1', 'h1', async () => ({ ok: true, n: 1 }), ok)
    expect(readFileSync(victim, 'utf8')).toBe('keep')
    expect(existsSync(file)).toBe(true)
    expect(statSync(file).mode & 0o777).toBe(0o600)
    const stray = readdirSync(dir).filter((name) => name.endsWith('.tmp') && name !== 'journal.json.tmp')
    expect(stray).toEqual([])
  })
})

type Frame = Record<string, unknown>
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

describe('bridge outcome-unknown for a pending journal row', () => {
  let stub: Awaited<ReturnType<typeof startStub>>
  let wss: WebSocketServer
  let bridge: Awaited<ReturnType<typeof startBridge>> | undefined
  let n = 0

  beforeEach(async () => {
    stub = await startStub({ dshHome: join(dir, 'dsh'), port: 0 })
    writeFileSync(join(dir, 'credential'), 'cred-123\n'.replace('\\n', String.fromCharCode(10)), { mode: 0o600 })
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

  async function connect(): Promise<WebSocket> {
    const conn = new Promise<WebSocket>((resolve) => { wss.once('connection', (socket) => resolve(socket)) })
    bridge = await startBridge({
      workerUrl: `http://127.0.0.1:${(wss.address() as AddressInfo).port}`, credentialFile: join(dir, 'credential'), publicKey,
      dshHome: join(dir, 'dsh'), killFile: join(dir, 'KILL'), journalFile: file, log: () => undefined,
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

  const adds = async (): Promise<number> => ((await stub.calls()) as unknown as { tool: string }[]).filter((c) => c.tool === 'widget_call').length

  it('answers a pending row with an outcome-unknown result and sends nothing to the local server', async () => {
    const argsJson = callArgs('milk', 'req-00000001')
    writeFileSync(file, JSON.stringify({ v: 1, entries: [{ key: `grant_1${NUL}req-00000001`, ah: hash(argsJson), at: Date.now(), pending: true }] }))
    const socket = await connect()
    const frame = await call(socket, 'widget_call', argsJson)
    expect(frame.ok).toBe(true)
    const result = frame.result as { isError?: unknown; structuredContent?: unknown; content?: { type: string; text: string }[] }
    const expected = { error: { code: 'outcome-unknown', message: 'The outcome of this requestId is unknown.', nextStep: 'Read the state with widget_describe before deciding; do not resend this requestId for a new operation.' } }
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toEqual(expected)
    expect(result.content?.[0]?.type).toBe('text')
    expect(JSON.parse(result.content?.[0]?.text ?? 'null')).toEqual(expected)
    expect(await adds()).toBe(0)
    const other = await call(socket, 'widget_call', callArgs('eggs', 'req-00000001'))
    expect((other.error as { code?: unknown } | undefined)?.code).toBe('idempotency-conflict')
    expect(await adds()).toBe(0)
  }, 20_000)
})
