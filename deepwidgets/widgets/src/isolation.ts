/**
 * Blame at exit and quarantine (`widget_phase2.isolation.blame` in `docs/specs/widget-phase2.md`).
 *
 * The runtime runs the plugin body of each widget plugin (`deepwidgets-widget-*`) and each action handler inside
 * an AsyncLocalStorage store that names the widget plugin. Timers, promises, and listeners that the widget code
 * creates there keep the store. On a fatal error, the claimer reads the store; when the store is empty, it matches
 * the stack against the package folder of each widget plugin. It writes `$DSH_HOME/deepwidgets/crash.json` with a
 * synchronous write and exits the host at once. The next host reads the record and does not run the blamed plugin
 * until the hash of its package files changes.
 * @module @deepwidgets/widgets/isolation
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Context, Fiber } from '@deepseek-ai/cordis'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** The plugin names that the runtime treats as widget code. */
const WIDGET_PLUGIN = /^deepwidgets-widget-/
/** The key under which the DSH fail-loud release finds the fatal hooks (`apps/cli/src/profile-boot.ts`). */
const FATAL_HOOKS = Symbol.for('deepwidgets.fatal.hooks')
/** At most this many files of one package go into its hash. */
const HASH_FILE_LIMIT = 2_000

/** How the claimer found the widget. */
export type BlameMethod = 'store' | 'stack'

/** The crash record `$DSH_HOME/deepwidgets/crash.json`. The host that starts next applies it. */
export interface CrashRecord {
  /** The blamed widget plugin, or null for an unblamed crash. */
  plugin: string | null
  /** The slugs that the blamed plugin registered. */
  slugs: string[]
  error: { name: string, message: string, stack: string }
  /** Epoch milliseconds of the crash. */
  at: number
  event: 'uncaughtException' | 'unhandledRejection'
  method: BlameMethod | null
  /** The package folder of the blamed plugin, and the hash of its files at the crash. */
  root: string | null
  hash: string | null
  pid: number
  /** True after a host start moved the blame into the quarantine. */
  applied: boolean
}

/** One quarantined widget plugin in `$DSH_HOME/deepwidgets/quarantine.json`. */
export interface Quarantine {
  plugin: string
  slugs: string[]
  /** The text that the failed widget shows. */
  reason: string
  at: number
  root: string | null
  hash: string | null
}

/** The store: the name of the widget plugin whose code runs. */
const blameStore = new AsyncLocalStorage<string>()

/** The plugin name when it is widget code, else undefined. */
export function widgetPlugin(name: string | undefined): string | undefined {
  return name !== undefined && WIDGET_PLUGIN.test(name) ? name : undefined
}

/** Run `fn` inside the store of `plugin`. With no plugin, run it as is. */
export function runAs<T>(plugin: string | undefined, fn: () => T): T {
  return plugin === undefined ? fn() : blameStore.run(plugin, fn)
}

const stateDir = (): string => join(resolveDshHome(), 'deepwidgets')
const crashFile = (): string => join(stateDir(), 'crash.json')
const quarantineFile = (): string => join(stateDir(), 'quarantine.json')

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown
  } catch {
    return undefined
  }
}

/** Write with a rename, so a reader never sees half a file. Synchronous: it runs on the exit path. */
function writeJsonSync(file: string, value: unknown): void {
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
  hold(slugs: string[], plugin: string, reason: string): () => Promise<void>
}

/** The isolation of one runtime instance. */
export interface Isolation {
  /** A widget plugin registered a slug from code in the package folder `root`. */
  track(plugin: string, root: string | undefined, slug: string): void
  /** The quarantined plugins of this start. */
  quarantined(): Quarantine[]
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
  if (Array.isArray(stored)) for (const item of stored as Quarantine[]) quarantine.set(item.plugin, item)
  const record = readJson(crashFile()) as CrashRecord | undefined
  if (record !== undefined && !record.applied) {
    if (record.plugin !== null) {
      const reason = `quarantined after a crash (${record.event}, blamed by ${String(record.method)}): ${record.error.message}`.slice(0, 500)
      quarantine.set(record.plugin, { plugin: record.plugin, slugs: record.slugs, reason, at: record.at, root: record.root, hash: record.hash })
      writeJsonSync(quarantineFile(), [...quarantine.values()])
      ctx.logger.warn(`widgets: ${record.plugin} crashed the last host; it does not run until its files change`)
    }
    writeJsonSync(crashFile(), { ...record, applied: true })
  }

  /** True when the quarantine holds `plugin`. A changed hash lifts it. */
  function held(plugin: string): Quarantine | undefined {
    const item = quarantine.get(plugin)
    if (item === undefined) return undefined
    if (item.root !== null && item.hash !== null && packageHash(item.root) !== item.hash) {
      quarantine.delete(plugin)
      writeJsonSync(quarantineFile(), [...quarantine.values()])
      ctx.logger.info(`widgets: ${plugin} left the quarantine: its files changed`)
      return undefined
    }
    return item
  }

  // ---- the store around the plugin body of each widget fiber ----
  // Cordis has no documented hook around a plugin body. The fiber runner `execute` runs the body on each load,
  // so the runtime wraps it (vendor/cordis/src/fiber.ts). A held plugin loads with no effect but the failed slugs.
  type Runner = { execute: (this: Fiber) => unknown }
  const wrapped = new WeakSet<Runner>()
  function wrap(fiber: Fiber): void {
    const plugin = widgetPlugin(fiber.runtime?.name)
    const runner = (fiber as unknown as { _runner?: Runner })._runner
    if (plugin === undefined || runner === undefined || wrapped.has(runner)) return
    wrapped.add(runner)
    const execute = runner.execute
    runner.execute = function (this: Fiber) {
      const item = held(plugin)
      if (item !== undefined) {
        ctx.logger.warn(`widgets: ${plugin} is quarantined: ${item.reason}`)
        return host.hold(item.slugs, plugin, item.reason)
      }
      return blameStore.run(plugin, () => execute.call(this))
    }
  }
  for (const runtime of ctx.registry.values()) for (const fiber of runtime.fibers) wrap(fiber)
  ctx.on('internal/plugin', wrap)

  // ---- the claimer ----
  function stackBlame(stack: string): string | undefined {
    if (stack === '') return undefined
    for (const [plugin, item] of known) {
      if (item.root === undefined) continue
      if (stack.includes(item.root + sep) || stack.includes(pathToFileURL(item.root).href + '/')) return plugin
    }
    return undefined
  }

  /** Write the crash record and exit at once. It does not return. */
  function claim(error: unknown, event: CrashRecord['event']): void {
    try {
      const info = errorInfo(error)
      const store = blameStore.getStore()
      const stack = store === undefined ? stackBlame(info.stack) : undefined
      const plugin = store ?? stack ?? null
      const item = plugin === null ? undefined : known.get(plugin)
      const root = item?.root ?? null
      const crash: CrashRecord = {
        plugin,
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
      process.stderr.write(`deepwidgets: ${event} blamed on ${plugin ?? 'no widget'} (${crash.method ?? 'none'}); the host exits now\n`)
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

  return {
    track(plugin, root, slug) {
      const item = known.get(plugin) ?? { root, slugs: new Set<string>() }
      item.root ??= root
      item.slugs.add(slug)
      known.set(plugin, item)
    },
    quarantined: () => [...quarantine.values()],
  }
}
