/**
 * Check fixture of `widget.isolation_blame`: a widget whose timer throws 1 s after it loads.
 * The smoke check sets THROW to false in the installed copy. That changes a file of the widget, so the quarantine lifts.
 */
export const name = 'deepwidgets-widget-blame-timer'
export const inject = ['widgets', 'timer']

const THROW = true

export function apply(ctx) {
  ctx.widgets.register({
    slug: 'blame-timer',
    title: 'Blame timer',
    program: 'root = Card([CardHeader("Blame timer", "alive")])\n',
    initialState: { alive: true },
    actions: [{ name: 'get', kind: 'query', handler: (_args, w) => w.state }],
  })
  if (THROW) ctx.timeout(function blameTimerThrow() { throw new Error('blame-timer: the timer threw') }, 1000)
}
