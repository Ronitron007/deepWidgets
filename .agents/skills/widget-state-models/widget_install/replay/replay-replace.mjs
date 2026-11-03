// replace.keeps_old (FailedReplaceKeepsOld), widget_fv.replace: a failed reinstall keeps the old version live, with its
// state and its program. The new version goes under the second package name, and the old one goes only after the new
// one registers. A good reinstall moves the slug to the other name, so the names take turns.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, afterRegister, compose, short, checks, recordOf, outside, agentDeps } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-replace-'))
const host = new Host(work)
const { check, done } = checks('replay replace')
const A = 'deepwidgets-agent-a'
const B = 'deepwidgets-agent-a.b'
let ins
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-BAD'), afterRegister("if ('setProgram' in ctx.widgets) throw new Error('host only failure after register')")))
  const count = async () => (await host.call('widget_call', { slug: 'a', action: 'get' })).body?.result?.count
  const live = async () => { const w = (await host.list()).find((item) => item.slug === 'a'); return w !== undefined && w.failed === undefined && w.off === undefined }
  /** A failed reinstall: install-failed, and the old version, its state, its program, and its package stay. */
  const failedReplace = async (label, name, state, record) => {
    const r = await host.call('widget_install', { dir: bad })
    check(`${label}: a reinstall that throws after it registers gives install-failed`, r.isError && r.body?.error?.code === 'install-failed', short(r.body?.error))
    check(`${label}: the old version is live`, await live(), short(await host.list()))
    check(`${label}: the old version keeps its state`, await count() === state, String(await count()))
    const now = await recordOf(ins, 'a')
    check(`${label}: the old version keeps its program and its seed hash`, now?.text === record?.text && now?.seed === record?.seed && now?.rev === record?.rev, short({ now, record }))
    check(`${label}: the profile has only the old package ${name}`, JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([name]), short(agentDeps(host.home, 'a')))
  }

  const v1 = writeWidget(work, 'a-v1', tpl, program('SEED-P1'))
  const r1 = await host.call('widget_install', { dir: v1 })
  check('install v1 applies under the first name', !r1.isError && r1.body?.replaced === false && JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([A]), short(r1.body?.error ?? agentDeps(host.home, 'a')))
  await host.call('widget_call', { slug: 'a', action: 'add', args: { by: 5 }, requestId: 'r1' })
  ins = await host.inspector()
  await outside(ins, `await wc.ctx.get('widgets').setProgram('a', 'root = Card([CardHeader("EDITED BY USER", "x")])', { by: 'user' })`)
  const edited = await recordOf(ins, 'a')
  check('the user edit is stored', edited?.text.includes('EDITED BY USER') === true && typeof edited?.seed === 'string', short(edited))
  await failedReplace('v1', A, 5, edited)

  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P2'))
  const r2 = await host.call('widget_install', { dir: v2 })
  check('a good reinstall applies, and it moves the slug to the second name', !r2.isError && r2.body?.replaced === true && JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([B]), short(r2.body?.error ?? agentDeps(host.home, 'a')))
  check('after the good reinstall, the state stays', await count() === 5, String(await count()))
  const second = await recordOf(ins, 'a')
  check('after the good reinstall, the new seed is the program (NewSeedSetsProgram)', r2.body?.programUpdated === true && second?.text.includes('SEED-P2') === true && second?.seed !== edited?.seed, short(second))
  await host.call('widget_call', { slug: 'a', action: 'add', args: { by: 2 }, requestId: 'r2' })
  await failedReplace('v2', B, 7, second)

  const v3 = writeWidget(work, 'a-v3', tpl, program('SEED-P3'))
  const r3 = await host.call('widget_install', { dir: v3 })
  check('the next good reinstall moves the slug back to the first name', !r3.isError && JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([A]) && await count() === 7, short(r3.body?.error ?? agentDeps(host.home, 'a')))
  const rows = await outside(ins, `return [...wc.loader.entries()].map((e) => e.options.id).filter((id) => typeof id === 'string' && id.startsWith('${A}')).sort()`)
  check('one agent row of the slug runs', JSON.stringify(rows) === JSON.stringify([A]), short(rows))
  ins.close()
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
