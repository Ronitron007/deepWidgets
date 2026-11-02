// Host A for the claimer replays: createIsolation, optional track(), then an uncaught
// error inside the widget's blame store reaches the fatal hook (ISO:251-284). Exits 1.
// argv: row registerFlag root
import { createIsolation, runAs } from '../../../../../deepwidgets/widgets/src/isolation.ts'
import { fakeCtx } from './fake-ctx.ts'
const [row, register, root] = process.argv.slice(2)
const { ctx } = fakeCtx()
const isolation = createIsolation(ctx, { hold: () => async () => {} })
if (register === '1') isolation.track(row, root, row.replace('deepwidgets-widget-', ''))
const hooks = (globalThis as Record<symbol, Set<(e: unknown, ev: string) => void>>)[Symbol.for('deepwidgets.fatal.hooks')]
setTimeout(() => {
  runAs(row, () => { for (const hook of hooks) hook(new Error('widget bug'), 'uncaughtException') })
}, 50)
