/**
 * The component set `shadcn-widgets@1`: the widget-sized subset of the OpenUI shadcn example
 * (thesysdev/openui examples/design-systems/shadcn @ 9bc3192), plus the widget-only parts
 * Stat, Row, List, Empty, a reactive Input, a Checkbox with an action, and a Button with action().
 * The charts render from a lazy chunk. Ported from the overnight shell spike.
 * @module @deepwidgets/shell/library
 */
import { Suspense, lazy, useId } from 'react'
import { z } from 'zod'
import { action, createLibrary, defineComponent, reactive, useStateField, useTriggerAction } from '@openuidev/react-lang'
import type { ChartProps } from './charts-impl.tsx'
import { Alert } from './components/alert.tsx'
import { ShadcnBadgeComponent as Badge } from './components/badge.tsx'
import { CardHeader } from './components/card-header.tsx'
import { Progress } from './components/progress.tsx'
import { Separator } from './components/separator.tsx'
import { Col, Table } from './components/table.tsx'
import { TextContent } from './components/text-content.tsx'
import { Button as UiButton } from './ui/button.tsx'
import { Checkbox as UiCheckbox } from './ui/checkbox.tsx'
import { Input as UiInput } from './ui/input.tsx'

// action() gives a wider type than useTriggerAction takes under exactOptionalPropertyTypes; the values are the same.
type TriggerPlan = Parameters<ReturnType<typeof useTriggerAction>>[2]

/** The id of this component set. A program that names another id is refused. */
export const CATALOG_ID = 'shadcn-widgets@1'

const Stat = defineComponent({
  name: 'Stat',
  description: 'Key number: small label, large value, optional note.',
  props: z.object({ label: z.string(), value: z.union([z.string(), z.number()]), note: z.string().optional() }),
  component: ({ props }) => (
    <div className="flex flex-col gap-0.5 min-w-0" data-dw="stat">
      <span className="text-xs text-muted-foreground truncate">{props.label}</span>
      <strong className="text-2xl font-semibold tabular-nums truncate" data-dw="stat-value">{String(props.value)}</strong>
      {props.note === undefined ? null : <span className="text-xs text-muted-foreground">{props.note}</span>}
    </div>
  ),
})

const Button = defineComponent({
  name: 'Button',
  description: 'Button that runs an action. variant: "default" | "secondary" | "outline" | "ghost" | "destructive". size: "default" | "sm".',
  props: z.object({
    label: z.string(),
    action: action().optional(),
    variant: z.enum(['default', 'secondary', 'outline', 'ghost', 'destructive']).optional(),
    size: z.enum(['default', 'sm']).optional(),
  }),
  component: ({ props }) => {
    const trigger = useTriggerAction()
    return (
      <UiButton variant={props.variant ?? 'default'} size={props.size ?? 'sm'} data-dw="button"
        onClick={() => { void trigger(props.label, undefined, props.action as TriggerPlan) }}>
        {props.label}
      </UiButton>
    )
  },
})

const Input = defineComponent({
  name: 'Input',
  description: 'Text input. Bind a $variable as value to read it in actions.',
  props: z.object({ name: z.string(), placeholder: z.string().optional(), value: reactive(z.string().optional()) }),
  component: ({ props }) => {
    const field = useStateField(props.name, props.value)
    return (
      <UiInput className="h-8 w-auto flex-1 min-w-32" name={props.name} placeholder={props.placeholder}
        value={field.value ?? ''} onChange={(event) => { field.setValue(event.target.value) }} />
    )
  },
})

const Checkbox = defineComponent({
  name: 'Checkbox',
  description: 'Checkbox row with a label. checked shows state; action runs on toggle.',
  props: z.object({ label: z.string(), checked: z.boolean().optional(), action: action().optional() }),
  component: ({ props }) => {
    const trigger = useTriggerAction()
    const id = useId()
    return (
      <label htmlFor={id} className="flex items-center gap-2 py-1 min-w-0">
        <UiCheckbox id={id} checked={props.checked === true} onCheckedChange={() => { void trigger(props.label, undefined, props.action as TriggerPlan) }} />
        <span className={'truncate ' + (props.checked === true ? 'line-through text-muted-foreground' : '')}>{props.label}</span>
      </label>
    )
  },
})

const Empty = defineComponent({
  name: 'Empty',
  description: 'Empty state: title and optional hint. Use when a list has no rows.',
  props: z.object({ title: z.string(), hint: z.string().optional() }),
  component: ({ props }) => (
    <div className="flex flex-col items-center gap-1 py-4 text-center">
      <span className="text-sm font-medium">{props.title}</span>
      {props.hint === undefined ? null : <span className="text-xs text-muted-foreground">{props.hint}</span>}
    </div>
  ),
})

// Charts: the schema is here (the parser and the prompt need it); the renderer is in a lazy chunk.
const SeriesSchema = z.object({ category: z.string(), values: z.array(z.number()) })
const Series = defineComponent({ name: 'Series', description: 'One named data series with values matching labels.', props: SeriesSchema, component: () => null })
const LazyBar = lazy(() => import('./charts-impl.tsx').then((module) => ({ default: module.BarChartImpl })))
const LazyLine = lazy(() => import('./charts-impl.tsx').then((module) => ({ default: module.LineChartImpl })))
const chartFallback = <div className="dw-skeleton" style={{ height: 160 }} />
// Each chart needs its own props schema object. A shared object prints both names as one in the prompt.
const chartProps = () => z.object({ labels: z.array(z.string()), series: z.array(SeriesSchema) })
const BarChart = defineComponent({
  name: 'BarChart', description: 'Vertical bar chart for comparing values across categories.', props: chartProps(),
  component: ({ props }) => <Suspense fallback={chartFallback}><LazyBar props={props satisfies ChartProps} /></Suspense>,
})
const LineChart = defineComponent({
  name: 'LineChart', description: 'Line chart for trends over categories.', props: chartProps(),
  component: ({ props }) => <Suspense fallback={chartFallback}><LazyLine props={props satisfies ChartProps} /></Suspense>,
})

const leafRefs = [CardHeader, TextContent, Stat, Button, Input, Checkbox, Badge, Progress, Alert, Separator, Table, Empty, BarChart, LineChart]
  .map((component) => component.ref)

const Row = defineComponent({
  name: 'Row',
  description: 'Horizontal group. Children sit side by side and wrap when narrow.',
  props: z.object({ children: z.array(z.union(leafRefs)) }),
  component: ({ props, renderNode }) => <div className="flex flex-wrap items-center gap-2 [&>*]:min-w-0">{renderNode(props.children)}</div>,
})

const List = defineComponent({
  name: 'List',
  description: 'Vertical list of rows, for example @Each output. Separates rows with a hairline.',
  props: z.object({ children: z.array(z.union([...leafRefs, Row.ref])) }),
  component: ({ props, renderNode }) => <div className="flex flex-col divide-y divide-border [&>*]:min-w-0">{renderNode(props.children)}</div>,
})

const Card = defineComponent({
  name: 'Card',
  description: 'The widget body. Children stack top to bottom.',
  props: z.object({ children: z.array(z.union([...leafRefs, Row.ref, List.ref])) }),
  component: ({ props, renderNode }) => <div className="flex flex-col gap-3 min-w-0" data-dw="card">{renderNode(props.children)}</div>,
})

/** The library of `shadcn-widgets@1`. The root is `Card`. */
export const widgetLibrary = createLibrary({
  root: 'Card',
  components: [Card, Row, List, CardHeader, TextContent, Stat, Button, Input, Checkbox, Badge, Progress, Alert, Separator, Table, Col, Empty, BarChart, LineChart, Series],
})
