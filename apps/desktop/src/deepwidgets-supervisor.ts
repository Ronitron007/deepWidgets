/**
 * deepWidgets supervisor: restart a Host that exits unexpectedly, with backoff, safe mode, and a give-up.
 * The spec is `widget_phase2.isolation.supervisor` in `docs/specs/widget-phase2.md` (without blame).
 * Each event logs one line `deepwidgets-supervisor {json}`.
 * @module deepwidgets-supervisor
 */
import { HostCrashPolicy } from './deepwidgets-crash-policy.ts'

/** The Host environment key that starts the Host in safe mode. The widget runtime reads it (`SAFE_MODE_ENV` of `@deepwidgets/widgets`). */
export const SAFE_MODE_ENV = 'DEEPWIDGETS_SAFE_MODE'

function log(event: string, detail: Record<string, unknown> = {}): void {
  console.log(`deepwidgets-supervisor ${JSON.stringify({ at: Date.now(), event, ...detail })}`)
}

function messageOf(failure: unknown): string {
  return (failure instanceof Error ? failure.message : String(failure)).slice(0, 300)
}

/**
 * The restart policy for the Host child.
 * It owns a failure only after the first Host was ready, so a Host that cannot boot still fails loudly at once.
 */
export class DesktopHostSupervisor {
  private readonly policy = new HostCrashPolicy()
  private safeMode = false
  private armed = false
  private timer: ReturnType<typeof setTimeout> | undefined
  private disposed = false
  private recoveringNow = false

  /**
   * @param restart - Start a new Host and bring the main window back. A rejection is a failed start;
   * the controller publishes its `error` state, and {@link failed} counts it.
   */
  constructor(private readonly restart: () => Promise<void>) {}

  /**
   * True from an owned failure until the restart has loaded the main window again.
   * In this time a boot failure of the main window is part of the same outage: the restart reloads that window.
   */
  get recovering(): boolean { return this.recoveringNow }

  /** The extra Host environment of the next start. */
  hostEnvironment(): Record<string, string> {
    return this.safeMode ? { [SAFE_MODE_ENV]: '1' } : {}
  }

  /** A Host is ready: from now on the supervisor owns unexpected exits. */
  ready(): void {
    this.armed = true
    log('ready', { safeMode: this.safeMode })
  }

  /**
   * @param failure - the failure of the `error` state.
   * @param closing - the app quits or shuts down.
   * @returns true when a restart is scheduled; false sends the failure to the DSH fatal dialog.
   */
  failed(failure: unknown, closing: boolean): boolean {
    if (this.disposed || closing || !this.armed) return false
    // One failure gives one `error` state. A second one while a restart waits is the same outage.
    if (this.timer !== undefined) return true
    const decision = this.policy.crash()
    if (decision.kind === 'give-up') {
      log('give-up', { crashes: decision.crashes, message: messageOf(failure) })
      this.dispose()
      return false
    }
    this.safeMode = decision.safeMode
    const delay = decision.delayMs
    log('host-failed', { crashes: decision.crashes, delay, safeMode: this.safeMode, message: messageOf(failure) })
    this.recoveringNow = true
    this.timer = setTimeout(() => {
      this.timer = undefined
      if (this.disposed) return
      log('restart', { safeMode: this.safeMode })
      void this.restart().then(() => {
        if (this.timer === undefined) this.recoveringNow = false
        log('restarted', { safeMode: this.safeMode })
      }, (error: unknown) => {
        // A failed start publishes `error` first, and `failed` schedules the next try; then the outage goes on.
        if (this.timer === undefined) this.recoveringNow = false
        log('restart-failed', { message: messageOf(error) })
      })
    }, delay)
    return true
  }

  /** Stop for good: on quit, and after the give-up. A waiting restart does not run, so it cannot hold the quit. */
  dispose(): void {
    this.disposed = true
    this.recoveringNow = false
    clearTimeout(this.timer)
    this.timer = undefined
  }
}
