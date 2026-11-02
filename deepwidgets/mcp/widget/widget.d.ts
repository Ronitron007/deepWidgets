/**
 * The widget type file (`widget_phase2.creation.gates`): the API that a widget bundle sees.
 * A widget imports it with `import type { WidgetContext } from 'deepwidgets:widget'`.
 * The types follow `@deepwidgets/widgets` (the runtime) and the Cordis timer service.
 */
declare module 'deepwidgets:widget' {
  import type { z } from 'zod'

  /** What a handler gets as `w`. */
  export interface WidgetScope<S> {
    /** The current state. */
    readonly state: S
    /** Write the state with a synchronous transform. Only a mutation can write. */
    update(fn: (state: S) => S): Promise<S>
    /** Aborted at the timeout of the call. */
    readonly signal: AbortSignal
  }

  /** One action. A user click and an agent call run the same action. */
  export interface WidgetAction<S, A = unknown> {
    /** Letters, digits, and `_`. It starts with a letter. */
    name: string
    kind: 'query' | 'mutation'
    /** The zod schema of the args. The runtime checks the args before the call. */
    args?: z.ZodType<A>
    /** The call limit in ms. The default is 5000. */
    timeoutMs?: number
    handler(args: A, w: WidgetScope<S>): unknown
  }

  /** A widget definition. */
  export interface WidgetDef<S, T extends readonly unknown[] = readonly unknown[]> {
    /** Lowercase letters, digits, and `-`. At most 63 characters. */
    slug: string
    title: string
    /** The seed OpenUI Lang text. See widget_guide. */
    program: string
    initialState: S
    timeoutMs?: number
    actions: { readonly [K in keyof T]: WidgetAction<S, T[K]> }
  }

  export interface Widgets {
    /** Register the one widget of this bundle. The registration ends when the widget stops. */
    register<S, const T extends readonly unknown[]>(def: WidgetDef<S, T>): () => Promise<void>
    /** Write the state from a timer. It waits behind the running mutations. */
    update<S>(slug: string, fn: (state: S) => S, options?: { by?: string }): Promise<S>
  }

  export interface Logger {
    debug(...args: unknown[]): void
    info(...args: unknown[]): void
    warn(...args: unknown[]): void
    error(...args: unknown[]): void
  }

  /** The `ctx` of a widget bundle: inject `['widgets', 'timer']`. */
  export interface WidgetContext {
    readonly widgets: Widgets
    readonly logger: Logger
    /** Run `callback` once after `ms`. The timer stops with the widget. */
    timeout(callback: () => void, ms: number): () => void
    /** Run `callback` every `ms`. The timer stops with the widget. */
    interval(callback: () => void, ms: number): () => void
    /** Run `execute` now. Its disposer runs when the widget stops. */
    effect(execute: () => (() => void) | Promise<() => void>, label?: string): () => Promise<void>
  }
}
