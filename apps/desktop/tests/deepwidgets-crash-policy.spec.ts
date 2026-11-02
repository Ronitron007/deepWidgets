import { describe, expect, it } from 'vitest'
import { HostCrashPolicy } from '../src/deepwidgets-crash-policy.ts'

/** A policy on a clock that the test moves. */
function fixture() {
  let now = 1_000_000
  const policy = new HostCrashPolicy(() => now)
  return { policy, advance: (ms: number) => { now += ms } }
}

describe('HostCrashPolicy (widget_phase2.isolation.supervisor)', () => {
  it('backs off 0.5 s, 2 s, 8 s; safe mode from crash 2; gives up at crash 4', () => {
    const { policy, advance } = fixture()
    expect(policy.crash()).toEqual({ kind: 'restart', crashes: 1, delayMs: 500, safeMode: false })
    advance(5_000)
    expect(policy.crash()).toEqual({ kind: 'restart', crashes: 2, delayMs: 2_000, safeMode: true })
    advance(5_000)
    expect(policy.crash()).toEqual({ kind: 'restart', crashes: 3, delayMs: 8_000, safeMode: true })
    advance(5_000)
    expect(policy.crash()).toEqual({ kind: 'give-up', crashes: 4 })
  })

  it('drops a crash once it is 60 s old: the count resets and safe mode ends', () => {
    const { policy, advance } = fixture()
    policy.crash()
    advance(10_000)
    expect(policy.crash()).toMatchObject({ crashes: 2, safeMode: true })
    advance(60_001)
    expect(policy.crash()).toEqual({ kind: 'restart', crashes: 1, delayMs: 500, safeMode: false })
  })

  it('counts a crash at 59.999 s and drops it at exactly 60 s', () => {
    const { policy, advance } = fixture()
    policy.crash()
    advance(59_999)
    expect(policy.crash()).toMatchObject({ crashes: 2 })
    advance(1)
    // The first crash is now 60 s old; the second is 1 ms old.
    expect(policy.crash()).toMatchObject({ crashes: 2, delayMs: 2_000 })
  })

  it('does not give up on 4 crashes spread over more than 60 s', () => {
    const { policy, advance } = fixture()
    for (let crash = 0; crash < 3; crash += 1) { policy.crash(); advance(25_000) }
    expect(policy.crash()).toMatchObject({ kind: 'restart', crashes: 3, delayMs: 8_000 })
  })
})
