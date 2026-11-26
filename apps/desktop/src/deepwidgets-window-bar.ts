/**
 * deepWidgets window bar: the bar at the top of each widget window (`window_manager.bar` and `window_manager.move` in
 * `docs/specs/window-manager.md`). The bar is a WebContentsView over the page, with its own renderer, its own preload,
 * and its own IPC channel to Electron main. The page of an agent can not hide, change, or click it.
 * Electron main shows the bar while the mouse is over the window. It reads the mouse with
 * `screen.getCursorScreenPoint()`, never from a page. A drag on the handle moves the window from Electron main: the bar
 * sends only the start and the end of the drag, and Electron main follows the mouse while the drag lasts.
 * @module deepwidgets-window-bar
 */
import { fileURLToPath } from 'node:url'
import { ipcMain, screen, WebContentsView, type BrowserWindow, type IpcMainEvent } from 'electron'
import { parseBarCommand, WIDGET_BAR_IPC, type WidgetBarState } from './deepwidgets-window-bar-protocol.ts'
import type { ScreenPoint, ScreenRect } from './deepwidgets-window-place.ts'

/** The height of the bar in points (`window_manager.provisional`). */
export const WIDGET_BAR_HEIGHT = 24
/** The hover check reads the mouse 10 times each second while a widget window shows (`window_manager.provisional`). */
export const HOVER_POLL_MS = 100
/** A drag follows the mouse about 60 times each second. */
export const DRAG_POLL_MS = 16

/** The bar preload, next to the main bundle. */
const BAR_PRELOAD = fileURLToPath(new URL('./preload-widget-bar.cjs', import.meta.url))

const GRIP = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">'
  + [3, 8, 13].flatMap(x => [6, 10].map(y => `<circle cx="${String(x)}" cy="${String(y)}" r="1.3"/>`)).join('') + '</svg>'
const LAYER_TOP = '<svg class="top" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="1.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="5.5" y="1.5" width="9" height="9" rx="1.5"/></svg>'
const LAYER_NORMAL = '<svg class="normal" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><rect x="5.5" y="1.5" width="9" height="9" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="1.5" y="5.5" width="8" height="8" rx="1.5"/></svg>'
const LOCK_CLOSED = '<svg class="closed" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="7" width="10" height="7.5" rx="1.5"/></svg>'
const LOCK_OPEN = '<svg class="open" viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M5 7V5a3 3 0 0 1 5.9-.8" fill="none" stroke="currentColor" stroke-width="1.5"/><rect x="3" y="7" width="10" height="7.5" rx="1.5"/></svg>'

/**
 * The page of the bar: static markup with no script. Its CSP allows no script, so only the isolated world of the bar
 * preload acts on it. The preload sets `data-layer` and `data-locked` on the bar, and the sheet shows the icons.
 */
const BAR_PAGE = `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>
html,body{margin:0;height:${String(WIDGET_BAR_HEIGHT)}px;overflow:hidden;background:transparent;user-select:none;-webkit-user-select:none}
[data-deepwidgets-bar]{display:flex;height:100%;background:rgba(24,24,27,.88);color:#e4e4e7;fill:currentColor}
[data-bar=handle]{flex:1;display:flex;align-items:center;justify-content:center;cursor:grab}
[data-bar=handle]:active{cursor:grabbing}
[data-locked=true] [data-bar=handle]{cursor:default;opacity:.3}
button{all:unset;width:28px;display:flex;align-items:center;justify-content:center}
button:hover{background:rgba(255,255,255,.14)}
[data-layer=top] .normal,[data-layer=normal] .top,[data-locked=true] .open,[data-locked=false] .closed{display:none}
</style></head><body><div data-deepwidgets-bar data-layer="top" data-locked="false">
<div data-bar="handle" title="Drag to move">${GRIP}</div>
<button type="button" data-bar="layer" title="Layer">${LAYER_TOP}${LAYER_NORMAL}</button>
<button type="button" data-bar="lock" title="Lock">${LOCK_CLOSED}${LOCK_OPEN}</button>
</div></body></html>`
/** The URL of the bar page. */
export const WIDGET_BAR_URL = `data:text/html;charset=utf-8,${encodeURIComponent(BAR_PAGE)}`

/** What the bar asks of the owner of the window data. */
export interface WidgetBarOwner {
  /** The operator clicked the layer button or the lock button on the bar of `slug`. */
  toggle(slug: string, control: 'layer' | 'lock'): void
  /** False while the window of `slug` is locked: a drag on its handle does not move it. */
  movable(slug: string): boolean
  /** A drag of the operator puts the window of `slug` at `point`. `done` is true at the end of the drag. */
  drag(slug: string, point: ScreenPoint, done: boolean): void
}

/** The bar of one widget window. */
export interface WidgetBar {
  /** The view over the page. */
  readonly view: WebContentsView
  /** Show the layer and the lock of the window. */
  setState(state: WidgetBarState): void
}

/** One drag on a handle. */
interface BarDrag {
  /** The mouse point minus the window position at the start. */
  readonly grab: ScreenPoint
  readonly timer: ReturnType<typeof setInterval>
}

/** One bar and its window. */
interface BarEntry {
  readonly slug: string
  readonly window: BrowserWindow
  readonly view: WebContentsView
  state: WidgetBarState
  drag: BarDrag | undefined
}

/**
 * True when the point is in the rectangle.
 * @param rect - the bounds of a window.
 * @param point - a screen point.
 */
function contains(rect: ScreenRect, point: ScreenPoint): boolean {
  return point.x >= rect.x && point.x < rect.x + rect.width && point.y >= rect.y && point.y < rect.y + rect.height
}

/** The bars of all widget windows, the hover check, and the drags. */
export class WidgetWindowBars {
  /**
   * Where the mouse is, in screen points. The smoke check `DSH_SMOKE_WM` replaces this function (the hover hook) to put
   * the mouse point in a window without a move of the real mouse.
   */
  cursorPoint: () => ScreenPoint = () => screen.getCursorScreenPoint()
  /** The bars by the id of their webContents: the only senders that the IPC channel accepts. */
  private readonly bars = new Map<number, BarEntry>()
  private hover: ReturnType<typeof setInterval> | undefined
  private listening = false

  /**
   * @param owner - the owner of the window data.
   * @param preload - the bar preload.
   */
  constructor(private readonly owner: WidgetBarOwner, private readonly preload: string = BAR_PRELOAD) {}

  /**
   * Add the bar to one widget window. The bar starts hidden, and it ends with its window.
   * @param slug - the slug of the window.
   * @param window - the widget window.
   * @param state - the layer and the lock of the window.
   */
  attach(slug: string, window: BrowserWindow, state: WidgetBarState): WidgetBar {
    this.listen()
    const view = new WebContentsView({ webPreferences: {
      preload: this.preload, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true,
    } })
    const contents = view.webContents
    const entry: BarEntry = { slug, window, view, state, drag: undefined }
    this.bars.set(contents.id, entry)
    view.setBackgroundColor('#00000000')
    view.setVisible(false)
    window.contentView.addChildView(view)
    const fit = (): void => {
      if (window.isDestroyed()) return
      view.setBounds({ x: 0, y: 0, width: window.getContentBounds().width, height: WIDGET_BAR_HEIGHT })
    }
    fit()
    window.on('resize', fit)
    window.once('closed', () => {
      this.endDrag(entry, false)
      this.bars.delete(contents.id)
      if (!contents.isDestroyed()) contents.close({ waitForBeforeUnload: false })
    })
    contents.setWindowOpenHandler(() => ({ action: 'deny' }))
    contents.on('will-navigate', (event) => { event.preventDefault() })
    contents.on('did-finish-load', () => { this.send(entry) })
    contents.on('render-process-gone', (_event, details) => {
      this.endDrag(entry, true)
      console.warn(`deepwidgets-window-bar: the renderer of the bar of ${slug} ended (${details.reason}); the bar loads again`)
      if (!window.isDestroyed()) void contents.loadURL(WIDGET_BAR_URL).catch(() => undefined)
    })
    void contents.loadURL(WIDGET_BAR_URL).catch((error: unknown) => {
      console.warn(`deepwidgets-window-bar: the bar of ${slug} did not load`, error)
    })
    return {
      view,
      setState: (next) => {
        entry.state = next
        this.send(entry)
      },
    }
  }

  /** Start the hover check. A widget window calls this when it shows. The check stops when no widget window shows. */
  watch(): void {
    this.hover ??= setInterval(() => { this.tick() }, HOVER_POLL_MS)
  }

  /** Stop the hover check and each drag, on app quit. */
  stop(): void {
    clearInterval(this.hover)
    this.hover = undefined
    for (const entry of this.bars.values()) this.endDrag(entry, false)
  }

  private listen(): void {
    if (this.listening) return
    this.listening = true
    ipcMain.on(WIDGET_BAR_IPC.command, this.receive)
  }

  /** Accept a message only from the main frame of a bar view. A widget page has no preload, so it can not send. */
  private readonly receive = (event: IpcMainEvent, value: unknown): void => {
    const entry = this.bars.get(event.sender.id)
    if (entry === undefined || event.senderFrame !== event.sender.mainFrame) {
      console.warn('deepwidgets-window-bar: dropped a bar message from a sender that is not a bar')
      return
    }
    const command = parseBarCommand(value)
    if (command === undefined) {
      console.warn(`deepwidgets-window-bar: dropped an unknown bar message of ${entry.slug}`)
      return
    }
    if (command === 'layer' || command === 'lock') this.owner.toggle(entry.slug, command)
    else if (command === 'drag-start') this.startDrag(entry)
    else this.endDrag(entry, true)
  }

  private send(entry: BarEntry): void {
    const contents = entry.view.webContents
    if (!contents.isDestroyed()) contents.send(WIDGET_BAR_IPC.state, entry.state)
  }

  /** Show the bar of each shown window that has the mouse over it, and of each window in a drag. */
  private tick(): void {
    const point = this.cursorPoint()
    let shown = false
    for (const entry of this.bars.values()) {
      const { window, view } = entry
      if (window.isDestroyed()) continue
      const visible = window.isVisible()
      shown ||= visible
      const over = entry.drag !== undefined || (visible && contains(window.getBounds(), point))
      if (view.getVisible() !== over) view.setVisible(over)
    }
    if (!shown) {
      clearInterval(this.hover)
      this.hover = undefined
    }
  }

  /** Start a drag on the handle, unless the window is locked. */
  private startDrag(entry: BarEntry): void {
    if (entry.drag !== undefined || entry.window.isDestroyed() || !this.owner.movable(entry.slug)) return
    const cursor = this.cursorPoint()
    const [x = 0, y = 0] = entry.window.getPosition()
    entry.drag = { grab: { x: cursor.x - x, y: cursor.y - y }, timer: setInterval(() => { this.follow(entry, false) }, DRAG_POLL_MS) }
  }

  /** Move the window to the mouse point minus the grab offset. */
  private follow(entry: BarEntry, done: boolean): void {
    const drag = entry.drag
    if (drag === undefined || entry.window.isDestroyed()) return
    const cursor = this.cursorPoint()
    this.owner.drag(entry.slug, { x: Math.round(cursor.x - drag.grab.x), y: Math.round(cursor.y - drag.grab.y) }, done)
  }

  /**
   * End the drag of one bar.
   * @param move - true: one last move to the mouse point, as at a release of the mouse button.
   */
  private endDrag(entry: BarEntry, move: boolean): void {
    const drag = entry.drag
    if (drag === undefined) return
    clearInterval(drag.timer)
    if (move) this.follow(entry, true)
    entry.drag = undefined
  }
}
