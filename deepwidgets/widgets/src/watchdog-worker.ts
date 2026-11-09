/**
 * The watchdog thread (`widget_phase2.isolation.watchdog` in `docs/specs/widget-phase2.md`, with the rules of
 * `safe_host.watchdog` and `safe_host.cleanup` in `docs/specs/safe-host.md`).
 *
 * It polls the heartbeat slot that the main thread bumps on a timer. The stall limit depends on the running-widget
 * slot: 2 s while a widget call holds the slot, and 10 s while the slot holds 0. When the stall reaches its limit, the
 * thread writes the crash record `crash.json` and kills the host with SIGKILL. A widget stall blames the widget in the
 * slot. A stall with the slot at 0 blames no widget.
 *
 * At a quarter of 2 s of a widget stall, it writes the provisional record `provisional.json`, because an
 * out-of-memory abort runs no JavaScript and leaves no other record. The record names the widget call in the slot.
 * It goes when that call returns (`inSlot` in `watchdog.ts`, widget_fv.crash), or when the heartbeat comes back.
 *
 * The stall clock is monotonic. When a poll of this thread comes 1 s or more too late, the whole process did not run
 * (SIGSTOP, sleep), so the stall clock starts again instead of a kill.
 *
 * safe_host.cleanup: after the claimer set the crash slot, the main thread disposes the plugin tree. This thread then
 * checks no stall, so the crash record of the claimer stays. When the dispose takes 3 s, it kills the host.
 * Ported from the spike `crash_only` (deepwidgets/widgets/watchdog-worker.cjs at a7c6a12d).
 * @module @deepwidgets/widgets/watchdog-worker
 */
import { readFileSync, unlinkSync, writeSync } from 'node:fs'
import { parentPort, workerData } from 'node:worker_threads'
import {
  BEAT_SLOT, CALLS_SLOT, CRASH_SLOT, PROVISIONAL_SLOT, RUNNING_SLOT, packageHash, writeJsonSync,
  type BlameMethod, type CrashRecord, type WatchdogData, type WatchdogRowMessage,
} from './records.ts'

const data = workerData as WatchdogData
const slots = new Int32Array(data.buffer)
/** The widget rows by slot index. */
const byIndex = new Map<number, WatchdogRowMessage>()
parentPort?.on('message', (message: WatchdogRowMessage) => {
  byIndex.set(message.index, message)
})

const say = (line: string): void => {
  // The main thread is stuck, so process.stderr (which it relays) would not flush. Write to fd 2 directly.
  try { writeSync(2, `deepwidgets: watchdog: ${line}\n`) } catch { /* no stderr */ }
}

interface Blame { row: WatchdogRowMessage | undefined, method: BlameMethod | null }

/** The blame by the running-widget slot index `slot`. */
function slotBlame(slot: number): Blame {
  const row = byIndex.get(slot)
  return row === undefined ? { row: undefined, method: null } : { row, method: 'slot' }
}

function recordOf(found: Blame, event: CrashRecord['event'], name: string, message: string, at: number): CrashRecord {
  const root = found.row?.root ?? null
  return {
    row: found.row?.row ?? null,
    slugs: found.row?.slugs ?? [],
    error: { name, message, stack: '' },
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

// The stall clock is monotonic, so a step of the wall clock does not change a stall. Records keep epoch times.
let last = Atomics.load(slots, BEAT_SLOT)
let since = performance.now()
let polled = since
/** The slot value and the calls count of the last poll, and since when the slot holds that same call. */
let slotSeen = Atomics.load(slots, RUNNING_SLOT)
let callsSeen = Atomics.load(slots, CALLS_SLOT)
let callSince = since
/** The epoch time of the provisional record of this stall, or undefined when there is none. */
let provisionalAt: number | undefined
/** When this thread saw the crash slot, or undefined before the crash. */
let crashSince: number | undefined

/** Write the provisional record of the call in `slot`. `calls` is the calls count that was read before the slot. */
function writeProvisional(slot: number, calls: number, stalledMs: number): void {
  const found = slotBlame(slot)
  // An unblamed provisional record would change nothing at the next start.
  if (found.row === undefined) return
  const message = `the event loop stalled for at least ${String(stalledMs)} ms, and the host ended before it came back (for example an out-of-memory abort)`
  try {
    const at = Date.now()
    writeJsonSync(data.provisionalFile, recordOf(found, 'provisional-stall', 'ProvisionalStall', message, at))
    Atomics.store(slots, PROVISIONAL_SLOT, 1)
    provisionalAt = at
    // widget_fv.crash: the call returned while this thread wrote. The main thread did not see the flag, so remove it here.
    if (Atomics.load(slots, CALLS_SLOT) !== calls && Atomics.exchange(slots, PROVISIONAL_SLOT, 0) !== 0) {
      removeProvisional(at)
      provisionalAt = undefined
    }
  } catch (error) {
    say(`the provisional record was not written: ${String(error)}`)
  }
}

setInterval(() => {
  const now = performance.now()
  const gap = now - polled
  polled = now
  if (Atomics.load(slots, CRASH_SLOT) !== 0) {
    // safe_host.cleanup: a suspend gives the dispose its time again, as it gives a stall.
    if (crashSince === undefined || gap >= data.suspendGapMs) crashSince = now
    if (now - crashSince < data.disposeLimitMs) return
    say(`the dispose after the crash took ${String(data.disposeLimitMs)} ms; the host is killed now`)
    process.kill(process.pid, 'SIGKILL')
    return
  }
  // The main thread removed the provisional record when its call returned.
  if (provisionalAt !== undefined && Atomics.load(slots, PROVISIONAL_SLOT) === 0) provisionalAt = undefined
  const beat = Atomics.load(slots, BEAT_SLOT)
  if (beat !== last) {
    last = beat
    since = now
    if (provisionalAt !== undefined) {
      Atomics.store(slots, PROVISIONAL_SLOT, 0)
      removeProvisional(provisionalAt)
      provisionalAt = undefined
    }
    return
  }
  if (gap >= data.suspendGapMs) {
    // The main thread gets the same time to beat as after any other start of the stall clock.
    say(`this thread did not run for ${String(Math.round(gap))} ms, so the process was stopped or asleep; the stall clock starts again`)
    since = now
    return
  }
  // Read the count before the slot: see inSlot in watchdog.ts.
  const calls = Atomics.load(slots, CALLS_SLOT)
  const slot = Atomics.load(slots, RUNNING_SLOT)
  if (slot !== slotSeen || calls !== callsSeen) {
    slotSeen = slot
    callsSeen = calls
    callSince = now
  }
  const stalledMs = Math.round(now - since)
  // The time of the stall that the call in the slot holds. Host code that stalled before the call is not its time.
  const widgetMs = slot === 0 ? 0 : Math.round(now - Math.max(since, callSince))
  if (provisionalAt === undefined && slot !== 0 && widgetMs >= data.thresholdMs / 4) writeProvisional(slot, calls, widgetMs)
  const widgetStall = slot !== 0 && widgetMs >= data.thresholdMs
  if (!widgetStall && stalledMs < data.idleThresholdMs) return
  const found = widgetStall ? slotBlame(slot) : { row: undefined, method: null }
  const message = widgetStall
    ? `the event loop stalled for ${String(widgetMs)} ms in a widget call (threshold ${String(data.thresholdMs)} ms)`
    : `the event loop stalled for ${String(stalledMs)} ms with no widget call (threshold ${String(data.idleThresholdMs)} ms)`
  try {
    writeJsonSync(data.crashFile, recordOf(found, 'stall', 'WatchdogStall', message, Date.now()))
    if (provisionalAt !== undefined) removeProvisional(provisionalAt)
  } catch (error) {
    say(`the crash record was not written: ${String(error)}`)
  }
  say(`stall of ${String(widgetStall ? widgetMs : stalledMs)} ms blamed on ${found.row?.row ?? 'no widget'} (${found.method ?? 'none'}); the host is killed now`)
  process.kill(process.pid, 'SIGKILL')
}, data.pollMs)
