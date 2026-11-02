/**
 * Check fixture of `widget.isolation_watchdog`: a host plugin, not a widget. It parses a large JSON text in one
 * synchronous step of host code. That step is busy but healthy, so the watchdog must not kill the host.
 */
export const name = 'deepwidgets-watchdoghost'
export const inject = ['connection']

const yieldLoop = () => new Promise((resolve) => { setImmediate(resolve) })

export function apply(ctx) {
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
}
