/**
 * The preload of the bar of a widget window (`window_manager.bar`). The bar page has no script: this preload wires its
 * controls from the isolated world and sends each command on the bar channel. It exposes nothing to the main world.
 */
import { ipcRenderer } from 'electron'
import { parseBarState, WIDGET_BAR_IPC, type WidgetBarCommand, type WidgetBarState } from './deepwidgets-window-bar-protocol.ts'

let state: WidgetBarState | undefined

const send = (command: WidgetBarCommand): void => { ipcRenderer.send(WIDGET_BAR_IPC.command, command) }
const control = (name: string): HTMLElement | null => document.querySelector<HTMLElement>(`[data-bar="${name}"]`)

/** Show the layer and the lock of the window on the bar. */
function apply(): void {
  const bar = document.querySelector<HTMLElement>('[data-deepwidgets-bar]')
  if (bar === null || state === undefined) return
  bar.dataset.layer = state.layer
  bar.dataset.locked = String(state.locked)
  const layer = control('layer')
  layer?.setAttribute('title', state.layer === 'top' ? 'On top of other windows. Click for the normal layer.' : 'Normal layer. Click to keep on top.')
  layer?.setAttribute('aria-pressed', String(state.layer === 'top'))
  const lock = control('lock')
  lock?.setAttribute('title', state.locked ? 'Locked. Click to unlock.' : 'Click to lock the position.')
  lock?.setAttribute('aria-pressed', String(state.locked))
  control('handle')?.setAttribute('title', state.locked ? 'Locked' : 'Drag to move')
}

ipcRenderer.on(WIDGET_BAR_IPC.state, (_event, value: unknown) => {
  state = parseBarState(value) ?? state
  apply()
})

window.addEventListener('DOMContentLoaded', () => {
  control('layer')?.addEventListener('click', () => { send('layer') })
  control('lock')?.addEventListener('click', () => { send('lock') })
  const handle = control('handle')
  handle?.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    // The capture keeps the release in the bar when the mouse leaves it during the drag.
    try { handle.setPointerCapture(event.pointerId) } catch { /* a pointer that is not active has no capture */ }
    send('drag-start')
  })
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) handle?.addEventListener(type, () => { send('drag-end') })
  apply()
})
