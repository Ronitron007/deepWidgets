import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createJournal } from './bridge/src/journal.ts'
import { isPreWriteFailure } from './bridge/src/main.ts'

type Row = Record<string, unknown>
type J = ReturnType<typeof createJournal>

const NUL = String.fromCharCode(0)
const k = (id: string): string => `g${NUL}${id}`
const UNKNOWN = { ok: true, outcomeUnknown: true }
const NOT_KEPT = { ok: false }

const open = (o: Record<string, unknown>): J => createJournal(o as never)
const keep = (value: unknown): boolean => (value as { ok?: unknown } | null)?.ok === true

function counter(value: unknown): { exec: () => Promise<unknown>; count: () => number } {
  let n = 0
  return { exec: async () => { n++; return value }, count: () => n }
}

const toolError = (code: string): Record<string, unknown> => {
  const body = { error: { code, message: `the ${code} failure`, nextStep: 'Read the state with widget_describe.' } }
  return { ok: true, result: { content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body, isError: true } }
}

let dir = ''
let file = ''

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.parse('2026-11-28T10:00:00.000Z'))
  dir = mkdtempSync(join(tmpdir(), 'journal-release-'))
  file = join(dir, 'journal.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.useRealTimers()
})

const rowsFor = (key: string): Row[] =>
  (existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as { entries: Row[] }).entries : []).filter((r) => r.key === key)

describe('journal release default without a release callback', () => {
  it('keeps the pending row in file mode when run has no release and the end is not kept', async () => {
    const a = open({ file, unknown: UNKNOWN, now: () => 1000 })
    const c = counter(NOT_KEPT)
    expect(await a.run<unknown>('g', 'r-1', 'h1', c.exec, keep)).toEqual({ status: 'ran', value: NOT_KEPT })
    const rows = rowsFor(k('r-1'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.pending).toBe(true)
    expect(await a.run<unknown>('g', 'r-1', 'h1', c.exec, keep)).toEqual({ status: 'ran', value: UNKNOWN })
    expect(c.count()).toBe(1)
  })

  it('answers unknown after a restart for a row kept by a not-kept end without release', async () => {
    const a = open({ file, unknown: UNKNOWN, now: () => 1000 })
    const c = counter(NOT_KEPT)
    await a.run<unknown>('g', 'r-1', 'h1', c.exec, keep)
    expect(c.count()).toBe(1)
    const b = open({ file, unknown: UNKNOWN, now: () => 1000 })
    expect(await b.run<unknown>('g', 'r-1', 'h1', c.exec, keep)).toEqual({ status: 'ran', value: UNKNOWN })
    expect(c.count()).toBe(1)
  })

  it('keeps the pending row in file mode when exec rejects and no release is given', async () => {
    const a = open({ file, unknown: UNKNOWN, now: () => 1000 })
    let n = 0
    const exec = async (): Promise<unknown> => { n++; throw new Error('socket reset') }
    await expect(a.run<unknown>('g', 'r-1', 'h1', exec, keep)).rejects.toThrow('socket reset')
    const rows = rowsFor(k('r-1'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.pending).toBe(true)
    expect(await a.run<unknown>('g', 'r-1', 'h1', exec, keep)).toEqual({ status: 'ran', value: UNKNOWN })
    expect(n).toBe(1)
  })

  it('keeps the row in file mode but still drops it in memory mode when no release is given', async () => {
    const fileJournal = open({ file, unknown: UNKNOWN, now: () => 1000 })
    const fc = counter(NOT_KEPT)
    await fileJournal.run<unknown>('g', 'r-f', 'h1', fc.exec, keep)
    await fileJournal.run<unknown>('g', 'r-f', 'h1', fc.exec, keep)
    expect(fc.count()).toBe(1)

    const memory = open({ unknown: UNKNOWN, now: () => 1000 })
    const mc = counter(NOT_KEPT)
    await memory.run<unknown>('g', 'r-m', 'h1', mc.exec, keep)
    expect(await memory.run<unknown>('g', 'r-m', 'h1', mc.exec, keep)).toEqual({ status: 'ran', value: NOT_KEPT })
    expect(mc.count()).toBe(2)
  })
})

describe('bridge pre-write release predicate', () => {
  it('does not release for a timeout tool error and still releases for the other pre-write codes', () => {
    const fn = isPreWriteFailure as unknown as (value: unknown, error: unknown) => boolean
    expect(fn(toolError('timeout'), undefined)).toBe(false)
    for (const code of ['unknown-widget', 'unknown-action', 'invalid-args', 'bad-request', 'busy', 'safe-mode', 'widget-failed', 'mode-off', 'idempotency-conflict', 'conflict']) {
      expect(fn(toolError(code), undefined), code).toBe(true)
    }
  })
})

describe('journal release requires a strict true', () => {
  it('keeps the row in file mode when release returns a truthy non-boolean', async () => {
    const a = open({ file, unknown: UNKNOWN, now: () => 1000 })
    const c = counter(NOT_KEPT)
    const truthy = ((): unknown => 'yes') as unknown as (v: unknown, e: unknown) => boolean
    await a.run<unknown>('g', 'r-t', 'h1', c.exec, keep, truthy)
    expect(rowsFor(k('r-t'))[0]?.pending).toBe(true)
    expect(await a.run<unknown>('g', 'r-t', 'h1', c.exec, keep, truthy)).toEqual({ status: 'ran', value: UNKNOWN })
    expect(c.count()).toBe(1)
  })

  it('keeps the row in file mode when release throws', async () => {
    const a = open({ file, unknown: UNKNOWN, now: () => 1000 })
    const c = counter(NOT_KEPT)
    const boom = (): boolean => { throw new Error('boom') }
    await a.run<unknown>('g', 'r-x', 'h1', c.exec, keep, boom)
    expect(await a.run<unknown>('g', 'r-x', 'h1', c.exec, keep, boom)).toEqual({ status: 'ran', value: UNKNOWN })
    expect(c.count()).toBe(1)
  })

  it('releases in file mode only when release returns exactly true', async () => {
    const a = open({ file, unknown: UNKNOWN, now: () => 1000 })
    const c = counter(NOT_KEPT)
    await a.run<unknown>('g', 'r-y', 'h1', c.exec, keep, () => true)
    expect(rowsFor(k('r-y'))).toHaveLength(0)
    expect(await a.run<unknown>('g', 'r-y', 'h1', c.exec, keep, () => true)).toEqual({ status: 'ran', value: NOT_KEPT })
    expect(c.count()).toBe(2)
  })
})
