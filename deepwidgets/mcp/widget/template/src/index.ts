/**
 * A widget bundle: one widget, written in TypeScript. Change the slug, the title, the state,
 * the actions, and the program. Keep `name`, `inject`, and `apply`.
 * - A timer uses ctx.interval or ctx.timeout, never setTimeout or setInterval.
 * - Await each promise, or end it with .catch().
 * - The program is OpenUI Lang. Call widget_guide for the components.
 */
import type { WidgetContext } from 'deepwidgets:widget'
import { z } from 'zod'

const SLUG = '__SLUG__'

interface State {
  count: number
}

const PROGRAM = `root = Card([CardHeader("__TITLE__", "A counter"), Stat("Count", s.count), Row([Button("Add 1", Action([@Run(add), @Run(s)])), Button("Reset", Action([@Run(reset), @Run(s)]), "outline")])])
s = Query("get", {}, {count: 0})
add = Mutation("add", {by: 1})
reset = Mutation("reset", {})
`

export const name = `widget-${SLUG}`
export const inject = ['widgets', 'timer']

export function apply(ctx: WidgetContext): void {
  ctx.widgets.register({
    slug: SLUG,
    title: '__TITLE__',
    program: PROGRAM,
    initialState: { count: 0 } satisfies State as State,
    actions: [
      { name: 'get', kind: 'query', handler: (_args, w) => w.state },
      {
        name: 'add',
        kind: 'mutation',
        args: z.object({ by: z.number().int().default(1) }),
        handler: ({ by }, w) => w.update((state) => ({ count: state.count + by })),
      },
      { name: 'reset', kind: 'mutation', handler: (_args, w) => w.update(() => ({ count: 0 })) },
    ],
  })
}
