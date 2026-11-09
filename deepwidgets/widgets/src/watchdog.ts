/**
 * The main-thread half of the watchdog (`widget_phase2.isolation.watchdog` in `docs/specs/widget-phase2.md`, with the
 * rules of `safe_host.watchdog` in `docs/specs/safe-host.md`).
 *
 * A worker thread (`watchdog-worker.ts`) shares a SharedArrayBuffer with the main thread. The main thread bumps the
 * heartbeat slot on a timer. The runtime writes the slot index of a widget row into the running-widget slot before
 * it calls widget code, and puts the old value back after. A stall of 2 s with a widget in that slot kills the host
 * and blames the widget. A stall of 10 s with no widget in it kills the host and blames no widget: healthy host work
 * on a busy machine took up to 5 s (`safe_host.watchdog`).
 *
 * widget_fv.crash: the provisional record of the watchdog thread names a widget call. When that call returns, the
 * main thread removes the record at once, so a later abort in host code does not blame the widget.
 *
 * `@sentry/node-native-stacktrace` is optional (safe_host.watchdog). When it loads, a stall with no widget in the slot
 * that reaches 2 s makes the watchdog thread read the innermost frame of the stuck main thread. A frame in the files of
 * a widget row makes the stall a widget stall, blamed with `native-stack`. The blame store alone never blames. When the
 * module does not load, for example under Electron with no build for Electron, a stall with slot 0 waits for 10 s.
 *
 * safe_host.cleanup: the claimer tells the watchdog thread that the dispose at a crash started (`crashing`). The
 * watchdog thread then kills the host when the dispose takes more than 3 s, also when a disposer blocks the main
 * thread in a synchronous loop.
 * @module @deepwidgets/widgets/watchdog
 */
import type { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { threadId, Worker } from 'node:worker_threads'
import type { Context } from '@deepseek-ai/cordis'
import {
  BEAT_SLOT, CALLS_SLOT, CRASH_SLOT, PROVISIONAL_SLOT, RUNNING_SLOT, SLOT_COUNT,
  type CrashRecord, type WatchdogData, type WatchdogRowMessage,
} from './records.ts'

/** safe_host.watchdog: a heartbeat stall of this length with a widget in the running slot kills the host. */
export const WATCHDOG_THRESHOLD_MS = 2_000
/** safe_host.watchdog: a heartbeat stall of this length with no widget in the running slot kills the host. */
export const IDLE_THRESHOLD_MS = 10_000
/** safe_host.watchdog: a poll gap of this length of the watchdog thread means a suspend. */
export const SUSPEND_GAP_MS = 1_000
/** safe_host.cleanup: the time limit of the plugin dispose at a crash. */
export const CRASH_DISPOSE_LIMIT_MS = 3_000
/** safe_host.hmr: the time limit of each disposer of a widget or agent row. */
export const DISPOSER_LIMIT_MS = 5_000
/** The heartbeat period. */
const BEAT_MS = Math.max(20, Math.min(100, Math.floor(WATCHDOG_THRESHOLD_MS / 5)))
/** The poll period of the watchdog thread. */
const POLL_MS = Math.max(10, Math.floor(BEAT_MS / 2))
const NATIVE_PACKAGE = '@sentry/node-native-stacktrace'
/** A test hook of `tools/widgets-watchdog.mjs` (the case `native-slow`): extra milliseconds for each native stack read. */
const TEST_READ_DELAY_ENV = 'DEEPWIDGETS_WATCHDOG_TEST_READ_DELAY_MS'

/** The slots of the running watchdog, and the slot index of a widget row. */
interface Active {
  readonly slots: Int32Array
  readonly provisionalFile: string
  index(row: string): number
}
let active: Active | undefined

/** Remove the provisional record of this process, when no host start applied it. */
function removeOwnProvisional(file: string): void {
  try {
    const record = JSON.parse(readFileSync(file, 'utf8')) as Partial<CrashRecord>
    if (record.pid === process.pid && record.applied !== true) unlinkSync(file)
  } catch { /* no record */ }
}

/**
 * Run `fn` with `row` in the running-widget slot. With no watchdog, run it as is.
 * widget_fv.crash: when the call returns, a provisional record of it goes at once.
 */
export function inSlot<T>(row: string, fn: () => T): T {
  const watch = active
  if (watch === undefined) return fn()
  const previous = Atomics.exchange(watch.slots, RUNNING_SLOT, watch.index(row))
  try {
    return fn()
  } finally {
    Atomics.store(watch.slots, RUNNING_SLOT, previous)
    // The order matters: the watchdog thread reads the calls count before the slot, and again after it wrote a
    // record. So either this exchange sees its flag, or the watchdog thread sees the new count and removes the record.
    Atomics.add(watch.slots, CALLS_SLOT, 1)
    if (Atomics.exchange(watch.slots, PROVISIONAL_SLOT, 0) !== 0) removeOwnProvisional(watch.provisionalFile)
  }
}

/**
 * safe_host.hmr: put `row` in the running-widget slot until the returned function runs, also across awaits. The
 * agent-row gate loads one agent row at a time with it, so a loop in the top-level code of the row is blamed on it.
 * Host work that runs during the load also runs with the row in the slot.
 * @returns the function that puts the old value back. With no watchdog, it does nothing.
 */
export function enterSlot(row: string): () => void {
  const watch = active
  if (watch === undefined) return () => {}
  const previous = Atomics.exchange(watch.slots, RUNNING_SLOT, watch.index(row))
  let done = false
  return () => {
    if (done) return
    done = true
    Atomics.store(watch.slots, RUNNING_SLOT, previous)
    Atomics.add(watch.slots, CALLS_SLOT, 1)
    if (Atomics.exchange(watch.slots, PROVISIONAL_SLOT, 0) !== 0) removeOwnProvisional(watch.provisionalFile)
  }
}

/** The part of `@sentry/node-native-stacktrace` that the main thread uses. */
interface NativeRegister {
  registerThread(storage: { asyncLocalStorage: AsyncLocalStorage<unknown> }, threadName: string): void
}

/**
 * Load the native module and register the main thread with `store`. The store goes into the text of a record only.
 * @returns the resolved entry of the module, or null when it does not load.
 */
function loadNative(ctx: Context, store: AsyncLocalStorage<string>): string | null {
  const require = createRequire(import.meta.url)
  try {
    // Under Electron the module loads only its own build in build/Release, and it writes a warning to stderr when
    // that build is missing. That warning would end up in each Host failure message, so check the build first.
    const folder = dirname(require.resolve(`${NATIVE_PACKAGE}/package.json`))
    if (process.versions.electron !== undefined && !existsSync(join(folder, 'build', 'Release', 'stack-trace.node'))) {
      throw new Error('it has no build for Electron (build it with @electron/rebuild)')
    }
    const entry = require.resolve(NATIVE_PACKAGE)
    const native = require(entry) as NativeRegister
    native.registerThread({ asyncLocalStorage: store }, String(threadId))
    return entry
  } catch (error) {
    ctx.logger.info(`widgets: watchdog: ${NATIVE_PACKAGE} did not load, so a stall with no widget in the slot waits ${String(IDLE_THRESHOLD_MS)} ms: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
    return null
  }
}

/** What the watchdog needs from the isolation. */
export interface WatchdogFiles {
  crashFile: string
  provisionalFile: string
}

/** The watchdog of one runtime instance. */
export interface Watchdog {
  /** Tell the watchdog thread the package folder and the slugs of a widget row. */
  track(row: string, root: string | undefined, slugs: string[]): void
  /**
   * safe_host.cleanup: the claimer wrote its crash record, and the dispose starts. The watchdog thread stops its
   * stall checks, so no stall record replaces the crash record, and it kills the host after {@link CRASH_DISPOSE_LIMIT_MS}.
   */
  crashing(): void
}

/**
 * Start the watchdog thread and the heartbeat. The effect belongs to `ctx`, so the runtime row stops both.
 * @param store - the blame store; the native module reads it from the stuck thread for the text of a record.
 */
export function startWatchdog(ctx: Context, store: AsyncLocalStorage<string>, files: WatchdogFiles): Watchdog {
  const slots = new Int32Array(new SharedArrayBuffer(SLOT_COUNT * Int32Array.BYTES_PER_ELEMENT))
  const rows = new Map<string, WatchdogRowMessage>()
  const data: WatchdogData = {
    buffer: slots.buffer,
    thresholdMs: WATCHDOG_THRESHOLD_MS,
    idleThresholdMs: IDLE_THRESHOLD_MS,
    suspendGapMs: SUSPEND_GAP_MS,
    disposeLimitMs: CRASH_DISPOSE_LIMIT_MS,
    pollMs: POLL_MS,
    crashFile: files.crashFile,
    provisionalFile: files.provisionalFile,
    nativeEntry: loadNative(ctx, store),
    mainThread: String(threadId),
    testReadDelayMs: Math.max(0, Number(process.env[TEST_READ_DELAY_ENV] ?? 0) || 0),
  }
  // The bundle puts the worker beside lib/index.js. A plain path, so the bundler does not treat it as an asset.
  const worker = new Worker(join(dirname(fileURLToPath(import.meta.url)), 'watchdog-worker.js'), { workerData: data })
  worker.unref()
  worker.on('error', (error) => { ctx.logger.error('widgets: watchdog: the watchdog thread failed', error) })

  function rowOf(row: string): WatchdogRowMessage {
    let item = rows.get(row)
    if (item === undefined) {
      // Index 0 means no widget.
      item = { type: 'row', index: rows.size + 1, row, root: null, slugs: [] }
      rows.set(row, item)
      worker.postMessage(item)
    }
    return item
  }
  const watch: Active = { slots, provisionalFile: files.provisionalFile, index: (row) => rowOf(row).index }
  const crashed = (): boolean => Atomics.load(slots, CRASH_SLOT) !== 0

  ctx.effect(() => {
    active = watch
    const beat = setInterval(() => { Atomics.add(slots, BEAT_SLOT, 1) }, BEAT_MS)
    beat.unref()
    return () => {
      clearInterval(beat)
      if (active === watch) active = undefined
      // safe_host.cleanup: during the dispose at a crash, the watchdog thread keeps the deadline. The exit ends it.
      if (!crashed()) void worker.terminate()
      // The heartbeat runs again here, so a provisional record of this host is stale.
      Atomics.store(slots, PROVISIONAL_SLOT, 0)
      removeOwnProvisional(files.provisionalFile)
    }
  }, 'widgets: the watchdog')
  ctx.logger.info(`widgets: watchdog: threshold ${String(WATCHDOG_THRESHOLD_MS)} ms with a widget, ${String(IDLE_THRESHOLD_MS)} ms with none, beat ${String(BEAT_MS)} ms, native ${data.nativeEntry === null ? 'off' : 'on'}`)

  return {
    track(row, root, slugs) {
      const item = rowOf(row)
      item.root ??= root ?? null
      item.slugs = slugs
      worker.postMessage(item)
    },
    crashing() {
      Atomics.store(slots, CRASH_SLOT, 1)
    },
  }
}
