/**
 * The widget runtime (`widget_mvp.runtime`). It provides the service `widgets`: the registry, the
 * storage domain `widgets`, the action contract, the change feed, and the `/api/widgets` routes.
 * @module @deepwidgets/widgets
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomUUID } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Service } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type { Context, Fiber, Plugin } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'
import { agentRow, callerRoot, createIsolation, runAs, runningRow, widgetRow } from './isolation.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The widget runtime of `@deepwidgets/widgets`. */
    widgets: WidgetsService
    /** The install records of the widget runtime (`widget_fv.install`). Only the installer uses them. */
    widgetRecords: WidgetRecordsService
  }
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/
const ACTION = /^[A-Za-z][A-Za-z0-9_]{0,62}$/
const DEFAULT_TIMEOUT_MS = 5_000
const CHANGE_LOG_SIZE = 1_000
const DEFAULT_REQUEST_TTL_MS = 10 * 60_000

/**
 * The Host environment key of safe mode (`widget_phase2.isolation.supervisor`). Electron main sets it
 * to `1` for a Host start after 2 crashes in 60 s.
 */
export const SAFE_MODE_ENV = 'DEEPWIDGETS_SAFE_MODE'

/**
 * The widget bundles that ship in this repository, by their package folder in the repository folder `deepwidgets/`.
 * In safe mode, only a row whose module file is in one of these folders can register a widget. Each other widget
 * is off for that Host start. The check uses the real path of the module that the Loader loaded, not the module
 * name: an installed bundle can take the package name of a built-in bundle.
 */
export const BUILT_IN_WIDGET_FOLDERS: readonly string[] = ['widget-sample']

/** This file is `deepwidgets/widgets/lib/index.js` (or `src/index.ts`), so `../..` is the repository folder `deepwidgets/`. */
const BUILT_IN_ROOTS = BUILT_IN_WIDGET_FOLDERS.map((folder) => join(realpathSync(fileURLToPath(new URL('../..', import.meta.url))), folder) + sep)

/** The part of a Loader entry that {@link builtInSlugs} reads. */
interface LoaderEntryView {
  readonly options: { readonly name?: unknown }
  readonly moduleNamespace?: unknown
  readonly parent?: { readonly tree?: { readonly ctx?: { readonly baseUrl?: string }, import?(name: string): Promise<unknown> } }
}

/** The part of the Loader service that {@link isBuiltInRow} and {@link builtInSlugs} read. */
interface LoaderView {
  readonly internal?: {
    readonly loadCache: {
      keys(): Iterable<string>
      get(url: string): { readonly module?: { getNamespace(): unknown } } | undefined
    }
    resolve?(specifier: string, parentURL: string, importAttributes: Record<string, string>): Promise<{ url: string }>
  }
  entries?(): Iterable<LoaderEntryView>
  unwrapExports(exports: unknown): unknown
}

/** @returns whether `url` is a file in a folder of {@link BUILT_IN_WIDGET_FOLDERS}, after links resolve. */
function isBuiltInFile(url: string): boolean {
  if (!url.startsWith('file:')) return false
  let path: string
  try {
    path = realpathSync(fileURLToPath(url))
  } catch {
    return false
  }
  return BUILT_IN_ROOTS.some((root) => path.startsWith(root))
}

/**
 * Find the modules of the Loader cache whose plugin is the plugin of `fiber`, as the hmr plugin finds loaded
 * modules (`EntryNamespaces.getModuleUrls`).
 * @returns true when `fiber` is a Loader row and each module that gives its plugin is a built-in file.
 */
function isBuiltInRow(ctx: Context, fiber: Fiber): boolean {
  const callback = fiber.runtime?.callback
  const loader = ctx.get('loader') as LoaderView | undefined
  const cache = loader?.internal?.loadCache
  if ((fiber as { entry?: unknown }).entry === undefined || callback === undefined || loader === undefined || cache === undefined) return false
  let found = false
  for (const url of cache.keys()) {
    let plugin: unknown
    try {
      plugin = loader.unwrapExports(cache.get(url)?.module?.getNamespace())
    } catch {
      // Node also caches modules that are not evaluated yet. Their namespace is not available.
      continue
    }
    if (plugin === undefined || plugin === null || ctx.registry.resolve(plugin as Plugin) !== callback) continue
    if (!isBuiltInFile(url)) return false
    found = true
  }
  return found
}
/**
 * widget_fv.install (`widget.builtin_slugs`): the slugs of the built-in widget rows, also of a row that is off.
 * A row is built in when its module file is in a folder of {@link BUILT_IN_WIDGET_FOLDERS}, as safe mode checks it.
 * The Loader config gives the module of each row, also of a row that is off. The module of a built-in bundle names its
 * slugs in the export `widgetSlugs`.
 */
async function builtInSlugs(ctx: Context): Promise<Set<string>> {
  const slugs = new Set<string>()
  const loader = ctx.get('loader') as LoaderView | undefined
  const internal = loader?.internal
  if (loader?.entries === undefined || internal?.resolve === undefined) return slugs
  for (const entry of loader.entries()) {
    const name = entry.options.name
    const tree = entry.parent?.tree
    const baseUrl = tree?.ctx?.baseUrl
    if (typeof name !== 'string' || name.startsWith('cordis:') || baseUrl === undefined) continue
    let url: string
    try {
      url = (await internal.resolve(name, baseUrl, {})).url
    } catch {
      // A module that does not resolve can not be a built-in bundle.
      continue
    }
    if (!isBuiltInFile(url)) continue
    const namespace = entry.moduleNamespace ?? await tree?.import?.(name)
    const declared = (loader.unwrapExports(namespace) as { widgetSlugs?: unknown } | undefined)?.widgetSlugs
    if (Array.isArray(declared)) for (const slug of declared) if (typeof slug === 'string') slugs.add(slug)
  }
  return slugs
}

const PING_MS = 15_000
const encoder = new TextEncoder()

/** The error codes of `widget_mvp.runtime.contract`, each with its HTTP status. */
export const WIDGET_ERROR_STATUS = {
  'unknown-widget': 404,
  'unknown-action': 404,
  'invalid-args': 422,
  'handler-error': 500,
  'timeout': 504,
  // widget_fv.action: the timeout fired after a write of the call landed. The error has the new rev.
  'timeout-after-write': 504,
  'busy': 503,
  'idempotency-conflict': 409,
  'conflict': 409,
  'bad-request': 400,
  'safe-mode': 503,
  // widget_phase2.isolation.blame: the widget crashed the host and is quarantined.
  'widget-failed': 503,
} as const

/** One error code of the action contract. */
export type WidgetErrorCode = keyof typeof WIDGET_ERROR_STATUS

/** A failure of the widget runtime. Routes map `status` to the HTTP status. */
export class WidgetError extends Error {
  readonly code: WidgetErrorCode
  readonly status: number
  /** True when the failed call had already written the state. */
  wrote = false
  /** The state revision after the call, for `timeout-after-write`. */
  rev: number | undefined

  constructor(code: WidgetErrorCode, message: string, rev?: number) {
    super(message)
    this.name = 'WidgetError'
    this.code = code
    this.status = WIDGET_ERROR_STATUS[code]
    this.rev = rev
  }
}

/** What a handler gets as `w`. */
export interface WidgetScope<S> {
  /** The current state, read from memory. */
  readonly state: S
  /** Write the state with a synchronous transform. Refused after the call timed out. */
  update(fn: (state: S) => S): Promise<S>
  /** Aborted at the timeout of the call. */
  readonly signal: AbortSignal
}

/** One action of a widget. `args` is checked before the queue. */
export interface WidgetAction<S, A = unknown> {
  name: string
  kind: 'query' | 'mutation'
  args?: z.ZodType<A>
  timeoutMs?: number
  handler(args: A, w: WidgetScope<S>): unknown
}

/** A widget definition for `ctx.widgets.register`. */
export interface WidgetDef<S, T extends readonly unknown[] = readonly unknown[]> {
  slug: string
  title: string
  /** The seed OpenUI Lang text. A stored program wins over it. */
  program: string
  initialState: S
  /** The timeout of each action without its own `timeoutMs`. */
  timeoutMs?: number
  actions: { readonly [K in keyof T]: WidgetAction<S, T[K]> }
}

/** One action in `describe()`. */
export interface WidgetActionDescription {
  name: string
  kind: 'query' | 'mutation'
  /** The JSON Schema of `args` (from `z.toJSONSchema`), or null when the action takes no args schema. */
  args: unknown
  /** The timeout that applies: the action value, else the widget value, else 5 s. */
  timeoutMs: number
}

/** The answer of `describe()`. */
export interface WidgetDescription extends WidgetSummary {
  actions: WidgetActionDescription[]
}

/** One item of `list()`. */
export interface WidgetSummary {
  slug: string
  title: string
  rev: number
  programRev: number
  /** Present only when the widget is off. A widget that is off has no routes and no window. */
  off?: { reason: 'safe-mode', message: string }
  /** Set when the widget is quarantined: the reason (`widget_phase2.isolation.blame`). It keeps its routes and window. */
  failed?: string
}

/** The answer of `call()`. */
export interface CallOutcome {
  result: unknown
  rev: number
  replayed?: true
  /**
   * widget_fv.action: the call wrote, and its host stopped before its answer was stored.
   * The retry does not run again, and `result` is null because the answer is not known.
   */
  resultLost?: true
}

/** Options of `call()`. */
export interface CallOptions {
  /** Who calls, for example `user` or an agent name. */
  caller: string
  /** With a request id, a retried mutation runs once (also after a host restart). */
  requestId?: string
}

/** One entry of the change feed. */
export interface WidgetChange {
  seq: number
  at: number
  slug: string
  kind: 'state' | 'program' | 'added' | 'removed'
  by: string
  action?: string
  rev?: number
}

/**
 * widget_fv.action: the request record of a mutation that wrote. It lands in the same write as
 * the state, so a crash can not separate them. The storage domain has no write that spans two tables.
 */
const writeMarkSchema = z.object({ hash: z.string(), at: z.number(), rev: z.number() }).strict()
const stateSchema = z.object({
  rev: z.number().int().nonnegative(),
  data: z.unknown(),
  /** The write marks of this slug by request key. A mark older than `requestTtlMs` is void. */
  requests: z.record(z.string(), writeMarkSchema).optional(),
}).strict()
/**
 * widget_fv.install: `seed` is the hash of the seed program that the record applies. It lands in the same write as the
 * text, so a crash can not separate them. A record of an older format has no `seed`.
 */
const programSchema = z.object({
  rev: z.number().int().nonnegative(),
  text: z.string(),
  updatedAt: z.number(),
  seed: z.string().optional(),
}).strict()
const requestSchema = z.object({
  hash: z.string(),
  at: z.number(),
  outcome: z.union([
    z.object({ ok: z.literal(true), result: z.unknown(), rev: z.number() }).strict(),
    z.object({ ok: z.literal(false), code: z.enum(Object.keys(WIDGET_ERROR_STATUS) as [WidgetErrorCode, ...WidgetErrorCode[]]), message: z.string(), rev: z.number().optional() }).strict(),
  ]),
}).strict()

/** The storage domain `widgets` (`widget_mvp.runtime.storage`). */
export const widgetsDomain = defineDomain({
  name: 'widgets',
  version: 1,
  tables: {
    state: domainTable(stateSchema),
    program: domainTable(programSchema),
    requests: domainTable(requestSchema),
  },
})

type WidgetsDomain = Domain<typeof widgetsDomain>
/** The stored program record of a slug (`widget_fv.install`). */
export type ProgramRecord = z.infer<typeof programSchema>
type StoredRequest = z.infer<typeof requestSchema>
type WriteMark = z.infer<typeof writeMarkSchema>

/** A checked definition, as the runtime keeps it. */
interface Registration {
  slug: string
  title: string
  program: string
  initialState: unknown
  timeoutMs: number | undefined
  actions: Map<string, WidgetAction<unknown>>
  /** The widget row that registered it; its code runs in the blame store of that row. */
  row?: string
  /** True when the row is the row of an agent bundle, `deepwidgets-agent-<slug>`. */
  agent?: boolean
}

/** The hash of a seed program, as the program record keeps it. */
export const seedHash = (text: string): string => createHash('sha256').update(text).digest('hex')

/** The internal side of the service, made by `apply`. */
interface Runtime {
  /**
   * @param bundle - the module name of the Loader row that registers, when the caller has one.
   * @param builtIn - whether the code of that row is a built-in bundle. Safe mode calls it.
   */
  add(registration: Registration, bundle: string | undefined, builtIn: () => boolean): () => Promise<void>
  track(row: string, root: string | undefined, slug: string): void
  list(): WidgetSummary[]
  describe(slug: string): WidgetDescription
  get(slug: string): { rev: number, data: unknown }
  call(slug: string, action: string, args: unknown, options: CallOptions): Promise<CallOutcome>
  update(slug: string, fn: (state: unknown) => unknown, by: string): Promise<unknown>
  setProgram(slug: string, text: string, by: string): Promise<{ rev: number }>
  programRecord(slug: string): Promise<ProgramRecord | undefined>
  restoreProgram(slug: string, record: ProgramRecord | undefined, by: string): Promise<void>
  adoptSeed(slug: string, seed: string): Promise<void>
  clearOff(slug: string): void
  builtInSlug(slug: string): Promise<boolean>
  holdLift(slug: string): void
  settleLift(slug: string, ok: boolean): void
  changes(since: string | undefined): { cursor: string, changes: WidgetChange[], reset?: true }
  cursor(): string
}

/** Check a definition and build its action map. Throws `TypeError` on a programming error. */
function buildRegistration(def: WidgetDef<unknown>): Registration {
  if (typeof def.slug !== 'string' || !SLUG.test(def.slug)) throw new TypeError(`widgets: bad slug ${JSON.stringify(def.slug)}`)
  if (typeof def.title !== 'string' || def.title === '') throw new TypeError(`widgets: ${def.slug}: title is required`)
  if (typeof def.program !== 'string') throw new TypeError(`widgets: ${def.slug}: program text is required`)
  if (!Array.isArray(def.actions)) throw new TypeError(`widgets: ${def.slug}: actions must be an array`)
  if (def.timeoutMs !== undefined && !(Number.isFinite(def.timeoutMs) && def.timeoutMs > 0)) throw new TypeError(`widgets: ${def.slug}: timeoutMs must be positive`)
  const actions = new Map<string, WidgetAction<unknown>>()
  for (const action of def.actions as readonly WidgetAction<unknown>[]) {
    if (typeof action.name !== 'string' || !ACTION.test(action.name)) throw new TypeError(`widgets: ${def.slug}: bad action name ${JSON.stringify(action.name)}`)
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- register is the boundary for untyped widget code.
    if (action.kind !== 'query' && action.kind !== 'mutation') throw new TypeError(`widgets: ${def.slug}.${action.name}: kind must be query or mutation`)
    if (typeof action.handler !== 'function') throw new TypeError(`widgets: ${def.slug}.${action.name}: handler must be a function`)
    if (action.args !== undefined && typeof action.args.safeParse !== 'function') throw new TypeError(`widgets: ${def.slug}.${action.name}: args must be a zod schema`)
    if (action.timeoutMs !== undefined && !(Number.isFinite(action.timeoutMs) && action.timeoutMs > 0)) throw new TypeError(`widgets: ${def.slug}.${action.name}: timeoutMs must be positive`)
    if (actions.has(action.name)) throw new TypeError(`widgets: ${def.slug}: action ${action.name} repeats`)
    actions.set(action.name, action)
  }
  return { slug: def.slug, title: def.title, program: def.program, initialState: def.initialState, timeoutMs: def.timeoutMs, actions }
}

const hashOf = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const errorText = (error: unknown): string => error instanceof Error ? error.message : String(error)

/**
 * The service `widgets`. Each method reads `this.ctx` as the caller context, so a registration
 * belongs to the fiber that made it.
 */
export class WidgetsService extends Service {
  // A private field (#) does not work: the caller context reads the service through a proxy.
  private readonly runtime: Runtime

  constructor(ctx: Context, runtime: Runtime) {
    super(ctx, 'widgets')
    this.runtime = runtime
  }

  /**
   * Register one widget. The caller fiber owns the registration: it ends when the fiber ends.
   * Stored state and program stay in storage.
   * @param def - the widget definition.
   * @returns the disposer that ends the registration.
   * @throws {WidgetError} `conflict` when the slug has a live registration.
   * @throws {WidgetError} `safe-mode` in safe mode, when the module of the row is not in {@link BUILT_IN_WIDGET_FOLDERS}.
   * @throws {TypeError} when the definition is malformed.
   */
  register<S, const T extends readonly unknown[]>(def: WidgetDef<S, T>): () => Promise<void> {
    const registration = buildRegistration(def)
    const runtime = this.runtime
    // widget_phase2.isolation.blame: the Loader row is the blame key, and the caller package holds its files.
    const row = widgetRow(this.ctx.fiber)
    if (row !== undefined) {
      registration.row = row
      registration.agent = agentRow(this.ctx.fiber)
      runtime.track(row, callerRoot(), registration.slug)
    }
    // The Loader adds `entry` to the fiber of each row. A caller without a row is not built in.
    const fiber = this.ctx.fiber
    const bundle = (fiber as { entry?: { options: { name?: unknown } } }).entry?.options.name
    const builtIn = (): boolean => isBuiltInRow(this.ctx, fiber)
    return this.ctx.effect(() => runtime.add(registration, typeof bundle === 'string' ? bundle : undefined, builtIn), `widgets: ${registration.slug}`)
  }

  /** @returns `{ slug, title, rev, programRev }` for each live widget. */
  list(): WidgetSummary[] {
    return this.runtime.list()
  }

  /**
   * @param slug - a live widget.
   * @returns the summary of the widget and its actions, with the JSON Schema of each `args`.
   * @throws {WidgetError} `unknown-widget`.
   */
  describe(slug: string): WidgetDescription {
    return this.runtime.describe(slug)
  }

  /**
   * @param slug - a live widget.
   * @returns the state and its revision.
   * @throws {WidgetError} `unknown-widget`.
   */
  get(slug: string): { rev: number, data: unknown } {
    return this.runtime.get(slug)
  }

  /**
   * Run one action through the action contract.
   * @throws {WidgetError} with a code of {@link WIDGET_ERROR_STATUS}.
   */
  call(slug: string, action: string, args: unknown, options: CallOptions): Promise<CallOutcome> {
    return this.runtime.call(slug, action, args, options)
  }

  /**
   * Write the state from a timer or a plugin, in the mutation queue of the slug.
   * @returns the new state.
   * @throws {WidgetError} `unknown-widget` or `busy`.
   */
  update<S>(slug: string, fn: (state: S) => S, options: { by?: string } = {}): Promise<S> {
    const by = options.by ?? `plugin:${this.ctx.fiber.name}`
    return this.runtime.update(slug, fn as (state: unknown) => unknown, by) as Promise<S>
  }

  /**
   * Store new program text and send `program` to the streams of the slug.
   * @throws {WidgetError} `unknown-widget` or `bad-request`.
   */
  setProgram(slug: string, text: string, options: { by?: string } = {}): Promise<{ rev: number }> {
    return this.runtime.setProgram(slug, text, options.by ?? `plugin:${this.ctx.fiber.name}`)
  }

  /**
   * The change feed after a cursor of {@link cursor}. A cursor of another process gives `reset: true`.
   */
  changes(since: string | undefined): { cursor: string, changes: WidgetChange[], reset?: true } {
    return this.runtime.changes(since)
  }

  /** @returns a change-feed cursor for now. */
  cursor(): string {
    return this.runtime.cursor()
  }
}

/**
 * The service `widgetRecords` (`widget_fv.install`): the install records of the widget runtime. The installer of
 * `@deepwidgets/mcp` uses it. Widget code can not: each method throws when it runs in the store of a widget row.
 */
export class WidgetRecordsService extends Service {
  // A private field (#) does not work: the caller context reads the service through a proxy.
  private readonly runtime: Runtime

  constructor(ctx: Context, runtime: Runtime) {
    super(ctx, 'widgetRecords')
    this.runtime = runtime
  }

  /**
   * The stored program record of `slug`, also when the slug is not live. For a live slug, it waits
   * for the seed write of its registration.
   * @returns undefined when storage has no program for the slug.
   */
  programRecord(slug: string): Promise<ProgramRecord | undefined> {
    return guard(() => this.runtime.programRecord(slug))
  }

  /** Put back the program record that `programRecord` gave before an install, or delete it when that gave undefined. */
  restoreProgram(slug: string, record: ProgramRecord | undefined, options: { by?: string } = {}): Promise<void> {
    return guard(() => this.runtime.restoreProgram(slug, record, options.by ?? `plugin:${this.ctx.fiber.name}`))
  }

  /** Set the seed hash of a program record of an older format, which has none. The text stays. */
  adoptSeed(slug: string, seed: string): Promise<void> {
    return guard(() => this.runtime.adoptSeed(slug, seed))
  }

  /** Forget that safe mode turned the agent widget `slug` off in this Host start. Another off entry stays. */
  clearOff(slug: string): void {
    guard(() => { this.runtime.clearOff(slug) })
  }

  /** Whether `slug` is the slug of a built-in widget (`widget.builtin_slugs`), also when its row is off. */
  builtInSlug(slug: string): Promise<boolean> {
    return guard(() => this.runtime.builtInSlug(slug))
  }

  /** An install of `slug` starts: a load of other files of a quarantined row of the slug does not end the quarantine yet. */
  holdLift(slug: string): void {
    guard(() => { this.runtime.holdLift(slug) })
  }

  /** The install of `slug` ends. With `ok`, a quarantined row of the slug that loaded other files leaves the quarantine. */
  settleLift(slug: string, ok: boolean): void {
    guard(() => { this.runtime.settleLift(slug, ok) })
  }
}

/** Run `fn` only outside widget code. Widget code that reaches {@link WidgetRecordsService} gets an error. */
function guard<T>(fn: () => T): T {
  const row = runningRow()
  if (row !== undefined) throw new Error(`widgets: the widget row ${row} can not use the install records`)
  return fn()
}

/** One open server-sent event stream. */
interface OpenStream {
  send(frame: Uint8Array): void
  close(): void
}

/** One live widget. */
interface Entry {
  readonly slug: string
  registration: Registration
  readonly streams: Set<OpenStream>
  /** The tail of the FIFO mutation queue. */
  tail: Promise<unknown>
  /** Resolves when the stored records of the slug exist. */
  seeded: Promise<void>
  routes: (() => Promise<void>)[]
  /** Set for a quarantined widget: the reason. It has no actions and no seed. */
  failure?: string
}

/** State of one running call or write. */
interface Run {
  readonly signal: AbortSignal | undefined
  readonly by: string
  readonly action: string | undefined
  /** True for a query: it cannot write. */
  readonly query: boolean
  wrote: boolean
  /**
   * True after a write of the run passed the abort check at its storage slot (widget_fv.action).
   * From then on the timeout waits for the started writes and gives `timeout-after-write`.
   */
  committed: boolean
  /** The writes of the run that started. The queue slot frees only after each one settles. */
  readonly writes: Set<Promise<unknown>>
  /** The request key of an idempotent call. Each write of the run stores its mark in the state record. */
  readonly request?: { readonly key: string, readonly hash: string }
  /** True after the job left its queue slot. */
  settled: boolean
}

/** The async context of a job: the slug and the run that holds its queue slot. */
interface Slot {
  readonly slug: string
  readonly run: Run
}

const json = (status: number, body: unknown): Response => Response.json(body, { status })
const sseFrame = (message: unknown): Uint8Array => encoder.encode(`data: ${JSON.stringify(message)}\n\n`)

function failure(error: unknown): Response {
  if (error instanceof WidgetError) {
    return json(error.status, { ok: false, error: { code: error.code, message: error.message, ...(error.rev === undefined ? {} : { rev: error.rev }) } })
  }
  return json(500, { ok: false, error: { code: 'handler-error', message: errorText(error) } })
}

/** Open one server-sent event stream. `first` is the first frame. */
function eventStream(request: Request, streams: Set<OpenStream>, first: () => unknown): Response {
  let closed = false
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  const open: OpenStream = {
    send(frame) {
      try { controller?.enqueue(frame) } catch { /* the reader is gone; close() follows */ }
    },
    close() {
      if (closed) return
      closed = true
      streams.delete(open)
      clearInterval(timer)
      try { controller?.close() } catch { /* already closed */ }
    },
  }
  const body = new ReadableStream<Uint8Array>({
    start(started) {
      controller = started
      started.enqueue(encoder.encode('retry: 1000\n\n'))
      started.enqueue(sseFrame(first()))
      streams.add(open)
      if (request.signal.aborted) {
        open.close()
        return
      }
      request.signal.addEventListener('abort', () => { open.close() }, { once: true })
      timer = setInterval(() => { open.send(encoder.encode(': ping\n\n')) }, PING_MS)
    },
    cancel() {
      open.close()
    },
  })
  return new Response(body, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' } })
}

async function readBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new WidgetError('bad-request', 'the body is not JSON')
  }
}

export const name = 'deepwidgets-widgets'
export const inject = ['connection', 'storageDomain']

export interface Config {
  /** A `requests` record older than this is void. The checks set a short value. */
  requestTtlMs: number
}

export const Config: Schema<Config> = Schema.object({
  requestTtlMs: Schema.natural().default(DEFAULT_REQUEST_TTL_MS),
})

export function apply(ctx: Context, config: Config): void {
  const requestTtlMs = config.requestTtlMs
  const widgets = new Map<string, Entry>()
  const safeMode = process.env[SAFE_MODE_ENV] === '1'
  /** The widgets that safe mode refused in this Host start, by slug. `agent`: the row is an agent bundle. */
  const off = new Map<string, { title: string, message: string, agent: boolean }>()
  const events = new Set<OpenStream>()
  const slot = new AsyncLocalStorage<Slot>()
  const inflight = new Map<string, { hash: string, promise: Promise<CallOutcome> }>()
  let domain: WidgetsDomain | undefined

  const ready = ctx.storageDomain.open(widgetsDomain).then(async (opened) => {
    domain = opened
    const now = Date.now()
    const expired = [...opened.table('requests').entries()].filter(([, record]) => now - record.at > requestTtlMs).map(([key]) => key)
    if (expired.length > 0) await opened.table('requests').deleteMany(expired)
    return opened
  })
  ready.catch((error: unknown) => { ctx.logger.error('widgets: the storage domain did not open; each widget call fails', error) })

  // Each call, update, and setProgram that is admitted runs to its end before the domain closes.
  let stopping = false
  let longestTimeoutMs = DEFAULT_TIMEOUT_MS
  const running = new Set<Promise<unknown>>()
  function admit<T>(work: () => Promise<T>): Promise<T> {
    if (stopping) return Promise.reject(new WidgetError('busy', 'the widget runtime is stopping'))
    const promise = work()
    running.add(promise)
    const forget = (): void => { running.delete(promise) }
    promise.then(forget, forget)
    return promise
  }

  /**
   * Wrap a route handler in the admission gate. A request that arrives after the runtime began
   * to stop gets 503 `busy`, never a storage error. An admitted request runs to its answer before
   * the domain closes.
   */
  function guarded(handler: (request: Request) => Promise<Response>): (request: Request) => Promise<Response> {
    return (request) => admit(() => handler(request)).catch(failure)
  }

  ctx.effect(() => async () => {
    stopping = true
    for (const open of [...events]) open.close()
    // A job waits in the queue for at most its timeout. It runs for at most its timeout, plus the
    // time its started writes take to settle (widget_fv.action). A rename in progress on the disk
    // can not be stopped, so a slow disk can keep the drain past the bound by one write. The domain
    // close below still waits for that write on the domain write chain.
    const bound = 2 * longestTimeoutMs + 1_000
    let timer: ReturnType<typeof setTimeout> | undefined
    const drained = await Promise.race([
      Promise.allSettled([...running]).then(() => true),
      new Promise<false>((resolve) => { timer = setTimeout(() => { resolve(false) }, bound) }),
    ])
    clearTimeout(timer)
    if (!drained) ctx.logger.error(`widgets: ${String(running.size)} calls still ran after ${String(bound)} ms; the domain closes under them, and their writes fail`)
    const opened = await ready.catch(() => undefined)
    await opened?.close()
  }, 'widgets: drain the calls, then close the domain')

  // ---- change feed: cursor = epoch:seq, a new epoch for each process ----
  const epoch = randomUUID().slice(0, 8)
  const log: WidgetChange[] = []
  let seq = 0
  function logChange(change: Omit<WidgetChange, 'seq' | 'at'>): void {
    seq += 1
    log.push({ seq, at: Date.now(), ...change })
    if (log.length > CHANGE_LOG_SIZE) log.shift()
  }
  const cursor = (): string => `${epoch}:${String(seq)}`
  function changes(since: string | undefined): { cursor: string, changes: WidgetChange[], reset?: true } {
    const now = cursor()
    if (since === undefined || since === '') return { cursor: now, changes: [] }
    const [sinceEpoch, sinceText] = since.split(':')
    const sinceSeq = Number(sinceText)
    const oldest = log[0]?.seq ?? seq + 1
    if (sinceEpoch !== epoch || !Number.isInteger(sinceSeq) || sinceSeq > seq || sinceSeq + 1 < oldest) {
      return { cursor: now, changes: [], reset: true }
    }
    return { cursor: now, changes: log.filter((change) => change.seq > sinceSeq) }
  }

  // ---- push: every durable write reaches the streams through here ----
  function push(slug: string, message: unknown): void {
    const entry = widgets.get(slug)
    if (entry === undefined) return
    const frame = sseFrame(message)
    for (const open of [...entry.streams]) open.send(frame)
  }
  function pushEvent(message: unknown): void {
    const frame = sseFrame(message)
    for (const open of [...events]) open.send(frame)
  }
  ctx.on('domain/changed', (change) => {
    if (change.domain !== 'widgets' || change.operation !== 'put') return
    const rev = (change.value as { rev: number }).rev
    if (change.table === 'state') push(change.key, { type: 'data', rev })
    else if (change.table === 'program') push(change.key, { type: 'program', rev })
  })

  // ---- lookups ----
  function liveEntry(slug: string): Entry {
    const entry = widgets.get(slug)
    if (entry === undefined) throw new WidgetError('unknown-widget', `no widget ${JSON.stringify(slug)}`)
    if (entry.failure !== undefined) throw new WidgetError('widget-failed', `${slug} failed: ${entry.failure}`)
    return entry
  }
  function opened(): WidgetsDomain {
    if (domain === undefined) throw new Error('widgets: the storage domain is not open')
    return domain
  }
  const stateOf = (slug: string): { rev: number, data: unknown } | undefined => domain?.table('state').get(slug)
  const timeoutOf = (entry: Entry, action?: WidgetAction<unknown>): number =>
    action?.timeoutMs ?? entry.registration.timeoutMs ?? DEFAULT_TIMEOUT_MS

  // ---- the FIFO mutation queue of each slug ----
  /**
   * Run `job` in the queue of the slug. A job that waits longer than `waitMs` fails with `busy`
   * and does not run. The slot frees when `job` settles; `job` enforces its own run timeout.
   * `job` runs in the async context of `run`, so a write from inside the job finds its run.
   */
  function enqueue<T>(entry: Entry, waitMs: number, run: Run, job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let started = false
      let cancelled = false
      const waitTimer = setTimeout(() => {
        if (started) return
        cancelled = true
        reject(new WidgetError('busy', `${entry.slug}: waited ${String(waitMs)} ms behind other writes; it did not run`))
      }, waitMs)
      const turn = async (): Promise<void> => {
        clearTimeout(waitTimer)
        if (cancelled) return
        started = true
        try {
          resolve(await slot.run({ slug: entry.slug, run }, job))
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)))
        }
      }
      entry.tail = entry.tail.then(turn, turn)
    })
  }

  /** The write marks that are not older than `requestTtlMs`. */
  const liveMarks = (marks: Record<string, WriteMark> | undefined, now: number): Record<string, WriteMark> =>
    Object.fromEntries(Object.entries(marks ?? {}).filter(([, mark]) => now - mark.at <= requestTtlMs))

  /** The live write mark of a request key, from the state record of any slug. */
  function markOf(key: string): WriteMark | undefined {
    const now = Date.now()
    for (const [, record] of opened().table('state').entries()) {
      const mark = record.requests?.[key]
      if (mark !== undefined && now - mark.at <= requestTtlMs) return mark
    }
    return undefined
  }

  /** Wait until each started write of the run settled. A write that starts during the wait is waited for too. */
  async function settleWrites(run: Run): Promise<void> {
    for (let count = -1; count !== run.writes.size;) {
      count = run.writes.size
      await Promise.allSettled(run.writes)
    }
  }

  /**
   * One durable state write. A write of a call that timed out, or of a call that ended, is refused.
   * The run keeps the write, so its queue slot frees only after the write settles (widget_fv.action).
   */
  function write(entry: Entry, fn: (state: unknown) => unknown, run: Run): Promise<unknown> {
    if (run.signal?.aborted === true) return Promise.reject(new WidgetError('timeout', 'a write after the timeout was refused'))
    if (run.settled) return Promise.reject(new WidgetError('handler-error', 'a write after the call ended was refused'))
    const pending = writeNow(entry, fn, run)
    run.writes.add(pending)
    return pending
  }

  async function writeNow(entry: Entry, fn: (state: unknown) => unknown, run: Run): Promise<unknown> {
    await entry.seeded
    const table = (await ready).table('state')
    if (run.signal?.aborted === true) throw new WidgetError('timeout', 'a write after the timeout was refused')
    let data: unknown
    const stored = await table.update(entry.slug, (current) => {
      // update() runs on the domain write chain; check the signal again at that slot.
      if (run.signal?.aborted === true) throw new WidgetError('timeout', 'a write after the timeout was refused')
      data = fn(current.data)
      if (data instanceof Promise) throw new TypeError('widgets: the update function must be synchronous')
      // widget_fv.action: the commit point. The run timer reads `committed` on the same thread,
      // so a write that passes here lands, and its call gives `timeout-after-write`, not `timeout`.
      run.committed = true
      const rev = current.rev + 1
      const now = Date.now()
      const requests = liveMarks(current.requests, now)
      // The request record lands in this write, with the state (widget_fv.action).
      if (run.request !== undefined) requests[run.request.key] = { hash: run.request.hash, at: now, rev }
      return Object.keys(requests).length === 0 ? { rev, data } : { rev, data, requests }
    })
    run.wrote = true
    logChange({ slug: entry.slug, kind: 'state', by: run.by, ...(run.action === undefined ? {} : { action: run.action }), rev: stored.rev })
    return data
  }

  /**
   * update() from a timer, a plugin, or a handler that calls `ctx.widgets.update`.
   * A write from a call that timed out is refused, whatever its slug. A write from a running
   * mutation of the same slug uses the slot of that mutation. Each other write waits in the queue.
   * By design, a write from the async context of a call that already answered (for example, a
   * timer that the handler started) is a new write, not a write of that call: it gets its own run
   * and waits in the queue (widget_fv.action).
   */
  function update(slug: string, fn: (state: unknown) => unknown, by: string): Promise<unknown> {
    const entry = liveEntry(slug)
    const current = slot.getStore()
    if (current?.run.signal?.aborted === true) return Promise.reject(new WidgetError('timeout', 'a write after the timeout was refused'))
    if (current?.slug === slug && !current.run.settled) {
      if (current.run.query) return Promise.reject(new WidgetError('handler-error', `the query ${String(current.run.action)} cannot write`))
      return write(entry, fn, current.run)
    }
    const run: Run = { signal: undefined, by, action: undefined, query: false, wrote: false, committed: false, writes: new Set(), settled: false }
    return enqueue(entry, timeoutOf(entry), run, () => write(entry, fn, run))
  }

  // ---- calls ----
  /**
   * Run one handler with its timeout (widget_fv.action). At the timeout, abort `w.signal`, so each
   * later write of the call is refused. A call with no committed write rejects with `timeout` at once.
   * A call with a committed write waits only for its started writes to settle. Then it rejects with
   * `timeout-after-write` and the new rev. It does not wait for the handler.
   */
  async function execute(entry: Entry, action: WidgetAction<unknown>, args: unknown, run: Run & { signal: AbortSignal }, abort: () => void): Promise<unknown> {
    const timeoutMs = timeoutOf(entry, action)
    const scope: WidgetScope<unknown> = {
      get state() { return stateOf(entry.slug)?.data },
      update: (fn) => {
        if (action.kind !== 'mutation') return Promise.reject(new WidgetError('handler-error', `the query ${action.name} cannot write`))
        return write(entry, fn, run)
      },
      signal: run.signal,
    }
    const late = `${entry.slug}.${action.name} took longer than ${String(timeoutMs)} ms`
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        abort()
        if (!run.committed) {
          reject(new WidgetError('timeout', late))
          return
        }
        void settleWrites(run).then(() => {
          // A committed write whose storage write failed wrote nothing: that call gives `timeout`.
          if (!run.wrote) reject(new WidgetError('timeout', late))
          else reject(new WidgetError('timeout-after-write', `${late}; its write landed at rev ${String(stateOf(entry.slug)?.rev ?? 0)}, and its later writes are refused`, stateOf(entry.slug)?.rev ?? 0))
        })
      }, timeoutMs)
    })
    // widget_phase2.isolation.blame: the handler runs in the blame store of its widget row.
    // After the timeout fired, the handler outcome does not count: the timeout answer wins.
    const handled = Promise.resolve().then(() => runAs(entry.registration.row, () => action.handler(args, scope))).then(
      (value) => (run.signal.aborted ? timeout : value),
      (error: unknown) => {
        if (run.signal.aborted) return timeout
        // widget_fv.action: a WidgetError from the handler, such as the error of a nested
        // ctx.widgets.call, is not an answer of this call. Its code and rev do not pass through.
        if (error instanceof WidgetError) throw new WidgetError('handler-error', `${error.code}: ${error.message}`)
        throw error instanceof Error ? error : new Error(String(error))
      },
    )
    try {
      return await Promise.race([handled, timeout])
    } catch (error) {
      if (error instanceof WidgetError) throw error
      ctx.logger.warn(`widgets: ${entry.slug}.${action.name} threw`, error)
      throw new WidgetError('handler-error', errorText(error))
    } finally {
      clearTimeout(timer)
    }
  }

  function runAction(entry: Entry, action: WidgetAction<unknown>, args: unknown, caller: string, request?: Run['request']): Promise<CallOutcome> {
    const controller = new AbortController()
    const run = {
      signal: controller.signal, by: caller, action: action.name, query: action.kind === 'query',
      wrote: false, committed: false, writes: new Set<Promise<unknown>>(), ...(request === undefined ? {} : { request }), settled: false,
    }
    const job = async (): Promise<CallOutcome> => {
      let ended: { ok: true, result: unknown } | { ok: false, error: unknown }
      try {
        ended = { ok: true, result: await execute(entry, action, args, run, () => { controller.abort() }) }
      } catch (error) {
        ended = { ok: false, error }
      }
      // widget_fv.action: the slot frees only after each write of the run settles.
      // A handler can start a write and not await it, so wait until no new write starts.
      await settleWrites(run)
      run.settled = true
      if (!ended.ok) {
        if (ended.error instanceof WidgetError) {
          ended.error.wrote = run.wrote
          // A failed call that wrote gives the rev of its own slug, and its request record keeps it.
          if (run.wrote) ended.error.rev ??= stateOf(entry.slug)?.rev ?? 0
        }
        throw ended.error
      }
      return { result: ended.result ?? null, rev: stateOf(entry.slug)?.rev ?? 0 }
    }
    // A query does not wait in the queue, but it runs in the async context of its run too.
    if (action.kind === 'query') return slot.run({ slug: entry.slug, run }, job)
    return enqueue(entry, timeoutOf(entry, action), run, job)
  }

  async function call(slug: string, name: string, args: unknown, { caller, requestId }: CallOptions): Promise<CallOutcome> {
    const entry = liveEntry(slug)
    const action = entry.registration.actions.get(name)
    if (action === undefined) throw new WidgetError('unknown-action', `the widget ${slug} has no action ${JSON.stringify(name)}`)
    let parsed: unknown = args ?? {}
    if (action.args !== undefined) {
      const checked = action.args.safeParse(parsed)
      if (!checked.success) throw new WidgetError('invalid-args', z.prettifyError(checked.error))
      parsed = checked.data
    }
    if (action.kind === 'query' || requestId === undefined) {
      await entry.seeded
      return runAction(entry, action, parsed, caller)
    }

    // Idempotent mutation: one real run for each (caller, requestId), kept in storage for `requestTtlMs`.
    // The in-flight entry is set before the first await, so parallel retries share one run.
    const key = hashOf([caller, requestId])
    const hash = hashOf([slug, name, parsed])
    const pending = inflight.get(key)
    if (pending !== undefined) {
      if (pending.hash !== hash) throw new WidgetError('idempotency-conflict', `the requestId ${requestId} was used for a different call`)
      return { ...(await pending.promise), replayed: true }
    }
    const promise = runOnce(entry, action, parsed, caller, requestId, { key, hash })
    inflight.set(key, { hash, promise })
    try {
      return await promise
    } finally {
      inflight.delete(key)
    }
  }

  /** The stored outcome of an earlier run of the key, or one new run whose outcome is stored. */
  async function runOnce(entry: Entry, action: WidgetAction<unknown>, parsed: unknown, caller: string, requestId: string, request: { key: string, hash: string }): Promise<CallOutcome> {
    const { key, hash } = request
    await entry.seeded
    const requests = (await ready).table('requests')
    const stored = requests.get(key)
    if (stored !== undefined && Date.now() - stored.at <= requestTtlMs) {
      if (stored.hash !== hash) throw new WidgetError('idempotency-conflict', `the requestId ${requestId} was used for a different call`)
      if (stored.outcome.ok) return { result: stored.outcome.result, rev: stored.outcome.rev, replayed: true }
      throw new WidgetError(stored.outcome.code, stored.outcome.message, stored.outcome.rev)
    }
    // widget_fv.action: a write mark with no outcome record. The call wrote, and its host stopped
    // before the outcome was stored. The call does not run again. Its result is not known.
    const mark = markOf(key)
    if (mark !== undefined) {
      if (mark.hash !== hash) throw new WidgetError('idempotency-conflict', `the requestId ${requestId} was used for a different call`)
      return { result: null, rev: mark.rev, replayed: true, resultLost: true }
    }
    try {
      const outcome = await runAction(entry, action, parsed, caller, request)
      await remember(requests, key, { hash, at: Date.now(), outcome: { ok: true, result: outcome.result, rev: outcome.rev } })
      return outcome
    } catch (error) {
      // A call that wrote before it failed is kept, so a retry does not write again.
      // A call that wrote nothing (busy, or a timeout before any write) may run again.
      if (error instanceof WidgetError && error.wrote) {
        await remember(requests, key, { hash, at: Date.now(), outcome: { ok: false, code: error.code, message: error.message, ...(error.rev === undefined ? {} : { rev: error.rev }) } })
      }
      throw error
    }
  }

  /** Store the outcome of an idempotent call, and drop the records older than `requestTtlMs`. */
  async function remember(requests: KvTable<string, StoredRequest>, key: string, record: StoredRequest): Promise<void> {
    const now = Date.now()
    const expired = [...requests.entries()].filter(([, old]) => now - old.at > requestTtlMs).map(([old]) => old)
    if (expired.length > 0) await requests.deleteMany(expired)
    await requests.put(key, record)
  }

  // ---- program ----
  async function setProgram(slug: string, text: string, by: string): Promise<{ rev: number }> {
    const entry = liveEntry(slug)
    if (typeof text !== 'string' || text.trim() === '') throw new WidgetError('bad-request', 'the program text must be a non-empty string')
    await entry.seeded
    const table = (await ready).table('program')
    // widget_fv.install: an edit keeps the seed hash, so a reinstall of the same seed keeps the edit. The update reads
    // the record at its slot, so a seed hash that lands at the same time stays.
    const next = table.get(slug) === undefined
      ? await table.put(slug, { rev: 1, text, updatedAt: Date.now() }).then(() => ({ rev: 1 }))
      : await table.update(slug, (old) => ({ rev: old.rev + 1, text, updatedAt: Date.now(), ...(old.seed === undefined ? {} : { seed: old.seed }) }))
    logChange({ slug, kind: 'program', by, rev: next.rev })
    return { rev: next.rev }
  }

  async function programRecord(slug: string): Promise<ProgramRecord | undefined> {
    const store = await ready
    // A live slug can still have its seed write in flight. A failed seed is logged in add().
    await widgets.get(slug)?.seeded.catch(() => undefined)
    return store.table('program').get(slug)
  }

  async function restoreProgram(slug: string, record: ProgramRecord | undefined, by: string): Promise<void> {
    const table = (await ready).table('program')
    await widgets.get(slug)?.seeded.catch(() => undefined)
    const now = table.get(slug)
    if (now === record) return
    if (record === undefined) await table.delete(slug)
    else await table.put(slug, record)
    logChange({ slug, kind: 'program', by, rev: record?.rev ?? 0 })
  }

  async function adoptSeed(slug: string, seed: string): Promise<void> {
    const table = (await ready).table('program')
    if (table.get(slug)?.seed !== undefined || table.get(slug) === undefined) return
    await table.update(slug, (current) => current.seed === undefined ? { ...current, seed } : current)
  }

  // ---- routes: one set for each live slug ----
  function addRoutes(entry: Entry): (() => Promise<void>)[] {
    const { slug } = entry
    const base = `/api/widgets/${slug}`
    return [
      ctx.connection.fetch.register({
        path: `${base}/program`,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: guarded(async () => {
          try {
            if (entry.failure !== undefined) throw new WidgetError('widget-failed', `${slug} failed: ${entry.failure}`)
            await entry.seeded
            const program = opened().table('program').get(slug)
            return json(200, { rev: program?.rev ?? 0, text: program?.text ?? entry.registration.program })
          } catch (error) {
            return failure(error)
          }
        }),
      }),
      ctx.connection.fetch.register({
        path: `${base}/call`,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: guarded(async (request) => {
          try {
            const body = await readBody(request)
            if (body === null || typeof body !== 'object' || typeof (body as { action?: unknown }).action !== 'string') {
              throw new WidgetError('bad-request', 'the body must be { action, args, requestId? }')
            }
            const { action, args, requestId } = body as { action: string, args?: unknown, requestId?: unknown }
            if (requestId !== undefined && typeof requestId !== 'string') throw new WidgetError('bad-request', 'requestId must be a string')
            const out = await call(slug, action, args, { caller: 'user', ...(requestId === undefined ? {} : { requestId }) })
            return json(200, { ok: true, result: out.result, rev: out.rev, ...(out.replayed ? { replayed: true } : {}), ...(out.resultLost ? { resultLost: true } : {}) })
          } catch (error) {
            return failure(error)
          }
        }),
      }),
      ctx.connection.fetch.register({
        path: `${base}/stream`,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: guarded(async (request) => {
          await entry.seeded.catch(() => undefined)
          return eventStream(request, entry.streams, () => ({
            type: 'hello',
            rev: stateOf(slug)?.rev ?? 0,
            // A failed widget says -1, so the page loads the program again when the widget comes back.
            programRev: entry.failure === undefined ? domain?.table('program').get(slug)?.rev ?? 0 : -1,
          }))
        }),
      }),
    ]
  }

  /**
   * Write the seed records of a slug when storage has none. Stored records win, with one exception
   * (`widget_fv.install`): the load of an agent bundle whose seed hash differs from the hash in the program record
   * sets the new seed. The text and its hash land in one write, so a crash can not leave the program of an older seed
   * under the hash of the new seed. A record without a hash stays: `widget_install` gives it one. Only an agent row
   * writes the hash, so the record of a built-in widget has none.
   */
  async function seed(registration: Registration): Promise<void> {
    const store = await ready
    const program = store.table('program').get(registration.slug)
    const hash = seedHash(registration.program)
    if (program === undefined) {
      await store.table('program').put(registration.slug, { rev: 1, text: registration.program, updatedAt: Date.now(), ...(registration.agent === true ? { seed: hash } : {}) })
    } else if (registration.agent === true && program.seed !== undefined && program.seed !== hash) {
      const rev = program.rev + 1
      await store.table('program').put(registration.slug, { rev, text: registration.program, updatedAt: Date.now(), seed: hash })
      logChange({ slug: registration.slug, kind: 'program', by: 'seed', rev })
    }
    const state = store.table('state').get(registration.slug)
    if (state === undefined) {
      await store.table('state').put(registration.slug, { rev: 0, data: registration.initialState ?? null })
    } else if (state.requests !== undefined) {
      // widget_fv.action: drop the expired write marks of an idle slug when it starts. The rev stays.
      const requests = liveMarks(state.requests, Date.now())
      if (Object.keys(requests).length !== Object.keys(state.requests).length) {
        await store.table('state').put(registration.slug, Object.keys(requests).length === 0 ? { rev: state.rev, data: state.data } : { rev: state.rev, data: state.data, requests })
      }
    }
  }

  /** @param failure - set for a quarantined widget: its failed entry runs no widget code, so safe mode lets it show. */
  function add(registration: Registration, bundle: string | undefined, builtIn: () => boolean, failure?: string): () => Promise<void> {
    const { slug } = registration
    if (failure === undefined && safeMode && !builtIn()) {
      const message = `safe mode: the widget ${slug} of ${bundle ?? 'an unknown bundle'} is off for this Host start; only built-in widgets run`
      off.set(slug, { title: registration.title, message, agent: registration.agent === true })
      ctx.logger.warn(`widgets: ${message}`)
      throw new WidgetError('safe-mode', message)
    }
    if (widgets.has(slug)) throw new WidgetError('conflict', `the slug ${slug} already has a live registration`)
    for (const action of registration.actions.values()) {
      longestTimeoutMs = Math.max(longestTimeoutMs, action.timeoutMs ?? registration.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    }
    const entry: Entry = {
      slug,
      registration,
      streams: new Set(),
      tail: Promise.resolve(),
      seeded: failure === undefined ? seed(registration) : Promise.resolve(),
      routes: [],
      ...(failure === undefined ? {} : { failure }),
    }
    entry.seeded.catch((error: unknown) => { ctx.logger.error(`widgets: the seed of ${slug} failed; its calls fail`, error) })
    widgets.set(slug, entry)
    entry.routes = addRoutes(entry)
    logChange({ slug, kind: 'added', by: 'host' })
    pushEvent({ type: 'added', slug })

    return async () => {
      if (widgets.get(slug) !== entry) return
      widgets.delete(slug)
      const frame = sseFrame({ type: 'removed' })
      for (const open of [...entry.streams]) {
        open.send(frame)
        open.close()
      }
      for (const dispose of entry.routes) await dispose()
      logChange({ slug, kind: 'removed', by: 'host' })
      pushEvent({ type: 'removed', slug })
    }
  }

  function summary(entry: Entry): WidgetSummary {
    return {
      slug: entry.slug,
      title: entry.registration.title,
      rev: stateOf(entry.slug)?.rev ?? 0,
      programRev: domain?.table('program').get(entry.slug)?.rev ?? 0,
      ...(entry.failure === undefined ? {} : { failed: entry.failure }),
    }
  }
  function offSummary(slug: string, item: { title: string, message: string }): WidgetSummary {
    return {
      slug,
      title: item.title,
      rev: stateOf(slug)?.rev ?? 0,
      programRev: domain?.table('program').get(slug)?.rev ?? 0,
      off: { reason: 'safe-mode', message: item.message },
    }
  }
  const list = (): WidgetSummary[] => [
    ...[...widgets.values()].map(summary),
    ...[...off].filter(([slug]) => !widgets.has(slug)).map(([slug, item]) => offSummary(slug, item)),
  ]
  function describe(slug: string): WidgetDescription {
    const refused = off.get(slug)
    if (refused !== undefined && !widgets.has(slug)) return { ...offSummary(slug, refused), actions: [] }
    const entry = liveEntry(slug)
    return {
      ...summary(entry),
      actions: [...entry.registration.actions.values()].map((action) => ({
        name: action.name,
        kind: action.kind,
        args: action.args === undefined ? null : z.toJSONSchema(action.args),
        timeoutMs: timeoutOf(entry, action),
      })),
    }
  }

  ctx.connection.fetch.register({
    path: '/api/widgets',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: guarded(() => Promise.resolve(json(200, { widgets: list() }))),
  })

  ctx.connection.fetch.register({
    path: '/api/widgets/events',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: guarded((request) => Promise.resolve(eventStream(request, events, () => ({ type: 'hello', slugs: [...widgets.keys()] })))),
  })

  // widget_phase2.isolation.blame: a quarantined widget row loads as one failed entry for each of its slugs.
  const isolation = createIsolation(ctx, {
    hold(slugs, row, reason) {
      const disposers = slugs.filter((slug) => !widgets.has(slug)).map((slug) => add({
        slug, title: slug, program: '', initialState: null, timeoutMs: undefined, actions: new Map(), row,
      }, undefined, () => false, reason))
      return async () => { for (const dispose of disposers) await dispose() }
    },
  })

  // The service methods report each failure as a WidgetError, so the caller sees one form.
  const runtime: Runtime = {
    add: (registration, bundle, builtIn) => add(registration, bundle, builtIn),
    track: (row, root, slug) => { isolation.track(row, root, slug) },
    list,
    describe,
    get: (slug) => {
      liveEntry(slug)
      const state = stateOf(slug)
      return state === undefined ? { rev: 0, data: widgets.get(slug)?.registration.initialState ?? null } : { rev: state.rev, data: state.data }
    },
    call: (slug, action, args, options) => admit(() => call(slug, action, args, options)),
    update: (slug, fn, by) => admit(() => update(slug, fn, by)),
    setProgram: (slug, text, by) => admit(() => setProgram(slug, text, by)),
    programRecord,
    restoreProgram: (slug, record, by) => admit(() => restoreProgram(slug, record, by)),
    adoptSeed: (slug, seed) => admit(() => adoptSeed(slug, seed)),
    clearOff: (slug) => { if (off.get(slug)?.agent === true) off.delete(slug) },
    builtInSlug: async (slug) => (await builtInSlugs(ctx)).has(slug),
    holdLift: (slug) => { isolation.holdLift(slug) },
    settleLift: (slug, ok) => { isolation.settleLift(slug, ok) },
    changes,
    cursor,
  }
  new WidgetsService(ctx, runtime)
  new WidgetRecordsService(ctx, runtime)
}
