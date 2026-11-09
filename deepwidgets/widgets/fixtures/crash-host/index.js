/**
 * Check fixture of `widget.crash_records` (tools/widgets-crash-replay.mjs, spec `safe_host.cleanup`): a host plugin,
 * not a widget. `arm` adds one disposer to this plugin, then throws an uncaught error in host code.
 * - `marker`: the disposer writes the file `marker`, so the check sees that the dispose at the crash ran.
 * - `async-hang`: the disposer gives a promise that never settles.
 * - `sync-loop`: the disposer holds the main thread in a loop that never ends.
 * - `none`: no disposer. Another plugin can hold the dispose.
 */
import { writeFileSync } from 'node:fs'

export const name = 'deepwidgets-crashhost'
export const inject = ['connection']

export function apply(ctx) {
  const disposers = {
    marker: (marker) => () => { writeFileSync(marker, 'disposed') },
    'async-hang': () => () => new Promise(() => {}),
    'sync-loop': () => () => { for (;;) { /* never ends */ } },
    none: () => () => {},
  }
  ctx.connection.fetch.register({
    path: '/api/crashhost/arm',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const { mode, marker } = await request.json().catch(() => ({}))
      const disposer = disposers[mode]
      if (disposer === undefined) return Response.json({ ok: false, error: `no mode ${String(mode)}` }, { status: 400 })
      ctx.effect(() => disposer(marker), `crashhost: ${String(mode)}`)
      setTimeout(function hostThrow() { throw new Error(`crashhost: an uncaught error in host code (${String(mode)})`) }, 50)
      return Response.json({ ok: true, mode })
    },
  })
}
