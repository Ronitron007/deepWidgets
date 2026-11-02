// replace.keeps_old / standing.hard.replace: a reinstall fails in the host, and the put-back of the old
// bundle fails too. Stand-in for any failure of the second installBundle: the old code throws in apply
// after a deadline (it passed every gate and ran before the deadline).
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, compose, short } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-replace-'))
const host = new Host(work)
const applyLine = 'export function apply(ctx: WidgetContext): void {'
const atApplyStart = (code) => (text) => text.replace(applyLine, `${applyLine}\n  ${code}`)
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const deadline = Date.now() + 25_000
  const v1 = writeWidget(work, 'a-v1', tpl, compose(program('SEED-P1'), atApplyStart(`if (Date.now() > ${deadline}) throw new Error('old code no longer starts')`)))
  const r1 = await host.call('widget_install', { dir: v1 })
  console.log('1 install v1:', r1.isError, r1.body?.application)
  await host.call('widget_call', { slug: 'a', action: 'add', args: { by: 5 }, requestId: 'r1' })
  console.log('  list:', short((await host.list()).map((w) => w.slug)))
  while (Date.now() <= deadline) await new Promise((r) => setTimeout(r, 500))
  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-P2'), atApplyStart("if ('setProgram' in ctx.widgets) throw new Error('host only failure')")))
  const r2 = await host.call('widget_install', { dir: bad })
  console.log('2 reinstall that fails in the host:', r2.isError, r2.body?.error?.code, short(r2.body?.error?.diagnostics?.filter((d) => /previous|application/.test(d))))
  console.log('  list after:', short(await host.list()))
  const pkg = JSON.parse(readFileSync(join(host.home, 'profiles/web/package.json'), 'utf8'))
  console.log('  package.json has the bundle:', Object.hasOwn(pkg.dependencies ?? {}, 'deepwidgets-widget-a'))
  const call = await host.call('widget_call', { slug: 'a', action: 'get' })
  console.log('  widget_call a.get:', call.isError, short(call.body?.error?.code ?? call.body))
} finally { await host.stop() }
console.log('work', work)
