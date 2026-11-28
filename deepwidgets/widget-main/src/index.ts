/**
 * The main widget (`main_widget.widget`): the built-in widget with the slug `main`. The panel under the menu bar icon is
 * its only window, so Electron main opens no widget window for it, and the MCP server does not show it to agents.
 *
 * Its actions are the host half of the Widgets tab (`main_widget.widgets`): the query `widgets` lists each other widget,
 * also a widget that is turned off or that safe mode keeps off. The mutations `turnOff` and `turnOn` change the plugin
 * rows of a widget through the DSH plugin manager, in the queue of the installer (the service `widgetInstaller` of
 * `@deepwidgets/mcp`). The installer keeps a Turn off, so a later `widget_install` or `widget_reload` of the slug installs
 * the new row off. The mutation `remove` removes an agent widget through the remove path of `widget_remove`. The state of
 * a widget stays in each case. The mutations `show` and `hide` store the shown state of the widget window of a slug
 * (`main_widget.window_state`). The runtime keeps it across Host starts, and Electron main obeys it. The mutations
 * `setLayer`, `setLock`, and `resetPosition` store an operator choice of the layer, the lock, or the position of that
 * window (`window_manager.panel`), with the write of the window route of the bar.
 *
 * The plugin manager, the installer, the install records, and the MCP settings are host code. The actions call them
 * through `widgetRecords.asHost`, so those calls run outside the store and the watchdog slot of this row: a crash or a
 * stall in them is not blamed on this widget. The other code of each action runs in its call, so a loop there is blamed
 * on this widget within 2 s (as_host_covers_main_handlers, decision `widget.watchdog_rule`).
 *
 * The query `settings` and the mutations `setMode` and `setLoginItem` are the host half of the Settings tab
 * (`main_widget.settings`). The modes and the port come from the service `mcpSettings` of `@deepwidgets/mcp`, which
 * reads the files that the MCP tools read. The launch-at-login switch goes to Electron main over the IPC channel of the
 * host (the message `deepwidgets-login-item`), because the page talks only to the host. Electron main sets the login
 * item and reads its status back; a dev run sets nothing.
 *
 * The kit section of the Settings tab (`kit.pane`) reads `snapshot()` of the service `kit` of `@deepwidgets/kit`, which
 * never waits for the kit start, and the refuse list of `mcpSettings`. The mutations `kitAdd` and `kitRemove` start one
 * change of the kit and answer at once, because pnpm can run longer than the limit of an action: the kit keeps the result
 * in `last`, and the page reads it there. The mutation `setRefuseBuilds` writes `kit.refuseBuilds` through `mcpSettings`,
 * the only writer of the settings file.
 *
 * An action that refuses gives a {@link MainRefusal} as its result, with a code, so the page routes by the code. Only a
 * defect throws: the call then gives `handler-error`.
 * @module @deepwidgets/widget-main
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ChangeResult, PluginInfo } from '@deepseek-ai/dsh-plugin-manager'
import type { KitChange, KitChangeTarget, KitErrorCode, KitState } from '@deepwidgets/kit'
import type { CreationErrorCode, ModeSettings, PortSetting, RefuseBuildsSetting, SetModeRefusal, SetRefuseBuildsRefusal } from '@deepwidgets/mcp'
import type { WidgetActionDescription, WidgetDescription, WindowChange, WindowData } from '@deepwidgets/widgets'
import { z } from 'zod'

export const name = 'deepwidgets-widget-main'
export const inject = ['widgets', 'widgetRecords']

/**
 * The slugs that this built-in bundle registers. The widget runtime reads them to reserve them, also while the row
 * is off (`widget.builtin_slugs`). It is `MAIN_SLUG` of `@deepwidgets/widgets`.
 */
export const widgetSlugs = ['main'] as const

/** The component set of the page of the main widget (`main_widget.catalog`). The default shell page refuses it. */
export const CATALOG = 'deepwidgets-main@1'

/**
 * The program of the panel page (`main_widget.widgets`, `main_widget.settings`), in the component set {@link CATALOG}
 * of the shell entry `main.html`. The query `widgets` feeds the Widgets tab, and the query `settings` feeds the
 * Settings tab. Their defaults are null, so the page shows a loading state, not an empty list. The row controls of
 * `WidgetTable` call `show`, `hide`, `setLayer`, `setLock`, `resetPosition`, `turnOff`, `turnOn`, `remove`, and
 * `program` with the slug of the row, then run `refresh`. The switches of `ModeSwitches` and `LaunchAtLogin` call `setMode` and `setLoginItem`, then run `refresh`. The controls of
 * `WidgetKit` call `kitAdd`, `kitRemove`, and `setRefuseBuilds`, then run `refresh`, and `WidgetKit` runs `refresh` each
 * second while a change of the kit runs (`kit.pane.actions`). The runtime also sends a `data` frame to the page of main
 * on each change of another widget, and the page then runs each query.
 */
export const PROGRAM = `root = Panel("deepWidgets", [widgetsTab, settingsTab])
widgetsTab = Tab("Widgets", [WidgetTable(w.widgets, Action([@Run(w)]))])
settingsTab = Tab("Settings", [ModeSwitches(s.modes, Action([@Run(s)])), WidgetKit(s.kit, Action([@Run(s)])), ApprovedAgents(), McpPort(s.port), LaunchAtLogin(s.loginItem, Action([@Run(s)]))])
w = Query("widgets", {}, {widgets: null})
s = Query("settings", {}, {modes: null, port: null, loginItem: null, kit: null})
`

/** The time limit of an action that changes a plugin row. A remove runs pnpm in the profile. */
const CHANGE_TIMEOUT_MS = 60_000

/** The Loader row ids of widget code, with the slug (`widget_phase2.creation.rows`): agent rows and built-in rows. */
const WIDGET_ROW = /^deepwidgets-(?:agent|widget)-([a-z0-9][a-z0-9-]*?)(?:\.b)?$/
const AGENT_ROW = /^deepwidgets-agent-/

/** The status of one widget in the Widgets tab. */
export type MainWidgetStatus =
  | { kind: 'live' }
  /** Quarantined after a crash (`widget_phase2.isolation.blame`), or its row did not register the widget. */
  | { kind: 'failed', reason: string }
  | { kind: 'safe-mode', message: string }
  /** The operator turned each plugin row of the widget off. */
  | { kind: 'turned-off' }

/** One plugin row of a widget. */
export interface MainWidgetRow {
  /** The row id, without the ids of its groups. */
  id: string
  /** The Loader entry id, as the plugin manager names the row. */
  entryId: string
  /** The package name. */
  name: string
  enabled: boolean
}

/** One row of the Widgets tab (`main_widget.widgets`). A field that needs a live widget is absent when it is not live. */
export interface MainWidget {
  slug: string
  /** Absent for a widget that is turned off: only the live definition has the title. */
  title?: string
  status: MainWidgetStatus
  /** True for a widget that `widget_install` installed. Only an agent widget can be removed. */
  agent: boolean
  /** The component set of the program. Live widgets only. */
  catalog?: string
  /** The stored state and its rev. Absent when storage has no state for the slug. */
  state?: { rev: number, data: unknown }
  /** The stored program rev. The query `program` gives the text. Absent when storage has no program. */
  program?: { rev: number }
  /** The actions with their kind, args JSON Schema, and timeout. Live widgets only. */
  actions?: WidgetActionDescription[]
  /** The folder that an agent widget was installed from (`modes.source`). */
  source?: string
  /** The plugin rows of the widget. An agent widget can have two during a replace (`widget_fv.replace`). */
  rows: MainWidgetRow[]
  /**
   * True when each plugin row of the widget is off. With the status `turned-off` it is always true. In safe mode, the
   * status of an agent widget stays `safe-mode`, and this field shows the Turn off.
   */
  turnedOff?: true
  /**
   * A live or failed widget has a widget window, which shows or is hidden (`main_widget.window_state`). Absent for a
   * widget with no window: it is turned off, or safe mode keeps it off.
   */
  window?: 'shown' | 'hidden'
  /**
   * window_manager.panel: the whole window data of the widget window, with `chosen`. The row shows its layer, its lock,
   * and its position. `x` and `y` are absent when no position is stored: the window is at the default position. Present
   * when `window` is.
   */
  windowData?: WindowData
}

const slugInput = z.object({ slug: z.string() })
const layerInput = z.object({ slug: z.string(), layer: z.enum(['top', 'normal']) })
const lockInput = z.object({ slug: z.string(), locked: z.boolean() })
const modeInput = z.object({ mode: z.string(), on: z.boolean() })
const loginItemInput = z.object({ open: z.boolean() })
const kitAddInput = z.object({ spec: z.string() })
const kitRemoveInput = z.object({ name: z.string() })
const refuseBuildsInput = z.object({ names: z.array(z.string()) })

/** The status of the login item that macOS gives (`main_widget.settings`). Same values as `apps/desktop/src/deepwidgets-login-item.ts`. */
export type LoginItemStatus = 'enabled' | 'requires-approval' | 'not-registered' | 'not-found'

/**
 * The launch-at-login switch as Electron main reads it back. Same shape as `apps/desktop/src/deepwidgets-login-item.ts`.
 * `settable` is false in a dev run and on a platform with no login item: the switch is then off and disabled, and
 * `blocked` tells why. `status` is absent when macOS gives none.
 */
const loginItemSchema = z.object({
  settable: z.boolean(),
  blocked: z.enum(['dev-run', 'platform']).optional(),
  openAtLogin: z.boolean(),
  status: z.enum(['enabled', 'requires-approval', 'not-registered', 'not-found']).optional(),
})
export type LoginItemSetting = z.infer<typeof loginItemSchema>

/** The code of a refusal of Electron main for the login item. */
type LoginItemRefusal = 'dev-run' | 'platform' | 'login-item-failed'

/** The answer of Electron main, parsed at this boundary. */
const loginItemAnswerSchema = z.union([
  z.object({ ok: z.literal(true), item: loginItemSchema }),
  z.object({ ok: z.literal(false), code: z.enum(['dev-run', 'platform', 'login-item-failed']), message: z.string() }),
])
type LoginItemAnswer = z.infer<typeof loginItemAnswerSchema> | { ok: false, code: 'unavailable', message: string }

/** The IPC message of the login item between the host and Electron main, with the same `callId` in the answer. */
const LOGIN_ITEM_MESSAGE = 'deepwidgets-login-item'
/**
 * The time limit of the actions `settings` and `setLoginItem`. It is the default action limit of the runtime, written
 * here so that {@link LOGIN_ITEM_LIMIT_MS} stays below it.
 */
const SETTINGS_TIMEOUT_MS = 5_000
/**
 * Electron main answers at once; it reads the status with one synchronous call. The wait ends well before
 * {@link SETTINGS_TIMEOUT_MS} (login_limit_equals_action_limit): when Electron main does not answer, the query
 * `settings` still gives the modes and the port with the login item as unknown, and `setLoginItem` gives
 * `login-item-failed`, not a `timeout` of the whole action.
 */
const LOGIN_ITEM_LIMIT_MS = 2_000

/**
 * Ask Electron main for the login item: read it (`open` null), or set it and read it back. A host with no IPC channel,
 * such as a CLI host, has no Electron main and no login item.
 */
function askLoginItem(next: { id: number }, open: boolean | null): Promise<LoginItemAnswer> {
  return new Promise((resolve) => {
    if (!process.connected || process.send === undefined) {
      resolve({ ok: false, code: 'unavailable', message: 'this host has no Electron main, so it has no login item' })
      return
    }
    const callId = next.id++
    const listen = (message: unknown): void => {
      const value = message as { type?: unknown, callId?: unknown, answer?: unknown } | null
      if (typeof value !== 'object' || value === null || value.type !== LOGIN_ITEM_MESSAGE || value.callId !== callId) return
      done()
      const parsed = loginItemAnswerSchema.safeParse(value.answer)
      resolve(parsed.success ? parsed.data : { ok: false, code: 'login-item-failed', message: `Electron main gave an answer in a shape that the host can not read: ${z.prettifyError(parsed.error)}` })
    }
    const timer = setTimeout(() => {
      done()
      resolve({ ok: false, code: 'login-item-failed', message: `Electron main did not answer in ${String(LOGIN_ITEM_LIMIT_MS)} ms; the login item is unknown` })
    }, LOGIN_ITEM_LIMIT_MS)
    function done(): void {
      clearTimeout(timer)
      process.off('message', listen)
    }
    process.on('message', listen)
    process.send({ type: LOGIN_ITEM_MESSAGE, callId, open }, (error: Error | null) => {
      if (error === null) return
      done()
      resolve({ ok: false, code: 'login-item-failed', message: `the host could not ask Electron main: ${error.message}` })
    })
  })
}

/**
 * The part `kit` of the query `settings` (`kit.pane.actions`): the snapshot of the kit, and the refuse list as an answer
 * of its own. The refuse list refuses with no `mcpSettings` or with a settings file that does not parse, and the rest
 * of the part still shows.
 */
export type MainKit = KitState & { refuseBuilds: MainAnswer<RefuseBuildsSetting> }

/** The answer of the query `settings`: one part for each section of the Settings tab that the host fills. */
export interface MainSettings {
  modes: MainAnswer<ModeSettings>
  /** A refusal with the code `unavailable` when the host has no service `kit`: the section shows only its message. */
  kit: MainAnswer<MainKit>
  port: MainAnswer<PortSetting>
  loginItem: MainAnswer<LoginItemSetting>
}

/**
 * The code of a refusal of an action of `main`. The codes of the installer come from the remove path of `widget_remove`.
 * `kit-busy` and the codes of the kit come from `kitAdd` and `kitRemove`.
 */
export type MainRefusalCode = 'unknown-widget' | 'built-in' | 'no-row' | 'no-window' | 'unavailable' | 'change-failed' | CreationErrorCode
  | SetModeRefusal | LoginItemRefusal | KitErrorCode | 'kit-busy' | SetRefuseBuildsRefusal

/** A refusal of an action of `main`: the result of the action, so that the page routes by `code`, not by the message. */
export interface MainRefusal {
  ok: false
  code: MainRefusalCode
  message: string
  /** The diagnostics of the plugin manager or of the installer, for example the output of pnpm. */
  diagnostics?: string[]
  /** What the operator can do next, from the installer. */
  nextStep?: string
}

/** The answer of an action that can refuse. */
export type MainAnswer<T> = ({ ok: true } & T) | MainRefusal

/** Carries a refusal from the body of an action to {@link answer}. */
class Refused extends Error {
  constructor(readonly refusal: MainRefusal) {
    super(refusal.message)
    this.name = 'MainRefused'
  }
}

function refuse(code: MainRefusalCode, message: string, extra: { diagnostics?: string[], nextStep?: string } = {}): never {
  throw new Refused({ ok: false, code, message, ...extra })
}

/** Run the body of an action. A refusal becomes the result. Any other error is a defect and stays an error. */
async function answer<T extends object>(body: () => Promise<T>): Promise<MainAnswer<T>> {
  try {
    return { ok: true, ...(await body()) }
  } catch (error) {
    if (error instanceof Refused) return error.refusal
    throw error
  }
}

/** The fields of a `CreationError` of `@deepwidgets/mcp`, read by shape: this package imports only its types. */
function creationError(error: unknown): { code: CreationErrorCode, message: string, diagnostics: string[], nextStep: string | undefined } | undefined {
  if (!(error instanceof Error) || error.name !== 'CreationError') return undefined
  const { code, diagnostics, nextStep } = error as Error & { code?: unknown, diagnostics?: unknown, nextStep?: unknown }
  if (typeof code !== 'string') return undefined
  return {
    code: code as CreationErrorCode,
    message: error.message,
    diagnostics: Array.isArray(diagnostics) ? diagnostics.filter((line): line is string => typeof line === 'string') : [],
    nextStep: typeof nextStep === 'string' ? nextStep : undefined,
  }
}

const KIT_ERROR_CODES: ReadonlySet<string> = new Set<KitErrorCode>(['in-core', 'not-found', 'install-failed', 'kit-unavailable'])

/** The code and the message of a `KitError` of `@deepwidgets/kit`, read by shape: this package imports only its types. */
function kitError(error: unknown): { code: KitErrorCode, message: string } | undefined {
  if (!(error instanceof Error) || error.name !== 'KitError') return undefined
  const { code } = error as Error & { code?: unknown }
  if (typeof code !== 'string' || !KIT_ERROR_CODES.has(code)) return undefined
  return { code: code as KitErrorCode, message: error.message }
}

/** The fields `window` and `windowData` of a row, from the window data of its slug. */
function windowFields(data: WindowData): Pick<MainWidget, 'window' | 'windowData'> {
  return { window: data.shown ? 'shown' : 'hidden', windowData: data }
}

/** The code of a `WindowError` of `@deepwidgets/widgets`, read by shape: this package imports only its types. */
function windowErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error) || error.name !== 'WindowError') return undefined
  const { code } = error as Error & { code?: unknown }
  return typeof code === 'string' ? code : undefined
}

/** A change of the kit for people: `add date-fns@^4` or `remove date-fns`. */
const changeText = (target: KitChangeTarget): string => target.kind === 'add' ? `add ${target.spec}` : `remove ${target.name}`

/** The slug that the row id of the entry `entryId` names, or undefined for a row that is not widget code. */
function slugOfEntry(entryId: string): string | undefined {
  return WIDGET_ROW.exec(entryId.slice(entryId.lastIndexOf(':') + 1))?.[1]
}

function rowOf(info: PluginInfo): MainWidgetRow {
  return { id: info.entryId.slice(info.entryId.lastIndexOf(':') + 1), entryId: info.entryId, name: info.moduleName, enabled: info.enabled }
}

/** A test hook of `tools/widgets-watchdog.mjs` (the case `main-loop`): the query `widgets` holds the event loop this long in its own code. */
const TEST_MAIN_STALL_ENV = 'DEEPWIDGETS_TEST_MAIN_STALL_MS'

export function apply(ctx: Context): void {
  const records = ctx.widgetRecords
  /**
   * as_host_covers_main_handlers: a call to a service of the host (the plugin manager, the installer, the install
   * records, the MCP settings) runs as host code, outside the watchdog slot of this widget. Each other line of an action
   * runs in its call, so a loop there is blamed on `main` within 2 s (decision `widget.watchdog_rule`).
   */
  const host = <T>(fn: () => T): T => records.asHost(fn)
  const testStallMs = Math.max(0, Number(process.env[TEST_MAIN_STALL_ENV] ?? 0) || 0)
  function testStall(): void {
    for (const end = Date.now() + testStallMs; Date.now() < end;) {
      // A busy loop in the code of main: the watchdog sees no heartbeat for this time.
    }
  }

  /** The plugin rows of widget code, or none when the host has no plugin manager. */
  async function widgetRows(): Promise<PluginInfo[]> {
    const manager = ctx.get('pluginManager')
    if (manager === undefined) return []
    return (await host(() => manager.listPlugins())).filter((info) => slugOfEntry(info.entryId) !== undefined)
  }

  /** The rows of `slug`: the rows that registered it, and the rows whose row id names it. */
  function rowsOfSlug(slug: string, rows: PluginInfo[]): PluginInfo[] {
    const registered = new Set(Object.values(host(() => records.rowsOf(slug))))
    return rows.filter((info) => registered.has(info.entryId) || slugOfEntry(info.entryId) === slug)
  }

  /** The description of the live widget `slug`, or undefined when it ended after `list()`. */
  function describeLive(slug: string): WidgetDescription | undefined {
    try {
      return ctx.widgets.describe(slug)
    } catch (error) {
      if ((error as { code?: unknown }).code === 'unknown-widget') return undefined
      throw error
    }
  }

  /**
   * fanout_query_blocks_writes: the plugin rows and the source folders of the widgets, cached. `listPlugins` and the
   * bundle list take 100 ms and more, so the query `widgets`, which runs after each change of a widget, does not read
   * them each time. A change of the plugin manager or of a fiber state drops the cache, and so does a new set of
   * listed slugs. A state write changes none of these.
   */
  let plugins: { key: string, value: Promise<{ rows: PluginInfo[], sources: Map<string, string> }> } | undefined
  const forget = (): void => { plugins = undefined }
  ctx.on('plugin-manager/changed', forget)
  ctx.on('internal/status', forget)

  function pluginSnapshot(listed: readonly string[]): Promise<{ rows: PluginInfo[], sources: Map<string, string> }> {
    const key = [...listed].sort().join('\n')
    if (plugins?.key === key) return plugins.value
    const value = (async () => {
      const rows = await widgetRows()
      const slugs = new Set([...listed, ...rows.flatMap((info) => slugOfEntry(info.entryId) ?? [])])
      const installer = ctx.get('widgetInstaller')
      // widgets_query_cost: one read of the bundle list for each snapshot, not one for each slug.
      const sources = installer === undefined ? new Map<string, string>() : await host(() => installer.sources([...slugs]))
      return { rows, sources }
    })()
    const entry = { key, value }
    plugins = entry
    // A failed read is not kept: the next query reads again.
    value.catch(() => { if (plugins === entry) plugins = undefined })
    return value
  }

  async function describeAll(): Promise<MainWidget[]> {
    const listed = new Map(ctx.widgets.list().map((summary) => [summary.slug, summary]))
    const { rows, sources } = await pluginSnapshot([...listed.keys()])
    const slugs = new Set([...listed.keys(), ...rows.flatMap((info) => slugOfEntry(info.entryId) ?? [])])
    slugs.delete(widgetSlugs[0])
    const out: MainWidget[] = []
    for (const slug of [...slugs].sort()) {
      const summary = listed.get(slug)
      const own = rowsOfSlug(slug, rows)
      const turnedOff = own.length > 0 && own.every((info) => !info.enabled)
      let status: MainWidgetStatus
      if (summary?.off !== undefined) status = { kind: 'safe-mode', message: summary.off.message }
      else if (summary?.failed !== undefined) status = { kind: 'failed', reason: summary.failed }
      else if (summary !== undefined) status = { kind: 'live' }
      else if (turnedOff) status = { kind: 'turned-off' }
      else {
        // A row that is on and has no entry: its plugin body failed, or it waits for a service.
        const on = own.filter((info) => info.enabled)
        status = { kind: 'failed', reason: on.map((info) => info.diagnostic ?? `the row ${rowOf(info).id} is ${info.fiberPhase ?? 'not running'} and did not register ${slug}`).join('; ') }
      }
      const live = status.kind === 'live' ? describeLive(slug) : undefined
      const source = sources.get(slug)
      const [state, program] = await host(() => Promise.all([records.stateRecord(slug), records.programRecord(slug)]))
      out.push({
        slug,
        ...(summary === undefined ? {} : { title: summary.title }),
        status,
        agent: source !== undefined || own.some((info) => AGENT_ROW.test(rowOf(info).id)),
        ...(live?.catalog === undefined ? {} : { catalog: live.catalog }),
        ...(state === undefined ? {} : { state }),
        ...(program === undefined ? {} : { program: { rev: program.rev } }),
        ...(live === undefined ? {} : { actions: live.actions }),
        ...(source === undefined ? {} : { source }),
        rows: own.map(rowOf),
        ...(turnedOff ? { turnedOff: true as const } : {}),
        // The events route lists each entry of the runtime, also a failed one, so Electron main has its window. The runtime
        // reads the window data from memory at each query, so no cache can keep an old value.
        ...(summary !== undefined && summary.off === undefined ? windowFields(host(() => records.windowData(slug))) : {}),
      })
    }
    return out
  }

  /**
   * Set each row of `slug` that is not `enabled` to `enabled` with the plugin manager. With the installer, the change runs
   * in its queue, and the installer keeps the choice: a later install or reload of the slug keeps a Turn off.
   */
  async function setEnabled(slug: string, enabled: boolean): Promise<{ slug: string, rows: { id: string, application: ChangeResult['application'] }[] }> {
    if (slug === widgetSlugs[0]) refuse('unknown-widget', 'the main widget can not turn itself off or on')
    const manager = ctx.get('pluginManager')
    if (manager === undefined) return refuse('unavailable', 'this host has no plugin manager')
    // The rows are read in the queue, after each install or replace before this change.
    const change = async (): Promise<{ id: string, application: ChangeResult['application'] }[]> => {
      const targets = rowsOfSlug(slug, await widgetRows()).filter((info) => info.enabled !== enabled)
      // A refusal inside the change: the installer stores nothing for it.
      if (targets.length === 0) refuse('no-row', `no plugin row of ${slug} is ${enabled ? 'off' : 'on'}`)
      const changed: { id: string, application: ChangeResult['application'] }[] = []
      for (const info of targets) {
        const result = await host(() => manager.setPluginEnabled(info.entryId, enabled))
        if (result.application !== 'applied') {
          const done = changed.length === 0 ? '' : `; ${changed.map((item) => item.id).join(', ')} changed`
          refuse('change-failed', `the plugin manager did not turn ${rowOf(info).id} ${enabled ? 'on' : 'off'}: ${result.application}${done}`, {
            diagnostics: result.error === undefined ? [] : [JSON.stringify(result.error)],
          })
        }
        changed.push({ id: rowOf(info).id, application: result.application })
      }
      return changed
    }
    const installer = ctx.get('widgetInstaller')
    const changed = installer === undefined ? await change() : await host(() => installer.turn(slug, !enabled, change))
    return { slug, rows: changed }
  }

  async function remove(slug: string): Promise<{ slug: string, application: ChangeResult['application'] }> {
    if (slug === widgetSlugs[0] || await host(() => records.builtInSlug(slug))) refuse('built-in', `${slug} is a built-in widget; only an agent widget can be removed`)
    const installer = ctx.get('widgetInstaller')
    if (installer === undefined) refuse('unavailable', 'this host has no widget installer')
    try {
      return await host(() => installer.remove(slug))
    } catch (error) {
      // An expected failure of the installer keeps its code, diagnostics, and next step (`widget_remove` gives the same).
      const failed = creationError(error)
      if (failed === undefined) throw error
      return refuse(failed.code, failed.message, { diagnostics: failed.diagnostics, ...(failed.nextStep === undefined ? {} : { nextStep: failed.nextStep }) })
    }
  }

  /**
   * main_widget.window_state: Show or Hide the widget window of `slug`. The runtime stores the choice, and Electron main
   * obeys the frame of the events route. The page of main gets a `data` frame, so the Window field changes at once.
   */
  async function setShown(slug: string, shown: boolean): Promise<{ slug: string, window: 'shown' | 'hidden' }> {
    if (slug === widgetSlugs[0]) refuse('unknown-widget', 'the main widget has no widget window; the panel is its only window')
    try {
      await host(() => records.setWindowShown(slug, shown))
    } catch (error) {
      if ((error as { code?: unknown }).code !== 'unknown-widget') throw error
      refuse('no-window', `${slug} has no widget window: it is not live, it is turned off, or safe mode keeps it off`)
    }
    return { slug, window: shown ? 'shown' : 'hidden' }
  }

  /**
   * window_manager.panel: one operator choice of the layer, the lock, or the position of the widget window of `slug`.
   * The runtime stores it through the write of the route `POST /api/widget-windows/<slug>`, so the choice goes into
   * `chosen`, as a choice on the bar does. Electron main obeys the `window` frame, and the page of main gets a `data`
   * frame, so the row and the window change at once.
   */
  async function changeWindow(slug: string, change: WindowChange): Promise<{ slug: string, windowData: WindowData }> {
    if (slug === widgetSlugs[0]) refuse('unknown-widget', 'the main widget has no widget window; the panel is its only window')
    try {
      return { slug, windowData: await host(() => records.setWindow(slug, change)) }
    } catch (error) {
      if (windowErrorCode(error) !== 'no-window') throw error
      return refuse('no-window', `${slug} has no widget window: it is not live, it is turned off, or safe mode keeps it off`)
    }
  }

  /** The ids of the login-item calls to Electron main. */
  const loginCalls = { id: 1 }

  /** A refusal for a section of the Settings tab, for a host with no MCP row. */
  const noMcp = (): MainRefusal => ({ ok: false, code: 'unavailable', message: 'this host has no MCP server, so it has no MCP settings' })

  /** The answer of Electron main as a result: a refusal keeps its code. */
  function loginItemResult(reply: LoginItemAnswer): MainAnswer<LoginItemSetting> {
    return reply.ok ? { ok: true, ...reply.item } : { ok: false, code: reply.code, message: reply.message }
  }

  /** Each section of the Settings tab that the host fills. A section that fails gives its refusal; the others still show. */
  async function settingsAnswer(): Promise<MainSettings> {
    const mcp = ctx.get('mcpSettings')
    const [modes, kit, port, loginItem] = await Promise.all([
      mcp === undefined ? noMcp() : host(() => mcp.modes()).then((value): MainAnswer<ModeSettings> => ({ ok: true, ...value })),
      kitAnswer(),
      mcp === undefined ? noMcp() : host(() => mcp.port()).then((value): MainAnswer<PortSetting> => ({ ok: true, ...value })),
      askLoginItem(loginCalls, null).then(loginItemResult),
    ])
    return { modes, kit, port, loginItem }
  }

  /** The kit section for a host with no service `kit` (`kit.pane.actions`), as {@link noMcp} for the MCP sections. */
  const noKit = (): MainRefusal => ({ ok: false, code: 'unavailable', message: 'this host has no widget kit, so it has no kit section' })

  /**
   * kit.pane.actions: the part `kit`. It reads `snapshot()`, never `read()`: the kit start can wait up to 21 minutes for
   * the lock of another process, and a wait here would time out the whole query, with each other section.
   */
  async function kitAnswer(): Promise<MainAnswer<MainKit>> {
    const kit = ctx.get('kit')
    if (kit === undefined) return noKit()
    const mcp = ctx.get('mcpSettings')
    const [state, refuseBuilds] = await Promise.all([
      host(() => kit.snapshot()).then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error })),
      mcp === undefined ? noMcp() : host(() => mcp.refuseBuilds()).then((result): MainAnswer<RefuseBuildsSetting> => result.ok ? { ok: true, ...result.setting } : result),
    ])
    // A kit folder that can not be read refuses this section only.
    if (!state.ok) return { ok: false, code: 'kit-unavailable', message: `the widget kit could not be read: ${state.error instanceof Error ? state.error.message : String(state.error)}` }
    return { ok: true, ...state.value, refuseBuilds }
  }

  /**
   * kit.pane.actions: start one change of the kit, and answer at once with the change. The action does not wait for
   * pnpm: the kit keeps the result in `last`, and the page reads it with the query `settings`. While the kit starts or
   * is unavailable, it refuses with `kit-unavailable`, and while a change runs, with `kit-busy`. A change that the kit
   * refuses before it starts, such as a core package, refuses with the code of the kit.
   */
  async function startKitChange(target: KitChangeTarget): Promise<{ started: KitChange }> {
    const kit = ctx.get('kit')
    if (kit === undefined) return refuse('kit-unavailable', noKit().message)
    const before = await host(() => kit.snapshot())
    if (before.status === 'starting') refuse('kit-unavailable', 'the widget kit starts now; try again when its status is ready')
    if (before.status === 'unavailable') refuse('kit-unavailable', `the widget kit is unavailable: ${before.reason ?? 'the host log names the reason'}`)
    if (before.change !== undefined) refuse('kit-busy', `the widget kit runs the change ${changeText(before.change)} now; try again when it ends`)
    const startedAt = Date.now()
    // The handlers go on the promise in the same turn: a refusal of the kit has already rejected it, and a rejection
    // with no handler ends the host. The end of a change that started goes to `last`, where the page reads it.
    const outcome = host(() => (target.kind === 'add' ? kit.add(target.spec) : kit.remove(target.name)).then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error }),
    ))
    // The kit takes a change before add or remove returns, and keeps it in `change` until it ends.
    const after = await host(() => kit.snapshot())
    if (after.change !== undefined) return { started: after.change }
    // The kit took no change, so it refused at once, or the change already ended: the promise has settled.
    const ended = await outcome
    if (ended.ok) return { started: { ...target, startedAt } }
    const failed = kitError(ended.error)
    if (failed !== undefined) return refuse(failed.code, failed.message)
    // A failure that is not a KitError is a defect: the call gives handler-error.
    throw ended.error instanceof Error ? ended.error : new Error(String(ended.error))
  }

  /** kit.pane.actions: write `kit.refuseBuilds` through `mcpSettings`, which keeps each other key of the settings file. */
  async function setRefuseBuilds(names: string[]): Promise<RefuseBuildsSetting> {
    const mcp = ctx.get('mcpSettings')
    if (mcp === undefined) return refuse('unavailable', noMcp().message)
    const result = await host(() => mcp.setRefuseBuilds(names))
    if (!result.ok) return refuse(result.code, result.message)
    return result.setting
  }

  /** Turn a gated mode on or off in the settings file. The next MCP tool call reads it. */
  async function setMode(mode: string, on: boolean): Promise<ModeSettings> {
    const mcp = ctx.get('mcpSettings')
    if (mcp === undefined) return refuse('unavailable', noMcp().message)
    const result = await host(() => mcp.setMode(mode, on))
    if (!result.ok) return refuse(result.code, result.message)
    return result.settings
  }

  /** Set the login item through Electron main, which reads its status back. A dev run refuses with `dev-run`. */
  async function setLoginItem(open: boolean): Promise<LoginItemSetting> {
    const reply = await askLoginItem(loginCalls, open)
    if (!reply.ok) return refuse(reply.code, reply.message)
    return reply.item
  }

  ctx.widgets.register({
    slug: widgetSlugs[0],
    title: 'deepWidgets',
    program: PROGRAM,
    catalog: CATALOG,
    initialState: {},
    actions: [
      {
        name: 'widgets',
        kind: 'query',
        handler: async () => {
          testStall()
          return { widgets: await describeAll() }
        },
      },
      { name: 'settings', kind: 'query', timeoutMs: SETTINGS_TIMEOUT_MS, handler: settingsAnswer },
      { name: 'setMode', kind: 'mutation', args: modeInput, handler: ({ mode, on }) => answer(() => setMode(mode, on)) },
      {
        name: 'setLoginItem',
        kind: 'mutation',
        args: loginItemInput,
        timeoutMs: SETTINGS_TIMEOUT_MS,
        handler: ({ open }) => answer(() => setLoginItem(open)),
      },
      { name: 'kitAdd', kind: 'mutation', args: kitAddInput, handler: ({ spec }) => answer(() => startKitChange({ kind: 'add', spec })) },
      { name: 'kitRemove', kind: 'mutation', args: kitRemoveInput, handler: ({ name }) => answer(() => startKitChange({ kind: 'remove', name })) },
      { name: 'setRefuseBuilds', kind: 'mutation', args: refuseBuildsInput, handler: ({ names }) => answer(() => setRefuseBuilds(names)) },
      {
        name: 'program',
        kind: 'query',
        args: slugInput,
        handler: ({ slug }) => answer(async () => {
          const program = slug === widgetSlugs[0] ? undefined : await host(() => records.programRecord(slug))
          if (program === undefined) return refuse('unknown-widget', `no stored program for ${JSON.stringify(slug)}`)
          return { slug, rev: program.rev, text: program.text }
        }),
      },
      { name: 'show', kind: 'mutation', args: slugInput, handler: ({ slug }) => answer(() => setShown(slug, true)) },
      { name: 'hide', kind: 'mutation', args: slugInput, handler: ({ slug }) => answer(() => setShown(slug, false)) },
      { name: 'setLayer', kind: 'mutation', args: layerInput, handler: ({ slug, layer }) => answer(() => changeWindow(slug, { layer })) },
      { name: 'setLock', kind: 'mutation', args: lockInput, handler: ({ slug, locked }) => answer(() => changeWindow(slug, { locked })) },
      { name: 'resetPosition', kind: 'mutation', args: slugInput, handler: ({ slug }) => answer(() => changeWindow(slug, { reset: true })) },
      { name: 'turnOff', kind: 'mutation', args: slugInput, timeoutMs: CHANGE_TIMEOUT_MS, handler: ({ slug }) => answer(() => setEnabled(slug, false)) },
      { name: 'turnOn', kind: 'mutation', args: slugInput, timeoutMs: CHANGE_TIMEOUT_MS, handler: ({ slug }) => answer(() => setEnabled(slug, true)) },
      { name: 'remove', kind: 'mutation', args: slugInput, timeoutMs: CHANGE_TIMEOUT_MS, handler: ({ slug }) => answer(() => remove(slug)) },
    ],
  })
}
