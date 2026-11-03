// program.new_seed (widget_fv.install): a first install whose apply registers and then throws in the host is rolled
// back with its program record. The next install with a new seed program stores that seed.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, afterRegister, compose, short, checks } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-newseed-'))
const host = new Host(work)
const { check, done } = checks('replay newseed')
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-P3'), afterRegister("if ('setProgram' in ctx.widgets) throw new Error('host only failure after register')")))
  const r1 = await host.call('widget_install', { dir: bad })
  check('a first install that throws in the host fails with install-failed', r1.isError && r1.body?.error?.code === 'install-failed', short(r1.body?.error ?? r1.body))
  const list = (await host.list()).map((w) => w.slug)
  check('the failed install leaves no widget a', !list.includes('a'), short(list))
  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P2'))
  const r2 = await host.call('widget_install', { dir: v2 })
  check('the next install with a new seed applies', !r2.isError && r2.body?.application === 'applied', short(r2.body?.error ?? r2.body?.application))
  const p = await host.programText('a')
  check('the stored program is the new seed, not the seed of the failed install', p.text?.includes('SEED-P2') === true && p.text?.includes('SEED-P3') === false, `rev ${String(p.rev)} ${short(p.text)}`)
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
