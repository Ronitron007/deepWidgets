/**
 * The crash record, its files, and the slots that the main thread shares with the watchdog thread.
 * The blame claimer (`isolation.ts`) and the watchdog thread (`watchdog-worker.ts`) both use this module, so it
 * imports only Node built-in modules.
 * @module @deepwidgets/widgets/records
 */
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

/** At most this many files of one package go into its hash. */
const HASH_FILE_LIMIT = 2_000

/**
 * How the widget was found. `store` and `stack` come from the claimer (`widget_phase2.isolation.blame`).
 * `slot` and `native-stack` come from the watchdog (`widget_phase2.isolation.watchdog`). The watchdog never blames by
 * the store of the stuck thread alone (`safe_host.watchdog`).
 */
export type BlameMethod = 'store' | 'stack' | 'slot' | 'native-stack'

/**
 * The crash record `$DSH_HOME/deepwidgets/crash.json`. The host that starts next applies it.
 * The watchdog writes the same form to `crash.json` when it kills the host (`stall`), and to `provisional.json`
 * at a quarter of the threshold (`provisional-stall`).
 */
export interface CrashRecord {
  /** The Loader row id of the blamed widget, or null for an unblamed crash. */
  row: string | null
  /** The slugs that the blamed row registered. */
  slugs: string[]
  error: { name: string, message: string, stack: string }
  /** Epoch milliseconds of the crash. */
  at: number
  event: 'uncaughtException' | 'unhandledRejection' | 'stall' | 'provisional-stall'
  method: BlameMethod | null
  /** The package folder of the blamed row, and the hash of its files at the crash. */
  root: string | null
  hash: string | null
  pid: number
  /** True after a host start moved the blame into the quarantine. */
  applied: boolean
}

/** The index of the heartbeat slot. The main thread adds 1 on each beat. */
export const BEAT_SLOT = 0
/** The index of the running-widget slot: the index of the widget row whose code runs, or 0 for none. */
export const RUNNING_SLOT = 1
/** widget_fv.crash: the main thread adds 1 each time a widget call returns (`inSlot`). */
export const CALLS_SLOT = 2
/** widget_fv.crash: 1 while the provisional record of the watchdog thread exists. The side that removes it puts 0. */
export const PROVISIONAL_SLOT = 3
/** safe_host.cleanup: 1 after the claimer wrote its crash record. The dispose runs, and the watchdog thread owns its deadline. */
export const CRASH_SLOT = 4
/** The number of Int32 slots in the shared buffer. */
export const SLOT_COUNT = 5

/** The data that the main thread gives the watchdog thread at its start. */
export interface WatchdogData {
  buffer: SharedArrayBuffer
  /** safe_host.watchdog: a stall of this length with a widget in the running slot kills the host. A quarter of it writes the provisional record. */
  thresholdMs: number
  /** safe_host.watchdog: a stall of this length with no widget in the running slot kills the host. */
  idleThresholdMs: number
  /** safe_host.watchdog: a poll gap of this length means that the process did not run. The stall clock starts again. */
  suspendGapMs: number
  /** safe_host.cleanup: the time limit of the dispose at a crash. Then the watchdog thread kills the host. */
  disposeLimitMs: number
  pollMs: number
  crashFile: string
  provisionalFile: string
  /** safe_host.watchdog: the resolved entry of `@sentry/node-native-stacktrace`, or null when it did not load on the main thread. */
  nativeEntry: string | null
  /** The name under which the main thread registered with the native module. */
  mainThread: string
  /** A test hook: the native stack read waits this long more, as when the main thread is in native code. 0 is off. */
  testReadDelayMs: number
}

/** A message from the main thread: one widget row, its slot index, and what the record needs of it. */
export interface WatchdogRowMessage {
  type: 'row'
  index: number
  row: string
  root: string | null
  slugs: string[]
}

export function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown
  } catch {
    return undefined
  }
}

/** Write with a rename, so a reader never sees half a file. Synchronous: it runs on the exit path and in the watchdog. */
export function writeJsonSync(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  const temp = `${file}.${String(process.pid)}.tmp`
  writeFileSync(temp, JSON.stringify(value, null, 2))
  renameSync(temp, file)
}

/** The files of a package folder, sorted, without `node_modules` and dot folders. */
function packageFiles(root: string): string[] {
  const files: string[] = []
  const walk = (dir: string): void => {
    let names
    try {
      names = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const item of names) {
      if (files.length >= HASH_FILE_LIMIT) return
      if (item.name === 'node_modules' || item.name.startsWith('.')) continue
      const path = join(dir, item.name)
      if (item.isDirectory()) walk(path)
      else if (item.isFile()) files.push(path)
    }
  }
  walk(root)
  return files.sort()
}

/** The sha256 of the relative paths and contents of the package files. */
export function packageHash(root: string): string {
  const hash = createHash('sha256')
  for (const file of packageFiles(root)) {
    hash.update(relative(root, file)).update('\0')
    try {
      hash.update(readFileSync(file))
    } catch {
      hash.update('unreadable')
    }
    hash.update('\0')
  }
  return hash.digest('hex')
}
