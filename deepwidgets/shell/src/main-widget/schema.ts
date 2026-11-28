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
  /** The shown state of the widget window (`main_widget.window_state`). Absent for a widget with no window. */
  window: z.enum(['shown', 'hidden']).optional(),
  /**
   * The layer, the lock, and the stored position of the widget window (`window_manager.panel`). `x` and `y` are absent
   * when no position is stored: the window is at the default position. Absent for a widget with no window.
   */
  windowData: z.object({
    layer: z.enum(['top', 'normal']),
    locked: z.boolean(),
    x: z.number().optional(),
    y: z.number().optional(),
  }).optional(),
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

/** The status of the widget kit (`kit.pane.view`). */
export const KitStatusSchema = z.enum(['starting', 'ready', 'changing', 'unavailable'])
export type KitStatus = z.infer<typeof KitStatusSchema>

/** One package of the kit, with its version: the version of the app for the core, an exact version for an extra. */
export const KitPackageSchema = z.object({ name: z.string(), version: z.string() })
export type KitPackage = z.infer<typeof KitPackageSchema>

/** The change that runs now: `add` with its spec or `remove` with its name, and its start time in ms since the epoch. */
export const KitChangeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), spec: z.string(), startedAt: z.number() }),
  z.object({ kind: z.literal('remove'), name: z.string(), startedAt: z.number() }),
])
export type KitChange = z.infer<typeof KitChangeSchema>

/** Why a change failed: the code of the kit, its message, and the pnpm code and the package when pnpm names them. */
const KitErrorSchema = z.object({ code: z.string(), message: z.string(), pnpmCode: z.string().optional(), package: z.string().optional() })

/** The result of the last change: the kit version that it made, or its error. `endedAt` is in ms since the epoch. */
export const KitLastSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('add'), spec: z.string(), endedAt: z.number(), version: z.number().optional(), error: KitErrorSchema.optional() }),
  z.object({ kind: z.literal('remove'), name: z.string(), endedAt: z.number(), version: z.number().optional(), error: KitErrorSchema.optional() }),
])
export type KitLast = z.infer<typeof KitLastSchema>

/** The names of `kit.refuseBuilds` and the settings file, as `setRefuseBuilds` gives them. */
export const RefuseBuildsSchema = z.object({ file: z.string(), names: z.array(z.string()) })

/**
 * The part `kit` of the query `settings` (type `MainKit`). The refuse list is a refusal of its own when the host has
 * no MCP settings or the settings file does not parse; the rest of the part still shows.
 */
export const KitSchema = z.object({
  status: KitStatusSchema,
  version: z.number().optional(),
  available: z.boolean(),
  reason: z.string().optional(),
  change: KitChangeSchema.optional(),
  last: KitLastSchema.optional(),
  core: z.array(KitPackageSchema),
  extras: z.array(KitPackageSchema),
  refuseBuilds: z.union([RefuseBuildsSchema.extend({ ok: z.literal(true) }), RefusalSchema]),
})
export type Kit = z.infer<typeof KitSchema>

/** The part `kit`, or a refusal when the host has no widget kit. */
export const KitAnswerSchema = z.union([KitSchema.extend({ ok: z.literal(true) }), RefusalSchema])

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
