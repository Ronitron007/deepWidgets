/** Client half of the trace: it sends the rows and services of one window to `POST api/trace`. */
import type { Context, Fiber } from '@deepseek-ai/cordis'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'

/** Fields of one new client message. */
interface MessageFields {
  kind: string
  name: string
  state: string | undefined
  detail?: string
  snapshot?: boolean
}

/** One client message. `addMessage` writes the fields in the order of this type. */
interface ClientMessage {
  time: number
  process: string
  window: string
  kind: string
  name: string
  state: string | undefined
  detail?: string
  snapshot?: true
}

const STATES = ['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']

/** Services the trace needs. */
export const inject = ['loader']

/**
 * Trace the client rows and services of this window, and send them to the host.
 * @param ctx - client plugin context carrying the loader.
 */
export function apply(ctx: Context): void {
  const windowName = new URLSearchParams(location.search).get('window') || 'main'
  const queue: ClientMessage[] = []
  const seen = new WeakSet<Fiber>()
  const serviceState = new Map<string, string>()
  let stopped = false
  let scheduled = false
  let sending = false

  function rowKey(entry: Entry): string {
    return entry.options.name
  }

  function pluginDetail(entry: Entry, fiber: Fiber): string {
    const name = entry.options.name ?? ''
    if (fiber.state !== 0) return name
    const missing = Object.keys(fiber.inject).filter((service) => fiber.ctx.get(service) === undefined).sort()
    if (missing.length === 0) return name
    return `${name} waits for ${missing.join(',')}`
  }

  function flush(): void {
    if (stopped || sending || queue.length === 0) return
    const batch = queue.splice(0, queue.length)
    sending = true
    fetch('api/trace', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(batch),
    }).then((response) => {
      if (!stopped && !response.ok) ctx.logger.warn(`deepwidgets-trace: POST api/trace answered ${response.status}`)
    }, (error) => {
      if (!stopped) ctx.logger.warn('deepwidgets-trace: POST api/trace failed', error)
    }).finally(() => {
      sending = false
      flush()
    })
  }

  function sendLater(): void {
    scheduled = false
    flush()
  }

  function addMessage(fields: MessageFields): void {
    const message: ClientMessage = { time: Date.now(), process: 'client', window: windowName, kind: fields.kind, name: fields.name, state: fields.state }
    if (typeof fields.detail === 'string' && fields.detail !== '') message.detail = fields.detail
    if (fields.snapshot === true) message.snapshot = true
    queue.push(message)
    if (scheduled) return
    scheduled = true
    queueMicrotask(sendLater)
  }

  function addPlugin(entry: Entry, fiber: Fiber, snapshot: boolean): void {
    const name = rowKey(entry)
    if (typeof name !== 'string' || name === '') return
    addMessage({
      kind: 'plugin',
      name,
      state: STATES[fiber.state],
      detail: pluginDetail(entry, fiber),
      snapshot: snapshot === true,
    })
    seen.add(fiber)
  }

  function addService(name: string, state: string, snapshot: boolean): void {
    addMessage({ kind: 'service', name, state, snapshot: snapshot === true })
  }

  function rescan(): void {
    for (const entry of ctx.loader.entries()) {
      if (entry.options.name === 'cordis:include') continue
      if (!entry.fiber) continue
      if (seen.has(entry.fiber)) continue
      addPlugin(entry, entry.fiber, false)
    }
  }

  ctx.effect(() => () => {
    stopped = true
  }, 'deepwidgets-trace: client sender')

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
}
