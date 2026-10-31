/**
 * The child of the test run gate (`widget_phase2.creation.gates`). It loads one compiled widget
 * bundle into a bare Cordis context with the real timer service and a stand-in `widgets` service.
 * It runs `apply`, calls each action once, and lets timers run for the window.
 *
 * Protocol on stdout, one line each: `HB` (heartbeat every 100 ms), `STEP <what>`, and at the end
 * `RESULT <json>` ({@link TestRunReport}). The parent kills the child when the heartbeat stops.
 *
 * Usage: `<node> --max-old-space-size=256 testrun-child.js <bundle.js> <windowMs>`
 * @module @deepwidgets/mcp/testrun-child
 */
import { pathToFileURL } from 'node:url'
import { Context, Service } from '@deepseek-ai/cordis'
import { TimerService } from '@deepseek-ai/cordis-plugin-timer'

/** One widget that the bundle registered. */
export interface TestRunWidget {
  slug: string
  title: string
  program: string
}

/** One action call of the test run. */
export interface TestRunAction {
  slug: string
  name: string
  outcome: 'ok' | 'threw' | 'skipped'
  message?: string
}

/** The `RESULT` line. */
export interface TestRunReport {
  applyError: string | null
  widgets: TestRunWidget[]
  actions: TestRunAction[]
  /** Uncaught exceptions and unhandled rejections: each one would end the host. */
  faults: { kind: 'uncaught-exception' | 'unhandled-rejection', message: string }[]
}

/** The rules of `buildRegistration` in `@deepwidgets/widgets`. */
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/
const ACTION = /^[A-Za-z][A-Za-z0-9_]{0,62}$/
const ACTION_LIMIT_MS = 1_000
const APPLY_LIMIT_MS = 1_000

interface ZodLike {
  safeParse(value: unknown): { success: true, data: unknown } | { success: false, error: unknown }
}

interface ActionDef {
  name: string
  kind: 'query' | 'mutation'
  args?: ZodLike
  timeoutMs?: number
  handler(args: unknown, w: unknown): unknown
}

interface WidgetDefLike {
  slug: string
  title: string
  program: string
  initialState: unknown
  timeoutMs?: number
  actions: ActionDef[]
}

const textOf = (error: unknown): string => (error instanceof Error ? error.message : String(error)).slice(0, 300)
const out = (line: string): void => { process.stdout.write(`${line}\n`) }

/** Check a definition as the runtime does. Throws `TypeError` with the runtime text. */
function checkDefinition(def: WidgetDefLike): void {
  if (typeof def.slug !== 'string' || !SLUG.test(def.slug)) throw new TypeError(`widgets: bad slug ${JSON.stringify(def.slug)}`)
  if (typeof def.title !== 'string' || def.title === '') throw new TypeError(`widgets: ${def.slug}: title is required`)
  if (typeof def.program !== 'string') throw new TypeError(`widgets: ${def.slug}: program text is required`)
  if (!Array.isArray(def.actions)) throw new TypeError(`widgets: ${def.slug}: actions must be an array`)
  if (def.timeoutMs !== undefined && !(Number.isFinite(def.timeoutMs) && def.timeoutMs > 0)) throw new TypeError(`widgets: ${def.slug}: timeoutMs must be positive`)
  const names = new Set<string>()
  for (const action of def.actions) {
    if (typeof action.name !== 'string' || !ACTION.test(action.name)) throw new TypeError(`widgets: ${def.slug}: bad action name ${JSON.stringify(action.name)}`)
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- the definition comes from untyped widget code.
    if (action.kind !== 'query' && action.kind !== 'mutation') throw new TypeError(`widgets: ${def.slug}.${action.name}: kind must be query or mutation`)
    if (typeof action.handler !== 'function') throw new TypeError(`widgets: ${def.slug}.${action.name}: handler must be a function`)
    if (action.args !== undefined && typeof action.args.safeParse !== 'function') throw new TypeError(`widgets: ${def.slug}.${action.name}: args must be a zod schema`)
    if (action.timeoutMs !== undefined && !(Number.isFinite(action.timeoutMs) && action.timeoutMs > 0)) throw new TypeError(`widgets: ${def.slug}.${action.name}: timeoutMs must be positive`)
    if (names.has(action.name)) throw new TypeError(`widgets: ${def.slug}: action ${action.name} repeats`)
    names.add(action.name)
  }
}

/** The stand-in `widgets` service: it keeps the definitions and the state in memory. */
class StandInWidgets extends Service {
  readonly defs: WidgetDefLike[] = []
  readonly states = new Map<string, unknown>()

  constructor(ctx: Context) {
    super(ctx, 'widgets')
  }

  register(def: WidgetDefLike): () => Promise<void> {
    checkDefinition(def)
    if (this.states.has(def.slug)) throw new Error(`widgets: the slug ${def.slug} already has a live registration`)
    this.defs.push(def)
    this.states.set(def.slug, def.initialState ?? null)
    return () => Promise.resolve()
  }

  update(slug: string, fn: (state: unknown) => unknown): Promise<unknown> {
    if (!this.states.has(slug)) return Promise.reject(new Error(`no widget ${JSON.stringify(slug)}`))
    try {
      const next = fn(this.states.get(slug))
      if (next instanceof Promise) throw new TypeError('widgets: the update function must be synchronous')
      this.states.set(slug, next)
      return Promise.resolve(next)
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }
}

async function callAction(widgets: StandInWidgets, def: WidgetDefLike, action: ActionDef): Promise<TestRunAction> {
  const base = { slug: def.slug, name: action.name }
  let args: unknown = {}
  if (action.args !== undefined) {
    const parsed = action.args.safeParse({})
    if (!parsed.success) return { ...base, outcome: 'skipped', message: 'its args schema refuses {}, so the test run did not call it' }
    args = parsed.data
  }
  const scope = {
    get state() { return widgets.states.get(def.slug) },
    update: (fn: (state: unknown) => unknown) => action.kind === 'mutation'
      ? widgets.update(def.slug, fn)
      : Promise.reject(new Error(`the query ${action.name} cannot write`)),
    signal: AbortSignal.timeout(ACTION_LIMIT_MS),
  }
  let timer: NodeJS.Timeout | undefined
  try {
    await Promise.race([
      Promise.resolve().then(() => action.handler(args, scope)),
      new Promise((_resolve, reject) => { timer = setTimeout(() => { reject(new Error(`no answer in ${String(ACTION_LIMIT_MS)} ms`)) }, ACTION_LIMIT_MS) }),
    ])
    return { ...base, outcome: 'ok' }
  } catch (error) {
    return { ...base, outcome: 'threw', message: textOf(error) }
  } finally {
    clearTimeout(timer)
  }
}

async function main(): Promise<void> {
  const [file, windowArg] = process.argv.slice(2)
  if (file === undefined) throw new Error('usage: testrun-child.js <bundle.js> <windowMs>')
  const windowMs = Number(windowArg ?? 1500)
  const report: TestRunReport = { applyError: null, widgets: [], actions: [], faults: [] }
  process.on('uncaughtException', (error) => { report.faults.push({ kind: 'uncaught-exception', message: textOf(error) }) })
  process.on('unhandledRejection', (error) => { report.faults.push({ kind: 'unhandled-rejection', message: textOf(error) }) })
  setInterval(() => { out('HB') }, 100).unref()

  const root = new Context()
  await root.plugin(TimerService)
  await root.plugin(StandInWidgets)
  const widgets = root.get('widgets') as StandInWidgets | undefined
  if (widgets === undefined) throw new Error('the stand-in widgets service did not start')
  out('STEP apply')
  try {
    const plugin = await import(pathToFileURL(file).href) as Record<string, unknown>
    let timer: NodeJS.Timeout | undefined
    // A plugin that injects a service other than widgets and timer stays pending and never loads.
    const pending = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => { reject(new Error(`apply did not run in ${String(APPLY_LIMIT_MS)} ms. Inject only ['widgets', 'timer'], and do not wait in apply.`)) }, APPLY_LIMIT_MS)
    })
    try {
      await Promise.race([root.plugin(plugin as unknown as { apply: (ctx: Context) => void }), pending])
    } finally {
      clearTimeout(timer)
    }
  } catch (error) {
    report.applyError = textOf(error)
  }
  for (const def of widgets.defs) {
    report.widgets.push({ slug: def.slug, title: def.title, program: def.program })
    for (const action of def.actions) {
      out(`STEP action ${def.slug}.${action.name}`)
      report.actions.push(await callAction(widgets, def, action))
    }
  }
  out('STEP timers')
  await new Promise((resolve) => { setTimeout(resolve, windowMs) })
  out(`RESULT ${JSON.stringify(report)}`)
  process.exit(0)
}

main().catch((error: unknown) => {
  process.stderr.write(`testrun-child: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`)
  process.exit(2)
})
