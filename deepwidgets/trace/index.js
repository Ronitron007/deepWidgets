import { readFileSync } from 'node:fs'

const STATES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']
const PAGE = readFileSync(new URL('./page.html', import.meta.url), 'utf8')
const encoder = new TextEncoder()

export const inject = ['webServer', 'connection', 'loader']

export function apply(ctx) {
  const messages = []
  const streams = new Set()
  const seen = new WeakSet()
  const serviceState = new Map()
  let stopped = false

  function rowKey(entry) {
    return entry.id.startsWith('include:') ? entry.options.id : `name:${entry.options.name}`
  }

  function pluginDetail(entry, fiber) {
    const name = entry.options.name ?? ''
    if (fiber.state !== 0) return name
    const missing = Object.keys(fiber.inject).filter((service) => fiber.ctx.get(service) === undefined).sort()
    if (missing.length === 0) return name
    return `${name} waits for ${missing.join(',')}`
  }

  function broadcast(message) {
    const frame = encoder.encode(`data: ${JSON.stringify(message)}\n\n`)
    for (const open of [...streams]) open.send(frame)
  }

  function addMessage(fields) {
    const message = { seq: messages.length + 1, time: fields.time, process: fields.process }
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

  function addPlugin(entry, fiber, snapshot) {
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

  function addService(name, state, snapshot) {
    addMessage({
      time: Date.now(),
      process: 'host',
      kind: 'service',
      name,
      state,
      snapshot: snapshot === true,
    })
  }

  function rescan() {
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

  function goodMessage(item) {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return false
    if (item.process !== 'main' && item.process !== 'client') return false
    if (item.process === 'client') {
      if (typeof item.window !== 'string' || item.window === '') return false
    } else if (Object.hasOwn(item, 'window')) return false
    if (item.kind !== 'step' && item.kind !== 'plugin' && item.kind !== 'service') return false
    if (typeof item.name !== 'string' || item.name === '') return false
    if (item.kind === 'step' && item.state !== 'done') return false
    if (item.kind === 'plugin' && !STATES.includes(item.state)) return false
    if (item.kind === 'service' && item.state !== 'up' && item.state !== 'down') return false
    if (typeof item.time !== 'number' || !Number.isFinite(item.time)) return false
    if (Object.hasOwn(item, 'detail') && typeof item.detail !== 'string') return false
    if (Object.hasOwn(item, 'snapshot') && typeof item.snapshot !== 'boolean') return false
    return true
  }

  async function receive(request) {
    let body
    try {
      body = await request.json()
    } catch {
      return new Response('bad trace body', { status: 400 })
    }
    if (!Array.isArray(body)) return new Response('bad trace body', { status: 400 })
    for (let index = 0; index < body.length; index += 1) {
      if (!goodMessage(body[index])) return new Response(`bad trace message ${index}`, { status: 400 })
    }
    for (const item of body) {
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

  function openStream(request) {
    let closed = false
    const open = {
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
    const body = new ReadableStream({
      start(controller) {
        open.controller = controller
        const sendText = (text) => {
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
