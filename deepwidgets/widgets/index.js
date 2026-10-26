import { Service } from '@deepseek-ai/cordis'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/
const ACTION = /^[A-Za-z][A-Za-z0-9_]{0,62}$/
const DEFAULT_TIMEOUT_MS = 5_000
const encoder = new TextEncoder()

const stateSchema = z.object({ rev: z.number().int().nonnegative(), data: z.unknown() }).strict()
const programSchema = z.object({ rev: z.number().int().nonnegative(), text: z.string(), updatedAt: z.number() }).strict()

/** One domain: per-slug state and per-slug program text. */
export const widgetsDomain = defineDomain({
  name: 'widgets',
  version: 1,
  tables: {
    state: domainTable(stateSchema),
    program: domainTable(programSchema),
  },
})

/** Error with a stable code; the /call route maps it to an HTTP status. */
export class WidgetError extends Error {
  constructor(code, message, status) {
    super(message)
    this.code = code
    this.status = status
  }
}

function json(status, body) {
  return Response.json(body, { status })
}

function failure(error) {
  if (error instanceof WidgetError) {
    return json(error.status, { ok: false, error: { code: error.code, message: error.message } })
  }
  return json(500, { ok: false, error: { code: 'handler-error', message: String(error?.message ?? error) } })
}

function checkDefinition(def) {
  if (def === null || typeof def !== 'object') throw new TypeError('widgets: definition must be an object')
  if (typeof def.slug !== 'string' || !SLUG.test(def.slug)) throw new TypeError(`widgets: bad slug ${JSON.stringify(def.slug)}`)
  if (typeof def.title !== 'string' || def.title === '') throw new TypeError(`widgets: ${def.slug}: title is required`)
  if (typeof def.program !== 'string') throw new TypeError(`widgets: ${def.slug}: program text is required`)
  if (!Array.isArray(def.actions)) throw new TypeError(`widgets: ${def.slug}: actions must be an array`)
  const actions = new Map()
  for (const action of def.actions) {
    if (typeof action?.name !== 'string' || !ACTION.test(action.name)) throw new TypeError(`widgets: ${def.slug}: bad action name ${JSON.stringify(action?.name)}`)
    if (action.kind !== 'query' && action.kind !== 'mutation') throw new TypeError(`widgets: ${def.slug}.${action.name}: kind must be query or mutation`)
    if (typeof action.handler !== 'function') throw new TypeError(`widgets: ${def.slug}.${action.name}: handler must be a function`)
    if (action.args !== undefined && typeof action.args?.safeParse !== 'function') throw new TypeError(`widgets: ${def.slug}.${action.name}: args must be a zod schema`)
    if (action.timeoutMs !== undefined && !(Number.isFinite(action.timeoutMs) && action.timeoutMs > 0)) throw new TypeError(`widgets: ${def.slug}.${action.name}: timeoutMs must be positive`)
    if (actions.has(action.name)) throw new TypeError(`widgets: ${def.slug}: action ${action.name} repeats`)
    actions.set(action.name, action)
  }
  return actions
}

function describeAction(action) {
  return {
    name: action.name,
    kind: action.kind,
    args: action.args === undefined ? { type: 'object', properties: {} } : z.toJSONSchema(action.args),
  }
}

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
   * Register one widget. Owned by the caller fiber: when that plugin unloads,
   * the widget, its routes, and its open streams go away. Stored state stays.
   * @returns disposer
   */
  register(def) {
    const actions = checkDefinition(def)
    const root = this.root
    return this.ctx.effect(() => root.add(def, actions), `widgets: ${def.slug}`)
  }

  /** Slugs and titles of every registered widget. */
  list() {
    return this.root.list()
  }

  /** Current state of one widget (synchronous, from memory). */
  get(slug) {
    return this.root.read(slug)
  }

  /** Write a widget's state from any plugin; pushes {type:"data"}. */
  update(slug, fn) {
    return this.root.write(slug, fn)
  }

  /** Run one action like POST /call does. Throws WidgetError. */
  call(slug, action, args) {
    return this.root.call(slug, action, args)
  }

  /** Replace the program text; pushes {type:"program"}. */
  setProgram(slug, text) {
    return this.root.setProgram(slug, text)
  }
}

export const name = 'deepwidgets-widgets'
export const inject = ['connection', 'storageDomain']

export function apply(ctx) {
  const widgets = new Map()
  let domain
  const ready = ctx.storageDomain.open(widgetsDomain).then((opened) => {
    domain = opened
    return opened
  })
  ready.catch((error) => ctx.logger.error('widgets: storage open failed', error))

  ctx.effect(() => async () => {
    for (const entry of widgets.values()) entry.closeStreams()
    const opened = await ready.catch(() => undefined)
    await opened?.close()
  }, 'widgets: close domain')

  function stateOf(slug) {
    return domain?.table('state').get(slug)
  }

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

  async function write(slug, fn, signal) {
    const entry = widgets.get(slug)
    if (entry === undefined) throw new WidgetError('unknown-widget', `no widget ${slug}`, 404)
    await entry.seeded
    const opened = await ready
    if (signal?.aborted) throw new WidgetError('timeout', 'write after timeout refused', 504)
    let result
    await opened.table('state').update(slug, (current) => {
      // update() runs on the domain write chain, so concurrent writers never interleave.
      if (signal?.aborted) throw new WidgetError('timeout', 'write after timeout refused', 504)
      result = fn(current.data)
      return { rev: current.rev + 1, data: result }
    })
    return result
  }

  async function call(slug, name, args) {
    const entry = widgets.get(slug)
    if (entry === undefined) throw new WidgetError('unknown-widget', `no widget ${slug}`, 404)
    const action = entry.actions.get(name)
    if (action === undefined) throw new WidgetError('unknown-action', `widget ${slug} has no action ${JSON.stringify(name)}`, 404)
    let parsed = args ?? {}
    if (action.args !== undefined) {
      const result = action.args.safeParse(parsed)
      if (!result.success) throw new WidgetError('invalid-args', z.prettifyError(result.error), 422)
      parsed = result.data
    }
    await entry.seeded
    const controller = new AbortController()
    const timeoutMs = action.timeoutMs ?? entry.def.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const scope = {
      slug,
      signal: controller.signal,
      get state() { return stateOf(slug)?.data },
      update: (fn) => {
        if (action.kind !== 'mutation') throw new WidgetError('query-wrote', `query ${name} may not write`, 500)
        return write(slug, fn, controller.signal)
      },
    }
    let timer
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new WidgetError('timeout', `${slug}.${name} took longer than ${timeoutMs} ms`, 504))
      }, timeoutMs)
    })
    try {
      return await Promise.race([Promise.resolve().then(() => action.handler(parsed, scope)), timeout])
    } catch (error) {
      if (error instanceof WidgetError) throw error
      ctx.logger.warn(`widgets: ${slug}.${name} threw`, error)
      throw new WidgetError('handler-error', String(error?.message ?? error), 500)
    } finally {
      clearTimeout(timer)
    }
  }

  async function setProgram(slug, text) {
    if (!widgets.has(slug)) throw new WidgetError('unknown-widget', `no widget ${slug}`, 404)
    if (typeof text !== 'string' || text.trim() === '') throw new WidgetError('invalid-program', 'program text must be a non-empty string', 422)
    await widgets.get(slug).seeded
    const opened = await ready
    const current = opened.table('program').get(slug)
    const rev = (current?.rev ?? 0) + 1
    await opened.table('program').put(slug, { rev, text, updatedAt: Date.now() })
    return rev
  }

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
        const state = stateOf(entry.def.slug)
        const program = domain?.table('program').get(entry.def.slug)
        controller.enqueue(encoder.encode(`retry: 1000\n\ndata: ${JSON.stringify({ type: 'hello', slug: entry.def.slug, rev: state?.rev ?? null, programRev: program?.rev ?? null })}\n\n`))
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

  function add(def, actions) {
    const slug = def.slug
    if (widgets.has(slug)) throw new Error(`widgets: slug ${slug} is already registered`)
    const entry = {
      def,
      actions,
      streams: new Set(),
      closeStreams() {
        const frame = encoder.encode(`data: ${JSON.stringify({ type: 'removed', slug })}\n\n`)
        for (const open of [...entry.streams]) {
          open.send(frame)
          open.close()
        }
      },
    }
    widgets.set(slug, entry)

    // Seed program and state once; stored values win over package defaults.
    // Every route and write awaits this, so no caller sees an unseeded widget.
    entry.seeded = ready.then(async (opened) => {
      if (widgets.get(slug) !== entry) return
      if (opened.table('program').get(slug) === undefined) {
        await opened.table('program').put(slug, { rev: 1, text: def.program, updatedAt: Date.now() })
      }
      if (opened.table('state').get(slug) === undefined) {
        await opened.table('state').put(slug, { rev: 0, data: def.initialState ?? null })
      }
    })
    entry.seeded.catch((error) => ctx.logger.error(`widgets: seed ${slug} failed`, error))

    const base = `/api/widgets/${slug}`
    const routes = [
      ctx.connection.fetch.register({
        path: `${base}/program`,
        methods: ['GET', 'POST'],
        requestBody: 'buffered',
        fetch: async (request) => {
          try {
            if (request.method === 'POST') {
              let body
              try { body = await request.json() } catch { throw new WidgetError('bad-request', 'body is not JSON', 400) }
              return json(200, { ok: true, rev: await setProgram(slug, body?.text) })
            }
            await entry.seeded
            const program = domain.table('program').get(slug)
            return json(200, {
              ok: true,
              slug,
              title: def.title,
              rev: program?.rev ?? 1,
              program: program?.text ?? def.program,
              actions: [...actions.values()].map(describeAction),
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
            return failure(new WidgetError('bad-request', 'body must be {action, args}', 400))
          }
          try {
            const result = await call(slug, body.action, body.args)
            return json(200, { ok: true, result: result ?? null, rev: stateOf(slug)?.rev ?? null })
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

    return async () => {
      widgets.delete(slug)
      entry.closeStreams()
      for (const dispose of routes) await dispose()
    }
  }

  function list() {
    return [...widgets.values()].map(({ def, actions }) => ({
      slug: def.slug,
      title: def.title,
      actions: [...actions.values()].map(describeAction),
    }))
  }

  ctx.connection.fetch.register({
    path: '/api/widgets',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => json(200, { ok: true, widgets: list() }),
  })

  new WidgetsService(ctx, {
    add,
    list,
    read: (slug) => stateOf(slug)?.data,
    write: (slug, fn) => write(slug, fn),
    call,
    setProgram,
  })
}
