// A minimal Cordis context for createIsolation (ISO:205): logger, effect, registry, on, and get('pluginPackages').
/** `roots` maps a Loader row to its package folder, as the profile package lookup finds it (widget_fv.crash). */
export function fakeCtx(roots: Record<string, string> = {}) {
  const plugins: ((fiber: unknown) => void)[] = []
  const pluginPackages = { packageOf: (name: string) => (roots[name] === undefined ? undefined : { dir: roots[name] }) }
  const ctx = {
    logger: { warn: (m: string) => { console.log(`[warn] ${m}`) }, info: () => {}, error: () => {} },
    effect: (fn: () => unknown) => fn(),
    registry: { values: () => [] },
    on: (name: string, cb: (fiber: unknown) => void) => { if (name === 'internal/plugin') plugins.push(cb) },
    get: (name: string) => (name === 'pluginPackages' ? pluginPackages : undefined),
  }
  /**
   * Load the Loader row `row` through the isolation's fiber wrapper. `body` is its plugin body.
   * @returns 'held', 'ran', or 'threw'.
   */
  const load = (row: string, body: () => unknown = () => 'ran'): 'held' | 'ran' | 'threw' => {
    const fiber = {
      entry: { id: row, options: { id: row, name: row }, parent: { tree: { ctx: { baseUrl: 'file:///profile/' } } } },
      parent: { fiber: {} },
      ctx: { effect: (fn: () => unknown) => fn() },
      _runner: { execute: body },
    }
    for (const cb of plugins) cb(fiber)
    try {
      const result = (fiber._runner.execute as (this: unknown) => unknown).call(fiber)
      return result === 'ran' ? 'ran' : 'held'
    } catch {
      return 'threw'
    }
  }
  return { ctx: ctx as never, load }
}
