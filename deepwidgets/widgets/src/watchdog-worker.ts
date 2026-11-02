/**
 * The watchdog thread (`widget_phase2.isolation.watchdog` in `docs/specs/widget-phase2.md`).
 *
 * It polls the heartbeat slot that the main thread bumps on a timer. When the heartbeat stalls for a quarter of the
 * threshold, it writes the provisional record `provisional.json`, because an out-of-memory abort runs no JavaScript
 * and leaves no other record. When the heartbeat comes back, it removes that record. When the stall reaches the
 * threshold, it writes the crash record `crash.json` and kills the host with SIGKILL.
 *
 * The blame order is: the running-widget slot, then the store and the stack of the stuck thread from
 * `@sentry/node-native-stacktrace`, when that module loaded on the main thread.
 * Ported from the spike `crash_only` (deepwidgets/widgets/watchdog-worker.cjs at a7c6a12d).
 * @module @deepwidgets/widgets/watchdog-worker
 */
import { readFileSync, unlinkSync, writeSync } from 'node:fs'
import { createRequire } from 'node:module'
import { sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parentPort, workerData } from 'node:worker_threads'
import {
  BEAT_SLOT, RUNNING_SLOT, packageHash, writeJsonSync,
  type BlameMethod, type CrashRecord, type WatchdogData, type WatchdogRowMessage,
} from './records.ts'

/** The part of `@sentry/node-native-stacktrace` that this thread uses. */
interface NativeStacks {
  captureStackTrace(): Record<string, { frames?: { function: string, filename: string, lineno: number, colno: number }[], asyncState?: unknown } | undefined>
}

const data = workerData as WatchdogData
const slots = new Int32Array(data.buffer)
/** The widget rows by slot index, and by row id. */
const byIndex = new Map<number, WatchdogRowMessage>()
const byRow = new Map<string, WatchdogRowMessage>()
parentPort?.on('message', (message: WatchdogRowMessage) => {
  byIndex.set(message.index, message)
  byRow.set(message.row, message)
})

const native = ((): NativeStacks | undefined => {
  if (data.nativeEntry === null) return undefined
  try {
    return createRequire(import.meta.url)(data.nativeEntry) as NativeStacks
  } catch {
    return undefined
  }
})()

const say = (line: string): void => {
  // The main thread is stuck, so process.stderr (which it relays) would not flush. Write to fd 2 directly.
  try { writeSync(2, `deepwidgets: watchdog: ${line}\n`) } catch { /* no stderr */ }
}

interface Blame { row: WatchdogRowMessage | undefined, method: BlameMethod | null, stack: string }

/** The file path of a native stack frame. */
function frameFile(name: string): string {
  try {
    return name.startsWith('file:') ? fileURLToPath(name) : name
  } catch {
    return name
  }
}

/** Find the widget whose code holds the main thread. */
function blame(): Blame {
  const slot = byIndex.get(Atomics.load(slots, RUNNING_SLOT))
  let stack = ''
  let store: WatchdogRowMessage | undefined
  let frameRow: WatchdogRowMessage | undefined
  if (native !== undefined) {
    try {
      const main = native.captureStackTrace()[data.mainThread]
      const frames = main?.frames ?? []
      stack = frames.slice(0, 20).map((frame) => `    at ${frame.function || '<anonymous>'} (${frame.filename}:${String(frame.lineno)}:${String(frame.colno)})`).join('\n')
      // The module gives the store as JSON text on Node 24 (Electron 44), and no store on Node 22.
      let state = main?.asyncState
      if (typeof state === 'string') {
        try { state = JSON.parse(state) as unknown } catch { /* keep the text */ }
      }
      if (typeof state === 'string') store = byRow.get(state)
      for (const frame of frames) {
        const file = frameFile(frame.filename)
        frameRow = [...byRow.values()].find((row) => row.root !== null && file.startsWith(row.root + sep))
        if (frameRow !== undefined) break
      }
    } catch (error) {
      stack = `the native stack capture failed: ${String(error)}`
    }
  }
  if (slot !== undefined) return { row: slot, method: 'slot', stack }
  if (store !== undefined) return { row: store, method: 'native-store', stack }
  if (frameRow !== undefined) return { row: frameRow, method: 'native-stack', stack }
  return { row: undefined, method: null, stack }
}

function recordOf(found: Blame, event: CrashRecord['event'], name: string, message: string, at: number): CrashRecord {
  const root = found.row?.root ?? null
  return {
    row: found.row?.row ?? null,
    slugs: found.row?.slugs ?? [],
    error: { name, message, stack: found.stack },
    at,
    event,
    method: found.method,
    root,
    hash: root === null ? null : packageHash(root),
    pid: process.pid,
    applied: false,
  }
}

/** Remove the provisional record, when it is still the one that this thread wrote. */
function removeProvisional(at: number): void {
  try {
    const current = JSON.parse(readFileSync(data.provisionalFile, 'utf8')) as Partial<CrashRecord>
    if (current.pid === process.pid && current.at === at && current.applied !== true) unlinkSync(data.provisionalFile)
  } catch { /* no record */ }
}

let last = Atomics.load(slots, BEAT_SLOT)
let since = Date.now()
/** The time of the provisional record of this stall, or undefined when there is none. */
let provisionalAt: number | undefined

setInterval(() => {
  const now = Date.now()
  const beat = Atomics.load(slots, BEAT_SLOT)
  if (beat !== last) {
    last = beat
    since = now
    if (provisionalAt !== undefined) {
      removeProvisional(provisionalAt)
      provisionalAt = undefined
    }
    return
  }
  const stalledMs = now - since
  if (provisionalAt === undefined && stalledMs >= data.thresholdMs / 4) {
    const found = blame()
    // An unblamed provisional record would change nothing at the next start.
    if (found.row !== undefined) {
      const message = `the event loop stalled for at least ${String(stalledMs)} ms, and the host ended before it came back (for example an out-of-memory abort)`
      try {
        writeJsonSync(data.provisionalFile, recordOf(found, 'provisional-stall', 'ProvisionalStall', message, now))
        provisionalAt = now
      } catch (error) {
        say(`the provisional record was not written: ${String(error)}`)
      }
    }
  }
  if (stalledMs < data.thresholdMs) return
  const found = blame()
  try {
    writeJsonSync(data.crashFile, recordOf(found, 'stall', 'WatchdogStall', `the event loop stalled for ${String(stalledMs)} ms (threshold ${String(data.thresholdMs)} ms)`, now))
    if (provisionalAt !== undefined) removeProvisional(provisionalAt)
  } catch (error) {
    say(`the crash record was not written: ${String(error)}`)
  }
  say(`stall of ${String(stalledMs)} ms blamed on ${found.row?.row ?? 'no widget'} (${found.method ?? 'none'}); the host is killed now`)
  process.kill(process.pid, 'SIGKILL')
}, data.pollMs)
