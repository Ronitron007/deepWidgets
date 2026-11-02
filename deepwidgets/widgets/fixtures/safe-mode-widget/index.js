/**
 * Safe mode check fixture (widget_phase2.isolation.supervisor): a widget that is not built in.
 * The smoke check installs it through the plugin manager. In safe mode, ctx.widgets.register refuses it.
 */
export const name = 'deepwidgets-widget-safe-mode-test'
export const inject = ['widgets']

export function apply(ctx) {
  ctx.widgets.register({
    slug: 'safe-mode-test',
    title: 'Safe mode test',
    program: 'root = Card([CardHeader("Safe mode test", "Not built in")])\n',
    initialState: {},
    actions: [],
  })
}
