/**
 * deepWidgets window bar protocol: the IPC channel between the bar of a widget window and Electron main
 * (`window_manager.bar` in `docs/specs/window-manager.md`). The bar preload and Electron main both import this module,
 * so it imports nothing.
 * @module deepwidgets-window-bar-protocol
 */

/** The channels of the bar. Only the webContents of a bar view may send on `command`. */
export const WIDGET_BAR_IPC = { command: 'deepwidgets-bar:command', state: 'deepwidgets-bar:state' } as const

/** The layer of a widget window (`window_manager.terms`). */
export type WidgetLayer = 'top' | 'normal'

/**
 * One message of the bar to Electron main. `layer` and `lock` are clicks on the two buttons. `drag-start` and
 * `drag-end` frame one drag on the handle: Electron main reads the mouse itself while the drag lasts.
 */
export type WidgetBarCommand = 'layer' | 'lock' | 'drag-start' | 'drag-end'

/** What the bar shows: the layer and the lock of its window. */
export interface WidgetBarState {
  readonly layer: WidgetLayer
  readonly locked: boolean
}

const COMMANDS: ReadonlySet<unknown> = new Set<WidgetBarCommand>(['layer', 'lock', 'drag-start', 'drag-end'])

/**
 * Parse one message of the bar at the boundary.
 * @param value - the argument of the IPC message.
 * @returns the command, or undefined for any other value.
 */
export function parseBarCommand(value: unknown): WidgetBarCommand | undefined {
  return COMMANDS.has(value) ? value as WidgetBarCommand : undefined
}

/**
 * Parse one state message of Electron main in the bar.
 * @param value - the argument of the IPC message.
 * @returns the state, or undefined for any other value.
 */
export function parseBarState(value: unknown): WidgetBarState | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { layer, locked } = value as { layer?: unknown; locked?: unknown }
  if ((layer !== 'top' && layer !== 'normal') || typeof locked !== 'boolean') return undefined
  return { layer, locked }
}
