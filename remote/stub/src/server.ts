/**
 * A stub of the deepWidgets local MCP server (ref/deepwidgets/mcp/src/index.ts, ref/apps/desktop/src/deepwidgets-mcp-port.ts).
 * Faithful parts: the 127.0.0.1 bind, the port file, the fence, POST /mcp/token, bearer auth on /mcp, the 11 tool names.
 * Simplified parts: one fixture widget `groceries` (actions add and list), tokens kept in memory only.
 * Test hooks on loopback only: GET /__stub/calls, POST /__stub/restart.
 * Run: DSH_HOME=/tmp/dsh STUB_PORT=0 npx tsx stub/src/server.ts
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

const TOKEN_BODY_LIMIT = 4_096
const MAX_AGENTS = 64
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i
const LOOPBACK_V4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const AGENT_NAME = /^[\x20-\x7e]{1,64}$/
const CHALLENGE = /^[A-Za-z0-9_-]{22,256}$/
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/
const MAIN_SLUG = 'main'

export interface StubCall { tool: string; args: Record<string, unknown>; by: string }
export interface Stub {
  port: number
  close(): Promise<void>
  calls(): StubCall[]
  restart(): Promise<void>
}

interface TokenRow { agentId: string; agent: string; issuedAt: string; epoch: string }
interface ToolError { code: string; message: string; nextStep: string }

const NEXT_STEP: Record<string, string> = {
  'unknown-widget': 'Call widget_list and retry with an exact slug.',
  'unknown-action': 'Call widget_describe with this slug and retry with an exact action name.',
  'invalid-args': 'Fix args to match the action args schema from widget_describe, then retry.',
  'stale-cursor': 'The change feed was reset (a host restart or a gap). Call widget_list for the current state and use its cursor.',
  'creation-unavailable': 'This host has no plugin manager, so it cannot install widgets. Tell the user.',
}

export function isLoopbackHost(host: string | undefined): boolean {
  return host !== undefined && LOOPBACK_HOST.test(host)
}

export function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined) return false
  if (address === '::1') return true
  const v4 = address.toLowerCase().startsWith('::ffff:') ? address.slice(7) : address
  return LOOPBACK_V4.test(v4) && v4.split('.').every((part) => Number(part) <= 255)
}

/** The fence of the real server: loopback peer, no browser headers, loopback Host. Returns the refusal or undefined. */
function fenceRefusal(req: IncomingMessage): string | undefined {
  if (!isLoopbackAddress(req.socket.remoteAddress)) return 'only loopback clients may use /mcp'
  if (req.headers.origin !== undefined || req.headers['sec-fetch-site'] !== undefined) return 'browser requests are refused'
  if (!isLoopbackHost(req.headers.host)) return 'the Host must be 127.0.0.1, localhost, or [::1]'
  return undefined
}

export function mcpProof(nonce: string, challenge: string): string {
  return createHmac('sha256', nonce).update(challenge).digest('hex')
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

function toolOk(body: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body }
}

function toolError(code: string, message: string): CallToolResult {
  const error: ToolError = { code, message, nextStep: NEXT_STEP[code] ?? 'Tell the user the message.' }
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error }) }], structuredContent: { error } }
}

class WidgetError extends Error {
  constructor(readonly code: string, message: string) { super(message) }
}
const unknownWidget = (slug: string): WidgetError => new WidgetError('unknown-widget', `no widget ${JSON.stringify(slug)}`)

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}

async function readSmallBody(req: IncomingMessage): Promise<string | undefined> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > TOKEN_BODY_LIMIT) return undefined
    chunks.push(chunk)
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function writeFileAtomic(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await chmod(dirname(path), 0o700)
  const temp = `${path}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(temp, text, { mode: 0o600 })
  await chmod(temp, 0o600)
  await rename(temp, path)
}

export async function startStub(opts: { dshHome: string; port: number }): Promise<Stub> {
  const portFile = join(opts.dshHome, 'deepwidgets', 'mcp.json')
  const settingsFile = join(opts.dshHome, 'deepwidgets', 'settings.json')
  const started = Math.round(performance.timeOrigin)
  let nonce = randomBytes(16).toString('base64url')
  let epoch = randomBytes(16).toString('hex')
  const tokens = new Map<string, TokenRow>()
  const recorded: StubCall[] = []

  // Fixture state: one widget, `groceries`, and a change feed.
  const groceries = { items: [] as string[], rev: 0 }
  const changes: { seq: number; slug: string; rev: number; by: string }[] = []
  let seq = 0

  const agentOf = (authorization: string | undefined): TokenRow | undefined => {
    const token = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1]
    if (token === undefined) return undefined
    const row = tokens.get(hashToken(token))
    return row === undefined || row.epoch !== epoch ? undefined : row
  }

  function buildServer(agentId: string): McpServer {
    const mcp = new McpServer({ name: 'deepwidgets', version: '0.0.0' }, { instructions: 'Call deepwidgets_modes first.' })
    const tool = <S extends z.ZodType>(name: string, description: string, schema: S, run: (input: z.infer<S>) => Record<string, unknown> | Promise<Record<string, unknown>>): void => {
      // Pass the input through, like `lenient` in the real server; the body parses it, so bad input gets invalid-args.
      mcp.registerTool(name, { description, inputSchema: z.looseObject({}) }, async (input: Record<string, unknown>) => {
        recorded.push({ tool: name, args: structuredClone(input), by: agentId })
        const parsed = schema.safeParse(input)
        if (!parsed.success) return toolError('invalid-args', z.prettifyError(parsed.error))
        try {
          return toolOk(await run(parsed.data))
        } catch (error) {
          if (error instanceof WidgetError) return toolError(error.code, error.message)
          return toolError('internal-error', error instanceof Error ? error.message : String(error))
        }
      })
    }
    const describeGroceries = (): Record<string, unknown> => ({
      slug: 'groceries',
      title: 'Groceries',
      actions: [
        { name: 'add', kind: 'mutation', args: { type: 'object', properties: { item: { type: 'string' } }, required: ['item'] }, timeoutMs: 5000 },
        { name: 'list', kind: 'query', args: { type: 'object', properties: {} }, timeoutMs: 5000 },
      ],
      source: '/home/owner/widgets/groceries',
      rev: groceries.rev,
      state: { items: [...groceries.items] },
    })
    const files = (slug: string): Record<string, string> => ({ 'src/index.ts': `// widget ${slug}\nexport const name = '${slug}'\n` })

    tool('deepwidgets_modes', 'List the modes of this server.', z.object({}), () => ({
      modes: [
        { name: 'interact', goal: 'Use widgets that exist', on: true, setting: null, tools: ['widget_describe', 'widget_call', 'widget_changes'] },
        { name: 'create', goal: 'Write, change, or remove a widget', on: true, setting: 'modes.create', tools: ['widget_template', 'widget_install', 'widget_reload', 'widget_remove'] },
        { name: 'library', goal: 'Write the page of a widget with components of the agent', on: true, setting: 'modes.library', tools: ['library_template'] },
      ],
      settingsFile,
    }))
    tool('widget_list', 'List the live widgets.', z.object({}), () => ({
      cursor: String(seq),
      widgets: [{ slug: 'groceries', title: 'Groceries', rev: groceries.rev, programRev: 1 }],
    }))
    tool('widget_describe', 'Describe one widget: its actions and its current state.', z.object({ slug: z.string() }), ({ slug }) => {
      if (slug !== 'groceries') throw unknownWidget(slug)
      return describeGroceries()
    })
    tool('widget_call', 'Run one widget action.', z.object({
      slug: z.string(),
      action: z.string(),
      args: z.record(z.string(), z.unknown()).optional(),
      requestId: z.string().min(1).max(100).optional(),
    }), ({ slug, action, args }) => {
      if (slug !== 'groceries') throw unknownWidget(slug)
      if (action === 'list') return { result: { items: [...groceries.items] }, rev: groceries.rev }
      if (action !== 'add') throw new WidgetError('unknown-action', `no action ${JSON.stringify(action)} on ${JSON.stringify(slug)}`)
      const item = args?.item
      if (typeof item !== 'string' || item === '') throw new WidgetError('invalid-args', 'args.item must be a non-empty string')
      groceries.items.push(item)
      groceries.rev += 1
      changes.push({ seq: ++seq, slug, rev: groceries.rev, by: agentId })
      return { result: { items: [...groceries.items] }, rev: groceries.rev }
    })
    tool('widget_changes', 'The changes after a cursor.', z.object({ since: z.string().optional() }), ({ since }) => {
      const after = since === undefined ? seq : Number(since)
      if (!Number.isSafeInteger(after) || after < 0 || after > seq) {
        return { cursor: String(seq), changes: [], reset: true, error: { code: 'stale-cursor', message: 'the cursor is from another host process or too old', nextStep: NEXT_STEP['stale-cursor'] } }
      }
      return { cursor: String(seq), changes: changes.filter((change) => change.seq > after) }
    })
    tool('widget_template', 'Give the files of the TypeScript widget template.', z.object({ slug: z.string().regex(SLUG).optional(), title: z.string().min(1).max(80).optional() }), ({ slug }) => ({
      files: files(slug ?? 'my-widget'),
      nextStep: 'Write each file under one empty folder, change it, then call widget_install with the absolute folder path.',
    }))
    tool('widget_guide', 'Give the guide of one mode.', z.object({ mode: z.enum(['interact', 'create', 'library']) }), ({ mode }) => ({ mode, guide: `# The ${mode} guide (stub)\n` }))
    const creationOff = (): never => { throw new WidgetError('creation-unavailable', 'the stub has no plugin manager') }
    tool('widget_install', 'Install the widget in a folder.', z.object({ dir: z.string().min(1) }), creationOff)
    tool('widget_reload', 'Run the gates again and replace the bundle.', z.object({ slug: z.string().regex(SLUG) }), creationOff)
    tool('widget_remove', 'Remove the bundle of a widget that widget_install installed.', z.object({ slug: z.string().regex(SLUG) }), creationOff)
    tool('library_template', 'Give the files of the page folder of a widget.', z.object({ slug: z.string().regex(SLUG).optional() }), ({ slug }) => ({
      files: { 'page/index.html': `<!-- page of ${slug ?? 'my-widget'} -->\n` },
      nextStep: 'Write each file under the folder of the widget, next to src/.',
    }))
    return mcp
  }

  async function issueToken(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') { send(res, 405, { error: 'use POST' }, { allow: 'POST' }); return }
    const text = await readSmallBody(req)
    if (text === undefined) { send(res, 413, { error: `the body is larger than ${String(TOKEN_BODY_LIMIT)} bytes` }); return }
    let agent: unknown
    let challenge: unknown
    try {
      ({ agent, challenge } = (JSON.parse(text) as { agent?: unknown; challenge?: unknown } | null) ?? {})
    } catch {
      send(res, 400, { error: 'the body must be JSON { agent, challenge }' })
      return
    }
    if (typeof agent !== 'string' || !AGENT_NAME.test(agent)) { send(res, 400, { error: 'agent must be 1 to 64 printable ASCII characters' }); return }
    if (typeof challenge !== 'string' || !CHALLENGE.test(challenge)) {
      send(res, 400, { error: 'challenge must be at least 16 random bytes as base64url or hex (22 to 256 characters of A-Z a-z 0-9 _ -)' })
      return
    }
    const token = randomBytes(24).toString('base64url')
    const base = agent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'
    const agentId = `${base}-${randomBytes(3).toString('hex')}`
    tokens.set(hashToken(token), { agentId, agent, issuedAt: new Date().toISOString(), epoch })
    // The map keeps insertion order, so the first keys are the oldest tokens.
    for (const key of tokens.keys()) {
      if (tokens.size <= MAX_AGENTS) break
      tokens.delete(key)
    }
    send(res, 200, { token, agentId, proof: mcpProof(nonce, challenge) })
  }

  async function serveMcp(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const row = agentOf(req.headers.authorization)
    if (row === undefined) {
      req.resume()
      send(res, 401, { error: 'missing or unknown bearer token; POST /mcp/token { agent, challenge } first' }, { 'www-authenticate': 'Bearer' })
      return
    }
    if (req.method !== 'POST') {
      req.resume()
      send(res, 405, { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed.' }, id: null }, { allow: 'POST' })
      return
    }
    // Stateless: a new server and transport for each request, like createMcpHandler in the real server.
    const server = buildServer(row.agentId)
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
    res.on('close', () => { void transport.close(); void server.close() })
    await server.connect(transport)
    await transport.handleRequest(req, res)
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const refusal = fenceRefusal(req)
    if (refusal !== undefined) { req.resume(); send(res, 403, { error: refusal }); return }
    const path = (req.url ?? '/').split('?')[0]
    if (path === '/mcp/token') return issueToken(req, res)
    if (path === '/mcp') return serveMcp(req, res)
    req.resume()
    if (path === '/__stub/calls' && req.method === 'GET') { send(res, 200, recorded); return }
    if (path === '/__stub/restart' && req.method === 'POST') { await restart(); send(res, 200, { ok: true }); return }
    send(res, 404, { error: 'not found' })
  }

  const http = createServer((req, res) => {
    handle(req, res).catch((error: unknown) => {
      if (!res.headersSent) send(res, 500, { error: error instanceof Error ? error.message : String(error) })
      else res.end()
    })
  })
  await new Promise<void>((done, fail) => {
    http.once('error', fail)
    http.listen(opts.port, '127.0.0.1', () => { http.off('error', fail); done() })
  })
  const port = (http.address() as AddressInfo).port

  const writePortFile = (): Promise<void> => writeFileAtomic(portFile, `${JSON.stringify({ port, nonce, pid: process.pid, started })}\n`)

  /** A new host start on the same port: new nonce and epoch, earlier tokens void, recorded calls kept. */
  async function restart(): Promise<void> {
    nonce = randomBytes(16).toString('base64url')
    epoch = randomBytes(16).toString('hex')
    tokens.clear()
    await writePortFile()
  }

  await writePortFile()

  return {
    port,
    calls: () => recorded.map((call) => structuredClone(call)),
    restart,
    async close() {
      await new Promise<void>((done) => {
        http.close(() => done())
        http.closeAllConnections()
      })
      // Remove the port file only when it still names this start.
      try {
        const current = JSON.parse(await readFile(portFile, 'utf8')) as { nonce?: unknown }
        if (current.nonce === nonce) await unlink(portFile)
      } catch { /* Missing or unreadable: nothing of this stub to remove. */ }
    },
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dshHome = process.env.DSH_HOME
  if (dshHome === undefined || dshHome === '') {
    console.error('stub: set DSH_HOME')
    process.exit(1)
  }
  const stub = await startStub({ dshHome, port: Number(process.env.STUB_PORT ?? '0') })
  console.log(`stub: listening on 127.0.0.1:${String(stub.port)}; port file ${join(dshHome, 'deepwidgets', 'mcp.json')}`)
  const stop = (): void => { void stub.close().then(() => process.exit(0)) }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
