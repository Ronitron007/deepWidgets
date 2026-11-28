/**
 * The product-direction first pilot against the REAL deepWidgets host (CLI host, `sample` widget) through the LIVE relay.
 * Needs: the real host running with DSH_HOME, and a bridge connected to the relay with the same DSH_HOME.
 * Env: DW_WORKER_URL, DW_OWNER_PASSCODE_FILE, DSH_HOME, DW_HOST_START (a script that starts the host detached),
 *      DW_EVIDENCE (a JSON file for the results). Prints no secrets.
 */
import { createHmac, randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createLocal } from '../bridge/src/local.ts'
import { connectWithOAuth, createClient, errorCode, mask, OwnerConsentProvider } from '../e2e/remote-smoke.ts'

const workerUrl = (process.env.DW_WORKER_URL ?? '').replace(/\/+$/, '')
if (!/^https:\/\//.test(workerUrl)) throw new Error('DW_WORKER_URL must be https')
const passcode = (await readFile(process.env.DW_OWNER_PASSCODE_FILE ?? '', 'utf8')).trim()
const dshHome = process.env.DSH_HOME ?? ''
const hostStart = process.env.DW_HOST_START ?? ''
const evidenceFile = process.env.DW_EVIDENCE ?? 'pilot-evidence.json'
const SLUG = process.env.DW_PILOT_SLUG ?? 'sample'
const evidence: Record<string, unknown> = { at: new Date().toISOString(), relay: workerUrl, slug: SLUG, steps: {} }
const steps = evidence.steps as Record<string, unknown>
const log = (s: string) => { console.log(`pilot: ${s}`) }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let failures = 0
const check = (name: string, ok: boolean, detail: unknown) => {
  steps[name] = { ok, detail }
  if (!ok) failures++
  log(`${ok ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(detail).slice(0, 400)}`)
}

// The owner's own view of the real app, straight from the loopback server (not through the relay).
const owner = createLocal({ dshHome })
async function realState(): Promise<{ count: number; rev: number }> {
  const r = await owner.call({ cid: 'pilot-owner-view', gid: 'pilot-owner-view', tool: 'widget_describe' } as never, { slug: SLUG })
  if (!r.ok) throw new Error(`owner view failed: ${r.code}`)
  const body = (r.result as { structuredContent: { state: { count: number }; rev: number } }).structuredContent
  return { count: body.state.count, rev: body.rev }
}
async function realChanges(since: string | undefined): Promise<{ cursor: string; changes: { slug: string; by?: string; rev?: number }[] }> {
  const r = await owner.call({ cid: 'pilot-owner-view', gid: 'pilot-owner-view', tool: 'widget_changes' } as never, since === undefined ? {} : { since })
  if (!r.ok) throw new Error(`owner changes failed: ${r.code}`)
  return (r.result as { structuredContent: { cursor: string; changes: { slug: string; by?: string; rev?: number }[] } }).structuredContent
}
/** The full tool list of the real local server, via its own handshake (owner-side check of what exists locally). */
async function realToolNames(): Promise<string[]> {
  const file = JSON.parse(await readFile(join(dshHome, 'deepwidgets', 'mcp.json'), 'utf8')) as { port: number; nonce: string }
  const challenge = randomBytes(16).toString('base64url')
  const res = await fetch(`http://127.0.0.1:${String(file.port)}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'pilot-owner-tools', challenge }), redirect: 'error' })
  const body = (await res.json()) as { token: string; proof: string }
  if (body.proof !== createHmac('sha256', file.nonce).update(challenge).digest('hex')) throw new Error('bad proof')
  const c = new Client({ name: 'pilot-owner', version: '0' })
  await c.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${String(file.port)}/mcp`), { requestInit: { headers: { authorization: `Bearer ${body.token}` } } }))
  const names = (await c.listTools()).tools.map((t) => t.name).sort()
  await c.close()
  return names
}
async function admin(method: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${workerUrl}${path}`, { method, headers: { 'x-owner-passcode': passcode, 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
}
/** GET /admin/grants lists KV, which is eventually consistent: a grant made seconds ago may be missing, so poll. */
const grantListLagMs: Record<string, number> = {}
async function grantOf(cid: string): Promise<string> {
  const t0 = Date.now()
  for (let i = 0; i < 60; i++) {
    const g = (await (await admin('GET', '/admin/grants')).json()) as { grants: { id: string; clientId: string }[] }
    const id = g.grants.find((x) => x.clientId === cid)?.id
    if (id !== undefined) { grantListLagMs[cid] = Date.now() - t0; return id }
    await sleep(2000)
  }
  return ''
}
async function hostPid(): Promise<number | undefined> {
  try { return (JSON.parse(await readFile(join(dshHome, 'deepwidgets', 'mcp.json'), 'utf8')) as { pid: number }).pid } catch { return undefined }
}
async function restartHost(during?: () => Promise<unknown>): Promise<{ oldPid?: number; newPid?: number; downMs: number; duringResult?: unknown }> {
  const oldPid = await hostPid()
  const t0 = Date.now()
  if (oldPid !== undefined) process.kill(oldPid, 'SIGTERM')
  for (let i = 0; i < 100 && (await hostPid()) === oldPid; i++) await sleep(200)
  const duringResult = during === undefined ? undefined : await during()
  spawn('setsid', [hostStart], { detached: true, stdio: 'ignore' }).unref()
  let newPid: number | undefined
  for (let i = 0; i < 300; i++) { newPid = await hostPid(); if (newPid !== undefined && newPid !== oldPid) break; await sleep(500) }
  for (let i = 0; i < 60; i++) { try { await realState(); break } catch { await sleep(500) } }
  return { oldPid, newPid, downMs: Date.now() - t0, duringResult }
}
const add = (c: Client, by: number, requestId: string) => c.callTool({ name: 'widget_call', arguments: { slug: SLUG, action: 'add', args: { by }, requestId } })
const text = (r: unknown) => ((r as { structuredContent?: unknown }).structuredContent ?? null)

log(`relay ${workerUrl}, passcode ${mask(passcode)}, real host pid ${String(await hostPid())}`)
const run = randomBytes(3).toString('hex')

// 1. Two clients with different rights on one widget.
const aId = await createClient(workerUrl, passcode, `pilot-A-${run}`)
const bId = await createClient(workerUrl, passcode, `pilot-B-${run}`)
const aProvider = new OwnerConsentProvider(aId, passcode, ['widgets:read', 'widgets:call'], SLUG)
const A = await connectWithOAuth(workerUrl, aProvider)
const B = await connectWithOAuth(workerUrl, new OwnerConsentProvider(bId, passcode, ['widgets:read'], SLUG))
const aTools = (await A.listTools()).tools.map((t) => t.name).sort()
const bTools = (await B.listTools()).tools.map((t) => t.name).sort()
const bDescribe = await B.callTool({ name: 'widget_describe', arguments: { slug: SLUG } })
const s0 = await realState()
let bCall: string
try { bCall = errorCode(await add(B, 1, `pilot-${run}-b`)) ?? 'ran' } catch (e) { bCall = `threw ${(e as Error).constructor.name}` }
const s0b = await realState()
const gA = await grantOf(aId); const gB = await grantOf(bId)
check('1-two-clients-different-rights', aTools.includes('widget_call') && !bTools.includes('widget_call') && errorCode(bDescribe) === undefined && bCall !== 'ran' && s0b.count === s0.count && gA !== '' && gB !== '' && gA !== gB,
  { clientA: aId, clientB: bId, aTools, bTools, bDescribeOk: errorCode(bDescribe) === undefined, bForcedCall: bCall, countBefore: s0.count, countAfterBForced: s0b.count, separateGrants: gA !== gB, grantListLagMs })

// 2. Interact-only against the real tool list.
const local = await realToolNames()
const forbidden = local.filter((n) => !['widget_list', 'widget_describe', 'widget_call', 'widget_changes'].includes(n))
const forced: Record<string, string> = {}
for (const name of forbidden) {
  try { forced[name] = errorCode(await A.callTool({ name, arguments: name === 'widget_remove' || name === 'widget_reload' ? { slug: SLUG } : name === 'widget_install' ? { dir: '/tmp' } : {} })) ?? 'ran' } catch (e) { forced[name] = `threw ${(e as Error).constructor.name}` }
}
const listAfterForced = (await A.callTool({ name: 'widget_list', arguments: {} })) as { structuredContent?: { widgets?: { slug: string }[] } }
const token = aProvider.tokens()?.access_token ?? ''
const pins: Record<string, number> = {}
for (const path of ['/mcp/token', '/mcp/x', '/mcp/', '/mcp/token/x']) {
  const r = await fetch(`${workerUrl}${path}`, { method: 'POST', redirect: 'error', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: '{"agent":"x","challenge":"aaaaaaaaaaaaaaaaaaaaaaaa"}' })
  await r.body?.cancel(); pins[path] = r.status
}
const sPins = await realState()
check('2-interact-only-vs-real-tools', Object.values(pins).every((st) => st === 404) && sPins.count === s0b.count && JSON.stringify(aTools) === JSON.stringify(['widget_call', 'widget_changes', 'widget_describe', 'widget_list']) && forbidden.length === 7 && aTools.every((t) => local.includes(t)) && Object.values(forced).every((v) => v !== 'ran') && (listAfterForced.structuredContent?.widgets ?? []).some((w) => w.slug === SLUG),
  { realLocalTools: local, remoteTools: aTools, forbiddenForcedByA: forced, liveWorkerPinsWithValidToken: pins })

// 3. A useful update visible in the real app's state.
const c3 = (await realChanges(undefined)).cursor
const r3 = await add(A, 5, `pilot-${run}-a1`)
const s3 = await realState()
const ch3 = await realChanges(c3)
const feed3 = ch3.changes.filter((c) => c.slug === SLUG && c.rev === s3.rev)
check('3-useful-update-in-real-state', errorCode(r3) === undefined && s3.count === s0.count + 5 && feed3.length === 1 && (feed3[0]?.by ?? '').startsWith(`remote-${aId.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`),
  { relayAnswer: text(r3), realCountBefore: s0.count, realCountAfter: s3.count, realRev: s3.rev, realChangeFeed: ch3.changes })

// 4. Retry after a lost response applies once (same requestId and args, answer treated as lost).
const r4a = await add(A, 2, `pilot-${run}-a2`)
const s4a = await realState()
const r4b = await add(A, 2, `pilot-${run}-a2`)
const s4b = await realState()
const r4c = await add(A, 7, `pilot-${run}-a2`)
const s4c = await realState()
check('4-retry-after-lost-response-applies-once', errorCode(r4a) === undefined && errorCode(r4b) === undefined && s4a.count === s3.count + 2 && s4b.count === s4a.count && errorCode(r4c) === 'idempotency-conflict' && s4c.count === s4b.count,
  { first: text(r4a), retry: text(r4b), countAfterFirst: s4a.count, countAfterRetry: s4b.count, sameIdOtherArgs: errorCode(r4c), countAfterConflict: s4c.count })

// 4b. The same, across a REAL host restart (new epoch, new local caller id for the bridge).
const r4d = await add(A, 3, `pilot-${run}-a3`)
const s4d = await realState()
const restart1 = await restartHost()
const s4e0 = await realState()
const r4e = await add(A, 3, `pilot-${run}-a3`)
const s4e = await realState()
check('4b-retry-across-real-host-restart-applies-once', restart1.newPid !== undefined && restart1.newPid !== restart1.oldPid && errorCode(r4d) === undefined && errorCode(r4e) === undefined && s4e.count === s4d.count,
  { restart: restart1, countAfterFirst: s4d.count, countAfterRestart: s4e0.count, retryAnswer: text(r4e), countAfterRetry: s4e.count, statePersistedAcrossRestart: s4e0.count === s4d.count })

// 5. Revoke client B during a real host restart.
const restart2 = await restartHost(async () => (await admin('POST', `/admin/grants/${encodeURIComponent(gB)}/revoke`)).status)
let bAfter: string
try { bAfter = errorCode(await B.callTool({ name: 'widget_list', arguments: {} })) ?? 'ran' } catch (e) { bAfter = `threw ${(e as Error).constructor.name}` }
const s5a = await realState()
let r5: unknown
for (let i = 0; i < 20; i++) { r5 = await add(A, 1, `pilot-${run}-a4`); if (errorCode(r5) !== 'local-unavailable' && errorCode(r5) !== 'device-offline') break; await sleep(1000) }
const s5b = await realState()
check('5-revoke-B-during-real-host-restart', restart2.newPid !== undefined && restart2.newPid !== restart2.oldPid && restart2.duringResult === 200 && bAfter !== 'ran' && errorCode(r5) === undefined && s5b.count === s5a.count + 1,
  { restart: restart2, bAfterRevoke: bAfter, aAfter: text(r5), countBeforeA: s5a.count, countAfterA: s5b.count })

// 5b. Retry after a BRIDGE restart (the bridge forgets its memory; with DW_JOURNAL_FILE it keeps finished runs).
const bridgeRestart = process.env.DW_BRIDGE_RESTART ?? ''
const bridgePid = async (): Promise<string> => new Promise((r) => { const p = spawn('pgrep', ['-f', 'tsx bridge/src/main.ts'], { stdio: ['ignore', 'pipe', 'ignore'] }); let o = ''; p.stdout.on('data', (d) => { o += String(d) }); p.once('exit', () => { r(o.trim().split(/\s+/).sort().join(',')) }) })
if (bridgeRestart !== '') {
  const r5c = await add(A, 4, `pilot-${run}-a5`)
  const s5c = await realState()
  const pidBefore = await bridgePid()
  const hostBefore = await hostPid()
  const rs = spawn(bridgeRestart, [], { stdio: 'ignore' })
  const exitCode = await new Promise<number | null>((r) => { rs.once('exit', r); rs.once('error', () => { r(-1) }) })
  const pidAfter = await bridgePid()
  const hostAfter = await hostPid()
  let r5d: unknown
  for (let i = 0; i < 40; i++) { r5d = await add(A, 4, `pilot-${run}-a5`); if (errorCode(r5d) !== 'device-offline' && errorCode(r5d) !== 'local-unavailable') break; await sleep(1000) }
  const s5d = await realState()
  check('5b-retry-across-bridge-restart-applies-once', exitCode === 0 && pidBefore !== '' && pidAfter !== '' && pidAfter !== pidBefore && hostAfter === hostBefore && errorCode(r5c) === undefined && s5c.count === s5b.count + 4 && errorCode(r5d) === undefined && s5d.count === s5c.count && s5d.rev === s5c.rev,
    { journalFileConfigured: process.env.DW_JOURNAL_FILE !== undefined, restartExit: exitCode, bridgePidChanged: pidAfter !== pidBefore, hostPidUnchanged: hostAfter === hostBefore, first: text(r5c), countAfterFirst: s5c.count, retryAfterBridgeRestart: text(r5d), countAfterRetry: s5d.count, revUnchanged: s5d.rev === s5c.rev })
}

// 6. Known gap, recorded not asserted: the real app keys requestId by (caller, requestId), and the bridge gets a new
// caller at each handshake. Ask the real app directly with two different local callers and the same requestId.
const viaOwner1 = await owner.call({ cid: 'pilot-caller-1', gid: 'pilot-caller-1', tool: 'widget_call' } as never, { slug: SLUG, action: 'add', args: { by: 1 }, requestId: `pilot-${run}-direct` })
const sd1 = await realState()
const owner2 = createLocal({ dshHome })
const viaOwner2 = await owner2.call({ cid: 'pilot-caller-2', gid: 'pilot-caller-2', tool: 'widget_call' } as never, { slug: SLUG, action: 'add', args: { by: 1 }, requestId: `pilot-${run}-direct` })
const sd2 = await realState()
steps['6-real-app-dedupe-is-per-caller'] = { ok: null, detail: { firstOk: viaOwner1.ok, secondOk: viaOwner2.ok, countAfterFirst: sd1.count, countAfterSecondCaller: sd2.count, appliedTwice: sd2.count === sd1.count + 1 } }
log(`INFO 6-real-app-dedupe-is-per-caller ${JSON.stringify(steps['6-real-app-dedupe-is-per-caller'])}`)

await A.close().catch(() => undefined); await B.close().catch(() => undefined)
evidence.cleanupRevokeA = (await admin('POST', `/admin/grants/${encodeURIComponent(gA)}/revoke`)).status
evidence.failures = failures
await writeFile(evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`)
log(`done: ${String(failures)} failure(s); evidence ${evidenceFile}`)
process.exit(failures === 0 ? 0 : 1)
