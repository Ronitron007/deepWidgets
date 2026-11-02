// quarantine.holds: a quarantined widget comes back only when the hash of its files changes.
// v1 crashes the host when a marker says so (host only). The next start quarantines it. A reinstall
// that fails in the host rolls back to the v1 folder: the same files, the same hash.
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, afterRegister, compose, short, freePort } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-quarantine-'))
const host = new Host(work)
let marker = 'ok'
const mport = await freePort()
const server = createServer((req, res) => { res.end(marker) }).listen(mport, '127.0.0.1')
const quarantine = () => { try { return JSON.parse(readFileSync(join(host.home, 'deepwidgets/quarantine.json'), 'utf8')).map((q) => ({ row: q.row, hash: q.hash?.slice(0, 10) })) } catch { return null } }
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const crashy = `if ('setProgram' in ctx.widgets) ctx.interval(() => { void fetch('http://127.0.0.1:${mport}/').then((r) => r.text()).then((t) => { if (t === 'crash') throw new Error('v1 crashed the host') }) }, 200)`
  const v1 = writeWidget(work, 'a-v1', tpl, compose(program('SEED-P1'), afterRegister(crashy)))
  const r1 = await host.call('widget_install', { dir: v1 })
  console.log('1 install v1:', r1.isError, short(r1.body?.error ?? r1.body?.application))
  marker = 'crash'
  console.log('2 v1 crashes the host:', short(await host.exited))
  marker = 'ok'
  await host.start()
  console.log('3 restart: a =', short((await host.list()).find((w) => w.slug === 'a')), 'quarantine', short(quarantine()))
  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-P2'), afterRegister("if ('setProgram' in ctx.widgets) throw new Error('host only failure')")))
  const r2 = await host.call('widget_install', { dir: bad })
  console.log('4 reinstall that fails in the host:', r2.isError, r2.body?.error?.code, short(r2.body?.error?.diagnostics?.filter((d) => /previous/.test(d))))
  console.log('5 after rollback: a =', short((await host.list()).find((w) => w.slug === 'a')), 'quarantine', short(quarantine()))
  const call = await host.call('widget_call', { slug: 'a', action: 'get' })
  console.log('  widget_call a.get:', call.isError, short(call.body))
  const meta = JSON.parse(readFileSync(join(host.home, 'profiles/web/deepwidgets-widgets/a/deepwidgets-widget.json'), 'utf8'))
  console.log('  folder is the v1 folder:', meta.source.endsWith('a-v1'))
} finally { await host.stop(); server.close() }
console.log('work', work)
