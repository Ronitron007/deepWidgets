/**
 * The MCP server for widgets (`widget_mvp.mcp`). One `webServer` prefix route owns `/mcp` and
 * `/mcp/token`. Each tool calls `ctx.widgets` in this process, so the action contract (queue,
 * timeout, `requestId`, change feed) stays in the runtime.
 *
 * The port file (`widget_phase2.mcp_port`) tells agents the listening port and a random server
 * nonce. The nonce never leaves the file: `POST /mcp/token { agent, challenge }` answers
 * `proof = HMAC-SHA256(nonce, challenge)`, so an agent that checks the proof refuses a server on
 * the port that is not this host (`standing.hard.port_squat`). See README.md.
 *
 * In the desktop app, Electron main owns the port and the port file (`safe_host.port`). Electron
 * main sets `DEEPWIDGETS_MCP_FORWARDED=1` for the host. The row then writes no port file. It sends
 * `{ port, nonce, secret }` to Electron main over IPC, and it refuses each request without the
 * secret in `x-deepwidgets-forward`. A CLI host binds its port and writes the file itself.
 *
 * The tools are grouped in modes (spec `modes`). `deepwidgets_modes` lists them, and the settings
 * file `$DSH_HOME/deepwidgets/settings.json` can turn a gated mode off. The server reads that file
 * at each call of a tool that needs it, so an edit takes effect with no restart.
 * @module @deepwidgets/mcp
 */
import { execFile } from 'node:child_process'
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { chmod, mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'
import type { Context } from '@deepseek-ai/cordis'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import type {} from '@deepseek-ai/dsh-app-boot'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-plugin-manager'
import type { WidgetErrorCode } from '@deepwidgets/widgets'
import { localhostHostValidation, toNodeHandler } from '@modelcontextprotocol/node'
import type { NodeIncomingMessageLike } from '@modelcontextprotocol/node'
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import type { CallToolResult, StandardSchemaWithJSON } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { CreationError, templateFiles, widgetTypesText, WidgetInstaller } from './creation.ts'
import type { CreationErrorCode, GateName } from './creation.ts'

export const name = 'deepwidgets-mcp'
export const inject = ['webServer', 'widgets', 'widgetRecords']

const TOKEN_BODY_LIMIT = 4_096
/** Electron main sets this in the host environment (`safe_host.port`). Same name as `apps/desktop/src/deepwidgets-mcp-port.ts`. */
const FORWARDED_ENV = 'DEEPWIDGETS_MCP_FORWARDED'
/** The request header that carries the forward secret. Same name as `apps/desktop/src/deepwidgets-mcp-port.ts`. */
const FORWARD_HEADER = 'x-deepwidgets-forward'
const execFileAsync = promisify(execFile)
/** The token file keeps the newest agents up to this count; a new token drops the oldest (decision `widget.agent_identity`: tokens only name the caller). */
const MAX_AGENTS = 64
const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/i
const LOOPBACK_V4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
const AGENT_NAME = /^[\x20-\x7e]{1,64}$/
/** At least 16 random bytes as base64url (22 characters) or hex (32 characters). */
const CHALLENGE = /^[A-Za-z0-9_-]{22,256}$/
/** The slug pattern of the runtime (`deepwidgets/widgets/src/index.ts`). */
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/

/** An error code of a tool answer: a runtime code, or a code of this package. */
type ToolErrorCode = WidgetErrorCode | CreationErrorCode | 'stale-cursor' | 'internal-error' | 'mode-off'

/** What the agent does next, for each error code. */
const NEXT_STEP: Record<ToolErrorCode, string> = {
  'unknown-widget': 'Call widget_list and retry with an exact slug.',
  'unknown-action': 'Call widget_describe with this slug and retry with an exact action name.',
  'invalid-args': 'Fix args to match the action args schema from widget_describe, then retry.',
  'handler-error': 'The action threw. Do not retry unchanged. Tell the user the message.',
  'timeout': 'The action ran past its limit and was aborted. Its later writes were refused. Read the state with widget_describe before you retry with the same requestId.',
  'timeout-after-write': 'The action wrote, then ran past its limit. Its write landed at the rev in the error, and its later writes were refused. A retry with the same requestId gives this answer again. Read the state with widget_describe before you start a new operation.',
  'busy': 'Other writes on this widget held the queue. This call did not run. Retry shortly.',
  'idempotency-conflict': 'This requestId was used for a different call. Use a new requestId for a new operation.',
  'conflict': 'The slug already has a live registration. Pick another slug.',
  'bad-request': 'Fix the request as the message says, then retry.',
  'safe-mode': 'The host runs in safe mode after repeated crashes, so this widget is off. Tell the user. Do not retry until the host restarts normally.',
  'widget-failed': 'The widget crashed the host and is quarantined. Do not retry. Change its files to bring it back, or tell the user the message.',
  'stale-cursor': 'The change feed was reset (a host restart or a gap). Call widget_list for the current state and use its cursor.',
  'internal-error': 'The host failed. Tell the user the message. Do not retry in a loop.',
  'bad-source': 'Pass the absolute path of a folder that holds src/index.ts. widget_template gives the files.',
  'gate-failed': 'Fix the code at each diagnostic, then call widget_install again with the same folder. Nothing was installed.',
  'slug-taken': 'A built-in widget has this slug. Change the slug in ctx.widgets.register, then call widget_install again.',
  'slug-changed': 'widget_reload keeps the slug. Use widget_install to install a widget with a new slug.',
  'install-failed': 'Read the diagnostics. Fix the code and call widget_install again. If the diagnostics name the plugin manager or pnpm, tell the user.',
  'not-installed': 'Call widget_list. Only a widget that widget_install installed can be reloaded or removed.',
  'creation-unavailable': 'This host has no plugin manager, so it cannot install widgets. Tell the user.',
  'mode-off': 'This mode is off, and the call did nothing. Ask the user to turn the mode on: set the setting to true in the settings file. Do not change the file yourself. The next call reads the file again, with no restart.',
}

interface ToolError {
  code: ToolErrorCode
  message: string
  nextStep: string
  /** The state revision after the call, for `timeout-after-write`. */
  rev?: number
  /** The creation gate that refused the code. */
  gate?: GateName
  diagnostics?: string[]
  /** For `mode-off`: the mode that is off, its setting, and the settings file. */
  mode?: GatedMode
  setting?: string
  settingsFile?: string
}

interface ModeSpec {
  readonly name: string
  readonly goal: string
  /** The dotted key in the settings file that turns the mode off, or null when the mode is always on. */
  readonly setting: string | null
  readonly tools: readonly string[]
}

/**
 * The modes, in the order of `modes.list`. `kit`, `library`, and `plugin` join this list when their stage ships.
 * `widget_list` and `widget_guide` are shared and belong to no mode.
 */
const MODES = [
  { name: 'interact', goal: 'Use widgets that exist', setting: null, tools: ['widget_describe', 'widget_call', 'widget_changes'] },
  { name: 'create', goal: 'Write, change, or remove a widget', setting: 'modes.create', tools: ['widget_template', 'widget_install', 'widget_reload', 'widget_remove'] },
] as const satisfies readonly ModeSpec[]
type Mode = (typeof MODES)[number]
type ModeName = Mode['name']
/** A mode that a setting can turn off (`modes.terms`). */
type GatedSpec = Extract<Mode, { setting: string }>
type GatedMode = GatedSpec['name']
const MODE_NAMES = MODES.map((mode) => mode.name) as [ModeName, ...ModeName[]]
/** The setting of each gated mode, from {@link MODES}. */
const SETTING_OF = Object.fromEntries(MODES.filter((mode): mode is GatedSpec => mode.setting !== null).map((mode) => [mode.name, mode.setting])) as Record<GatedMode, string>

/** The settings file (`modes.settings`). Other keys are for later stages; this stage ignores them. */
const settingsSchema = z.object({ modes: z.object({ create: z.boolean().optional() }).optional() })

/** The settings at one tool call. `error` is set when the file exists and does not parse; then each mode is on. */
interface Settings {
  on: Record<GatedMode, boolean>
  error?: string
}

/**
 * Read the settings file. A missing file or key means that each mode is on. A file that can not be read or parsed
 * also turns no mode off, so a broken file never locks the agent out; `deepwidgets_modes` reports its error.
 */
async function readSettings(file: string): Promise<Settings> {
  const allOn: Settings['on'] = { create: true }
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { on: allOn }
    return { on: allOn, error: `the settings file could not be read: ${error instanceof Error ? error.message : String(error)}` }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return { on: allOn, error: `the settings file is not JSON: ${error instanceof Error ? error.message : String(error)}` }
  }
  const checked = settingsSchema.safeParse(parsed)
  if (!checked.success) return { on: allOn, error: `the settings file does not match { "modes": { "create": true } }: ${z.prettifyError(checked.error)}` }
  return { on: { create: checked.data.modes?.create ?? true } }
}

/** The guide of the mode `interact` (`modes.guide`): the rules that the server instructions held before the modes. */
const INTERACT_GUIDE = `# Using widgets

1. Call widget_list. It gives the live widgets and a cursor for widget_changes.
2. Call widget_describe with a slug before you call an action of that widget. It gives the actions, their args JSON Schema, and the state.
3. Call widget_call to run one action. Pass a new requestId on each mutation. After a timeout, retry with the same requestId.
4. Call widget_changes with the last cursor, from widget_list or from the last widget_changes, to see what changed. Each change names who made it in \`by\`.
5. A tool error gives code, message, and nextStep. Do what nextStep says.
6. widget_describe gives \`source\` for a widget that widget_install installed: the folder of its files. To change that widget, use the mode create.
`

/** The text of `widget_guide` before the OpenUI guide: the widget API (`widget_phase2.creation.tools`). */
const WIDGET_API_GUIDE = `# Writing a widget

A widget is one TypeScript bundle: src/index.ts. It exports name, inject = ['widgets', 'timer'], and apply(ctx).
apply calls ctx.widgets.register once. The definition has a slug, a title, a program, an initial state, and actions.
An action is a query (reads the state) or a mutation (writes with w.update). The window and the agent run the same actions.

Steps:
1. Call widget_template. Write its files into an empty folder. Change the slug, title, state, actions, and program.
2. Call widget_install with the absolute folder path. The gates compile, lint, type-check, and test-run the code.
3. Check the widget: widget_describe, then widget_call each action.
4. To change the code, edit the files and call widget_reload with the slug. widget_install of the same slug replaces it too.
5. widget_remove removes the bundle. The state stays.

Rules that the gates check:
- No raw setTimeout, setInterval, setImmediate, or queueMicrotask, also not as globalThis.setTimeout, window.setTimeout, or self.setTimeout. Use ctx.timeout and ctx.interval: they stop with the widget.
- Await each promise, or end it with .catch(). An unhandled rejection ends the host.
- No loop without an exit, such as while (true) with no break. A loop that blocks stops every widget.
- apply must not throw. Each action is called once with {} (an action whose args schema refuses {} is not called), then timers run for 1.5 s. The heap limit is 256 MB.
- Only zod and the types of deepwidgets:widget can be imported. Node built-in modules are not in the types.
- The web globals are typed and work: fetch, Request, Response, Headers, URL, AbortController, TextEncoder, TextDecoder, and console. The code runs in the Node host, so window, document, and self do not exist at run time.

The types of the widget API (import type { WidgetContext } from 'deepwidgets:widget'):

\`\`\`ts
TYPES
\`\`\`

# The program: OpenUI Lang

The program is the UI text of the widget. Query("<action>", args, default) runs a query action. Mutation("<action>", args) runs a mutation action.
`

/** The text of `widget_guide`: the widget API, then the OpenUI guide of the component set that the shell generated. */
async function guideText(): Promise<string> {
  const require = createRequire(import.meta.url)
  const file = join(dirname(require.resolve('@deepwidgets/shell/package.json')), 'dist', 'guide.md')
  const openui = await readFile(file, 'utf8')
  return WIDGET_API_GUIDE.replace('TYPES', (await widgetTypesText()).trim()) + openui
}

/** `epoch` names the host start that issued the token; rows of an earlier start (or with no epoch) are void. */
const tokenRowSchema = z.object({ agentId: z.string(), agent: z.string(), issuedAt: z.string(), epoch: z.string().optional() }).strict()
/** The token file: the SHA-256 hash of each bearer token to its row. The file never holds a token. */
const tokenFileSchema = z.record(z.string(), tokenRowSchema)
type TokenRow = z.infer<typeof tokenRowSchema>

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex')

/** True for an error of the widget runtime. The check is structural: the runtime class is not imported as a value. */
function isWidgetError(error: unknown): error is Error & { code: WidgetErrorCode, rev?: number | undefined } {
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

function toolError(code: ToolErrorCode, message: string, extra: { rev?: number | undefined, gate?: GateName | undefined, diagnostics?: string[], nextStep?: string | undefined, mode?: GatedMode, setting?: string, settingsFile?: string } = {}): CallToolResult {
  const error: ToolError = { code, message, nextStep: extra.nextStep ?? NEXT_STEP[code] }
  if (extra.rev !== undefined) error.rev = extra.rev
  if (extra.gate !== undefined) error.gate = extra.gate
  if (extra.diagnostics !== undefined) error.diagnostics = extra.diagnostics
  if (extra.mode !== undefined) error.mode = extra.mode
  if (extra.setting !== undefined) error.setting = extra.setting
  if (extra.settingsFile !== undefined) error.settingsFile = extra.settingsFile
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
  /** The settings file of the modes (`modes.settings`). Defaults to `$DSH_HOME/deepwidgets/settings.json`. */
  settingsFile?: string
  /**
   * Electron main forwards each request (`safe_host.port`). Defaults to `DEEPWIDGETS_MCP_FORWARDED=1`
   * with an IPC channel to the parent process.
   */
  forwarded?: boolean
}

/** The IPC message to Electron main: the route of this host start, or null when the row disposes. */
interface ForwardMessage {
  type: 'deepwidgets-mcp'
  mcp: { port: number; nonce: string; secret: string } | null
}

function sendToMain(message: ForwardMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.connected || process.send === undefined) { resolve(); return }
    process.send(message, (error: Error | null) => { if (error === null) resolve(); else reject(error) })
  })
}

/** True when `value` is the forward secret, in constant time. */
function sameSecret(value: string | string[] | undefined, secret: string): boolean {
  if (typeof value !== 'string') return false
  const got = Buffer.from(value)
  const want = Buffer.from(secret)
  return got.length === want.length && timingSafeEqual(got, want)
}

/** The port file: the port of the host web server, the nonce of this host start, the host process id, and its start time. */
export interface PortFile {
  port: number
  nonce: string
  pid: number
  /** The start of the host process in ms since the epoch, so a reused pid does not count as the owner. */
  started: number
}

/** How far the start time from `ps` may differ from the recorded one; `ps` gives whole seconds. */
const START_TOLERANCE_MS = 3_000

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

/** The start of process `pid` in ms since the epoch, from `ps -o etime=`; undefined when `ps` cannot tell. */
async function processStartMs(pid: number): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'etime=', '-p', String(pid)], { env: { ...process.env, LC_ALL: 'C' } })
    const match = /^\s*(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)\s*$/.exec(stdout)
    if (match === null) return undefined
    const [, days = '0', hours = '0', minutes = '0', seconds = '0'] = match
    return Date.now() - (((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000
  } catch {
    // ps is missing or the process ended; the caller falls back to the pid check.
    return undefined
  }
}

/** True when the process of a port file is alive and is the same process: its start time matches. */
async function ownerAlive(pid: number, started: unknown): Promise<boolean> {
  if (!processAlive(pid)) return false
  if (typeof started !== 'number') return true
  const actual = await processStartMs(pid)
  // ps rounds the elapsed time down, so the actual start may look up to a second later.
  return actual === undefined || Math.abs(actual - started) <= START_TOLERANCE_MS
}

/** The live process that owns the port file, or `undefined` when no other live host owns it. */
async function otherOwner(portFile: string): Promise<number | undefined> {
  let current: Partial<PortFile> | null
  try {
    current = JSON.parse(await readFile(portFile, 'utf8')) as Partial<PortFile> | null
  } catch {
    // A missing or unreadable file has no owner; this host replaces it.
    return undefined
  }
  const pid = current?.pid
  if (typeof pid !== 'number' || !Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) return undefined
  return await ownerAlive(pid, current?.started) ? pid : undefined
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
  const settingsFile = config.settingsFile ?? dshHomePath('deepwidgets', 'settings.json')
  /** New for each host start (each plugin start), so a stale port file or another server does not match. */
  const nonce = randomBytes(16).toString('base64url')
  const forwarded = config.forwarded ?? (process.env[FORWARDED_ENV] === '1' && process.connected)
  /** Electron main adds this to each request it forwards; it is new for each host start and never leaves the IPC channel. */
  const secret = randomBytes(32).toString('base64url')
  /** Names this host start in the token rows. It is not secret; the nonce stays only in the port file. */
  const epoch = randomBytes(16).toString('hex')
  const tokens = await loadTokens(tokenFile)
  // A token of an earlier start is void: after a restart an agent does a new handshake with a proof.
  for (const [key, row] of tokens) if (row.epoch !== epoch) tokens.delete(key)

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
    return row === undefined || row.epoch !== epoch ? undefined : { ...row, token }
  }

  /** Run one tool body. A runtime error keeps its code; any other error is `internal-error`. */
  async function guarded(run: () => Record<string, unknown> | Promise<Record<string, unknown>>): Promise<CallToolResult> {
    try {
      return toolOk(await run())
    } catch (error) {
      if (isWidgetError(error)) return toolError(error.code, error.message, { rev: error.rev })
      if (error instanceof CreationError) return toolError(error.code, error.message, { gate: error.gate, diagnostics: error.diagnostics, nextStep: error.nextStep })
      ctx.logger.warn('mcp: a tool failed', error)
      return toolError('internal-error', error instanceof Error ? error.message : String(error))
    }
  }

  /**
   * Parse the tool input with `schema`, then run the tool body through {@link guarded}. With `mode`, the call first
   * reads the settings file and does nothing when that mode is off (`modes.refusal`).
   */
  function tool<S extends z.ZodType>(schema: S, run: (input: z.infer<S>) => Record<string, unknown> | Promise<Record<string, unknown>>, options: { mode?: GatedMode, invalidNextStep?: string } = {}): (input: unknown) => Promise<CallToolResult> {
    return async (input) => {
      const { mode } = options
      if (mode !== undefined && !(await readSettings(settingsFile)).on[mode]) {
        const setting = SETTING_OF[mode]
        return toolError('mode-off', `the mode ${mode} is off: the setting ${setting} is false in ${settingsFile}`, { mode, setting, settingsFile })
      }
      const parsed = schema.safeParse(input ?? {})
      if (!parsed.success) return toolError('invalid-args', z.prettifyError(parsed.error), { nextStep: options.invalidNextStep })
      return guarded(() => run(parsed.data))
    }
  }

  /** The answer of `deepwidgets_modes`, made from the settings file as it is at this call (`modes.tool`). */
  async function modesAnswer(): Promise<Record<string, unknown>> {
    const settings = await readSettings(settingsFile)
    const modes = MODES.map((mode) => ({
      name: mode.name,
      goal: mode.goal,
      on: mode.setting === null ? true : settings.on[mode.name],
      setting: mode.setting,
      tools: mode.tools,
      guide: { tool: 'widget_guide', args: { mode: mode.name } },
    }))
    return settings.error === undefined ? { modes, settingsFile } : { modes, settingsFile, settingsError: settings.error }
  }

  function buildServer(agentId: string): McpServer {
    const widgets = ctx.widgets
    const listInput = z.object({})
    const guideInput = z.object({ mode: z.enum(MODE_NAMES) })
    const describeInput = z.object({ slug: z.string() })
    const callInput = z.object({
      slug: z.string(),
      action: z.string(),
      args: z.record(z.string(), z.unknown()).optional(),
      requestId: z.string().min(1).max(100).optional(),
    })
    const changesInput = z.object({ since: z.string().optional() })
    const templateInput = z.object({ slug: z.string().regex(SLUG).optional(), title: z.string().min(1).max(80).optional() })
    const installInput = z.object({ dir: z.string().min(1) })
    const slugInput = z.object({ slug: z.string().regex(SLUG) })
    const mcp = new McpServer(
      { name: 'deepwidgets', version: '0.0.0' },
      // modes.instructions: Claude Code reads this text once, at connect, so it holds no fact that can go stale.
      { instructions: 'Call deepwidgets_modes first.' },
    )
    mcp.registerTool('deepwidgets_modes', {
      description: 'List the modes of this server: for each mode its goal, whether it is on, the setting that turns it off, its tools, and its guide. Also gives the path of the settings file. Call it first.',
      inputSchema: lenient(listInput),
      annotations: { readOnlyHint: true },
    }, tool(listInput, modesAnswer))

    mcp.registerTool('widget_list', {
      description: 'List the live widgets: slug, title, state revision, program revision. Also gives a cursor for widget_changes.',
      inputSchema: lenient(listInput),
      annotations: { readOnlyHint: true },
    }, tool(listInput, () => ({ cursor: widgets.cursor(), widgets: widgets.list() })))

    mcp.registerTool('widget_describe', {
      description: 'Describe one widget: its actions (name, kind, args JSON Schema, timeoutMs) and its current state. For a widget that widget_install installed, `source` is the absolute folder of its files. Call it before widget_call on a widget you have not described.',
      inputSchema: lenient(describeInput),
      annotations: { readOnlyHint: true },
    }, tool(describeInput, async ({ slug }) => {
      const description = widgets.describe(slug)
      // modes.source: only an agent bundle has a source folder; a built-in widget such as sample has none.
      const source = await installer?.source(slug)
      const located = source === undefined ? { ...description } : { ...description, source }
      // A widget that is off has no state to read; `off` gives the reason.
      if (description.off !== undefined) return located
      const state = widgets.get(slug)
      return { ...located, rev: state.rev, state: state.data }
    }))

    mcp.registerTool('widget_call', {
      description: 'Run one widget action. For a mutation, pass a new requestId. After a timeout, retry with the same requestId.',
      inputSchema: lenient(callInput),
    }, tool(callInput, async ({ slug, action, args, requestId }) => {
      const outcome = await widgets.call(slug, action, args ?? {}, { caller: agentId, ...(requestId === undefined ? {} : { requestId }) })
      // widget_fv.action: a replay whose answer was lost says so, with the rev of its write.
      if (outcome.resultLost === true) return { ...outcome, nextStep: 'The call wrote before a host restart, and its answer was lost. Read the state with widget_describe. Do not send this requestId again for a new operation.' }
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

    mcp.registerTool('widget_template', {
      description: 'Give the files of the TypeScript widget template, with the slug and title filled in. Write them into an empty folder, change them, then call widget_install with the absolute folder path.',
      inputSchema: lenient(templateInput),
      annotations: { readOnlyHint: true },
    }, tool(templateInput, async ({ slug, title }) => {
      const files = await templateFiles(slug ?? 'my-widget', title ?? 'My widget')
      return { files, nextStep: 'Write each file under one empty folder (src/index.ts), change it, then call widget_install with the absolute folder path. Call widget_guide with mode "create" for the API and the components.' }
    }))

    mcp.registerTool('widget_guide', {
      description: 'Give the guide of one mode. interact: how to list, describe, call, and follow widgets. create: the widget API types, the rules that the install gates check, and the OpenUI Lang guide of the component set for the program.',
      inputSchema: lenient(guideInput),
      annotations: { readOnlyHint: true },
    }, tool(guideInput, async ({ mode }) => ({ mode, guide: mode === 'interact' ? INTERACT_GUIDE : await guideText() }), {
      invalidNextStep: 'Pass mode: interact or create. deepwidgets_modes lists the modes.',
    }))

    mcp.registerTool('widget_install', {
      description: 'Install the widget in a folder (absolute path, with src/index.ts). The gates compile, lint, type-check, and test-run the code first; code that fails a gate is not installed. A second install of the same slug replaces the bundle; the state stays.',
      inputSchema: lenient(installInput),
    }, tool(installInput, async ({ dir }) => ({ ...await creator().install(dir), nextStep: 'Call widget_describe with the slug, then widget_call each action to check it.' }), { mode: 'create' }))

    mcp.registerTool('widget_reload', {
      description: 'Run the gates again on the folder that the widget was installed from, and replace the bundle. Use it after you edit the files. The state stays.',
      inputSchema: lenient(slugInput),
    }, tool(slugInput, async ({ slug }) => ({ ...await creator().reload(slug), nextStep: 'Call widget_describe with the slug, then widget_call the changed actions.' }), { mode: 'create' }))

    mcp.registerTool('widget_remove', {
      description: 'Remove the bundle of a widget that widget_install installed. Its window closes. The state stays, so a later install of the slug gets it back.',
      inputSchema: lenient(slugInput),
    }, tool(slugInput, async ({ slug }) => ({ ...await creator().remove(slug) }), { mode: 'create' }))
    return mcp
  }

  /** The installer, while the plugin manager and the profile are there (`widget_phase2.creation`). */
  let installer: WidgetInstaller | undefined
  function creator(): WidgetInstaller {
    if (installer === undefined) throw new CreationError('creation-unavailable', 'the host has no plugin manager or no profile')
    return installer
  }
  ctx.inject(['pluginManager', 'profileContext'], (inner) => {
    installer = new WidgetInstaller({
      pluginManager: inner.pluginManager,
      profileDir: inner.profileContext.dir,
      widgets: ctx.widgets,
      records: ctx.widgetRecords,
    })
    inner.effect(() => () => { installer = undefined }, 'mcp: the widget installer')
  })

  const modern = createMcpHandler((request) => buildServer(request.authInfo?.clientId ?? 'anonymous'), {
    legacy: 'stateless',
    onerror: (error) => { ctx.logger.warn('mcp: the handler reported an error', error) },
  })
  const mcpNode = toNodeHandler(modern, { onerror: (error) => { ctx.logger.warn('mcp: the request failed', error) } })
  const validateHost = localhostHostValidation()

  /**
   * The fence, for each request on `/mcp` and `/mcp/token`:
   * - In the desktop app, a request without the forward secret gets 403: only Electron main may call this port.
   * - A peer that is not loopback gets 403, also when the web server binds a wider address.
   * - An MCP client is never a browser, so a request with `Origin` or `Sec-Fetch-Site` gets 403.
   * - A `Host` that is not exactly loopback gets 403, then the SDK guard checks it again.
   * @returns true when the request may go on; false when the fence answered it.
   */
  function fence(req: IncomingMessage, res: ServerResponse): boolean {
    if (forwarded && !sameSecret(req.headers[FORWARD_HEADER], secret)) {
      send(res, 403, { error: 'use the port of mcp.json; this port takes only requests that the desktop app forwards' })
      return false
    }
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
    tokens.set(key, { agentId, agent, issuedAt: new Date().toISOString(), epoch })
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
      // Hand out only a token that the file holds; keep the old rows.
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
    if (forwarded) {
      // Electron main writes the port file with its own port and this nonce, then forwards to this port.
      await sendToMain({ type: 'deepwidgets-mcp', mcp: { port, nonce, secret } })
      return async () => {
        try {
          await sendToMain({ type: 'deepwidgets-mcp', mcp: null })
        } catch (error) {
          ctx.logger.warn('mcp: Electron main did not get the end of the route', error)
        }
      }
    }
    // A live host owns the file (for example the desktop app while a CLI host starts); do not take it.
    const owner = await otherOwner(portFile)
    if (owner !== undefined) {
      ctx.logger.warn(`mcp: ${portFile} belongs to the live host process ${String(owner)}; this host on port ${String(port)} does not write it`)
      return () => {}
    }
    const content: PortFile = { port, nonce, pid: process.pid, started: Math.round(performance.timeOrigin) }
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
