/**
 * The sample widget (`widget_mvp.sample`): a counter with the slug `sample`.
 * With the config `tickMs` greater than 0, a timer adds 1 at that interval.
 * @module @deepwidgets/widget-sample
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-timer'
import Schema from '@deepseek-ai/schemastery'
import type {} from '@deepwidgets/widgets'
import { z } from 'zod'

/** The state of the counter. */
export interface SampleState {
  count: number
}

/** The seed program: the count and a button that runs `add` with `{ by: 1 }`. */
export const PROGRAM = `root = Card([CardHeader("Sample", "A counter"), Stat("Count", s.count), Button("Add 1", Action([@Run(add), @Run(s)]))])
s = Query("get", {}, {count: 0})
add = Mutation("add", {by: 1})
`

export const name = 'deepwidgets-widget-sample'
export const inject = ['widgets', 'timer']

export interface Config {
  /** The interval of the timer in ms. 0 turns the timer off. */
  tickMs: number
}

export const Config: Schema<Config> = Schema.object({
  tickMs: Schema.natural().default(0),
})

export function apply(ctx: Context, config: Config): void {
  ctx.widgets.register({
    slug: 'sample',
    title: 'Sample',
    program: PROGRAM,
    initialState: { count: 0 } satisfies SampleState,
    actions: [
      { name: 'get', kind: 'query', handler: (_args, w) => w.state },
      {
        name: 'add',
        kind: 'mutation',
        args: z.object({ by: z.number() }),
        handler: ({ by }, w) => w.update((state) => ({ count: state.count + by })),
      },
    ],
  })

  if (config.tickMs > 0) {
    ctx.interval(() => {
      // A timer callback does not contain a rejection, so catch it here.
      ctx.widgets.update<SampleState>('sample', (state) => ({ count: state.count + 1 }), { by: 'timer' })
        .catch((error: unknown) => { ctx.logger.warn('widget-sample: the timer did not add 1', error) })
    }, config.tickMs)
  }
}
