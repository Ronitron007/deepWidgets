// replace.keeps_old (FailedReplaceKeepsOld), widget_fv.replace: the path of the finding at 38df710e. A reinstall fails
// in the host, and the old code can not start again (it throws in apply after a deadline). Before widget_fv.replace,
// the installer removed the old bundle first, its put-back failed too, and nothing was live (unknown-widget). Now the
// old version never leaves, so it needs no put-back: it stays live, with its state and its program.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, compose, short, checks, recordOf, agentDeps } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-putback-'))
const host = new Host(work)
const { check, done } = checks('replay putback')
const applyLine = 'export function apply(ctx: WidgetContext): void {'
const atApplyStart = (code) => (text) => {
  if (!text.includes(applyLine)) throw new Error('template changed')
  return text.replace(applyLine, `${applyLine}\n  ${code}`)
}
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const deadline = Date.now() + 25_000
  const v1 = writeWidget(work, 'a-v1', tpl, compose(program('SEED-P1'), atApplyStart(`if (Date.now() > ${deadline}) throw new Error('old code no longer starts')`)))
  const r1 = await host.call('widget_install', { dir: v1 })
  check('install v1 applies', !r1.isError && r1.body?.application === 'applied', short(r1.body?.error ?? r1.body))
  await host.call('widget_call', { slug: 'a', action: 'add', args: { by: 5 }, requestId: 'r1' })
  const ins = await host.inspector()
  const before = await recordOf(ins, 'a')
  while (Date.now() <= deadline) await new Promise((r) => setTimeout(r, 500))
  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-P2'), atApplyStart("if ('setProgram' in ctx.widgets) throw new Error('host only failure')")))
  const r2 = await host.call('widget_install', { dir: bad })
  check('a reinstall that fails in the host gives install-failed', r2.isError && r2.body?.error?.code === 'install-failed', short(r2.body?.error))
  const listed = (await host.list()).find((w) => w.slug === 'a')
  check('the old version is live, though it could not start again', listed !== undefined && listed.failed === undefined && listed.off === undefined, short(listed))
  const call = await host.call('widget_call', { slug: 'a', action: 'get' })
  check('widget_call a.get gives the old state, not unknown-widget', !call.isError && call.body?.result?.count === 5, short(call.body))
  const after = await recordOf(ins, 'a')
  check('the old version keeps its program and its seed hash', after?.text === before?.text && after?.seed === before?.seed && after?.rev === before?.rev, short({ after, before }))
  check('the profile has only the old package', JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify(['deepwidgets-agent-a']), short(agentDeps(host.home, 'a')))
  ins.close()
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
