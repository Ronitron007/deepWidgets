/**
 * deepWidgets supervisor: restart a Host that exits unexpectedly, with backoff, safe mode, and a give-up.
 * The spec is `widget_phase2.isolation.supervisor` in `docs/specs/widget-phase2.md`.
 * A crash that the Host blamed on one widget does not count toward safe mode or the give-up (`widget_phase2.isolation.blame`).
 * Each event logs one line `deepwidgets-supervisor {json}`.
 * @module deepwidgets-supervisor
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** Wait before restart number 1, 2, and 3 in the window. */
const BACKOFF_MS = [500, 2_000, 8_000] as const
/** The window in which crashes count. */
const WINDOW_MS = 60_000
/** Crashes in the window from which the next start is in safe mode. */
const SAFE_MODE_AFTER = 2
/** Crashes in the window at which the supervisor gives up and the DSH fatal dialog shows. */
const GIVE_UP_AFTER = 4

/** The Host environment key that starts the Host in safe mode. Widget rows read it in a `!!js` condition. */
export const SAFE_MODE_ENV = 'DEEPWIDGETS_SAFE_MODE'

function log(event: string, detail: Record<string, unknown> = {}): void {
  console.log(`deepwidgets-supervisor ${JSON.stringify({ at: Date.now(), event, ...detail })}`)
}

/**
 * The widget plugin that the dead Host blamed, from the crash record `$DSH_HOME/deepwidgets/crash.json`.
 * Only a record written after the Host was ready, and not yet applied by a new Host, belongs to this failure.
 * The Host writes it with a rename before it exits, so the file is whole when the exit reaches main.
 * @param since - the time the dead Host was ready.
 */
function blamedPlugin(since: number): string | undefined {
  let record: unknown
  try {
    record = JSON.parse(readFileSync(join(resolveDshHome(), 'deepwidgets', 'crash.json'), 'utf8'))
  } catch {
    // No record, or not readable: the crash counts as unblamed, which is the safe side.
    return undefined
  }
  if (typeof record !== 'object' || record === null) return undefined
  const { plugin, at, applied } = record as { plugin?: unknown; at?: unknown; applied?: unknown }
  if (typeof plugin !== 'string' || typeof at !== 'number' || at < since || applied === true) return undefined
  return plugin
}

function messageOf(failure: unknown): string {
  return (failure instanceof Error ? failure.message : String(failure)).slice(0, 300)
}

/**
 * The restart policy for the Host child.
 * It owns a failure only after the first Host was ready, so a Host that cannot boot still fails loudly at once.
 */
export class DesktopHostSupervisor {
  private crashes: number[] = []
  private safeMode = false
  private armed = false
  private readyAt = 0
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
    this.readyAt = Date.now()
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
    const now = Date.now()
    this.crashes = this.crashes.filter(at => now - at < WINDOW_MS)
    // A blamed crash is the quarantine's job: the next Host does not run that widget. It counts toward neither
    // safe mode nor the give-up, and it restarts after the first backoff step.
    const blamed = blamedPlugin(this.readyAt)
    if (blamed === undefined) this.crashes.push(now)
    const crashes = this.crashes.length
    if (crashes >= GIVE_UP_AFTER) {
      log('give-up', { crashes, message: messageOf(failure) })
      this.dispose()
      return false
    }
    this.safeMode = crashes >= SAFE_MODE_AFTER
    const delay = BACKOFF_MS[Math.max(0, Math.min(crashes, BACKOFF_MS.length) - 1)]
    log('host-failed', { crashes, blamed: blamed ?? null, delay, safeMode: this.safeMode, message: messageOf(failure) })
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
