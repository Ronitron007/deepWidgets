import { z } from 'zod'
import { crudActions } from './crud.js'

// Test-only plugin: a faulty widget, N bulk widgets, and dev control routes.
export const name = 'deepwidgets-widget-playground'
export const inject = ['widgets', 'connection', 'loader']

const json = (body, status = 200) => Response.json(body, { status })

export function apply(ctx) {
  ctx.widgets.register({
    slug: 'faulty',
    title: 'Faulty',
    program: 'root = TextContent("faulty")',
    initialState: { n: 0 },
    timeoutMs: 1_000,
    actions: [
      { name: 'boom', kind: 'mutation', handler: () => { throw new Error('boom on purpose') } },
      { name: 'hang', kind: 'query', handler: () => new Promise(() => {}) },
      {
        name: 'writeLate',
        kind: 'mutation',
        handler: async (_args, w) => {
          await new Promise((resolve) => setTimeout(resolve, 1_500))
          return w.update((state) => ({ n: state.n + 1000 }))
        },
      },
      {
        name: 'bump',
        kind: 'mutation',
        args: z.object({ by: z.number().int() }).strict(),
        handler: ({ by }, w) => w.update((state) => ({ n: state.n + by })),
      },
    ],
  })

  const bulk = Number(process.env.DEEPWIDGETS_BULK ?? 0)
  for (let index = 1; index <= bulk; index += 1) {
    const { actions, initialState } = crudActions({ items: { text: 'string', done: 'boolean' } })
    ctx.widgets.register({ slug: `bulk-${index}`, title: `Bulk ${index}`, program: 'root = TextContent("bulk")', actions, initialState })
  }

  ctx.connection.fetch.register({
    path: '/api/widgets-dev/mem',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => {
      globalThis.gc?.()
      return json({ pid: process.pid, gc: typeof globalThis.gc === 'function', widgets: ctx.widgets.list().length, ...process.memoryUsage() })
    },
  })

  // Another plugin writes a widget's state, outside any /call.
  ctx.connection.fetch.register({
    path: '/api/widgets-dev/poke',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const { slug } = await request.json()
      try {
        await ctx.widgets.update(slug, (state) => ({ ...state, pokedAt: Date.now() }))
        return json({ ok: true, state: ctx.widgets.get(slug) })
      } catch (error) {
        return json({ ok: false, error: String(error.message) }, 500)
      }
    },
  })

  // Dispose one loader row's fiber, as if the plugin unloaded.
  ctx.connection.fetch.register({
    path: '/api/widgets-dev/dispose',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const { id } = await request.json()
      const entry = Array.from(ctx.loader.entries()).find((item) => item.id === id || item.options?.id === id)
      if (entry?.fiber === undefined) return json({ ok: false, error: `no fiber for ${id}` }, 404)
      await entry.fiber.dispose()
      return json({ ok: true, id, widgets: ctx.widgets.list().map((item) => item.slug) })
    },
  })

  ctx.connection.fetch.register({
    path: '/api/widgets-dev/rows',
    methods: ['GET'],
    requestBody: 'buffered',
    fetch: async () => json(Array.from(ctx.loader.entries())
      .filter((item) => String(item.options?.name ?? '').startsWith('@deepwidgets/widgets'))
      .map((item) => ({ id: item.id, optionsId: item.options?.id, name: item.options?.name, state: item.fiber?.state ?? null }))),
  })
}
