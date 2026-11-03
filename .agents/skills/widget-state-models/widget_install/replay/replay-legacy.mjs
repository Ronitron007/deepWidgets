// replace.keeps_old (FailedReplaceKeepsOld), widget_fv.replace: a reinstall over an agent bundle with the older row id
// deepwidgets-widget-<slug>. That bundle uses the folder of the current name, so the new version goes under the second
// name. A reinstall that throws in the host leaves the older bundle live, with its state and its program. A good
// reinstall then moves the slug to deepwidgets-agent-<slug>.b, and the older bundle goes.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, afterRegister, compose, short, checks, recordOf, outside, agentDeps } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-legacy-'))
const host = new Host(work)
const { check, done } = checks('replay legacy')
const OLD = 'deepwidgets-widget-a'
const deps = () => {
  const pkg = JSON.parse(readFileSync(join(host.home, 'profiles/web/package.json'), 'utf8'))
  return Object.keys(pkg.dependencies ?? {}).filter((name) => name === OLD || name.startsWith('deepwidgets-agent-a')).sort()
}
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const v1 = writeWidget(work, 'a-v1', tpl, program('SEED-P1'))
  const r1 = await host.call('widget_install', { dir: v1 })
  if (r1.isError) throw new Error(`install v1: ${short(r1.body)}`)
  // Make the older bundle: keep a copy of the folder, remove the bundle, rename the copy, and install it in the host.
  const folder = join(host.home, 'profiles/web/deepwidgets-widgets/a')
  const copy = join(work, 'legacy-copy')
  cpSync(folder, copy, { recursive: true })
  const removed = await host.call('widget_remove', { slug: 'a' })
  if (removed.isError) throw new Error(`remove: ${short(removed.body)}`)
  rmSync(folder, { recursive: true, force: true })
  cpSync(copy, folder, { recursive: true })
  const manifest = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'))
  writeFileSync(join(folder, 'package.json'), `${JSON.stringify({ ...manifest, name: OLD }, null, 2)}\n`)
  writeFileSync(join(folder, 'cordis.patch.yml'), ['- insert:', `    - id: ${OLD}`, `      name: ${OLD}`, ''].join('\n'))
  const ins = await host.inspector()
  const seeded = await outside(ins, `return (await wc.ctx.get('pluginManager').installBundle(${JSON.stringify(folder)})).application`)
  let live = false
  for (let i = 0; i < 50 && !live; i += 1) {
    live = (await host.list()).some((w) => w.slug === 'a' && w.failed === undefined)
    if (!live) await new Promise((r) => setTimeout(r, 100))
  }
  await host.call('widget_call', { slug: 'a', action: 'add', args: { by: 5 }, requestId: 'r1' })
  const count = async () => (await host.call('widget_call', { slug: 'a', action: 'get' })).body?.result?.count
  check('the profile has a live agent bundle with the older row id', seeded === 'applied' && live && JSON.stringify(deps()) === JSON.stringify([OLD]) && await count() === 5, short({ seeded, live, deps: deps() }))
  const before = await recordOf(ins, 'a')

  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-BAD'), afterRegister("if ('setProgram' in ctx.widgets) throw new Error('host only failure after register')")))
  const r2 = await host.call('widget_install', { dir: bad })
  check('a reinstall that throws after it registers gives install-failed', r2.isError && r2.body?.error?.code === 'install-failed', short(r2.body?.error))
  const after = (await host.list()).find((w) => w.slug === 'a')
  check('the older bundle is live', after !== undefined && after.failed === undefined && after.off === undefined, short(after))
  check('the older bundle keeps its state', await count() === 5, String(await count()))
  const record = await recordOf(ins, 'a')
  check('the older bundle keeps its program', record?.text === before?.text && record?.rev === before?.rev && record?.seed === before?.seed, short({ record, before }))
  check('the profile has only the older bundle', JSON.stringify(deps()) === JSON.stringify([OLD]), short(deps()))

  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P2'))
  const r3 = await host.call('widget_install', { dir: v2 })
  check('a good reinstall moves the slug to the second name, and the older bundle goes', !r3.isError && r3.body?.replaced === true && JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify(['deepwidgets-agent-a.b']) && JSON.stringify(deps()) === JSON.stringify(['deepwidgets-agent-a.b']), short(r3.body?.error ?? deps()))
  check('after the good reinstall, the state stays', await count() === 5, String(await count()))
  ins.close()
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
