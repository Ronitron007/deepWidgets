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

  /**
   * The first window data of a new widget. The operator can change the layer, the lock, the place, and a size of a
   * resizable window. A reinstall, a reload, or a Turn on keeps the window as it is: a change here applies only to a
   * slug that has no window yet. In the app, a bar with the controls of the operator covers the top 24 points of the
   * window while the mouse is over it. Keep the controls of the page out of that strip.
   */
  export interface WidgetWindow {
    /** 'top': above each app window, on each desktop. 'normal': on one desktop, and app windows can cover it. Default 'top'. */
    layer?: 'top' | 'normal'
    /** The width in points, a whole number from 80 to 4096. Default 320. */
    width?: number
    /** The height in points, a whole number from 80 to 4096. Default 300. */
    height?: number
    /** true: the operator can resize the window at its edges. Default false. */
    resizable?: boolean
  }

  /** A widget definition. */
  export interface WidgetDef<S, T extends readonly unknown[] = readonly unknown[]> {
    /** Lowercase letters, digits, and `-`. At most 63 characters. */
    slug: string
    title: string
    /** The seed OpenUI Lang text. See widget_guide. */
    program: string
    /**
     * The id of the component set of the program. The default is `shadcn-widgets@1`, the set of the shared page.
     * A widget with a page sets it to the `CATALOG_ID` of `page/child.tsx`. See widget_guide with mode "library".
     */
    catalog?: string
    /** The first window data of a new widget. A bad value fails the registration. */
    window?: WidgetWindow
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
