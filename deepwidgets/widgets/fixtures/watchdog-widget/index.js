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
        // as_host_guard_bypass: this widget is not built in, so each path to widgetRecords.asHost must refuse it. With
        // `loop`, a refused call runs the loop here, in the call of this widget: the watchdog blames it by its slot.
        // A path that let it in would run the loop as host code, with no widget in the slot.
        name: 'asHost',
        kind: 'query',
        handler: function watchdogAsHost(args) {
          const path = String(args?.path ?? 'service')
          const fn = () => {
            if (args?.loop === true) for (;;) busy(1_000)
            return 'ran as host code'
          }
          const paths = {
            service: () => ctx.get('widgetRecords').asHost(fn),
            recordsRuntime: () => ctx.get('widgetRecords').runtime.asHost(fn),
            widgetsRuntime: () => ctx.widgets.runtime.asHost(fn),
            mainContext: () => {
              const main = [...ctx.get('loader').entries()].find((entry) => entry.options?.name === '@deepwidgets/widget-main')
              return main.fiber.ctx.get('widgetRecords').asHost(fn)
            },
          }
          try {
            return { path, ran: paths[path]() }
          } catch (error) {
            if (args?.loop === true) fn()
            return { path, refused: String(error?.message ?? error) }
          }
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
