/**
 * deepWidgets crash policy: what Electron main does after one Host crash (`widget_phase2.isolation.supervisor`).
 * Pure: the caller gives the clock, and the policy starts no timer.
 * @module deepwidgets-crash-policy
 */

/** Wait before restart number 1, 2, and 3 in the window. */
export const BACKOFF_MS = [500, 2_000, 8_000] as const
/** The window in which crashes count. */
export const CRASH_WINDOW_MS = 60_000
/** Crashes in the window from which the next start is in safe mode. */
export const SAFE_MODE_AFTER = 2
/** Crashes in the window at which Electron main gives up and the DSH fatal dialog shows. */
export const GIVE_UP_AFTER = 4

/** The decision for one crash. `crashes` counts this crash and the earlier ones in the window. */
export type CrashDecision =
  | { readonly kind: 'restart'; readonly crashes: number; readonly delayMs: number; readonly safeMode: boolean }
  | { readonly kind: 'give-up'; readonly crashes: number }

/** Counts the Host crashes of the last {@link CRASH_WINDOW_MS} and decides the next step. */
export class HostCrashPolicy {
  private times: number[] = []

  /** @param now - the clock in ms. */
  constructor(private readonly now: () => number = Date.now) {}

  /** Record one crash at `now()` and decide. A crash older than the window no longer counts. */
  crash(): CrashDecision {
    const at = this.now()
    this.times = this.times.filter(time => at - time < CRASH_WINDOW_MS)
    this.times.push(at)
    const crashes = this.times.length
    if (crashes >= GIVE_UP_AFTER) return { kind: 'give-up', crashes }
    return {
      kind: 'restart',
      crashes,
      delayMs: BACKOFF_MS[Math.min(crashes, BACKOFF_MS.length) - 1] ?? BACKOFF_MS[2],
      safeMode: crashes >= SAFE_MODE_AFTER,
    }
  }
}
