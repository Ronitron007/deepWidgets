// rollback.keeps_record (widget_fv.install): a rolled-back install leaves the stored program and its seed hash as they
// were. v1 is installed and the user edits its program. A reinstall that throws in the host after it registers writes
// its own seed. The rollback must put back the edit and the hash of v1.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, afterRegister, compose, short, checks, recordOf } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-rollback-'))
const host = new Host(work)
const { check, done } = checks('replay rollback')
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const v1 = writeWidget(work, 'a-v1', tpl, program('SEED-P1'))
  const r1 = await host.call('widget_install', { dir: v1 })
  check('install v1 applies', !r1.isError && r1.body?.application === 'applied', short(r1.body?.error ?? r1.body))
  const ins = await host.inspector()
  const first = await recordOf(ins, 'a')
  check('the record of v1 has a seed hash', typeof first?.seed === 'string', short(first))
  await ins.run(`return wc.ctx.get('widgets').setProgram('a', 'root = Card([CardHeader("EDITED BY USER", "x")])', { by: 'user' })`)
  const edited = await recordOf(ins, 'a')
  check('the user edit is stored with the hash of v1', edited?.text.includes('EDITED BY USER') && edited?.seed === first?.seed, short(edited))
  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-P2'), afterRegister("if ('setProgram' in ctx.widgets) throw new Error('host only failure after register')")))
  const r2 = await host.call('widget_install', { dir: bad })
  check('a reinstall that throws after it registers gives install-failed', r2.isError && r2.body?.error?.code === 'install-failed', short(r2.body?.error?.code))
  const after = await recordOf(ins, 'a')
  check('after the rollback, the program is the user edit and the seed hash is the hash of v1',
    after?.text === edited?.text && after?.seed === first?.seed, short({ after, before: edited }))
  const listed = (await host.list()).find((w) => w.slug === 'a')
  check('v1 is live again', listed !== undefined && listed.failed === undefined, short(listed))
  ins.close()
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
