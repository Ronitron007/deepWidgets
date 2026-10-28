/** Host half of the probe: one route that answers with the host process id. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Services the route needs. */
export const inject = ['webServer']

/**
 * Register `GET /api/probe` for the lifetime of the plugin.
 * @param ctx - host plugin context carrying the web server.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/probe',
    resource: async () => Response.json({ ok: true, pid: process.pid }),
  }), 'deepwidgets-probe: GET /api/probe')
}
