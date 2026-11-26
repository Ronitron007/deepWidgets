/** The bar of a widget window and its window place (window_manager.bar, window_manager.move), with fakes of Electron. */
import { EventEmitter } from 'node:events'
import { afterEach, describe, expect, it, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const listeners = new Map<string, (event: unknown, value: unknown) => void>()
  let nextId = 1
  return { listeners, nextId: () => nextId++, views: [] as unknown[] }
})

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')
  class FakeView {
    visible = true
    bounds = { x: 0, y: 0, width: 0, height: 0 }
    readonly webContents = Object.assign(new EventEmitter(), {
      id: fake.nextId(),
      mainFrame: { name: 'main' },
      destroyed: false,
      isDestroyed() { return this.destroyed },
      loadURL: vi.fn(async (_url: string) => {}),
      send: vi.fn(),
      close: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    })
    constructor(readonly options: { webPreferences: Record<string, unknown> }) { fake.views.push(this) }
    setVisible(value: boolean) { this.visible = value }
    getVisible() { return this.visible }
    setBounds(bounds: { x: number; y: number; width: number; height: number }) { this.bounds = bounds }
    setBackgroundColor = vi.fn()
  }
  return {
    WebContentsView: FakeView,
    ipcMain: { on: (channel: string, listener: (event: unknown, value: unknown) => void) => { fake.listeners.set(channel, listener) } },
    screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }) },
  }
})

const { WidgetWindowBars, WIDGET_BAR_HEIGHT, HOVER_POLL_MS, DRAG_POLL_MS } = await import('../src/deepwidgets-window-bar.ts')
const { WIDGET_BAR_IPC, parseBarCommand, parseBarState } = await import('../src/deepwidgets-window-bar-protocol.ts')
const { defaultPosition, newWindowData, placeWindow, touchesDisplay, WIDGET_GAP } = await import('../src/deepwidgets-window-place.ts')

type View = InstanceType<typeof import('electron').WebContentsView> & { visible: boolean; bounds: { width: number; height: number } }

function fakeWindow(bounds = { x: 100, y: 100, width: 320, height: 300 }) {
  return Object.assign(new EventEmitter(), {
    bounds,
    visible: true,
    destroyed: false,
    contentView: { addChildView: vi.fn() },
    isDestroyed() { return this.destroyed },
    isVisible() { return this.visible },
    getBounds() { return this.bounds },
    getContentBounds() { return this.bounds },
    getPosition() { return [this.bounds.x, this.bounds.y] },
  })
}

function make() {
  const owner = { toggle: vi.fn(), movable: vi.fn(() => true), drag: vi.fn() }
  const bars = new WidgetWindowBars(owner, 'bar-preload.cjs')
  let cursor = { x: -1000, y: -1000 }
  bars.cursorPoint = () => cursor
  const window = fakeWindow()
  const bar = bars.attach('sample', window as never, { layer: 'top', locked: false })
  const view = bar.view as unknown as View
  const sender = view.webContents as unknown as { id: number; mainFrame: unknown }
  const send = (value: unknown, from: { id: number; mainFrame: unknown } = sender, frame: unknown = from.mainFrame) => {
    fake.listeners.get(WIDGET_BAR_IPC.command)?.({ sender: from, senderFrame: frame }, value)
  }
  return { owner, bars, window, bar, view, send, setCursor: (point: { x: number; y: number }) => { cursor = point } }
}

afterEach(() => { vi.useRealTimers() })

describe('the bar view', () => {
  it('sits over the page as a hidden, isolated view 24 points high at the top', () => {
    const f = make()
    expect(f.window.contentView.addChildView).toHaveBeenCalledWith(f.view)
    expect(f.view.visible).toBe(false)
    expect(f.view.bounds).toEqual({ x: 0, y: 0, width: 320, height: WIDGET_BAR_HEIGHT })
    expect((f.view as unknown as { options: { webPreferences: Record<string, unknown> } }).options.webPreferences)
      .toMatchObject({ preload: 'bar-preload.cjs', sandbox: true, contextIsolation: true, nodeIntegration: false })
  })

  it('shows while the mouse is over a shown window, and hides when it leaves', () => {
    vi.useFakeTimers()
    const f = make()
    f.bars.watch()
    f.setCursor({ x: 150, y: 150 })
    vi.advanceTimersByTime(HOVER_POLL_MS)
    expect(f.view.visible).toBe(true)
    f.setCursor({ x: 50, y: 50 })
    vi.advanceTimersByTime(HOVER_POLL_MS)
    expect(f.view.visible).toBe(false)
    f.setCursor({ x: 150, y: 150 })
    f.window.visible = false
    vi.advanceTimersByTime(HOVER_POLL_MS)
    expect(f.view.visible).toBe(false)
  })
})

describe('the bar channel', () => {
  it('takes the buttons only from the main frame of a bar view', () => {
    const f = make()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    f.send('lock', { id: 99_999, mainFrame: {} })
    const sender = f.view.webContents as unknown as { id: number; mainFrame: unknown }
    f.send('layer', sender, { name: 'child' })
    f.send('reset')
    expect(f.owner.toggle).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledTimes(3)
    f.send('lock')
    f.send('layer')
    expect(f.owner.toggle.mock.calls).toEqual([['sample', 'lock'], ['sample', 'layer']])
    warn.mockRestore()
  })

  it('sends the layer and the lock to the bar', () => {
    const f = make()
    const contents = f.view.webContents as unknown as { send: ReturnType<typeof vi.fn> }
    f.bar.setState({ layer: 'normal', locked: true })
    expect(contents.send).toHaveBeenCalledWith(WIDGET_BAR_IPC.state, { layer: 'normal', locked: true })
  })
})

describe('a drag on the handle', () => {
  it('follows the mouse from Electron main and ends with one last move', () => {
    vi.useFakeTimers()
    const f = make()
    f.setCursor({ x: 130, y: 110 })
    f.send('drag-start')
    f.setCursor({ x: 190, y: 155 })
    vi.advanceTimersByTime(DRAG_POLL_MS)
    expect(f.owner.drag).toHaveBeenLastCalledWith('sample', { x: 160, y: 145 }, false)
    f.setCursor({ x: 200, y: 160 })
    f.send('drag-end')
    expect(f.owner.drag).toHaveBeenLastCalledWith('sample', { x: 170, y: 150 }, true)
    const calls = f.owner.drag.mock.calls.length
    vi.advanceTimersByTime(DRAG_POLL_MS * 5)
    expect(f.owner.drag).toHaveBeenCalledTimes(calls)
  })

  it('does not start on a locked window', () => {
    vi.useFakeTimers()
    const f = make()
    f.owner.movable.mockReturnValue(false)
    f.send('drag-start')
    vi.advanceTimersByTime(DRAG_POLL_MS * 5)
    f.send('drag-end')
    expect(f.owner.drag).not.toHaveBeenCalled()
  })
})

describe('the bar protocol', () => {
  it('parses only known commands and states', () => {
    expect(['layer', 'lock', 'drag-start', 'drag-end'].map(parseBarCommand)).toEqual(['layer', 'lock', 'drag-start', 'drag-end'])
    expect([undefined, 'hide', 1, { kind: 'lock' }].map(parseBarCommand)).toEqual([undefined, undefined, undefined, undefined])
    expect(parseBarState({ layer: 'normal', locked: false })).toEqual({ layer: 'normal', locked: false })
    expect(parseBarState({ layer: 'desktop', locked: false })).toBeUndefined()
    expect(parseBarState({ layer: 'top', locked: 'yes' })).toBeUndefined()
  })
})

describe('the window place', () => {
  const area = { x: 0, y: 30, width: 1440, height: 870 }
  const displays = [{ x: 0, y: 0, width: 1440, height: 900 }]

  it('gives each layer its default column on the primary display', () => {
    expect(defaultPosition('top', 0, area, { width: 320, height: 300 })).toEqual({ x: WIDGET_GAP, y: 30 + WIDGET_GAP })
    expect(defaultPosition('normal', 1, area, { width: 320, height: 300 })).toEqual({ x: 1440 - 320 - WIDGET_GAP, y: 30 + WIDGET_GAP + 316 })
    expect(defaultPosition('top', 9, area, { width: 320, height: 300 }).y).toBe(30 + 870 - 300)
  })

  it('keeps a stored position on a display, and uses the default of the layer off the displays', () => {
    const data = { ...newWindowData(), position: { x: 500, y: 400 } }
    expect(placeWindow(data, 0, area, displays)).toEqual({ x: 500, y: 400 })
    expect(placeWindow({ ...data, position: { x: 3000, y: 400 } }, 0, area, displays)).toEqual({ x: WIDGET_GAP, y: 30 + WIDGET_GAP })
    expect(placeWindow({ ...data, layer: 'normal', position: undefined }, 0, area, displays)).toEqual({ x: 1440 - 320 - WIDGET_GAP, y: 30 + WIDGET_GAP })
  })

  it('counts a window that overlaps a display edge as on the display', () => {
    expect(touchesDisplay({ x: 1430, y: 10, width: 320, height: 300 }, displays)).toBe(true)
    expect(touchesDisplay({ x: 1440, y: 10, width: 320, height: 300 }, displays)).toBe(false)
    expect(touchesDisplay({ x: -320, y: 10, width: 320, height: 300 }, displays)).toBe(false)
  })

  it('gives a new widget the layer top, no lock, no position, 320 by 300, and no resize', () => {
    expect(newWindowData()).toEqual({ layer: 'top', locked: false, position: undefined, width: 320, height: 300, resizable: false })
  })
})
