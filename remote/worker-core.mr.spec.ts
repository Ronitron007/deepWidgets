import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { createVerifier } from './bridge/src/assertion.ts'
import { argsHash, buildClaims, signAssertion } from './worker/src/assertion.ts'
import { clientIp, credentialMatches, emptyLockout, isLocked, LOCKOUT_WINDOW_MS, parseGrantProps, recordFailure, toolsForScope } from './worker/src/core.ts'

type Tool = 'widget_list' | 'widget_describe' | 'widget_call' | 'widget_changes'

const T0 = Date.parse('2026-11-28T10:00:00.000Z')
const DEVICE = 'dev_test'
const keys = generateKeyPairSync('ed25519')
const other = generateKeyPairSync('ed25519')
const privateJwk = keys.privateKey.export({ format: 'jwk' })
const otherPrivateJwk = other.privateKey.export({ format: 'jwk' })
const publicJwk = keys.publicKey.export({ format: 'jwk' })
const CALL_ARGS = JSON.stringify({ slug: 'groceries', action: 'add', args: { item: 'milk' } })
const sha = (s: string): string => createHash('sha256').update(s, 'utf8').digest('base64url')
const field = (o: unknown, k: string): unknown => (o as Record<string, unknown>)[k]

async function claimsFor(tool: Tool, argsJson: string, scope = 'widgets:read widgets:call') {
  return await buildClaims({ deviceId: DEVICE, clientId: 'client_abc', grantId: 'grant_1', scope, widgets: ['groceries'], tool, argsJson, nowSec: Math.floor(Date.now() / 1000) })
}
const verifier = () => createVerifier({ publicKey: publicJwk, deviceId: DEVICE, startedAtMs: T0 - 600_000 })

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterAll(() => {
  vi.useRealTimers()
})

describe('worker assertion signer', () => {
  it('buildClaims returns the claims the bridge verifies', async () => {
    const c = await claimsFor('widget_call', CALL_ARGS)
    expect(field(c, 'v')).toBe(1)
    expect(field(c, 'iss')).toBe('dw-relay')
    expect(field(c, 'aud')).toBe(DEVICE)
    expect(field(c, 'sub')).toBe('owner')
    expect(field(c, 'cid')).toBe('client_abc')
    expect(field(c, 'gid')).toBe('grant_1')
    expect(field(c, 'scope')).toBe('widgets:read widgets:call')
    expect(field(c, 'wid')).toEqual(['groceries'])
    expect(field(c, 'tool')).toBe('widget_call')
    expect(field(c, 'ah')).toBe(sha(CALL_ARGS))
    const iat = field(c, 'iat') as number
    const exp = field(c, 'exp') as number
    expect(iat).toBe(Math.floor(T0 / 1000))
    expect(exp - iat).toBeGreaterThan(0)
    expect(exp - iat).toBeLessThanOrEqual(60)
    expect(typeof field(c, 'jti')).toBe('string')
    expect(String(field(c, 'jti')).length).toBeGreaterThanOrEqual(16)
  })

  it('two buildClaims calls get different jti values', async () => {
    const a = await claimsFor('widget_call', CALL_ARGS)
    const b = await claimsFor('widget_call', CALL_ARGS)
    expect(field(a, 'jti')).not.toBe(field(b, 'jti'))
  })

  it('argsHash is the base64url SHA-256 of the args JSON', async () => {
    expect(await argsHash(CALL_ARGS)).toBe(sha(CALL_ARGS))
    expect(await argsHash('{}')).toBe(sha('{}'))
  })

  it('a worker-signed widget_call assertion passes the bridge verifier', async () => {
    const jws = await signAssertion(privateJwk, await claimsFor('widget_call', CALL_ARGS))
    const r = verifier().verify(jws, CALL_ARGS)
    expect(r.ok).toBe(true)
    expect(r.ok ? r.claims.gid : undefined).toBe('grant_1')
  })

  it('a worker-signed widget_list assertion with scope widgets:read passes the bridge verifier', async () => {
    const args = JSON.stringify({})
    const jws = await signAssertion(privateJwk, await claimsFor('widget_list', args, 'widgets:read'))
    expect(verifier().verify(jws, args).ok).toBe(true)
  })

  it('the signed header is alg EdDSA and the JWS has three base64url parts', async () => {
    const jws = await signAssertion(privateJwk, await claimsFor('widget_call', CALL_ARGS))
    const parts = jws.split('.')
    expect(parts.length).toBe(3)
    for (const part of parts) expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
    const header = JSON.parse(Buffer.from(parts[0] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>
    expect(header.alg).toBe('EdDSA')
  })

  it('an assertion signed with another key is rejected by the bridge verifier', async () => {
    const jws = await signAssertion(otherPrivateJwk, await claimsFor('widget_call', CALL_ARGS))
    expect(verifier().verify(jws, CALL_ARGS).ok).toBe(false)
  })
})

describe('worker core helpers', () => {
  it('toolsForScope maps widgets:read to list, describe and changes', () => {
    expect([...toolsForScope('widgets:read')].sort()).toEqual(['widget_changes', 'widget_describe', 'widget_list'])
  })

  it('toolsForScope maps widgets:call to widget_call only', () => {
    expect([...toolsForScope('widgets:call')]).toEqual(['widget_call'])
  })

  it('toolsForScope gives all four tools for both scopes and none for an empty or unknown scope', () => {
    expect([...toolsForScope('widgets:read widgets:call')].sort()).toEqual(['widget_call', 'widget_changes', 'widget_describe', 'widget_list'])
    expect([...toolsForScope('')]).toEqual([])
    expect([...toolsForScope('widgets:admin')]).toEqual([])
  })

  it('parseGrantProps accepts a well-formed props object', () => {
    const props = { owner: 'owner', deviceId: DEVICE, widgets: ['groceries'], scope: 'widgets:read widgets:call', grantId: 'grant_1' }
    expect(parseGrantProps(props)).toEqual(props)
  })

  it('parseGrantProps returns null for missing or mistyped fields', () => {
    const good = { owner: 'owner', deviceId: DEVICE, widgets: ['groceries'], scope: 'widgets:read', grantId: 'grant_1' }
    expect(parseGrantProps(null)).toBeNull()
    expect(parseGrantProps(undefined)).toBeNull()
    expect(parseGrantProps({})).toBeNull()
    expect(parseGrantProps({ ...good, widgets: 'groceries' })).toBeNull()
    expect(parseGrantProps({ ...good, widgets: [1] })).toBeNull()
    expect(parseGrantProps({ ...good, scope: 5 })).toBeNull()
    const { grantId: _drop, ...noGrant } = good
    expect(parseGrantProps(noGrant)).toBeNull()
  })

  it('credentialMatches is true only for the credential whose SHA-256 hex is configured', async () => {
    const expected = createHash('sha256').update('dwd_secret', 'utf8').digest('hex')
    expect(await credentialMatches('dwd_secret', expected)).toBe(true)
    expect(await credentialMatches('dwd_wrong', expected)).toBe(false)
    expect(await credentialMatches('', expected)).toBe(false)
    expect(await credentialMatches('dwd_secret', '')).toBe(false)
  })

  it('lockout blocks an IP after 5 failures within 15 minutes and not other IPs', () => {
    let s = emptyLockout()
    for (let i = 0; i < 4; i++) s = recordFailure(s, '1.1.1.1', T0 + i)
    expect(isLocked(s, '1.1.1.1', T0 + 10)).toBe(false)
    s = recordFailure(s, '1.1.1.1', T0 + 5)
    expect(isLocked(s, '1.1.1.1', T0 + 10)).toBe(true)
    expect(isLocked(s, '2.2.2.2', T0 + 10)).toBe(false)
    const copy = JSON.parse(JSON.stringify(s)) as typeof s
    expect(isLocked(copy, '1.1.1.1', T0 + 10)).toBe(true)
  })

  it('lockout failures older than 15 minutes stop counting', () => {
    expect(LOCKOUT_WINDOW_MS).toBe(900_000)
    let s = emptyLockout()
    for (let i = 0; i < 5; i++) s = recordFailure(s, '1.1.1.1', T0)
    expect(isLocked(s, '1.1.1.1', T0 + 1)).toBe(true)
    expect(isLocked(s, '1.1.1.1', T0 + LOCKOUT_WINDOW_MS + 1)).toBe(false)
  })

  it('lockout has no global ceiling: 49+ failures from other IPs never lock a fresh IP (MUST-FIX 2)', () => {
    let s = emptyLockout()
    for (let i = 0; i < 60; i++) s = recordFailure(s, '10.0.0.' + String(i), T0 + i)
    expect(isLocked(s, '9.9.9.9', T0 + 100)).toBe(false)
  })

  it('clientIp reads CF-Connecting-IP and falls back to unknown', () => {
    expect(clientIp(new Request('https://relay.example/authorize', { headers: { 'CF-Connecting-IP': '203.0.113.7' } }))).toBe('203.0.113.7')
    expect(clientIp(new Request('https://relay.example/authorize'))).toBe('unknown')
  })
})
