import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Service } from '@deepseek-ai/cordis'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { generateSystemPrompt } from '@openuidev/lang-core'
import { z } from 'zod'
import { crudActions, parseTable } from './crud.js'
import { CATALOG_ID, checkProgram } from './drift.js'

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/
const ACTION = /^[A-Za-z][A-Za-z0-9_]{0,62}$/
const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_QUOTA_BYTES = 256 * 1024
const CHANGE_LOG_SIZE = 1_000
const IDEMPOTENCY_TTL_MS = 10 * 60_000
const encoder = new TextEncoder()
const SELF = fileURLToPath(import.meta.url)
const CLAIMERS = Symbol.for('deepwidgets.failLoud.claimers')

const stateSchema = z.object({ rev: z.number().int().nonnegative(), data: z.unknown() }).strict()
const programSchema = z.object({ rev: z.number().int().nonnegative(), text: z.string(), updatedAt: z.number() }).strict()
const dataWidgetSchema = z.object({
  rev: z.number().int().positive(),
  title: z.string(),
  table: z.unknown(),
  program: z.string(),
  hash: z.string(),
  by: z.string(),
  updatedAt: z.number(),
}).strict()

/** One domain: per-slug state, per-slug program text, and agent-saved data widgets. */
export const widgetsDomain = defineDomain({
  name: 'widgets',
  version: 1,
  tables: {
    state: domainTable(stateSchema),
    program: domainTable(programSchema),
    data: domainTable(dataWidgetSchema),
  },
})

/** Error with a stable code; routes map it to an HTTP status, MCP to isError. */
export class WidgetError extends Error {
  constructor(code, message, status, details) {
    super(message)
    this.code = code
    this.status = status
    if (details !== undefined) this.details = details
  }
}

const json = (status, body) => Response.json(body, { status })

function failure(error) {
  if (error instanceof WidgetError) {
    return json(error.status, { ok: false, error: { code: error.code, message: error.message, ...(error.details === undefined ? {} : { details: error.details }) } })
  }
  return json(500, { ok: false, error: { code: 'handler-error', message: String(error?.message ?? error) } })
}

/** Validate a definition and build its action map. Throws TypeError. */
function buildRegistration(def) {
  if (def === null || typeof def !== 'object') throw new TypeError('widgets: definition must be an object')
  if (typeof def.slug !== 'string' || !SLUG.test(def.slug)) throw new TypeError(`widgets: bad slug ${JSON.stringify(def.slug)}`)
  if (typeof def.title !== 'string' || def.title === '') throw new TypeError(`widgets: ${def.slug}: title is required`)
  if (typeof def.program !== 'string') throw new TypeError(`widgets: ${def.slug}: program text is required`)
  let list = def.actions
  let initialState = def.initialState
  if (def.kind === 'crud') {
    if (def.actions !== undefined) throw new TypeError(`widgets: ${def.slug}: a crud widget takes table, not actions`)
    const crud = crudActions(def.table)
    list = crud.actions
    initialState = def.initialState ?? crud.initialState
  }
  if (!Array.isArray(list)) throw new TypeError(`widgets: ${def.slug}: actions must be an array`)
  const actions = new Map()
  for (const action of list) {
    if (typeof action?.name !== 'string' || !ACTION.test(action.name)) throw new TypeError(`widgets: ${def.slug}: bad action name ${JSON.stringify(action?.name)}`)
    if (action.kind !== 'query' && action.kind !== 'mutation') throw new TypeError(`widgets: ${def.slug}.${action.name}: kind must be query or mutation`)
    if (typeof action.handler !== 'function') throw new TypeError(`widgets: ${def.slug}.${action.name}: handler must be a function`)
    if (action.args !== undefined && typeof action.args?.safeParse !== 'function') throw new TypeError(`widgets: ${def.slug}.${action.name}: args must be a zod schema`)
    if (action.timeoutMs !== undefined && !(Number.isFinite(action.timeoutMs) && action.timeoutMs > 0)) throw new TypeError(`widgets: ${def.slug}.${action.name}: timeoutMs must be positive`)
    if (actions.has(action.name)) throw new TypeError(`widgets: ${def.slug}: action ${action.name} repeats`)
    actions.set(action.name, action)
  }
  const check = checkProgram(def.program, actions)
  return { def: { ...def, initialState }, actions, check }
}

function describeAction(action) {
  return {
    name: action.name,
    kind: action.kind,
    ...(action.description ? { description: action.description } : {}),
    args: action.args === undefined ? { type: 'object', properties: {} } : z.toJSONSchema(action.args),
  }
}

/** The source file of the plugin that called register(): first stack frame outside this runtime and Cordis. */
function callerFile() {
  const stack = String(new Error().stack).split('\n').slice(1)
  for (const line of stack) {
    const match = line.match(/\(?((?:file:\/\/)?\/[^():]+):\d+:\d+\)?\s*$/)
    if (!match) continue
    const file = match[1].startsWith('file://') ? fileURLToPath(match[1]) : match[1]
    if (file === SELF || file.includes('/vendor/cordis/') || file.includes('/node_modules/')) continue
    return file
  }
  return undefined
}

const hashOf = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)

/**
 * The `widgets` registry. Methods read `this.ctx` as the CALLER context (Cordis
 * service tracker), so a registration belongs to the plugin that made it.
 */
export class WidgetsService extends Service {
  constructor(ctx, root) {
    super(ctx, 'widgets')
    this.root = root
  }

  /**
   * Register one widget, owned by the caller fiber: when that plugin unloads,
   * the widget, its routes, and its open streams go away; stored state stays.
   * A slug that is already live from another owner waits as standby and takes
   * over when the live owner unloads (safe replace).
   * def: { slug, title, program, kind?: 'crud', table? | actions?, initialState?, timeoutMs?, quotaBytes? }
   * @returns disposer, with `.check` = the program check ({ ok, errors, drift }).
   */
  register(def) {
    const registration = buildRegistration(def)
    registration.owner = this.ctx
    registration.file = def.module ?? callerFile()
    registration.source = 'package'
    const root = this.root
    const dispose = this.ctx.effect(() => root.add(registration), `widgets: ${def.slug}`)
    dispose.check = registration.check
    return dispose
  }

  /** Slugs, titles, status, and action names of every widget. */
  list() { return this.root.list() }

  /** Full record of one widget for editing: program, actions, state, check, status. */
  inspect(slug) { return this.root.inspect(slug) }

  /** Current state of one widget (synchronous, from memory). */
  get(slug) { return this.root.read(slug) }

  /**
   * Write a widget's state from any plugin (timers included). Runs in the
   * widget's mutation queue, so it never interleaves with an action.
   */
  update(slug, fn, options = {}) { return this.root.update(slug, fn, { by: options.by ?? `plugin:${this.ctx.fiber?.name ?? 'host'}` }) }

  /** Run one action: { result, rev, replayed? }. Throws WidgetError. options: { caller, requestId } */
  call(slug, action, args, options = {}) { return this.root.call(slug, action, args, options) }

  /** Replace the program text after a check against the declared actions; pushes {type:"program"}. */
  setProgram(slug, text, options = {}) { return this.root.setProgram(slug, text, options) }

  /** Create or replace an agent-saved CRUD data widget (validated first; no code). */
  save(record, options = {}) { return this.root.save(record, options) }

  /** Remove an agent-saved data widget (its state stays in storage). */
  removeData(slug, options = {}) { return this.root.removeData(slug, options) }

  /** Changes after a cursor; `excludeCaller` hides the caller's own changes. */
  changes(since, options = {}) { return this.root.changes(since, options) }

  /** A change-feed cursor for "now". */
  cursor() { return this.root.cursor() }

  /** The create-mode guide: catalog prompt plus the widget's actions as tools. */
  guide(slug) { return this.root.guide(slug) }
}

export const name = 'deepwidgets-widgets'
export const inject = ['connection', 'storageDomain']

export function apply(ctx, config = {}) {
  const quotaDefault = config.stateQuotaBytes ?? DEFAULT_QUOTA_BYTES
  const widgets = new Map()
  const slot = new AsyncLocalStorage()
  let domain
  const ready = ctx.storageDomain.open(widgetsDomain).then((opened) => {
    domain = opened
    return opened
  })
  ready.catch((error) => ctx.logger.error('widgets: storage open failed', error))

  ctx.effect(() => async () => {
    for (const entry of widgets.values()) entry.closeStreams('removed')
    const opened = await ready.catch(() => undefined)
    await opened?.close()
  }, 'widgets: close domain')

  // ---- change log (cursor = epoch:seq; a new epoch per process) -------------
  const epoch = randomUUID().slice(0, 8)
  const log = []
  let seq = 0
  function logChange(change) {
    log.push({ seq: ++seq, at: Date.now(), ...change })
    if (log.length > CHANGE_LOG_SIZE) log.shift()
  }
  const cursor = () => `${epoch}:${seq}`
  function changes(since, { excludeCaller } = {}) {
    const now = cursor()
    if (since === undefined || since === null || since === '') return { cursor: now, changes: [] }
    const [sinceEpoch, sinceText] = String(since).split(':')
    const sinceSeq = Number(sinceText)
    const oldest = log[0]?.seq ?? seq + 1
    if (sinceEpoch !== epoch || !Number.isInteger(sinceSeq) || sinceSeq > seq || sinceSeq + 1 < oldest) {
      return { cursor: now, changes: [], reset: true }
    }
    return { cursor: now, changes: log.filter((c) => c.seq > sinceSeq && c.by !== excludeCaller) }
  }

  // ---- push -----------------------------------------------------------------
  function push(slug, message) {
    const entry = widgets.get(slug)
    if (entry === undefined) return
    const frame = encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
    for (const open of [...entry.streams]) open.send(frame)
  }

  // Every durable write, whoever made it, reaches the streams through here.
  ctx.on('domain/changed', (change) => {
    if (change.domain !== 'widgets') return
    if (change.table === 'state') push(change.key, { type: 'data', slug: change.key, rev: change.value?.rev ?? null })
    else if (change.table === 'program') push(change.key, { type: 'program', slug: change.key, rev: change.value?.rev ?? null })
  })

  // ---- lookups ----------------------------------------------------------------
  const stateOf = (slug) => domain?.table('state').get(slug)
  function liveEntry(slug) {
    const entry = widgets.get(slug)
    if (entry === undefined) throw new WidgetError('unknown-widget', `no widget ${slug}`, 404, { known: [...widgets.keys()].slice(0, 30) })
    if (entry.status === 'failed') throw new WidgetError('widget-failed', `widget ${slug} is quarantined: ${entry.failure?.message}`, 503)
    return entry
  }

  // ---- the per-slug mutation queue -------------------------------------------
  /**
   * Run `job` in the slug's FIFO queue. A job that waits longer than `waitMs`
   * for its turn fails `busy` and never runs. The slot frees when `job`
   * settles; `job` itself enforces the run timeout, so a hung handler holds
   * the slot no longer than its timeout.
   */
  function enqueue(entry, waitMs, job) {
    return new Promise((resolve, reject) => {
      let started = false
      let cancelled = false
      const waitTimer = setTimeout(() => {
        if (started) return
        cancelled = true
        reject(new WidgetError('busy', `${entry.slug}: waited ${waitMs} ms behind other writes; did not run`, 503))
      }, waitMs)
      const turn = async () => {
        clearTimeout(waitTimer)
        if (cancelled) return
        started = true
        try { resolve(await slot.run(entry.slug, job)) } catch (error) { reject(error) }
      }
      entry.tail = entry.tail.then(turn, turn)
    })
  }

  /** One durable state write. `run` carries the abort signal and who wrote. */
  async function write(entry, fn, run) {
    await entry.seeded
    const opened = await ready
    if (entry.status === 'failed') throw new WidgetError('widget-failed', `widget ${entry.slug} is quarantined`, 503)
    if (run.signal?.aborted) throw new WidgetError('timeout', 'write after timeout refused', 504)
    const quota = entry.registration.def.quotaBytes ?? quotaDefault
    let data
    const stored = await opened.table('state').update(entry.slug, (current) => {
      // update() runs on the domain write chain, so concurrent writers never interleave.
      if (run.signal?.aborted) throw new WidgetError('timeout', 'write after timeout refused', 504)
      data = fn(current.data)
      if (data !== null && typeof data?.then === 'function') throw new TypeError('widgets: update fn must be synchronous')
      const bytes = Buffer.byteLength(JSON.stringify(data ?? null))
      if (bytes > quota) throw new WidgetError('quota', `${entry.slug}: state would be ${bytes} bytes; quota is ${quota}`, 413, { bytes, quota })
      return { rev: current.rev + 1, data }
    })
    run.wrote = true
    logChange({ slug: entry.slug, kind: 'state', by: run.by, ...(run.action ? { action: run.action } : {}), rev: stored.rev })
    return data
  }

  /** update() from outside an action: queued, unless already inside this slug's slot. */
  async function update(slug, fn, { by }) {
    const entry = liveEntry(slug)
    if (slot.getStore() === slug) return write(entry, fn, { by })
    return enqueue(entry, entry.registration.def.timeoutMs ?? DEFAULT_TIMEOUT_MS, () => write(entry, fn, { by }))
  }

  // ---- calls --------------------------------------------------------------------
  const idempotency = new Map()

  function execute(entry, action, args, caller, timeoutMs) {
    const controller = new AbortController()
    const run = { signal: controller.signal, by: caller, action: action.name, wrote: false }
    const scope = {
      slug: entry.slug,
      caller,
      signal: controller.signal,
      get state() { return stateOf(entry.slug)?.data },
      update: (fn) => {
        if (action.kind !== 'mutation') throw new WidgetError('query-wrote', `query ${action.name} may not write`, 500)
        return write(entry, fn, run)
      },
    }
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new WidgetError('timeout', `${entry.slug}.${action.name} took longer than ${timeoutMs} ms`, 504, { partial: run.wrote }))
      }, timeoutMs)
    })
    const settled = (async () => {
      try {
        return await Promise.race([Promise.resolve().then(() => action.handler(args, scope)), timeout])
      } catch (error) {
        if (error instanceof WidgetError) throw error
        ctx.logger.warn(`widgets: ${entry.slug}.${action.name} threw`, error)
        throw new WidgetError('handler-error', String(error?.message ?? error), 500)
      } finally {
        clearTimeout(timer)
      }
    })()
    return { settled, run }
  }

  async function call(slug, name, args, { caller = 'host', requestId } = {}) {
    const entry = liveEntry(slug)
    const action = entry.registration.actions.get(name)
    if (action === undefined) throw new WidgetError('unknown-action', `widget ${slug} has no action ${JSON.stringify(name)}`, 404, { known: [...entry.registration.actions.keys()] })
    let parsed = args ?? {}
    if (action.args !== undefined) {
      const result = action.args.safeParse(parsed)
      if (!result.success) throw new WidgetError('invalid-args', z.prettifyError(result.error), 422, { schema: z.toJSONSchema(action.args) })
      parsed = result.data
    }
    await entry.seeded
    const timeoutMs = action.timeoutMs ?? entry.registration.def.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const outcome = (result) => ({ result: result ?? null, rev: stateOf(slug)?.rev ?? null })

    if (action.kind === 'query') return outcome(await execute(entry, action, parsed, caller, timeoutMs).settled)

    const runQueued = () => enqueue(entry, timeoutMs, () => {
      const { settled, run } = execute(entry, action, parsed, caller, timeoutMs)
      return settled.then(outcome, (error) => { error.wrote = run.wrote; throw error })
    })
    if (requestId === undefined) return runQueued()

    // Idempotent mutation: (caller, requestId) -> one real run.
    const now = Date.now()
    for (const [key, hit] of idempotency) if (now - hit.at > IDEMPOTENCY_TTL_MS) idempotency.delete(key)
    const key = `${caller}\u0000${requestId}`
    const hash = hashOf([slug, name, parsed])
    const hit = idempotency.get(key)
    if (hit !== undefined) {
      if (hit.hash !== hash) throw new WidgetError('idempotency-conflict', `requestId ${requestId} was used for a different call`, 409)
      return { ...(await hit.promise), replayed: true }
    }
    const promise = runQueued()
    idempotency.set(key, { hash, at: now, promise })
    // Nothing committed (busy, invalid, or timeout before any write): forget it, a retry may run.
    promise.catch((error) => { if (!error?.wrote) idempotency.delete(key) })
    return promise
  }

  // ---- program --------------------------------------------------------------------
  async function setProgram(slug, text, { by = 'host', force = false } = {}) {
    const entry = liveEntry(slug)
    if (typeof text !== 'string' || text.trim() === '') throw new WidgetError('invalid-program', 'program text must be a non-empty string', 422)
    const check = checkProgram(text, entry.registration.actions)
    if (!check.ok && !force) throw new WidgetError('invalid-program', `program has ${check.errors.length} error(s) and ${check.drift.length} drift item(s)`, 422, { errors: check.errors, drift: check.drift })
    await entry.seeded
    const opened = await ready
    const current = opened.table('program').get(slug)
    const rev = (current?.rev ?? 0) + 1
    await opened.table('program').put(slug, { rev, text, updatedAt: Date.now() })
    entry.check = check
    logChange({ slug, kind: 'program', by, rev })
    return { rev, check }
  }

  // ---- streams ---------------------------------------------------------------------
  function openStream(entry, request) {
    let closed = false
    const open = {
      controller: undefined,
      timer: undefined,
      send(frame) {
        try { open.controller?.enqueue(frame) } catch { /* closed */ }
      },
      close() {
        if (closed) return
        closed = true
        entry.streams.delete(open)
        clearInterval(open.timer)
        try { open.controller?.close() } catch { /* closed */ }
      },
    }
    const body = new ReadableStream({
      start(controller) {
        open.controller = controller
        const state = stateOf(entry.slug)
        const program = domain?.table('program').get(entry.slug)
        controller.enqueue(encoder.encode(`retry: 1000\n\ndata: ${JSON.stringify({ type: 'hello', slug: entry.slug, rev: state?.rev ?? null, programRev: program?.rev ?? null })}\n\n`))
        entry.streams.add(open)
        if (request.signal.aborted) return open.close()
        request.signal.addEventListener('abort', () => open.close(), { once: true })
        open.timer = setInterval(() => open.send(encoder.encode(': ping\n\n')), 15_000)
      },
      cancel() { open.close() },
    })
    return new Response(body, {
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' },
    })
  }

  // ---- routes: registered once per slug, they read the live registration ------------
  function addRoutes(entry) {
    const slug = entry.slug
    const base = `/api/widgets/${slug}`
    return [
      ctx.connection.fetch.register({
        path: `${base}/program`,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            if (request.method === 'POST') {
              let body
              try { body = await request.json() } catch { throw new WidgetError('bad-request', 'body is not JSON', 400) }
              const { rev, check } = await setProgram(slug, body?.text, { by: 'user' })
              return json(200, { ok: true, rev, check })
            }
            liveEntry(slug)
            await entry.seeded
            const program = domain.table('program').get(slug)
            return json(200, {
              ok: true,
              slug,
              title: entry.registration.def.title,
              catalog: entry.registration.def.catalog ?? CATALOG_ID,
              rev: program?.rev ?? 1,
              program: program?.text ?? entry.registration.def.program,
              actions: [...entry.registration.actions.values()].map(describeAction),
            })
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
          let body
          try { body = await request.json() } catch { return failure(new WidgetError('bad-request', 'body is not JSON', 400)) }
          if (body === null || typeof body !== 'object' || typeof body.action !== 'string') {
            return failure(new WidgetError('bad-request', 'body must be {action, args, requestId?}', 400))
          }
          try {
            const out = await call(slug, body.action, body.args, { caller: 'user', requestId: typeof body.requestId === 'string' ? body.requestId : undefined })
            return json(200, { ok: true, ...out })
          } catch (error) {
            return failure(error)
          }
        },
      }),
      ctx.connection.fetch.register({
        path: `${base}/stream`,
        methods: ['GET'],
        requestBody: 'buffered',
        fetch: async (request) => { await entry.seeded.catch(() => {}); return openStream(entry, request) },
      }),
    ]
  }

  function seed(entry) {
    const { slug } = entry
    const def = entry.registration.def
    // Stored values win over package defaults. Every route and write awaits this.
    entry.seeded = ready.then(async (opened) => {
      if (opened.table('program').get(slug) === undefined) {
        await opened.table('program').put(slug, { rev: 1, text: def.program, updatedAt: Date.now() })
      }
      if (opened.table('state').get(slug) === undefined) {
        await opened.table('state').put(slug, { rev: 0, data: def.initialState ?? null })
      }
      const stored = opened.table('program').get(slug)
      if (stored !== undefined && stored.text !== def.program) entry.check = checkProgram(stored.text, entry.registration.actions)
    })
    entry.seeded.catch((error) => ctx.logger.error(`widgets: seed ${slug} failed`, error))
  }

  function activate(entry, registration) {
    entry.registration = registration
    entry.check = registration.check
    entry.status = 'ok'
    entry.failure = undefined
    seed(entry)
    if (!registration.check.ok) {
      ctx.logger.warn(`widgets: ${entry.slug}: program check: ${JSON.stringify([...registration.check.errors, ...registration.check.drift].map((e) => e.message))}`)
    }
  }

  function add(registration) {
    const slug = registration.def.slug
    let entry = widgets.get(slug)
    if (entry !== undefined && entry.status !== 'failed' && entry.registration !== undefined) {
      // Safe replace: the new owner waits until the live one unloads.
      entry.standby.push(registration)
      logChange({ slug, kind: 'standby', by: 'host' })
      return () => {
        const index = entry.standby.indexOf(registration)
        if (index !== -1) entry.standby.splice(index, 1)
      }
    }
    if (entry === undefined) {
      entry = {
        slug,
        streams: new Set(),
        standby: [],
        tail: Promise.resolve(),
        routes: [],
        closeStreams(type, extra = {}) {
          const frame = encoder.encode(`data: ${JSON.stringify({ type, slug, ...extra })}\n\n`)
          for (const open of [...entry.streams]) {
            open.send(frame)
            open.close()
          }
        },
      }
      widgets.set(slug, entry)
    }
    activate(entry, registration)
    if (entry.routes.length === 0) entry.routes = addRoutes(entry)
    logChange({ slug, kind: 'added', by: registration.source === 'data' ? registration.by ?? 'host' : 'host' })

    return async () => {
      if (entry.registration !== registration) return
      const next = entry.standby.shift()
      if (next !== undefined && entry.status !== 'failed') {
        // Promote the standby in place: routes and open streams stay. A changed
        // package program replaces the stored one (a new version wins over edits).
        const programChanged = next.def.program !== registration.def.program
        activate(entry, next)
        if (programChanged) {
          await entry.seeded.catch(() => {})
          const opened = await ready
          const current = opened.table('program').get(slug)
          await opened.table('program').put(slug, { rev: (current?.rev ?? 0) + 1, text: next.def.program, updatedAt: Date.now() })
          entry.check = next.check
        }
        logChange({ slug, kind: 'replaced', by: 'host' })
        await entry.seeded.catch(() => {})
        push(slug, { type: 'program', slug, rev: domain?.table('program').get(slug)?.rev ?? null })
        return
      }
      entry.registration = undefined
      for (const dispose of entry.routes) await dispose()
      entry.routes = []
      if (entry.status === 'failed') return // keep the tombstone: list/inspect show why
      widgets.delete(slug)
      entry.closeStreams('removed')
      logChange({ slug, kind: 'removed', by: 'host' })
    }
  }

  // ---- data widgets (agent-saved CRUD, no code) ---------------------------------------
  const dataDisposers = new Map()
  function registerData(slug, record) {
    const registration = buildRegistration({ slug, title: record.title, kind: 'crud', table: record.table, program: record.program })
    registration.owner = ctx
    registration.source = 'data'
    registration.by = record.by
    const dispose = ctx.effect(() => add(registration), `widgets: data ${slug}`)
    dataDisposers.set(slug, dispose)
    return registration
  }

  // Data widgets come back after a restart.
  const dataLoaded = ready.then((opened) => {
    for (const [slug, record] of opened.table('data').entries()) {
      try { registerData(slug, record) } catch (error) { ctx.logger.error(`widgets: data widget ${slug} failed to load`, error) }
    }
  })
  dataLoaded.catch(() => {})

  /**
   * Create or replace a data widget. Everything is validated before anything
   * is written; on error nothing changes and the old version keeps serving.
   */
  async function save(record, { by = 'host' } = {}) {
    await dataLoaded
    if (record === null || typeof record !== 'object') throw new WidgetError('invalid-widget', 'record must be an object', 422)
    const { slug, title, table, program } = record
    let registration
    try {
      parseTable(table)
      registration = buildRegistration({ slug, title, kind: 'crud', table, program })
    } catch (error) {
      throw new WidgetError('invalid-widget', String(error?.message ?? error), 422)
    }
    if (!registration.check.ok) {
      throw new WidgetError('invalid-program', `program has ${registration.check.errors.length} error(s) and ${registration.check.drift.length} drift item(s)`, 422, { errors: registration.check.errors, drift: registration.check.drift, actions: [...registration.actions.values()].map((a) => `${a.name}:${a.kind}`) })
    }
    const existing = widgets.get(slug)
    if (existing?.registration !== undefined && existing.registration.source !== 'data') {
      throw new WidgetError('conflict', `slug ${slug} belongs to an installed widget package; pick another slug`, 409)
    }
    const opened = await ready
    const hash = hashOf([title, table, program])
    const stored = opened.table('data').get(slug)
    if (stored?.hash === hash && existing?.registration !== undefined) {
      return { slug, saved: false, unchanged: true, rev: stored.rev, check: registration.check }
    }
    const rev = (stored?.rev ?? 0) + 1
    const next = { rev, title, table, program, hash, by, updatedAt: Date.now() }
    if (existing?.registration === undefined) {
      await opened.table('data').put(slug, next)
      const live = registerData(slug, next)
      await widgets.get(slug).seeded
      if (opened.table('program').get(slug)?.text !== program) await opened.table('program').put(slug, { rev: (opened.table('program').get(slug)?.rev ?? 0) + 1, text: program, updatedAt: Date.now() })
      return { slug, saved: true, created: true, rev, check: live.check }
    }
    // Replace in place, between two mutations, so no call sees half a widget.
    await enqueue(existing, 10_000, async () => {
      await opened.table('data').put(slug, next)
      // Mutate the live registration (its disposer is keyed on the object).
      Object.assign(existing.registration, { def: registration.def, actions: registration.actions, check: registration.check, by })
      existing.check = registration.check
      const current = opened.table('program').get(slug)
      if (current?.text !== program) await opened.table('program').put(slug, { rev: (current?.rev ?? 0) + 1, text: program, updatedAt: Date.now() })
    })
    logChange({ slug, kind: 'replaced', by, rev })
    return { slug, saved: true, created: false, rev, check: registration.check }
  }

  async function removeData(slug, { by = 'host' } = {}) {
    await dataLoaded
    const opened = await ready
    if (opened.table('data').get(slug) === undefined) throw new WidgetError('unknown-widget', `no data widget ${slug}`, 404)
    await opened.table('data').delete(slug)
    await dataDisposers.get(slug)?.()
    dataDisposers.delete(slug)
    logChange({ slug, kind: 'removed', by })
    return { slug, removed: true }
  }

  // ---- fail-loud isolation (playground) ------------------------------------------------
  /**
   * Quarantine: mark failed, drop routes, end streams, unload the owning plugin.
   * State stays in storage. Another registration of the slug replaces the tombstone.
   */
  async function quarantine(entry, error, event) {
    if (entry.status === 'failed') return
    entry.status = 'failed'
    entry.failure = { message: String(error?.message ?? error), event, at: Date.now(), file: entry.registration?.file }
    ctx.logger.error(`widgets: quarantined ${entry.slug} after ${event}`, error)
    logChange({ slug: entry.slug, kind: 'failed', by: 'host' })
    entry.closeStreams('failed', { message: entry.failure.message })
    for (const dispose of entry.routes) await dispose()
    entry.routes = []
    const owner = entry.registration?.owner
    if (owner !== undefined && owner !== ctx) await owner.fiber.dispose().catch((reason) => ctx.logger.warn(`widgets: dispose ${entry.slug} owner failed`, reason))
  }

  /** Claim a process-level error whose stack points into one widget's source file. */
  function claim(error, event) {
    const stack = typeof error?.stack === 'string' ? error.stack : ''
    if (stack === '') return false
    for (const entry of widgets.values()) {
      const file = entry.registration?.file
      if (entry.status !== 'failed' && file !== undefined && stack.includes(file)) {
        void quarantine(entry, error, event)
        return true
      }
    }
    return false
  }
  ctx.effect(() => {
    const claimers = (globalThis[CLAIMERS] ??= new Set())
    claimers.add(claim)
    return () => { claimers.delete(claim) }
  }, 'widgets: fail-loud claimer')

  // ---- reads ---------------------------------------------------------------------------
  function summary(entry) {
    const registration = entry.registration
    return {
      slug: entry.slug,
      title: registration?.def.title ?? null,
      source: registration?.source ?? null,
      status: entry.status,
      ...(entry.failure ? { failure: entry.failure } : {}),
      ...(entry.standby.length ? { standby: entry.standby.length } : {}),
      checkOk: entry.check?.ok ?? null,
      actions: registration ? [...registration.actions.values()].map(describeAction) : [],
    }
  }

  function inspect(slug) {
    const entry = widgets.get(slug)
    if (entry === undefined) throw new WidgetError('unknown-widget', `no widget ${slug}`, 404, { known: [...widgets.keys()].slice(0, 30) })
    const program = domain?.table('program').get(slug)
    const state = stateOf(slug)
    const data = domain?.table('data').get(slug)
    return {
      ...summary(entry),
      catalog: entry.registration?.def.catalog ?? CATALOG_ID,
      program: program?.text ?? entry.registration?.def.program ?? null,
      programRev: program?.rev ?? null,
      state: state?.data ?? null,
      rev: state?.rev ?? null,
      ...(data ? { table: data.table, dataRev: data.rev } : {}),
      check: entry.check ?? null,
    }
  }

  const { spec, promptOptions } = JSON.parse(readFileSync(new URL('./catalog/spec.json', import.meta.url), 'utf8'))
  function guide(slug) {
    const tools = slug === undefined ? [] : [...liveEntry(slug).registration.actions.values()].map((action) => ({
      name: action.name,
      description: `${action.kind}${action.description ? `: ${action.description}` : ''}`,
      inputSchema: describeAction(action).args,
    }))
    return generateSystemPrompt({ library: spec, promptOptions: { ...promptOptions, tools } })
  }

  ctx.connection.fetch.register({
    path: '/api/widgets',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => json(200, { ok: true, widgets: [...widgets.values()].map(summary) }),
  })

  new WidgetsService(ctx, {
    add,
    list: () => [...widgets.values()].map(summary),
    inspect,
    read: (slug) => stateOf(slug)?.data,
    update,
    call,
    setProgram,
    save,
    removeData,
    changes,
    cursor,
    guide,
  })
}
