/**
 * deepWidgets: launch at login, for the Settings tab of the main widget (`main_widget.settings` in
 * `docs/specs/main-widget.md`). The page talks only to the host, so the host asks Electron main over IPC with the
 * message `deepwidgets-login-item`. Electron main calls `app.setLoginItemSettings`, which uses `SMAppService` on
 * macOS, and then reads the status back with `app.getLoginItemSettings`. The set call gives no error, so the status is
 * the only answer. A dev run (not packaged) never sets a login item: its switch is off and disabled.
 * @module deepwidgets-login-item
 */
import type { App } from 'electron'

/** The IPC message of the login item, from the host and back, with the same `callId`. Same name as `@deepwidgets/widget-main`. */
export const LOGIN_ITEM_MESSAGE = 'deepwidgets-login-item'

/** The status of the login item that macOS gives. */
export type LoginItemStatus = 'enabled' | 'requires-approval' | 'not-registered' | 'not-found'
const STATUSES: readonly string[] = ['enabled', 'requires-approval', 'not-registered', 'not-found'] satisfies LoginItemStatus[]

/** The launch-at-login switch as Electron main reads it back. Same shape as `LoginItemSetting` of `@deepwidgets/widget-main`. */
export interface LoginItemSetting {
  /** False in a dev run and on a platform with no login item: the switch is then off and disabled. */
  readonly settable: boolean
  /** Why the switch is disabled. */
  readonly blocked?: 'dev-run' | 'platform'
  /**
   * The switch: true when macOS has the app as a login item, also while the registration waits for approval
   * (`requires-approval`), so that a click unregisters it. Without a status, it is `openAtLogin` of Electron.
   */
  readonly openAtLogin: boolean
  /** The status from macOS. Absent when macOS gives none. */
  readonly status?: LoginItemStatus
}

/**
 * The answer to the host. A refusal sets nothing: `dev-run` and `platform` before the set call, `login-item-failed`
 * when Electron throws, and then the login item is unknown.
 */
export type LoginItemAnswer =
  | { readonly ok: true; readonly item: LoginItemSetting }
  | { readonly ok: false; readonly code: 'dev-run' | 'platform' | 'login-item-failed'; readonly message: string }

/** The request of the host: `open` null reads the login item, and a boolean sets it first. */
export interface LoginItemRequest {
  readonly callId: number
  readonly open: boolean | null
}

/** The request of the host, parsed at the IPC boundary, or undefined for another message. */
export function parseLoginItemRequest(message: unknown): LoginItemRequest | undefined {
  if (typeof message !== 'object' || message === null) return undefined
  const { type, callId, open } = message as Record<string, unknown>
  if (type !== LOGIN_ITEM_MESSAGE || typeof callId !== 'number' || !Number.isSafeInteger(callId)) return undefined
  if (open !== null && typeof open !== 'boolean') return undefined
  return { callId, open }
}

/** The calls of Electron that the login item uses; a test passes a stub. */
export type LoginItemApp = Pick<App, 'isPackaged' | 'getLoginItemSettings' | 'setLoginItemSettings'>

/** The login item of the app, on macOS with `SMAppService` (the type `mainAppService`). */
export class DesktopLoginItem {
  /**
   * @param app - the Electron application, or a stub of its login item calls.
   * @param platform - `process.platform`. Only macOS has the switch.
   */
  constructor(private readonly app: LoginItemApp, private readonly platform: NodeJS.Platform) {}

  /**
   * Read the login item, or set it to `open` and read it back. A dev run and a platform that is not macOS refuse the set
   * and never call `setLoginItemSettings`.
   * @param open - null to read, or the value of the switch.
   * @returns the login item as macOS gives it after the call, or a refusal.
   */
  answer(open: boolean | null): LoginItemAnswer {
    const blocked = this.blocked()
    if (open !== null && blocked === 'dev-run') return { ok: false, code: 'dev-run', message: 'launch at login needs a packaged app; a dev run registers no login item' }
    if (open !== null && blocked === 'platform') return { ok: false, code: 'platform', message: `launch at login works only on macOS, not on ${this.platform}` }
    try {
      if (open !== null) this.app.setLoginItemSettings({ openAtLogin: open, type: 'mainAppService' })
      return { ok: true, item: this.read(blocked) }
    } catch (error) {
      const done = open === null ? 'Electron main could not read the login item' : `Electron main could not set the login item to ${open ? 'on' : 'off'}, so it is unknown`
      return { ok: false, code: 'login-item-failed', message: `${done}: ${error instanceof Error ? error.message : String(error)}` }
    }
  }

  private blocked(): 'dev-run' | 'platform' | undefined {
    if (this.platform !== 'darwin') return 'platform'
    return this.app.isPackaged ? undefined : 'dev-run'
  }

  /** The login item as macOS gives it. A dev run reads the status too, so the tab shows that no login item is there. */
  private read(blocked: 'dev-run' | 'platform' | undefined): LoginItemSetting {
    if (blocked === 'platform') return { settable: false, blocked, openAtLogin: false }
    const settings = this.app.getLoginItemSettings({ type: 'mainAppService' })
    const known = STATUSES.includes(settings.status)
    const status = known ? { status: settings.status } : {}
    if (blocked === 'dev-run') return { settable: false, blocked, openAtLogin: false, ...status }
    // requires_approval_switch_off: the switch follows the registration that macOS gives, not only openAtLogin.
    const registered = known ? settings.status === 'enabled' || settings.status === 'requires-approval' : settings.openAtLogin
    return { settable: true, openAtLogin: registered, ...status }
  }
}
