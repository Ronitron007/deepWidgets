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
  /** Each plugin row is off. In safe mode the status stays `safe-mode`, and this field shows the Turn off. */
  turnedOff: z.literal(true).optional(),
  window: z.literal('shown').optional(),
})
export type Widget = z.infer<typeof WidgetSchema>

/** The answer of the query `program` of main. */
export const ProgramTextSchema = z.object({ slug: z.string(), rev: z.number(), text: z.string() })

/**
 * The data of the Settings tab (`main_widget.settings`): the answer of the query `settings` of main (type
 * `MainSettings`). Each section is a result of main: `ok: true` with its fields, or a refusal with a code.
 */
const RefusalSchema = z.object({ ok: z.literal(false), code: z.string(), message: z.string() })

/** One MCP mode. `setting` is null for `interact`, which is always on. */
export const ModeSchema = z.object({ name: z.string(), goal: z.string(), setting: z.string().nullable(), on: z.boolean() })
export type Mode = z.infer<typeof ModeSchema>

/** The MCP modes and the settings file. `error`: the file does not parse, and no switch writes it. */
export const ModesSchema = z.object({ file: z.string(), modes: z.array(ModeSchema), error: z.string().optional() })
export const ModesAnswerSchema = z.union([ModesSchema.extend({ ok: z.literal(true) }), RefusalSchema])

/** The port in mcp.json and the path of the file. `error` when the file holds no port. */
export const PortAnswerSchema = z.union([
  z.object({ ok: z.literal(true), file: z.string(), port: z.number().optional(), error: z.string().optional() }),
  RefusalSchema,
])

/** The status of the login item that macOS gives. */
export const LoginStatusSchema = z.enum(['enabled', 'requires-approval', 'not-registered', 'not-found'])
export type LoginStatus = z.infer<typeof LoginStatusSchema>

/** The launch-at-login switch, as Electron main reads it back. `settable` is false in a dev run. */
export const LoginItemAnswerSchema = z.union([
  z.object({
    ok: z.literal(true),
    settable: z.boolean(),
    blocked: z.enum(['dev-run', 'platform']).optional(),
    openAtLogin: z.boolean(),
    status: LoginStatusSchema.optional(),
  }),
  RefusalSchema,
])
