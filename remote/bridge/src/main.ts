/**
 * The bridge daemon: dial out to the relay Worker over a WebSocket, verify each call's signed assertion, check the
 * local kill file, and forward allowed calls to the local deepWidgets server.
 * The device credential, the local bearer tokens and the nonce are never logged.
 * Run: DW_WORKER_URL=... DW_DEVICE_CREDENTIAL_FILE=... DW_ASSERTION_PUBLIC_KEY='{...}' DSH_HOME=... npx tsx bridge/src/main.ts
 */
import { randomInt, type JsonWebKey } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, join, relative, resolve, isAbsolute, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'
import { createVerifier, type Verifier } from './assertion.ts'
import { SCOPE_OF } from './allowlist.ts'
import { createJournal } from './journal.ts'
import { createLocal, type LocalResult } from './local.ts'
import { filterByWid, LOCAL_TIMEOUT_MS, parseHello, PING_INTERVAL_MS, remoteLifetimeMs, withTimeout } from './remote.ts'

export type ErrorCode = 'assertion-rejected' | 'killed-locally' | 'grant-denied-locally' | 'idempotency-conflict' | 'outcome-unknown' | 'grant-not-approved-locally' | 'local-unavailable' | 'local-error'
type ResultFrame =
  | { type: 'result'; id: string; ok: true; result: unknown }
  | { type: 'result'; id: string; ok: false; error: { code: ErrorCode; message: string } }

export interface BridgeOptions {
  workerUrl: string
  credentialFile: string
  publicKey: JsonWebKey
  dshHome: string
  killFile: string
  /** Grant ids refused on this device; defaults to `denied-grants` beside the kill file. */
  deniedGrantsFile?: string
  /** Opt-in device-side approval: a JSON file `{ grants: { <gid>: { scope: [...], widgets: [...] } } }`. When set, a call
   * is refused unless its grant is listed, and its tool scope and widgets must also be inside the listed ones, so
   * the relay operator cannot mint or widen authority by signing. Missing or unreadable file: everything is refused. */
  approvedGrantsFile?: string
  /** Opt-in file that keeps the widget_call requestId journal across a bridge restart (env DW_JOURNAL_FILE).
   * Unset: memory only. Must be outside `$DSH_HOME/deepwidgets`, like the kill file. */
  journalFile?: string
  /** One line per event. Defaults to console.log. */
  log?: (line: string) => void
}

/** Tool error codes the real app returns before it writes anything (WIDGET_ERROR_STATUS, NEXT_STEP): the reservation is released. */
const PRE_WRITE_CODES = new Set(['unknown-widget', 'unknown-action', 'invalid-args', 'bad-request', 'busy', 'safe-mode', 'widget-failed', 'mode-off', 'idempotency-conflict', 'conflict'])
// Not `timeout`: the host's timeout covers only the current run's writes; a cross-widget update may already have landed.

/** True only when the local answer is a tool error that certainly wrote nothing. Anything else keeps the journal row (outcome unknown). */
export function isPreWriteFailure(value: LocalResult | undefined, _error: unknown): boolean {
  if (value === undefined || !value.ok) return false
  const result = value.result as { isError?: unknown; structuredContent?: { error?: { code?: unknown } } } | null
  const code = result?.structuredContent?.error?.code
  return result?.isError === true && typeof code === 'string' && PRE_WRITE_CODES.has(code)
}

export interface Bridge { close(): Promise<void> }

const MIN_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000

export const defaultKillFile = (): string => join(homedir(), '.deepwidgets-bridge', 'KILL')

/** The local grant deny-list: `denied-grants` beside the kill file, one grant id per line. */
export const defaultDeniedGrantsFile = (killFile: string): string => join(dirname(killFile), 'denied-grants')

export interface ApprovedGrant { scope: string[]; widgets: string[] }

/** The device-side approvals, or null when the file is missing, unreadable or malformed (fail closed). */
export async function readApprovedGrants(file: string): Promise<Record<string, ApprovedGrant> | null> {
  try {
    const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
    const grants = (parsed as { grants?: unknown } | null)?.grants
    if (typeof grants !== 'object' || grants === null || Array.isArray(grants)) return null
    const out: Record<string, ApprovedGrant> = {}
    for (const [gid, v] of Object.entries(grants)) {
      const { scope, widgets } = (v ?? {}) as { scope?: unknown; widgets?: unknown }
      if (!Array.isArray(scope) || !scope.every((x) => typeof x === 'string') || !Array.isArray(widgets) || !widgets.every((x) => typeof x === 'string')) return null
      out[gid] = { scope: scope as string[], widgets: widgets as string[] }
    }
    return out
  } catch {
    return null
  }
}

/** True when gid is listed. A missing file is an empty list; any other read failure denies (fail closed). */
export async function isGrantDenied(file: string, gid: string): Promise<boolean> {
  let text: string
  try {
    text = await readFile(file, 'utf8')
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ENOENT'
  }
  return text.split(/\r?\n/).some((line) => line.trim() === gid)
}

/** The kill file must not be writable through deepWidgets: never under $DSH_HOME/deepwidgets and never settings.json. */
export function checkKillFile(killFile: string, dshHome: string): string {
  const real = (p: string): string => {
    // Resolve symlinks of the deepest existing ancestor, so an alias into $DSH_HOME/deepwidgets is seen.
    let head = resolve(p)
    const tail: string[] = []
    for (;;) {
      try { return join(realpathSync(head), ...tail.reverse()) } catch { /* not there yet */ }
      const up = dirname(head)
      if (up === head) return resolve(p)
      tail.push(basename(head))
      head = up
    }
  }
  const file = real(killFile)
  const inside = relative(real(join(dshHome, 'deepwidgets')), file)
  if (basename(file) === 'settings.json') throw new Error('bridge: the kill file must not be settings.json')
  const outside = inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside)
  if (inside === '' || !outside) throw new Error('bridge: the kill file must be outside $DSH_HOME/deepwidgets')
  return file
}

/** True while the kill file exists. A file that cannot be checked counts as present: fail closed. */
async function killed(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ENOENT'
  }
}

export function deviceUrl(workerUrl: string): string {
  const url = new URL(`${workerUrl.replace(/\/+$/, '')}/device/connect`)
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]'
  if (url.protocol === 'http:' && !loopback) throw new Error('bridge: DW_WORKER_URL must be https (plain http is for loopback tests only), the device credential would travel in clear')
  if (url.username !== '' || url.password !== '') throw new Error('bridge: DW_WORKER_URL must not contain credentials')
  if (url.protocol === 'http:') url.protocol = 'ws:'
  else if (url.protocol === 'https:') url.protocol = 'wss:'
  else throw new Error('bridge: DW_WORKER_URL must be http or https')
  return url.toString()
}

/** The jittered delay before reconnect attempt `attempt` (0 based), from 1 s to 30 s. */
export function backoffMs(attempt: number): number {
  const ceiling = Math.min(MAX_BACKOFF_MS, MIN_BACKOFF_MS * 2 ** Math.min(attempt, 10))
  return Math.max(MIN_BACKOFF_MS, randomInt(Math.floor(ceiling / 2), ceiling + 1))
}

export async function startBridge(opts: BridgeOptions): Promise<Bridge> {
  const log = opts.log ?? ((line: string) => { console.log(line) })
  const startedAtMs = Date.now()
  const credential = (await readFile(opts.credentialFile, 'utf8')).trim()
  if (credential === '') throw new Error('bridge: the device credential file is empty')
  const killFile = checkKillFile(opts.killFile, opts.dshHome)
  // The deny-list gets the same guard as the kill file: deepWidgets must not be able to edit it.
  const deniedGrantsFile = opts.deniedGrantsFile === undefined ? defaultDeniedGrantsFile(killFile) : checkKillFile(opts.deniedGrantsFile, opts.dshHome)
  const url = deviceUrl(opts.workerUrl)
  const local = createLocal({ dshHome: opts.dshHome, log })
  /** Grant id of each verified call, for the call log line only. */
  const gidOf = new Map<string, string>()
  // A credential `dwd_<deviceId>.<secret>` pins the device id; otherwise the first hello names it.
  let deviceId = /^dwd_([^.]+)\./.exec(credential)?.[1]
  /** Runs each widget_call requestId once per grant. */
  const lostText = { replayed: true, resultLost: true, nextStep: 'This requestId already ran; its answer was not kept. Read the state with widget_describe.' }
  const lost: LocalResult = { ok: true, result: { content: [{ type: 'text', text: JSON.stringify(lostText) }], structuredContent: lostText } }
  const unknownBody = { error: { code: 'outcome-unknown', message: 'The outcome of this requestId is unknown.', nextStep: 'Read the state with widget_describe before deciding; do not resend this requestId for a new operation.' } }
  const unknown: LocalResult = { ok: true, result: { content: [{ type: 'text', text: JSON.stringify(unknownBody) }], structuredContent: unknownBody, isError: true } }
  const journal = createJournal(opts.journalFile === undefined ? {} : { file: checkKillFile(opts.journalFile, opts.dshHome), lost, unknown })
  /** One verifier for the bridge's life, so the jti cache survives reconnects. */
  let verifier: Verifier | undefined

  let closed = false
  let socket: WebSocket | undefined
  let timer: NodeJS.Timeout | undefined
  let attempt = 0
  // A literal ping keeps the socket alive; the relay answers pong without waking its Durable Object.
  const pinger = setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send('ping') }, PING_INTERVAL_MS)
  pinger.unref()

  const event = (name: string, detail: Record<string, unknown> = {}): void => {
    log(`deepwidgets-bridge ${JSON.stringify({ at: new Date().toISOString(), event: name, ...detail })}`)
  }

  async function handleCall(frame: Record<string, unknown>): Promise<ResultFrame | undefined> {
    const id = frame.id
    if (typeof id !== 'string' || id === '') return undefined
    const reject = (code: ErrorCode, message: string): ResultFrame => ({ type: 'result', id, ok: false, error: { code, message } })
    if (await killed(killFile)) return reject('killed-locally', 'remote access is turned off on this device')
    if (verifier === undefined) return reject('assertion-rejected', 'no hello from the relay yet')
    const { assertion, argsJson } = frame
    if (typeof assertion !== 'string' || typeof argsJson !== 'string') return reject('assertion-rejected', 'the frame needs assertion and argsJson strings')
    const verdict = verifier.verify(assertion, argsJson)
    if (!verdict.ok) return reject('assertion-rejected', verdict.reason)
    // The tool name comes only from the verified assertion, never from the frame.
    const { claims } = verdict
    gidOf.set(id, claims.gid)
    if (await isGrantDenied(deniedGrantsFile, claims.gid)) return reject('grant-denied-locally', 'this grant is refused on this device')
    const args = JSON.parse(argsJson) as Record<string, unknown>
    let wid = claims.wid
    if (opts.approvedGrantsFile !== undefined) {
      const approved = (await readApprovedGrants(opts.approvedGrantsFile))?.[claims.gid]
      if (approved === undefined) return reject('grant-not-approved-locally', 'this grant is not approved on this device')
      if (!approved.scope.includes(SCOPE_OF[claims.tool])) return reject('grant-not-approved-locally', 'this device did not approve that capability for this grant')
      const allowedHere = (slug: string): boolean => approved.widgets.includes('*') || approved.widgets.includes(slug)
      if (typeof args.slug === 'string' && !allowedHere(args.slug)) return reject('grant-not-approved-locally', 'this device did not approve that widget for this grant')
      wid = claims.wid.includes('*') ? approved.widgets : claims.wid.filter(allowedHere)
    }
    const requestId = claims.tool === 'widget_call' && typeof args.requestId === 'string' && args.requestId !== '' ? args.requestId : undefined
    // Re-check right before dispatch: the kill file may have appeared while the files above were read.
    if (await killed(killFile)) return reject('killed-locally', 'remote access is turned off on this device')
    // The same requestId and args for the same grant run once; the first run's answer is replayed.
    const work: Promise<LocalResult | 'conflict' | 'unavailable'> = requestId === undefined
      ? local.call(claims, args)
      : journal.run(claims.gid, requestId, claims.ah, () => local.call(claims, args),
        (r) => r.ok && (r.result as { isError?: unknown } | null)?.isError !== true, isPreWriteFailure)
        .then((ran) => (ran.status === 'ran' ? ran.value : ran.status))
    const answer = await withTimeout(work, LOCAL_TIMEOUT_MS)
    if (answer === 'conflict') return reject('idempotency-conflict', 'this requestId was used for a different call; use a new requestId for a new operation')
    // A widget_call already sent may still commit after the deadline: say the outcome is unknown, not failed.
    if (answer === 'unavailable') return reject('local-unavailable', 'the bridge could not record this operation durably, so it did not send it')
    if (answer === 'timeout') return reject(claims.tool === 'widget_call' ? 'outcome-unknown' : 'local-error', `the deepWidgets server did not answer within ${String(LOCAL_TIMEOUT_MS / 1000)} s`)
    if (!answer.ok) return reject(answer.code, answer.message)
    // Reads list only the widgets of the grant (widget_describe outside wid is refused by the verifier).
    return { type: 'result', id, ok: true, result: filterByWid(claims.tool, answer.result as Record<string, unknown>, wid) }
  }

  function onMessage(ws: WebSocket, data: WebSocket.RawData): void {
    if (String(data) === 'pong') return
    let frame: Record<string, unknown>
    try {
      const parsed: unknown = JSON.parse(String(data))
      if (typeof parsed !== 'object' || parsed === null) return
      frame = parsed as Record<string, unknown>
    } catch {
      event('bad-frame')
      return
    }
    if (frame.type === 'hello') {
      // Any serverTime is ignored: iat and exp are judged on the bridge's own clock.
      const hello = parseHello(frame)
      if (hello === null) { event('bad-hello'); return }
      const helloDevice = hello.deviceId
      if (deviceId !== undefined && helloDevice !== deviceId) {
        event('device-mismatch', { expected: deviceId, got: helloDevice })
        ws.close(1008, 'device id mismatch')
        return
      }
      deviceId = helloDevice
      verifier ??= createVerifier({ publicKey: opts.publicKey, deviceId, startedAtMs, clockOffsetMs: 0 })
      attempt = 0
      event('hello', { deviceId })
      return
    }
    if (frame.type !== 'call') return
    handleCall(frame).then((result) => {
      if (result === undefined) return
      const gid = gidOf.get(result.id)
      gidOf.delete(result.id)
      event('call', { id: result.id, ...(gid === undefined ? {} : { gid }), ok: result.ok, ...(result.ok ? {} : { code: result.error.code, reason: result.error.message }) })
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(result))
    }).catch((error: unknown) => {
      // Never leave the relay waiting or the grant map growing: answer with a fixed failure.
      const id = typeof frame.id === 'string' ? frame.id : ''
      gidOf.delete(id)
      event('call-failed', { error: error instanceof Error ? error.name : typeof error })
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'result', id, ok: false, error: { code: 'local-error', message: 'the local deepWidgets server failed' } }))
    })
  }

  function connect(): void {
    if (closed) return
    const ws = new WebSocket(url, { headers: { authorization: `Bearer ${credential}` } })
    socket = ws
    ws.on('open', () => { event('connected', { url }) })
    ws.on('message', (data) => { onMessage(ws, data) })
    ws.on('unexpected-response', (_req, res) => {
      event('refused', { status: res.statusCode })
      ws.terminate()
    })
    ws.on('error', (error) => { event('socket-error', { message: error.message }) })
    ws.on('close', () => {
      if (socket === ws) socket = undefined
      if (closed) return
      const delay = backoffMs(attempt++)
      event('disconnected', { retryInMs: delay })
      timer = setTimeout(connect, delay)
    })
  }

  connect()

  return {
    async close() {
      closed = true
      clearInterval(pinger)
      if (timer !== undefined) clearTimeout(timer)
      const ws = socket
      socket = undefined
      if (ws === undefined || ws.readyState === WebSocket.CLOSED) return
      await new Promise<void>((done) => {
        ws.once('close', () => done())
        if (ws.readyState === WebSocket.CONNECTING) ws.terminate()
        else ws.close(1000, 'bridge stopped')
        setTimeout(() => { ws.terminate(); done() }, 1_000).unref()
      })
    },
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const need = (name: string): string => {
    const value = process.env[name]
    if (value === undefined || value === '') {
      console.error(`bridge: set ${name}`)
      process.exit(1)
    }
    return value
  }
  let lifetimeMs = 0
  try {
    lifetimeMs = remoteLifetimeMs(process.env)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
  const bridge = await startBridge({
    workerUrl: need('DW_WORKER_URL'),
    credentialFile: need('DW_DEVICE_CREDENTIAL_FILE'),
    publicKey: JSON.parse(need('DW_ASSERTION_PUBLIC_KEY')) as JsonWebKey,
    dshHome: need('DSH_HOME'),
    killFile: process.env.DW_KILL_FILE || defaultKillFile(),
    deniedGrantsFile: process.env.DW_DENIED_GRANTS_FILE || undefined,
    approvedGrantsFile: process.env.DW_APPROVED_GRANTS_FILE || undefined,
    journalFile: process.env.DW_JOURNAL_FILE || undefined,
  })
  const stop = (): void => { void bridge.close().then(() => process.exit(0)) }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  // DW_REMOTE_HOURS (default 8): remote access ends when the bridge exits; start it again for more time.
  setTimeout(() => {
    console.log(`deepwidgets-bridge ${JSON.stringify({ at: new Date().toISOString(), event: 'time-box-ended', hours: lifetimeMs / 3_600_000 })}`)
    stop()
  }, lifetimeMs)
}
