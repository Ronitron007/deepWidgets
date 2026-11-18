/**
 * The main widget (`main_widget.widget`): the built-in widget with the slug `main`. The panel under the menu bar icon is
 * its only window, so Electron main opens no widget window for it, and the MCP server does not show it to agents.
 *
 * Its actions are the host half of the Widgets tab (`main_widget.widgets`): the query `widgets` lists each other widget,
 * also a widget that is turned off or that safe mode keeps off. The mutations `turnOff` and `turnOn` change the plugin
 * rows of a widget through the DSH plugin manager, in the queue of the installer (the service `widgetInstaller` of
 * `@deepwidgets/mcp`). The installer keeps a Turn off, so a later `widget_install` or `widget_reload` of the slug installs
 * the new row off. The mutation `remove` removes an agent widget through the remove path of `widget_remove`. The state of
 * a widget stays in each case.
 *
 * The plugin manager, the installer, and the install records are host code. The actions run them through
 * `widgetRecords.asHost`, so they run outside the store of this row: a crash in them is not blamed on this widget.
 *
 * The query `settings` and the mutations `setMode` and `setLoginItem` are the host half of the Settings tab
 * (`main_widget.settings`). The modes and the port come from the service `mcpSettings` of `@deepwidgets/mcp`, which
 * reads the files that the MCP tools read. The launch-at-login switch goes to Electron main over the IPC channel of the
 * host (the message `deepwidgets-login-item`), because the page talks only to the host. Electron main sets the login
 * item and reads its status back; a dev run sets nothing.
 *
 * An action that refuses gives a {@link MainRefusal} as its result, with a code, so the page routes by the code. Only a
 * defect throws: the call then gives `handler-error`.
 * @module @deepwidgets/widget-main
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ChangeResult, PluginInfo } from '@deepseek-ai/dsh-plugin-manager'
import type { CreationErrorCode, ModeSettings, PortSetting, SetModeRefusal } from '@deepwidgets/mcp'
import type { WidgetActionDescription, WidgetDescription } from '@deepwidgets/widgets'
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
 * `WidgetTable` call `turnOff`, `turnOn`, `remove`, and `program` with the slug of the row, then run `refresh`. The
 * switches of `ModeSwitches` and `LaunchAtLogin` call `setMode` and `setLoginItem`, then run `refresh`. The runtime
 * also sends a `data` frame to the page of main on each change of another widget, and the page then runs each query.
 */
export const PROGRAM = `root = Panel("deepWidgets", [widgetsTab, settingsTab])
widgetsTab = Tab("Widgets", [WidgetTable(w.widgets, Action([@Run(w)]))])
settingsTab = Tab("Settings", [ModeSwitches(s.modes, Action([@Run(s)])), ApprovedAgents(), McpPort(s.port), LaunchAtLogin(s.loginItem, Action([@Run(s)]))])
w = Query("widgets", {}, {widgets: null})
s = Query("settings", {}, {modes: null, port: null, loginItem: null})
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
  /** A live or failed widget has a widget window. `main.window_state` adds the hidden state. */
  window?: 'shown'
}

const slugInput = z.object({ slug: z.string() })
const modeInput = z.object({ mode: z.string(), on: z.boolean() })
const loginItemInput = z.object({ open: z.boolean() })

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
/** Electron main answers at once; it reads the status with one synchronous call. */
const LOGIN_ITEM_LIMIT_MS = 5_000

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

/** The answer of the query `settings`: one part for each section of the Settings tab that the host fills. */
export interface MainSettings {
  modes: MainAnswer<ModeSettings>
  port: MainAnswer<PortSetting>
  loginItem: MainAnswer<LoginItemSetting>
}

/** The code of a refusal of an action of `main`. The codes of the installer come from the remove path of `widget_remove`. */
export type MainRefusalCode = 'unknown-widget' | 'built-in' | 'no-row' | 'unavailable' | 'change-failed' | CreationErrorCode
  | SetModeRefusal | LoginItemRefusal

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

/** The slug that the row id of the entry `entryId` names, or undefined for a row that is not widget code. */
function slugOfEntry(entryId: string): string | undefined {
  return WIDGET_ROW.exec(entryId.slice(entryId.lastIndexOf(':') + 1))?.[1]
}

function rowOf(info: PluginInfo): MainWidgetRow {
  return { id: info.entryId.slice(info.entryId.lastIndexOf(':') + 1), entryId: info.entryId, name: info.moduleName, enabled: info.enabled }
}

export function apply(ctx: Context): void {
  const records = ctx.widgetRecords

  /** The plugin rows of widget code, or none when the host has no plugin manager. */
  async function widgetRows(): Promise<PluginInfo[]> {
    const manager = ctx.get('pluginManager')
    if (manager === undefined) return []
    return (await manager.listPlugins()).filter((info) => slugOfEntry(info.entryId) !== undefined)
  }

  /** The rows of `slug`: the rows that registered it, and the rows whose row id names it. */
  function rowsOfSlug(slug: string, rows: PluginInfo[]): PluginInfo[] {
    const registered = new Set(Object.values(records.rowsOf(slug)))
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
      const sources = installer === undefined ? new Map<string, string>() : await installer.sources([...slugs])
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
      const [state, program] = await Promise.all([records.stateRecord(slug), records.programRecord(slug)])
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
        // The events route lists each entry of the runtime, also a failed one, so Electron main shows its window.
        ...(summary !== undefined && summary.off === undefined ? { window: 'shown' as const } : {}),
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
        const result = await manager.setPluginEnabled(info.entryId, enabled)
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
    const changed = installer === undefined ? await change() : await installer.turn(slug, !enabled, change)
    return { slug, rows: changed }
  }

  async function remove(slug: string): Promise<{ slug: string, application: ChangeResult['application'] }> {
    if (slug === widgetSlugs[0] || await records.builtInSlug(slug)) refuse('built-in', `${slug} is a built-in widget; only an agent widget can be removed`)
    const installer = ctx.get('widgetInstaller')
    if (installer === undefined) refuse('unavailable', 'this host has no widget installer')
    try {
      return await installer.remove(slug)
    } catch (error) {
      // An expected failure of the installer keeps its code, diagnostics, and next step (`widget_remove` gives the same).
      const failed = creationError(error)
      if (failed === undefined) throw error
      return refuse(failed.code, failed.message, { diagnostics: failed.diagnostics, ...(failed.nextStep === undefined ? {} : { nextStep: failed.nextStep }) })
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
    const [modes, port, loginItem] = await Promise.all([
      mcp === undefined ? noMcp() : mcp.modes().then((value): MainAnswer<ModeSettings> => ({ ok: true, ...value })),
      mcp === undefined ? noMcp() : mcp.port().then((value): MainAnswer<PortSetting> => ({ ok: true, ...value })),
      askLoginItem(loginCalls, null).then(loginItemResult),
    ])
    return { modes, port, loginItem }
  }

  /** Turn a gated mode on or off in the settings file. The next MCP tool call reads it. */
  async function setMode(mode: string, on: boolean): Promise<ModeSettings> {
    const mcp = ctx.get('mcpSettings')
    if (mcp === undefined) return refuse('unavailable', noMcp().message)
    const result = await mcp.setMode(mode, on)
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
      { name: 'widgets', kind: 'query', handler: () => records.asHost(async () => ({ widgets: await describeAll() })) },
      { name: 'settings', kind: 'query', handler: () => records.asHost(settingsAnswer) },
      { name: 'setMode', kind: 'mutation', args: modeInput, handler: ({ mode, on }) => records.asHost(() => answer(() => setMode(mode, on))) },
      { name: 'setLoginItem', kind: 'mutation', args: loginItemInput, handler: ({ open }) => records.asHost(() => answer(() => setLoginItem(open))) },
      {
        name: 'program',
        kind: 'query',
        args: slugInput,
        handler: ({ slug }) => records.asHost(() => answer(async () => {
          const program = slug === widgetSlugs[0] ? undefined : await records.programRecord(slug)
          if (program === undefined) return refuse('unknown-widget', `no stored program for ${JSON.stringify(slug)}`)
          return { slug, rev: program.rev, text: program.text }
        })),
      },
      { name: 'turnOff', kind: 'mutation', args: slugInput, timeoutMs: CHANGE_TIMEOUT_MS, handler: ({ slug }) => records.asHost(() => answer(() => setEnabled(slug, false))) },
      { name: 'turnOn', kind: 'mutation', args: slugInput, timeoutMs: CHANGE_TIMEOUT_MS, handler: ({ slug }) => records.asHost(() => answer(() => setEnabled(slug, true))) },
      { name: 'remove', kind: 'mutation', args: slugInput, timeoutMs: CHANGE_TIMEOUT_MS, handler: ({ slug }) => records.asHost(() => answer(() => remove(slug))) },
    ],
  })
}
