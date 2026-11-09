import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DesktopHostSupervisor } from '../src/deepwidgets-supervisor.ts'

/** The failure that `DesktopHostProcess` gives for the exit of the Host child `pid`. */
const exitOf = (pid: number): Error => Object.assign(new Error('dsh desktop host exited with 1'), { hostPid: pid })

/** A supervisor whose restart resolves at once, and whose crash record the test sets. */
function fixture() {
  let record: unknown
  const restarts: number[] = []
  const supervisor = new DesktopHostSupervisor(() => { restarts.push(Date.now()); return Promise.resolve() }, () => record)
  return {
    supervisor,
    restarts,
    setRecord: (next: unknown): void => { record = next },
    /** Fail the Host `pid`, then run the waiting restart. */
    fail: async (pid: number): Promise<boolean> => {
      const restarting = supervisor.failed(exitOf(pid), false)
      await vi.runOnlyPendingTimersAsync()
      return restarting
    },
  }
}

describe('DesktopHostSupervisor blame (widget_phase2.isolation.blame)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not count a crash of the blamed Host, then counts each later Host that dies before it applies the record', async () => {
    const { supervisor, setRecord, fail } = fixture()
    supervisor.ready()
    // Host 100 blames a widget and exits.
    setRecord({ row: 'deepwidgets-widget-blame-timer', pid: 100, at: Date.now(), applied: false })
    expect(await fail(100)).toBe(true)
    expect(supervisor.hostEnvironment()).toEqual({})
    // Hosts 101 to 104 die at boot, before they mark the record applied. The record is stale for each of them.
    expect(await fail(101)).toBe(true)
    expect(await fail(102)).toBe(true)
    expect(supervisor.hostEnvironment()).toEqual({ DEEPWIDGETS_SAFE_MODE: '1' })
    expect(await fail(103)).toBe(true)
    // The fourth unblamed crash in 60 s gives up: the DSH fatal dialog takes over.
    expect(await fail(104)).toBe(false)
  })

  it('counts a blamed crash toward neither safe mode nor the give-up', async () => {
    const { supervisor, setRecord, fail } = fixture()
    supervisor.ready()
    for (let pid = 200; pid < 206; pid += 1) {
      setRecord({ row: 'deepwidgets-widget-blame-timer', pid, at: Date.now(), applied: false })
      expect(await fail(pid)).toBe(true)
      supervisor.ready()
    }
    expect(supervisor.hostEnvironment()).toEqual({})
  })

  it('counts a crash as unblamed when the record is applied or the failure has no pid', async () => {
    const { supervisor, setRecord, fail } = fixture()
    supervisor.ready()
    setRecord({ row: 'deepwidgets-widget-blame-timer', pid: 300, at: Date.now(), applied: true })
    expect(await fail(300)).toBe(true)
    setRecord({ row: 'deepwidgets-widget-blame-timer', pid: 301, at: Date.now(), applied: false })
    expect(supervisor.failed(new Error('dsh desktop host sent an invalid IPC event'), false)).toBe(true)
    await vi.runOnlyPendingTimersAsync()
    // Two unblamed crashes: safe mode.
    expect(supervisor.hostEnvironment()).toEqual({ DEEPWIDGETS_SAFE_MODE: '1' })
  })
})

describe('DesktopHostSupervisor provisional record (widget_phase2.isolation.watchdog)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  /** The failure of a Host child `pid` that ended with `signal`, or with `code` and no signal. */
  const endOf = (pid: number, signal: string | null, code: number | null = null): Error =>
    Object.assign(new Error('dsh desktop host stopped'), { hostPid: pid, hostCode: code, hostSignal: signal })

  /** A supervisor whose crash record and provisional record the test sets, and which records each discard. */
  function provisionalFixture() {
    let crash: unknown
    let provisional: unknown
    const discarded: number[] = []
    const supervisor = new DesktopHostSupervisor(() => Promise.resolve(), () => crash, () => provisional, (pid) => { discarded.push(pid) })
    return {
      supervisor,
      discarded,
      set: (nextCrash: unknown, nextProvisional: unknown): void => { crash = nextCrash; provisional = nextProvisional },
      fail: async (failure: Error): Promise<boolean> => {
        const restarting = supervisor.failed(failure, false)
        await vi.runOnlyPendingTimersAsync()
        return restarting
      },
    }
  }

  /** An older crash record that a Host applied, and a provisional record of the Host `pid`. */
  const records = (pid: number): [unknown, unknown] => [
    { row: null, pid: 1, at: 0, applied: true },
    { row: 'deepwidgets-widget-watchdog', pid, at: Date.now(), applied: false },
  ]

  it('counts an abort that only the provisional record blames as blamed, and keeps the record', async () => {
    const { supervisor, discarded, set, fail } = provisionalFixture()
    supervisor.ready()
    const ends = [endOf(400, 'SIGABRT'), endOf(401, 'SIGTRAP'), endOf(402, 'SIGILL'), endOf(403, null, 134), endOf(404, 'SIGABRT')]
    for (const end of ends) {
      set(...records((end as unknown as { hostPid: number }).hostPid))
      expect(await fail(end)).toBe(true)
      supervisor.ready()
    }
    expect(supervisor.hostEnvironment()).toEqual({})
    expect(discarded).toEqual([])
  })

  it('counts another end with only a provisional record as unblamed, and discards the record', async () => {
    const { supervisor, discarded, set, fail } = provisionalFixture()
    supervisor.ready()
    set(...records(410))
    expect(await fail(endOf(410, 'SIGKILL'))).toBe(true)
    set(...records(411))
    expect(await fail(endOf(411, null, 1))).toBe(true)
    expect(discarded).toEqual([410, 411])
    // Two unblamed crashes: safe mode.
    expect(supervisor.hostEnvironment()).toEqual({ DEEPWIDGETS_SAFE_MODE: '1' })
  })

  it('discards the provisional record of an end that is not an abort also before the first ready, on quit, and for an IPC fatal event', async () => {
    // widget_fv.crash: the fatal event of DesktopHostProcess carries the pid and no code or signal.
    const { supervisor, discarded, set, fail } = provisionalFixture()
    set(...records(420))
    expect(await fail(endOf(420, 'SIGKILL'))).toBe(false)
    set(...records(421))
    expect(supervisor.failed(endOf(421, null, 1), true)).toBe(false)
    supervisor.ready()
    set(...records(422))
    expect(await fail(Object.assign(new Error('startup failed'), { hostPid: 422 }))).toBe(true)
    set(...records(423))
    expect(supervisor.failed(endOf(423, 'SIGABRT'), true)).toBe(false)
    expect(discarded).toEqual([420, 421, 422])
  })

  it('lets a crash record of the dead Host win over its provisional record', async () => {
    const { supervisor, discarded, set, fail } = provisionalFixture()
    supervisor.ready()
    set({ row: null, pid: 500, at: Date.now(), applied: false }, { row: 'deepwidgets-widget-watchdog', pid: 500, at: Date.now(), applied: false })
    expect(await fail(endOf(500, 'SIGABRT'))).toBe(true)
    set({ row: null, pid: 501, at: Date.now(), applied: false }, { row: 'deepwidgets-widget-watchdog', pid: 500, at: Date.now(), applied: true })
    expect(await fail(endOf(501, 'SIGABRT'))).toBe(true)
    // Two unblamed crashes: safe mode.
    expect(supervisor.hostEnvironment()).toEqual({ DEEPWIDGETS_SAFE_MODE: '1' })
    expect(discarded).toEqual([])
  })
})
