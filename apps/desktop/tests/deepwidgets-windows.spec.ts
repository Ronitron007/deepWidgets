/** The failed loads of a widget window (agent_library.serving.failures), with fakes of Electron and of the Host stream. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WidgetPages } from '../src/deepwidgets-origin.ts'

const fake = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events')
  /** One `loadURL` call. The test settles it as Electron does. */
  interface Load {
    readonly url: string
    readonly resolve: () => void
    readonly reject: (error: unknown) => void
  }
  const windows: FakeWindow[] = []
  class FakeWindow extends EventEmitter {
    visible = false
    destroyed = false
    readonly loads: Load[] = []
    readonly webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: () => {} })
    constructor(readonly options: Record<string, unknown>) {
      super()
      windows.push(this)
    }

    loadURL(url: string): Promise<void> {
      return new Promise((resolve, reject) => { this.loads.push({ url, resolve, reject }) })
    }

    isDestroyed() { return this.destroyed }
    destroy() { this.destroyed = true }
    isVisible() { return this.visible }
    showInactive() { this.visible = true }
    hide() { this.visible = false }
    setVisibleOnAllWorkspaces() {}
    setAlwaysOnTop() {}
    setMovable() {}
    setPosition() {}
    getPosition() { return [0, 0] }
    getSize() { return [320, 300] }
  }
  return { FakeWindow, windows }
})

vi.mock('electron', () => ({
  BrowserWindow: fake.FakeWindow,
  screen: {
    getPrimaryDisplay: () => ({ workArea: { x: 0, y: 0, width: 1440, height: 900 } }),
    getAllDisplays: () => [{ bounds: { x: 0, y: 0, width: 1440, height: 900 } }],
    on: () => {},
  },
}))
// The bar has its own spec (deepwidgets-window-bar.spec.ts).
vi.mock('../src/deepwidgets-window-bar.ts', () => ({
  WidgetWindowBars: class {
    attach() { return { setState: () => {} } }
    watch() {}
    stop() {}
  },
}))

const { DesktopWidgetWindows } = await import('../src/deepwidgets-windows.ts')
const { widgetUrl } = await import('../src/deepwidgets-origin.ts')

type FakeWindow = InstanceType<typeof fake.FakeWindow>

const SLUG = 'create-window'
const SHELL = widgetUrl(SLUG, 'shell')
const PAGE = widgetUrl(SLUG, 'page')
const FAILED = widgetUrl(SLUG, 'failed')
const ROOT = '/profile/deepwidgets-widgets'
const WITH_PAGE: WidgetPages = { root: ROOT, pages: new Map([[SLUG, 'stamp-1']]) }
const NO_PAGE: WidgetPages = { root: ROOT, pages: new Map() }
/** Longer than the wait before a failed load counts (`LOAD_FAILURE_SETTLE_MS`). */
const SETTLE_MS = 1000

let open: InstanceType<typeof DesktopWidgetWindows> | undefined

/** The error of a rejected `loadURL`, with the fields that Electron gives it. */
function loadError(errno: number, code: string, url: string): Error {
  return Object.assign(new Error(`${code} (${String(errno)}) loading '${url}'`), { errno, code, url })
}

/**
 * The abort of the document that a load replaced, as Electron 44 gives it to the newer load: its `did-fail-load` has
 * an empty description, so `code` is empty, and `url` is the URL of the replaced document.
 */
function replacedAbort(url: string): Error {
  return loadError(-3, '', url)
}

/** The Host stream: one `hello` frame that lists the slug as shown. The stream stays open until its abort. */
function serveHello(): void {
  vi.stubGlobal('fetch', async (_url: URL, init: { signal: AbortSignal }) => {
    const frame = JSON.stringify({ type: 'hello', slugs: [SLUG], shown: { [SLUG]: true } })
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(`data: ${frame}\n\n`))
        init.signal.addEventListener('abort', () => { controller.error(init.signal.reason) })
      },
    })
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
  })
}

/**
 * Open the window of the slug with the page state `before`, then give it the page state `after` while the first load
 * runs. The window loads again, and Electron rejects the first load with the abort that the second load causes.
 */
async function switchWindow(before: WidgetPages, after: WidgetPages): Promise<FakeWindow> {
  serveHello()
  const windows = new DesktopWidgetWindows()
  open = windows
  windows.setPages(before)
  windows.hostReady('http://127.0.0.1:1', 'cookie')
  await vi.waitFor(() => { expect(fake.windows).toHaveLength(1) })
  const window = fake.windows[0]!
  windows.setPages(after)
  expect(window.loads).toHaveLength(2)
  window.loads[0]!.reject(loadError(-3, 'ERR_ABORTED', window.loads[1]!.url))
  return window
}

function urls(window: FakeWindow): string[] {
  return window.loads.map(load => load.url)
}

/** The renderer of the window ends: one failure of the page. */
function crash(window: FakeWindow): void {
  window.webContents.emit('render-process-gone', {}, { reason: 'crashed' })
}

beforeEach(() => {
  vi.useFakeTimers()
  fake.windows.length = 0
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  open?.stop()
  open = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('a rejected load of the page of a slug', () => {
  it.each([
    ['ERR_ABORTED', loadError(-3, 'ERR_ABORTED', SHELL)],
    ['an empty code', replacedAbort(SHELL)],
  ])('is no failure when its error is errno -3 with %s and the URL of the shell: nothing loads again, and the window shows', async (_code, error) => {
    const window = await switchWindow(NO_PAGE, WITH_PAGE)
    window.loads[1]!.reject(error)
    await vi.advanceTimersByTimeAsync(SETTLE_MS)
    expect(urls(window)).toEqual([SHELL, PAGE])
    expect(window.visible).toBe(true)
    // No failure counted: the first crash loads the page one more time, not the shell with the notice.
    crash(window)
    expect(urls(window)).toEqual([SHELL, PAGE, PAGE])
  })

  it('counts one failure when its error is not an abort', async () => {
    const window = await switchWindow(NO_PAGE, WITH_PAGE)
    window.loads[1]!.reject(loadError(-2, 'ERR_FAILED', PAGE))
    await vi.advanceTimersByTimeAsync(SETTLE_MS)
    expect(urls(window)).toEqual([SHELL, PAGE, PAGE])
    // The second failure in 60 s loads the shared shell with the notice.
    crash(window)
    expect(urls(window)).toEqual([SHELL, PAGE, PAGE, FAILED])
  })

  it('counts one failure when its error is an abort with the URL of the page', async () => {
    const window = await switchWindow(NO_PAGE, WITH_PAGE)
    window.loads[1]!.reject(loadError(-3, 'ERR_ABORTED', PAGE))
    await vi.advanceTimersByTimeAsync(SETTLE_MS)
    expect(urls(window)).toEqual([SHELL, PAGE, PAGE])
    crash(window)
    expect(urls(window)).toEqual([SHELL, PAGE, PAGE, FAILED])
  })
})

describe('a rejected load of the shared shell', () => {
  it('keeps the window when its error is the abort of the page load that it replaced', async () => {
    const window = await switchWindow(WITH_PAGE, NO_PAGE)
    window.loads[1]!.reject(replacedAbort(PAGE))
    await vi.advanceTimersByTimeAsync(SETTLE_MS)
    expect(urls(window)).toEqual([PAGE, SHELL])
    expect(window.destroyed).toBe(false)
    expect(window.visible).toBe(true)
  })

  it('destroys the window when its error is not an abort, as before', async () => {
    const window = await switchWindow(WITH_PAGE, NO_PAGE)
    window.loads[1]!.reject(loadError(-2, 'ERR_FAILED', SHELL))
    await vi.advanceTimersByTimeAsync(SETTLE_MS)
    expect(window.destroyed).toBe(true)
  })
})
