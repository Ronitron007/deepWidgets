/**
 * deepWidgets window place: the window data of one widget window and the place of the window on the screen
 * (`window_manager.data`, `window_manager.move`, and `window_manager.provisional` in `docs/specs/window-manager.md`).
 * The Host keeps the window data (`wm.store`). Electron main reads it from the frames of the events route, and sends
 * each operator choice back to the route `POST /api/widget-windows/<slug>`. A choice that waits for the Host wins over
 * the frames until the Host has it. The functions here are pure.
 * @module deepwidgets-window-place
 */
import type { WidgetLayer } from './deepwidgets-window-bar-protocol.ts'

/** A point in screen points. */
export interface ScreenPoint {
  readonly x: number
  readonly y: number
}

/** A rectangle in screen points, as `Electron.Rectangle`. */
export interface ScreenRect extends ScreenPoint {
  readonly width: number
  readonly height: number
}

/** The window data of one slug (`window_manager.terms`), without the shown state and `chosen`. */
export interface WidgetWindowData {
  layer: WidgetLayer
  locked: boolean
  /** The stored position. Undefined: the window sits at the default position. */
  position: ScreenPoint | undefined
  width: number
  height: number
  /** False: the window does not resize (`window_manager.move`). */
  resizable: boolean
}

/** The window data of one frame of the Host, with the shown state (`main_widget.window_state`). */
export interface HostWindowData extends WidgetWindowData {
  readonly shown: boolean
}

/**
 * An operator choice that Electron main did not get the Host to store yet (`window_manager.route`). Each field is one
 * change of the bar or of the window edges.
 */
export interface PendingChoice {
  readonly layer?: WidgetLayer
  readonly locked?: boolean
  readonly position?: ScreenPoint
  readonly size?: { readonly width: number; readonly height: number }
}

/** The size of a widget with no agent default (`window_manager.data`). */
export const WIDGET_WIDTH = 320
export const WIDGET_HEIGHT = 300
/** The limits of a width and a height, as `WINDOW_SIZE_MIN` and `WINDOW_SIZE_MAX` of `@deepwidgets/widgets`. */
export const WIDGET_SIZE_MIN = 80
export const WIDGET_SIZE_MAX = 4096
/** The space between the default column and the edge of the work area, and between two windows of the column. */
export const WIDGET_GAP = 16

/** The window data of a slug with no data from the Host: the defaults of `window_manager.data`. */
export function newWindowData(): WidgetWindowData {
  return { layer: 'top', locked: false, position: undefined, width: WIDGET_WIDTH, height: WIDGET_HEIGHT, resizable: false }
}

/** True for a width or a height that the Host can give. */
const isSize = (value: unknown): value is number =>
  Number.isInteger(value) && (value as number) >= WIDGET_SIZE_MIN && (value as number) <= WIDGET_SIZE_MAX

/**
 * Parse the window data of one frame at the boundary. A missing or bad field takes its default, so a frame of an older
 * Host, with only the shown state, gives the defaults.
 * @param value - the `window` object of a frame, or the entry of its slug in `windows` of a `hello`.
 * @param shown - the `shown` value of the frame, used when `value` has none.
 */
export function parseWindowData(value: unknown, shown: unknown): HostWindowData {
  const data = newWindowData()
  const frame = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
  const placed = Number.isSafeInteger(frame.x) && Number.isSafeInteger(frame.y)
  const position = placed ? { x: frame.x as number, y: frame.y as number } : undefined
  const sized = isSize(frame.width) && isSize(frame.height)
  return {
    shown: (frame.shown ?? shown) !== false,
    layer: frame.layer === 'normal' ? 'normal' : 'top',
    locked: frame.locked === true,
    position,
    width: sized ? frame.width as number : data.width,
    height: sized ? frame.height as number : data.height,
    resizable: frame.resizable === true,
  }
}

/**
 * The window data that a window shows: the data of the Host, with each choice that waits for the Host over it.
 * @param host - the window data of the last frame.
 * @param pending - the choices that the Host does not have yet.
 */
export function withPending(host: WidgetWindowData, pending: PendingChoice | undefined): WidgetWindowData {
  return {
    layer: pending?.layer ?? host.layer,
    locked: pending?.locked ?? host.locked,
    position: pending?.position ?? host.position,
    width: pending?.size?.width ?? host.width,
    height: pending?.size?.height ?? host.height,
    resizable: host.resizable,
  }
}

/**
 * The body of `POST /api/widget-windows/<slug>` for the choices of one send.
 * @param pending - the choices to send.
 */
export function choiceBody(pending: PendingChoice): Record<string, unknown> {
  return {
    ...(pending.layer === undefined ? {} : { layer: pending.layer }),
    ...(pending.locked === undefined ? {} : { locked: pending.locked }),
    ...(pending.position === undefined ? {} : { x: pending.position.x, y: pending.position.y }),
    ...(pending.size === undefined ? {} : { width: pending.size.width, height: pending.size.height }),
  }
}

/**
 * The choices that still wait after one send ended: a choice that changed after the send stays for the next send.
 * @param pending - the choices that wait now.
 * @param sent - the choices of the send.
 * @returns the choices that wait, or undefined for none.
 */
export function settleChoice(pending: PendingChoice | undefined, sent: PendingChoice): PendingChoice | undefined {
  if (pending === undefined) return undefined
  const same = (a: ScreenPoint | PendingChoice['size'] | undefined, b: typeof a): boolean => JSON.stringify(a) === JSON.stringify(b)
  const rest: { -readonly [K in keyof PendingChoice]: PendingChoice[K] } = {}
  if (pending.layer !== undefined && pending.layer !== sent.layer) rest.layer = pending.layer
  if (pending.locked !== undefined && pending.locked !== sent.locked) rest.locked = pending.locked
  if (pending.position !== undefined && !same(pending.position, sent.position)) rest.position = pending.position
  if (pending.size !== undefined && !same(pending.size, sent.size)) rest.size = pending.size
  return Object.keys(rest).length === 0 ? undefined : rest
}

/**
 * The default position (`window_manager.provisional`): the column at the left edge of the work area of the primary
 * display, for both layers. The row of the window gives its place in the column, and the last place stays on the work
 * area.
 * @param row - the place of the window in the column, from 0.
 * @param area - the work area of the primary display.
 * @param size - the size of the window.
 */
export function defaultPosition(row: number, area: ScreenRect, size: { readonly width: number; readonly height: number }): ScreenPoint {
  const x = area.x + WIDGET_GAP
  const y = Math.min(area.y + WIDGET_GAP + row * (size.height + WIDGET_GAP), area.y + area.height - size.height)
  return { x, y }
}

/**
 * True when the window rectangle overlaps at least one display.
 * @param window - the bounds of the window.
 * @param displays - the bounds of each display.
 */
export function touchesDisplay(window: ScreenRect, displays: readonly ScreenRect[]): boolean {
  return displays.some(display => window.x < display.x + display.width && display.x < window.x + window.width
    && window.y < display.y + display.height && display.y < window.y + window.height)
}

/**
 * The place of a window: its stored position when the window there touches a display, else the default position. A
 * move to the default position is not an operator choice, so the stored position stays.
 * @param data - the window data.
 * @param row - the place of the window in the default column.
 * @param area - the work area of the primary display.
 * @param displays - the bounds of each display.
 */
export function placeWindow(data: WidgetWindowData, row: number, area: ScreenRect, displays: readonly ScreenRect[]): ScreenPoint {
  const stored = data.position
  if (stored !== undefined && touchesDisplay({ ...stored, width: data.width, height: data.height }, displays)) return stored
  return defaultPosition(row, area, data)
}
