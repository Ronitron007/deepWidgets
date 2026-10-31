/**
 * deepWidgets windows: one floating panel window for each widget of the Host.
 * The spec is `widget_mvp.windows` in `docs/specs/widget-mvp.md`.
 * @module deepwidgets-windows
 */
import { BrowserWindow, screen } from 'electron'
import { EventSourceParserStream } from 'eventsource-parser/stream'

/** One frame of `GET /api/widgets/events` (`widget_mvp.runtime.routes`). */
type WidgetEvent =
  | { readonly type: 'hello'; readonly slugs: readonly string[] }
  | { readonly type: 'added' | 'removed'; readonly slug: string }

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

/** The slug pattern of the Host runtime (`deepwidgets/widgets/src/index.ts`). */
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/u

/**
 * Check one slug against the Host pattern. An invalid slug writes one warning.
 * @param slug - slug from a frame.
 */
function validSlug(slug: unknown): slug is string {
  if (typeof slug === 'string' && SLUG.test(slug)) return true
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
  const frame = value as { type?: unknown; slug?: unknown; slugs?: unknown }
  if (frame.type === 'hello' && Array.isArray(frame.slugs)) {
    return { type: 'hello', slugs: frame.slugs.filter(validSlug) }
  }
  if ((frame.type === 'added' || frame.type === 'removed') && validSlug(frame.slug)) {
    return { type: frame.type, slug: frame.slug }
  }
  return undefined
}

/**
 * Keep one panel window open for each slug that the Host lists.
 * A Host that becomes ready gets a new stream. The windows stay open while the Host is down;
 * the `hello` frame of the next stream syncs them.
 */
export class DesktopWidgetWindows {
  private readonly windows = new Map<string, BrowserWindow>()
  private target: WidgetHostTarget | undefined
  private reading: AbortController | undefined
  private retry: ReturnType<typeof setTimeout> | undefined
  private failures = 0
  private stopped = false

  /**
   * @param pageUrl - gives the page URL of one slug.
   */
  constructor(private readonly pageUrl: (slug: string) => string) {}

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
    for (const window of this.windows.values()) if (!window.isDestroyed()) window.hide()
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
      else if (frame.type === 'added') this.open(frame.slug)
      else this.close(frame.slug)
    }
  }

  private sync(slugs: readonly string[]): void {
    const listed = new Set(slugs)
    for (const slug of [...this.windows.keys()]) if (!listed.has(slug)) this.close(slug)
    for (const slug of slugs) this.open(slug)
  }

  /**
   * Open the panel window of one slug once: no frame, always on top, on all Spaces,
   * and shown without focus, as the trace window. Each window has its own renderer.
   */
  private open(slug: string): void {
    if (this.stopped) return
    const existing = this.windows.get(slug)
    if (existing !== undefined && !existing.isDestroyed()) return
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
    this.windows.set(slug, window)
    window.once('closed', () => { if (this.windows.get(slug) === window) this.windows.delete(slug) })
    window.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => { event.preventDefault() })
    void window.loadURL(this.pageUrl(slug)).then(() => {
      if (!window.isDestroyed() && !this.stopped) window.showInactive()
    }, (error: unknown) => {
      console.warn(`deepwidgets-windows: the window of ${slug} did not load`, error)
      if (!window.isDestroyed()) window.destroy()
    })
  }

  private close(slug: string): void {
    const window = this.windows.get(slug)
    this.windows.delete(slug)
    if (window !== undefined && !window.isDestroyed()) window.destroy()
  }
}
