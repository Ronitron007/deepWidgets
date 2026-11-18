/**
 * The component set `deepwidgets-main@1` (`main_widget.catalog`): the parts of the page of the main widget. The root
 * `Panel` holds the tabs Widgets and Settings. `WidgetTable` is the Widgets tab (`main_widget.widgets`). The status
 * badge, the state viewer, and the actions list are parts of each row, and a program can also use each one alone.
 * `ModeSwitches`, `ApprovedAgents`, `McpPort`, and `LaunchAtLogin` are the sections of the Settings tab
 * (`main_widget.settings`).
 * @module @deepwidgets/shell/main-widget/library
 */
import { useEffect, useState, type ReactNode } from 'react'
import { LayoutGrid } from 'lucide-react'
import { z } from 'zod'
import { action, createLibrary, defineComponent, useRendererQuery, useTriggerAction } from '@openuidev/react-lang'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs.tsx'
import { ActionListView, StateView, StatusPill } from './parts.tsx'
import { ActionSchema, StateSchema, StatusSchema, WidgetSchema, type Widget } from './schema.ts'
import { ApprovedAgentsView, LaunchAtLoginView, McpPortView, ModeSwitchesView } from './settings.tsx'
import { WidgetRow } from './widget-row.tsx'

// action() gives a wider type than useTriggerAction takes under exactOptionalPropertyTypes; the values are the same.
type TriggerPlan = Parameters<ReturnType<typeof useTriggerAction>>[2]

/** The id of this component set. The page refuses a program of another set, and the default shell refuses this one. */
export const MAIN_CATALOG = 'deepwidgets-main@1'

/** A failure of the page, in the style of the core state views. */
function Problem({ title, detail }: { title: string, detail: string }) {
  return (
    <div className="dw-state dw-state--error" role="alert" data-dw="main-problem">
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  )
}

const Note = defineComponent({
  name: 'Note',
  description: 'One line of muted text.',
  props: z.object({ text: z.string() }),
  component: ({ props }) => <p className="m-0 py-6 text-center text-muted-foreground" data-dw="note">{props.text}</p>,
})

const StatusBadge = defineComponent({
  name: 'StatusBadge',
  description: 'The status of one widget: live, failed, safe-mode, or turned-off.',
  props: z.object({ status: StatusSchema }),
  component: ({ props }) => {
    const status = StatusSchema.safeParse(props.status)
    return status.success ? <StatusPill status={status.data} /> : <Problem title="Unknown status" detail={JSON.stringify(props.status)} />
  },
})

const StateViewer = defineComponent({
  name: 'StateViewer',
  description: 'The state JSON of one widget and its rev. Each level folds and unfolds.',
  props: z.object({ state: StateSchema }),
  component: ({ props }) => {
    const state = StateSchema.safeParse(props.state)
    if (!state.success) return <Problem title="Unknown state" detail={z.prettifyError(state.error)} />
    return (
      <div className="flex flex-col gap-1.5">
        <span className="tabular-nums text-muted-foreground">rev {state.data.rev}</span>
        <StateView data={state.data.data} />
      </div>
    )
  },
})

const ActionList = defineComponent({
  name: 'ActionList',
  description: 'The actions of one widget: name, kind, args, and timeout.',
  props: z.object({ actions: z.array(ActionSchema) }),
  component: ({ props }) => {
    const actions = z.array(ActionSchema).safeParse(props.actions)
    return actions.success ? <ActionListView actions={actions.data} /> : <Problem title="Unknown actions" detail={z.prettifyError(actions.error)} />
  },
})

/** Count the rows by status, for the line above the list. */
function summary(widgets: Widget[]): string {
  const counts = new Map<string, number>()
  const label = { 'live': 'live', 'failed': 'failed', 'safe-mode': 'off in safe mode', 'turned-off': 'off' } as const
  for (const widget of widgets) counts.set(label[widget.status.kind], (counts.get(label[widget.status.kind]) ?? 0) + 1)
  const parts = [...counts].map(([text, count]) => `${String(count)} ${text}`)
  return `${String(widgets.length)} ${widgets.length === 1 ? 'widget' : 'widgets'}${parts.length === 0 ? '' : ` · ${parts.join(' · ')}`}`
}

function WidgetTableView({ widgets, refresh }: { widgets: unknown, refresh: TriggerPlan | undefined }) {
  const trigger = useTriggerAction()
  const query = useRendererQuery()
  // The default of the query is null: the list has not loaded yet. When the first query failed, the list stays null,
  // and the core shows the error with Retry, so the table shows nothing.
  if (widgets === null || widgets === undefined) {
    if (query.errors.length > 0) return null
    return <div className="flex flex-col gap-2 py-1" aria-busy="true" data-dw="widget-table-loading"><div className="dw-skeleton" /><div className="dw-skeleton" /></div>
  }
  if (!Array.isArray(widgets)) return <Problem title="Could not read the widget list" detail={`The host gave ${typeof widgets}, not a list.`} />
  const rows = widgets.map((item: unknown) => ({ item, parsed: WidgetSchema.safeParse(item) }))
  const good = rows.flatMap((row) => (row.parsed.success ? [row.parsed.data] : []))
  const onChanged = (): void => { if (refresh !== undefined) void trigger('', undefined, refresh) }
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 py-8 text-center" data-dw="widget-table-empty">
        <span className="font-medium">No widgets yet</span>
        <span className="text-muted-foreground">An agent adds one with widget_install.</span>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2" data-dw="widget-table">
      <span className="px-0.5 text-xs text-muted-foreground" data-dw="widget-summary">{summary(good)}</span>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {rows.map(({ item, parsed }, index) => parsed.success
          ? <WidgetRow key={parsed.data.slug} widget={parsed.data} onChanged={onChanged} />
          : (
            <li key={`bad-${String(index)}`}>
              <Problem title={`Could not read the row ${JSON.stringify((item as { slug?: unknown } | null)?.slug ?? index)}`} detail={z.prettifyError(parsed.error)} />
            </li>
          ))}
      </ul>
    </div>
  )
}

const WidgetTable = defineComponent({
  name: 'WidgetTable',
  description: 'The Widgets tab: one row for each widget, with its status, state, program, actions, source, rows, and window, and the controls Turn off, Turn on, and Remove. widgets is null while the query loads. refresh runs after a control changes a widget.',
  props: z.object({ widgets: z.array(WidgetSchema).nullable(), refresh: action().optional() }),
  component: ({ props }) => <WidgetTableView widgets={props.widgets} refresh={props.refresh as TriggerPlan | undefined} />,
})

/** Run the action plan `refresh` of a component, when the program gives one. */
function useRefresh(refresh: TriggerPlan | undefined): () => void {
  const trigger = useTriggerAction()
  return () => { if (refresh !== undefined) void trigger('', undefined, refresh) }
}

function ModeSwitchesPart({ modes, refresh }: { modes: unknown, refresh: TriggerPlan | undefined }) {
  return <ModeSwitchesView modes={modes} refresh={useRefresh(refresh)} />
}

const ModeSwitches = defineComponent({
  name: 'ModeSwitches',
  description: 'The MCP modes of the Settings tab: one switch for each gated mode, and interact as always on. modes is null while the query loads. refresh runs after a switch.',
  props: z.object({ modes: z.unknown(), refresh: action().optional() }),
  component: ({ props }) => <ModeSwitchesPart modes={props.modes} refresh={props.refresh as TriggerPlan | undefined} />,
})

const ApprovedAgents = defineComponent({
  name: 'ApprovedAgents',
  description: 'The approved agents of the Settings tab. It says that the consent server is not built yet.',
  props: z.object({}),
  component: () => <ApprovedAgentsView />,
})

const McpPort = defineComponent({
  name: 'McpPort',
  description: 'The MCP port of the Settings tab: the port and the path of mcp.json, read only, each with a copy button. port is null while the query loads.',
  props: z.object({ port: z.unknown() }),
  component: ({ props }) => <McpPortView port={props.port} />,
})

function LaunchAtLoginPart({ loginItem, refresh }: { loginItem: unknown, refresh: TriggerPlan | undefined }) {
  return <LaunchAtLoginView loginItem={loginItem} refresh={useRefresh(refresh)} />
}

const LaunchAtLogin = defineComponent({
  name: 'LaunchAtLogin',
  description: 'Launch at login in the Settings tab: one switch and the status from macOS. loginItem is null while the query loads. refresh runs after the switch.',
  props: z.object({ loginItem: z.unknown(), refresh: action().optional() }),
  component: ({ props }) => <LaunchAtLoginPart loginItem={props.loginItem} refresh={props.refresh as TriggerPlan | undefined} />,
})

const tabChildren = [WidgetTable.ref, Note.ref, StatusBadge.ref, StateViewer.ref, ActionList.ref, ModeSwitches.ref, ApprovedAgents.ref, McpPort.ref, LaunchAtLogin.ref]

const Tab = defineComponent({
  name: 'Tab',
  description: 'One tab of the Panel: its title and its content.',
  props: z.object({ title: z.string(), children: z.array(z.union(tabChildren)) }),
  component: () => null,
})

/**
 * The DOM event of Electron main that makes the panel show its first tab: a second launch opens the panel on the
 * Widgets tab (`main_widget.provisional`). Same name as `PANEL_FIRST_TAB_EVENT` of `apps/desktop/src/deepwidgets-menu-bar.ts`.
 */
const FIRST_TAB_EVENT = 'deepwidgets-panel-first-tab'

/** The tabs of the Panel. The first tab opens first, and again at the event {@link FIRST_TAB_EVENT}. */
function PanelTabs({ title, tabs, render }: { title: string, tabs: { value: string, title: string, children: unknown }[], render: (children: unknown) => ReactNode }) {
  const [active, setActive] = useState('0')
  useEffect(() => {
    const first = (): void => { setActive('0') }
    window.addEventListener(FIRST_TAB_EVENT, first)
    return () => { window.removeEventListener(FIRST_TAB_EVENT, first) }
  }, [])
  return (
    <Tabs value={active} onValueChange={setActive} data-dw="main-panel">
      <div className="dwm-panel-head">
        <span className="flex items-center gap-2">
          <LayoutGrid className="size-4 text-muted-foreground" aria-hidden="true" />
          <strong className="text-sm font-semibold text-foreground">{title}</strong>
        </span>
        <TabsList className="dwm-tabs-list" aria-label={title}>
          {tabs.map((tab) => <TabsTrigger key={tab.value} value={tab.value} data-dw="tab">{tab.title}</TabsTrigger>)}
        </TabsList>
      </div>
      {/* Each tab stays mounted, so a switch of the tab keeps the open rows and a call that waits (main.css hides it). */}
      {tabs.map((tab) => <TabsContent key={tab.value} value={tab.value} forceMount className="dwm-tab-panel" data-dw="tab-panel">{render(tab.children)}</TabsContent>)}
    </Tabs>
  )
}

const Panel = defineComponent({
  name: 'Panel',
  description: 'The page of the main widget: a title and the tabs. The first tab opens first.',
  props: z.object({ title: z.string(), tabs: z.array(Tab.ref) }),
  component: ({ props, renderNode }) => {
    // Each tab is a Tab element node; its props hold the title and the children.
    const tabs = (props.tabs as unknown[]).map((node, index) => {
      const tab = (node as { props?: { title?: unknown, children?: unknown } } | null)?.props
      return { value: String(index), title: typeof tab?.title === 'string' ? tab.title : `Tab ${String(index + 1)}`, children: tab?.children }
    })
    return <PanelTabs title={props.title} tabs={tabs} render={renderNode} />
  },
})

/** The library of `deepwidgets-main@1`. The root is `Panel`. */
export const mainLibrary = createLibrary({
  root: 'Panel',
  components: [Panel, Tab, WidgetTable, Note, StatusBadge, StateViewer, ActionList, ModeSwitches, ApprovedAgents, McpPort, LaunchAtLogin],
})
