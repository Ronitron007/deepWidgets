/** The sends of the operator choices of the widget windows (window_manager.route), with a fake of Electron. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn(),
  WebContentsView: vi.fn(),
  ipcMain: { on: vi.fn() },
  screen: { getCursorScreenPoint: () => ({ x: 0, y: 0 }) },
}))

const { DesktopWidgetWindows } = await import('../src/deepwidgets-windows.ts')

type Outcome = 'stored' | 'refused' | 'later'
interface Target { url: string; cookie: string }
/** The parts of the windows module that the sends use. */
interface Sends {
  target: Target | undefined
  listed: Set<string>
  pending: Map<string, unknown>
  flush(slug: string): void
  send(target: Target, slug: string, choice: unknown): Promise<Outcome>
}

describe('a choice that waits for the Host', () => {
  it('goes to the next Host at once when a send to a Host that is gone ends after the swap (retry_lost_across_host_swap)', async () => {
    const windows = new DesktopWidgetWindows() as unknown as Sends
    windows.target = { url: 'http://127.0.0.1:1/', cookie: 'old' }
    windows.listed.add('sample')
    windows.pending.set('sample', { layer: 'normal' })
    const sent: string[] = []
    let release: (outcome: Outcome) => void = () => {}
    windows.send = vi.fn((target: Target) => {
      sent.push(target.url)
      return sent.length === 1 ? new Promise<Outcome>((resolve) => { release = resolve }) : Promise.resolve<Outcome>('stored')
    })
    windows.flush('sample')
    // The next Host is ready while the send to the old Host is in progress. Its hello finds that send.
    windows.target = { url: 'http://127.0.0.1:2/', cookie: 'new' }
    windows.flush('sample')
    expect(sent).toEqual(['http://127.0.0.1:1/'])
    release('later')
    await vi.waitFor(() => { expect(sent).toEqual(['http://127.0.0.1:1/', 'http://127.0.0.1:2/']) }, { timeout: 500 })
    await vi.waitFor(() => { expect(windows.pending.has('sample')).toBe(false) }, { timeout: 500 })
  })

  it('keeps the choice while no Host is ready', async () => {
    const windows = new DesktopWidgetWindows() as unknown as Sends
    windows.target = { url: 'http://127.0.0.1:1/', cookie: 'old' }
    windows.listed.add('sample')
    windows.pending.set('sample', { locked: true })
    let release: (outcome: Outcome) => void = () => {}
    const send = vi.fn(() => new Promise<Outcome>((resolve) => { release = resolve }))
    windows.send = send
    windows.flush('sample')
    windows.target = undefined
    release('later')
    await new Promise((resolve) => { setTimeout(resolve, 50) })
    expect(send).toHaveBeenCalledTimes(1)
    expect(windows.pending.get('sample')).toEqual({ locked: true })
  })
})
