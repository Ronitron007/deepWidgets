/**
 * End to end (npm run e2e; not part of `npx vitest run`): stub + bridge + `wrangler dev` relay + an MCP SDK client
 * that goes through OAuth with the owner passcode. Secrets live only in a temp copy of worker/ and in memory.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createHash, generateKeyPairSync, randomBytes, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startBridge, type Bridge } from '../bridge/src/main.ts'
import { startStub, type Stub } from '../stub/src/server.ts'
import { connectWithOAuth, consent, createClient, errorCode, OwnerConsentProvider, REDIRECT_URI } from './remote-smoke.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DEVICE_ID = 'dev_e2e'
const INTERACT = ['widget_call', 'widget_changes', 'widget_describe', 'widget_list']
const NEVER_REMOTE = ['widget_install', 'widget_reload', 'widget_remove', 'widget_template', 'widget_guide', 'library_template', 'deepwidgets_modes']

let tmp = ''
let dshHome = ''
let killFile = ''
let workerUrl = ''
let passcode = ''
let publicJwk: Record<string, unknown> = {}
let credentialFile = ''
let wrangler: ChildProcess | undefined
let stub: Stub
let bridge: Bridge | undefined
let provider: OwnerConsentProvider
let client: Client
let clientId = ''

const sleep = (ms: number): Promise<void> => new Promise((done) => setTimeout(done, ms))

async function freePort(): Promise<number> {
  return await new Promise((done, fail) => {
    const server = createServer()
    server.once('error', fail)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close(() => done(typeof address === 'object' && address !== null ? address.port : 0))
    })
  })
}

async function admin(method: string, path: string, body?: unknown): Promise<Response> {
  return await fetch(`${workerUrl}${path}`, {
    method,
    headers: { 'content-type': 'application/json', 'x-owner-passcode': passcode },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

const addItem = (item: string) => client.callTool({ name: 'widget_call', arguments: { slug: 'groceries', action: 'add', args: { item } } })

async function waitForBridge(): Promise<void> {
  for (let i = 0; i < 450; i++) {
    const status = (await (await admin('GET', '/admin/audit')).json()) as { connected?: boolean }
    if (status.connected === true) return
    await sleep(100)
  }
  throw new Error('the bridge did not connect')
}

beforeAll(async () => {
  tmp = await mkdtemp(join(tmpdir(), 'dw-e2e-'))
  dshHome = join(tmp, 'dsh')
  killFile = join(tmp, 'bridge-state', 'KILL')
  await mkdir(join(tmp, 'bridge-state'), { recursive: true })
  stub = await startStub({ dshHome, port: 0 })

  // Fresh secrets for this run: Ed25519 key pair, 128-bit passcode, device credential.
  const keys = generateKeyPairSync('ed25519')
  publicJwk = keys.publicKey.export({ format: 'jwk' }) as Record<string, unknown>
  passcode = randomBytes(24).toString('hex')
  const credential = `dwd_${DEVICE_ID}.${randomBytes(32).toString('base64url')}`
  credentialFile = join(tmp, 'bridge-state', 'credential')
  await writeFile(credentialFile, `${credential}\n`, { mode: 0o600 })

  // A temp copy of worker/ with .dev.vars; node_modules is linked so wrangler can bundle the imports.
  const port = await freePort()
  workerUrl = `http://127.0.0.1:${String(port)}`
  const workerDir = join(tmp, 'worker')
  await cp(join(ROOT, 'worker'), workerDir, { recursive: true, filter: (src) => !/[/\\](\.wrangler|\.dev\.vars)$/.test(src) })
  await symlink(join(ROOT, 'node_modules'), join(tmp, 'node_modules'), 'dir')
  const devVars = [
    `OWNER_PASSCODE=${passcode}`,
    `ASSERTION_SIGNING_KEY=${JSON.stringify(keys.privateKey.export({ format: 'jwk' }))}`,
    `DEVICE_CREDENTIAL_SHA256=${createHash('sha256').update(credential).digest('hex')}`,
    `PUBLIC_URL=${workerUrl}`,
    `DEVICE_ID=${DEVICE_ID}`,
  ]
  await writeFile(join(workerDir, '.dev.vars'), `${devVars.join('\n')}\n`, { mode: 0o600 })

  const log = createWriteStream(join(tmp, 'wrangler.log'))
  wrangler = spawn(process.execPath, [join(ROOT, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), 'dev', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', join(tmp, 'state')], {
    cwd: workerDir,
    detached: true,
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  wrangler.stdout?.pipe(log)
  wrangler.stderr?.pipe(log)

  const deadline = Date.now() + 120_000
  for (;;) {
    try {
      const response = await fetch(`${workerUrl}/.well-known/oauth-protected-resource/mcp`)
      if (response.ok) break
    } catch { /* not up yet */ }
    if (Date.now() > deadline || wrangler.exitCode !== null) {
      // The log shows secrets only as "(hidden)".
      throw new Error(`wrangler dev did not start:\n${(await readFile(join(tmp, 'wrangler.log'), 'utf8')).slice(-3000)}`)
    }
    await sleep(500)
  }

  clientId = await createClient(workerUrl, passcode)
  bridge = await startBridge({ workerUrl, credentialFile, publicKey: publicJwk, dshHome, killFile, log: () => undefined })
  await waitForBridge()
  provider = new OwnerConsentProvider(clientId, passcode)
  client = await connectWithOAuth(workerUrl, provider)
}, 180_000)

afterAll(async () => {
  await client?.close().catch(() => undefined)
  await bridge?.close().catch(() => undefined)
  await stub?.close().catch(() => undefined)
  if (wrangler?.pid !== undefined && wrangler.exitCode === null) {
    const exited = new Promise((done) => wrangler?.once('exit', done))
    try { process.kill(-wrangler.pid, 'SIGTERM') } catch { /* gone */ }
    await Promise.race([exited, sleep(5_000)])
    try { process.kill(-wrangler.pid, 'SIGKILL') } catch { /* gone */ }
  }
  if (tmp !== '') await rm(tmp, { recursive: true, force: true })
}, 30_000)

/** The pilot of docs/specs/product-direction.md: two clients with different rights on one widget, revoke during a host restart, idempotent retry. */
describe('first pilot (product direction)', () => {
  let readerId = ''
  let reader: Client
  const applied = (requestId: string) => stub.calls().filter((c) => c.tool === 'widget_call' && (c.args as { requestId?: string }).requestId === requestId).length
  const addWith = (c: Client, item: string, requestId: string, extra: Record<string, unknown> = {}) =>
    c.callTool({ name: 'widget_call', arguments: { slug: 'groceries', action: 'add', args: { item, ...extra }, requestId } })
  const grantOf = async (cid: string): Promise<string> => {
    const grants = (await (await admin('GET', '/admin/grants')).json()) as { grants: { id: string; clientId: string }[] }
    return grants.grants.find((g) => g.clientId === cid)?.id ?? ''
  }

  it('client B (read only) and client A (read and call) have different rights on the same widget', async () => {
    const response = await admin('POST', '/admin/clients', { client_name: 'dw-reader', redirect_uris: [REDIRECT_URI], allowLoopback: true })
    readerId = ((await response.json()) as { client_id: string }).client_id
    reader = await connectWithOAuth(workerUrl, new OwnerConsentProvider(readerId, passcode, ['widgets:read']))
    const readerTools = (await reader.listTools()).tools.map((t) => t.name).sort()
    expect(readerTools).toEqual(['widget_changes', 'widget_describe', 'widget_list'])
    expect(errorCode(await reader.callTool({ name: 'widget_describe', arguments: { slug: 'groceries' } }))).toBeUndefined()
    const before = stub.calls().length
    let refused = false
    try {
      refused = errorCode(await addWith(reader, 'sneaky', 'req-reader-0001')) !== undefined
    } catch { refused = true }
    expect(refused).toBe(true)
    expect(stub.calls().length).toBe(before)
    expect((await client.listTools()).tools.map((t) => t.name)).toContain('widget_call')
    expect(await grantOf(readerId)).not.toBe(await grantOf(clientId))
    expect(await grantOf(readerId)).not.toBe('')
  })

  it('a retry of the same requestId and args after a lost response is applied once', async () => {
    expect(errorCode(await addWith(client, 'pilot-milk', 'req-pilot-0001'))).toBeUndefined()
    // The answer is treated as lost: the agent sends the identical call again.
    const retry = await addWith(client, 'pilot-milk', 'req-pilot-0001')
    expect(errorCode(retry)).toBeUndefined()
    expect(applied('req-pilot-0001')).toBe(1)
  })

  it('the same requestId with different args is refused and applies nothing', async () => {
    expect(errorCode(await addWith(client, 'pilot-other', 'req-pilot-0001'))).toBe('idempotency-conflict')
    expect(applied('req-pilot-0001')).toBe(1)
    expect(stub.calls().some((c) => (c.args.args as { item?: string } | undefined)?.item === 'pilot-other')).toBe(false)
  })

  it('a retry after a host restart is still applied once (the bridge holds the operation id, not the local caller)', async () => {
    expect(errorCode(await addWith(client, 'pilot-eggs', 'req-pilot-0002'))).toBeUndefined()
    await stub.restart()
    expect(errorCode(await addWith(client, 'pilot-eggs', 'req-pilot-0002'))).toBeUndefined()
    expect(applied('req-pilot-0002')).toBe(1)
  })

  it('revoking client B during a host restart refuses B at once and leaves client A working', async () => {
    const grantId = await grantOf(readerId)
    const [revoked] = await Promise.all([admin('POST', `/admin/grants/${encodeURIComponent(grantId)}/revoke`), stub.restart()])
    expect(revoked.status).toBe(200)
    let refused: string
    try {
      refused = errorCode(await reader.callTool({ name: 'widget_list', arguments: {} })) ?? 'ran'
    } catch (error) {
      refused = error instanceof Error ? error.constructor.name : 'error'
    }
    expect(['grant-revoked', 'InvalidGrantError', 'UnauthorizedError']).toContain(refused)
    expect(errorCode(await addWith(client, 'pilot-after-restart', 'req-pilot-0003'))).toBeUndefined()
    expect(applied('req-pilot-0003')).toBe(1)
    await reader.close().catch(() => undefined)
  })
})

describe('relay end to end (wrangler dev)', () => {
  it('OAuth gave tokens to the pre-registered client and tools/list is exactly the four interact tools', async () => {
    expect(provider.tokens()?.access_token).toBeTruthy()
    expect(provider.clientInformation().client_id).toBe(clientId)
    const names = (await client.listTools()).tools.map((t) => t.name).sort()
    expect(names).toEqual(INTERACT)
  })

  it('widget_call groceries add succeeds and reaches the stub as a remote agent', async () => {
    const result = await addItem('milk')
    expect(errorCode(result)).toBeUndefined()
    const last = stub.calls().at(-1)
    expect(last?.tool).toBe('widget_call')
    expect(last?.args).toEqual({ slug: 'groceries', action: 'add', args: { item: 'milk' } })
    expect(last?.by.startsWith('remote-')).toBe(true)
  })

  it('reads are limited to the granted widgets', async () => {
    const list = await client.callTool({ name: 'widget_list', arguments: {} })
    expect(errorCode(list)).toBeUndefined()
    const widgets = (list.structuredContent as { widgets: { slug: string }[] }).widgets.map((w) => w.slug)
    expect(widgets).toEqual(['groceries'])
    const before = stub.calls().length
    expect(errorCode(await client.callTool({ name: 'widget_describe', arguments: { slug: 'secret' } }))).toBe('widget-not-granted')
    expect(errorCode(await client.callTool({ name: 'widget_describe', arguments: { slug: 'main' } }))).toBe('widget-not-granted')
    expect(stub.calls().length).toBe(before)
  })

  it('never-remote tools are absent, a direct tools/call fails, and the stub never sees them', async () => {
    const names = (await client.listTools()).tools.map((t) => t.name)
    for (const tool of NEVER_REMOTE) {
      expect(names).not.toContain(tool)
      let failed = false
      try {
        const result = await client.callTool({ name: tool, arguments: { dir: '/tmp/x', slug: 'groceries', mode: 'create' } })
        failed = result.isError === true
      } catch {
        failed = true
      }
      expect(failed).toBe(true)
    }
    const seen = new Set(stub.calls().map((c) => c.tool))
    for (const tool of NEVER_REMOTE) expect(seen.has(tool)).toBe(false)
  })

  it('/mcp/token on the Worker is 401 without a token and 404 with one', async () => {
    const before = stub.calls().length
    const bare = await fetch(`${workerUrl}/mcp/token`, { method: 'POST', body: '{}' })
    expect(bare.status).toBe(401)
    const withToken = await fetch(`${workerUrl}/mcp/token`, {
      method: 'POST',
      headers: { authorization: `Bearer ${provider.tokens()?.access_token ?? ''}`, 'content-type': 'application/json' },
      body: JSON.stringify({ agent: 'x', challenge: randomBytes(16).toString('base64url') }),
    })
    expect(withToken.status).toBe(404)
    expect(stub.calls().length).toBe(before)
  })

  it('no other /mcp/* path is forwarded: /mcp/anything and /mcp/ are 404 with a valid token', async () => {
    const before = stub.calls().length
    for (const path of ['/mcp/anything', '/mcp/', '/mcp/token/x', '/mcp/%2e', '/mcp/token']) {
      const r = await fetch(`${workerUrl}${path}`, { method: 'POST', headers: { authorization: `Bearer ${provider.tokens()?.access_token ?? ''}`, 'content-type': 'application/json' }, body: '{}' })
      expect(r.status, path).toBe(404)
    }
    expect(stub.calls().length).toBe(before)
  })

  it('/admin/clients refuses a loopback redirect URI unless allowLoopback is true', async () => {
    const make = (extra: Record<string, unknown>) => fetch(`${workerUrl}/admin/clients`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-owner-passcode': passcode },
      body: JSON.stringify({ client_name: 'loop', redirect_uris: [REDIRECT_URI], ...extra }),
    })
    expect((await make({})).status).toBe(400)
    expect((await make({ allowLoopback: true })).status).toBe(201)
  })

  it('discovery has no registration_endpoint and POST /register is not 2xx', async () => {
    const meta = (await (await fetch(`${workerUrl}/.well-known/oauth-authorization-server`)).json()) as Record<string, unknown>
    expect(meta.authorization_endpoint).toBe(`${workerUrl}/authorize`)
    expect('registration_endpoint' in meta).toBe(false)
    const register = await fetch(`${workerUrl}/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_name: 'evil', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none' }),
    })
    expect(register.status >= 200 && register.status < 300).toBe(false)
  })

  it('a request with a foreign Origin is refused by the MCP handler', async () => {
    const response = await fetch(`${workerUrl}/mcp`, {
      method: 'POST',
      headers: { authorization: `Bearer ${provider.tokens()?.access_token ?? ''}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', origin: 'https://evil.example' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
    })
    expect(response.status).toBe(403)
  })

  it('a wrong passcode issues no code', async () => {
    const url = new URL(`${workerUrl}/authorize`)
    url.search = new URLSearchParams({
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT_URI, state: randomUUID(),
      code_challenge: createHash('sha256').update(randomBytes(32).toString('base64url')).digest('base64url'),
      code_challenge_method: 'S256', scope: 'widgets:read widgets:call', resource: `${workerUrl}/mcp`,
    }).toString()
    const result = await consent(url, 'not-the-passcode-not-the-passcode')
    expect(result.status).toBe(403)
    expect(result.code).toBeNull()
    expect(result.location).toBeNull()
  })

  it('a call still works after 15 s idle (hibernation keeps the bridge authenticated)', async () => {
    await sleep(15_000)
    expect(errorCode(await addItem('after-idle'))).toBeUndefined()
    expect(stub.calls().at(-1)?.args).toMatchObject({ args: { item: 'after-idle' } })
  }, 40_000)

  it('cloud kill gives remote-disabled; turning it off restores calls', async () => {
    expect((await admin('POST', '/admin/kill', { on: true })).status).toBe(200)
    const before = stub.calls().length
    expect(errorCode(await addItem('while-killed'))).toBe('remote-disabled')
    expect(stub.calls().length).toBe(before)
    // The kill also drops the bridge socket and refuses its reconnects until it is turned off.
    const dropped = (await (await admin('GET', '/admin/audit')).json()) as { connected?: boolean }
    expect(dropped.connected).toBe(false)
    expect((await admin('POST', '/admin/kill', { on: false })).status).toBe(200)
    await waitForBridge()
    expect(errorCode(await addItem('after-kill'))).toBeUndefined()
  }, 60_000)

  it('the local kill file gives killed-locally; settings.json flips change neither kill state nor allowlist', async () => {
    await writeFile(killFile, '')
    const before = stub.calls().length
    expect(errorCode(await addItem('local-kill'))).toBe('killed-locally')
    expect(stub.calls().length).toBe(before)
    await unlink(killFile)
    const settings = join(dshHome, 'deepwidgets', 'settings.json')
    await writeFile(settings, JSON.stringify({ modes: { create: true, library: true } }))
    expect(errorCode(await addItem('after-settings'))).toBeUndefined()
    await writeFile(settings, JSON.stringify({ modes: { create: false, library: false } }))
    expect(errorCode(await addItem('after-settings-2'))).toBeUndefined()
    expect((await client.listTools()).tools.map((t) => t.name).sort()).toEqual(INTERACT)
  })

  it('the audit log has call rows without args', async () => {
    const status = (await (await admin('GET', '/admin/audit')).json()) as { rows: Record<string, unknown>[] }
    const calls = status.rows.filter((r) => r.tool === 'widget_call')
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.some((r) => r.outcome === 'ok' && r.slug === 'groceries')).toBe(true)
    expect(JSON.stringify(status)).not.toContain('after-idle')
  })

  it('stopping the bridge gives device-offline in under 2 s', async () => {
    await bridge?.close()
    bridge = undefined
    await sleep(300)
    const started = Date.now()
    expect(errorCode(await addItem('offline'))).toBe('device-offline')
    expect(Date.now() - started).toBeLessThan(2_000)
  })

  it('revoking the grant refuses the next call at once and refresh fails', async () => {
    const grants = (await (await admin('GET', '/admin/grants')).json()) as { grants: { id: string; clientId: string }[] }
    const grant = grants.grants.find((g) => g.clientId === clientId)
    expect(grant).toBeDefined()
    const grantId = grant?.id ?? ''
    expect((await admin('POST', `/admin/grants/${encodeURIComponent(grantId)}/revoke`)).status).toBe(200)
    // The DO revoked set answers grant-revoked while a token is still valid somewhere (KV is eventually consistent
    // in production). Local KV drops the token at once, so here the provider refuses first (401, then refresh fails).
    let refused: string
    try {
      refused = errorCode(await addItem('revoked')) ?? 'ran'
    } catch (error) {
      refused = error instanceof Error ? error.constructor.name : 'error'
    }
    expect(['grant-revoked', 'InvalidGrantError', 'UnauthorizedError']).toContain(refused)
    expect(stub.calls().some((c) => (c.args.args as { item?: string } | undefined)?.item === 'revoked')).toBe(false)
    const audit = (await (await admin('GET', '/admin/audit')).json()) as { rows: { grant: string; outcome: string }[] }
    expect(audit.rows.some((r) => r.grant === grantId && r.outcome === 'grant-revoked')).toBe(true)
  })

  it('five wrong passcodes on /admin lock out the next correct one with 429', async () => {
    for (let i = 0; i < 5; i++) {
      const wrong = await fetch(`${workerUrl}/admin/audit`, { headers: { 'x-owner-passcode': 'wrong' } })
      expect(wrong.status).toBe(401)
    }
    expect((await admin('GET', '/admin/audit')).status).toBe(429)
  })
})
