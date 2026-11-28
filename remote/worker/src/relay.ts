/**
 * The DeviceRelay Durable Object: holds the one bridge WebSocket (hibernation API), relays signed calls to it, and
 * keeps the cloud kill flag, the revoked grants and the audit rows (never args or results) in ctx.storage.sql.
 */
import { DurableObject } from 'cloudflare:workers'
import type { Env } from './index.ts'

export type RelayError = 'remote-disabled' | 'grant-revoked' | 'device-offline' | 'device-timeout' | 'outcome-unknown' | 'bad-frame'
  | 'assertion-rejected' | 'killed-locally' | 'local-unavailable' | 'local-error'
export type CallOutcome = { ok: true; result: unknown } | { ok: false; code: RelayError | string; message: string }

export interface CallInput {
  grantId: string
  clientId: string
  tool: string
  slug: string
  assertion: string
  argsJson: string
}

export interface AuditRow { at: string; client: string; grant: string; tool: string; slug: string; outcome: string; ms: number }

/** The relay waits this long for the bridge's result (the bridge times out the local call at 10 s). */
export const CALL_WAIT_MS = 30_000
/** A bridge socket that auto-ponged within this window is live: a new socket is refused (409). */
export const LIVE_PONG_MS = 45_000
const AUDIT_KEEP = 1000
const TAG = 'bridge'

const BRIDGE_MESSAGES: Record<string, string> = {
  'assertion-rejected': 'the device did not accept the signed request',
  'killed-locally': 'remote access is turned off on the device',
  'grant-denied-locally': 'the owner refused this grant on the device',
  'grant-not-approved-locally': 'the owner has not approved this on the device',
  'idempotency-conflict': 'this requestId was used for a different call',
  'local-unavailable': 'deepWidgets is not reachable on the device right now',
  'local-error': 'deepWidgets could not complete the call',
  'outcome-unknown': 'the device sent the action but did not get its answer in time; it may or may not have run',
  'bad-frame': 'the device sent an unreadable answer',
}
const BRIDGE_CODES = new Set(Object.keys(BRIDGE_MESSAGES))

/** A widget_call that was already sent when the socket went away may have been applied: report it as unknown. */
function unknownIfSent(tool: string, outcome: CallOutcome): CallOutcome {
  if (tool !== 'widget_call' || outcome.ok || outcome.code !== 'device-offline') return outcome
  return { ok: false, code: 'outcome-unknown', message: 'the connection to the device was lost after the action was sent; it may or may not have run' }
}

interface Pending { ws: WebSocket; tool: string; done: (outcome: CallOutcome) => void }

export class DeviceRelay extends DurableObject<Env> {
  private readonly pending = new Map<string, Pending>()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // The bridge pings every 20 s; the runtime answers without waking the object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
    const sql = ctx.storage.sql
    sql.exec(`CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, client TEXT NOT NULL,
      grant_id TEXT NOT NULL, tool TEXT NOT NULL, slug TEXT NOT NULL, outcome TEXT NOT NULL, ms INTEGER NOT NULL)`)
    sql.exec('CREATE TABLE IF NOT EXISTS revoked (grant_id TEXT PRIMARY KEY, at TEXT NOT NULL)')
    sql.exec('CREATE TABLE IF NOT EXISTS flags (name TEXT PRIMARY KEY, value INTEGER NOT NULL)')
  }

  private audit(row: Omit<AuditRow, 'at'>): void {
    const sql = this.ctx.storage.sql
    sql.exec('INSERT INTO audit (at, client, grant_id, tool, slug, outcome, ms) VALUES (?, ?, ?, ?, ?, ?, ?)',
      new Date().toISOString(), row.client, row.grant, row.tool, row.slug, row.outcome, Math.round(row.ms))
    sql.exec('DELETE FROM audit WHERE id <= (SELECT MAX(id) FROM audit) - ?', AUDIT_KEEP)
  }

  private event(outcome: string): void {
    this.audit({ client: '', grant: '', tool: '', slug: '', outcome, ms: 0 })
  }

  private killed(): boolean {
    return this.ctx.storage.sql.exec<{ value: number }>("SELECT value FROM flags WHERE name = 'killed'").toArray()[0]?.value === 1
  }

  private openSockets(): WebSocket[] {
    return this.ctx.getWebSockets(TAG).filter((ws) => ws.readyState === WebSocket.OPEN)
  }

  private settle(ws: WebSocket, outcome: CallOutcome): void {
    for (const [id, p] of this.pending) {
      if (p.ws !== ws) continue
      this.pending.delete(id)
      p.done(unknownIfSent(p.tool, outcome))
    }
  }

  /** The bridge upgrade. The Worker has already checked the device credential. */
  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('expected a WebSocket upgrade', { status: 426 })
    if (this.killed()) return new Response('remote access is turned off', { status: 403 })
    const deviceId = request.headers.get('x-dw-device-id') ?? ''
    const old = this.openSockets()
    for (const ws of old) {
      const pong = this.ctx.getWebSocketAutoResponseTimestamp(ws)
      if (pong !== null && Date.now() - pong.getTime() < LIVE_PONG_MS) {
        this.event('bridge-refused')
        return new Response('another bridge is connected and live', { status: 409 })
      }
    }
    for (const ws of old) {
      this.settle(ws, { ok: false, code: 'device-offline', message: 'the bridge was replaced' })
      try { ws.close(4000, 'replaced by a newer bridge') } catch { /* already closing */ }
      this.event('bridge-replaced')
    }
    const pair = new WebSocketPair()
    const [client, server] = [pair[0], pair[1]]
    this.ctx.acceptWebSocket(server, [TAG])
    // Auth survives hibernation in the attachment.
    server.serializeAttachment({ deviceId, authed: true, since: Date.now() })
    server.send(JSON.stringify({ type: 'hello', deviceId }))
    this.event('bridge-connected')
    return new Response(null, { status: 101, webSocket: client })
  }

  override webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message !== 'string') return
    if (message === 'ping') { ws.send('pong'); return }
    let frame: Record<string, unknown>
    try {
      frame = JSON.parse(message) as Record<string, unknown>
    } catch {
      return
    }
    if (frame?.type !== 'result' || typeof frame.id !== 'string') return
    const p = this.pending.get(frame.id)
    if (p === undefined) return
    this.pending.delete(frame.id)
    if (frame.ok === true) { p.done({ ok: true, result: frame.result }); return }
    const error = (frame.error ?? {}) as { code?: unknown }
    // Only known codes pass, with a fixed message: the bridge's text is never passed on or stored.
    const code = typeof error.code === 'string' && BRIDGE_CODES.has(error.code) ? error.code : 'bad-frame'
    p.done({ ok: false, code, message: BRIDGE_MESSAGES[code] ?? 'the device refused the call' })
  }

  override webSocketClose(ws: WebSocket, _code: number, _reason: string): void {
    this.settle(ws, { ok: false, code: 'device-offline', message: 'the bridge disconnected' })
    try { ws.close(1000, 'closed') } catch { /* already closed */ }
    this.event('bridge-disconnected')
  }

  override webSocketError(ws: WebSocket): void {
    this.settle(ws, { ok: false, code: 'device-offline', message: 'the bridge socket failed' })
  }

  /** RPC from a tool handler: relay one signed call to the bridge. One audit row per call. */
  async call(input: CallInput): Promise<CallOutcome> {
    const started = Date.now()
    const outcome = await this.relay(input)
    this.audit({ client: input.clientId, grant: input.grantId, tool: input.tool, slug: input.slug, outcome: outcome.ok ? 'ok' : outcome.code, ms: Date.now() - started })
    return outcome
  }

  private relay(input: CallInput): Promise<CallOutcome> | CallOutcome {
    if (this.killed()) return { ok: false, code: 'remote-disabled', message: 'the owner turned remote access off' }
    const revoked = this.ctx.storage.sql.exec('SELECT 1 FROM revoked WHERE grant_id = ?', input.grantId).toArray().length > 0
    if (revoked) return { ok: false, code: 'grant-revoked', message: 'the owner revoked this grant' }
    const ws = this.openSockets()[0]
    if (ws === undefined) return { ok: false, code: 'device-offline', message: 'the device is not connected' }
    const id = crypto.randomUUID()
    return new Promise<CallOutcome>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve({ ok: false, code: input.tool === 'widget_call' ? 'outcome-unknown' : 'device-timeout', message: `the device did not answer within ${String(CALL_WAIT_MS / 1000)} s` })
      }, CALL_WAIT_MS)
      this.pending.set(id, { ws, tool: input.tool, done: (outcome) => { clearTimeout(timer); resolve(outcome) } })
      try {
        ws.send(JSON.stringify({ type: 'call', id, assertion: input.assertion, argsJson: input.argsJson }))
      } catch {
        this.settle(ws, { ok: false, code: 'device-offline', message: 'the device socket is closed' })
      }
    })
  }

  async setKill(on: boolean): Promise<{ killed: boolean }> {
    this.ctx.storage.sql.exec("INSERT INTO flags (name, value) VALUES ('killed', ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value", on ? 1 : 0)
    if (on) {
      // Persisted first; then drop the bridge sockets (a call already sent may have run: outcome-unknown).
      for (const ws of this.openSockets()) {
        this.settle(ws, { ok: false, code: 'device-offline', message: 'remote access was turned off' })
        try { ws.close(4001, 'remote access turned off') } catch { /* already closing */ }
      }
    }
    this.event(on ? 'kill-on' : 'kill-off')
    return { killed: on }
  }

  async revokeGrant(grantId: string): Promise<void> {
    this.ctx.storage.sql.exec('INSERT OR IGNORE INTO revoked (grant_id, at) VALUES (?, ?)', grantId, new Date().toISOString())
    this.audit({ client: '', grant: grantId, tool: '', slug: '', outcome: 'grant-revoked', ms: 0 })
  }

  async status(limit = 100): Promise<{ connected: boolean; killed: boolean; bridgeReplaced: number; rows: AuditRow[] }> {
    const sql = this.ctx.storage.sql
    const rows = sql.exec<{ at: string; client: string; grant_id: string; tool: string; slug: string; outcome: string; ms: number }>(
      'SELECT at, client, grant_id, tool, slug, outcome, ms FROM audit ORDER BY id DESC LIMIT ?', Math.max(1, Math.min(limit, AUDIT_KEEP))).toArray()
    const replaced = sql.exec<{ n: number }>("SELECT COUNT(*) AS n FROM audit WHERE outcome = 'bridge-replaced'").toArray()[0]?.n ?? 0
    return {
      connected: this.openSockets().length > 0,
      killed: this.killed(),
      bridgeReplaced: replaced,
      rows: rows.map((r) => ({ at: r.at, client: r.client, grant: r.grant_id, tool: r.tool, slug: r.slug, outcome: r.outcome, ms: r.ms })),
    }
  }
}
