/** The macOS menu bar and its panel (main_widget.menu_bar, main_widget.panel), with fakes of Electron and electron-menubar. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fake = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events')
  class FakeTray extends EventEmitter {
    destroyed = false
    readonly destroy = vi.fn(() => { this.destroyed = true })
    constructor(readonly image: unknown) { super() }
    isDestroyed() { return this.destroyed }
  }
  class FakeWindow extends EventEmitter {
    visible = false
    destroyed = false
    readonly showInactive = vi.fn(() => { this.visible = true })
    readonly focus = vi.fn(() => { fake.focused = this })
    readonly webContents = Object.assign(new EventEmitter(), {
      setWindowOpenHandler: vi.fn<(handler: () => { action: string }) => void>(),
      loadURL: vi.fn(async (_url: string) => {}),
      executeJavaScript: vi.fn(async (_code: string) => true),
    })
    isVisible() { return this.visible }
    isDestroyed() { return this.destroyed }
  }
  const menubars: FakeMenubar[] = []
  class FakeMenubar extends EventEmitter {
    window: FakeWindow | undefined
    readonly showWindow = vi.fn(async () => {})
    readonly destroy = vi.fn()
    constructor(readonly app: unknown, readonly options: Record<string, unknown>) { super(); menubars.push(this) }
  }
  const app = { hide: vi.fn(() => { for (const window of windows) window.visible = false }) }
  const windows: FakeWindow[] = []
  const fake = { FakeTray, FakeWindow, FakeMenubar, menubars, app, windows, focused: undefined as FakeWindow | undefined }
  return fake
})

vi.mock('electron', () => ({
  Tray: fake.FakeTray,
  nativeImage: {
    createFromPath: (path: string) => ({ path, isEmpty: () => path === 'missing.png', setTemplateImage: vi.fn() }),
  },
  Menu: { buildFromTemplate: (template: unknown[]) => ({ items: template }) },
  BrowserWindow: { getAllWindows: () => fake.windows, getFocusedWindow: () => fake.focused ?? null },
}))
vi.mock('electron-menubar', () => ({ Menubar: fake.FakeMenubar }))

const { DesktopMenuBar, PANEL_CRASH_WINDOW_MS, PANEL_FIRST_TAB_EVENT, PANEL_URL, READY_DEADLINE_MS } = await import('../src/deepwidgets-menu-bar.ts')

type Item = { label?: string; type?: string; click?: () => void }

function make() {
  const options = { iconPath: 'trayTemplate.png', quit: vi.fn(), failed: vi.fn<(error: Error) => void>(), attention: vi.fn() }
  const bar = new DesktopMenuBar(fake.app as never, options)
  const menubar = fake.menubars.at(-1)!
  return { bar, menubar, options }
}

/** Give the fake menubar its panel, as menubar does before it loads the page. */
function withPanel(menubar: InstanceType<typeof fake.FakeMenubar>) {
  const panel = new fake.FakeWindow()
  menubar.window = panel
  fake.windows.push(panel)
  menubar.emit('before-load')
  return panel
}

beforeEach(() => {
  vi.useFakeTimers()
  fake.menubars.length = 0
  fake.windows.length = 0
  fake.app.hide.mockClear()
  fake.focused = undefined
})

afterEach(() => {
  vi.useRealTimers()
})

describe('the macOS menu bar (main_widget.menu_bar)', () => {
  it('makes a template icon, the menu of the icon, and a panel of 420 by 600 on the page of main', () => {
    const { bar, menubar, options } = make()
    const image = (bar.tray as unknown as { image: { path: string; setTemplateImage: ReturnType<typeof vi.fn> } }).image
    expect(image.path).toBe('trayTemplate.png')
    expect(image.setTemplateImage).toHaveBeenCalledWith(true)
    expect(PANEL_URL).toBe('dsh-app://w-main.widget/widget/main.html?slug=main')
    expect(menubar.options).toMatchObject({
      tray: bar.tray, icon: image, index: PANEL_URL, preloadWindow: true, showDockIcon: true, activateWithApp: false,
      browserWindow: { width: 420, height: 600, resizable: false },
    })
    const items = (bar.contextMenu as unknown as { items: Item[] }).items.filter(item => item.type !== 'separator')
    expect(items.map(item => item.label)).toEqual(['Open deepWidgets', 'Quit deepWidgets'])
    items[0]!.click!()
    expect(menubar.showWindow).toHaveBeenCalledOnce()
    items[1]!.click!()
    expect(options.quit).toHaveBeenCalledOnce()
  })

  it('refuses an icon that does not load', () => {
    expect(() => new DesktopMenuBar(fake.app as never, { iconPath: 'missing.png', quit: vi.fn(), failed: vi.fn(), attention: vi.fn() }))
      .toThrow('no icon at missing.png')
  })

  it('reports a failure when menubar does not start in time (menubar_ready_failure_silent)', () => {
    const late = make()
    vi.advanceTimersByTime(READY_DEADLINE_MS)
    expect(late.options.failed).toHaveBeenCalledOnce()
    const ready = make()
    ready.menubar.emit('ready')
    vi.advanceTimersByTime(READY_DEADLINE_MS)
    expect(ready.options.failed).not.toHaveBeenCalled()
  })

  it('removes the panel and the icon, and reports no failure after that', () => {
    const { bar, menubar, options } = make()
    bar.dispose()
    expect(menubar.destroy).toHaveBeenCalledOnce()
    expect((bar.tray as unknown as { destroy: ReturnType<typeof vi.fn> }).destroy).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(READY_DEADLINE_MS)
    expect(options.failed).not.toHaveBeenCalled()
  })
})

describe('the panel (main_widget.panel)', () => {
  it('denies new windows and navigation', () => {
    const { menubar } = make()
    const panel = withPanel(menubar)
    expect(panel.webContents.setWindowOpenHandler.mock.calls[0]![0]()).toEqual({ action: 'deny' })
    const event = { preventDefault: vi.fn() }
    panel.webContents.emit('will-navigate', event)
    expect(event.preventDefault).toHaveBeenCalledOnce()
  })

  it('gives the keys back after a click closes it, and shows the floating windows again (panel_close_keeps_focus)', () => {
    const { bar, menubar } = make()
    const panel = withPanel(menubar)
    const widget = new fake.FakeWindow()
    const hidden = new fake.FakeWindow()
    fake.windows.push(widget, hidden)
    widget.visible = true
    panel.visible = true
    bar.tray.emit('click')
    panel.visible = false
    menubar.emit('after-hide')
    expect(fake.app.hide).toHaveBeenCalledOnce()
    expect(widget.showInactive).toHaveBeenCalledOnce()
    expect(widget.isVisible()).toBe(true)
    expect(hidden.showInactive).not.toHaveBeenCalled()
    expect(panel.showInactive).not.toHaveBeenCalled()
    // A hide at a loss of focus leaves the focus where it went.
    menubar.emit('after-hide')
    expect(fake.app.hide).toHaveBeenCalledOnce()
  })

  it('gives the keys back to the widget window that had them when the panel opened (panel_close_takes_widget_focus)', () => {
    const { bar, menubar } = make()
    const panel = withPanel(menubar)
    const widget = new fake.FakeWindow()
    fake.windows.push(widget)
    widget.visible = true
    fake.focused = widget
    menubar.emit('show')
    panel.visible = true
    fake.focused = panel
    bar.tray.emit('click')
    panel.visible = false
    menubar.emit('after-hide')
    expect(widget.focus).toHaveBeenCalledOnce()
    expect(fake.app.hide).not.toHaveBeenCalled()
    // The next close by a click with no window of the app in focus before it gives the keys to the app before it.
    fake.focused = undefined
    menubar.emit('show')
    panel.visible = true
    bar.tray.emit('click')
    panel.visible = false
    menubar.emit('after-hide')
    expect(widget.focus).toHaveBeenCalledOnce()
    expect(fake.app.hide).toHaveBeenCalledOnce()
  })

  it('gives the keys to the app before it when the widget window that had them is hidden now', () => {
    const { bar, menubar } = make()
    const panel = withPanel(menubar)
    const widget = new fake.FakeWindow()
    fake.windows.push(widget)
    widget.visible = true
    fake.focused = widget
    menubar.emit('show')
    panel.visible = true
    // The operator hides the widget window in the panel (main_widget.window_state).
    widget.visible = false
    bar.tray.emit('click')
    panel.visible = false
    menubar.emit('after-hide')
    expect(widget.focus).not.toHaveBeenCalled()
    expect(fake.app.hide).toHaveBeenCalledOnce()
    expect(widget.showInactive).not.toHaveBeenCalled()
  })

  it('does not take the keys when a click opens it', () => {
    const { bar, menubar } = make()
    withPanel(menubar)
    bar.tray.emit('click')
    menubar.emit('after-show')
    menubar.emit('after-hide')
    expect(fake.app.hide).not.toHaveBeenCalled()
  })

  it('shows its first tab when a second launch opens it, and keeps the tab at another open (second_launch_keeps_tab)', () => {
    const { bar, menubar } = make()
    const panel = withPanel(menubar)
    bar.open()
    expect(panel.webContents.executeJavaScript).not.toHaveBeenCalled()
    bar.open({ firstTab: true })
    expect(PANEL_FIRST_TAB_EVENT).toBe('deepwidgets-panel-first-tab')
    expect(panel.webContents.executeJavaScript).toHaveBeenCalledOnce()
    expect(panel.webContents.executeJavaScript.mock.calls[0]![0]).toContain(`new Event(${JSON.stringify(PANEL_FIRST_TAB_EVENT)})`)
    expect(menubar.showWindow).toHaveBeenCalledTimes(2)
  })

  it('tells Electron main that the operator looks at the app (session_end_never_resets_on_macos)', () => {
    const { menubar, options } = make()
    const panel = withPanel(menubar)
    menubar.emit('after-show')
    panel.emit('focus')
    expect(options.attention).toHaveBeenCalledTimes(2)
  })

  it('loads its page again after its renderer ends, and fails at a second end in the time window (panel_no_crash_recovery)', () => {
    const { menubar, options } = make()
    const panel = withPanel(menubar)
    menubar.emit('ready')
    panel.webContents.emit('render-process-gone', {}, { reason: 'clean-exit' })
    expect(panel.webContents.loadURL).not.toHaveBeenCalled()
    panel.webContents.emit('render-process-gone', {}, { reason: 'crashed' })
    expect(panel.webContents.loadURL).toHaveBeenCalledWith(PANEL_URL)
    expect(options.failed).not.toHaveBeenCalled()
    vi.advanceTimersByTime(PANEL_CRASH_WINDOW_MS + 1)
    panel.webContents.emit('render-process-gone', {}, { reason: 'crashed' })
    expect(panel.webContents.loadURL).toHaveBeenCalledTimes(2)
    expect(options.failed).not.toHaveBeenCalled()
    panel.webContents.emit('render-process-gone', {}, { reason: 'oom' })
    expect(options.failed).toHaveBeenCalledOnce()
  })
})
