/**
 * deepWidgets: Electron main owns the MCP port (`safe_host.port` in `docs/specs/safe-host.md`).
 * Electron main listens on `DEEPWIDGETS_MCP_PORT` (default 47615) and forwards each request to the current Host.
 * The Host listens on a port that the OS picks, and the MCP row tells Electron main that port, its nonce, and its
 * forward secret over IPC. Electron main adds the secret to each forwarded request; the Host refuses a request
 * without it. Electron main writes `$DSH_HOME/deepwidgets/mcp.json` with its own port, and only Electron main
 * removes that file. When a request does not reach a Host (no Host is ready, or the connection to it fails), it
 * gets 503 with `Retry-After: 1`. When the Host connection fails after Electron main connected, the request may
 * have run. A GET or HEAD is safe to retry, so it gets 503 with `Retry-After: 1`. Another method gets 502 with no
 * `Retry-After`. Electron main refuses a WebSocket upgrade with 400.
 * Each Host process gets its own link, so a later handover (`handover.order`) can make the new Host current while
 * the old one disposes.
 * The module imports only Node built-in modules and `./deepwidgets-port-file.ts`.
 * @module deepwidgets-mcp-port
 */
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { Agent, createServer, request as httpRequest } from 'node:http'
import type { IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders, Server, ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { pipeline, type Duplex } from 'node:stream'
import { parseEnv } from 'node:util'
import { mcpPortFileOwnerAlive, mcpPortFilePath, removeDeadMcpPortFile } from './deepwidgets-port-file.ts'

/** The default port, when `DEEPWIDGETS_MCP_PORT` is not set. */
export const DEFAULT_MCP_PORT = 47615

/** Electron main sets this in the Host environment. The MCP row then sends its port over IPC and checks the forward header. */
export const MCP_FORWARDED_ENV = 'DEEPWIDGETS_MCP_FORWARDED'

/** The request header that carries the forward secret of the current Host. The MCP row reads the same name. */
export const MCP_FORWARD_HEADER = 'x-deepwidgets-forward'

/** A header on each answer that Electron main makes itself (403, 503), so a check can tell it from a Host answer. */
export const MCP_ANSWER_HEADER = 'x-deepwidgets-answer'

/** The seconds in `Retry-After` while no Host is ready (`safe_host.provisional`). */
export const RETRY_AFTER_SECONDS = 1

/**
 * Read the port setting `DEEPWIDGETS_MCP_PORT`. `0` lets the OS pick a port; checks use it to run beside a live app.
 * @param env - The environment after the `.env` layers are applied.
 * @returns The port to bind.
 * @throws {Error} when the value is not an integer from 0 to 65535. The app then does not start.
 */
export function resolveMcpPort(env: NodeJS.ProcessEnv): number {
  const raw = env.DEEPWIDGETS_MCP_PORT
  if (raw === undefined || raw.trim() === '') return DEFAULT_MCP_PORT
  const port = Number(raw)
  if (!/^\d+$/u.test(raw.trim()) || !Number.isSafeInteger(port) || port > 65535) {
    throw new Error(`deepwidgets: DEEPWIDGETS_MCP_PORT=${JSON.stringify(raw)} is not a port; set an integer from 0 to 65535, or remove it to use ${String(DEFAULT_MCP_PORT)}`)
  }
  return port
}

/**
 * The port setting with the `.env` layers of the Host: the environment wins, then each file in order.
 * A missing or unreadable file gives nothing.
 * @param env - The environment that starts the Host.
 * @param envFiles - The `.env` files, the highest rank first: the profile folder, then `$DSH_HOME`.
 */
export function resolveLayeredMcpPort(env: NodeJS.ProcessEnv, envFiles: readonly string[]): number {
  if (env.DEEPWIDGETS_MCP_PORT !== undefined) return resolveMcpPort(env)
  for (const file of envFiles) {
    let text: string
    try { text = readFileSync(file, 'utf8') } catch { continue }
    const value = parseEnv(text).DEEPWIDGETS_MCP_PORT
    if (value !== undefined) return resolveMcpPort({ DEEPWIDGETS_MCP_PORT: value })
  }
  return DEFAULT_MCP_PORT
}

const LOOPBACK_HOST = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/iu
const LOOPBACK_V4 = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/u

/** True for a `Host` header of `127.0.0.1`, `localhost`, or `[::1]`, each with an optional port. Same rule as `@deepwidgets/mcp`. */
export function isLoopbackHost(host: string | undefined): boolean {
  if (host === undefined || !LOOPBACK_HOST.test(host)) return false
  const port = /:(\d+)$/u.exec(host)?.[1]
  return port === undefined || Number(port) <= 65535
}

/** True for a loopback socket address: 127.0.0.0/8, `::1`, or 127.0.0.0/8 mapped into IPv6. Same rule as `@deepwidgets/mcp`. */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (address === undefined) return false
  if (address === '::1') return true
  const v4 = address.toLowerCase().startsWith('::ffff:') ? address.slice(7) : address
  return LOOPBACK_V4.test(v4) && v4.split('.').every(part => Number(part) <= 255)
}

/**
 * The fence of `widget_mvp.mcp`, now in Electron main (`safe_host.port`).
 * @returns the reason of a refusal, or undefined when the request may go on.
 */
export function fenceRefusal(
  request: { socket: { remoteAddress?: string | undefined }; headers: IncomingHttpHeaders },
): string | undefined {
  if (!isLoopbackAddress(request.socket.remoteAddress)) return 'only loopback clients may use this port'
  if (request.headers.origin !== undefined || request.headers['sec-fetch-site'] !== undefined) return 'browser requests are refused'
  if (!isLoopbackHost(request.headers.host)) return 'the Host must be 127.0.0.1, localhost, or [::1]'
  return undefined
}

/** What the MCP row of one Host tells Electron main when its route is live. */
export interface HostMcp {
  /** The loopback port of the Host web server. */
  readonly port: number
  /** The nonce of the port file proof (`widget_phase2.mcp_port`). */
  readonly nonce: string
  /** The forward secret: the Host takes only requests with this value in {@link MCP_FORWARD_HEADER}. */
  readonly secret: string
}

/** True when `value` is a {@link HostMcp}. */
export function isHostMcp(value: unknown): value is HostMcp {
  if (typeof value !== 'object' || value === null) return false
  const { port, nonce, secret } = value as Record<string, unknown>
  return typeof port === 'number' && Number.isSafeInteger(port) && port > 0 && port <= 65535
    && typeof nonce === 'string' && nonce.length >= 16 && typeof secret === 'string' && secret.length >= 32
}

/** The link of one Host process to the port owner. */
export interface McpHostLink {
  /**
   * The MCP row of this Host is live (`mcp`), or gone (`null`: the row disposed, or the Host exited).
   * A live link becomes the current target. A `null` from a link that is not current changes nothing.
   */
  update(mcp: HostMcp | null): void
}

/** Hop-by-hop headers (RFC 9110 section 7.6.1), which a proxy does not forward. */
const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade'])

function endToEnd(headers: IncomingHttpHeaders): OutgoingHttpHeaders {
  const named = new Set((headers.connection ?? '').split(',').map(name => name.trim().toLowerCase()).filter(name => name !== ''))
  const out: OutgoingHttpHeaders = {}
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined || HOP_BY_HOP.has(name) || named.has(name)) continue
    out[name] = value
  }
  return out
}

function answer(res: ServerResponse, status: number, body: Record<string, unknown>, headers: OutgoingHttpHeaders = {}): void {
  if (res.headersSent) { res.destroy(); return }
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', [MCP_ANSWER_HEADER]: 'electron-main', ...headers })
  res.end(JSON.stringify(body))
}

function unavailable(res: ServerResponse): void {
  answer(res, 503, { error: 'the deepWidgets host is not ready; retry after the Retry-After seconds' }, { 'retry-after': String(RETRY_AFTER_SECONDS) })
}

/** The answer to a WebSocket upgrade: this port serves only plain HTTP. */
const UPGRADE_REFUSAL = [
  'HTTP/1.1 400 Bad Request',
  'content-type: application/json',
  `${MCP_ANSWER_HEADER}: electron-main`,
  'connection: close',
  '',
  JSON.stringify({ error: 'this port does not take a WebSocket upgrade' }),
].join('\r\n')

/** The port file content. `pid` and `started` name Electron main, the owner of the port. */
interface PortFile {
  port: number
  nonce: string
  pid: number
  started: number
}

export interface McpPortOwnerOptions {
  /** The port to listen on; 0 lets the OS pick one. */
  readonly port: number
  /** `$DSH_HOME/deepwidgets/mcp.json`. */
  readonly portFile: string
  /** One line for each owner event. Defaults to `console.log`. */
  readonly log?: (line: string) => void
}

/** The MCP port of Electron main and the port file. */
export class McpPortOwner {
  private readonly server: Server
  /** No keep-alive: each request connects again, so a connect error always means that the request did not reach a Host. */
  private readonly agent = new Agent({ keepAlive: false })
  private readonly log: (line: string) => void
  private current: { link: McpHostLink; mcp: HostMcp } | undefined
  private listening: number | undefined
  /** The nonce of the file that this process wrote last, so that close removes only its own file. */
  private written: string | undefined
  private closed = false
  private readonly started = Math.round(performance.timeOrigin)
  private readonly options: McpPortOwnerOptions

  /** @param options - The port, the port file, and the log sink. */
  constructor(options: McpPortOwnerOptions) {
    this.options = options
    this.log = options.log ?? ((line) => { console.log(line) })
    this.server = createServer((req, res) => { this.handle(req, res) })
    // Without this listener, node:http gives an upgrade request to the handler, and the Host gets it as a plain request.
    this.server.on('upgrade', (_req: IncomingMessage, socket: Duplex) => {
      socket.on('error', () => { /* The client left. */ })
      socket.end(UPGRADE_REFUSAL)
    })
  }

  /** The listening port, after {@link listen}. */
  get port(): number | undefined { return this.listening }

  /**
   * Listen on the loopback address.
   * @returns the listening port.
   * @throws the listen error, for example `listen EADDRINUSE`. The app then fails loudly at start.
   */
  listen(): Promise<number> {
    return new Promise((resolve, reject) => {
      const failed = (error: Error): void => { reject(error) }
      this.server.once('error', failed)
      this.server.listen(this.options.port, '127.0.0.1', () => {
        this.server.off('error', failed)
        this.server.on('error', (error) => { this.event('error', { message: error.message }) })
        const address = this.server.address()
        this.listening = typeof address === 'object' && address !== null ? address.port : this.options.port
        this.event('listen', { port: this.listening })
        resolve(this.listening)
      })
    })
  }

  /** A new link for one Host process. */
  link(): McpHostLink {
    const link: McpHostLink = {
      update: (mcp) => {
        if (this.closed) return
        if (mcp === null) {
          if (this.current?.link !== link) return
          this.current = undefined
          this.event('host-gone')
          return
        }
        // The file names the nonce before the first request reaches this Host, so a client that reads the file
        // after it gets a 200 always has the nonce of the Host that answered.
        this.writePortFile(mcp.nonce)
        this.current = { link, mcp }
        this.event('host-ready', { hostPort: mcp.port })
      },
    }
    return link
  }

  /** Stop listening, end the open connections, and remove the port file of this process. */
  close(): void {
    if (this.closed) return
    this.closed = true
    this.current = undefined
    this.removePortFile()
    this.server.close()
    this.server.closeAllConnections()
    this.agent.destroy()
  }

  private event(name: string, detail: Record<string, unknown> = {}): void {
    this.log(`deepwidgets-mcp-port ${JSON.stringify({ at: Date.now(), event: name, ...detail })}`)
  }

  private handle(req: IncomingMessage, res: ServerResponse): void {
    const refusal = fenceRefusal(req)
    if (refusal !== undefined) {
      req.resume()
      answer(res, 403, { error: refusal })
      return
    }
    const target = this.current?.mcp
    if (target === undefined) {
      req.resume()
      unavailable(res)
      return
    }
    const headers = endToEnd(req.headers)
    headers[MCP_FORWARD_HEADER] = target.secret
    const upstream = httpRequest({ host: '127.0.0.1', port: target.port, method: req.method, path: req.url, headers, agent: this.agent })
    let connected = false
    upstream.on('socket', (socket) => {
      if (!socket.connecting) connected = true
      else socket.once('connect', () => { connected = true })
    })
    upstream.on('response', (response) => {
      res.writeHead(response.statusCode ?? 502, endToEnd(response.headers))
      // A server-sent event stream must reach the client before the first event.
      res.flushHeaders()
      pipeline(response, res, () => { /* A client that left, or a Host that died, ends this response. */ })
    })
    upstream.on('error', (error: NodeJS.ErrnoException) => {
      if (res.headersSent) { res.destroy(); return }
      // The connect failed, so the request never reached a Host: the Host died before Electron main saw its exit.
      if (!connected) { unavailable(res); return }
      // The Host may have run the request. A safe method may run again; a client must not retry another one blindly.
      if (req.method === 'GET' || req.method === 'HEAD') { unavailable(res); return }
      answer(res, 502, { error: `the deepWidgets host did not answer; the request may have run: ${error.message}` })
    })
    // A client that leaves ends the Host request too, so a long stream of the Host does not stay open.
    res.on('close', () => { if (!res.writableFinished) upstream.destroy() })
    pipeline(req, upstream, () => { /* The upstream error handler answers the client. */ })
  }

  private readPortFile(): Partial<PortFile> | undefined {
    try {
      return JSON.parse(readFileSync(this.options.portFile, 'utf8')) as Partial<PortFile>
    } catch {
      // Missing or not JSON: it names no live owner.
      return undefined
    }
  }

  private writePortFile(nonce: string): void {
    const port = this.listening
    if (port === undefined) return
    const file = this.options.portFile
    const current = this.readPortFile()
    const pid = current?.pid
    if (typeof pid === 'number' && pid !== process.pid && mcpPortFileOwnerAlive(pid, current?.started)) {
      // A live CLI Host on the same home owns the file; do not take it (`widget_phase2.mcp_port`).
      this.event('port-file-kept', { owner: pid })
      return
    }
    const content: PortFile = { port, nonce, pid: process.pid, started: this.started }
    try {
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 })
      const temp = join(dirname(file), `.mcp.json.${randomBytes(4).toString('hex')}.tmp`)
      writeFileSync(temp, `${JSON.stringify(content)}\n`, { mode: 0o600 })
      chmodSync(temp, 0o600)
      renameSync(temp, file)
      this.written = nonce
    } catch (error) {
      this.event('port-file-failed', { message: error instanceof Error ? error.message : String(error) })
    }
  }

  private removePortFile(): void {
    if (this.written === undefined || !existsSync(this.options.portFile)) return
    const current = this.readPortFile()
    if (current?.pid !== process.pid || current.nonce !== this.written) return
    try {
      unlinkSync(this.options.portFile)
      this.event('port-file-removed')
    } catch (error) {
      this.event('port-file-failed', { message: error instanceof Error ? error.message : String(error) })
    }
  }
}

/**
 * Start the port owner of the desktop app: remove a port file whose owner is dead, read the port setting, and listen.
 * @param environment - The Host environment: its `DSH_HOME` names the port file, and it may set `DEEPWIDGETS_MCP_PORT`.
 * @param projectDir - The profile folder of the Host; its `.env` ranks above `$DSH_HOME/.env`, as in the Host.
 * @returns the listening owner.
 * @throws a bad port setting, or the listen error (`listen EADDRINUSE`). The app then fails loudly at start.
 */
export async function startMcpPortOwner(environment: NodeJS.ProcessEnv, projectDir: string): Promise<McpPortOwner> {
  removeDeadMcpPortFile(undefined, environment)
  const portFile = mcpPortFilePath(environment)
  const home = dirname(dirname(portFile))
  const envFiles = [join(projectDir, '.env'), ...(home === projectDir ? [] : [join(home, '.env')])]
  const owner = new McpPortOwner({ port: resolveLayeredMcpPort(environment, envFiles), portFile })
  await owner.listen()
  return owner
}
