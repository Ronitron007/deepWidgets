/**
 * Check fixture of `widget.isolation_watchdog` (tools/widgets-watchdog.mjs and the watchdog smoke):
 * a widget whose actions block the host event loop the way a bad agent widget would.
 */
export const name = 'deepwidgets-widget-watchdog'
export const inject = ['widgets']

/** Block the event loop for `ms` milliseconds. */
function busy(ms) {
  const end = Date.now() + ms
  while (Date.now() < end) { /* the loop is the fault */ }
}

export function apply(ctx) {
  ctx.widgets.register({
    slug: 'watchdog',
    title: 'Watchdog',
    program: 'root = Card([CardHeader("Watchdog", "fixture")])\n',
    initialState: {},
    timeoutMs: 30_000,
    actions: [
      {
        // A loop with no end in an action: the watchdog must kill the host.
        name: 'spin',
        kind: 'query',
        handler: function watchdogSpin() {
          for (;;) busy(1_000)
        },
      },
      {
        // safe_host.watchdog: a loop after an await. The running slot holds 0, and the store names this widget.
        // With the native module, the innermost frame is in this file: a widget stall.
        name: 'spinAfterAwait',
        kind: 'query',
        handler: async function watchdogSpinAfterAwait() {
          await Promise.resolve()
          for (;;) busy(1_000)
        },
      },
      {
        // safe_host.watchdog: host work that this widget awaits holds the event loop. Its timer has the store of
        // this widget, but its frames are host code. The watchdog must not blame this widget.
        name: 'awaitHost',
        kind: 'query',
        handler: async function watchdogAwaitHost(args) {
          await ctx.get('watchdogHost').blockLater(Number(args?.ms ?? 3_000))
          return { awaited: true }
        },
      },
      {
        // A stall shorter than the threshold: the provisional record comes and goes, and the host lives.
        name: 'stall',
        kind: 'query',
        handler: function watchdogStall(args) {
          busy(Number(args?.ms ?? 900))
          return { stalled: true }
        },
      },
      {
        // CPU work of a fixed size, with no clock in the loop. A suspend in the middle does not shorten it.
        name: 'work',
        kind: 'query',
        handler: function watchdogWork(args) {
          const start = performance.now()
          const n = Number(args?.n ?? 10_000_000)
          let x = 1
          for (let i = 0; i < n; i += 1) x = (x * 48_271) % 2_147_483_647
          return { x, ms: Math.round(performance.now() - start) }
        },
      },
      {
        // A stall past a quarter of the threshold, then fast allocation until V8 aborts out of memory.
        // Only the provisional record can blame this end. Run the host with a small --max-old-space-size.
        name: 'alloc',
        kind: 'query',
        handler: function watchdogAlloc() {
          busy(800)
          const keep = []
          for (;;) keep.push(new Array(1_000_000).fill(keep.length))
        },
      },
    ],
  })
}
