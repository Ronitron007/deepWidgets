// program.same_seed: the host dies after the new bundle is in and before .seeds/<slug> is written
// (fault injected at that await with a conditional breakpoint). After the restart, the program of the
// installed code is edited, and a reinstall of the same code overwrites the edit.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, short } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-sameseed-'))
const host = new Host(work)
const seedFile = () => { try { return readFileSync(join(host.home, 'profiles/web/deepwidgets-widgets/.seeds/a'), 'utf8').trim().slice(0, 12) } catch { return null } }
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const v1 = writeWidget(work, 'a-v1', tpl, program('SEED-P1'))
  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P2'))
  const r1 = await host.call('widget_install', { dir: v1 })
  console.log('1 install v1:', r1.isError, r1.body?.application, 'seed record', seedFile())
  const ins = await host.inspector()
  await ins.send('Debugger.enable')
  const bp = await ins.send('Debugger.setBreakpointByUrl', { urlRegex: 'deepwidgets/mcp/lib/index\\.js$', lineNumber: 601, condition: "process.kill(process.pid, 'SIGKILL'), false" })
  console.log('2 fault armed at `const last = await this.lastSeed(slug)`:', bp.locations?.length, 'locations')
  const r2 = await host.call('widget_install', { dir: v2 }).catch((e) => ({ thrown: String(e).slice(0, 120) }))
  console.log('3 install v2:', short(r2.thrown ?? r2.body), 'host exit', short(await host.exited))
  console.log('  seed record after the host died:', seedFile())
  await host.start()
  const p0 = await host.programText('a')
  console.log('4 restart: list', short((await host.list()).map((w) => w.slug)), 'program has P2:', p0.text?.includes('SEED-P2'), 'has P1:', p0.text?.includes('SEED-P1'))
  const ins2 = await host.inspector()
  await ins2.run(`return wc.ctx.get('widgets').setProgram('a', 'root = Card([CardHeader("EDITED BY USER", "x")])', { by: 'user' })`)
  console.log('5 user edit stored:', (await host.programText('a')).text?.includes('EDITED BY USER'))
  const r3 = await host.call('widget_install', { dir: v2 })
  const p = await host.programText('a')
  console.log('6 reinstall v2 (same code):', r3.isError, 'replaced', r3.body?.replaced, 'programUpdated', r3.body?.programUpdated, '| edit kept:', p.text?.includes('EDITED BY USER'))
} finally { await host.stop() }
console.log('work', work)
