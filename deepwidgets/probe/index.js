export const inject = ['webServer']

export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/probe',
    resource: async () => Response.json({ ok: true, pid: process.pid }),
  }), 'deepwidgets-probe: GET /api/probe')
}
