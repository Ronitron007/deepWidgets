/**
 * The main-thread half of the watchdog (`widget_phase2.isolation.watchdog` in `docs/specs/widget-phase2.md`).
 *
 * A worker thread (`watchdog-worker.ts`) shares a SharedArrayBuffer with the main thread. The main thread bumps the
 * heartbeat slot on a timer. The runtime writes the slot index of a widget row into the running-widget slot before
 * it calls widget code, and puts the old value back after. A single synchronous step of healthy host code, such as
 * the parse of a 150 MB JSON text (about 0.6 to 0.8 s), blocks the timer too. The threshold of 2 s is what keeps
 * such a step alive (`notes.watchdog` of the spike `crash_only`).
 *
 * `@sentry/node-native-stacktrace` is optional. When it loads, the watchdog thread reads the stack and the store of
 * the stuck main thread with it. When it does not load, for example under Electron with no build for Electron, the
 * watchdog blames by the slot only. Then a loop in a raw timer or after an `await` is not blamed.
 * @module @deepwidgets/widgets/watchdog
 */
import type { AsyncLocalStorage } from 'node:async_hooks'
import { existsSync, readFileSync, unlinkSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { threadId, Worker } from 'node:worker_threads'
import type { Context } from '@deepseek-ai/cordis'
import { BEAT_SLOT, RUNNING_SLOT, SLOT_COUNT, type CrashRecord, type WatchdogData, type WatchdogRowMessage } from './records.ts'

/** A heartbeat stall of this length kills the host (`widget_phase2.isolation.watchdog`). */
export const WATCHDOG_THRESHOLD_MS = 2_000
/** The heartbeat period. */
const BEAT_MS = Math.max(20, Math.min(100, Math.floor(WATCHDOG_THRESHOLD_MS / 5)))
/** The poll period of the watchdog thread. */
const POLL_MS = Math.max(10, Math.floor(BEAT_MS / 2))
const NATIVE_PACKAGE = '@sentry/node-native-stacktrace'

/** The slots of the running watchdog, and the slot index of a widget row. */
interface Active {
  readonly slots: Int32Array
  index(row: string): number
}
let active: Active | undefined

/** Run `fn` with `row` in the running-widget slot. With no watchdog, run it as is. */
export function inSlot<T>(row: string, fn: () => T): T {
  const watch = active
  if (watch === undefined) return fn()
  const previous = Atomics.exchange(watch.slots, RUNNING_SLOT, watch.index(row))
  try {
    return fn()
  } finally {
    Atomics.store(watch.slots, RUNNING_SLOT, previous)
  }
}

/** The part of `@sentry/node-native-stacktrace` that the main thread uses. */
interface NativeRegister {
  registerThread(storage: { asyncLocalStorage: AsyncLocalStorage<unknown> }, threadName: string): void
}

/** Load the native module and register the main thread with `store`. Gives its resolved entry, or null. */
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
    ctx.logger.info(`widgets: watchdog: ${NATIVE_PACKAGE} did not load, so the watchdog blames by the slot only: ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`)
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
}

/**
 * Start the watchdog thread and the heartbeat. The effect belongs to `ctx`, so the runtime row stops both.
 * @param store - the blame store; the native module reads it from the stuck thread.
 */
export function startWatchdog(ctx: Context, store: AsyncLocalStorage<string>, files: WatchdogFiles): Watchdog {
  const slots = new Int32Array(new SharedArrayBuffer(SLOT_COUNT * Int32Array.BYTES_PER_ELEMENT))
  const rows = new Map<string, WatchdogRowMessage>()
  const data: WatchdogData = {
    buffer: slots.buffer,
    thresholdMs: WATCHDOG_THRESHOLD_MS,
    pollMs: POLL_MS,
    crashFile: files.crashFile,
    provisionalFile: files.provisionalFile,
    nativeEntry: loadNative(ctx, store),
    mainThread: String(threadId),
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
  const watch: Active = { slots, index: (row) => rowOf(row).index }

  ctx.effect(() => {
    active = watch
    const beat = setInterval(() => { Atomics.add(slots, BEAT_SLOT, 1) }, BEAT_MS)
    beat.unref()
    return () => {
      clearInterval(beat)
      if (active === watch) active = undefined
      void worker.terminate()
      // The heartbeat runs again here, so a provisional record of this host is stale.
      try {
        const record = JSON.parse(readFileSync(files.provisionalFile, 'utf8')) as Partial<CrashRecord>
        if (record.pid === process.pid && record.applied !== true) unlinkSync(files.provisionalFile)
      } catch { /* no record */ }
    }
  }, 'widgets: the watchdog')
  ctx.logger.info(`widgets: watchdog: threshold ${String(WATCHDOG_THRESHOLD_MS)} ms, beat ${String(BEAT_MS)} ms, native ${data.nativeEntry === null ? 'off' : 'on'}`)

  return {
    track(row, root, slugs) {
      const item = rowOf(row)
      item.root ??= root ?? null
      item.slugs = slugs
      worker.postMessage(item)
    },
  }
}
