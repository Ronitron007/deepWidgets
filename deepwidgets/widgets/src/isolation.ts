/**
 * Blame at exit and quarantine (`widget_phase2.isolation.blame` in `docs/specs/widget-phase2.md`).
 *
 * The runtime runs the plugin body of each widget row (a Loader row with an id `deepwidgets-widget-*`, or
 * `deepwidgets-agent-*` for an agent bundle, `widget_phase2.creation.rows`) and each
 * action handler inside an AsyncLocalStorage store that names the row. Timers, promises, and listeners that the
 * widget code creates there keep the store. On a fatal error, the claimer reads the store; when the store is empty,
 * it matches the stack against the package folder of each widget row. It writes `$DSH_HOME/deepwidgets/crash.json`
 * with a synchronous write and exits the host at once. The next host reads the record and does not run the blamed
 * row while its package files have the blamed hash. The quarantine ends only when files with a different hash load
 * with success (`widget_fv.install`): a failed load and the rollback to the blamed files keep it. During a
 * `widget_install` of the slug, it ends only when the whole install succeeds.
 *
 * The watchdog (`widget_phase2.isolation.watchdog`, `watchdog.ts`) writes the same record when the main thread stalls,
 * and a provisional record at a quarter of its threshold. The next host applies both through the same quarantine.
 *
 * The key is the Loader row, not the exported plugin `name`: a bundle can export any name, so a name key would let
 * one bundle get another widget quarantined.
 * @module @deepwidgets/widgets/isolation
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Context, Fiber } from '@deepseek-ai/cordis'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { packageHash, readJson, writeJsonSync, type CrashRecord } from './records.ts'
import { inSlot, startWatchdog } from './watchdog.ts'

export { packageHash, type BlameMethod, type CrashRecord } from './records.ts'

/** The Loader row ids that the runtime treats as widget code. */
const WIDGET_ROW = /^deepwidgets-(?:widget|agent)-/
/** The Loader row ids of agent bundles (`widget_phase2.creation.rows`). */
const AGENT_ROW = /^deepwidgets-agent-/
/** The key under which the DSH fail-loud release finds the fatal hooks (`apps/cli/src/profile-boot.ts`). */
const FATAL_HOOKS = Symbol.for('deepwidgets.fatal.hooks')
/** One quarantined widget row in `$DSH_HOME/deepwidgets/quarantine.json`. */
export interface Quarantine {
  row: string
  slugs: string[]
  /** The text that the failed widget shows. */
  reason: string
  at: number
  root: string | null
  hash: string | null
}

/** The store: the id of the widget row whose code runs. */
const blameStore = new AsyncLocalStorage<string>()

/** The part of a Loader entry that the isolation reads. The Loader sets `fiber.entry` on the fiber of each row. */
interface RowView {
  readonly id: string
  readonly options: { readonly id?: unknown }
}

/** The widget row id of a Loader entry, or undefined when the entry is not a widget row. */
function widgetRowOfEntry(entry: RowView): string | undefined {
  return typeof entry.options.id === 'string' && WIDGET_ROW.test(entry.options.id) ? entry.id : undefined
}

const entryOf = (fiber: Fiber | undefined): RowView | undefined => (fiber as { entry?: RowView } | undefined)?.entry

/** The Loader row of `fiber` itself, when it is a widget row. A child fiber that shares the entry of its parent is not. */
function ownRow(fiber: Fiber): string | undefined {
  const entry = entryOf(fiber)
  if (entry === undefined || entryOf(fiber.parent.fiber) === entry) return undefined
  return widgetRowOfEntry(entry)
}

/** The Loader entry of the nearest fiber at or above `fiber` that has one. */
function ownerEntry(fiber: Fiber): RowView | undefined {
  for (let current = fiber; current.runtime !== null; current = current.parent.fiber) {
    const entry = entryOf(current)
    if (entry !== undefined) return entry
  }
  return undefined
}

/** The widget row that owns `fiber`: the entry of the nearest fiber at or above it that has one. */
export function widgetRow(fiber: Fiber): string | undefined {
  const entry = ownerEntry(fiber)
  return entry === undefined ? undefined : widgetRowOfEntry(entry)
}

/** Whether the row that owns `fiber` is the row of an agent bundle, `deepwidgets-agent-<slug>`. */
export function agentRow(fiber: Fiber): boolean {
  const id = ownerEntry(fiber)?.options.id
  return typeof id === 'string' && AGENT_ROW.test(id)
}

/** The widget row whose code runs now, or undefined outside widget code. */
export function runningRow(): string | undefined {
  return blameStore.getStore()
}

/**
 * Run `fn` inside the store of `row`, with `row` in the running-widget slot of the watchdog.
 * With no row, run it as is.
 */
export function runAs<T>(row: string | undefined, fn: () => T): T {
  return row === undefined ? fn() : blameStore.run(row, () => inSlot(row, fn))
}

const stateDir = (): string => join(resolveDshHome(), 'deepwidgets')
const crashFile = (): string => join(stateDir(), 'crash.json')
const quarantineFile = (): string => join(stateDir(), 'quarantine.json')
/** The provisional record of the watchdog (`widget_phase2.isolation.watchdog`). */
const provisionalFile = (): string => join(stateDir(), 'provisional.json')

/** The nearest folder at or above `file` with a `package.json`. */
function packageRoot(file: string): string | undefined {
  let dir = dirname(file)
  for (;;) {
    try {
      readFileSync(join(dir, 'package.json'))
      return dir
    } catch { /* not this folder */ }
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/** The file of each stack frame, as a path. */
function stackFiles(stack: string): string[] {
  const files: string[] = []
  for (const line of stack.split('\n')) {
    const match = /\(([^()]+):\d+:\d+\)$/.exec(line.trim()) ?? /^at ([^()\s]+):\d+:\d+$/.exec(line.trim())
    const location = match?.[1]
    if (location === undefined || location.startsWith('node:')) continue
    try {
      files.push(location.startsWith('file:') ? fileURLToPath(location) : location)
    } catch { /* not a file location */ }
  }
  return files
}

function errorInfo(error: unknown): CrashRecord['error'] {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack ?? '' }
  return { name: typeof error, message: String(error), stack: '' }
}

const OWN_ROOT = packageRoot(fileURLToPath(import.meta.url))
const CORDIS_ROOT = ((): string | undefined => {
  try {
    return dirname(createRequire(import.meta.url).resolve('@deepseek-ai/cordis/package.json'))
  } catch {
    return undefined
  }
})()

/**
 * The package folder of the code that called the runtime: the first stack frame outside this package and Cordis.
 * @returns undefined when no frame has a package folder.
 */
export function callerRoot(): string | undefined {
  const limit = Error.stackTraceLimit
  Error.stackTraceLimit = 30
  const stack = String(new Error('caller').stack)
  Error.stackTraceLimit = limit
  for (const file of stackFiles(stack)) {
    const root = packageRoot(file)
    if (root !== undefined && root !== OWN_ROOT && root !== CORDIS_ROOT) return root
  }
  return undefined
}

/** What the runtime gives the isolation: how to show a held widget. */
export interface IsolationHost {
  /** Show each slug as failed with the reason. The returned disposer removes them. */
  hold(slugs: string[], row: string, reason: string): () => Promise<void>
}

/** The isolation of one runtime instance. */
export interface Isolation {
  /** A widget row registered a slug from code in the package folder `root`. */
  track(row: string, root: string | undefined, slug: string): void
  /** The quarantined rows of this start. */
  quarantined(): Quarantine[]
  /** widget_fv.install: an install of `slug` starts. A row of the slug that loads other files keeps its quarantine. */
  holdLift(slug: string): void
  /** widget_fv.install: the install of `slug` ends. With `ok`, the rows of the slug that loaded other files leave the quarantine. */
  settleLift(slug: string, ok: boolean): void
}

/**
 * Apply the crash record of the last host, wrap each widget fiber, and install the claimer.
 * Each effect belongs to `ctx`, so the runtime row turns all of it off.
 */
export function createIsolation(ctx: Context, host: IsolationHost): Isolation {
  const known = new Map<string, { root: string | undefined, slugs: Set<string> }>()
  const quarantine = new Map<string, Quarantine>()

  // ---- quarantine at start: move a blame of the last host into the quarantine ----
  const stored = readJson(quarantineFile())
  // An entry without a row id is from an older format; it is dropped.
  if (Array.isArray(stored)) for (const item of stored as Quarantine[]) if (typeof item.row === 'string') quarantine.set(item.row, item)
  /** Move the blame of one record into the quarantine, and mark the record applied in `file`. */
  function apply(file: string, record: CrashRecord): void {
    if (typeof record.row === 'string') {
      const reason = `quarantined after a crash (${record.event}, blamed by ${String(record.method)}): ${record.error.message}`.slice(0, 500)
      quarantine.set(record.row, { row: record.row, slugs: record.slugs, reason, at: record.at, root: record.root, hash: record.hash })
      writeJsonSync(quarantineFile(), [...quarantine.values()])
      ctx.logger.warn(`widgets: the row ${record.row} crashed the last host; it does not run until its files change`)
    }
    writeJsonSync(file, { ...record, applied: true })
  }
  const record = readJson(crashFile()) as CrashRecord | undefined
  if (record !== undefined && !record.applied) apply(crashFile(), record)
  // widget_phase2.isolation.watchdog: a provisional record that is left means that its host ended in the stall, for
  // example by an out-of-memory abort. A crash record of the same host wins: it saw the end. A record of this process
  // is from a runtime instance that is still alive, so it is not a crash. In the desktop app, Electron main removes
  // the record before the restart when the host did not end like an abort (deepwidgets-supervisor.ts). A host with no
  // supervisor, such as the CLI host, cannot see how the last host ended, so it applies the record.
  const provisional = readJson(provisionalFile()) as CrashRecord | undefined
  if (provisional !== undefined && !provisional.applied && provisional.pid !== process.pid) {
    if (record?.pid === provisional.pid) writeJsonSync(provisionalFile(), { ...provisional, applied: true })
    else apply(provisionalFile(), provisional)
  }

  /**
   * The quarantine item of `row`, when it holds the row. Files with another hash run, but the item stays until
   * they load with success (`lift`). Thus a failed load and a rollback to the blamed files keep the quarantine.
   */
  function held(row: string): Quarantine | undefined {
    const item = quarantine.get(row)
    if (item === undefined) return undefined
    if (item.root !== null && item.hash !== null && packageHash(item.root) !== item.hash) return undefined
    return item
  }

  /** widget_fv.install: the files of `row` loaded with success, and they are not the blamed files. End the quarantine. */
  function lift(row: string): void {
    if (!quarantine.has(row)) return
    quarantine.delete(row)
    writeJsonSync(quarantineFile(), [...quarantine.values()])
    ctx.logger.info(`widgets: the row ${row} left the quarantine: files with another hash loaded with success`)
  }

  // widget_fv.install: the slugs with a running install, and the rows that loaded other files during one.
  const installing = new Set<string>()
  const pending = new Set<string>()
  /** Whether the quarantine item of `row` is for `slug`: by its slugs, or by the agent row id of the slug. */
  const ofSlug = (row: string, item: Quarantine, slug: string): boolean =>
    item.slugs.includes(slug) || row === `deepwidgets-agent-${slug}` || row.endsWith(`:deepwidgets-agent-${slug}`)
  /** Files of a quarantined `row` with another hash loaded with success. Lift now, or after the install of its slug. */
  function loaded(row: string): void {
    const item = quarantine.get(row)
    if (item === undefined) return
    if ([...installing].some((slug) => ofSlug(row, item, slug))) pending.add(row)
    else lift(row)
  }

  // ---- the store around the plugin body of each widget fiber ----
  // Cordis has no documented hook around a plugin body. The fiber runner `execute` runs the body on each load,
  // so the runtime wraps it (vendor/cordis/src/fiber.ts). A held row loads with no effect but the failed slugs.
  // The Loader sets `fiber.entry` in its own `internal/plugin` listener, which runs before this one.
  // The dispose step puts each original `execute` back, so a reload of the runtime does not stack wrappers.
  type Runner = { execute: (this: Fiber) => unknown }
  const originals = new Map<Runner, Runner['execute']>()
  function wrap(fiber: Fiber): void {
    const row = ownRow(fiber)
    const runner = (fiber as unknown as { _runner?: Runner })._runner
    if (row === undefined || runner === undefined || originals.has(runner)) return
    const execute = runner.execute
    originals.set(runner, execute)
    runner.execute = function (this: Fiber) {
      const item = held(row)
      if (item !== undefined) {
        ctx.logger.warn(`widgets: the row ${row} is quarantined: ${item.reason}`)
        return host.hold(item.slugs, row, item.reason)
      }
      const effect = runAs(row, () => execute.call(this))
      // A throw leaves before the lift. An async body lifts when its promise resolves.
      if (!quarantine.has(row)) return effect
      if (effect !== null && typeof effect === 'object' && 'then' in effect && typeof effect.then === 'function') {
        return (effect as PromiseLike<unknown>).then((value) => {
          loaded(row)
          return value
        })
      }
      loaded(row)
      return effect
    }
  }
  ctx.effect(() => () => {
    for (const [runner, execute] of originals) runner.execute = execute
    originals.clear()
  }, 'widgets: restore the fiber runners')
  for (const runtime of ctx.registry.values()) for (const fiber of runtime.fibers) wrap(fiber)
  ctx.on('internal/plugin', wrap)

  // ---- the claimer ----
  function stackBlame(stack: string): string | undefined {
    if (stack === '') return undefined
    for (const [row, item] of known) {
      if (item.root === undefined) continue
      if (stack.includes(item.root + sep) || stack.includes(pathToFileURL(item.root).href + '/')) return row
    }
    return undefined
  }

  /** Write the crash record and exit at once. It does not return. */
  function claim(error: unknown, event: CrashRecord['event']): void {
    try {
      const info = errorInfo(error)
      const store = blameStore.getStore()
      const stack = store === undefined ? stackBlame(info.stack) : undefined
      const row = store ?? stack ?? null
      const item = row === null ? undefined : known.get(row)
      const root = item?.root ?? null
      const crash: CrashRecord = {
        row,
        slugs: [...(item?.slugs ?? [])],
        error: info,
        at: Date.now(),
        event,
        method: store !== undefined ? 'store' : stack !== undefined ? 'stack' : null,
        root,
        hash: root === null ? null : packageHash(root),
        pid: process.pid,
        applied: false,
      }
      writeJsonSync(crashFile(), crash)
      process.stderr.write(`deepwidgets: ${event} blamed on ${row ?? 'no widget'} (${crash.method ?? 'none'}); the host exits now\n`)
    } catch (failure) {
      process.stderr.write(`deepwidgets: the crash record was not written: ${String(failure)}\n`)
    }
    // No cleanup: each storage write is an atomic rename, so a hard exit loses no acknowledged write.
    process.exit(1)
  }
  ctx.effect(() => {
    const registry = globalThis as { [key: symbol]: Set<typeof claim> | undefined }
    const hooks = (registry[FATAL_HOOKS] ??= new Set())
    hooks.add(claim)
    return () => { hooks.delete(claim) }
  }, 'widgets: the crash claimer')

  // ---- the watchdog (widget_phase2.isolation.watchdog) ----
  const watchdog = startWatchdog(ctx, blameStore, { crashFile: crashFile(), provisionalFile: provisionalFile() })

  return {
    track(row, root, slug) {
      const item = known.get(row) ?? { root, slugs: new Set<string>() }
      item.root ??= root
      item.slugs.add(slug)
      known.set(row, item)
      watchdog.track(row, item.root, [...item.slugs])
    },
    quarantined: () => [...quarantine.values()],
    holdLift(slug) {
      installing.add(slug)
    },
    settleLift(slug, ok) {
      installing.delete(slug)
      for (const row of [...pending]) {
        const item = quarantine.get(row)
        if (item !== undefined && !ofSlug(row, item, slug)) continue
        pending.delete(row)
        // The files that loaded must still be in place: the blamed hash never leaves the quarantine.
        if (ok && item !== undefined && (item.root === null || item.hash === null || packageHash(item.root) !== item.hash)) lift(row)
      }
    },
  }
}
