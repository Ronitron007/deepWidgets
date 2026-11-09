// Host A for the claimer replays: createIsolation, then the Loader starts the widget row. Optional track(), then an
// uncaught error in a timer of the widget code reaches the fatal hook (ISO:claim) in the blame store of the row.
// The hook writes the record; the fail-loud release then exits 1 (apps/cli/src/profile-boot.ts), as here.
// argv: row registerFlag root (root: the package folder of the row, as the profile package lookup finds it)
import { createIsolation } from '../../../../../deepwidgets/widgets/src/isolation.ts'
import { fakeCtx } from './fake-ctx.ts'
const [row, register, root] = process.argv.slice(2)
const { ctx, load } = fakeCtx(root === '' ? {} : { [row]: root })
const isolation = createIsolation(ctx, { hold: () => async () => {}, failed: () => {} })
const hooks = (globalThis as Record<symbol, Set<(e: unknown, ev: string) => void>>)[Symbol.for('deepwidgets.fatal.hooks')]
load(row, () => {
  if (register === '1') isolation.track(row, root, row.replace(/^deepwidgets-(?:widget|agent)-/, ''))
  setTimeout(() => {
    for (const hook of hooks) hook(new Error('widget bug'), 'uncaughtException')
    process.exit(1)
  }, 50)
  return 'ran'
})
