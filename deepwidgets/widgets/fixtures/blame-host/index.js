/**
 * Check fixture of `widget.isolation_blame` (tools/widgets-blame.mjs): a host plugin, not a widget.
 * It gives a service that the blame widget calls, a host event that its listener hears, and a host-only fault.
 * Ported from the spike `crash_only` (deepwidgets/widgets/blamehost.js at 19039136).
 */
export const name = 'deepwidgets-blamehost'
export const inject = ['connection']

export function apply(ctx) {
  ctx.provide('blameHost', {
    /** Throws synchronously inside host code. */
    explode() { throw new Error('blamehost: the service threw while a widget called it') },
    /** Returns a promise that host code rejects later. */
    explodeLater() {
      return new Promise((_resolve, reject) => { setTimeout(function hostReject() { reject(new Error('blamehost: the service promise rejected')) }, 50) })
    },
  })
  const tick = setInterval(() => { ctx.emit('blamehost/tick') }, 100)
  ctx.effect(() => () => { clearInterval(tick) }, 'blamehost tick')
  ctx.connection.fetch.register({
    path: '/api/blamehost/arm',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: () => {
      setTimeout(function hostOnlyThrow() { throw new Error('blamehost: an error with no widget frame') }, 50)
      return Promise.resolve(Response.json({ ok: true }))
    },
  })
}
