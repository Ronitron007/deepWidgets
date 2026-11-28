/**
 * deepWidgets windows: one floating panel window for each widget of the Host.
 * The spec is `widget_mvp.windows` in `docs/specs/widget-mvp.md`. Each window loads its page from the widget origin
 * of its slug (`agent_library.serving` in `docs/specs/agent-library.md`): the built page of the slug when the Host
 * lists a page link for it, else the shared shell. This module also answers the requests of a widget origin.
 * The Host keeps the window data of each slug (`main_widget.window_state`, `window_manager.data`): each frame of the
 * events stream carries the shown state, the layer, the lock, the position, and the size, and this module makes the
 * window match it. Each window has the bar of `window_manager.bar` (`deepwidgets-window-bar.ts`). The bar changes the
 * layer, the lock, and the position of the window (`window_manager.move`). This module sends each such operator choice to
 * the Host route `POST /api/widget-windows/<slug>` with the Host cookie. A choice that the Host does not have yet waits
 * here, and it wins over the frames until the Host has it: a change made while the Host is down goes to the next Host.
 * @module deepwidgets-windows
 */
import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { EventSourceParserStream } from 'eventsource-parser/stream'
import { isWidgetSlug, widgetRoute, widgetUrl, type WidgetPageMode, type WidgetPages } from './deepwidgets-origin.ts'
import { servePageFile } from './deepwidgets-page-path.ts'
import { WidgetWindowBars, type WidgetBar } from './deepwidgets-window-bar.ts'
import type { WidgetLayer } from './deepwidgets-window-bar-protocol.ts'
import {
  choiceBody, newWindowData, parseWindowData, placeWindow, settleChoice, withPending, WIDGET_SIZE_MAX, WIDGET_SIZE_MIN,
  type HostWindowData, type PendingChoice, type ScreenPoint, type WidgetWindowData,
} from './deepwidgets-window-place.ts'

/** One slug of a frame and its window data. */
interface WidgetFrameItem {
  readonly slug: string
  readonly data: HostWindowData
}

/** One frame of `GET /api/widgets/events` (`widget_mvp.runtime.routes`, `main_widget.window_state`, `window_manager.data`). */
type WidgetEvent =
  | { readonly type: 'hello'; readonly slugs: readonly WidgetFrameItem[] }
  | ({ readonly type: 'added' | 'window' } & WidgetFrameItem)
  | { readonly type: 'removed'; readonly slug: string }

/** The ready Host that serves the events. */
interface WidgetHostTarget {
  readonly url: string
  readonly cookie: string
}

const RETRY_FIRST_MS = 500
const RETRY_MAX_MS = 10_000
/** A second failure of an agent page in this time puts its window on the shared shell (`agent_library.serving.failures`). */
const PAGE_FAILURE_WINDOW_MS = 60_000
/** The wait before a failed load of an agent page counts, so the gone event of the same load counts first. */
const LOAD_FAILURE_SETTLE_MS = 250
/** A move by the operator with a drag area of the page sends its end position after this time with no further move. */
const NATIVE_MOVE_SETTLE_MS = 300
/** The wait before a send of an operator choice that did not reach the Host goes again, while the same Host is ready. */
const CHOICE_RETRY_MS = 1_000
/** The time limit of one send of an operator choice. */
const CHOICE_TIMEOUT_MS = 10_000

/**
 * Check one slug against the Host pattern. An invalid slug writes one warning.
 * @param slug - slug from a frame.
 */
function validSlug(slug: unknown): slug is string {
  if (isWidgetSlug(slug)) return true
  console.warn('deepwidgets-windows: dropped an invalid slug', JSON.stringify(slug))
  return false
}

/**
 * Parse one frame at the boundary. An unknown frame gives `undefined`. Invalid slugs are dropped.
 * @param data - the `data` field of one server-sent event.
 */
function parseWidgetEvent(data: string): WidgetEvent | undefined {
  let value: unknown
  try { value = JSON.parse(data) } catch { return undefined }
  if (typeof value !== 'object' || value === null) return undefined
  const frame = value as { type?: unknown; slug?: unknown; slugs?: unknown; shown?: unknown; window?: unknown; windows?: unknown }
  if (frame.type === 'hello' && Array.isArray(frame.slugs)) {
    const shown = typeof frame.shown === 'object' && frame.shown !== null ? frame.shown as Record<string, unknown> : {}
    const windows = typeof frame.windows === 'object' && frame.windows !== null ? frame.windows as Record<string, unknown> : {}
    return { type: 'hello', slugs: frame.slugs.filter(validSlug).map(slug => ({ slug, data: parseWindowData(windows[slug], shown[slug]) })) }
  }
  if ((frame.type === 'added' || frame.type === 'window') && validSlug(frame.slug)) {
    return { type: frame.type, slug: frame.slug, data: parseWindowData(frame.window, frame.shown) }
  }
  if (frame.type === 'removed' && validSlug(frame.slug)) return { type: 'removed', slug: frame.slug }
  return undefined
}

/** One open panel window and the page that it shows. */
interface WidgetWindow {
  readonly window: BrowserWindow
  /** `page` for the built page of the slug, `shell` for the shared shell, `failed` for the shell with the notice. */
  mode: WidgetPageMode
  /** The stamp of the page link that the window shows, or undefined for no page link. */
  stamp: string | undefined
  /** The count of loads. The result of an older load is not used. */
  loads: number
  /** The last load whose failure the policy counted. Each load attempt counts one failure at most. */
  counted: number
  /** The times of the recent failures of the agent page. */
  failures: number[]
  /** The shown state that the Host gave (`main_widget.window_state`). A hidden window loads, but it does not show. */
  shown: boolean
  /** True after a load of the window ended: a Show can show it at once. */
  loaded?: true
  /** The place of the window in the default column. */
  readonly row: number
  /** The bar over the page (`window_manager.bar`). */
  readonly bar: WidgetBar
  /**
   * True from a `will-move`, which comes only for a move by the operator, such as a drag area of the page. A move of
   * this module and a change of the displays set it false: on macOS, `moved` also comes for a move from code and for a
   * move of macOS (`window_manager.move`).
   */
  nativeMove: boolean
  /** The timer that sends the end position of a move with a drag area of the page. */
  nativeMoveTimer?: ReturnType<typeof setTimeout>
}

/** How the widget origin reaches the shared shell and the Host. Electron main gives these. */
export interface WidgetOriginServers {
  /** Serve the shared shell: its document when `index` is true, else the file of the request path. */
  readonly shell: (request: Request, index: boolean) => Promise<Response>
  /** Forward a request to the Host, or give a network error while the Host is down. */
  readonly forward: (request: Request) => Promise<Response>
}

/**
 * Keep one panel window open for each slug that the Host lists, shown or hidden as the Host says.
 * A Host that becomes ready gets a new stream. The windows stay open while the Host is down;
 * the `hello` frame of the next stream syncs them and their shown state.
 */
export class DesktopWidgetWindows {
  private readonly windows = new Map<string, WidgetWindow>()
  /**
   * The window data that the window of each slug shows: the data of the Host with the choices that wait over it. It
   * stays after the window closes.
   */
  private readonly data = new Map<string, WidgetWindowData>()
  /** The window data of each slug in the last frame of the Host. */
  private readonly host = new Map<string, WidgetWindowData>()
  /** The operator choices of each slug that the Host does not have yet (`window_manager.route`). */
  private readonly pending = new Map<string, PendingChoice>()
  /** The slugs with a send in progress. A slug sends one choice at a time, so the Host gets them in their order. */
  private readonly sending = new Set<string>()
  /** The slugs that the stream of the current Host listed. A send waits for its slug, so its route exists. */
  private readonly listed = new Set<string>()
  /** The bars of the windows. Their controls change the window data. */
  readonly bars = new WidgetWindowBars({
    toggle: (slug, control) => { this.toggle(slug, control) },
    movable: slug => this.data.get(slug)?.locked === false,
    drag: (slug, point, done, start) => { this.dragged(slug, point, done, start) },
  })
  private watchingDisplays = false
  /** The page state of the Host. It stays across a Host restart, because the page files stay. */
  private pages: WidgetPages | undefined
  private target: WidgetHostTarget | undefined
  private reading: AbortController | undefined
  private retry: ReturnType<typeof setTimeout> | undefined
  private failures = 0
  private stopped = false

  /**
   * Take the page state of the Host (`agent_library.serving.changes`). The window of each slug whose page link changed
   * loads again with the URL of the new state. A change also ends the shared shell after failures of the page.
   * @param pages - the parsed `deepwidgets-pages` message.
   */
  setPages(pages: WidgetPages): void {
    this.pages = pages
    for (const [slug, entry] of this.windows) {
      const stamp = pages.pages.get(slug)
      if (stamp === entry.stamp || entry.window.isDestroyed()) continue
      entry.stamp = stamp
      entry.failures = []
      entry.mode = stamp === undefined ? 'shell' : 'page'
      console.info(`deepwidgets-windows: the page link of ${slug} changed; the window loads the ${entry.mode === 'page' ? 'page of the slug' : 'shared shell'}`)
      this.load(slug, entry)
    }
  }

  /**
   * Answer one request on the widget origin of `slug` (`agent_library.serving.routes`).
   * @param request - a request to `dsh-app://w-<slug>.widget/`.
   * @param slug - the slug of the origin.
   * @param servers - the shared shell and the forward to the Host.
   */
  async handle(request: Request, slug: string, servers: WidgetOriginServers): Promise<Response> {
    const folder = this.pages?.pages.has(slug) === true ? join(this.pages.root, slug, 'page') : undefined
    const route = widgetRoute(slug, new URL(request.url).pathname, folder !== undefined)
    if (route.kind === 'status') return new Response(null, { status: route.status })
    if (route.kind === 'api') return servers.forward(request)
    if (route.kind === 'shell') return servers.shell(request, route.index)
    // pageFile resolves each link and refuses a path outside the folder of the slug and a `.tmp` build.
    const answer = await servePageFile(request, folder ?? '', route.path, false)
    if (answer.status === 404 && route.orShell) return servers.shell(request, false)
    return answer
  }

  /**
   * Read the events of this Host. A stream of an earlier Host stops.
   * @param url - Host URL from the ready event.
   * @param cookie - Host cookie from `authenticateWebHost`.
   */
  hostReady(url: string, cookie: string): void {
    if (this.stopped) return
    this.target = { url, cookie }
    this.failures = 0
    this.connect()
  }

  /** Stop the stream until the next Host is ready. The windows stay open, and the choices that wait stay. */
  hostGone(): void {
    this.target = undefined
    this.halt()
  }

  /** Stop for good on app quit. It does not wait for anything, so it cannot hold the quit. */
  stop(): void {
    this.stopped = true
    this.target = undefined
    this.halt()
    this.bars.stop()
    for (const { window } of this.windows.values()) if (!window.isDestroyed()) window.hide()
  }

  private halt(): void {
    clearTimeout(this.retry)
    this.retry = undefined
    this.reading?.abort()
    this.reading = undefined
    this.listed.clear()
  }

  private connect(): void {
    this.halt()
    const target = this.target
    if (this.stopped || target === undefined) return
    const reading = new AbortController()
    this.reading = reading
    void this.read(target, reading.signal).catch((error: unknown) => {
      if (!reading.signal.aborted) console.warn('deepwidgets-windows: GET /api/widgets/events failed', error)
    }).finally(() => {
      if (this.reading !== reading) return
      this.reading = undefined
      // The stream ended: open it again with backoff. Its `hello` syncs the windows.
      const wait = Math.min(RETRY_MAX_MS, RETRY_FIRST_MS * 2 ** this.failures)
      this.failures += 1
      this.retry = setTimeout(() => { this.connect() }, wait)
    })
  }

  private async read(target: WidgetHostTarget, signal: AbortSignal): Promise<void> {
    const response = await fetch(new URL('/api/widgets/events', target.url), {
      headers: { accept: 'text/event-stream', cookie: target.cookie },
      signal,
    })
    if (!response.ok || response.body === null) {
      await response.body?.cancel()
      throw new Error(`GET /api/widgets/events answered ${String(response.status)}`)
    }
    const events = response.body.pipeThrough(new TextDecoderStream()).pipeThrough(new EventSourceParserStream())
    for await (const event of events) {
      if (signal.aborted) return
      const frame = parseWidgetEvent(event.data)
      if (frame === undefined) continue
      if (frame.type === 'hello') {
        this.failures = 0
        this.sync(frame.slugs)
      }
      else if (frame.type === 'added' || frame.type === 'window') this.obey(frame.slug, frame.data)
      else {
        this.listed.delete(frame.slug)
        this.close(frame.slug)
      }
    }
  }

  private sync(slugs: readonly WidgetFrameItem[]): void {
    const listed = new Set(slugs.map(item => item.slug))
    this.listed.clear()
    for (const slug of [...this.windows.keys()]) if (!listed.has(slug)) this.close(slug)
    for (const { slug, data } of slugs) this.obey(slug, data)
  }

  /**
   * Obey the window data of one frame: open the window of the slug, or make the open window match the data. Each choice
   * that waits for the Host wins over the frame, so a frame from before the choice does not undo it. Then the choices
   * of the slug go to the Host.
   * @param slug - the slug of the frame.
   * @param frame - the window data of the frame.
   */
  private obey(slug: string, frame: HostWindowData): void {
    if (this.stopped) return
    this.listed.add(slug)
    const { shown, ...host } = frame
    this.host.set(slug, host)
    const next = withPending(host, this.pending.get(slug))
    const entry = this.windows.get(slug)
    if (entry === undefined || entry.window.isDestroyed()) {
      this.data.set(slug, next)
      this.open(slug, shown)
    } else {
      this.apply(slug, entry, next)
      this.show(entry, shown)
    }
    this.flush(slug)
  }

  /**
   * Open the panel window of one slug once: no frame, shown without focus, as the trace window. Each window has its own
   * renderer, and the bar over it. The window data of the slug gives its layer, lock, place, and size
   * (`window_manager.move`).
   * @param shown - false keeps the window hidden (`main_widget.window_state`).
   */
  private open(slug: string, shown: boolean): void {
    this.watchDisplays()
    const data = this.dataOf(slug)
    const row = this.windows.size
    const place = this.placeOf(data, row)
    const window = new BrowserWindow({
      x: place.x,
      y: place.y,
      width: data.width,
      height: data.height,
      resizable: data.resizable,
      minWidth: WIDGET_SIZE_MIN,
      minHeight: WIDGET_SIZE_MIN,
      maxWidth: WIDGET_SIZE_MAX,
      maxHeight: WIDGET_SIZE_MAX,
      movable: !data.locked,
      frame: false,
      alwaysOnTop: data.layer === 'top',
      // A press on the bar of a window of an app that is not in front also reaches the bar, so one press starts a drag.
      acceptFirstMouse: true,
      show: false,
      title: `deepWidgets ${slug}`,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    })
    const stamp = this.pages?.pages.get(slug)
    const bar = this.bars.attach(slug, window, { layer: data.layer, locked: data.locked })
    const entry: WidgetWindow = { window, mode: stamp === undefined ? 'shell' : 'page', stamp, loads: 0, counted: 0, failures: [], shown, row, bar, nativeMove: false }
    this.windows.set(slug, entry)
    window.once('closed', () => {
      clearTimeout(entry.nativeMoveTimer)
      if (this.windows.get(slug) === entry) this.windows.delete(slug)
    })
    this.setLayer(window, data.layer)
    window.on('will-move', () => { entry.nativeMove = true })
    window.on('moved', () => {
      if (!entry.nativeMove || window.isDestroyed()) return
      // A move with a drag area of the page gives a `moved` for each step. The end position goes to the Host one time.
      clearTimeout(entry.nativeMoveTimer)
      entry.nativeMoveTimer = setTimeout(() => { this.nativeMoved(slug, entry) }, NATIVE_MOVE_SETTLE_MS)
    })
    window.on('resized', () => { this.resized(slug, entry) })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => { event.preventDefault() })
    window.webContents.on('render-process-gone', (_event, details) => {
      if (entry.mode === 'page' && !this.stopped && !window.isDestroyed()) this.pageFailed(slug, entry, entry.loads, `its renderer ended (${details.reason})`)
    })
    this.load(slug, entry)
  }

  /**
   * Obey the shown state of the Host. A shown window shows with no focus, so it does not take the keys of the operator.
   * A window whose page did not load yet shows when its load ends.
   */
  private show(entry: WidgetWindow, shown: boolean): void {
    entry.shown = shown
    const { window } = entry
    if (window.isDestroyed()) return
    if (!shown) window.hide()
    else if (entry.loaded === true && !window.isVisible()) {
      window.showInactive()
      this.bars.watch()
    }
  }

  /**
   * Load the URL of the mode of the window. A failed load of the shared shell destroys the window, as before.
   * A failed load of an agent page follows the failure policy.
   */
  private load(slug: string, entry: WidgetWindow): void {
    const { window, mode } = entry
    if (window.isDestroyed()) return
    const load = ++entry.loads
    const url = widgetUrl(slug, mode)
    void window.loadURL(url).then(() => {
      if (window.isDestroyed() || this.stopped || load !== entry.loads) return
      entry.loaded = true
      if (entry.shown) {
        window.showInactive()
        this.bars.watch()
      }
    }, (error: unknown) => {
      // A newer load stopped this one.
      if (window.isDestroyed() || load !== entry.loads) return
      console.warn(`deepwidgets-windows: the window of ${slug} did not load ${url}`, error)
      if (mode !== 'page' || this.stopped) { window.destroy(); return }
      // A renderer that ends during the load also rejects the load. The wait lets the gone event of the same attempt
      // count first, so the attempt counts one failure, not two.
      setTimeout(() => { if (!window.isDestroyed()) this.pageFailed(slug, entry, load, 'its load failed') }, LOAD_FAILURE_SETTLE_MS)
    })
  }

  /**
   * The failure policy of an agent page (`agent_library.serving.failures`), for one failed load attempt: load the page
   * one more time. A second
   * failure in {@link PAGE_FAILURE_WINDOW_MS} loads the shared shell with the notice. The window keeps it until the
   * page link of the slug changes or the app starts again.
   */
  private pageFailed(slug: string, entry: WidgetWindow, attempt: number, reason: string): void {
    // A signal of an older load, or a second signal of the same load, does not count.
    if (attempt !== entry.loads || entry.counted === attempt || entry.mode !== 'page' || this.stopped) return
    entry.counted = attempt
    const now = Date.now()
    entry.failures = [...entry.failures.filter(at => now - at < PAGE_FAILURE_WINDOW_MS), now]
    if (entry.failures.length >= 2) {
      entry.mode = 'failed'
      console.warn(`deepwidgets-windows: the page of ${slug} failed again in ${String(PAGE_FAILURE_WINDOW_MS / 1000)} s: ${reason}; the window loads the shared shell with the notice`)
    } else {
      console.warn(`deepwidgets-windows: the page of ${slug} failed: ${reason}; the window loads the page one more time`)
    }
    this.load(slug, entry)
  }

  private close(slug: string): void {
    const entry = this.windows.get(slug)
    this.windows.delete(slug)
    if (entry !== undefined && !entry.window.isDestroyed()) entry.window.destroy()
  }

  /**
   * Make an open window match its window data. Only a field that changed acts, so a frame that repeats the data does not
   * move the window. A drag in progress keeps its place.
   */
  private apply(slug: string, entry: WidgetWindow, next: WidgetWindowData): void {
    const prev = this.data.get(slug) ?? next
    this.data.set(slug, next)
    const { window } = entry
    if (window.isDestroyed()) return
    if (prev.layer !== next.layer) this.setLayer(window, next.layer)
    if (prev.locked !== next.locked) window.setMovable(!next.locked)
    if (prev.layer !== next.layer || prev.locked !== next.locked) entry.bar.setState({ layer: next.layer, locked: next.locked })
    if (prev.resizable !== next.resizable) window.setResizable(next.resizable)
    const sized = prev.width !== next.width || prev.height !== next.height
    if (sized) window.setSize(next.width, next.height)
    const moved = prev.position?.x !== next.position?.x || prev.position?.y !== next.position?.y
    if ((moved || sized) && !this.bars.dragging(slug)) {
      const place = this.placeOf(next, entry.row)
      const [x = 0, y = 0] = window.getPosition()
      if (place.x !== x || place.y !== y) this.moveTo(entry, place)
    }
  }

  /**
   * The layer of a window (`window_manager.move`). `top`: above each app window, and on all Spaces. `normal`: app windows
   * can cover it, and it stays on its one Space. Each call keeps the Dock icon away (`skipTransformProcessType`).
   */
  private setLayer(window: BrowserWindow, layer: WidgetLayer): void {
    window.setAlwaysOnTop(layer === 'top')
    window.setVisibleOnAllWorkspaces(layer === 'top', { skipTransformProcessType: true })
  }

  /** Keep one operator choice of `slug`, and send it to the Host. */
  private choose(slug: string, choice: PendingChoice): void {
    this.pending.set(slug, { ...this.pending.get(slug), ...choice })
    this.flush(slug)
  }

  /**
   * Send the choices of `slug` that wait, one send at a time. A send waits for a ready Host whose stream lists the slug.
   * A send that the Host refuses drops its choices, and the window takes the data of the Host again. A send that does not
   * reach the Host keeps its choices: they go again after {@link CHOICE_RETRY_MS} while the same Host is ready, or at the
   * next frame of the slug.
   */
  private flush(slug: string): void {
    const pending = this.pending.get(slug)
    const target = this.target
    if (pending === undefined || target === undefined || this.stopped || this.sending.has(slug) || !this.listed.has(slug)) return
    this.sending.add(slug)
    void this.send(target, slug, pending).then((outcome) => {
      this.sending.delete(slug)
      if (outcome === 'later') {
        setTimeout(() => { if (this.target === target) this.flush(slug) }, CHOICE_RETRY_MS)
        return
      }
      const rest = settleChoice(this.pending.get(slug), pending)
      if (rest === undefined) this.pending.delete(slug)
      else this.pending.set(slug, rest)
      if (outcome === 'refused') this.rematch(slug)
      this.flush(slug)
    })
  }

  /**
   * One send of the choices of `slug` to `POST /api/widget-windows/<slug>`.
   * @returns `stored` when the Host stored them, `refused` when the Host refused them for their values, and `later`
   *   when the send did not reach the Host or the Host could not take it now.
   */
  private async send(target: WidgetHostTarget, slug: string, choice: PendingChoice): Promise<'stored' | 'refused' | 'later'> {
    try {
      const response = await fetch(new URL(`/api/widget-windows/${slug}`, target.url), {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie: target.cookie },
        body: JSON.stringify(choiceBody(choice)),
        signal: AbortSignal.timeout(CHOICE_TIMEOUT_MS),
      })
      type Answer = { ok?: unknown; error?: { code?: unknown; message?: unknown } } | undefined
      const answer = await response.json().catch(() => undefined) as Answer
      if (response.ok && answer?.ok === true) return 'stored'
      const code = answer?.error?.code
      if (code === 'not-resizable' || code === 'bad-request') {
        console.warn(`deepwidgets-windows: the Host refused a window choice of ${slug}: ${code}: ${JSON.stringify(answer?.error?.message)}`)
        return 'refused'
      }
      console.warn(`deepwidgets-windows: POST /api/widget-windows/${slug} answered ${String(response.status)} ${JSON.stringify(code)}; the choice waits`)
      return 'later'
    } catch (error) {
      if (this.target === target) console.warn(`deepwidgets-windows: POST /api/widget-windows/${slug} failed; the choice waits`, error)
      return 'later'
    }
  }

  /** After a refused send, the window takes the data of the Host, with the choices that still wait. */
  private rematch(slug: string): void {
    const host = this.host.get(slug)
    const entry = this.windows.get(slug)
    if (host === undefined || entry === undefined) return
    this.apply(slug, entry, withPending(host, this.pending.get(slug)))
  }

  /** The window data of a slug. A slug with no data gets the data of a new widget. */
  private dataOf(slug: string): WidgetWindowData {
    let data = this.data.get(slug)
    if (data === undefined) {
      data = newWindowData()
      this.data.set(slug, data)
    }
    return data
  }

  /** The place of a window on the current displays (`window_manager.move`). */
  private placeOf(data: WidgetWindowData, row: number): ScreenPoint {
    return placeWindow(data, row, screen.getPrimaryDisplay().workArea, screen.getAllDisplays().map(display => display.bounds))
  }

  /** Move a window from code. The `moved` event of this move is not a move by the operator. */
  private moveTo(entry: WidgetWindow, point: ScreenPoint): void {
    if (entry.window.isDestroyed()) return
    entry.nativeMove = false
    entry.window.setPosition(point.x, point.y)
  }

  /**
   * At each change of the displays, a window that touches no display moves to the default position. The move is not an
   * operator choice, so the stored position stays (`window_manager.move`). A move of macOS at the change is not one
   * either: the check clears the mark of a move by the operator first (native_move_flag_stays_on).
   */
  private watchDisplays(): void {
    if (this.watchingDisplays) return
    this.watchingDisplays = true
    const check = (): void => {
      for (const entry of this.windows.values()) entry.nativeMove = false
      for (const [slug, entry] of this.windows) {
        const data = this.data.get(slug)
        if (data === undefined || entry.window.isDestroyed()) continue
        const [x = 0, y = 0] = entry.window.getPosition()
        const place = this.placeOf({ ...data, position: { x, y } }, entry.row)
        if (place.x !== x || place.y !== y) this.moveTo(entry, place)
      }
    }
    screen.on('display-removed', check)
    screen.on('display-metrics-changed', check)
  }

  /**
   * The layer button and the lock button of the bar (`window_manager.bar`). A layer change does not move the window, so
   * a locked window stays in place. A lock stops a move, and not a resize. Each change is an operator choice.
   */
  private toggle(slug: string, control: 'layer' | 'lock'): void {
    const entry = this.windows.get(slug)
    const data = this.data.get(slug)
    if (entry === undefined || data === undefined || entry.window.isDestroyed()) return
    if (control === 'layer') {
      data.layer = data.layer === 'top' ? 'normal' : 'top'
      this.setLayer(entry.window, data.layer)
      this.choose(slug, { layer: data.layer })
    } else {
      data.locked = !data.locked
      entry.window.setMovable(!data.locked)
      this.choose(slug, { locked: data.locked })
    }
    entry.bar.setState({ layer: data.layer, locked: data.locked })
  }

  /**
   * A drag on the handle of the bar. At its end, the position that the window has is an operator choice: macOS can put
   * the window at another place than the one asked (stored_position_not_window_position). A drag that did not move the
   * window stores nothing (handle_click_stores_position).
   */
  private dragged(slug: string, point: ScreenPoint, done: boolean, start: ScreenPoint): void {
    const entry = this.windows.get(slug)
    const data = this.data.get(slug)
    if (entry === undefined || data === undefined || data.locked || entry.window.isDestroyed()) return
    this.moveTo(entry, point)
    if (!done) return
    const [x = start.x, y = start.y] = entry.window.getPosition()
    if (x === start.x && y === start.y) return
    data.position = { x, y }
    this.choose(slug, { position: data.position })
  }

  /** The end of a move by the operator with a drag area of the page: its position is an operator choice. */
  private nativeMoved(slug: string, entry: WidgetWindow): void {
    const data = this.data.get(slug)
    if (!entry.nativeMove || data === undefined || entry.window.isDestroyed()) return
    const [x = 0, y = 0] = entry.window.getPosition()
    if (data.position?.x === x && data.position.y === y) return
    data.position = { x, y }
    this.choose(slug, { position: data.position })
  }

  /** The end of a resize by the operator at the window edges (`window_manager.move`): the size is an operator choice. */
  private resized(slug: string, entry: WidgetWindow): void {
    const data = this.data.get(slug)
    if (data === undefined || !data.resizable || entry.window.isDestroyed()) return
    const [width = data.width, height = data.height] = entry.window.getSize()
    if (width === data.width && height === data.height) return
    data.width = width
    data.height = height
    this.choose(slug, { size: { width, height } })
  }
}
