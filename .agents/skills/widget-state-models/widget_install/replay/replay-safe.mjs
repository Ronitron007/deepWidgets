// slug.taken_only_builtin (widget_fv.install): safe mode meets install. A reinstall, a remove, and an install again
// in one safe-mode host start. Only a live widget that is not an agent bundle gives slug-taken, and remove and install
// clear the off entry of the agent slug.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, short, checks } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-safe-'))
const host = new Host(work)
const { check, done } = checks('replay safe')
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const v1 = writeWidget(work, 'a-v1', tpl, program('SEED-P1'))
  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P2'))
  const r1 = await host.call('widget_install', { dir: v1 })
  check('a normal install of v1 applies', !r1.isError && r1.body?.application === 'applied', short(r1.body?.error ?? r1.body))
  await host.stop()
  await host.start({ DEEPWIDGETS_SAFE_MODE: '1' })
  const safeList = await host.list()
  check('in safe mode, widget a is off', safeList.find((w) => w.slug === 'a')?.off !== undefined, short(safeList))
  const r2 = await host.call('widget_install', { dir: v2 })
  check('a safe-mode reinstall of v2 does not give slug-taken', r2.body?.error?.code !== 'slug-taken', short(r2.body?.error ?? r2.body))
  const rm = await host.call('widget_remove', { slug: 'a' })
  const afterRemove = await host.list()
  check('a safe-mode remove of a clears its off entry', !rm.isError && !afterRemove.some((w) => w.slug === 'a'), short({ rm: rm.body?.error ?? rm.body, afterRemove }))
  const r3 = await host.call('widget_install', { dir: v1 })
  const afterInstall = await host.list()
  check('a safe-mode install of v1 again does not give slug-taken', r3.body?.error?.code !== 'slug-taken', short(r3.body?.error ?? r3.body))
  check('the failed safe-mode install leaves no off entry of a', !afterInstall.some((w) => w.slug === 'a'), short(afterInstall))
  await host.stop()
  await host.start()
  const r4 = await host.call('widget_install', { dir: v1 })
  check('after safe mode, an install of v1 applies and a is live', !r4.isError && r4.body?.application === 'applied' && (await host.list()).find((w) => w.slug === 'a')?.off === undefined, short(r4.body?.error ?? r4.body))
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
