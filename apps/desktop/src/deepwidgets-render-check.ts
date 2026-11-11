/**
 * deepWidgets render check (`agent_library.build_gate.render` in `docs/specs/agent-library.md`).
 * The Host asks for it over its IPC channel after it built the page of a widget bundle. Electron main loads the
 * built page in a hidden window of the widget size, 320 by 300, at a route that serves only the check:
 * `dsh-app://widget-check/widget/<slug>/`. The same origin answers the page channel from the test run of the Host
 * gates: the program, and the answer of each query. The page never reaches the live Host.
 * The check fails when a component throws, when the page does not reach `ready` in time, or when a page-state box
 * lost a `dw-core` style. A body with no height and content wider than the window are warnings.
 * @module deepwidgets-render-check
 */
import { readFile } from 'node:fs/promises'
import { extname, isAbsolute, resolve, sep } from 'node:path'
import { BrowserWindow } from 'electron'

/** The host name of the check route. The live widget route is `app`. */
export const RENDER_CHECK_HOST = 'widget-check'

const WIDTH = 320
const HEIGHT = 300
/** The page must reach `ready` in this time after its load. */
const READY_LIMIT_MS = 10_000
/** The wait after `ready`, so the query answers render and a component that throws on its data has thrown. */
const SETTLE_MS = 400
const POLL_MS = 100
const MAX_LINES = 5

/** The slug pattern of the Host runtime (`deepwidgets/widgets/src/index.ts`). */
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/u

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png',
}

/** One query answer of the test run. */
export type RenderAnswer = { readonly ok: true; readonly result: unknown } | { readonly ok: false; readonly message: string }

/** The check that the Host asks for (`RenderCheckRequest` of `deepwidgets/mcp/src/page-gate.ts`). */
export interface RenderCheckJob {
  readonly slug: string
  /** The absolute folder of the built page. */
  readonly pageDir: string
  readonly program: string
  readonly answers: Readonly<Record<string, RenderAnswer>>
  /** The `dw-core` block of the template. */
  readonly coreCss: string
}

/** The answer to the Host. Each diagnostic starts with its code. */
export interface RenderCheckResult {
  readonly ok: boolean
  readonly diagnostics: readonly string[]
  readonly warnings: readonly string[]
}

/**
 * Parse a check from the Host IPC channel at the boundary.
 * @param value - the `check` field of the IPC message.
 * @returns the check, or undefined when the shape is wrong.
 */
export function parseRenderCheckJob(value: unknown): RenderCheckJob | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const job = value as Record<string, unknown>
  const { slug, pageDir, program, answers, coreCss } = job
  if (typeof slug !== 'string' || !SLUG.test(slug) || typeof pageDir !== 'string' || !isAbsolute(pageDir)
    || typeof program !== 'string' || typeof coreCss !== 'string' || typeof answers !== 'object' || answers === null) return undefined
  const parsed: Record<string, RenderAnswer> = {}
  for (const [name, answer] of Object.entries(answers)) {
    if (typeof answer !== 'object' || answer === null) return undefined
    const item = answer as Record<string, unknown>
    if (item.ok === true) parsed[name] = { ok: true, result: item.result }
    else if (item.ok === false && typeof item.message === 'string') parsed[name] = { ok: false, message: item.message }
    else return undefined
  }
  return { slug, pageDir, program, answers: parsed, coreCss }
}

/** The diagnostics of the core in the page (`window.__dw` of `@deepwidgets/widget-kit`). */
interface PageDiagnostics {
  readonly state?: unknown
  readonly errors?: unknown
}

/** What the probe script gives. */
interface ProbeResult {
  readonly dw: PageDiagnostics | null
  readonly height: number
  readonly scrollWidth: number
  readonly innerWidth: number
  readonly lost: readonly string[]
}

/**
 * The probe: the page-state boxes of the core, once in the page and once in a shadow root with only the `dw-core`
 * block. Each box compares the computed values of the properties that `dw-core` sets on it. These values do not
 * depend on the layout, so a style of the agent that only moves a box does not fail the check.
 * @param coreCss - the `dw-core` block of the template.
 */
function probeScript(coreCss: string): string {
  const boxes = [
    { probe: 'dw-surface', props: ['background-color', 'border-top-left-radius', 'padding-top', 'padding-left', 'box-sizing'] },
    { probe: 'dw-state', props: ['display', 'flex-direction', 'row-gap', 'align-items', 'padding-top', 'color'] },
    { probe: 'dw-state strong', props: ['color', 'font-weight'] },
    { probe: 'dw-state--error', props: ['display', 'flex-direction', 'padding-top', 'color'] },
    { probe: 'dw-state--error strong', props: ['color', 'font-weight'] },
    { probe: 'dw-skeleton', props: ['height', 'border-top-left-radius', 'background-color'] },
  ]
  const markup = '<div class="dw-surface" data-probe="dw-surface">'
    + '<div class="dw-state" data-probe="dw-state"><strong data-probe="dw-state strong">x</strong><div class="dw-skeleton" data-probe="dw-skeleton"></div><div class="dw-skeleton"></div></div>'
    + '<div class="dw-state dw-state--error" data-probe="dw-state--error"><strong data-probe="dw-state--error strong">x</strong><span>y</span></div>'
    + '</div>'
  return `(() => {
  const boxes = ${JSON.stringify(boxes)}
  const markup = ${JSON.stringify(markup)}
  const body = document.body
  const height = body === null ? 0 : body.getBoundingClientRect().height
  const scrollWidth = document.documentElement.scrollWidth
  const make = () => { const box = document.createElement('div'); box.style.cssText = 'position:fixed;left:0;top:0;width:${String(WIDTH)}px;visibility:hidden;pointer-events:none'; (body ?? document.documentElement).append(box); return box }
  const light = make()
  light.innerHTML = markup
  const host = make()
  const shadow = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = ${JSON.stringify(coreCss)}
  shadow.append(style)
  shadow.append(document.createRange().createContextualFragment(markup))
  const lost = []
  for (const { probe, props } of boxes) {
    const have = getComputedStyle(light.querySelector('[data-probe="' + probe + '"]'))
    const want = getComputedStyle(shadow.querySelector('[data-probe="' + probe + '"]'))
    for (const prop of props) {
      const a = have.getPropertyValue(prop)
      const b = want.getPropertyValue(prop)
      if (a !== b) lost.push('.' + probe + ' ' + prop + ' is ' + a + ', the dw-core value is ' + b)
    }
  }
  light.remove()
  host.remove()
  return JSON.stringify({ dw: window.__dw ?? null, height, scrollWidth, innerWidth: window.innerWidth, lost })
})()`
}

const delay = (ms: number): Promise<void> => new Promise((done) => { setTimeout(done, ms) })
const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

/** Runs one render check at a time, and serves the check route of the running check. */
export class DesktopRenderCheck {
  private job: RenderCheckJob | undefined
  private queue: Promise<unknown> = Promise.resolve()
  private stopped = false
  private window: BrowserWindow | undefined

  /**
   * Run one check after the checks before it.
   * @param job - the check from the Host.
   * @returns the result for the Host. It never rejects.
   */
  run(job: RenderCheckJob): Promise<RenderCheckResult> {
    const next = this.queue.then(() => this.check(job)).catch((error: unknown): RenderCheckResult => ({
      ok: false, diagnostics: [`load-failed: ${error instanceof Error ? error.message : String(error)}`], warnings: [],
    }))
    this.queue = next
    return next
  }

  /** Stop at app quit: the running check ends with its window. */
  stop(): void {
    this.stopped = true
    if (this.window !== undefined && !this.window.isDestroyed()) this.window.destroy()
  }

  /**
   * Answer one request of the check route. Only the page and the page channel of the running check answer.
   * @param request - a request to `dsh-app://widget-check/`.
   */
  async handle(request: Request): Promise<Response> {
    const job = this.job
    if (job === undefined) return new Response(null, { status: 404 })
    const url = new URL(request.url)
    const api = `/api/widgets/${job.slug}/`
    if (url.pathname.startsWith(api)) return this.api(job, url.pathname.slice(api.length), request)
    const base = `/widget/${job.slug}/`
    if (!url.pathname.startsWith(base) || !['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 404 })
    let path: string
    try { path = decodeURIComponent(url.pathname.slice(base.length)) } catch { return new Response(null, { status: 400 }) }
    const root = resolve(job.pageDir)
    const target = resolve(root, path === '' ? 'index.html' : path)
    if (!target.startsWith(root + sep)) return new Response(null, { status: 403 })
    let body: Buffer
    try { body = await readFile(target) } catch { return new Response(null, { status: 404 }) }
    return new Response(request.method === 'HEAD' ? null : new Uint8Array(body), {
      headers: { 'content-type': MIME[extname(target)] ?? 'application/octet-stream', 'cache-control': 'no-store' },
    })
  }

  /** The page channel from the test run: the program, the query answers, and a stream that says only `hello`. */
  private async api(job: RenderCheckJob, route: string, request: Request): Promise<Response> {
    if (route === 'program' && request.method === 'GET') return json(200, { rev: 0, text: job.program })
    if (route === 'stream' && request.method === 'GET') {
      const hello = new TextEncoder().encode(`data: ${JSON.stringify({ type: 'hello', rev: 0, programRev: 0 })}\n\n`)
      // The stream stays open, so the page does not open it again. It ends with the window.
      const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(hello) } })
      return new Response(stream, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-store' } })
    }
    if (route === 'call' && request.method === 'POST') {
      const body = await request.json().catch(() => null) as { action?: unknown } | null
      const name = typeof body?.action === 'string' ? body.action : ''
      const answer = Object.hasOwn(job.answers, name) ? job.answers[name] : undefined
      if (answer === undefined) return json(404, { ok: false, error: { code: 'unknown-action', message: `the render check has no test-run answer for ${name}` } })
      if (!answer.ok) return json(500, { ok: false, error: { code: 'handler-error', message: answer.message } })
      return json(200, { ok: true, result: answer.result })
    }
    return new Response(null, { status: 404 })
  }

  private async check(job: RenderCheckJob): Promise<RenderCheckResult> {
    if (this.stopped) return { ok: false, diagnostics: ['load-failed: the app is quitting'], warnings: [] }
    this.job = job
    const window = new BrowserWindow({
      width: WIDTH,
      height: HEIGHT,
      useContentSize: true,
      frame: false,
      show: false,
      title: `deepWidgets render check ${job.slug}`,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, backgroundThrottling: false },
    })
    this.window = window
    const errors: string[] = []
    let gone: string | undefined
    window.webContents.on('console-message', (event) => {
      if (event.level === 'error') errors.push(event.message.split('\n')[0] ?? event.message)
    })
    window.webContents.on('render-process-gone', (_event, details) => { gone = details.reason })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => { event.preventDefault() })
    try {
      await window.loadURL(`dsh-app://${RENDER_CHECK_HOST}/widget/${job.slug}/?slug=${encodeURIComponent(job.slug)}`)
      return await this.judge(window, job, errors, () => gone)
    } finally {
      this.job = undefined
      this.window = undefined
      if (!window.isDestroyed()) window.destroy()
    }
  }

  private async judge(
    window: BrowserWindow, job: RenderCheckJob, errors: string[], gone: () => string | undefined,
  ): Promise<RenderCheckResult> {
    const uncaught = (): string[] => errors.filter(line => line.startsWith('Uncaught'))
    const until = Date.now() + READY_LIMIT_MS
    let state: unknown
    while (Date.now() < until && gone() === undefined && uncaught().length === 0) {
      const text: unknown = await window.webContents.executeJavaScript('JSON.stringify(window.__dw ?? null)')
      state = typeof text === 'string' ? (JSON.parse(text) as PageDiagnostics | null)?.state : undefined
      if (state === 'ready' || state === 'error') break
      await delay(POLL_MS)
    }
    const lost = gone()
    if (lost !== undefined) return { ok: false, diagnostics: [`render-error: the page renderer ended: ${lost}`], warnings: [] }
    if (state === 'ready') await delay(SETTLE_MS)
    const probeText: unknown = await window.webContents.executeJavaScript(probeScript(job.coreCss))
    const probe = JSON.parse(typeof probeText === 'string' ? probeText : 'null') as ProbeResult | null
    if (probe === null) return { ok: false, diagnostics: ['load-failed: the probe of the page gave no result'], warnings: [] }
    const pageErrors = Array.isArray(probe.dw?.errors) ? probe.dw.errors.filter((item): item is string => typeof item === 'string') : []
    const thrown = uncaught()
    const diagnostics: string[] = []
    // React and the page log one error more than once.
    const detail = [...new Set(errors)].slice(0, MAX_LINES).join(' | ')
    if (pageErrors.includes('runtime: render-error') || thrown.length > 0) {
      diagnostics.push(`render-error: a component threw while the page rendered the program of the test run${detail === '' ? '' : `: ${detail}`}`)
    } else if (state !== 'ready') {
      diagnostics.push(`not-ready: the page did not reach ready in ${String(READY_LIMIT_MS)} ms (state ${JSON.stringify(state ?? null)})${detail === '' ? '' : `: ${detail}`}`)
    }
    for (const line of probe.lost.slice(0, MAX_LINES)) diagnostics.push(`lost-core-styles: ${line}`)
    const warnings: string[] = []
    const other = pageErrors.filter(item => item !== 'runtime: render-error')
    if (other.length > 0) warnings.push(`the page reported program errors: ${other.slice(0, MAX_LINES).join(', ')}`)
    if (probe.height === 0) warnings.push('the body of the page has no height in the render check')
    if (probe.scrollWidth > probe.innerWidth) warnings.push(`the content of the page is ${String(probe.scrollWidth)} px wide, wider than the window (${String(probe.innerWidth)} px)`)
    return { ok: diagnostics.length === 0, diagnostics, warnings }
  }
}
