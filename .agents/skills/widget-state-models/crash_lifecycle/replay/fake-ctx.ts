// A minimal Cordis context for createIsolation (ISO:167): logger, effect, registry, on.
export function fakeCtx() {
  const plugins: ((fiber: unknown) => void)[] = []
  const ctx = {
    logger: { warn: (m: string) => { console.log(`[warn] ${m}`) }, info: () => {}, error: () => {} },
    effect: (fn: () => unknown) => fn(),
    registry: { values: () => [] },
    on: (name: string, cb: (fiber: unknown) => void) => { if (name === 'internal/plugin') plugins.push(cb) },
  }
  /** Load the Loader row `row` through the isolation's fiber wrapper; returns 'held' or 'ran'. */
  const load = (row: string): 'held' | 'ran' => {
    const fiber = { entry: { id: row, options: { id: row } }, parent: { fiber: {} }, _runner: { execute: () => 'ran' } }
    for (const cb of plugins) cb(fiber)
    const result = (fiber._runner.execute as (this: unknown) => unknown).call(fiber)
    return result === 'ran' ? 'ran' : 'held'
  }
  return { ctx: ctx as never, load }
}
