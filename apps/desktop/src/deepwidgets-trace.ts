/**
 * deepWidgets trace: the start-up steps of Electron main for `POST /api/trace`.
 * The spec is `floating_widget.sources` in `docs/specs/floating-widget.md`.
 * @module deepwidgets-trace
 */

/** Names of the start-up steps that Electron main sends. */
export type DesktopTraceStepName = 'app-ready' | 'host-started' | 'host-ready' | 'main-window-open'

/** One `step` message of `floating_widget.message`, before the Host sets its `seq`. */
interface DesktopTraceStep {
  readonly time: number
  readonly process: 'main'
  readonly kind: 'step'
  readonly name: DesktopTraceStepName
  readonly state: 'done'
}

/** The ready Host that receives the steps. */
interface DesktopTraceTarget {
  readonly url: string
  readonly cookie: string
}

/**
 * Post one batch to `POST /api/trace` of the Host. A failure writes one warning and never rejects.
 * @param target - Host URL and Host cookie.
 * @param batch - steps in record order.
 */
async function sendSteps(target: DesktopTraceTarget, batch: readonly DesktopTraceStep[]): Promise<void> {
  try {
    const response = await fetch(new URL('/api/trace', target.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: target.cookie },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(5000),
    })
    await response.body?.cancel()
    if (!response.ok) console.warn(`deepwidgets-trace: POST /api/trace answered ${String(response.status)}`)
  } catch (error) {
    console.warn('deepwidgets-trace: POST /api/trace failed', error)
  }
}

/**
 * Keep each start-up step, and post the steps to the ready Host in record order.
 * Each Host that becomes ready gets all kept steps, so a restarted Host also gets them.
 */
export class DesktopTraceSteps {
  private readonly steps: DesktopTraceStep[] = []
  private target: DesktopTraceTarget | undefined
  private queue: Promise<void> = Promise.resolve()

  /**
   * Record one step. Post it at once when a Host is ready.
   * @param name - step name.
   */
  step(name: DesktopTraceStepName): void {
    const step: DesktopTraceStep = { time: Date.now(), process: 'main', kind: 'step', name, state: 'done' }
    this.steps.push(step)
    if (this.target !== undefined) this.post(this.target, [step])
  }

  /**
   * Record `host-ready`, then post every kept step to this Host.
   * @param url - Host URL from the ready event.
   * @param cookie - Host cookie from `authenticateWebHost`.
   */
  hostReady(url: string, cookie: string): void {
    this.target = undefined
    this.step('host-ready')
    this.target = { url, cookie }
    this.post(this.target, [...this.steps])
  }

  /** Stop posting until the next Host is ready. */
  hostGone(): void {
    this.target = undefined
  }

  private post(target: DesktopTraceTarget, batch: readonly DesktopTraceStep[]): void {
    this.queue = this.queue.then(() => sendSteps(target, batch))
  }
}
