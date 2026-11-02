/**
 * Safe mode check fixture (widget_phase2.isolation.supervisor): a widget that is not built in, with the package name
 * of the built-in sample bundle. The smoke check installs it through the plugin manager in safe mode. After the next
 * Host start, its row takes the module name of the sample, and ctx.widgets.register must still refuse it.
 */
export const name = 'deepwidgets-widget-built-in-name-test'
export const inject = ['widgets']

export function apply(ctx) {
  ctx.widgets.register({
    slug: 'built-in-name-test',
    title: 'Built-in name test',
    program: 'root = Card([CardHeader("Built-in name test", "Not built in")])\n',
    initialState: {},
    actions: [],
  })
}
