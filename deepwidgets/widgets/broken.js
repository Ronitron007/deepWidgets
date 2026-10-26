// Test-only plugin: registers a widget, then crashes during apply.
export const name = 'deepwidgets-widget-broken'
export const inject = ['widgets']

export function apply(ctx) {
  ctx.widgets.register({ slug: 'broken', title: 'Broken', program: 'root = TextContent("x")', actions: [] })
  throw new Error('broken widget plugin crashed on load')
}
