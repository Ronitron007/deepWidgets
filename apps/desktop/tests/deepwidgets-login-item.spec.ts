/** Launch at login of the Settings tab (main_widget.settings), with a stub of the login item calls of Electron. */
import { describe, expect, it, vi } from 'vitest'
import { DesktopLoginItem, LOGIN_ITEM_MESSAGE, parseLoginItemRequest, type LoginItemApp } from '../src/deepwidgets-login-item.ts'

type Status = 'enabled' | 'requires-approval' | 'not-registered' | 'not-found'

/** A stub of the Electron app: the set call stores the value, and macOS gives `statusAfter` for it. */
function stub(isPackaged: boolean, statusAfter: (open: boolean) => Status) {
  let open = false
  const setLoginItemSettings = vi.fn((settings: { openAtLogin?: boolean }) => { open = settings.openAtLogin === true })
  const getLoginItemSettings = vi.fn(() => {
    const status = statusAfter(open)
    return { openAtLogin: status === 'enabled', status, wasOpenedAtLogin: false, executableWillLaunchAtLogin: false, launchItems: [] }
  })
  const app = { isPackaged, setLoginItemSettings, getLoginItemSettings } as unknown as LoginItemApp
  return { app, setLoginItemSettings, getLoginItemSettings }
}

describe('the login item (main_widget.settings)', () => {
  it('sets the value of the switch, then gives the status that it reads back', () => {
    const electron = stub(true, open => (open ? 'enabled' : 'not-registered'))
    const item = new DesktopLoginItem(electron.app, 'darwin')
    expect(item.answer(null)).toEqual({ ok: true, item: { settable: true, openAtLogin: false, status: 'not-registered' } })
    expect(item.answer(true)).toEqual({ ok: true, item: { settable: true, openAtLogin: true, status: 'enabled' } })
    expect(electron.setLoginItemSettings).toHaveBeenLastCalledWith({ openAtLogin: true, type: 'mainAppService' })
    // The read comes after the set: the status is the only answer of macOS.
    const lastSet = electron.setLoginItemSettings.mock.invocationCallOrder.at(-1)!
    expect(electron.getLoginItemSettings.mock.invocationCallOrder.at(-1)).toBeGreaterThan(lastSet)
    expect(item.answer(false)).toEqual({ ok: true, item: { settable: true, openAtLogin: false, status: 'not-registered' } })
    expect(electron.setLoginItemSettings).toHaveBeenLastCalledWith({ openAtLogin: false, type: 'mainAppService' })
  })

  it('shows the status that macOS gives, also when it is not the value of the switch', () => {
    const electron = stub(true, () => 'not-found')
    expect(new DesktopLoginItem(electron.app, 'darwin').answer(true)).toEqual({ ok: true, item: { settable: true, openAtLogin: false, status: 'not-found' } })
    expect(electron.setLoginItemSettings).toHaveBeenCalledOnce()
  })

  it('shows a login item that waits for approval as on, so that a click removes it (requires_approval_switch_off)', () => {
    // The stub gives openAtLogin false for requires-approval: the switch follows the status, not openAtLogin.
    const electron = stub(true, open => (open ? 'requires-approval' : 'not-registered'))
    const item = new DesktopLoginItem(electron.app, 'darwin')
    expect(item.answer(true)).toEqual({ ok: true, item: { settable: true, openAtLogin: true, status: 'requires-approval' } })
    expect(item.answer(null)).toEqual({ ok: true, item: { settable: true, openAtLogin: true, status: 'requires-approval' } })
    expect(item.answer(false)).toEqual({ ok: true, item: { settable: true, openAtLogin: false, status: 'not-registered' } })
    expect(electron.setLoginItemSettings).toHaveBeenLastCalledWith({ openAtLogin: false, type: 'mainAppService' })
  })

  it('never sets a login item in a dev run, and shows the switch off with the status', () => {
    const electron = stub(false, () => 'not-registered')
    const item = new DesktopLoginItem(electron.app, 'darwin')
    expect(item.answer(true)).toMatchObject({ ok: false, code: 'dev-run' })
    expect(item.answer(false)).toMatchObject({ ok: false, code: 'dev-run' })
    expect(electron.setLoginItemSettings).not.toHaveBeenCalled()
    expect(item.answer(null)).toEqual({ ok: true, item: { settable: false, blocked: 'dev-run', openAtLogin: false, status: 'not-registered' } })
  })

  it('has no login item on a platform that is not macOS', () => {
    const electron = stub(true, () => 'enabled')
    const item = new DesktopLoginItem(electron.app, 'linux')
    expect(item.answer(true)).toMatchObject({ ok: false, code: 'platform' })
    expect(item.answer(null)).toEqual({ ok: true, item: { settable: false, blocked: 'platform', openAtLogin: false } })
    expect(electron.setLoginItemSettings).not.toHaveBeenCalled()
    expect(electron.getLoginItemSettings).not.toHaveBeenCalled()
  })

  it('gives login-item-failed when Electron throws, and no status that macOS did not give', () => {
    const electron = stub(true, () => 'enabled')
    electron.setLoginItemSettings.mockImplementation(() => { throw new Error('boom') })
    const failed = new DesktopLoginItem(electron.app, 'darwin').answer(true)
    expect(failed).toMatchObject({ ok: false, code: 'login-item-failed' })
    expect(failed.ok ? '' : failed.message).toContain('boom')
    const odd = stub(true, () => 'enabled')
    odd.getLoginItemSettings.mockReturnValue({ openAtLogin: false } as never)
    expect(new DesktopLoginItem(odd.app, 'darwin').answer(null)).toEqual({ ok: true, item: { settable: true, openAtLogin: false } })
  })

  it('parses only a request of the login item at the IPC boundary', () => {
    expect(parseLoginItemRequest({ type: LOGIN_ITEM_MESSAGE, callId: 3, open: null })).toEqual({ callId: 3, open: null })
    expect(parseLoginItemRequest({ type: LOGIN_ITEM_MESSAGE, callId: 4, open: true })).toEqual({ callId: 4, open: true })
    expect(parseLoginItemRequest({ type: LOGIN_ITEM_MESSAGE, callId: 1.5, open: true })).toBeUndefined()
    expect(parseLoginItemRequest({ type: LOGIN_ITEM_MESSAGE, callId: 1, open: 'yes' })).toBeUndefined()
    expect(parseLoginItemRequest({ type: 'other', callId: 1, open: true })).toBeUndefined()
  })
})
