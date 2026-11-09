/**
 * Blame at exit and quarantine (`widget_phase2.isolation.blame` in `docs/specs/widget-phase2.md`).
 *
 * The runtime runs the plugin body of each widget row (a Loader row with an id `deepwidgets-widget-*`, or
 * `deepwidgets-agent-*` for an agent bundle, `widget_phase2.creation.rows` and `widget_fv.replace`) and each
 * action handler inside an AsyncLocalStorage store that names the row. Timers, promises, and listeners that the
 * widget code creates there keep the store. On a fatal error, the claimer reads the store; when the store is empty,
 * it matches the stack against the package folder of each widget row. It writes `$DSH_HOME/deepwidgets/crash.json`
 * with a synchronous write. Then the fail-loud release disposes the plugin tree and exits with code 1. The watchdog
 * thread kills the host when that dispose takes 3 s (`safe_host.cleanup`). The next host reads the record and does not run the blamed
 * row while its package files have the blamed hash. The quarantine ends only when files with a different hash load
 * with success (`widget_fv.install`): a failed load and the rollback to the blamed files keep it. During a
 * `widget_install` of the slug, it ends only when the whole install succeeds.
 *
 * The watchdog (`widget_phase2.isolation.watchdog`, `watchdog.ts`) writes the same record when the main thread stalls,
 * and a provisional record at a quarter of its threshold. The next host applies both through the same quarantine.
 *
 * widget_fv.crash: the package folder and the slugs of a row come from its Loader entry when its code starts, so a
 * crash record has the root and the hash also when the widget throws before it registers. safe_host.crash: a row
 * whose plugin body throws shows its slugs as failed with the reason.
 *
 * safe_host.hmr: each `ctx.on` listener of a widget or agent row runs in the store of the row. Each disposer of a row
 * fiber has a time limit of 5 s: when it passes, the row is quarantined, and the unload goes on. The agent rows load
 * through the agent-row gate (`gate.ts`) only after the watchdog starts, one at a time, in the store and the running
 * slot of the row. A quarantined agent row loads a stub in place of its module.
 *
 * The key is the Loader row, not the exported plugin `name`: a bundle can export any name, so a name key would let
 * one bundle get another widget quarantined.
 * @module @deepwidgets/widgets/isolation
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Context, Fiber } from '@deepseek-ai/cordis'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { packageHash, readJson, writeJsonSync, type CrashRecord } from './records.ts'
import { openAgentGate, type GateEntry } from './gate.ts'
import { CRASH_DISPOSE_LIMIT_MS, DISPOSER_LIMIT_MS, enterSlot, inSlot, startWatchdog } from './watchdog.ts'

export { packageHash, type BlameMethod, type CrashRecord } from './records.ts'

/** The Loader row ids that the runtime treats as widget code. */
const WIDGET_ROW = /^deepwidgets-(?:widget|agent)-/
/** The Loader row ids of agent bundles (`widget_phase2.creation.rows`). */
const AGENT_ROW = /^deepwidgets-agent-/
/** The key of the effect meta on a Cordis effect disposer (`symbols.effect` of vendor/cordis/src/utils.ts). */
const EFFECT_META = Symbol.for('cordis.effect')
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
/** safe_host.cleanup: set when the claimer wrote its crash record. The dispose that follows ends this process. */
let crashed = false

/** safe_host.cleanup: true while the plugin tree disposes after a crash. */
export function hostCrashing(): boolean {
  return crashed
}

/** The part of a Loader entry that the isolation reads. The Loader sets `fiber.entry` on the fiber of each row. */
interface RowView {
  readonly id: string
  readonly options: { readonly id?: unknown, readonly name?: unknown }
  readonly parent?: { readonly tree?: { readonly ctx?: { readonly baseUrl?: unknown } } }
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

/** The row id of the Loader entry id `row`, without the ids of its groups in front. */
export function rowId(row: string): string {
  return row.slice(row.lastIndexOf(':') + 1)
}

/** Whether the Loader row id `row` (an entry id, which can have the ids of its groups in front) is the row of an agent bundle. */
export function isAgentRow(row: string): boolean {
  return AGENT_ROW.test(rowId(row))
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

/** widget_fv.crash: the slug that the row id of `row` names, as `bundleName` of `@deepwidgets/mcp` gives it, or undefined. */
function slugOfRow(row: string): string | undefined {
  return /^deepwidgets-(?:agent|widget)-([a-z0-9][a-z0-9-]*?)(?:\.b)?$/.exec(rowId(row))?.[1]
}

/** The part of the service `pluginPackages` that the isolation reads. */
interface PackagesView {
  packageOf(specifier: string, parentURL: string): { readonly dir: string } | undefined
}

/**
 * widget_fv.crash: the package folder of the Loader row of `fiber`, by the profile package lookup, as
 * `packageDir` of `packages/extensions/tool-cordis` finds it, as a real path.
 * @returns undefined when the host has no package lookup, or when it does not find the package.
 */
function rowRoot(ctx: Context, fiber: Fiber): string | undefined {
  return entryRoot(ctx, entryOf(fiber))
}

/** safe_host.hmr: the package folder of the Loader entry `entry`, as {@link rowRoot} finds it. It needs no fiber. */
function entryRoot(ctx: Context, entry: RowView | undefined): string | undefined {
  const name = entry?.options.name
  const baseUrl = entry?.parent?.tree?.ctx?.baseUrl
  if (typeof name !== 'string' || typeof baseUrl !== 'string') return undefined
  try {
    const dir = (ctx.get('pluginPackages') as PackagesView | undefined)?.packageOf(name, baseUrl)?.dir
    // The real path, as the stack frames of the loaded module give it (on macOS, /var is a link to /private/var).
    return dir === undefined ? undefined : realpathSync(dir)
  } catch {
    return undefined
  }
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
  /**
   * Show each slug as failed with the reason. The returned disposer removes them. `fiber` is the fiber of the row.
   * The isolation calls it for a quarantined row, and for a row whose plugin body threw (safe_host.crash).
   */
  hold(slugs: string[], row: string, reason: string, fiber?: Fiber): () => Promise<void>
  /** widget_fv.replace: the plugin body of the widget row `row` threw. */
  failed(row: string): void
  /** safe_host.hmr: safe mode did not load the agent row `row`. Its slugs show as off. */
  refused(row: string, slugs: string[]): void
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
  /**
   * Whether the quarantine item of `row` is for `slug`: by its slugs, or by an agent row id of the slug. The second
   * name `deepwidgets-agent-<slug>.b` is the other agent row id of the slug (widget_fv.replace).
   */
  const ofSlug = (row: string, item: Quarantine, slug: string): boolean => item.slugs.includes(slug) || agentRowOf(row, slug)
  /** Whether `row` is an agent row id of `slug`. */
  const agentRowOf = (row: string, slug: string): boolean => {
    const id = row.slice(row.lastIndexOf(':') + 1)
    return id === `deepwidgets-agent-${slug}` || id === `deepwidgets-agent-${slug}.b`
  }
  /** Files of a quarantined `row` with another hash loaded with success. Lift now, or after the install of its slug. */
  function loaded(row: string): void {
    // widget_fv.replace: during an install of a slug, an agent row of the slug that loads with success also marks the
    // quarantine item of the other agent row of the slug. The install removes that row before it succeeds, so the
    // blamed files are gone when settleLift lifts the item. A failed install keeps the item.
    for (const slug of installing) {
      if (!agentRowOf(row, slug)) continue
      for (const other of quarantine.keys()) if (other !== row && agentRowOf(other, slug)) pending.add(other)
    }
    const item = quarantine.get(row)
    if (item === undefined) return
    if ([...installing].some((slug) => ofSlug(row, item, slug))) pending.add(row)
    else lift(row)
  }

  // ---- the watchdog (widget_phase2.isolation.watchdog) ----
  const watchdog = startWatchdog(ctx, blameStore, { crashFile: crashFile(), provisionalFile: provisionalFile() })

  /** The slugs of `row`: the slugs that it registered, else the slug of its row id. */
  const slugsOf = (row: string): string[] => {
    const slugs = known.get(row)?.slugs
    if (slugs !== undefined && slugs.size > 0) return [...slugs]
    const slug = slugOfRow(row)
    return slug === undefined ? [] : [slug]
  }
  /**
   * widget_fv.crash: the code of `row` starts. Its package folder comes from its Loader row, so a crash record has
   * the root and the hash also before the row registers a slug. The folder that `track` finds is the fallback.
   */
  function noteRow(row: string, fiber: Fiber): void {
    const root = rowRoot(ctx, fiber)
    const item = known.get(row) ?? { root, slugs: new Set<string>() }
    if (root !== undefined) item.root = root
    known.set(row, item)
    watchdog.track(row, item.root, slugsOf(row))
  }
  /** safe_host.hmr: the agent row `row` starts to load. Its package folder comes from its Loader entry, before the import. */
  function noteEntry(row: string, entry: GateEntry): void {
    const root = entryRoot(ctx, entry as unknown as RowView)
    const item = known.get(row) ?? { root, slugs: new Set<string>() }
    if (root !== undefined) item.root = root
    known.set(row, item)
    watchdog.track(row, item.root, slugsOf(row))
  }

  /**
   * safe_host.hmr: a disposer of `row` did not end in {@link DISPOSER_LIMIT_MS}. Quarantine the row with the hash of its
   * files. The fiber unload goes on, so the next install works. When the row loads again, it shows as failed (`wrap`).
   */
  function disposerHung(row: string, label: string): void {
    if (crashed) return
    const root = known.get(row)?.root ?? null
    const reason = `quarantined: a disposer of the row ${rowId(row)} did not end in ${String(DISPOSER_LIMIT_MS)} ms (${label})`.slice(0, 500)
    quarantine.set(row, { row, slugs: slugsOf(row), reason, at: Date.now(), root, hash: root === null ? null : packageHash(root) })
    writeJsonSync(quarantineFile(), [...quarantine.values()])
    ctx.logger.error(`widgets: ${reason}`)
  }
  /** The time limit of one disposer of `row`. A disposer that gives no promise runs as is. */
  function limited(row: string, dispose: () => unknown): () => unknown {
    const label = (dispose as unknown as { [key: symbol]: { label?: unknown } | undefined })[EFFECT_META]?.label
    return () => {
      const result = dispose()
      if (result === null || typeof result !== 'object' || typeof (result as PromiseLike<unknown>).then !== 'function') return result
      let timer: ReturnType<typeof setTimeout> | undefined
      return Promise.race([
        Promise.resolve(result).finally(() => { clearTimeout(timer) }),
        new Promise<void>((resolve) => {
          timer = setTimeout(() => {
            disposerHung(row, typeof label === 'string' ? label : 'anonymous')
            resolve()
          }, DISPOSER_LIMIT_MS)
        }),
      ])
    }
  }
  /**
   * safe_host.hmr: Cordis awaits each disposer of a fiber in `_unload` with no limit (vendor/cordis/src/fiber.ts). The
   * list hands its disposers to `_unload` with `clear`, so the clear of the row fiber gives each one with a limit.
   * Only the rows of the isolation get it: host plugins, such as this runtime with its drain, keep no limit. A disposer
   * that the plugin code already started is not joined, because Cordis keeps that promise private.
   */
  type Clearable = { clear: () => Array<() => unknown> }
  const clears = new Map<Clearable, Clearable['clear']>()
  function limitDisposers(fiber: Fiber, row: string): void {
    const list = (fiber as unknown as { _disposables?: Clearable })._disposables
    if (list === undefined || clears.has(list)) return
    const clear = list.clear
    clears.set(list, clear)
    list.clear = function (this: Clearable) {
      return clear.call(this).map((dispose) => limited(row, dispose))
    }
  }
  /**
   * safe_host.crash: the failed entries of each fiber whose plugin body threw. Cordis disposes the effects of a
   * failed fiber at once, so the isolation keeps them. They end when the fiber loads again or is disposed.
   */
  const thrown = new Map<Fiber, () => Promise<void>>()
  function endFailed(fiber: Fiber): void {
    const dispose = thrown.get(fiber)
    if (dispose === undefined) return
    thrown.delete(fiber)
    dispose().catch((error: unknown) => { ctx.logger.warn(`widgets: a failed entry did not end: ${String(error)}`) })
  }
  /**
   * safe_host.crash: the plugin body of `row` threw. Its slugs that have no entry show as failed with the reason.
   * A refusal of safe mode keeps its own `off` entry.
   */
  function showFailed(row: string, fiber: Fiber, error: unknown): void {
    host.failed(row)
    if ((error as { code?: unknown } | null)?.code === 'safe-mode') return
    const slugs = slugsOf(row)
    if (slugs.length === 0) return
    const reason = `the code of the row ${rowId(row)} threw: ${errorInfo(error).message}`.slice(0, 500)
    try {
      endFailed(fiber)
      thrown.set(fiber, host.hold(slugs, row, reason, fiber))
    } catch (failure) {
      ctx.logger.warn(`widgets: the failed slugs of the row ${row} do not show: ${String(failure)}`)
    }
  }

  // ---- the store around the plugin body of each widget fiber ----
  // Cordis has no documented hook around a plugin body. The fiber runner `execute` runs the body on each load,
  // so the runtime wraps it (vendor/cordis/src/fiber.ts). A held row loads with no effect but the failed slugs.
  // The Loader sets `fiber.entry` in its own `internal/plugin` listener, which runs before this one.
  // The dispose step puts each original `execute` back, so a reload of the runtime does not stack wrappers.
  type Runner = { execute: (this: Fiber) => unknown }
  const originals = new Map<Runner, Runner['execute']>()
  function wrap(fiber: Fiber): void {
    // Cordis emits `internal/plugin` also when it disposes a fiber, with no uid.
    if ((fiber as { uid?: unknown }).uid === null) endFailed(fiber)
    const row = ownRow(fiber)
    const runner = (fiber as unknown as { _runner?: Runner })._runner
    if (row === undefined || runner === undefined || originals.has(runner)) return
    limitDisposers(fiber, row)
    const execute = runner.execute
    originals.set(runner, execute)
    runner.execute = function (this: Fiber) {
      endFailed(this)
      const item = held(row)
      if (item !== undefined) {
        ctx.logger.warn(`widgets: the row ${row} is quarantined: ${item.reason}`)
        return host.hold(item.slugs, row, item.reason, this)
      }
      noteRow(row, this)
      const failed = (error: unknown): never => {
        showFailed(row, this, error)
        throw error
      }
      let effect: unknown
      try {
        effect = runAs(row, () => execute.call(this))
      } catch (error) {
        failed(error)
      }
      const promised = effect !== null && typeof effect === 'object' && 'then' in effect && typeof effect.then === 'function'
      // A throw leaves before the lift. An async body lifts when its promise resolves.
      if (!quarantine.has(row) && installing.size === 0) {
        return promised ? (effect as PromiseLike<unknown>).then(undefined, failed) : effect
      }
      if (promised) {
        return (effect as PromiseLike<unknown>).then((value) => {
          loaded(row)
          return value
        }, failed)
      }
      loaded(row)
      return effect
    }
  }
  ctx.effect(() => () => {
    for (const [runner, execute] of originals) runner.execute = execute
    originals.clear()
    for (const [list, clear] of clears) list.clear = clear
    clears.clear()
    thrown.clear()
  }, 'widgets: restore the fiber runners')
  for (const runtime of ctx.registry.values()) for (const fiber of runtime.fibers) wrap(fiber)
  ctx.on('internal/plugin', wrap)

  // ---- safe_host.hmr: each ctx.on listener of a widget or agent row runs in the store of the row ----
  // Cordis bails `internal/listener` with the context of the caller of ctx.on, and returns a bail result as the
  // disposer of ctx.on (vendor/cordis/src/events.ts). So the hook registers the wrapped listener in place of the
  // listener, on the same context. The flag stops the hook at that inner registration.
  let rewrapping = false
  ctx.on('internal/listener', function (this: Context, name: string | symbol, listener: (...args: unknown[]) => unknown, options: unknown) {
    if (rewrapping || (typeof name === 'string' && name.startsWith('internal/'))) return
    const row = widgetRow(this.fiber)
    if (row === undefined) return
    const inner = listener
    const wrapped = function (this: unknown, ...args: unknown[]): unknown {
      return runAs(row, () => inner.apply(this, args))
    }
    rewrapping = true
    try {
      return (this as unknown as { on(name: string | symbol, listener: unknown, options: unknown): () => boolean }).on(name, wrapped, options)
    } finally {
      rewrapping = false
    }
  })

  // ---- the claimer ----
  function stackBlame(stack: string): string | undefined {
    if (stack === '') return undefined
    for (const [row, item] of known) {
      if (item.root === undefined) continue
      if (stack.includes(item.root + sep) || stack.includes(pathToFileURL(item.root).href + '/')) return row
    }
    return undefined
  }

  /**
   * safe_host.cleanup: write the crash record. The fail-loud release then disposes the plugin tree and exits with
   * code 1 (`apps/cli/src/profile-boot.ts`). First the watchdog thread learns that the dispose starts: it owns the
   * deadline of the dispose, and it writes no stall record over this record.
   * @returns the time limit of the dispose in ms.
   */
  function claim(error: unknown, event: CrashRecord['event']): number {
    crashed = true
    watchdog.crashing()
    try {
      const info = errorInfo(error)
      const store = blameStore.getStore()
      const stack = store === undefined ? stackBlame(info.stack) : undefined
      const row = store ?? stack ?? null
      const root = (row === null ? undefined : known.get(row)?.root) ?? null
      const crash: CrashRecord = {
        row,
        slugs: row === null ? [] : slugsOf(row),
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
      process.stderr.write(`deepwidgets: ${event} blamed on ${row ?? 'no widget'} (${crash.method ?? 'none'}); the host disposes its plugins and exits\n`)
    } catch (failure) {
      process.stderr.write(`deepwidgets: the crash record was not written: ${String(failure)}\n`)
    }
    // The time limit of the dispose. The release of profile-boot keeps a timer at it, as a backup of the watchdog thread.
    return CRASH_DISPOSE_LIMIT_MS
  }
  ctx.effect(() => {
    const registry = globalThis as { [key: symbol]: Set<typeof claim> | undefined }
    const hooks = (registry[FATAL_HOOKS] ??= new Set())
    hooks.add(claim)
    return () => { hooks.delete(claim) }
  }, 'widgets: the crash claimer')

  // ---- safe_host.hmr: the agent rows load now, after the watchdog, the wrappers, and the claimer ----
  ctx.effect(() => openAgentGate({
    // A quarantined agent row loads a stub in place of its module: its top-level code is the code that crashed or
    // hung. The fiber of the stub runs the held branch of `wrap`, so the row shows as failed for the life of its entry.
    held: (entry) => held(entry.id)?.reason,
    run(entry, load) {
      const row = entry.id
      noteEntry(row, entry)
      return blameStore.run(row, async () => {
        const exit = enterSlot(row)
        // A load that does not end leaves the slot after the load limit, so it does not blame later host work.
        const timer = setTimeout(exit, DISPOSER_LIMIT_MS)
        try {
          await load()
        } finally {
          clearTimeout(timer)
          exit()
        }
      })
    },
    refused(entry) {
      host.refused(entry.id, slugsOf(entry.id))
    },
  }), 'widgets: the agent-row gate')

  return {
    track(row, root, slug) {
      // The folder of the Loader row (noteRow) wins over the folder of the caller.
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
