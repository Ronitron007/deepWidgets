// quarantine.holds (widget_fv.install): v1 crashes the host when a marker says so (host only). The next start
// quarantines it. A reinstall that fails in the host rolls back to the v1 folder, with the blamed hash: the quarantine
// holds. An install whose files load but do not register within the live wait of 5 s is rolled back too: the
// quarantine holds. Then an install of other files that load with success ends it.
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, afterRegister, lateRegister, compose, short, freePort, checks } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-quarantine-'))
const host = new Host(work)
const { check, done } = checks('replay quarantine')
let marker = 'ok'
const mport = await freePort()
const server = createServer((req, res) => { res.end(marker) }).listen(mport, '127.0.0.1')
const quarantined = () => { try { return JSON.parse(readFileSync(join(host.home, 'deepwidgets/quarantine.json'), 'utf8')).filter((q) => String(q.row).endsWith('deepwidgets-agent-a')).length > 0 } catch { return false } }
const widgetA = async () => (await host.list()).find((w) => w.slug === 'a')
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const crashy = `if ('setProgram' in ctx.widgets) ctx.interval(() => { void fetch('http://127.0.0.1:${mport}/').then((r) => r.text()).then((t) => { if (t === 'crash') throw new Error('v1 crashed the host') }) }, 200)`
  const v1 = writeWidget(work, 'a-v1', tpl, compose(program('SEED-P1'), afterRegister(crashy)))
  const r1 = await host.call('widget_install', { dir: v1 })
  check('install v1 applies', !r1.isError && r1.body?.application === 'applied', short(r1.body?.error ?? r1.body))
  marker = 'crash'
  const exit = await host.exited
  marker = 'ok'
  check('v1 crashes the host', exit.code !== 0 || exit.sig !== null, short(exit))
  await host.start()
  const held = await widgetA()
  check('the next start quarantines v1', typeof held?.failed === 'string' && quarantined(), short(held))
  const late = writeWidget(work, 'a-late', tpl, compose(program('SEED-LATE'), lateRegister))
  const rl = await host.call('widget_install', { dir: late })
  const afterLate = await widgetA()
  check('an install that loads but registers after the live wait gives install-failed', rl.isError && rl.body?.error?.code === 'install-failed' && rl.body?.error?.diagnostics?.some((d) => d.includes('did not show')), short(rl.body?.error))
  check('the quarantine holds after the live-wait timeout and its rollback', typeof afterLate?.failed === 'string' && quarantined(), short(afterLate))
  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-P2'), afterRegister("if ('setProgram' in ctx.widgets) throw new Error('host only failure')")))
  const r2 = await host.call('widget_install', { dir: bad })
  check('a reinstall that fails in the host gives install-failed', r2.isError && r2.body?.error?.code === 'install-failed', short(r2.body?.error?.code))
  const meta = JSON.parse(readFileSync(join(host.home, 'profiles/web/deepwidgets-widgets/a/deepwidgets-widget.json'), 'utf8'))
  check('the rollback puts back the v1 folder', meta.source.endsWith('a-v1'), meta.source)
  const after = await widgetA()
  const call = await host.call('widget_call', { slug: 'a', action: 'get' })
  check('the quarantine holds after the failed install and its rollback', typeof after?.failed === 'string' && quarantined() && call.isError, short({ after, call: call.body?.error?.code ?? call.body }))
  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P3'))
  const r3 = await host.call('widget_install', { dir: v2 })
  const live = await widgetA()
  const got = await host.call('widget_call', { slug: 'a', action: 'get' })
  check('an install of other files that load with success ends the quarantine', !r3.isError && live?.failed === undefined && !quarantined() && !got.isError, short({ r3: r3.body?.error ?? r3.body?.application, live, got: got.body }))
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop(); server.close() }
done(work)
