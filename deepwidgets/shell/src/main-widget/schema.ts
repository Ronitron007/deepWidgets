/**
 * The data of the Widgets tab (`main_widget.widgets`): the answer of the query `widgets` of the host half of main
 * (`@deepwidgets/widget-main`, type `MainWidget`). The page parses each row at this boundary, because a query result
 * reaches a component without a check of its props.
 * @module @deepwidgets/shell/main-widget/schema
 */
import { z } from 'zod'

/** The status of one widget. */
export const StatusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('live') }),
  /** Quarantined after a crash, or its row did not register the widget. */
  z.object({ kind: z.literal('failed'), reason: z.string() }),
  z.object({ kind: z.literal('safe-mode'), message: z.string() }),
  /** The operator turned each plugin row of the widget off. */
  z.object({ kind: z.literal('turned-off') }),
])
export type Status = z.infer<typeof StatusSchema>

/** One action: its name, its kind, the JSON Schema of its args (null for none), and its timeout. */
export const ActionSchema = z.object({
  name: z.string(),
  kind: z.enum(['query', 'mutation']),
  args: z.unknown(),
  timeoutMs: z.number(),
})
export type Action = z.infer<typeof ActionSchema>

/** The stored state of a widget and its rev. */
export const StateSchema = z.object({ rev: z.number(), data: z.unknown() })
export type State = z.infer<typeof StateSchema>

/** One row of the Widgets tab. A field that needs a live widget is absent when it is not live. */
export const WidgetSchema = z.object({
  slug: z.string(),
  title: z.string().optional(),
  status: StatusSchema,
  agent: z.boolean(),
  catalog: z.string().optional(),
  state: StateSchema.optional(),
  program: z.object({ rev: z.number() }).optional(),
  actions: z.array(ActionSchema).optional(),
  source: z.string().optional(),
  rows: z.array(z.object({ id: z.string(), entryId: z.string(), name: z.string(), enabled: z.boolean() })),
  window: z.literal('shown').optional(),
})
export type Widget = z.infer<typeof WidgetSchema>

/** The answer of the query `program` of main. */
export const ProgramTextSchema = z.object({ slug: z.string(), rev: z.number(), text: z.string() })
