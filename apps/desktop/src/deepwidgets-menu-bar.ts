/**
 * deepWidgets menu bar: the menu bar icon of the app on macOS and the panel under it, which shows the page of the main
 * widget. The specs are `main_widget.menu_bar` and `main_widget.panel` in `docs/specs/main-widget.md`.
 * The app has no Dock icon because its `Info.plist` sets `LSUIElement`; this module never calls `app.dock.hide()`.
 * `electron-menubar` puts the panel under the icon, shows it on the active Space and over an app in full screen,
 * and hides it when it loses focus.
 * @module deepwidgets-menu-bar
 */
import { BrowserWindow, Menu, nativeImage, Tray, type App } from 'electron'
import { Menubar } from 'electron-menubar'
import { widgetHost } from './deepwidgets-origin.ts'

/** The page of the main widget on the widget origin of `main`: the second entry of the shared shell. */
export const PANEL_URL = `dsh-app://${widgetHost('main')}/widget/main.html?slug=main`
/** The panel size of `main_widget.provisional`. The operator can not resize it. */
const PANEL_WIDTH = 420
const PANEL_HEIGHT = 600
/**
 * menubar makes the panel and binds the click and the menu of the icon after it starts. A failure there only goes to
 * console.error in menubar. With no `ready` event in this time, the menu bar counts as failed.
 */
export const READY_DEADLINE_MS = 30_000
/** A second end of the renderer of the panel in this time counts as a failure of the menu bar. */
export const PANEL_CRASH_WINDOW_MS = 60_000

/** What Electron main gives the menu bar. */
export interface DesktopMenuBarOptions {
  /** `trayTemplate.png`; Electron picks `trayTemplate@2x.png` next to it on a Retina display. */
  readonly iconPath: string
  /** Request quit through the same confirmation as every other quit entry. */
  readonly quit: () => void
  /** The menu bar can not work: Electron main shows the fatal dialog, the way out of an app with no Dock icon. */
  readonly failed: (error: Error) => void
  /** The operator looks at the app: the panel shows or takes the focus. */
  readonly attention: () => void
}

/** The menu bar icon for the whole run, and the panel with the page of the main widget. */
export class DesktopMenuBar {
  /** The menu bar icon. */
  readonly tray: Tray
  /** The menu of a right click on the icon. */
  readonly contextMenu: Menu
  private readonly menubar: Menubar
  private readonly readyDeadline: ReturnType<typeof setTimeout>
  /** True from a click on the icon while the panel shows, until the panel hides: the operator closed the panel. */
  private closingByClick = false
  /** The times of the recent ends of the renderer of the panel. */
  private crashes: number[] = []

  /**
   * Create the icon and the panel. The panel loads its page at once, from disk, so it needs no Host to load
   * (`main_widget.panel`). The page shows the loading state of the core until the Host is ready.
   * @param app - the Electron application.
   * @param options - the icon path, the quit action, the failure report, and the attention of the operator.
   */
  constructor(app: App, options: DesktopMenuBarOptions) {
    const image = nativeImage.createFromPath(options.iconPath)
    if (image.isEmpty()) throw new Error(`deepwidgets-menu-bar: no icon at ${options.iconPath}`)
    image.setTemplateImage(true)
    this.tray = new Tray(image)
    // This listener runs before the click listener of menubar, which menubar adds once it starts.
    this.tray.on('click', () => { this.closingByClick = this.panel?.isVisible() === true })
    this.contextMenu = Menu.buildFromTemplate([
      { label: 'Open deepWidgets', click: () => { this.open() } },
      { type: 'separator' },
      { label: 'Quit deepWidgets', click: () => { options.quit() } },
    ])
    this.menubar = new Menubar(app, {
      tray: this.tray,
      // menubar takes our Tray, but the ESM build of 11.1.1 still reads __dirname for a default icon when `icon` is
      // not an existing file, and __dirname does not exist in ESM. The image skips that read.
      icon: image,
      index: PANEL_URL,
      tooltip: 'deepWidgets',
      // A right click opens the menu; a left click toggles the panel.
      contextMenu: this.contextMenu,
      preloadWindow: true,
      // true only stops menubar from calling app.dock.hide(): LSUIElement already keeps the Dock icon away.
      showDockIcon: true,
      // Electron main routes a relaunch to open(), also while a widget window is visible.
      activateWithApp: false,
      browserWindow: {
        width: PANEL_WIDTH,
        height: PANEL_HEIGHT,
        resizable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        skipTaskbar: true,
        hiddenInMissionControl: true,
        title: 'deepWidgets',
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
      },
    })
    this.readyDeadline = setTimeout(() => {
      options.failed(new Error(`deepwidgets-menu-bar: the menu bar did not start in ${String(READY_DEADLINE_MS / 1000)} s; the icon has no click and no menu`))
    }, READY_DEADLINE_MS)
    this.menubar.once('ready', () => { clearTimeout(this.readyDeadline) })
    this.menubar.on('after-show', () => { options.attention() })
    this.menubar.on('after-hide', () => {
      if (this.closingByClick) this.giveFocusBack(app)
      this.closingByClick = false
    })
    this.menubar.on('before-load', () => {
      const panel = this.menubar.window
      if (panel === undefined) return
      panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      panel.webContents.on('will-navigate', (event) => { event.preventDefault() })
      panel.on('focus', () => { options.attention() })
      // The panel is the only window of the app: an ended renderer loads the page again, as a widget window does
      // (agent_library.serving.failures). A second end in PANEL_CRASH_WINDOW_MS is a failure of the menu bar.
      panel.webContents.on('render-process-gone', (_event, details) => {
        if (details.reason === 'clean-exit' || panel.isDestroyed()) return
        const now = Date.now()
        this.crashes = [...this.crashes.filter(at => now - at < PANEL_CRASH_WINDOW_MS), now]
        if (this.crashes.length >= 2) {
          options.failed(new Error(`deepwidgets-menu-bar: the renderer of the panel ended two times in ${String(PANEL_CRASH_WINDOW_MS / 1000)} s (${details.reason})`))
          return
        }
        console.warn(`deepwidgets-menu-bar: the renderer of the panel ended (${details.reason}); the panel loads its page again`)
        void panel.webContents.loadURL(PANEL_URL).catch((error: unknown) => { console.warn('deepwidgets-menu-bar: the panel did not load its page again', error) })
      })
    })
  }

  /** The panel window, after menubar created it. */
  get panel(): BrowserWindow | undefined {
    return this.menubar.window
  }

  /**
   * Show the panel under the icon with key focus. A second launch, a `dsh://open` link, and the menu item call this.
   * `show()` of menubar activates the app, so the panel takes keyboard focus.
   */
  open(): void {
    void this.menubar.showWindow().catch((error: unknown) => { console.warn('deepwidgets-menu-bar: the panel did not open', error) })
  }

  /**
   * Give the keys back to the app that had them, after a click on the icon closed the panel. The panel activated this
   * app, and with no window left the keys of the operator would go nowhere. app.hide() makes macOS activate the app
   * before it, but it also hides each window of this app, so each floating window that showed shows again at once with
   * no focus. A spike on Electron 44.7.0 kept the app before it in front. A hide at a loss of focus does not call this:
   * the focus is already in another window or app.
   */
  private giveFocusBack(app: App): void {
    const panel = this.panel
    const shown = BrowserWindow.getAllWindows().filter(window => window !== panel && window.isVisible())
    app.hide()
    for (const window of shown) window.showInactive()
  }

  /** Remove the panel and the icon; called once the quit is confirmed so no dead icon outlives the process. */
  dispose(): void {
    clearTimeout(this.readyDeadline)
    this.menubar.destroy()
    if (!this.tray.isDestroyed()) this.tray.destroy()
  }
}
