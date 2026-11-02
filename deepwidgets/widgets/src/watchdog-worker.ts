/**
 * The watchdog thread (`widget_phase2.isolation.watchdog` in `docs/specs/widget-phase2.md`).
 *
 * It polls the heartbeat slot that the main thread bumps on a timer. When the heartbeat stalls for a quarter of the
 * threshold, it writes the provisional record `provisional.json`, because an out-of-memory abort runs no JavaScript
 * and leaves no other record. When the heartbeat comes back, it removes that record. When the stall reaches the
 * threshold, it writes the crash record `crash.json` and kills the host with SIGKILL.
 *
 * The stall clock is monotonic. When a poll of this thread comes far too late, the whole process did not run
 * (SIGSTOP, sleep), so the stall clock starts again instead of a kill.
 *
 * The blame order is: the running-widget slot, then the store and the stack of the stuck thread from
 * `@sentry/node-native-stacktrace`, when that module loaded on the main thread. The provisional record uses the slot
 * only, because the native read waits for the main thread.
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

/** The blame by the running-widget slot alone. It does not wait for the main thread. */
function slotBlame(): Blame {
  const slot = byIndex.get(Atomics.load(slots, RUNNING_SLOT))
  return slot === undefined ? { row: undefined, method: null, stack: '' } : { row: slot, method: 'slot', stack: '' }
}

/**
 * The blame by the store and the stack of the stuck main thread, read with the native module.
 * The module interrupts the main thread and waits for it. When the main thread is inside native code, such as a long
 * `JSON.parse`, this call waits until that code returns, for 5 s at most. So only the kill path calls it, and only
 * after the slot found no widget.
 */
function nativeBlame(): Blame {
  if (native === undefined) return { row: undefined, method: null, stack: '' }
  let stack = ''
  let store: WatchdogRowMessage | undefined
  let frameRow: WatchdogRowMessage | undefined
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

/**
 * A poll gap of this length means that this thread did not run either: the process was stopped (SIGSTOP), the
 * machine slept, or the CPU was not given to the process. Then a stall of the main thread is not proven.
 */
const SUSPEND_GAP_MS = data.thresholdMs / 2

// The stall clock is monotonic, so a step of the wall clock does not change a stall. Records keep epoch times.
let last = Atomics.load(slots, BEAT_SLOT)
let since = performance.now()
let polled = since
/** The epoch time of the provisional record of this stall, or undefined when there is none. */
let provisionalAt: number | undefined

setInterval(() => {
  const now = performance.now()
  const gap = now - polled
  polled = now
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
  if (gap >= SUSPEND_GAP_MS) {
    // The main thread gets the same time to beat as after any other start of the stall clock.
    say(`this thread did not run for ${String(Math.round(gap))} ms, so the process was stopped or asleep; the stall clock starts again`)
    since = now
    return
  }
  const stalledMs = Math.round(now - since)
  if (provisionalAt === undefined && stalledMs >= data.thresholdMs / 4) {
    // The slot only, as in the spike: a native read here would wait for the main thread.
    const found = slotBlame()
    // An unblamed provisional record would change nothing at the next start.
    if (found.row !== undefined) {
      const message = `the event loop stalled for at least ${String(stalledMs)} ms, and the host ended before it came back (for example an out-of-memory abort)`
      try {
        const at = Date.now()
        writeJsonSync(data.provisionalFile, recordOf(found, 'provisional-stall', 'ProvisionalStall', message, at))
        provisionalAt = at
      } catch (error) {
        say(`the provisional record was not written: ${String(error)}`)
      }
    }
  }
  if (stalledMs < data.thresholdMs) return
  const message = `the event loop stalled for ${String(stalledMs)} ms (threshold ${String(data.thresholdMs)} ms)`
  const write = (blame: Blame): void => {
    try {
      writeJsonSync(data.crashFile, recordOf(blame, 'stall', 'WatchdogStall', message, Date.now()))
      if (provisionalAt !== undefined) removeProvisional(provisionalAt)
    } catch (error) {
      say(`the crash record was not written: ${String(error)}`)
    }
  }
  let found = slotBlame()
  // Write the record first, so a long wait in the native read below cannot leave no record.
  write(found)
  if (found.row === undefined && native !== undefined) {
    found = nativeBlame()
    write(found)
  }
  say(`stall of ${String(stalledMs)} ms blamed on ${found.row?.row ?? 'no widget'} (${found.method ?? 'none'}); the host is killed now`)
  process.kill(process.pid, 'SIGKILL')
}, data.pollMs)
