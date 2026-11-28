import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createJournal } from './bridge/src/journal.ts'
import { startBridge } from './bridge/src/main.ts'

type V = { ok: boolean; n?: number; blob?: string }
const ok = (r: { ok: boolean }): boolean => r.ok
const LOST = { ok: true, replayed: true, resultLost: true }

let dir = ''
let file = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'journal-durable-'))
  file = join(dir, 'journal.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const fileWritten = async (): Promise<void> => {
  await vi.waitFor(() => { expect(existsSync(file)).toBe(true) })
}

describe('durable operation journal', () => {
  it("replays the first journal's value after a restart without running exec", async () => {
    const a = createJournal({ file })
    await a.run<V>('g', 'r-1', 'h1', async () => ({ ok: true, n: 1 }), ok)
    await fileWritten()
    const b = createJournal({ file })
    let runs = 0
    const res = await b.run<V>('g', 'r-1', 'h1', async () => { runs++; return { ok: true, n: 2 } }, ok)
    expect(res).toEqual({ status: 'ran', value: { ok: true, n: 1 } })
    expect(runs).toBe(0)
  })

  it('answers conflict for the same requestId with other args after a restart and does not run exec', async () => {
    const a = createJournal({ file })
    await a.run<V>('g', 'r-1', 'h1', async () => ({ ok: true, n: 1 }), ok)
    await fileWritten()
    const b = createJournal({ file })
    let runs = 0
    const res = await b.run<V>('g', 'r-1', 'h2', async () => { runs++; return { ok: true, n: 2 } }, ok)
    expect(res).toEqual({ status: 'conflict' })
    expect(runs).toBe(0)
  })

  it('returns lost for a value over 16 KiB after a restart', async () => {
    const a = createJournal({ file, lost: LOST })
    await a.run<V>('g', 'r-big', 'h1', async () => ({ ok: true, blob: 'x'.repeat(17 * 1024) }), ok)
    await fileWritten()
    const b = createJournal({ file, lost: LOST })
    let runs = 0
    const res = await b.run<unknown>('g', 'r-big', 'h1', async () => { runs++; return { ok: true } }, ok)
    expect(res).toEqual({ status: 'ran', value: LOST })
    expect(runs).toBe(0)
  })

  it('keeps a value of exactly 16 KiB', async () => {
    // {"a":""} is 8 characters of JSON, so 16376 filler characters make exactly 16384.
    const value = { a: 'y'.repeat(16376) }
    expect(JSON.stringify(value).length).toBe(16384)
    const a = createJournal({ file, lost: LOST })
    await a.run<unknown>('g', 'r-edge', 'h1', async () => value, () => true)
    await fileWritten()
    const b = createJournal({ file, lost: LOST })
    let runs = 0
    const res = await b.run<unknown>('g', 'r-edge', 'h1', async () => { runs++; return { a: 'other' } }, () => true)
    expect(res).toEqual({ status: 'ran', value })
    expect(runs).toBe(0)
  })

  it('writes the file with mode 0600', async () => {
    const a = createJournal({ file })
    await a.run<V>('g', 'r-1', 'h1', async () => ({ ok: true, n: 1 }), ok)
    await fileWritten()
    expect(statSync(file).mode & 0o777).toBe(0o600)
    expect(existsSync(`${file}.tmp`)).toBe(false)
  })

  it('starts empty without throwing on a corrupt file and fails closed without rewriting it', async () => {
    writeFileSync(file, 'not json{')
    let j!: ReturnType<typeof createJournal>
    expect(() => { j = createJournal({ file }) }).not.toThrow()
    expect(j.size()).toBe(0)
    expect(j.healthy()).toBe(false)
    let runs = 0
    const res = await j.run<V>('g', 'r-1', 'h1', async () => { runs++; return { ok: true, n: 1 } }, ok)
    expect(res).toEqual({ status: 'unavailable' })
    expect(runs).toBe(0)
    expect(readFileSync(file, 'utf8')).toBe('not json{')
  })

  it('does not load expired entries', async () => {
    const a = createJournal({ file, ttlMs: 1000, now: () => 0 })
    await a.run<V>('g', 'r-1', 'h1', async () => ({ ok: true, n: 1 }), ok)
    await fileWritten()
    const fresh = createJournal({ file, ttlMs: 1000, now: () => 500 })
    expect(fresh.size()).toBe(1)
    const late = createJournal({ file, ttlMs: 1000, now: () => 5000 })
    expect(late.size()).toBe(0)
    let runs = 0
    const res = await late.run<V>('g', 'r-1', 'h1', async () => { runs++; return { ok: true, n: 2 } }, ok)
    expect(res).toEqual({ status: 'ran', value: { ok: true, n: 2 } })
    expect(runs).toBe(1)
  })

  it('does not dispatch when the pending write fails, and works again once the file can be written', async () => {
    const a = createJournal({ file })
    // A directory at <file> (made after the load, so the journal is healthy) makes the rename of the pending row fail.
    mkdirSync(file)
    let runs = 0
    const exec = async (): Promise<V> => { runs++; return { ok: true, n: runs } }
    expect(await a.run<V>('g', 'r-a', 'h1', exec, ok)).toEqual({ status: 'unavailable' })
    expect(runs).toBe(0)
    expect(statSync(file).isDirectory()).toBe(true)
    rmSync(file, { recursive: true })
    expect(await a.run<V>('g', 'r-a', 'h1', exec, ok)).toEqual({ status: 'ran', value: { ok: true, n: 1 } })
    await a.run<V>('g', 'r-b', 'h1', exec, ok)
    await fileWritten()
    const b = createJournal({ file })
    let runs2 = 0
    const exec2 = async (): Promise<V> => { runs2++; return { ok: true, n: 99 } }
    expect(await b.run<V>('g', 'r-a', 'h1', exec2, ok)).toEqual({ status: 'ran', value: { ok: true, n: 1 } })
    expect(await b.run<V>('g', 'r-b', 'h1', exec2, ok)).toEqual({ status: 'ran', value: { ok: true, n: 2 } })
    expect(runs2).toBe(0)
  })

  it('writes an in-flight run as a pending row that a restart treats as unknown', async () => {
    const UNKNOWN = { ok: true, outcomeUnknown: true }
    const a = createJournal({ file })
    let release: (v: V) => void = () => undefined
    const pending = a.run<V>('g', 'r-x', 'h1', () => new Promise<V>((done) => { release = done }), ok)
    await a.run<V>('g', 'r-y', 'h1', async () => ({ ok: true, n: 1 }), ok)
    await fileWritten()
    const b = createJournal({ file, unknown: UNKNOWN })
    let runsX = 0
    let runsY = 0
    const x = await b.run<unknown>('g', 'r-x', 'h1', async () => { runsX++; return { ok: true, n: 5 } }, ok)
    const y = await b.run<V>('g', 'r-y', 'h1', async () => { runsY++; return { ok: true, n: 6 } }, ok)
    expect(x).toEqual({ status: 'ran', value: UNKNOWN })
    expect(runsX).toBe(0)
    expect(y).toEqual({ status: 'ran', value: { ok: true, n: 1 } })
    expect(runsY).toBe(0)
    release({ ok: true, n: 2 })
    await pending
  })

  it('startBridge throws for a journalFile under DSH_HOME/deepwidgets', async () => {
    const dsh = join(dir, 'dsh')
    mkdirSync(join(dsh, 'deepwidgets'), { recursive: true })
    const credentialFile = join(dir, 'credential')
    writeFileSync(credentialFile, 'dwd_dev.secret\n')
    const settled: unknown = await startBridge({
      workerUrl: 'http://127.0.0.1:9',
      credentialFile,
      publicKey: {} as never,
      dshHome: dsh,
      killFile: join(dir, 'bridge', 'KILL'),
      journalFile: join(dsh, 'deepwidgets', 'journal.json'),
      log: () => undefined,
    } as never).then((bridge) => bridge, (error: unknown) => error)
    if (typeof (settled as { close?: unknown } | null)?.close === 'function') await (settled as { close(): Promise<void> }).close()
    expect(settled).toBeInstanceOf(Error)
    expect((settled as Error).message).toMatch(/outside/)
  })
})
