import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto'
import { createVerifier } from './bridge/src/assertion.ts'
import { ALLOWED_TOOLS } from './bridge/src/allowlist.ts'

// Test helper: signs a compact JWS (alg EdDSA, Ed25519) the way the worker will.
function signAssertion(privateKey: KeyObject, claims: Record<string, unknown>, kid = 'test-key'): string {
  const head = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid, typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  const signature = sign(null, Buffer.from(`${head}.${body}`), privateKey)
  return `${head}.${body}.${signature.toString('base64url')}`
}
const argsHash = (argsJson: string): string => createHash('sha256').update(argsJson).digest('base64url')

const T0 = Date.parse('2026-11-28T10:00:00.000Z')
const DEVICE = 'dev_test'
const keys = generateKeyPairSync('ed25519')
const other = generateKeyPairSync('ed25519')
const publicKey = keys.publicKey.export({ format: 'jwk' })
const CALL_ARGS = JSON.stringify({ slug: 'groceries', action: 'add', args: { item: 'milk' } })

function claims(tool: string, argsJson: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  return { v: 1, iss: 'dw-relay', aud: DEVICE, sub: 'owner', cid: 'client_abc123', gid: 'grant_1', scope: 'widgets:read widgets:call', wid: ['groceries'], tool, ah: argsHash(argsJson), iat: now, exp: now + 30, jti: randomBytes(16).toString('base64url'), ...over }
}
const jws = (c: Record<string, unknown>): string => signAssertion(keys.privateKey, c)
const verifier = (opts: { startedAtMs?: number; clockOffsetMs?: number } = {}) =>
  createVerifier({ publicKey, deviceId: DEVICE, startedAtMs: opts.startedAtMs ?? T0 - 600_000, clockOffsetMs: opts.clockOffsetMs ?? 0 })

const okOf = (r: unknown): unknown => (r as { ok?: unknown }).ok
const reasonOf = (r: unknown): unknown => (r as { reason?: unknown }).reason
const claimsOf = (r: unknown): Record<string, unknown> => ((r as { claims?: unknown }).claims ?? {}) as Record<string, unknown>
const reasons = new Map<string, unknown>()
function expectRejected(name: string, r: unknown): void {
  expect(okOf(r)).toBe(false)
  expect(typeof reasonOf(r)).toBe('string')
  expect(String(reasonOf(r)).length).toBeGreaterThan(0)
  reasons.set(name, reasonOf(r))
}

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
})

afterAll(() => {
  vi.useRealTimers()
})

describe('bridge assertion verifier', () => {
  it('accepts a valid widget_call assertion and returns its claims', () => {
    const r = verifier().verify(jws(claims('widget_call', CALL_ARGS)), CALL_ARGS)
    expect(okOf(r)).toBe(true)
    expect(claimsOf(r).tool).toBe('widget_call')
    expect(claimsOf(r).aud).toBe(DEVICE)
  })

  it('accepts widget_list with scope widgets:read and no slug', () => {
    const args = JSON.stringify({})
    const r = verifier().verify(jws(claims('widget_list', args, { scope: 'widgets:read' })), args)
    expect(okOf(r)).toBe(true)
  })

  it('accepts any slug except main when wid is *', () => {
    const args = JSON.stringify({ slug: 'notes' })
    const r = verifier().verify(jws(claims('widget_describe', args, { wid: ['*'] })), args)
    expect(okOf(r)).toBe(true)
  })

  it('rejects tampered args', () => {
    const tampered = JSON.stringify({ slug: 'groceries', action: 'add', args: { item: 'eggs' } })
    expectRejected('args', verifier().verify(jws(claims('widget_call', CALL_ARGS)), tampered))
  })

  it('rejects a tampered signature', () => {
    const parts = jws(claims('widget_call', CALL_ARGS)).split('.')
    const sig = parts[2] ?? ''
    const flipped = (sig.startsWith('A') ? 'B' : 'A') + sig.slice(1)
    expectRejected('signature', verifier().verify(`${parts[0]}.${parts[1]}.${flipped}`, CALL_ARGS))
  })

  it('rejects a signature made by another key', () => {
    expectRejected('other-key', verifier().verify(signAssertion(other.privateKey, claims('widget_call', CALL_ARGS)), CALL_ARGS))
  })

  it('rejects an expired assertion', () => {
    const now = Math.floor(T0 / 1000)
    expectRejected('expired', verifier().verify(jws(claims('widget_call', CALL_ARGS, { iat: now - 40, exp: now - 10 })), CALL_ARGS))
  })

  it('rejects a replayed jti', () => {
    const v = verifier()
    const token = jws(claims('widget_call', CALL_ARGS))
    expect(okOf(v.verify(token, CALL_ARGS))).toBe(true)
    expectRejected('replay', v.verify(token, CALL_ARGS))
  })

  it('rejects a wrong aud', () => {
    expectRejected('aud', verifier().verify(jws(claims('widget_call', CALL_ARGS, { aud: 'dev_other' })), CALL_ARGS))
  })

  it('rejects widget_install even with a valid signature', () => {
    const args = JSON.stringify({ slug: 'groceries' })
    expectRejected('tool', verifier().verify(jws(claims('widget_install', args)), args))
  })

  it('rejects slug main even when wid is *', () => {
    const args = JSON.stringify({ slug: 'main', action: 'list' })
    expectRejected('main', verifier().verify(jws(claims('widget_call', args, { wid: ['*'] })), args))
  })

  it('rejects a slug outside wid', () => {
    const args = JSON.stringify({ slug: 'notes', action: 'list' })
    expectRejected('wid', verifier().verify(jws(claims('widget_call', args, { wid: ['groceries'] })), args))
  })

  it('rejects a wrong issuer', () => {
    expectRejected('iss', verifier().verify(jws(claims('widget_call', CALL_ARGS, { iss: 'someone-else' })), CALL_ARGS))
  })

  it('rejects a tool that the scope does not cover', () => {
    expectRejected('scope', verifier().verify(jws(claims('widget_call', CALL_ARGS, { scope: 'widgets:read' })), CALL_ARGS))
  })

  it('rejects an assertion issued before the bridge started', () => {
    const now = Math.floor(T0 / 1000)
    expectRejected('before-start', verifier({ startedAtMs: T0 }).verify(jws(claims('widget_call', CALL_ARGS, { iat: now - 50, exp: now + 5 })), CALL_ARGS))
  })

  it('rejects a lifetime over 60 seconds', () => {
    const now = Math.floor(T0 / 1000)
    expectRejected('lifetime', verifier().verify(jws(claims('widget_call', CALL_ARGS, { iat: now, exp: now + 61 })), CALL_ARGS))
  })

  it('rejects a malformed token without throwing', () => {
    const v = verifier()
    expect(() => v.verify('not-a-jws', '{}')).not.toThrow()
    expect(okOf(v.verify('not-a-jws', '{}'))).toBe(false)
    expect(okOf(v.verify('a.b.c', '{}'))).toBe(false)
  })

  it('checks exp against the server clock offset', () => {
    const now = Math.floor(T0 / 1000)
    const behind = claims('widget_call', CALL_ARGS, { iat: now - 120, exp: now - 90 })
    expect(okOf(verifier({ clockOffsetMs: -120_000 }).verify(jws(behind), CALL_ARGS))).toBe(true)
    expect(okOf(verifier().verify(jws({ ...behind, jti: randomBytes(16).toString('base64url') }), CALL_ARGS))).toBe(false)
  })

  it('gives the eight named rejections distinct reasons', () => {
    const names = ['args', 'signature', 'expired', 'replay', 'aud', 'tool', 'main', 'wid']
    const got = names.map((name) => reasons.get(name))
    for (const reason of got) expect(typeof reason).toBe('string')
    expect(new Set(got).size).toBe(names.length)
  })
})

describe('bridge allowlist', () => {
  it('is a frozen list of exactly the four interact tools', () => {
    expect([...ALLOWED_TOOLS].sort()).toEqual(['widget_call', 'widget_changes', 'widget_describe', 'widget_list'])
    expect(Object.isFrozen(ALLOWED_TOOLS)).toBe(true)
  })
})
