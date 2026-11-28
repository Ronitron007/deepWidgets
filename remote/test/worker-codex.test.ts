import { describe, expect, it } from 'vitest'
import { emptyLockout, lockoutAttempt, lockoutKey, type LockoutState } from '../worker/src/core.ts'

describe('lockout eviction (Codex hardening review)', () => {
  it('a flood of one-off keys does not evict an active ban', () => {
    const t0 = 1_000_000
    let s: LockoutState = emptyLockout()
    for (let i = 0; i < 5; i++) s = lockoutAttempt(s, 'victim', false, t0 + i).state
    expect(lockoutAttempt(s, 'victim', true, t0 + 10).result).toBe('locked')
    for (let i = 0; i < 1500; i++) s = lockoutAttempt(s, `noise-${String(i)}`, false, t0 + 100 + i).state
    expect(s.failures.length).toBeLessThanOrEqual(1000)
    expect(lockoutAttempt(s, 'victim', true, t0 + 2000).result).toBe('locked')
  })
  it('IPv4-mapped IPv6 and oversize values map to a canonical key', () => {
    expect(lockoutKey('::ffff:203.0.113.9')).toBe('203.0.113.9')
    expect(lockoutKey('x'.repeat(500)).length).toBeLessThanOrEqual(64)
  })
})
