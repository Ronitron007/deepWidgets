/**
 * The widget runtime (`widget_mvp.runtime`). It provides the service `widgets`: the registry, the
 * storage domain `widgets`, the action contract, the change feed, and the `/api/widgets` routes.
 * @module @deepwidgets/widgets
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomUUID } from 'node:crypto'
import { Service } from '@deepseek-ai/cordis'
import Schema from '@deepseek-ai/schemastery'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import type { Domain, KvTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The widget runtime of `@deepwidgets/widgets`. */
    widgets: WidgetsService
  }
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/
const ACTION = /^[A-Za-z][A-Za-z0-9_]{0,62}$/
const DEFAULT_TIMEOUT_MS = 5_000
const CHANGE_LOG_SIZE = 1_000
const DEFAULT_REQUEST_TTL_MS = 10 * 60_000
const PING_MS = 15_000
const encoder = new TextEncoder()

/** The error codes of `widget_mvp.runtime.contract`, each with its HTTP status. */
export const WIDGET_ERROR_STATUS = {
  'unknown-widget': 404,
  'unknown-action': 404,
  'invalid-args': 422,
  'handler-error': 500,
  'timeout': 504,
  'busy': 503,
  'idempotency-conflict': 409,
  'conflict': 409,
  'bad-request': 400,
} as const

/** One error code of the action contract. */
export type WidgetErrorCode = keyof typeof WIDGET_ERROR_STATUS

/** A failure of the widget runtime. Routes map `status` to the HTTP status. */
export class WidgetError extends Error {
  readonly code: WidgetErrorCode
  readonly status: number
  /** True when the failed call had already written the state. */
  wrote = false

  constructor(code: WidgetErrorCode, message: string) {
    super(message)
    this.name = 'WidgetError'
    this.code = code
    this.status = WIDGET_ERROR_STATUS[code]
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

/** One item of `list()`. */
export interface WidgetSummary {
  slug: string
  title: string
  rev: number
  programRev: number
}

/** The answer of `call()`. */
export interface CallOutcome {
  result: unknown
  rev: number
  replayed?: true
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

const stateSchema = z.object({ rev: z.number().int().nonnegative(), data: z.unknown() }).strict()
const programSchema = z.object({ rev: z.number().int().nonnegative(), text: z.string(), updatedAt: z.number() }).strict()
const requestSchema = z.object({
  hash: z.string(),
  at: z.number(),
  outcome: z.union([
    z.object({ ok: z.literal(true), result: z.unknown(), rev: z.number() }).strict(),
    z.object({ ok: z.literal(false), code: z.enum(Object.keys(WIDGET_ERROR_STATUS) as [WidgetErrorCode, ...WidgetErrorCode[]]), message: z.string() }).strict(),
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
type StoredRequest = z.infer<typeof requestSchema>

/** A checked definition, as the runtime keeps it. */
interface Registration {
  slug: string
  title: string
  program: string
  initialState: unknown
  timeoutMs: number | undefined
  actions: Map<string, WidgetAction<unknown>>
}

/** The internal side of the service, made by `apply`. */
interface Runtime {
  add(registration: Registration): () => Promise<void>
  list(): WidgetSummary[]
  get(slug: string): { rev: number, data: unknown }
  call(slug: string, action: string, args: unknown, options: CallOptions): Promise<CallOutcome>
  update(slug: string, fn: (state: unknown) => unknown, by: string): Promise<unknown>
  setProgram(slug: string, text: string, by: string): Promise<{ rev: number }>
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
   * @throws {TypeError} when the definition is malformed.
   */
  register<S, const T extends readonly unknown[]>(def: WidgetDef<S, T>): () => Promise<void> {
    const registration = buildRegistration(def)
    const runtime = this.runtime
    return this.ctx.effect(() => runtime.add(registration), `widgets: ${registration.slug}`)
  }

  /** @returns `{ slug, title, rev, programRev }` for each live widget. */
  list(): WidgetSummary[] {
    return this.runtime.list()
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
}

/** State of one running call or write. */
interface Run {
  readonly signal: AbortSignal | undefined
  readonly by: string
  readonly action: string | undefined
  /** True for a query: it cannot write. */
  readonly query: boolean
  wrote: boolean
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
  if (error instanceof WidgetError) return json(error.status, { ok: false, error: { code: error.code, message: error.message } })
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

  ctx.effect(() => async () => {
    stopping = true
    for (const open of [...events]) open.close()
    // A job waits in the queue for at most its timeout and then runs for at most its timeout.
    // The bound only guards against a defect: each admitted promise settles before it.
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

  /** One durable state write. A write of a call that timed out is refused. */
  async function write(entry: Entry, fn: (state: unknown) => unknown, run: Run): Promise<unknown> {
    await entry.seeded
    const table = (await ready).table('state')
    if (run.signal?.aborted === true) throw new WidgetError('timeout', 'a write after the timeout was refused')
    let data: unknown
    const stored = await table.update(entry.slug, (current) => {
      // update() runs on the domain write chain; check the signal again at that slot.
      if (run.signal?.aborted === true) throw new WidgetError('timeout', 'a write after the timeout was refused')
      data = fn(current.data)
      if (data instanceof Promise) throw new TypeError('widgets: the update function must be synchronous')
      return { rev: current.rev + 1, data }
    })
    run.wrote = true
    logChange({ slug: entry.slug, kind: 'state', by: run.by, ...(run.action === undefined ? {} : { action: run.action }), rev: stored.rev })
    return data
  }

  /**
   * update() from a timer, a plugin, or a handler that calls `ctx.widgets.update`.
   * A write from a call that timed out is refused, whatever its slug. A write from a running
   * mutation of the same slug uses the slot of that mutation. Each other write waits in the queue.
   */
  function update(slug: string, fn: (state: unknown) => unknown, by: string): Promise<unknown> {
    const entry = liveEntry(slug)
    const current = slot.getStore()
    if (current?.run.signal?.aborted === true) return Promise.reject(new WidgetError('timeout', 'a write after the timeout was refused'))
    if (current?.slug === slug && !current.run.settled) {
      if (current.run.query) return Promise.reject(new WidgetError('handler-error', `the query ${String(current.run.action)} cannot write`))
      return write(entry, fn, current.run)
    }
    const run: Run = { signal: undefined, by, action: undefined, query: false, wrote: false, settled: false }
    return enqueue(entry, timeoutOf(entry), run, () => write(entry, fn, run))
  }

  // ---- calls ----
  /** Run one handler with its timeout. At the timeout, abort `w.signal` and reject with `timeout`. */
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
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        abort()
        reject(new WidgetError('timeout', `${entry.slug}.${action.name} took longer than ${String(timeoutMs)} ms`))
      }, timeoutMs)
    })
    try {
      return await Promise.race([Promise.resolve().then(() => action.handler(args, scope)), timeout])
    } catch (error) {
      if (error instanceof WidgetError) throw error
      ctx.logger.warn(`widgets: ${entry.slug}.${action.name} threw`, error)
      throw new WidgetError('handler-error', errorText(error))
    } finally {
      clearTimeout(timer)
    }
  }

  function runAction(entry: Entry, action: WidgetAction<unknown>, args: unknown, caller: string): Promise<CallOutcome> {
    const controller = new AbortController()
    const run = { signal: controller.signal, by: caller, action: action.name, query: action.kind === 'query', wrote: false, settled: false }
    const job = async (): Promise<CallOutcome> => {
      try {
        const result = await execute(entry, action, args, run, () => { controller.abort() })
        return { result: result ?? null, rev: stateOf(entry.slug)?.rev ?? 0 }
      } catch (error) {
        if (error instanceof WidgetError) error.wrote = run.wrote
        throw error
      } finally {
        run.settled = true
      }
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
    const promise = runOnce(entry, action, parsed, caller, requestId, key, hash)
    inflight.set(key, { hash, promise })
    try {
      return await promise
    } finally {
      inflight.delete(key)
    }
  }

  /** The stored outcome of an earlier run of the key, or one new run whose outcome is stored. */
  async function runOnce(entry: Entry, action: WidgetAction<unknown>, parsed: unknown, caller: string, requestId: string, key: string, hash: string): Promise<CallOutcome> {
    await entry.seeded
    const requests = (await ready).table('requests')
    const stored = requests.get(key)
    if (stored !== undefined && Date.now() - stored.at <= requestTtlMs) {
      if (stored.hash !== hash) throw new WidgetError('idempotency-conflict', `the requestId ${requestId} was used for a different call`)
      if (stored.outcome.ok) return { result: stored.outcome.result, rev: stored.outcome.rev, replayed: true }
      throw new WidgetError(stored.outcome.code, stored.outcome.message)
    }
    try {
      const outcome = await runAction(entry, action, parsed, caller)
      await remember(requests, key, { hash, at: Date.now(), outcome: { ok: true, result: outcome.result, rev: outcome.rev } })
      return outcome
    } catch (error) {
      // A call that wrote before it failed is kept, so a retry does not write again.
      // A call that wrote nothing (busy, or a timeout before any write) may run again.
      if (error instanceof WidgetError && error.wrote) {
        await remember(requests, key, { hash, at: Date.now(), outcome: { ok: false, code: error.code, message: error.message } })
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
    const rev = (table.get(slug)?.rev ?? 0) + 1
    await table.put(slug, { rev, text, updatedAt: Date.now() })
    logChange({ slug, kind: 'program', by, rev })
    return { rev }
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
        fetch: async () => {
          try {
            await entry.seeded
            const program = opened().table('program').get(slug)
            return json(200, { rev: program?.rev ?? 0, text: program?.text ?? entry.registration.program })
          } catch (error) {
            return failure(error)
          }
        },
      }),
      ctx.connection.fetch.register({
        path: `${base}/call`,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            const body = await readBody(request)
            if (body === null || typeof body !== 'object' || typeof (body as { action?: unknown }).action !== 'string') {
              throw new WidgetError('bad-request', 'the body must be { action, args, requestId? }')
            }
            const { action, args, requestId } = body as { action: string, args?: unknown, requestId?: unknown }
            if (requestId !== undefined && typeof requestId !== 'string') throw new WidgetError('bad-request', 'requestId must be a string')
            const out = await call(slug, action, args, { caller: 'user', ...(requestId === undefined ? {} : { requestId }) })
            return json(200, { ok: true, result: out.result, rev: out.rev, ...(out.replayed ? { replayed: true } : {}) })
          } catch (error) {
            return failure(error)
          }
        },
      }),
      ctx.connection.fetch.register({
        path: `${base}/stream`,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => {
          await entry.seeded.catch(() => undefined)
          return eventStream(request, entry.streams, () => ({
            type: 'hello',
            rev: stateOf(slug)?.rev ?? 0,
            programRev: domain?.table('program').get(slug)?.rev ?? 0,
          }))
        },
      }),
    ]
  }

  /** Write the seed records of a slug when storage has none. Stored records win. */
  async function seed(registration: Registration): Promise<void> {
    const store = await ready
    if (store.table('program').get(registration.slug) === undefined) {
      await store.table('program').put(registration.slug, { rev: 1, text: registration.program, updatedAt: Date.now() })
    }
    if (store.table('state').get(registration.slug) === undefined) {
      await store.table('state').put(registration.slug, { rev: 0, data: registration.initialState ?? null })
    }
  }

  function add(registration: Registration): () => Promise<void> {
    const { slug } = registration
    if (widgets.has(slug)) throw new WidgetError('conflict', `the slug ${slug} already has a live registration`)
    for (const action of registration.actions.values()) {
      longestTimeoutMs = Math.max(longestTimeoutMs, action.timeoutMs ?? registration.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    }
    const entry: Entry = {
      slug,
      registration,
      streams: new Set(),
      tail: Promise.resolve(),
      seeded: seed(registration),
      routes: [],
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
    }
  }
  const list = (): WidgetSummary[] => [...widgets.values()].map(summary)

  ctx.connection.fetch.register({
    path: '/api/widgets',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: () => Promise.resolve(json(200, { widgets: list() })),
  })

  ctx.connection.fetch.register({
    path: '/api/widgets/events',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: (request) => Promise.resolve(eventStream(request, events, () => ({ type: 'hello', slugs: [...widgets.keys()] }))),
  })

  // The service methods report each failure as a WidgetError, so the caller sees one form.
  new WidgetsService(ctx, {
    add,
    list,
    get: (slug) => {
      liveEntry(slug)
      return stateOf(slug) ?? { rev: 0, data: widgets.get(slug)?.registration.initialState ?? null }
    },
    call: (slug, action, args, options) => admit(() => call(slug, action, args, options)),
    update: (slug, fn, by) => admit(() => update(slug, fn, by)),
    setProgram: (slug, text, by) => admit(() => setProgram(slug, text, by)),
    changes,
    cursor,
  })
}
