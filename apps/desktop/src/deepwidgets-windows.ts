/**
 * deepWidgets windows: one floating panel window for each widget of the Host.
 * The spec is `widget_mvp.windows` in `docs/specs/widget-mvp.md`. Each window loads its page from the widget origin
 * of its slug (`agent_library.serving` in `docs/specs/agent-library.md`): the built page of the slug when the Host
 * lists a page link for it, else the shared shell. This module also answers the requests of a widget origin.
 * The Host decides whether each window shows (`main_widget.window_state`, decision `widget.window_manager`): each frame
 * of the events stream carries the shown state, and this module shows or hides the window to match it.
 * @module deepwidgets-windows
 */
import { join } from 'node:path'
import { BrowserWindow, screen } from 'electron'
import { EventSourceParserStream } from 'eventsource-parser/stream'
import { isWidgetSlug, widgetRoute, widgetUrl, type WidgetPageMode, type WidgetPages } from './deepwidgets-origin.ts'
import { servePageFile } from './deepwidgets-page-path.ts'

/** One frame of `GET /api/widgets/events` (`widget_mvp.runtime.routes`, `main_widget.window_state`). */
type WidgetEvent =
  | { readonly type: 'hello'; readonly slugs: readonly { readonly slug: string; readonly shown: boolean }[] }
  | { readonly type: 'added' | 'window'; readonly slug: string; readonly shown: boolean }
  | { readonly type: 'removed'; readonly slug: string }

/** The ready Host that serves the events. */
interface WidgetHostTarget {
  readonly url: string
  readonly cookie: string
}

const WIDGET_WIDTH = 320
const WIDGET_HEIGHT = 300
const WIDGET_GAP = 16
const RETRY_FIRST_MS = 500
const RETRY_MAX_MS = 10_000
/** A second failure of an agent page in this time puts its window on the shared shell (`agent_library.serving.failures`). */
const PAGE_FAILURE_WINDOW_MS = 60_000
/** The wait before a failed load of an agent page counts, so the gone event of the same load counts first. */
const LOAD_FAILURE_SETTLE_MS = 250

/**
 * Check one slug against the Host pattern. An invalid slug writes one warning.
 * @param slug - slug from a frame.
 */
function validSlug(slug: unknown): slug is string {
  if (isWidgetSlug(slug)) return true
  console.warn('deepwidgets-windows: dropped an invalid slug', JSON.stringify(slug))
  return false
}

/** A window shows unless the Host says `false`: a new widget starts as shown (`main_widget.window_state`). */
const shownValue = (value: unknown): boolean => value !== false

/**
 * Parse one frame at the boundary. An unknown frame gives `undefined`. Invalid slugs are dropped.
 * @param data - the `data` field of one server-sent event.
 */
function parseWidgetEvent(data: string): WidgetEvent | undefined {
  let value: unknown
  try { value = JSON.parse(data) } catch { return undefined }
  if (typeof value !== 'object' || value === null) return undefined
  const frame = value as { type?: unknown; slug?: unknown; slugs?: unknown; shown?: unknown }
  if (frame.type === 'hello' && Array.isArray(frame.slugs)) {
    const shown = typeof frame.shown === 'object' && frame.shown !== null ? frame.shown as Record<string, unknown> : {}
    return { type: 'hello', slugs: frame.slugs.filter(validSlug).map(slug => ({ slug, shown: shownValue(shown[slug]) })) }
  }
  if ((frame.type === 'added' || frame.type === 'window') && validSlug(frame.slug)) {
    return { type: frame.type, slug: frame.slug, shown: shownValue(frame.shown) }
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

  /** Stop the stream until the next Host is ready. The windows stay open. */
  hostGone(): void {
    this.target = undefined
    this.halt()
  }

  /** Stop for good on app quit. It does not wait for anything, so it cannot hold the quit. */
  stop(): void {
    this.stopped = true
    this.target = undefined
    this.halt()
    for (const { window } of this.windows.values()) if (!window.isDestroyed()) window.hide()
  }

  private halt(): void {
    clearTimeout(this.retry)
    this.retry = undefined
    this.reading?.abort()
    this.reading = undefined
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
      else if (frame.type === 'added' || frame.type === 'window') this.open(frame.slug, frame.shown)
      else this.close(frame.slug)
    }
  }

  private sync(slugs: readonly { readonly slug: string; readonly shown: boolean }[]): void {
    const listed = new Set(slugs.map(item => item.slug))
    for (const slug of [...this.windows.keys()]) if (!listed.has(slug)) this.close(slug)
    for (const { slug, shown } of slugs) this.open(slug, shown)
  }

  /**
   * Open the panel window of one slug once: no frame, always on top, on all Spaces,
   * and shown without focus, as the trace window. Each window has its own renderer.
   * A window that is open already takes the shown state.
   * @param shown - false keeps the window hidden (`main_widget.window_state`).
   */
  private open(slug: string, shown: boolean): void {
    if (this.stopped) return
    const existing = this.windows.get(slug)
    if (existing !== undefined && !existing.window.isDestroyed()) {
      this.show(existing, shown)
      return
    }
    const area = screen.getPrimaryDisplay().workArea
    const row = this.windows.size
    const window = new BrowserWindow({
      x: area.x + WIDGET_GAP,
      y: Math.min(area.y + WIDGET_GAP + row * (WIDGET_HEIGHT + WIDGET_GAP), area.y + area.height - WIDGET_HEIGHT),
      width: WIDGET_WIDTH,
      height: WIDGET_HEIGHT,
      resizable: true,
      frame: false,
      alwaysOnTop: true,
      show: false,
      title: `deepWidgets ${slug}`,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    })
    const stamp = this.pages?.pages.get(slug)
    const entry: WidgetWindow = { window, mode: stamp === undefined ? 'shell' : 'page', stamp, loads: 0, counted: 0, failures: [], shown }
    this.windows.set(slug, entry)
    window.once('closed', () => { if (this.windows.get(slug) === entry) this.windows.delete(slug) })
    window.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true })
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
    else if (entry.loaded === true && !window.isVisible()) window.showInactive()
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
      if (entry.shown) window.showInactive()
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
}
