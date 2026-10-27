import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { isTrustedApiRequest } from '@deepseek-ai/dsh-client-connection/src/api-request-trust.ts'
import { z } from 'zod'

/**
 * Host MCP server for widgets. One webServer prefix route owns /mcp and
 * /mcp/token; every tool calls ctx.widgets in-process, so the action contract
 * (queue, busy, timeout, requestId, quota, change log) lives in the runtime.
 */
export const name = 'deepwidgets-mcp'
export const inject = ['webServer', 'widgets']

/** What the model does next, per runtime error code (DSH plugin_manager ERROR_STEPS pattern). */
const NEXT_STEP = {
  'unknown-widget': 'Call widget_list and retry with an exact slug.',
  'unknown-action': 'Call widget_describe with this slug and retry with an exact action name.',
  'invalid-args': 'Fix args to match details.schema and retry.',
  'handler-error': 'The action threw. Do not retry unchanged; tell the user the message.',
  timeout: 'The action ran past its limit and was aborted; its later writes were refused. If details.partial is false nothing changed: retry (same requestId is fine). If true, read state with a query first.',
  busy: 'Other writes on this widget held the queue; this call did NOT run. Retry shortly.',
  quota: 'The write would exceed the widget state quota. Remove rows first, or store less.',
  'idempotency-conflict': 'This requestId was used with different arguments. Use a new requestId for a new operation.',
  'widget-failed': 'The widget is quarantined after a crash. Tell the user; widget_inspect shows the failure.',
  'invalid-program': 'Fix the program: details.errors are parse errors, details.drift names actions the widget does not declare. Read widget_guide.',
  'invalid-widget': 'Fix the widget record (slug, title, table.fields). Read widget_guide.',
  conflict: 'This slug belongs to an installed widget package. Pick another slug.',
  'stale-cursor': 'The change feed was reset (host restart or gap). Call widget_list for current state and use its cursor.',
}

function toolError(code, message, details) {
  const error = { code, message, nextStep: NEXT_STEP[code] ?? 'Tell the user the message.', ...(details === undefined ? {} : { details }) }
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error }) }], structuredContent: { error } }
}

function toolOk(body) {
  return { content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body }
}

async function guarded(run) {
  try {
    return toolOk(await run())
  } catch (error) {
    if (typeof error?.code === 'string' && typeof error?.status === 'number') return toolError(error.code, error.message, error.details)
    return toolError('handler-error', String(error?.message ?? error))
  }
}

const RULES = `# deepWidgets: create or edit a data widget
A data widget = slug + title + table (the CRUD descriptor) + program (OpenUI Lang). No code.
- table: { fields: { <name>: { type: "string"|"number"|"boolean", required?: bool, default?: value } } }. Field "id" is reserved.
- The runtime makes four actions from it: list (query, returns { rows: [{ id, ...fields }] }), add (mutation, fields), update (mutation, { id, ...fields to change }), remove (mutation, { id }).
- The program may only name those actions in Query/Mutation. Read rows with items = Query("list", {}, {rows: []}).
- Save with widget_save. It validates first and saves nothing on error. Check with widget_inspect, then widget_call each action.
`

export function apply(ctx, config = {}) {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const tokenFile = config.tokenFile ?? join(home, 'deepwidgets', 'mcp-tokens.json')
  const tokens = new Map()
  if (existsSync(tokenFile)) {
    for (const [token, row] of Object.entries(JSON.parse(readFileSync(tokenFile, 'utf8')))) tokens.set(token, row)
  }
  const persist = () => {
    mkdirSync(dirname(tokenFile), { recursive: true })
    writeFileSync(tokenFile, JSON.stringify(Object.fromEntries(tokens)), { mode: 0o600 })
  }
  const agentOf = (authorization) => {
    const match = /^Bearer (\S+)$/.exec(authorization ?? '')
    return match ? tokens.get(match[1]) : undefined
  }

  function buildServer(agentId) {
    const widgets = ctx.widgets
    const mcp = new McpServer(
      { name: 'deepwidgets', version: '0.0.1' },
      { instructions: 'deepWidgets: desktop widgets. widget_list -> widget_describe -> widget_call. Pass a fresh requestId on mutations. Poll widget_changes with the last cursor to see what the user changed. To build a widget: widget_guide, then widget_save, then widget_inspect.' },
    )
    mcp.registerTool('widget_list', {
      description: 'List widgets: slug, title, status, action names with kind. Returns a change-feed cursor for widget_changes.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true },
    }, () => guarded(() => ({
      cursor: widgets.cursor(),
      widgets: widgets.list().map((w) => ({ slug: w.slug, title: w.title, status: w.status, source: w.source, actions: w.actions.map((a) => `${a.name}:${a.kind}`) })),
    })))
    mcp.registerTool('widget_describe', {
      description: 'Action schemas of one widget. Call before widget_call on a widget you have not described.',
      inputSchema: z.object({ slug: z.string() }),
      annotations: { readOnlyHint: true },
    }, ({ slug }) => guarded(() => {
      const w = widgets.inspect(slug)
      return { slug, title: w.title, status: w.status, rev: w.rev, actions: w.actions }
    }))
    mcp.registerTool('widget_call', {
      description: 'Run one widget action. args must match the schema from widget_describe. For mutations pass a fresh requestId; after a timeout retry with the same requestId.',
      inputSchema: z.object({
        slug: z.string(),
        action: z.string(),
        args: z.record(z.string(), z.unknown()).optional(),
        requestId: z.string().max(100).optional(),
      }),
    }, ({ slug, action, args, requestId }) => guarded(() => widgets.call(slug, action, args ?? {}, { caller: agentId, requestId })))
    mcp.registerTool('widget_changes', {
      description: 'Changes since a cursor (from widget_list or a previous widget_changes), excluding your own. Use it to see what the user or timers changed.',
      inputSchema: z.object({ since: z.string() }),
      annotations: { readOnlyHint: true },
    }, ({ since }) => guarded(() => {
      const out = widgets.changes(since, { excludeCaller: agentId })
      return out.reset ? { ...out, nextStep: NEXT_STEP['stale-cursor'] } : out
    }))
    mcp.registerTool('widget_guide', {
      description: 'Read before creating or editing a widget: data-widget rules plus the program language and components. With slug, the guide lists that widget\'s actions as tools.',
      inputSchema: z.object({ slug: z.string().optional() }),
      annotations: { readOnlyHint: true },
    }, async ({ slug }) => {
      try {
        return { content: [{ type: 'text', text: `${RULES}\n${widgets.guide(slug)}` }] }
      } catch (error) {
        return toolError(error.code ?? 'handler-error', error.message, error.details)
      }
    })
    mcp.registerTool('widget_save', {
      description: 'Create or replace a data widget (CRUD table + program, no code). Validated first; nothing changes on error, and the old version keeps serving. Saving the same content again is a no-op.',
      inputSchema: z.object({
        slug: z.string(),
        title: z.string(),
        table: z.object({ fields: z.record(z.string(), z.object({ type: z.enum(['string', 'number', 'boolean']), required: z.boolean().optional(), default: z.union([z.string(), z.number(), z.boolean()]).optional() })) }),
        program: z.string(),
      }),
    }, (input) => guarded(() => widgets.save(input, { by: agentId })))
    mcp.registerTool('widget_inspect', {
      description: 'Full record of one widget: program text, actions, state, status, and the program check (parse errors and drift = names the program uses that the widget does not declare).',
      inputSchema: z.object({ slug: z.string() }),
      annotations: { readOnlyHint: true },
    }, ({ slug }) => guarded(() => widgets.inspect(slug)))
    return mcp
  }

  const modern = createMcpHandler((requestCtx) => {
    const row = agentOf(requestCtx.requestInfo?.headers.get('authorization'))
    return buildServer(row?.agentId ?? 'anonymous')
  }, { legacy: 'stateless' })
  const mcpNode = toNodeHandler(modern)

  const send = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify(body))
  }

  /**
   * Fence: the DSH /api Host rule (loopback, bind address) plus one MCP rule:
   * MCP clients are never browsers, so any Origin or Sec-Fetch-Site is refused.
   */
  function fence(req) {
    if (req.headers.origin !== undefined || req.headers['sec-fetch-site'] !== undefined) return 'browser requests are refused'
    if (!isTrustedApiRequest({ headers: req.headers }, [], ctx.webServer.host)) return 'untrusted Host'
    return undefined
  }

  async function handler(req, res) {
    const path = (req.url ?? '/').split('?')[0]
    const refused = fence(req)
    if (refused !== undefined) return send(res, 403, { error: refused })
    if (path === '/mcp/token') {
      if (req.method !== 'POST') return send(res, 405, { error: 'POST only' })
      let body = ''
      for await (const chunk of req) body += chunk
      let agent
      try { agent = String(JSON.parse(body || '{}').agent ?? 'agent').slice(0, 64) } catch { return send(res, 400, { error: 'body must be JSON {agent}' }) }
      const token = randomBytes(24).toString('base64url')
      const agentId = `${agent.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomBytes(3).toString('hex')}`
      tokens.set(token, { agentId, agent, issuedAt: new Date().toISOString() })
      persist()
      return send(res, 200, { token, agentId })
    }
    if (path === '/mcp') {
      if (agentOf(req.headers.authorization) === undefined) return send(res, 401, { error: 'missing or unknown bearer token; POST /mcp/token {agent} first' })
      return mcpNode(req, res)
    }
    return send(res, 404, { error: 'not found' })
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/mcp',
    handler: (req, res) => handler(req, res).catch((error) => {
      ctx.logger.warn('mcp: request failed', error)
      if (!res.headersSent) send(res, 500, { error: String(error?.message ?? error) })
      else res.end()
    }),
  }), 'mcp: /mcp route')
  ctx.effect(() => () => modern.close?.(), 'mcp: close handler')
}
