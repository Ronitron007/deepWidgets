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
import { HostCrashPolicy } from './deepwidgets-crash-policy.ts'

/** The Host environment key that starts the Host in safe mode. The widget runtime reads it (`SAFE_MODE_ENV` of `@deepwidgets/widgets`). */
export const SAFE_MODE_ENV = 'DEEPWIDGETS_SAFE_MODE'

function log(event: string, detail: Record<string, unknown> = {}): void {
  console.log(`deepwidgets-supervisor ${JSON.stringify({ at: Date.now(), event, ...detail })}`)
}

/** Read `$DSH_HOME/deepwidgets/<name>`, or undefined when it is missing or not JSON. */
function readStateFile(name: string): unknown {
  try {
    return JSON.parse(readFileSync(join(resolveDshHome(), 'deepwidgets', name), 'utf8'))
  } catch {
    // No record, or not readable: the crash counts as unblamed, which is the safe side.
    return undefined
  }
}
const readCrashRecord = (): unknown => readStateFile('crash.json')
/** The provisional record of the watchdog (`widget_phase2.isolation.watchdog`). */
const readProvisionalRecord = (): unknown => readStateFile('provisional.json')

/** The pid of the dead Host child, which `DesktopHostProcess` puts on the failure of an exit. */
function hostPidOf(failure: unknown): number | undefined {
  const pid = (failure as { hostPid?: unknown } | null)?.hostPid
  return typeof pid === 'number' ? pid : undefined
}

/**
 * The widget row that the dead Host blamed in its crash record.
 * The record belongs to this failure only when its pid is the pid of the dead child and no new Host applied it.
 * A Host that dies at boot before it applies an older record thus counts as unblamed.
 * The Host writes the record with a rename before it exits, so the file is whole when the exit reaches main.
 */
function blamedRow(record: unknown, deadPid: number | undefined): string | null {
  if (deadPid === undefined || typeof record !== 'object' || record === null) return null
  const { row, pid, applied } = record as { row?: unknown; pid?: unknown; applied?: unknown }
  if (typeof row !== 'string' || pid !== deadPid || applied === true) return null
  return row
}

/**
 * The widget row that the dead Host blamed. A crash record of the dead Host wins, also when it blames no widget.
 * Else a provisional record of the dead Host blames it: the Host ended in a stall that the watchdog saw, for example
 * by an out-of-memory abort (`widget_phase2.isolation.watchdog`).
 */
function blamedByRecords(crash: unknown, provisional: unknown, deadPid: number | undefined): string | null {
  if (deadPid !== undefined && (crash as { pid?: unknown } | null)?.pid === deadPid) return blamedRow(crash, deadPid)
  return blamedRow(provisional, deadPid)
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
   * @param crashRecord - reads the crash record; tests give their own.
   * @param provisionalRecord - reads the provisional record of the watchdog; tests give their own.
   */
  constructor(
    private readonly restart: () => Promise<void>,
    private readonly crashRecord: () => unknown = readCrashRecord,
    private readonly provisionalRecord: () => unknown = readProvisionalRecord,
  ) {}

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
    // A blamed crash is the quarantine's job: the next Host does not run that widget (`widget_phase2.isolation.blame`).
    const decision = this.policy.crash(blamedByRecords(this.crashRecord(), this.provisionalRecord(), hostPidOf(failure)))
    if (decision.kind === 'give-up') {
      log('give-up', { crashes: decision.crashes, message: messageOf(failure) })
      this.dispose()
      return false
    }
    this.safeMode = decision.safeMode
    const delay = decision.delayMs
    log('host-failed', { crashes: decision.crashes, blamed: decision.blamed, delay, safeMode: this.safeMode, message: messageOf(failure) })
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
