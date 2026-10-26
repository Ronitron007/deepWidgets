import { z } from 'zod'
import { TABLE } from './groceries.js'

// Test-only plugin: a faulty widget, N bulk widgets, and dev control routes.
export const name = 'deepwidgets-widget-playground'
export const inject = ['widgets', 'connection', 'loader']

const json = (body, status = 200) => Response.json(body, { status })

const SWAP = {
  v1: { program: 'root = Card([TextContent("v1"), TextContent(@Count(r.rows))])\nr = Query("list", {}, {rows: []})', fail: false },
  v2: { program: 'root = Card([TextContent("v2"), TextContent(@Count(r.rows))])\nr = Query("list", {}, {rows: []})', fail: false },
  broken: { program: 'root = Card([TextContent("broken")])', fail: true },
}

/** A versioned widget plugin, loaded as a child fiber (stands in for one installed bundle version). */
function swapPlugin(variant) {
  return {
    name: `deepwidgets-widget-swap-${variant}`,
    inject: ['widgets'],
    apply(child) {
      const spec = SWAP[variant]
      if (spec.fail) throw new Error(`swap ${variant}: apply failed on purpose`)
      child.widgets.register({ slug: 'swap', title: `Swap ${variant}`, kind: 'crud', table: TABLE, program: spec.program })
    },
  }
}

export function apply(ctx) {
  const swaps = new Map()
  ctx.widgets.register({
    slug: 'faulty',
    title: 'Faulty',
    program: 'root = Card([TextContent("faulty")])', quotaBytes: 64 * 1024,
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
      {
        // Read, wait, then write: loses updates unless mutations are serialized.
        name: 'incr',
        kind: 'mutation',
        handler: async (_args, w) => {
          const seen = w.state.n
          await new Promise((resolve) => setTimeout(resolve, 20))
          return w.update((state) => ({ ...state, n: seen + 1 }))
        },
      },
      {
        name: 'slow',
        kind: 'mutation',
        args: z.object({ ms: z.number().int().min(0).max(5_000) }).strict(),
        timeoutMs: 3_000,
        handler: async ({ ms }, w) => {
          await new Promise((resolve) => setTimeout(resolve, ms))
          return w.update((state) => ({ ...state, slowDone: (state.slowDone ?? 0) + 1 }))
        },
      },
      {
        name: 'fill',
        kind: 'mutation',
        args: z.object({ bytes: z.number().int().min(0) }).strict(),
        handler: ({ bytes }, w) => w.update((state) => ({ ...state, blob: 'x'.repeat(bytes) })),
      },
      { name: 'peek', kind: 'query', handler: (_args, w) => ({ n: w.state.n, slowDone: w.state.slowDone ?? 0, blob: w.state.blob?.length ?? 0 }) },
    ],
  })

  // A package widget whose program names an action it does not declare (drift is reported, not fatal).
  ctx.widgets.register({
    slug: 'drifty',
    title: 'Drifty',
    kind: 'crud',
    table: TABLE,
    program: 'root = Card([TextContent(@Count(r.rows))])\nr = Query("list", {}, {rows: []})\nx = Mutation("archive", {})',
  })

  const bulk = Number(process.env.DEEPWIDGETS_BULK ?? 0)
  for (let index = 1; index <= bulk; index += 1) {
    ctx.widgets.register({ slug: `bulk-${index}`, title: `Bulk ${index}`, kind: 'crud', table: TABLE, program: 'root = Card([TextContent("bulk")])' })
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

  // Load / unload one version of the 'swap' widget (safe replace check).
  ctx.connection.fetch.register({
    path: '/api/widgets-dev/swap',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (request) => {
      const { variant, op } = await request.json()
      if (!(variant in SWAP)) return json({ ok: false, error: `no variant ${variant}` }, 404)
      if (op === 'unload') {
        await swaps.get(variant)?.dispose()
        swaps.delete(variant)
      } else {
        const fiber = ctx.plugin(swapPlugin(variant))
        swaps.set(variant, fiber)
        await new Promise((resolve) => setTimeout(resolve, 50))
      }
      let inspect = null
      try { inspect = ctx.widgets.inspect('swap') } catch (error) { inspect = { error: error.code } }
      return json({ ok: true, variant, op: op ?? 'load', fiberState: swaps.get(variant)?.state ?? null, title: inspect.title, standby: inspect.standby ?? 0, status: inspect.status, program: inspect.program })
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
