/**
 * The local side of the bridge (MAPPING.md): read `$DSH_HOME/deepwidgets/mcp.json`, get a bearer with
 * `POST /mcp/token { agent, challenge }`, check the proof (HMAC-SHA256 keyed by the nonce over the challenge) so a
 * server that squats the port is refused, then forward the call with the MCP SDK client.
 * The nonce and the bearer stay in memory and are never logged.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport, StreamableHTTPError } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Claims } from './assertion.ts'

/** Results larger than this are refused (section 5, rate limits). */
export const MAX_RESULT_BYTES = 256 * 1024
const CALL_TIMEOUT_MS = 30_000

export type LocalResult =
  | { ok: true; result: unknown }
  | { ok: false; code: 'local-unavailable' | 'local-error'; message: string }

interface PortFile { port: number; nonce: string; started: number }
interface Session { started: number; port: number; token: string; agentId: string }

/** A failure that means the local server cannot be used now (not running, wrong proof, refused bearer). */
class Unavailable extends Error {}
class Unauthorized extends Error {}

async function readPortFile(dshHome: string): Promise<PortFile> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await readFile(join(dshHome, 'deepwidgets', 'mcp.json'), 'utf8'))
  } catch {
    throw new Unavailable('the deepWidgets port file is missing or not JSON; is deepWidgets running?')
  }
  const { port, nonce, started } = (parsed ?? {}) as Record<string, unknown>
  if (typeof port !== 'number' || !Number.isSafeInteger(port) || port <= 0 || port > 65535
    || typeof nonce !== 'string' || nonce.length < 16 || typeof started !== 'number') {
    throw new Unavailable('the deepWidgets port file does not hold { port, nonce, started }')
  }
  return { port, nonce, started }
}

/** `remote:<client id>` cut to printable ASCII, at most 64 characters in all. */
export function agentName(cid: string): string {
  const short = cid.replace(/[^\x21-\x7e]/g, '').slice(0, 32)
  return `remote:${short === '' ? 'client' : short}`
}

function sameHex(got: string, want: string): boolean {
  const a = Buffer.from(got, 'utf8')
  const b = Buffer.from(want, 'utf8')
  return a.length === b.length && timingSafeEqual(a, b)
}

async function handshake(file: PortFile, cid: string): Promise<Session> {
  const challenge = randomBytes(16).toString('base64url')
  let response: Response
  try {
    response = await fetch(`http://127.0.0.1:${String(file.port)}/mcp/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent: agentName(cid), challenge }),
      signal: AbortSignal.timeout(10_000),
      // A redirect could send the nonce proof or the bearer to another listener.
      redirect: 'error',
    })
  } catch {
    throw new Unavailable('the deepWidgets server does not answer on the port of mcp.json')
  }
  if (!response.ok) {
    await response.body?.cancel()
    throw new Unavailable(`the deepWidgets token endpoint answered ${String(response.status)}`)
  }
  const parsed: unknown = await response.json().catch(() => null)
  const body = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
  const { token, agentId, proof } = body
  if (typeof token !== 'string' || typeof agentId !== 'string' || typeof proof !== 'string') {
    throw new Unavailable('the deepWidgets token answer is not { token, agentId, proof }')
  }
  const want = createHmac('sha256', file.nonce).update(challenge).digest('hex')
  if (!sameHex(proof, want)) throw new Unavailable('the server on the deepWidgets port failed the proof; it is not deepWidgets, so the call was refused')
  return { started: file.started, port: file.port, token, agentId }
}

/** Remove every `source` field, at any depth. */
function stripSource(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripSource)
  if (typeof value !== 'object' || value === null) return value
  const out: Record<string, unknown> = {}
  for (const [key, inner] of Object.entries(value)) if (key !== 'source') out[key] = stripSource(inner)
  return out
}

/** widget_describe gives the local folder of an agent widget in `source`; a remote caller never sees it. */
function stripDescribe(result: Record<string, unknown>): Record<string, unknown> {
  const out = stripSource(result) as Record<string, unknown>
  if (Array.isArray(out.content)) {
    out.content = out.content.map((item: unknown) => {
      const text = (item as { type?: unknown; text?: unknown }).text
      if ((item as { type?: unknown }).type !== 'text' || typeof text !== 'string') return item
      try {
        return { ...(item as object), text: JSON.stringify(stripSource(JSON.parse(text))) }
      } catch {
        // Not JSON: drop the text when it names a source, rather than pass a path on.
        return text.includes('source') ? { ...(item as object), text: '' } : item
      }
    })
  }
  return out
}

function isConnectFailure(error: unknown): boolean {
  for (let e: unknown = error; e instanceof Error; e = e.cause) {
    const code = (e as NodeJS.ErrnoException).code
    if (code === 'ECONNREFUSED' || code === 'ECONNRESET' || code === 'EHOSTUNREACH' || code === 'UND_ERR_SOCKET') return true
    if (e.message === 'fetch failed') return true
  }
  return false
}

async function forward(session: Session, tool: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = new Client({ name: 'deepwidgets-bridge', version: '0.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${String(session.port)}/mcp`), {
    requestInit: { headers: { authorization: `Bearer ${session.token}` } },
    // Never follow a redirect with the bearer attached.
    fetch: (input, init) => fetch(input, { ...init, redirect: 'error' }),
  })
  try {
    await client.connect(transport)
    return (await client.callTool({ name: tool, arguments: args }, undefined, { timeout: CALL_TIMEOUT_MS })) as Record<string, unknown>
  } catch (error) {
    if (error instanceof StreamableHTTPError && error.code === 401) throw new Unauthorized('the deepWidgets server refused the bearer')
    if (isConnectFailure(error)) throw new Unavailable('the deepWidgets server does not answer on the port of mcp.json')
    throw error
  } finally {
    await client.close().catch(() => undefined)
  }
}

export interface Local {
  call(claims: Pick<Claims, 'cid' | 'gid' | 'tool'>, args: Record<string, unknown>): Promise<LocalResult>
}

/** The only text that leaves the bridge for a local failure; the detail stays in the local log. */
export const LOCAL_ERROR_MESSAGES = {
  'local-unavailable': 'deepWidgets is not reachable on this device right now',
  'local-error': 'deepWidgets could not complete the call',
} as const

export function createLocal(opts: { dshHome: string; log?: (line: string) => void }): Local {
  const fail = (code: 'local-unavailable' | 'local-error', detail: string): LocalResult => {
    opts.log?.(`deepwidgets-bridge ${JSON.stringify({ at: new Date().toISOString(), event: 'local-failure', code, detail })}`)
    return { ok: false, code, message: LOCAL_ERROR_MESSAGES[code] }
  }
  /** One session per grant (client id and grant id), so two grants of one client never share a host caller; valid for the `started` of the port file it came from. */
  const sessions = new Map<string, Session>()
  const keyOf = (claims: Pick<Claims, 'cid' | 'gid'>): string => `${claims.cid}\u0000${claims.gid}`

  async function session(claims: Pick<Claims, 'cid' | 'gid'>, fresh: boolean): Promise<Session> {
    const file = await readPortFile(opts.dshHome)
    const key = keyOf(claims)
    const cached = sessions.get(key)
    if (!fresh && cached !== undefined && cached.started === file.started && cached.port === file.port) return cached
    sessions.delete(key)
    const next = await handshake(file, claims.cid)
    sessions.set(key, next)
    return next
  }

  return {
    async call(claims, args) {
      try {
        let result: Record<string, unknown>
        try {
          result = await forward(await session(claims, false), claims.tool, args)
        } catch (error) {
          if (!(error instanceof Unauthorized)) throw error
          // The host restarted (new epoch): re-read mcp.json and handshake once, then retry.
          result = await forward(await session(claims, true), claims.tool, args)
        }
        const out = claims.tool === 'widget_describe' ? stripDescribe(result) : result
        if (Buffer.byteLength(JSON.stringify(out), 'utf8') > MAX_RESULT_BYTES) {
          return fail('local-error', 'the result is larger than 256 KiB')
        }
        return { ok: true, result: out }
      } catch (error) {
        if (error instanceof Unavailable || error instanceof Unauthorized) {
          sessions.delete(keyOf(claims))
          return fail('local-unavailable', error.name)
        }
        return fail('local-error', error instanceof Error ? error.name : typeof error)
      }
    },
  }
}
