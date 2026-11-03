// Safe mode meets install: reinstall, remove, install again in one safe-mode host start.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, short } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-safe-'))
const host = new Host(work)
const deps = () => JSON.parse(readFileSync(join(host.home, 'profiles/web/package.json'), 'utf8'))
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const v1 = writeWidget(work, 'a-v1', tpl, program('SEED-P1'))
  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P2'))
  const r1 = await host.call('widget_install', { dir: v1 })
  console.log('1 normal install v1:', r1.isError, r1.body?.application)
  await host.stop()
  await host.start({ DEEPWIDGETS_SAFE_MODE: '1' })
  console.log('2 safe start list:', short(await host.list()))
  const r2 = await host.call('widget_install', { dir: v2 })
  console.log('3 safe install v2:', r2.isError, short(r2.body?.error ?? r2.body))
  console.log('  deps:', short(deps().dependencies), 'selected:', short(deps().dsh?.profile?.bundles))
  console.log('  folder meta source:', short(JSON.parse(readFileSync(join(host.home, 'profiles/web/deepwidgets-widgets/a/deepwidgets-widget.json'), 'utf8')).source))
  const rm = await host.call('widget_remove', { slug: 'a' })
  console.log('4 safe remove a:', rm.isError, short(rm.body?.error ?? rm.body))
  console.log('  list:', short(await host.list()))
  const r3 = await host.call('widget_install', { dir: v1 })
  console.log('5 safe install v1 again:', r3.isError, short(r3.body?.error ?? r3.body))
} finally { await host.stop() }
console.log('work', work)
