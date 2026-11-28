import { describe, expect, it } from 'vitest'
import { createJournal } from '../bridge/src/journal.ts'

const ok = (r: { ok: boolean }): boolean => r.ok

describe('operation journal', () => {
  it('runs a requestId once per grant and replays the first answer', async () => {
    const j = createJournal()
    let runs = 0
    const exec = async () => ({ ok: true, n: ++runs })
    const a = await j.run('g1', 'r-1', 'h1', exec, ok)
    const b = await j.run('g1', 'r-1', 'h1', exec, ok)
    expect(runs).toBe(1)
    expect(a).toEqual({ status: 'ran', value: { ok: true, n: 1 } })
    expect(b).toEqual(a)
  })

  it('keeps grants apart: the same requestId under another grant runs again', async () => {
    const j = createJournal()
    let runs = 0
    const exec = async () => ({ ok: true, n: ++runs })
    await j.run('g1', 'r-1', 'h1', exec, ok)
    await j.run('g2', 'r-1', 'h1', exec, ok)
    expect(runs).toBe(2)
  })

  it('refuses the same requestId with different args', async () => {
    const j = createJournal()
    await j.run('g1', 'r-1', 'h1', async () => ({ ok: true }), ok)
    expect(await j.run('g1', 'r-1', 'h2', async () => ({ ok: true }), ok)).toEqual({ status: 'conflict' })
  })

  it('a retry that arrives while the first run is still going waits for it and does not run again', async () => {
    const j = createJournal()
    let runs = 0
    let release: (v: { ok: boolean }) => void = () => undefined
    const slow = () => { runs++; return new Promise<{ ok: boolean }>((done) => { release = done }) }
    const first = j.run('g1', 'r-1', 'h1', slow, ok)
    const retry = j.run('g1', 'r-1', 'h1', slow, ok)
    release({ ok: true })
    expect(await first).toEqual(await retry)
    expect(runs).toBe(1)
  })

  it('drops a run that did not end ok, so a retry runs again', async () => {
    const j = createJournal()
    let runs = 0
    const exec = async () => ({ ok: runs++ > 0 })
    expect((await j.run('g1', 'r-1', 'h1', exec, ok))).toEqual({ status: 'ran', value: { ok: false } })
    await Promise.resolve()
    expect((await j.run('g1', 'r-1', 'h1', exec, ok))).toEqual({ status: 'ran', value: { ok: true } })
    expect(runs).toBe(2)
  })

  it('forgets entries after the ttl and keeps at most max', async () => {
    let now = 0
    const j = createJournal({ ttlMs: 1000, max: 2, now: () => now })
    await j.run('g', 'a', 'h', async () => ({ ok: true }), ok)
    await j.run('g', 'b', 'h', async () => ({ ok: true }), ok)
    await j.run('g', 'c', 'h', async () => ({ ok: true }), ok)
    expect(j.size()).toBe(2)
    now = 5000
    await j.run('g', 'd', 'h', async () => ({ ok: true }), ok)
    expect(j.size()).toBe(1)
  })
})
