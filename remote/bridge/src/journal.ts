/**
 * The bridge's operation journal: a `widget_call` that carries a `requestId` is run once per (grant id, requestId).
 * A retry with the same args gets the first run's answer, or waits for it while it is still running; the same
 * requestId with different args is refused. This holds the "applied once" promise at the PC even when the local
 * server's own requestId cache is lost (host restart, new local caller identity). Product direction: durable
 * operation ids retained across transport retry and credential renewal.
 *
 * Memory only by default: a bridge restart forgets it, and a retry after that may apply the write again.
 * With `file` set the journal is at-most-once across a restart. Before `exec` runs, a pending row is written
 * synchronously; when the run ends with a kept value it becomes a finished row (atomic write, fsynced, mode 0600),
 * and any other end (not kept, or a rejection) removes the row when the caller's `release` says the operation certainly
 * did not write; with no `release`, the row stays; otherwise the pending row stays and a retry gets `unknown`, in this
 * process too. If the pending row cannot be written, or the file was bad at load (corrupt or over 8 MiB: `healthy()`
 * is false), `run` fails closed: `exec` is not called and the answer is `unavailable`. After a restart a pending
 * row is an operation whose outcome is unknown: a retry with the same args hash gets `unknown` and `exec` is not
 * called; other args are a conflict. A value whose JSON is over 16 KiB is not stored; its replay after a restart
 * returns `lost`. Remaining window: a crash after the pending write and before the local call still blocks a retry
 * as unknown, which is the safe side. Capacity pruning never evicts in-flight or pending entries.
 * Rows with bad fields are skipped.
 */
import { randomBytes } from 'node:crypto'
import { closeSync, fsyncSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeSync } from 'node:fs'

export type Ran<T> = { status: 'ran'; value: T } | { status: 'conflict' } | { status: 'unavailable' }

/** Method-style on purpose: the parameter is checked bivariantly, so a keep for the concrete result type also fits `run<unknown>`. */
type Keep<T> = { bivarianceHack(value: T): boolean }['bivarianceHack']

export interface Journal {
  /** Run `exec` unless this (gid, requestId) already ran with the same args hash `ah`. */
  run<T>(gid: string, requestId: string, ah: string, exec: () => Promise<T>, keep: Keep<T>, release?: Release<T>): Promise<Ran<T>>
  size(): number
  /** False when the file exists but could not be loaded (corrupt, unreadable or over 8 MiB); file-mode runs then answer `unavailable`. */
  healthy(): boolean
}

/** File mode, for a run that was not kept: true = it certainly did not write (drop the row); false = keep the pending row. */
type Release<T> = { bivarianceHack(value: T | undefined, error: unknown): boolean }['bivarianceHack']

/** `json` is the value as JSON text; undefined when it is too big to keep (or not JSON), and a replay then gives `lost`. */
interface Entry { ah: string; promise: Promise<unknown>; at: number; finished: boolean; json?: string }

const MAX_VALUE_JSON_BYTES = 16 * 1024
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_FIELD_CHARS = 512

export interface JournalOptions {
  ttlMs?: number
  max?: number
  now?: () => number
  /** Opt-in file that keeps finished runs across a restart. */
  file?: string
  /** What a replay returns for a finished run whose value was not kept in the file. */
  lost?: unknown
  /** What a retry returns for a row that was pending when the bridge stopped (its outcome is unknown). */
  unknown?: unknown
}

export function createJournal(opts: JournalOptions = {}): Journal {
  const ttlMs = opts.ttlMs ?? 3_600_000
  const max = opts.max ?? 500
  const now = opts.now ?? Date.now
  const file = opts.file
  const entries = new Map<string, Entry>()
  const prune = (capacity = true): void => {
    const cutoff = now() - ttlMs
    for (const [key, entry] of entries) if (entry.at < cutoff) entries.delete(key)
    if (!capacity) return
    // Capacity pruning drops only the oldest finished entries; in-flight and pending ones stay, even past max.
    for (const [key, entry] of entries) {
      if (entries.size <= max) break
      if (entry.finished) entries.delete(key)
    }
  }
  let healthy = true
  /** True when the rows are on disk (or there is no file). */
  const persist = (): boolean => {
    if (file === undefined) return true
    try {
      const rows: unknown[] = []
      for (const [key, e] of entries) {
        if (!e.finished) rows.push({ key, ah: e.ah, at: e.at, pending: true })
        else rows.push(e.json === undefined ? { key, ah: e.ah, at: e.at } : { key, ah: e.ah, at: e.at, value: JSON.parse(e.json) as unknown })
      }
      const tmp = `${file}.${String(process.pid)}.${randomBytes(6).toString('hex')}.tmp`
      const fd = openSync(tmp, 'wx', 0o600)
      try {
        writeSync(fd, JSON.stringify({ v: 1, entries: rows }))
        fsyncSync(fd)
        closeSync(fd)
        renameSync(tmp, file)
        return true
      } catch (error) {
        try { closeSync(fd) } catch { /* already closed */ }
        try { unlinkSync(tmp) } catch { /* best effort */ }
        throw error
      }
    } catch { return false /* a failed write must not reach the caller; `run` fails closed on it */ }
  }
  if (file !== undefined) {
    try {
      if (statSync(file).size > MAX_FILE_BYTES) throw new Error('journal file too large')
      const parsed = JSON.parse(readFileSync(file, 'utf8')) as { entries?: unknown } | null
      if (!Array.isArray(parsed?.entries)) throw new Error('journal file has no entries list')
      const rows = parsed.entries as unknown[]
      const cutoff = now() - ttlMs
      for (const row of rows) {
        const r = (row ?? {}) as { key?: unknown; ah?: unknown; at?: unknown; value?: unknown; pending?: unknown }
        if (typeof r.key !== 'string' || r.key.length > MAX_FIELD_CHARS || typeof r.ah !== 'string' || r.ah.length > MAX_FIELD_CHARS) continue
        if (typeof r.at !== 'number' || !Number.isFinite(r.at) || r.at < cutoff) continue
        if (r.pending === true) {
          // Outcome unknown: a retry with the same args gets `unknown`; it never runs exec.
          entries.set(r.key, { ah: r.ah, at: r.at, finished: false, promise: Promise.resolve(opts.unknown) })
          continue
        }
        const json = 'value' in r ? JSON.stringify(r.value) : undefined
        entries.set(r.key, { ah: r.ah, at: r.at, finished: true, json, promise: Promise.resolve(json === undefined ? opts.lost : r.value) })
      }
      prune()
    } catch (error) {
      entries.clear()
      // A missing file is an empty journal; one that exists but cannot be used fails closed.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') healthy = false
    }
  }
  return {
    async run<T>(gid: string, requestId: string, ah: string, exec: () => Promise<T>, keep: Keep<T>, release?: Release<T>): Promise<Ran<T>> {
      if (file !== undefined && !healthy) return { status: 'unavailable' }
      prune(false) // ttl only: capacity pruning waits until an entry is added, so a finished answer is still replayable
      const key = `${gid}\u0000${requestId}`
      const existing = entries.get(key)
      if (existing !== undefined) {
        if (existing.ah !== ah) return { status: 'conflict' }
        return { status: 'ran', value: (await existing.promise) as T }
      }
      // Reserve before dispatch: in file mode the pending row is on disk before exec runs.
      const entry: Entry = { ah, promise: Promise.resolve(undefined), at: now(), finished: false }
      entries.set(key, entry)
      prune()
      if (!persist()) {
        entries.delete(key)
        return { status: 'unavailable' }
      }
      let promise: Promise<T>
      try { promise = exec() } catch (error) { promise = Promise.reject(error as Error) }
      entry.promise = promise
      const drop = (): void => { if (entries.get(key) === entry) { entries.delete(key); persist() } }
      // Not kept: in file mode the caller says whether the operation certainly did not write. If not, the pending row stays
      // and a retry gets `unknown`, like after a restart. Memory only: drop, so a retry can run again. File mode with no callback: keep (unknown).
      const ended = (value: T | undefined, error: unknown): void => {
        // File mode releases only on an affirmative "certainly did not write"; memory mode drops as before.
        let certain = file === undefined
        if (file !== undefined && release !== undefined) {
          try { certain = release(value, error) === true } catch { certain = false }
        }
        if (certain) return drop()
        if (entries.get(key) === entry) entry.promise = Promise.resolve(opts.unknown)
      }
      promise.then((value) => {
        if (!keep(value)) return ended(value, undefined)
        if (entries.get(key) !== entry) return
        entry.finished = true
        const json = JSON.stringify(value) as string | undefined
        if (json !== undefined && Buffer.byteLength(json) <= MAX_VALUE_JSON_BYTES) entry.json = json
        persist()
      }, (error: unknown) => { ended(undefined, error) })
      return { status: 'ran', value: await promise }
    },
    size: () => entries.size,
    healthy: () => healthy,
  }
}
