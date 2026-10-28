/** Host half of the trace: it keeps the trace messages and serves them on `/api/trace` and `/trace`. */
import { readFileSync } from 'node:fs'
import type { Context, Fiber } from '@deepseek-ai/cordis'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Fields of one new trace message, before the host gives it a `seq`. */
interface MessageFields {
  time: number
  process: string
  window?: string | undefined
  kind: string
  name: string
  state: string | undefined
  detail?: string | undefined
  snapshot?: boolean | undefined
}

/** One trace message. `addMessage` writes the fields in the order of this type. */
interface TraceMessage {
  seq: number
  time: number
  process: string
  window?: string | undefined
  kind?: string
  name?: string
  state?: string | undefined
  detail?: string
  snapshot?: true
}

/** One item of a `POST /api/trace` body that `goodMessage` accepts. */
interface PostedMessage {
  time: number
  process: string
  window?: string
  kind: string
  name: string
  state: string
  detail?: string
  snapshot?: boolean
}

/** One open `GET /api/trace` stream. */
interface OpenStream {
  timer: NodeJS.Timeout | undefined
  controller: ReadableStreamDefaultController<Uint8Array> | undefined
  send(frame: Uint8Array): void
  close(): void
}

const STATES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']
const PAGE = readFileSync(new URL('../page.html', import.meta.url), 'utf8')
const encoder = new TextEncoder()

/** Services the trace needs. */
export const inject = ['webServer', 'connection', 'loader']

/**
 * Trace the host rows and services, and serve the trace routes for the lifetime of the plugin.
 * @param ctx - host plugin context carrying the web server, the connection, and the loader.
 */
export function apply(ctx: Context): void {
  const messages: TraceMessage[] = []
  const streams = new Set<OpenStream>()
  const seen = new WeakSet<Fiber>()
  const serviceState = new Map<string, string>()
  let stopped = false

  function rowKey(entry: Entry): string {
    return entry.id.startsWith('include:') ? entry.options.id : `name:${entry.options.name}`
  }

  function pluginDetail(entry: Entry, fiber: Fiber): string {
    const name = entry.options.name ?? ''
    if (fiber.state !== 0) return name
    const missing = Object.keys(fiber.inject).filter((service) => fiber.ctx.get(service) === undefined).sort()
    if (missing.length === 0) return name
    return `${name} waits for ${missing.join(',')}`
  }

  function broadcast(message: TraceMessage): void {
    const frame = encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
    for (const open of [...streams]) open.send(frame)
  }

  function addMessage(fields: MessageFields): TraceMessage {
    const message: TraceMessage = { seq: messages.length + 1, time: fields.time, process: fields.process }
    if (fields.process === 'client') message.window = fields.window
    message.kind = fields.kind
    message.name = fields.name
    message.state = fields.state
    if (typeof fields.detail === 'string' && fields.detail !== '') message.detail = fields.detail
    if (fields.snapshot === true) message.snapshot = true
    messages.push(message)
    broadcast(message)
    return message
  }

  function addPlugin(entry: Entry, fiber: Fiber, snapshot: boolean): void {
    addMessage({
      time: Date.now(),
      process: 'host',
      kind: 'plugin',
      name: rowKey(entry),
      state: STATES[fiber.state],
      detail: pluginDetail(entry, fiber),
      snapshot: snapshot === true,
    })
    seen.add(fiber)
  }

  function addService(name: string, state: string, snapshot: boolean): void {
    addMessage({
      time: Date.now(),
      process: 'host',
      kind: 'service',
      name,
      state,
      snapshot: snapshot === true,
    })
  }

  function rescan(): void {
    for (const entry of ctx.loader.entries()) {
      if (entry.options.name === 'cordis:include') continue
      if (!entry.fiber) continue
      if (seen.has(entry.fiber)) continue
      addPlugin(entry, entry.fiber, false)
    }
  }

  for (const entry of ctx.loader.entries()) {
    if (entry.options.name === 'cordis:include') continue
    if (!entry.fiber) continue
    addPlugin(entry, entry.fiber, true)
  }

  for (const name of Object.keys(ctx.reflect.props)) {
    if (ctx.reflect.props[name]?.type !== 'service') continue
    const state = ctx.reflect.get(name) !== undefined ? 'up' : 'down'
    serviceState.set(name, state)
    addService(name, state, true)
  }

  ctx.on('internal/status', (fiber) => {
    try {
      if (fiber.entry === undefined) return
      if (fiber.parent?.fiber?.entry === fiber.entry) return
      if (fiber.entry.options.name === 'cordis:include') return
      addPlugin(fiber.entry, fiber, false)
    } catch (error) {
      ctx.logger.warn('deepwidgets-trace: internal/status failed', error)
    }
  })

  ctx.on('internal/service', function (name, value) {
    try {
      if (name === 'loader') rescan()
      const state = value !== undefined ? 'up' : 'down'
      if (serviceState.get(name) === state) return
      serviceState.set(name, state)
      addService(name, state, false)
    } catch (error) {
      ctx.logger.warn('deepwidgets-trace: internal/service failed', error)
    }
  })

  ctx.loader.await().then(() => {
    try {
      if (stopped) return
      rescan()
    } catch (error) {
      ctx.logger.warn('deepwidgets-trace: loader.await failed', error)
    }
  })

  function goodMessage(value: unknown): boolean {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
    const item = value as Record<string, unknown>
    if (item.process !== 'main' && item.process !== 'client') return false
    if (item.process === 'client') {
      if (typeof item.window !== 'string' || item.window === '') return false
    } else if (Object.hasOwn(item, 'window')) return false
    if (item.kind !== 'step' && item.kind !== 'plugin' && item.kind !== 'service') return false
    if (typeof item.name !== 'string' || item.name === '') return false
    if (item.kind === 'step' && item.state !== 'done') return false
    if (item.kind === 'plugin' && !STATES.includes(item.state as string)) return false
    if (item.kind === 'service' && item.state !== 'up' && item.state !== 'down') return false
    if (typeof item.time !== 'number' || !Number.isFinite(item.time)) return false
    if (Object.hasOwn(item, 'detail') && typeof item.detail !== 'string') return false
    if (Object.hasOwn(item, 'snapshot') && typeof item.snapshot !== 'boolean') return false
    return true
  }

  async function receive(request: Request): Promise<Response> {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return new Response('bad trace body', { status: 400 })
    }
    if (!Array.isArray(body)) return new Response('bad trace body', { status: 400 })
    for (let index = 0; index < body.length; index += 1) {
      if (!goodMessage(body[index])) return new Response(`bad trace message ${index}`, { status: 400 })
    }
    for (const item of body as PostedMessage[]) {
      addMessage({
        time: item.time,
        process: item.process,
        window: item.window,
        kind: item.kind,
        name: item.name,
        state: item.state,
        detail: item.detail,
        snapshot: item.snapshot,
      })
    }
    return Response.json({ added: body.length })
  }

  function openStream(request: Request): Response {
    let closed = false
    const open: OpenStream = {
      timer: undefined,
      controller: undefined,
      send(frame) {
        try {
          open.controller?.enqueue(frame)
        } catch {
          // The controller is already closed.
        }
      },
      close() {
        if (closed) return
        closed = true
        streams.delete(open)
        clearInterval(open.timer)
        try {
          open.controller?.close()
        } catch {
          // The controller is already closed.
        }
      },
    }
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        open.controller = controller
        const sendText = (text: string): void => {
          try {
            controller.enqueue(encoder.encode(text))
          } catch {
            // The controller is already closed.
          }
        }
        sendText(': open\n\n')
        const startLength = messages.length
        for (let index = 0; index < startLength; index += 1) sendText(`data: ${JSON.stringify(messages[index])}\n\n`)
        streams.add(open)
        const end = messages.length
        for (let index = startLength; index < end; index += 1) sendText(`data: ${JSON.stringify(messages[index])}\n\n`)
        if (request.signal.aborted) {
          open.close()
          return
        }
        request.signal.addEventListener('abort', () => { open.close() }, { once: true })
        open.timer = setInterval(() => { sendText(': ping\n\n') }, 15_000)
      },
      cancel() {
        open.close()
      },
    })
    return new Response(body, {
      headers: {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache',
      },
    })
  }

  ctx.connection.fetch.register({
    path: '/api/trace',
    methods: ['GET', 'POST'],
    requestBody: 'buffered',
    fetch: async (request) => request.method === 'POST' ? receive(request) : openStream(request),
  })

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/trace',
    resource: async () => new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
  }), 'deepwidgets-trace: GET /trace')

  ctx.effect(() => () => {
    stopped = true
    for (const open of [...streams]) open.close()
  }, 'deepwidgets-trace: close streams')
}
