/**
 * Check fixture of `widget.crash_records` (tools/widgets-crash-replay.mjs, specs `safe_host.crash` and
 * `widget_fv.crash`): a widget whose code throws before it registers its slug `throwfirst`.
 * - By default, the plugin body throws. The widget must show as failed with the reason.
 * - With `DEEPWIDGETS_THROWFIRST=async` in the host environment, a timer of the widget throws an uncaught error. The
 *   crash record must have the root and the hash of this package.
 * - With `DEEPWIDGETS_THROWFIRST=ok`, the widget registers and runs. Its action `armDisposeLoop` makes its
 *   disposer hold the event loop in the files of this widget (safe_host.cleanup).
 */
export const name = 'deepwidgets-widget-throwfirst'
export const inject = ['widgets']

export function apply(ctx) {
  if (process.env.DEEPWIDGETS_THROWFIRST === 'ok') {
    let loop = false
    ctx.effect(() => () => {
      if (!loop) return
      for (;;) { /* the disposer of this widget never ends */ }
    }, 'throwfirst: the disposer')
    ctx.widgets.register({
      slug: 'throwfirst',
      title: 'Throw first',
      program: 'root = Card([CardHeader("Throw first", "fixture")])\n',
      initialState: {},
      actions: [
        { name: 'ping', kind: 'query', handler: () => ({ ok: true }) },
        { name: 'armDisposeLoop', kind: 'query', handler: () => { loop = true; return { armed: true } } },
      ],
    })
    return
  }
  if (process.env.DEEPWIDGETS_THROWFIRST === 'async') {
    setTimeout(function widgetTimer() { throw new Error('throwfirst: a timer threw before the widget registered') }, 50)
    return
  }
  throw new Error('throwfirst: the plugin body threw before it registered')
}
