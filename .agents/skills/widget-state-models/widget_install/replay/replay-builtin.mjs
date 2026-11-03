// builtin.untouched / slug.one_bundle: the user turns the built-in sample off; the agent installs slug sample.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, short } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-builtin-'))
const host = new Host(work)
const rows = `const m = wc.ctx.get('pluginManager'); return (await m.listPlugins()).filter((r) => String(r.moduleName).includes('widget-sample')).map((r) => ({ entryId: r.entryId, moduleName: r.moduleName, enabled: r.enabled, state: r.state, ro: r.readOnlyReason ?? null }))`
const entries = `return [...wc.loader.entries()].filter((e) => e.options.id === 'deepwidgets-widget-sample').map((e) => ({ id: e.id, name: e.options.name, disabled: e.options.disabled ?? null, running: e.fiber !== undefined && e.fiber?.uid != null }))`
const toggle = (on) => `const m = wc.ctx.get('pluginManager'); const r = (await m.listPlugins()).filter((x) => x.moduleName === '@deepwidgets/widget-sample'); if (r.length !== 1) return { rows: r.length }; const out = await m.setPluginEnabled(r[0].entryId, ${on}); return { application: out.application, error: out.error ?? null }`
try {
  await host.start()
  const ins = await host.inspector()
  console.log('0 rows:', short(await ins.run(rows)))
  console.log('1 user turns built-in sample off:', short(await ins.run(toggle(false))))
  console.log('  list:', short((await host.list()).map((w) => w.slug)))
  const tpl = (await host.call('widget_template', { slug: 'sample', title: 'Agent Sample' })).body.files[0].text
  const r = await host.call('widget_install', { dir: writeWidget(work, 'agent-sample', tpl, program('AGENT-SAMPLE')) })
  console.log('2 agent installs slug sample:', r.isError, short(r.body?.error ?? { replaced: r.body?.replaced, application: r.body?.application }))
  console.log('  loader rows with id deepwidgets-widget-sample:', short(await ins.run(entries)))
  console.log('  plugin rows:', short(await ins.run(rows)))
  const d = await host.call('widget_describe', { slug: 'sample' })
  console.log('  widget sample title now:', short(d.body?.title), 'actions', short(d.body?.actions?.map((a) => a.name)))
  const pkg = JSON.parse(readFileSync(join(host.home, 'profiles/web/package.json'), 'utf8'))
  console.log('  selected bundles:', short(pkg.dsh?.profile?.bundles))
  console.log('3 user turns built-in sample on:', short(await ins.run(toggle(true))))
  console.log('  loader rows:', short(await ins.run(entries)))
  console.log('  list:', short(await host.list()))
} finally { await host.stop() }
console.log('work', work)
