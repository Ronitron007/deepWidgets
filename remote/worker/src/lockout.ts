/**
 * The Lockout Durable Object: failed passcode attempts per key (IPv4 address or IPv6 /64), no global ceiling (core.ts policy).
 * One instance per surface ('authorize', 'admin'), so each surface has its own counters.
 */
import { DurableObject } from 'cloudflare:workers'
import { emptyLockout, lockoutAttempt, type LockoutState, type LockoutVerdict } from './core.ts'
import type { Env } from './index.ts'

export class Lockout extends DurableObject<Env> {
  private async load(): Promise<LockoutState> {
    return (await this.ctx.storage.get<LockoutState>('state')) ?? emptyLockout()
  }

  /** Check and count in one call; DO input gates make it atomic against a parallel burst. */
  async attempt(key: string, ok: boolean): Promise<LockoutVerdict> {
    const { state, result } = lockoutAttempt(await this.load(), key, ok, Date.now())
    if (result === 'wrong') {
      // A failed write must not let a wrong passcode go uncounted: fail closed.
      try { await this.ctx.storage.put('state', state) } catch { return 'locked' }
    }
    return result
  }
}
