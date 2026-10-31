/**
 * The MCP server for widgets (`widget_mvp.mcp`). One `webServer` prefix route owns `/mcp` and
 * `/mcp/token`. Each tool calls `ctx.widgets` in this process, so the action contract (queue,
 * timeout, `requestId`, change feed) stays in the runtime.
 *
 * The port file (`widget_phase2.mcp_port`) tells agents the listening port and a random server
 * nonce. The nonce never leaves the file: `POST /mcp/token { agent, challenge }` answers
 * `proof = HMAC-SHA256(nonce, challenge)`, so an agent that checks the proof refuses a server on
 * the port that is not this host (`standing.hard.port_squat`). See README.md.
 * @module @deepwidgets/mcp
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { WidgetErrorCode } from '@deepwidgets/widgets'
import { localhostHostValidation, toNodeHandler } from '@modelcontextprotocol/node'
import type { NodeIncomingMessageLike } from '@modelcontextprotocol/node'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import type { CallToolResult, StandardSchemaWithJSON } from '@modelcontextprotocol/server'
import { z } from 'zod'

export const name = 'deepwidgets-mcp'
export const inject = ['webServer', 'widgets']

const TOKEN_BODY_LIMIT = 4_096
/** The token file keeps the newest agents up to this count; a new token drops the oldest (decision `widget.agent_identity`: tokens only name the caller). */
const MAX_AGENTS = 64
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i
const LOOPBACK_V4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const AGENT_NAME = /^[\x20-\x7e]{1,64}$/
/** At least 16 random bytes as base64url (22 characters) or hex (32 characters). */
const CHALLENGE = /^[A-Za-z0-9_-]{22,256}$/

/** An error code of a tool answer: a runtime code, or a code of this package. */
type ToolErrorCode = WidgetErrorCode | 'stale-cursor' | 'internal-error'

/** What the agent does next, for each error code. */
const NEXT_STEP: Record<ToolErrorCode, string> = {
  'unknown-widget': 'Call widget_list and retry with an exact slug.',
  'unknown-action': 'Call widget_describe with this slug and retry with an exact action name.',
  'invalid-args': 'Fix args to match the action args schema from widget_describe, then retry.',
  'handler-error': 'The action threw. Do not retry unchanged. Tell the user the message.',
  'timeout': 'The action ran past its limit and was aborted. Its later writes were refused. Read the state with widget_describe before you retry with the same requestId.',
  'busy': 'Other writes on this widget held the queue. This call did not run. Retry shortly.',
  'idempotency-conflict': 'This requestId was used for a different call. Use a new requestId for a new operation.',
  'conflict': 'The slug already has a live registration. Pick another slug.',
  'bad-request': 'Fix the request as the message says, then retry.',
  'stale-cursor': 'The change feed was reset (a host restart or a gap). Call widget_list for the current state and use its cursor.',
  'internal-error': 'The host failed. Tell the user the message. Do not retry in a loop.',
}

interface ToolError {
  code: ToolErrorCode
  message: string
  nextStep: string
}

const tokenRowSchema = z.object({ agentId: z.string(), agent: z.string(), issuedAt: z.string() }).strict()
/** The token file: the SHA-256 hash of each bearer token to its row. The file never holds a token. */
const tokenFileSchema = z.record(z.string(), tokenRowSchema)
type TokenRow = z.infer<typeof tokenRowSchema>

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

/** True for an error of the widget runtime. The check is structural: the runtime class is not imported as a value. */
function isWidgetError(error: unknown): error is Error & { code: WidgetErrorCode } {
  if (!(error instanceof Error) || error.name !== 'WidgetError') return false
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' && Object.hasOwn(NEXT_STEP, code)
}

/**
 * True for a `Host` header of `127.0.0.1`, `localhost`, or `[::1]`, each with an optional port.
 * It refuses any other text, such as userinfo (`evil.com@127.0.0.1`), which the SDK guard accepts.
 */
export function isLoopbackHost(host: string | undefined): boolean {
  return host !== undefined && LOOPBACK_HOST.test(host)
}

/** True for a loopback socket address: 127.0.0.0/8, `::1`, or 127.0.0.0/8 mapped into IPv6. */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined) return false
  if (address === '::1') return true
  const v4 = address.toLowerCase().startsWith('::ffff:') ? address.slice(7) : address
  return LOOPBACK_V4.test(v4) && v4.split('.').every((part) => Number(part) <= 255)
}

/**
 * Wrap a zod schema so that the SDK advertises its JSON Schema but passes each input through.
 * The tool parses the input itself, so a bad input gets `invalid-args` with a `nextStep`, not
 * the SDK text error.
 */
function lenient(schema: z.ZodType): StandardSchemaWithJSON {
  const standard = schema['~standard'] as StandardSchemaWithJSON['~standard']
  return { '~standard': { ...standard, validate: (value: unknown) => ({ value }) } }
}

function toolOk(body: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(body) }], structuredContent: body }
}

function toolError(code: ToolErrorCode, message: string): CallToolResult {
  const error: ToolError = { code, message, nextStep: NEXT_STEP[code] }
  return { isError: true, content: [{ type: 'text', text: JSON.stringify({ error }) }], structuredContent: { error } }
}

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers })
  res.end(JSON.stringify(body))
}

/** Read a small request body. Gives `undefined` when the body is larger than the limit. */
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

export interface Config {
  /** The token file. Defaults to `$DSH_HOME/deepwidgets/mcp-tokens.json`. */
  tokenFile?: string
  /** The port file `{ port, nonce, pid }` for agents. Defaults to `$DSH_HOME/deepwidgets/mcp.json`. */
  portFile?: string
}

/** The port file: the port of the host web server, the nonce of this host start, and the host process id. */
export interface PortFile {
  port: number
  nonce: string
  pid: number
}

/** The proof of one token answer: HMAC-SHA256 with the nonce as key over the challenge, in hex. */
export function mcpProof(nonce: string, challenge: string): string {
  return createHmac('sha256', nonce).update(challenge).digest('hex')
}

/** True when process `pid` exists. EPERM means it exists under another user. */
function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/** The live process that owns the port file, or `undefined` when no other live host owns it. */
async function otherOwner(portFile: string): Promise<number | undefined> {
  let pid: unknown
  try {
    pid = (JSON.parse(await readFile(portFile, 'utf8')) as Partial<PortFile> | null)?.pid
  } catch {
    // A missing or unreadable file has no owner; this host replaces it.
    return undefined
  }
  if (typeof pid !== 'number' || !Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) return undefined
  return processAlive(pid) ? pid : undefined
}

/** Replace `path` in one rename with `text`, with mode 0600 in a folder of mode 0700. */
async function writeFileAtomic(path: string, text: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.${randomBytes(4).toString('hex')}.tmp`
  await writeFile(temp, text, { mode: 0o600 })
  await chmod(temp, 0o600)
  await rename(temp, path)
}

/** Remove the port file when it still names `nonce`; a later host start may have replaced it. */
async function removePortFile(portFile: string, nonce: string): Promise<void> {
  let current: unknown
  try {
    current = JSON.parse(await readFile(portFile, 'utf8'))
  } catch {
    // A missing or unreadable file names no host; there is nothing of this host to remove.
    return
  }
  if ((current as Partial<PortFile> | null)?.nonce === nonce) await unlink(portFile)
}

/**
 * Load the token file.
 * @throws {Error} when the file exists but is not a valid token file. The plugin then does not
 * load, so no request runs against a token table that lost rows.
 */
async function loadTokens(tokenFile: string): Promise<Map<string, TokenRow>> {
  let text: string
  try {
    text = await readFile(tokenFile, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return new Map()
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (cause) {
    throw new Error(`mcp: the token file ${tokenFile} is not JSON. Move it away to issue new tokens.`, { cause })
  }
  const checked = tokenFileSchema.safeParse(parsed)
  if (!checked.success) throw new Error(`mcp: the token file ${tokenFile} is not valid (${z.prettifyError(checked.error)}). Move it away to issue new tokens.`)
  return new Map(Object.entries(checked.data))
}

export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  const tokenFile = config.tokenFile ?? dshHomePath('deepwidgets', 'mcp-tokens.json')
  const portFile = config.portFile ?? dshHomePath('deepwidgets', 'mcp.json')
  const tokens = await loadTokens(tokenFile)
  /** New for each host start (each plugin start), so a stale port file or another server does not match. */
  const nonce = randomBytes(16).toString('base64url')

  // One write at a time; each write replaces the file in one rename, with mode 0600.
  let writes: Promise<void> = Promise.resolve()
  function persist(): Promise<void> {
    const text = JSON.stringify(Object.fromEntries(tokens))
    const next = writes.then(() => writeFileAtomic(tokenFile, text))
    writes = next.catch(() => undefined)
    return next
  }

  const agentOf = (authorization: string | undefined): (TokenRow & { token: string }) | undefined => {
    const token = /^Bearer (\S+)$/.exec(authorization ?? '')?.[1]
    if (token === undefined) return undefined
    const row = tokens.get(hashToken(token))
    return row === undefined ? undefined : { ...row, token }
  }

  /** Run one tool body. A runtime error keeps its code; any other error is `internal-error`. */
  async function guarded(run: () => Record<string, unknown> | Promise<Record<string, unknown>>): Promise<CallToolResult> {
    try {
      return toolOk(await run())
    } catch (error) {
      if (isWidgetError(error)) return toolError(error.code, error.message)
      ctx.logger.warn('mcp: a tool failed', error)
      return toolError('internal-error', error instanceof Error ? error.message : String(error))
    }
  }

  /** Parse the tool input with `schema`, then run the tool body through {@link guarded}. */
  function tool<S extends z.ZodType>(schema: S, run: (input: z.infer<S>) => Record<string, unknown> | Promise<Record<string, unknown>>): (input: unknown) => Promise<CallToolResult> {
    return async (input) => {
      const parsed = schema.safeParse(input ?? {})
      if (!parsed.success) return toolError('invalid-args', z.prettifyError(parsed.error))
      return guarded(() => run(parsed.data))
    }
  }

  function buildServer(agentId: string): McpServer {
    const widgets = ctx.widgets
    const listInput = z.object({})
    const describeInput = z.object({ slug: z.string() })
    const callInput = z.object({
      slug: z.string(),
      action: z.string(),
      args: z.record(z.string(), z.unknown()).optional(),
      requestId: z.string().min(1).max(100).optional(),
    })
    const changesInput = z.object({ since: z.string().optional() })
    const mcp = new McpServer(
      { name: 'deepwidgets', version: '0.0.0' },
      { instructions: 'deepWidgets: desktop widgets. Call widget_list, then widget_describe, then widget_call. Pass a new requestId on each mutation. Call widget_changes with the last cursor to see what changed.' },
    )
    mcp.registerTool('widget_list', {
      description: 'List the live widgets: slug, title, state revision, program revision. Also gives a cursor for widget_changes.',
      inputSchema: lenient(listInput),
      annotations: { readOnlyHint: true },
    }, tool(listInput, () => ({ cursor: widgets.cursor(), widgets: widgets.list() })))

    mcp.registerTool('widget_describe', {
      description: 'Describe one widget: its actions (name, kind, args JSON Schema, timeoutMs) and its current state. Call it before widget_call on a widget you have not described.',
      inputSchema: lenient(describeInput),
      annotations: { readOnlyHint: true },
    }, tool(describeInput, ({ slug }) => {
      const description = widgets.describe(slug)
      const state = widgets.get(slug)
      return { ...description, rev: state.rev, state: state.data }
    }))

    mcp.registerTool('widget_call', {
      description: 'Run one widget action. For a mutation, pass a new requestId. After a timeout, retry with the same requestId.',
      inputSchema: lenient(callInput),
    }, tool(callInput, async ({ slug, action, args, requestId }) => {
      const outcome = await widgets.call(slug, action, args ?? {}, { caller: agentId, ...(requestId === undefined ? {} : { requestId }) })
      return { ...outcome }
    }))

    mcp.registerTool('widget_changes', {
      description: 'The changes after a cursor from widget_list or an earlier widget_changes. Each change names who made it in `by`. With no cursor, it gives a cursor for now.',
      inputSchema: lenient(changesInput),
      annotations: { readOnlyHint: true },
    }, tool(changesInput, ({ since }) => {
      const out = widgets.changes(since)
      if (out.reset === true) return { ...out, error: { code: 'stale-cursor', message: 'the cursor is from another host process or too old', nextStep: NEXT_STEP['stale-cursor'] } }
      return { ...out }
    }))
    return mcp
  }

  const modern = createMcpHandler((request) => buildServer(request.authInfo?.clientId ?? 'anonymous'), {
    legacy: 'stateless',
    onerror: (error) => { ctx.logger.warn('mcp: the handler reported an error', error) },
  })
  const mcpNode = toNodeHandler(modern, { onerror: (error) => { ctx.logger.warn('mcp: the request failed', error) } })
  const validateHost = localhostHostValidation()

  /**
   * The fence, for each request on `/mcp` and `/mcp/token`:
   * - A peer that is not loopback gets 403, also when the web server binds a wider address.
   * - An MCP client is never a browser, so a request with `Origin` or `Sec-Fetch-Site` gets 403.
   * - A `Host` that is not exactly loopback gets 403, then the SDK guard checks it again.
   * @returns true when the request may go on; false when the fence answered it.
   */
  function fence(req: IncomingMessage, res: ServerResponse): boolean {
    if (!isLoopbackAddress(req.socket.remoteAddress)) {
      send(res, 403, { error: 'only loopback clients may use /mcp' })
      return false
    }
    if (req.headers.origin !== undefined || req.headers['sec-fetch-site'] !== undefined) {
      send(res, 403, { error: 'browser requests are refused' })
      return false
    }
    if (!isLoopbackHost(req.headers.host)) {
      send(res, 403, { error: 'the Host must be 127.0.0.1, localhost, or [::1]' })
      return false
    }
    return validateHost(req, res)
  }

  async function issueToken(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (req.method !== 'POST') {
      send(res, 405, { error: 'use POST' }, { allow: 'POST' })
      return
    }
    const text = await readSmallBody(req)
    if (text === undefined) {
      send(res, 413, { error: `the body is larger than ${String(TOKEN_BODY_LIMIT)} bytes` })
      return
    }
    let agent: unknown
    let challenge: unknown
    try {
      ({ agent, challenge } = (JSON.parse(text) as { agent?: unknown; challenge?: unknown } | null) ?? {})
    } catch {
      send(res, 400, { error: 'the body must be JSON { agent, challenge }' })
      return
    }
    if (typeof agent !== 'string' || !AGENT_NAME.test(agent)) {
      send(res, 400, { error: 'agent must be 1 to 64 printable ASCII characters' })
      return
    }
    if (typeof challenge !== 'string' || !CHALLENGE.test(challenge)) {
      send(res, 400, { error: 'challenge must be at least 16 random bytes as base64url or hex (22 to 256 characters of A-Z a-z 0-9 _ -)' })
      return
    }
    const token = randomBytes(24).toString('base64url')
    const base = agent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent'
    const agentId = `${base}-${randomBytes(3).toString('hex')}`
    const key = hashToken(token)
    tokens.set(key, { agentId, agent, issuedAt: new Date().toISOString() })
    // The map keeps insertion order, so the first keys are the oldest tokens.
    const dropped: [string, TokenRow][] = []
    for (const [oldKey, oldRow] of tokens) {
      if (tokens.size <= MAX_AGENTS) break
      tokens.delete(oldKey)
      dropped.push([oldKey, oldRow])
    }
    try {
      await persist()
    } catch (error) {
      // An unsaved token would stop working after a restart; do not hand it out, and keep the old rows.
      tokens.delete(key)
      const kept = [...tokens]
      tokens.clear()
      for (const [oldKey, oldRow] of [...dropped, ...kept]) tokens.set(oldKey, oldRow)
      ctx.logger.error(`mcp: the token file ${tokenFile} was not written; no token was issued`, error)
      send(res, 500, { error: 'the token was not saved; retry later' })
      return
    }
    send(res, 200, { token, agentId, proof: mcpProof(nonce, challenge) })
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!fence(req, res)) return
    const path = (req.url ?? '/').split('?')[0]
    if (path === '/mcp/token') {
      await issueToken(req, res)
      return
    }
    if (path !== '/mcp') {
      send(res, 404, { error: 'not found' })
      return
    }
    const row = agentOf(req.headers.authorization)
    if (row === undefined) {
      send(res, 401, { error: 'missing or unknown bearer token; POST /mcp/token { agent, challenge } first' }, { 'www-authenticate': 'Bearer' })
      return
    }
    // The SDK types `method` and `url` as present under exactOptionalPropertyTypes; node:http fills both for a server request.
    const authed = Object.assign(req, { auth: { token: row.token, clientId: row.agentId, scopes: [] } }) as NodeIncomingMessageLike
    await mcpNode(authed, res)
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/mcp',
    handler: (req, res) => handle(req, res).catch((error: unknown) => {
      ctx.logger.warn('mcp: a request failed', error)
      if (!res.headersSent) send(res, 500, { error: error instanceof Error ? error.message : String(error) })
      else res.end()
    }),
  }), 'mcp: the /mcp route')
  ctx.effect(() => () => modern.close(), 'mcp: close the MCP handler')
  // The route is live before the file names the port, so an agent that reads the file finds /mcp.
  await ctx.effect(async () => {
    const port = ctx.webServer.port
    if (port === undefined) throw new Error('mcp: the web server has no listening port; the port file was not written')
    // A live host owns the file (for example the desktop app while a CLI host starts); do not take it.
    const owner = await otherOwner(portFile)
    if (owner !== undefined) {
      ctx.logger.warn(`mcp: ${portFile} belongs to the live host process ${String(owner)}; this host on port ${String(port)} does not write it`)
      return () => {}
    }
    const content: PortFile = { port, nonce, pid: process.pid }
    await writeFileAtomic(portFile, `${JSON.stringify(content)}\n`)
    return async () => {
      try {
        await removePortFile(portFile, nonce)
      } catch (error) {
        ctx.logger.warn(`mcp: the port file ${portFile} was not removed`, error)
      }
    }
  }, 'mcp: the port file')
}
