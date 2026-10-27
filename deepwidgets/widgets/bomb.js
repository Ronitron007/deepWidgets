// Test-only plugin: a widget whose timer throws (uncaught) or rejects (unhandled) after a delay.
export const name = 'deepwidgets-widget-bomb'
export const inject = ['widgets']

export function apply(ctx) {
  const mode = process.env.DEEPWIDGETS_WIDGETS_BOMB
  const delay = Number(process.env.DEEPWIDGETS_BOMB_MS ?? 3_000)
  ctx.widgets.register({
    slug: 'bomb',
    title: 'Bomb',
    program: 'root = Card([TextContent(@Count(s.ticks))])\ns = Query("state", {}, {ticks: []})',
    initialState: { ticks: [] },
    actions: [{ name: 'state', kind: 'query', handler: (_args, w) => w.state }],
  })
  // A raw timer, not ctx.timeout: the error leaves Cordis and reaches the process handlers.
  const timer = setTimeout(function bombTimer() {
    if (mode === 'reject') Promise.reject(new Error('bomb: unhandled rejection from a widget timer'))
    else throw new Error('bomb: uncaught exception from a widget timer')
  }, delay)
  ctx.effect(() => () => clearTimeout(timer), 'bomb timer')
  // A leaked raw interval (no effect): it keeps throwing after the plugin unloads.
  if (process.env.DEEPWIDGETS_BOMB_LEAK === '1') setInterval(function leakedTimer() { throw new Error('bomb: leaked interval threw again') }, 1_000).unref()
}
