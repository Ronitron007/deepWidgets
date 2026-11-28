import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { fileURLToPath } from 'node:url'
import * as coreModule from './worker/src/core.ts'

type Verdict = 'ok' | 'wrong' | 'locked'
type Handler = (request: Request, env: unknown) => Promise<Response>
type Attempt = { state: unknown; result: Verdict }

const T0 = Date.parse('2026-11-28T10:00:00.000Z')
const PASSCODE = 'owner-passcode-'.padEnd(48, 'x')
const WRONG = 'w'.repeat(40)
const core = coreModule as unknown as Record<string, unknown>

function coreFn<T>(name: string): T {
  const value = core[name]
  if (typeof value !== 'function') throw new Error(`worker/src/core.ts does not export the function ${name}`)
  return value as T
}
const lockoutKey = (ip: string): string => coreFn<(ip: string) => string>('lockoutKey')(ip)
const lockoutAttempt = (state: unknown, key: string, ok: boolean, now: number): Attempt =>
  coreFn<(s: unknown, k: string, o: boolean, n: number) => Attempt>('lockoutAttempt')(state, key, ok, now)
const emptyLockout = (): unknown => coreFn<() => unknown>('emptyLockout')()

async function handler(rel: string, name: string): Promise<Handler> {
  const path: string = fileURLToPath(new URL(rel, import.meta.url))
  const mod = (await import(path)) as Record<string, unknown>
  return mod[name] as Handler
}

function fakeEnv(opts: { attempt: Verdict; locked?: boolean; helpers?: Record<string, unknown> }) {
  const calls: unknown[][] = []
  const kills: boolean[] = []
  const lockout = {
    async attempt(key: string, ok: boolean): Promise<Verdict> {
      calls.push(['attempt', key, ok])
      if (opts.attempt === 'locked') return 'locked'
      return ok ? 'ok' : 'wrong'
    },
    async locked(ip: string): Promise<boolean> {
      calls.push(['locked', ip])
      return opts.locked ?? false
    },
    async fail(ip: string): Promise<void> {
      calls.push(['fail', ip])
    },
  }
  const relay = {
    async setKill(on: boolean): Promise<Record<string, unknown>> {
      kills.push(on)
      return { remoteEnabled: !on }
    },
    async status(): Promise<Record<string, unknown>> {
      return { audit: [] }
    },
    async revokeGrant(): Promise<void> {},
  }
  const env = {
    LOCKOUT: { getByName: () => lockout },
    DEVICE: { getByName: () => relay },
    DEVICE_ID: 'dev_test',
    PUBLIC_URL: 'https://relay.example',
    OWNER_PASSCODE: PASSCODE,
    OAUTH_PROVIDER: opts.helpers ?? {},
  }
  return { env, calls, kills }
}

function adminRequest(path: string, method: string, opts: { passcode?: string; ip?: string; body?: unknown } = {}): Request {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (opts.passcode !== undefined) headers['x-owner-passcode'] = opts.passcode
  if (opts.ip !== undefined) headers['CF-Connecting-IP'] = opts.ip
  return new Request(`https://relay.example${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) })
}

function authorizeRequest(passcode: string, ip: string): Request {
  const body = new URLSearchParams({ handle: 'h1', passcode, scope: 'widgets:read', widgets: 'groceries' })
  return new Request('https://relay.example/authorize', { method: 'POST', headers: { 'CF-Connecting-IP': ip }, body })
}

async function createClient(body: Record<string, unknown>): Promise<{ status: number; created: Record<string, unknown>[] }> {
  const created: Record<string, unknown>[] = []
  const helpers = {
    async createClient(info: Record<string, unknown>): Promise<Record<string, unknown>> {
      created.push(info)
      return { clientId: 'client_1', clientName: info.clientName, redirectUris: info.redirectUris, tokenEndpointAuthMethod: 'none' }
    },
  }
  const { env } = fakeEnv({ attempt: 'ok', helpers })
  const handleAdmin = await handler('./worker/src/admin.ts', 'handleAdmin')
  const response = await handleAdmin(adminRequest('/admin/clients', 'POST', { passcode: PASSCODE, ip: '203.0.113.7', body }), env)
  return { status: response.status, created }
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterAll(() => {
  vi.useRealTimers()
})

describe('lockout policy (worker/src/core.ts)', () => {
  it('lockoutKey keeps an IPv4 address whole and maps a missing CF-Connecting-IP to unknown', () => {
    expect(lockoutKey('203.0.113.7')).toBe('203.0.113.7')
    expect(lockoutKey('203.0.113.8')).not.toBe(lockoutKey('203.0.113.7'))
    const clientIp = coreFn<(r: Request) => string>('clientIp')
    expect(lockoutKey(clientIp(new Request('https://relay.example/authorize')))).toBe('unknown')
  })

  it('lockoutKey gives every IPv6 address of one /64 the same key and other /64s a different key', () => {
    const a = lockoutKey('2001:db8:1:2::5')
    expect(lockoutKey('2001:db8:1:2:ffff:ffff:ffff:ffff')).toBe(a)
    expect(lockoutKey('2001:0DB8:0001:0002:0:0:0:9')).toBe(a)
    expect(lockoutKey('2001:db8:1:3::5')).not.toBe(a)
    expect(lockoutKey('2001:db8::1')).not.toBe(a)
    expect(lockoutKey('2001:db8::1')).toBe(lockoutKey('2001:db8:0:0:1::'))
    expect(a).not.toBe(lockoutKey('203.0.113.7'))
  })

  it('failures from any number of other addresses never lock out the owner', () => {
    const recordFailure = coreFn<(s: unknown, k: string, now: number) => unknown>('recordFailure')
    const isLocked = coreFn<(s: unknown, k: string, now: number) => boolean>('isLocked')
    let s = emptyLockout()
    for (let i = 0; i < 200; i++) s = recordFailure(s, `10.0.${String(Math.floor(i / 100))}.${String(i % 100)}`, T0 + i)
    expect(isLocked(s, '9.9.9.9', T0 + 300)).toBe(false)
    expect(lockoutAttempt(s, '9.9.9.9', true, T0 + 300).result).toBe('ok')
  })

  it('worker/src/core.ts no longer exports LOCKOUT_GLOBAL', () => {
    expect('LOCKOUT_GLOBAL' in core).toBe(false)
  })

  it('lockoutAttempt counts at most 5 wrong attempts per key and then refuses even the right passcode', () => {
    let s = emptyLockout()
    const results: Verdict[] = []
    for (let i = 0; i < 10; i++) {
      const r = lockoutAttempt(s, '198.51.100.1', false, T0 + i)
      s = r.state
      results.push(r.result)
    }
    expect(results).toEqual(['wrong', 'wrong', 'wrong', 'wrong', 'wrong', 'locked', 'locked', 'locked', 'locked', 'locked'])
    expect(lockoutAttempt(s, '198.51.100.1', true, T0 + 20).result).toBe('locked')
    expect(lockoutAttempt(s, '198.51.100.2', true, T0 + 20).result).toBe('ok')
  })

  it('lockoutAttempt does not count right passcodes and unlocks after 15 minutes', () => {
    const windowMs = core.LOCKOUT_WINDOW_MS as number
    expect(windowMs).toBe(900_000)
    const key = '198.51.100.9'
    let s = emptyLockout()
    for (let i = 0; i < 4; i++) s = lockoutAttempt(s, key, false, T0).state
    for (let i = 0; i < 3; i++) {
      const r = lockoutAttempt(s, key, true, T0 + 1)
      expect(r.result).toBe('ok')
      s = r.state
    }
    const fifth = lockoutAttempt(s, key, false, T0 + 2)
    expect(fifth.result).toBe('wrong')
    expect(lockoutAttempt(fifth.state, key, true, T0 + 3).result).toBe('locked')
    expect(lockoutAttempt(fifth.state, key, true, T0 + 2 + windowMs + 1).result).toBe('ok')
  })
})

describe('admin and authorize lockout', () => {
  it('/admin/kill turns remote access off and on with the right passcode even while the admin lockout is locked', async () => {
    const { env, kills } = fakeEnv({ attempt: 'locked', locked: true })
    const handleAdmin = await handler('./worker/src/admin.ts', 'handleAdmin')
    const off = await handleAdmin(adminRequest('/admin/kill', 'POST', { passcode: PASSCODE, ip: '203.0.113.7', body: { on: true } }), env)
    expect(off.status).toBe(200)
    expect(await off.json()).toEqual({ remoteEnabled: false })
    const on = await handleAdmin(adminRequest('/admin/kill', 'POST', { passcode: PASSCODE, ip: '203.0.113.7', body: { on: false } }), env)
    expect(on.status).toBe(200)
    expect(kills).toEqual([true, false])
  })

  it('/admin/kill with a wrong passcode answers 401 without touching the lockout or the kill flag', async () => {
    const { env, calls, kills } = fakeEnv({ attempt: 'ok' })
    const handleAdmin = await handler('./worker/src/admin.ts', 'handleAdmin')
    const wrong = await handleAdmin(adminRequest('/admin/kill', 'POST', { passcode: WRONG, ip: '203.0.113.7', body: { on: true } }), env)
    expect(wrong.status).toBe(401)
    const missing = await handleAdmin(adminRequest('/admin/kill', 'POST', { ip: '203.0.113.7', body: { on: false } }), env)
    expect(missing.status).toBe(401)
    expect(calls).toEqual([])
    expect(kills).toEqual([])
  })

  it('other admin routes check and count in one attempt(key, ok) call and answer 429 when it reports locked', async () => {
    const { env, calls } = fakeEnv({ attempt: 'locked', locked: false })
    const handleAdmin = await handler('./worker/src/admin.ts', 'handleAdmin')
    const response = await handleAdmin(adminRequest('/admin/audit', 'GET', { passcode: PASSCODE, ip: '203.0.113.7' }), env)
    expect(response.status).toBe(429)
    expect(calls).toContainEqual(['attempt', '203.0.113.7', true])
    expect(calls.filter((c) => c[0] === 'locked' || c[0] === 'fail')).toEqual([])
  })

  it('a wrong admin passcode is counted once through attempt under the /64 key or unknown', async () => {
    const { env, calls } = fakeEnv({ attempt: 'ok' })
    const handleAdmin = await handler('./worker/src/admin.ts', 'handleAdmin')
    const v6 = await handleAdmin(adminRequest('/admin/grants', 'GET', { passcode: WRONG, ip: '2001:db8:1:2::5' }), env)
    expect(v6.status).toBe(401)
    const anonymous = await handleAdmin(adminRequest('/admin/audit', 'GET', { passcode: WRONG }), env)
    expect(anonymous.status).toBe(401)
    expect(calls).toEqual([['attempt', lockoutKey('2001:db8:1:2:ffff::9'), false], ['attempt', 'unknown', false]])
  })

  it('POST /authorize answers 429 when attempt reports locked, even with the right passcode', async () => {
    const approvals: unknown[] = []
    const helpers = {
      async approveConsent(...args: unknown[]): Promise<never> {
        approvals.push(args)
        throw new Error('the consent handle expired')
      },
    }
    const { env, calls } = fakeEnv({ attempt: 'locked', locked: false, helpers })
    const handleAuthorize = await handler('./worker/src/authorize.ts', 'handleAuthorize')
    const response = await handleAuthorize(authorizeRequest(PASSCODE, '203.0.113.7'), env)
    expect(response.status).toBe(429)
    expect(approvals).toEqual([])
    expect(calls).toContainEqual(['attempt', '203.0.113.7', true])
  })

  it('a wrong /authorize passcode is counted through attempt(key, false)', async () => {
    const { env, calls } = fakeEnv({ attempt: 'ok', helpers: {} })
    const handleAuthorize = await handler('./worker/src/authorize.ts', 'handleAuthorize')
    const response = await handleAuthorize(authorizeRequest(WRONG, '203.0.113.7'), env)
    expect(response.status).toBe(403)
    expect(calls).toEqual([['attempt', '203.0.113.7', false]])
  })
})

describe('POST /admin/clients redirect URIs', () => {
  it('refuses loopback redirect URIs with 400 when allowLoopback is not set', async () => {
    for (const uri of ['http://127.0.0.1:53682/callback', 'http://127.5.6.7/cb', 'http://localhost:8080/cb', 'http://[::1]:9/cb', 'https://localhost/cb']) {
      const { status, created } = await createClient({ client_name: 'c', redirect_uris: [uri] })
      expect(status, uri).toBe(400)
      expect(created).toEqual([])
    }
  })

  it('accepts loopback redirect URIs only when allowLoopback is exactly true', async () => {
    const uri = 'http://127.0.0.1:53682/callback'
    const none = await createClient({ client_name: 'c', redirect_uris: [uri] })
    expect(none.status).toBe(400)
    expect(none.created).toEqual([])
    const text = await createClient({ client_name: 'c', redirect_uris: [uri], allowLoopback: 'true' })
    expect(text.status).toBe(400)
    const ok = await createClient({ client_name: 'c', redirect_uris: [uri], allowLoopback: true })
    expect(ok.status).toBe(201)
    expect(ok.created[0]?.redirectUris).toEqual([uri])
  })

  it('refuses a non-loopback redirect URI that is not https, even with allowLoopback', async () => {
    expect((await createClient({ client_name: 'c', redirect_uris: ['http://example.com/cb'] })).status).toBe(400)
    expect((await createClient({ client_name: 'c', redirect_uris: ['http://example.com/cb'], allowLoopback: true })).status).toBe(400)
    const ok = await createClient({ client_name: 'c', redirect_uris: ['https://example.com/cb'] })
    expect(ok.status).toBe(201)
    expect(ok.created[0]?.redirectUris).toEqual(['https://example.com/cb'])
  })

  it('refuses the whole redirect list when one URI is loopback and allowLoopback is not set', async () => {
    const { status, created } = await createClient({ client_name: 'c', redirect_uris: ['https://example.com/cb', 'http://127.0.0.1:1/cb'] })
    expect(status).toBe(400)
    expect(created).toEqual([])
  })
})
