/**
 * The main widget (`main_widget.widget`): the built-in widget with the slug `main`. The panel under the menu bar icon is
 * its only window, so Electron main opens no widget window for it, and the MCP server does not show it to agents.
 *
 * Its actions are the host half of the Widgets tab (`main_widget.widgets`): the query `widgets` lists each other widget,
 * also a widget that is turned off or that safe mode keeps off. The mutations `turnOff` and `turnOn` change the plugin
 * rows of a widget through the DSH plugin manager. The mutation `remove` removes an agent widget through the remove path
 * of `widget_remove` (the service `widgetInstaller` of `@deepwidgets/mcp`). The state of a widget stays in each case.
 *
 * The plugin manager, the installer, and the install records are host code. The actions run them through
 * `widgetRecords.asHost`, so they run outside the store of this row: a crash in them is not blamed on this widget.
 * @module @deepwidgets/widget-main
 */
import type { Context } from '@deepseek-ai/cordis'
import type { ChangeResult, PluginInfo } from '@deepseek-ai/dsh-plugin-manager'
import type {} from '@deepwidgets/mcp'
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

/** A placeholder program. The unit `main.page` gives the page of the main widget and its component set. */
export const PROGRAM = `root = Card([CardHeader("deepWidgets", "The main widget")])
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
  /** A live or failed widget has a widget window. `main.window_state` adds the hidden state. */
  window?: 'shown'
}

const slugInput = z.object({ slug: z.string() })

/** A refusal of an action. The page shows the message; the code is its first word. */
const refusal = (code: string, message: string): Error => new Error(`${code}: ${message}`)

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

  async function describeAll(): Promise<MainWidget[]> {
    const rows = await widgetRows()
    const listed = new Map(ctx.widgets.list().map((summary) => [summary.slug, summary]))
    const slugs = new Set([...listed.keys(), ...rows.flatMap((info) => slugOfEntry(info.entryId) ?? [])])
    slugs.delete(widgetSlugs[0])
    const installer = ctx.get('widgetInstaller')
    const out: MainWidget[] = []
    for (const slug of [...slugs].sort()) {
      const summary = listed.get(slug)
      const own = rowsOfSlug(slug, rows)
      let status: MainWidgetStatus
      if (summary?.off !== undefined) status = { kind: 'safe-mode', message: summary.off.message }
      else if (summary?.failed !== undefined) status = { kind: 'failed', reason: summary.failed }
      else if (summary !== undefined) status = { kind: 'live' }
      else if (own.every((info) => !info.enabled)) status = { kind: 'turned-off' }
      else {
        // A row that is on and has no entry: its plugin body failed, or it waits for a service.
        const on = own.filter((info) => info.enabled)
        status = { kind: 'failed', reason: on.map((info) => info.diagnostic ?? `the row ${rowOf(info).id} is ${info.fiberPhase ?? 'not running'} and did not register ${slug}`).join('; ') }
      }
      const live = status.kind === 'live' ? describeLive(slug) : undefined
      const [state, program, source] = await Promise.all([records.stateRecord(slug), records.programRecord(slug), installer?.source(slug)])
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
        // The events route lists each entry of the runtime, also a failed one, so Electron main shows its window.
        ...(summary !== undefined && summary.off === undefined ? { window: 'shown' as const } : {}),
      })
    }
    return out
  }

  /** Set each row of `slug` that is not `enabled` to `enabled` with the plugin manager. */
  async function setEnabled(slug: string, enabled: boolean): Promise<{ slug: string, rows: { id: string, application: ChangeResult['application'] }[] }> {
    if (slug === widgetSlugs[0]) throw refusal('unknown-widget', 'the main widget can not turn itself off or on')
    const manager = ctx.get('pluginManager')
    if (manager === undefined) throw refusal('unavailable', 'this host has no plugin manager')
    const targets = rowsOfSlug(slug, await widgetRows()).filter((info) => info.enabled !== enabled)
    if (targets.length === 0) throw refusal('no-row', `no plugin row of ${slug} is ${enabled ? 'off' : 'on'}`)
    const changed: { id: string, application: ChangeResult['application'] }[] = []
    for (const info of targets) {
      const result = await manager.setPluginEnabled(info.entryId, enabled)
      if (result.application !== 'applied') {
        const done = changed.length === 0 ? '' : `; ${changed.map((item) => item.id).join(', ')} changed`
        throw refusal('change-failed', `the plugin manager did not turn ${rowOf(info).id} ${enabled ? 'on' : 'off'}: ${result.application}${result.error === undefined ? '' : ` ${JSON.stringify(result.error)}`}${done}`)
      }
      changed.push({ id: rowOf(info).id, application: result.application })
    }
    return { slug, rows: changed }
  }

  async function remove(slug: string): Promise<{ slug: string, application: ChangeResult['application'] }> {
    if (slug === widgetSlugs[0] || await records.builtInSlug(slug)) throw refusal('built-in', `${slug} is a built-in widget; only an agent widget can be removed`)
    const installer = ctx.get('widgetInstaller')
    if (installer === undefined) throw refusal('unavailable', 'this host has no widget installer')
    try {
      return await installer.remove(slug)
    } catch (error) {
      const code = (error as { code?: unknown }).code
      throw typeof code === 'string' && error instanceof Error ? refusal(code, error.message) : error
    }
  }

  ctx.widgets.register({
    slug: widgetSlugs[0],
    title: 'deepWidgets',
    program: PROGRAM,
    catalog: CATALOG,
    initialState: {},
    actions: [
      { name: 'widgets', kind: 'query', handler: () => records.asHost(async () => ({ widgets: await describeAll() })) },
      {
        name: 'program',
        kind: 'query',
        args: slugInput,
        handler: ({ slug }) => records.asHost(async () => {
          const program = slug === widgetSlugs[0] ? undefined : await records.programRecord(slug)
          if (program === undefined) throw refusal('unknown-widget', `no stored program for ${JSON.stringify(slug)}`)
          return { slug, rev: program.rev, text: program.text }
        }),
      },
      { name: 'turnOff', kind: 'mutation', args: slugInput, timeoutMs: CHANGE_TIMEOUT_MS, handler: ({ slug }) => records.asHost(() => setEnabled(slug, false)) },
      { name: 'turnOn', kind: 'mutation', args: slugInput, timeoutMs: CHANGE_TIMEOUT_MS, handler: ({ slug }) => records.asHost(() => setEnabled(slug, true)) },
      { name: 'remove', kind: 'mutation', args: slugInput, timeoutMs: CHANGE_TIMEOUT_MS, handler: ({ slug }) => records.asHost(() => remove(slug)) },
    ],
  })
}
