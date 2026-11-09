/**
 * Check fixture of `widget.isolation_watchdog`: a host plugin, not a widget. It parses a large JSON text in one
 * synchronous step of host code. That step is busy but healthy, so the watchdog must not kill the host.
 * `block` (widget.crash_records, safe_host.watchdog) holds the event loop in host code, with no widget in the
 * running slot, for the given time.
 * `innocent` (widget_fv.crash) calls the action `stall` of the widget `watchdog` for 800 ms, so the watchdog writes
 * the provisional record. When the call returns, host code aborts the process at once, before the next heartbeat.
 * The service `watchdogHost` gives `blockLater`: host work that a widget awaits. Its timer gets the blame store of
 * the widget, and it holds the event loop in host code.
 */
export const name = 'deepwidgets-watchdoghost'
export const inject = ['connection']

const yieldLoop = () => new Promise((resolve) => { setImmediate(resolve) })

/** Block the event loop for `ms` milliseconds, in the files of this host plugin. */
function busy(ms) {
  const end = performance.now() + ms
  while (performance.now() < end) { /* host code holds the event loop */ }
}

export function apply(ctx) {
  ctx.provide('watchdogHost', {
    blockLater(ms) {
      return new Promise((resolve) => { setTimeout(function hostBlock() { busy(ms); resolve() }, 0) })
    },
  })
  let text = ''
  // Build the text in small steps, so that only the parse blocks the event loop.
  ctx.connection.fetch.register({
    path: '/api/watchdoghost/prepare',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const { mb = 150 } = await request.json().catch(() => ({}))
      const item = { id: 0, name: 'x'.repeat(40), tags: ['a', 'b', 'c'], n: 1.5, ok: true }
      const parts = []
      let size = 0
      for (let id = 0; size < mb * 1024 * 1024; id += 1) {
        const part = JSON.stringify({ ...item, id })
        parts.push(part)
        size += part.length + 1
        if (id % 20_000 === 0) await yieldLoop()
      }
      text = `[${parts.join(',')}]`
      return Response.json({ ok: true, mb: text.length / 1024 / 1024 })
    },
  })
  ctx.connection.fetch.register({
    path: '/api/watchdoghost/parse',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: () => {
      const start = performance.now()
      const value = JSON.parse(text)
      const parseMs = Math.round(performance.now() - start)
      return Promise.resolve(Response.json({ ok: true, items: value.length, mb: text.length / 1024 / 1024, parseMs }))
    },
  })
  ctx.connection.fetch.register({
    path: '/api/watchdoghost/block',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const { ms = 1_000 } = await request.json().catch(() => ({}))
      busy(ms)
      return Response.json({ ok: true, ms })
    },
  })
  ctx.connection.fetch.register({
    path: '/api/watchdoghost/innocent',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async () => {
      await ctx.get('widgets').call('watchdog', 'stall', { ms: 800 }, { caller: 'host' })
      // The widget call returned. Host code aborts now, as an out-of-memory error would.
      process.abort()
      return Response.json({ ok: true })
    },
  })
}
