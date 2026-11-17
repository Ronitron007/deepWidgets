/**
 * deepWidgets menu bar: the menu bar icon of the app on macOS and the panel under it, which shows the page of the main
 * widget. The specs are `main_widget.menu_bar` and `main_widget.panel` in `docs/specs/main-widget.md`.
 * The app has no Dock icon because its `Info.plist` sets `LSUIElement`; this module never calls `app.dock.hide()`.
 * `electron-menubar` puts the panel under the icon, shows it on the active Space and over an app in full screen,
 * and hides it when it loses focus.
 * @module deepwidgets-menu-bar
 */
import { Menu, nativeImage, Tray, type App, type BrowserWindow } from 'electron'
import { Menubar } from 'electron-menubar'
import { widgetHost } from './deepwidgets-origin.ts'

/** The page of the main widget on the widget origin of `main`: the second entry of the shared shell. */
export const PANEL_URL = `dsh-app://${widgetHost('main')}/widget/main.html?slug=main`
/** The panel size of `main_widget.provisional`. The operator can not resize it. */
const PANEL_WIDTH = 420
const PANEL_HEIGHT = 600

/** What Electron main gives the menu bar. */
export interface DesktopMenuBarOptions {
  /** `trayTemplate.png`; Electron picks `trayTemplate@2x.png` next to it on a Retina display. */
  readonly iconPath: string
  /** Request quit through the same confirmation as every other quit entry. */
  readonly quit: () => void
}

/** The menu bar icon for the whole run, and the panel with the page of the main widget. */
export class DesktopMenuBar {
  /** The menu bar icon. */
  readonly tray: Tray
  /** The menu of a right click on the icon. */
  readonly contextMenu: Menu
  private readonly menubar: Menubar

  /**
   * Create the icon and the panel. The panel loads its page at once, from disk, so it needs no Host to load
   * (`main_widget.panel`). The page shows the loading state of the core until the Host is ready.
   * @param app - the Electron application.
   * @param options - the icon path and the quit action.
   */
  constructor(app: App, options: DesktopMenuBarOptions) {
    const image = nativeImage.createFromPath(options.iconPath)
    if (image.isEmpty()) throw new Error(`deepwidgets-menu-bar: no icon at ${options.iconPath}`)
    image.setTemplateImage(true)
    this.tray = new Tray(image)
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
    this.menubar.on('before-load', () => {
      const panel = this.menubar.window
      if (panel === undefined) return
      panel.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      panel.webContents.on('will-navigate', (event) => { event.preventDefault() })
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

  /** Remove the panel and the icon; called once the quit is confirmed so no dead icon outlives the process. */
  dispose(): void {
    this.menubar.destroy()
    if (!this.tray.isDestroyed()) this.tray.destroy()
  }
}
