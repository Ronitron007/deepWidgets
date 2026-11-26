/**
 * deepWidgets window place: the window data of one widget window and the place of the window on the screen
 * (`window_manager.data`, `window_manager.move`, and `window_manager.provisional` in `docs/specs/window-manager.md`).
 * This unit keeps the window data in the memory of Electron main only. The functions here are pure.
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

/** The window data of one slug (`window_manager.terms`), without the shown state, which the Host keeps. */
export interface WidgetWindowData {
  layer: WidgetLayer
  locked: boolean
  /** The stored position. Undefined: the window sits at the default position of its layer. */
  position: ScreenPoint | undefined
  width: number
  height: number
  /** False: the window does not resize (`window_manager.move`). */
  readonly resizable: boolean
}

/** The size of a new widget (`window_manager.data`). */
export const WIDGET_WIDTH = 320
export const WIDGET_HEIGHT = 300
/** The space between a default column and the edge of the work area, and between two windows of one column. */
export const WIDGET_GAP = 16

/** The window data of a new widget. The next unit `wm.store` takes the agent defaults and the stored record. */
export function newWindowData(): WidgetWindowData {
  return { layer: 'top', locked: false, position: undefined, width: WIDGET_WIDTH, height: WIDGET_HEIGHT, resizable: false }
}

/**
 * The default position of a layer (`window_manager.provisional`): the column at the left edge of the work area of the
 * primary display for `top`, as before, and a column at its right edge for `normal`. The row of the window gives its
 * place in the column, and the last place stays on the work area.
 * @param layer - the layer of the window.
 * @param row - the place of the window in the column, from 0.
 * @param area - the work area of the primary display.
 * @param size - the size of the window.
 */
export function defaultPosition(layer: WidgetLayer, row: number, area: ScreenRect,
  size: { readonly width: number; readonly height: number }): ScreenPoint {
  const x = layer === 'top' ? area.x + WIDGET_GAP : area.x + area.width - size.width - WIDGET_GAP
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
 * The place of a window: its stored position when the window there touches a display, else the default position of
 * its layer. A move to the default position is not an operator choice, so the stored position stays.
 * @param data - the window data.
 * @param row - the place of the window in its default column.
 * @param area - the work area of the primary display.
 * @param displays - the bounds of each display.
 */
export function placeWindow(data: WidgetWindowData, row: number, area: ScreenRect, displays: readonly ScreenRect[]): ScreenPoint {
  const stored = data.position
  if (stored !== undefined && touchesDisplay({ ...stored, width: data.width, height: data.height }, displays)) return stored
  return defaultPosition(data.layer, row, area, data)
}
