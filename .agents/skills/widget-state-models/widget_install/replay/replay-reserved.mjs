// builtin.reserved (widget_fv.install, widget.builtin_slugs): the slug of a built-in widget is reserved, also while the
// built-in is off. The user edits the program of sample and turns sample off. An agent install of the slug sample gives
// slug-taken. When the user turns sample on again, it registers, and its stored program is the edit.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, short, checks, recordOf } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-reserved-'))
const host = new Host(work)
const { check, done } = checks('replay reserved')
// The inspector call can inherit the hmr transaction store of host work in flight. Each plugin manager call leaves
// it, as hmr.watchConfig does (the fix of tools/widgets-blame.mjs).
const toggle = (on) => `const m = wc.ctx.get('pluginManager'); const hmr = wc.ctx.get('hmr')
  if (hmr !== undefined && typeof hmr.executing?.exit !== 'function') throw new Error('the hmr service has no executing.exit')
  const run = (fn) => hmr === undefined ? fn() : hmr.executing.exit(fn)
  const r = (await run(() => m.listPlugins())).filter((x) => x.moduleName === '@deepwidgets/widget-sample'); if (r.length !== 1) return { rows: r.length }
  const out = await run(() => m.setPluginEnabled(r[0].entryId, ${on})); return { application: out.application, error: out.error ?? null }`
try {
  await host.start()
  const ins = await host.inspector()
  await ins.run(`return wc.ctx.get('widgets').setProgram('sample', 'root = Card([CardHeader("BUILTIN EDIT", "x")])', { by: 'user' })`)
  const before = await recordOf(ins, 'sample')
  check('the user edit of sample is stored', before?.text?.includes('BUILTIN EDIT') === true, short(before))
  const off = await ins.run(toggle(false))
  check('the user turns the built-in sample off', off?.application === 'applied' && !(await host.list()).some((w) => w.slug === 'sample'), short(off))
  const tpl = (await host.call('widget_template', { slug: 'sample', title: 'Agent Sample' })).body.files[0].text
  const r = await host.call('widget_install', { dir: writeWidget(work, 'agent-sample', tpl, program('AGENT-SAMPLE')) })
  check('an agent install of the slug sample gives slug-taken while sample is off', r.isError && r.body?.error?.code === 'slug-taken', short(r.body?.error ?? r.body))
  const on = await ins.run(toggle(true))
  const sample = (await host.list()).find((w) => w.slug === 'sample')
  check('the user turns sample on again, and it registers', on?.application === 'applied' && sample?.title === 'Sample' && sample.failed === undefined, short({ on, sample }))
  const after = await recordOf(ins, 'sample')
  check('the stored program of sample is unchanged', after?.text === before?.text && after?.seed === before?.seed && after?.rev === before?.rev, short({ before, after }))
  ins.close()
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
