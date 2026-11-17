/**
 * The small parts of the Widgets tab: the status badge, the state viewer, and the actions list. The component set
 * `deepwidgets-main@1` gives each one to a program, and the widget row uses them.
 * @module @deepwidgets/shell/main-widget/parts
 */
import { JsonView, collapseAllNested, defaultStyles } from 'react-json-view-lite'
import 'react-json-view-lite/dist/index.css'
import type { Action, Status } from './schema.ts'

const STATUS_TEXT: Record<Status['kind'], string> = {
  'live': 'Live',
  'failed': 'Failed',
  'safe-mode': 'Safe mode',
  'turned-off': 'Off',
}

/** The detail of a status, for the tooltip of its badge. */
export function statusDetail(status: Status): string {
  switch (status.kind) {
    case 'live': return 'The widget runs.'
    case 'failed': return status.reason
    case 'safe-mode': return status.message
    case 'turned-off': return 'The operator turned the widget off. Its state stays.'
  }
}

/** The status badge: a dot and one word. The tone follows the kind. */
export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="dwm-status" data-kind={status.kind} data-dw="status" title={statusDetail(status)}>
      <span className="dwm-status-dot" aria-hidden="true" />
      {STATUS_TEXT[status.kind]}
    </span>
  )
}

// The light structure classes of react-json-view-lite stay. The colors come from the DSH tokens in main.css.
const jsonStyles = {
  ...defaultStyles,
  container: 'dwm-json',
  label: `${defaultStyles.label} dwm-json-label`,
  clickableLabel: `${defaultStyles.clickableLabel} dwm-json-label`,
  nullValue: `${defaultStyles.nullValue} dwm-json-null`,
  undefinedValue: `${defaultStyles.undefinedValue} dwm-json-null`,
  stringValue: `${defaultStyles.stringValue} dwm-json-string`,
  numberValue: `${defaultStyles.numberValue} dwm-json-number`,
  booleanValue: `${defaultStyles.booleanValue} dwm-json-boolean`,
  otherValue: `${defaultStyles.otherValue} dwm-json-other`,
  punctuation: `${defaultStyles.punctuation} dwm-json-punctuation`,
  expandIcon: `${defaultStyles.expandIcon} dwm-json-icon`,
  collapseIcon: `${defaultStyles.collapseIcon} dwm-json-icon`,
  collapsedContent: `${defaultStyles.collapsedContent} dwm-json-icon`,
}

/**
 * The state viewer: the state JSON, with each level that folds and unfolds. The fields of the top level show with no
 * braces around them, and each value below them starts folded. A click on a field name also folds and unfolds it.
 */
export function StateView({ data }: { data: unknown }) {
  if (data === null || typeof data !== 'object' || Object.keys(data).length === 0) {
    return <code className="dwm-json dwm-json-scalar" data-dw="state-viewer">{data === undefined ? 'undefined' : JSON.stringify(data)}</code>
  }
  return (
    <div className="dwm-json-box" data-dw="state-viewer">
      <JsonView data={data} style={jsonStyles} shouldExpandNode={collapseAllNested} compactTopLevel clickToExpandNode />
    </div>
  )
}

interface JsonSchema {
  type?: string | string[]
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  enum?: unknown[]
  const?: unknown
  anyOf?: JsonSchema[]
  oneOf?: JsonSchema[]
}

function typeName(schema: JsonSchema | undefined): string {
  if (schema === undefined) return 'any'
  if (schema.enum !== undefined) return schema.enum.map((value) => JSON.stringify(value)).join(' | ')
  if (schema.const !== undefined) return JSON.stringify(schema.const)
  const union = schema.anyOf ?? schema.oneOf
  if (union !== undefined) return union.map(typeName).join(' | ')
  if (schema.type === 'array') return `${typeName(schema.items)}[]`
  if (Array.isArray(schema.type)) return schema.type.join(' | ')
  return schema.type ?? 'any'
}

/** One line for the JSON Schema of the args of an action, for example `by: number, note?: string`. */
export function argsSummary(args: unknown): string {
  if (args === null || typeof args !== 'object') return 'no args'
  const schema = args as JsonSchema
  if (schema.type !== 'object' || schema.properties === undefined) return typeName(schema)
  const required = new Set(schema.required ?? [])
  const fields = Object.entries(schema.properties).map(([key, value]) => `${key}${required.has(key) ? '' : '?'}: ${typeName(value)}`)
  return fields.length === 0 ? 'no args' : fields.join(', ')
}

/** A timeout for people: `30 s`, `1.5 s`, `2 min`. */
export function formatMs(ms: number): string {
  if (ms >= 60_000 && ms % 60_000 === 0) return `${String(ms / 60_000)} min`
  if (ms >= 1000) return `${String(Math.round(ms / 100) / 10)} s`
  return `${String(ms)} ms`
}

/** The actions list: the name, the kind, the args, and the timeout of each action. */
export function ActionListView({ actions }: { actions: Action[] }) {
  if (actions.length === 0) return <span className="text-muted-foreground">No actions</span>
  return (
    <ul className="flex flex-col gap-1.5" data-dw="action-list">
      {actions.map((action) => (
        <li key={action.name} className="flex min-w-0 flex-col gap-0.5" data-dw="action">
          <span className="flex items-center gap-1.5">
            <code className="font-mono text-[12px] font-medium text-foreground">{action.name}</code>
            <span className="dwm-kind" data-kind={action.kind}>{action.kind}</span>
            <span className="ml-auto tabular-nums text-muted-foreground" title="Timeout">{formatMs(action.timeoutMs)}</span>
          </span>
          <code className="truncate font-mono text-[11px] text-muted-foreground" title={JSON.stringify(action.args, null, 2)}>{argsSummary(action.args)}</code>
        </li>
      ))}
    </ul>
  )
}
