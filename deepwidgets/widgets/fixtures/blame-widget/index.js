/**
 * Check fixture of `widget.isolation_blame` (tools/widgets-blame.mjs): a widget that arms one fault on request.
 * Each fault leaves widget code the way agent code would: raw timers, floating promises, listeners, host service calls.
 * Ported from the spike `crash_only` (deepwidgets/widgets/blame.js at 19039136).
 */
export const name = 'deepwidgets-widget-blame'
export const inject = ['widgets', 'blameHost']

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

export function apply(ctx) {
  const armed = { listener: false }
  ctx.on('blamehost/tick', function widgetListener() {
    if (armed.listener) throw new Error('blame: widget listener threw on a host emit')
  })

  const cases = {
    'timer-throw': () => { setTimeout(function widgetTimer() { throw new Error('blame: timer throw') }, 50) },
    'interval-throw': () => { setInterval(function widgetInterval() { throw new Error('blame: interval throw') }, 50) },
    'promise-reject': () => { void (async function widgetAsync() { await sleep(50); throw new Error('blame: promise rejection') })() },
    'fetch-reject': ({ url }) => { void fetch(url).then(function widgetFetched(response) { return response.text() }) },
    'listener-throw': () => { armed.listener = true },
    'service-throw': () => { setTimeout(function widgetCallsService() { ctx.blameHost.explode() }, 50) },
    'service-reject': () => { void ctx.blameHost.explodeLater() },
    'string-throw': () => { setTimeout(function widgetStringThrow() { throw 'blame: a thrown string' }, 50) },
  }

  ctx.widgets.register({
    slug: 'blame',
    title: 'Blame',
    program: 'root = Card([CardHeader("Blame", "fixture")])\n',
    initialState: {},
    timeoutMs: 30_000,
    actions: [{
      name: 'arm',
      kind: 'query',
      handler: (args) => {
        const run = cases[args.case]
        if (run === undefined) throw new Error(`no case ${String(args.case)}`)
        run(args)
        return { armed: args.case }
      },
    }],
  })
}
