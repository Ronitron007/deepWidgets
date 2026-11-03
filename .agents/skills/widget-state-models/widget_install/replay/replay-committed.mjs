// widget_fv.replace: the committed name. v1 goes under the first name, and a good reinstall v2 moves the slug to the
// second name, which is then the committed name. A reinstall v3 is interrupted after its bundle registered as the
// standby and before the commit (a conditional breakpoint kills the host). Both names are then installed.
// - At the next start, the committed v2 owns the slug, and v3 waits as its standby.
// - In a safe-mode start, no row has a live entry. An install stops and removes nothing (widget_fv.replace: an install
//   removes a bundle only when the version that stays is live in this Host start).
// - At the next normal start, v2 is live with its state, and an install keeps v2 and removes the leftover v3 first.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, ROOT, writeWidget, program, short, checks, agentDeps } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-committed-'))
const host = new Host(work)
const { check, done } = checks('replay committed')
const A = 'deepwidgets-agent-a'
const B = 'deepwidgets-agent-a.b'
/** The 0-based line of the commit of loadNew, in the built @deepwidgets/mcp. */
function commitLine() {
  const lines = readFileSync(join(ROOT, 'deepwidgets/mcp/lib/index.js'), 'utf8').split('\n')
  const found = lines.flatMap((line, index) => line.includes('if (registered) this.services.records.commit(slug, name)') ? [index] : [])
  if (found.length !== 1) throw new Error(`the commit of loadNew is on ${String(found.length)} lines of the built file`)
  return found[0]
}
/** The rows of slug a, without the ids of their groups in front (for example `include:`). */
const rowsOf = async (ins) => {
  const rows = await ins.run("return wc.ctx.get('widgetRecords').rowsOf('a')")
  return Object.fromEntries(Object.entries(rows ?? {}).map(([kind, row]) => [kind, String(row).slice(String(row).lastIndexOf(':') + 1)]))
}
const count = async () => (await host.call('widget_call', { slug: 'a', action: 'get' })).body?.result?.count
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const v1 = writeWidget(work, 'a-v1', tpl, program('SEED-P1'))
  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P2'))
  const v3 = writeWidget(work, 'a-v3', tpl, program('SEED-P3'))
  const v4 = writeWidget(work, 'a-v4', tpl, program('SEED-P4'))
  await host.call('widget_install', { dir: v1 })
  const r2 = await host.call('widget_install', { dir: v2 })
  await host.call('widget_call', { slug: 'a', action: 'add', args: { by: 5 }, requestId: 'r1' })
  check('v2 is committed under the second name', !r2.isError && JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([B]) && await count() === 5, short(r2.body?.error ?? agentDeps(host.home, 'a')))
  const ins = await host.inspector()
  await ins.send('Debugger.enable')
  const bp = await ins.send('Debugger.setBreakpointByUrl', { urlRegex: 'deepwidgets/mcp/lib/index\\.js$', lineNumber: commitLine(), condition: "process.kill(process.pid, 'SIGKILL'), false" })
  check('the fault is armed at the commit of loadNew', bp.locations?.length === 1, short(bp.locations))
  await host.call('widget_install', { dir: v3 }).catch(() => undefined)
  const exit = await host.exited
  check('the host dies during install v3, before the commit', exit.sig === 'SIGKILL' && JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([A, B]), short({ exit, deps: agentDeps(host.home, 'a') }))

  await host.start()
  const ins2 = await host.inspector()
  const rows = await rowsOf(ins2)
  check('at the next start, the committed v2 owns the slug, and v3 waits as its standby', rows?.live === B && rows?.standby === A && await count() === 5, short(rows))
  ins2.close()
  await host.stop()

  await host.start({ DEEPWIDGETS_SAFE_MODE: '1' })
  const r4 = await host.call('widget_install', { dir: v4 })
  check('in safe mode, the install fails', r4.isError && r4.body?.error?.code === 'install-failed', short(r4.body?.error?.code))
  const step = r4.body?.error?.nextStep ?? ''
  check('its nextStep says to call widget_remove for the slug, which keeps the state, then widget_install', step.includes('widget_remove') && step.includes('keeps the state') && step.includes('widget_install'), short(step))
  check('in safe mode, the install removes nothing', JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([A, B]), short(agentDeps(host.home, 'a')))
  await host.stop()

  await host.start()
  const ins3 = await host.inspector()
  const last = await rowsOf(ins3)
  check('at the next normal start, v2 is live with its state', last?.live === B && await count() === 5, short({ last, count: await count() }))
  const r5 = await host.call('widget_install', { dir: v4 })
  check('then an install keeps v2, removes the leftover v3, and moves the slug to the first name', !r5.isError && JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([A]) && await count() === 5, short(r5.body?.error ?? agentDeps(host.home, 'a')))
  ins3.close()
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
