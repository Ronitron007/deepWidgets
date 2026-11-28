import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { filterByWid, LOCAL_TIMEOUT_MS, parseHello, PING_INTERVAL_MS, remoteLifetimeMs, withTimeout } from './bridge/src/remote.ts'

type Shaped = { content: { type: string; text: string }[]; structuredContent: Record<string, unknown> }

function listResult(slugs: string[]): Record<string, unknown> {
  const body = { widgets: slugs.map((slug) => ({ slug, title: slug, rev: 1, programRev: 1 })) }
  return { content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body }
}
function changesResult(): Record<string, unknown> {
  const body = { cursor: '3', changes: [{ seq: 1, slug: 'groceries', rev: 2, by: 'remote-a' }, { seq: 2, slug: 'notes', rev: 5, by: 'local' }] }
  return { content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body }
}
const slugsOf = (items: unknown): string[] => (items as { slug: string }[]).map((item) => item.slug)
const textOf = (r: Shaped): Record<string, unknown> => JSON.parse(r.content[0]?.text ?? '{}') as Record<string, unknown>

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('bridge remote deltas', () => {
  it('filterByWid keeps only signed widgets in a widget_list result', () => {
    const out = filterByWid('widget_list', listResult(['groceries', 'notes']), ['groceries']) as unknown as Shaped
    expect(slugsOf(out.structuredContent.widgets)).toEqual(['groceries'])
    expect(slugsOf(textOf(out).widgets)).toEqual(['groceries'])
  })

  it('filterByWid keeps only signed widgets in a widget_changes result', () => {
    const out = filterByWid('widget_changes', changesResult(), ['groceries']) as unknown as Shaped
    expect(slugsOf(out.structuredContent.changes)).toEqual(['groceries'])
    expect(out.structuredContent.cursor).toBe('3')
    expect(slugsOf(textOf(out).changes)).toEqual(['groceries'])
  })

  it('filterByWid with wid * returns the result unchanged', () => {
    const input = listResult(['groceries', 'notes'])
    expect(filterByWid('widget_list', input, ['*'])).toEqual(listResult(['groceries', 'notes']))
  })

  it('filterByWid leaves widget_call results unchanged', () => {
    const input = { content: [{ type: 'text', text: JSON.stringify({ ok: true, rev: 3 }) }], structuredContent: { ok: true, rev: 3 } }
    expect(filterByWid('widget_call', input, ['groceries'])).toEqual({ content: [{ type: 'text', text: JSON.stringify({ ok: true, rev: 3 }) }], structuredContent: { ok: true, rev: 3 } })
  })

  it('parseHello takes the device id and ignores serverTime', () => {
    expect(parseHello({ type: 'hello', deviceId: 'dev_x', serverTime: 123 })).toEqual({ deviceId: 'dev_x' })
    expect(parseHello({ type: 'hello', deviceId: 'dev_x' })).toEqual({ deviceId: 'dev_x' })
  })

  it('parseHello refuses a frame without a device id', () => {
    expect(parseHello({ type: 'hello' })).toBeNull()
    expect(parseHello({ type: 'hello', deviceId: '' })).toBeNull()
    expect(parseHello({ type: 'call', deviceId: 'dev_x' })).toBeNull()
  })

  it('remoteLifetimeMs defaults to 8 hours and reads DW_REMOTE_HOURS', () => {
    expect(remoteLifetimeMs({})).toBe(8 * 3_600_000)
    expect(remoteLifetimeMs({ DW_REMOTE_HOURS: '2' })).toBe(7_200_000)
    expect(remoteLifetimeMs({ DW_REMOTE_HOURS: '0.5' })).toBe(1_800_000)
  })

  it('remoteLifetimeMs refuses a non-positive or non-numeric DW_REMOTE_HOURS', () => {
    expect(() => remoteLifetimeMs({ DW_REMOTE_HOURS: 'abc' })).toThrow()
    expect(() => remoteLifetimeMs({ DW_REMOTE_HOURS: '0' })).toThrow()
    expect(() => remoteLifetimeMs({ DW_REMOTE_HOURS: '-1' })).toThrow()
  })

  it('the bridge pings every 20 seconds and waits 10 seconds for the local server', () => {
    expect(PING_INTERVAL_MS).toBe(20_000)
    expect(LOCAL_TIMEOUT_MS).toBe(10_000)
  })

  it('withTimeout resolves timeout after LOCAL_TIMEOUT_MS when the local call hangs', async () => {
    let settled: unknown
    void withTimeout(new Promise<number>(() => {}), LOCAL_TIMEOUT_MS).then((value) => { settled = value })
    await vi.advanceTimersByTimeAsync(9_999)
    expect(settled).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    expect(settled).toBe('timeout')
  })

  it('withTimeout passes through a value that arrives in time', async () => {
    const p = withTimeout(Promise.resolve(42), LOCAL_TIMEOUT_MS)
    await vi.advanceTimersByTimeAsync(0)
    expect(await p).toBe(42)
  })
})
