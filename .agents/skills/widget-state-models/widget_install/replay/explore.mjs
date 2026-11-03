import { mkdtempSync, readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, short } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-explore-'))
const host = new Host(work)
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const r = await host.call('widget_install', { dir: writeWidget(work, 'a-v1', tpl) })
  console.log('install', r.isError, short(r.body))
  const prof = readdirSync(join(host.home, 'profiles'))
  console.log('profiles', prof)
  for (const p of prof) {
    const dir = join(host.home, 'profiles', p)
    try { console.log(p, 'deps', short(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).dependencies)) } catch (e) { console.log(p, String(e)) }
    try { const nm = join(dir, 'node_modules', 'deepwidgets-widget-a'); console.log('nm link?', lstatSync(nm).isSymbolicLink(), realpathSync(nm)) } catch (e) { console.log('nm', String(e).slice(0, 200)) }
  }
  const ins = await host.inspector()
  console.log('entry', short(await ins.run(`return [...wc.loader.entries()].filter((e) => String(e.options.id).startsWith('deepwidgets-widget')).map((e) => ({ id: e.id, optId: e.options.id, name: e.options.name, disabled: e.options.disabled ?? null }))`)))
} finally { await host.stop() }
console.log('work', work)
