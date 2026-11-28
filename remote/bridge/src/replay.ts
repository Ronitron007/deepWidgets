/**
 * Replay defence for assertions: a cache of seen `jti` values, each kept until its `exp` (plus the clock tolerance),
 * and the check that an assertion was issued after the bridge started, so a restart does not reopen a replay window.
 */

export interface ReplayCache {
  /** True when `jti` was seen and has not expired yet. */
  seen(jti: string, nowSec: number): boolean
  /** Keep `jti` until `untilSec`. */
  remember(jti: string, untilSec: number): void
  /** The number of live entries (for tests and logs). */
  size(): number
}

export function createReplayCache(): ReplayCache {
  const entries = new Map<string, number>()
  const prune = (nowSec: number): void => {
    for (const [jti, until] of entries) if (until < nowSec) entries.delete(jti)
  }
  return {
    seen(jti, nowSec) {
      prune(nowSec)
      return entries.has(jti)
    },
    remember(jti, untilSec) {
      entries.set(jti, untilSec)
    },
    size: () => entries.size,
  }
}

/** True when `iatSec` is before the bridge start, both on the server clock, minus the tolerance. */
export function issuedBeforeStart(iatSec: number, startedAtMs: number, clockOffsetMs: number, toleranceSec: number): boolean {
  return iatSec < (startedAtMs + clockOffsetMs) / 1000 - toleranceSec
}
