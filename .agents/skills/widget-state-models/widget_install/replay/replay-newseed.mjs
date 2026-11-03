// program.new_seed: a first install whose apply registers and then throws in the host leaves its seed
// stored; the next install with a new seed program does not set it.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, afterRegister, compose, short } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-newseed-'))
const host = new Host(work)
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-P3'), afterRegister("if ('setProgram' in ctx.widgets) throw new Error('host only failure after register')")))
  const r1 = await host.call('widget_install', { dir: bad })
  console.log('1 install bad:', r1.isError, short(r1.body?.error ?? r1.body))
  console.log('  list:', short((await host.list()).map((w) => w.slug)))
  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P2'))
  const r2 = await host.call('widget_install', { dir: v2 })
  console.log('2 install v2:', r2.isError, 'replaced', r2.body?.replaced, 'programUpdated', r2.body?.programUpdated)
  const p = await host.programText('a')
  console.log('  stored program has SEED-P2:', p.text?.includes('SEED-P2'), 'has SEED-P3:', p.text?.includes('SEED-P3'), 'rev', p.rev)
} finally { await host.stop() }
console.log('work', work)
