/**
 * Playground stand-in for the widgets runtime (creation spike). It provides the
 * `widgets` service that widget packages call, keeps state in memory (the real
 * runtime keeps it in ctx.storageDomain), and serves unauthenticated loopback
 * routes for list and call. Do not ship it.
 */
import { readFile } from 'node:fs/promises'

export const inject = { webServer: { required: true }, credentials: { required: false } }

const SLUG = /^[a-z][a-z0-9-]{1,40}$/

/** The generated actions of a CRUD widget: one table of records keyed by id. */
function crudActions(def) {
  const fields = def.table?.fields ?? {}
  const pick = (args) => Object.fromEntries(Object.keys(fields).filter(k => k in (args ?? {})).map(k => [k, args[k]]))
  return {
    list: { kind: 'query', run: (_args, api) => ({ rows: Object.values(api.state.get().rows ?? {}) }) },
    add: { kind: 'mutation', run: (args, api) => {
      const id = Math.random().toString(36).slice(2, 10)
      const record = { id, ...Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.default ?? null])), ...pick(args) }
      api.state.update(s => ({ ...s, rows: { ...s.rows, [id]: record } }))
      return record
    } },
    update: { kind: 'mutation', run: (args, api) => {
      const row = api.state.get().rows?.[args?.id]
      if (row === undefined) throw new Error(`no record ${args?.id}`)
      const next = { ...row, ...pick(args) }
      api.state.update(s => ({ ...s, rows: { ...s.rows, [row.id]: next } }))
      return next
    } },
    remove: { kind: 'mutation', run: (args, api) => {
      api.state.update(s => { const rows = { ...s.rows }; delete rows[args?.id]; return { ...s, rows } })
      return { removed: args?.id }
    } },
  }
}

class Widgets {
  constructor(ctx) { this.ctx = ctx; this.defs = new Map(); this.state = new Map() }

  /** Register a widget definition; returns its disposer. */
  define(def) {
    if (!SLUG.test(def.slug ?? '')) throw new Error(`widget slug must match ${SLUG}: ${def.slug}`)
    if (this.defs.has(def.slug)) throw new Error(`widget slug already defined: ${def.slug}`)
    const actions = def.kind === 'crud' ? crudActions(def) : def.actions ?? {}
    for (const [name, a] of Object.entries(actions)) {
      if (a.kind !== 'query' && a.kind !== 'mutation') throw new Error(`${def.slug}.${name}: kind must be query or mutation`)
      if (typeof a.run !== 'function') throw new Error(`${def.slug}.${name}: run must be a function`)
    }
    if (!this.state.has(def.slug)) this.state.set(def.slug, structuredClone(def.initialState ?? (def.kind === 'crud' ? { rows: {} } : {})))
    this.defs.set(def.slug, { ...def, actions })
    return () => { this.defs.delete(def.slug) } // state survives a reload, as storage would
  }

  list() {
    return [...this.defs.values()].map(d => ({ slug: d.slug, title: d.title, kind: d.kind ?? 'logic', credentials: d.credentials ?? [],
      actions: Object.fromEntries(Object.entries(d.actions).map(([n, a]) => [n, { kind: a.kind, params: a.params ?? {} }])) }))
  }

  async call(slug, action, args, signal) {
    const def = this.defs.get(slug)
    if (def === undefined) return { ok: false, error: { code: 'unknown-widget', slug } }
    const a = def.actions[action]
    if (a === undefined) return { ok: false, error: { code: 'unknown-action', action, known: Object.keys(def.actions) } }
    const api = {
      state: { get: () => this.state.get(slug), update: fn => this.state.set(slug, fn(this.state.get(slug))) },
      signal,
      /** Resolve a credential the definition declared; the value never leaves the host. */
      credential: async (name) => {
        if (!(def.credentials ?? []).includes(name)) throw new Error(`credential ${name} is not declared by ${slug}`)
        const hit = await this.ctx.get('credentials')?.resolve(name)
        if (hit === undefined) throw Object.assign(new Error(`credential ${name} is not set; ask the user to set it in Settings`), { code: 'credential-missing' })
        return hit.value
      },
    }
    try { return { ok: true, data: await a.run(args ?? {}, api) } }
    catch (e) { return { ok: false, error: { code: e?.code ?? 'action-failed', message: String(e?.message ?? e) } } }
  }

  async program(slug) {
    const def = this.defs.get(slug)
    if (def?.program === undefined) return undefined
    return readFile(def.program, 'utf8')
  }
}

export function apply(ctx) {
  const widgets = new Widgets(ctx)
  ctx.provide('widgets', widgets)
  const route = (path, fn) => ctx.effect(() => ctx.webServer.register({ kind: 'exact', path, resource: fn }), `widgets-standin ${path}`)
  route('/spike/widgets', async () => Response.json(widgets.list()))
  route('/spike/widgets/call', async (req) => {
    // webServer resource routes answer only GET/HEAD (webserver/src/index.ts:500-503); the spike passes JSON in ?q=.
    const { slug, action, args } = JSON.parse(new URL(req.url, 'http://x').searchParams.get('q') ?? '{}')
    return Response.json(await widgets.call(slug, action, args, req.signal))
  })
  route('/spike/widgets/program', async (req) => {
    const text = await widgets.program(new URL(req.url, 'http://x').searchParams.get('slug'))
    return text === undefined ? new Response('no program', { status: 404 }) : new Response(text)
  })
}
