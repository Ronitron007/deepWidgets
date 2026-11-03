// program.same_seed (widget_fv.install): the host dies after the new bundle is live, at the first line of the success
// branch of installNow (a conditional breakpoint kills it). After the restart, the program of the installed code is
// edited, and a reinstall of the same code keeps the edit.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, ROOT, writeWidget, program, short, checks } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-sameseed-'))
const host = new Host(work)
const { check, done } = checks('replay sameseed')
/** The 0-based line of the first statement after the live check of installNow, in the built @deepwidgets/mcp. */
function faultLine() {
  const lines = readFileSync(join(ROOT, 'deepwidgets/mcp/lib/index.js'), 'utf8').split('\n')
  const found = lines.flatMap((line, index) => line.includes("result.application === \"applied\" && await this.waitLive(slug)") ? [index] : [])
  if (found.length !== 1) throw new Error(`the live check of installNow is on ${String(found.length)} lines of the built file`)
  return found[0] + 1
}
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const v1 = writeWidget(work, 'a-v1', tpl, program('SEED-P1'))
  const v2 = writeWidget(work, 'a-v2', tpl, program('SEED-P2'))
  const r1 = await host.call('widget_install', { dir: v1 })
  check('install v1 applies', !r1.isError && r1.body?.application === 'applied', short(r1.body?.error ?? r1.body))
  const ins = await host.inspector()
  await ins.send('Debugger.enable')
  const bp = await ins.send('Debugger.setBreakpointByUrl', { urlRegex: 'deepwidgets/mcp/lib/index\\.js$', lineNumber: faultLine(), condition: "process.kill(process.pid, 'SIGKILL'), false" })
  check('the fault is armed after the live check of installNow', bp.locations?.length === 1, short(bp.locations))
  const r2 = await host.call('widget_install', { dir: v2 }).catch((e) => ({ thrown: String(e).slice(0, 120) }))
  const exit = await host.exited
  check('the host dies during install v2', exit.sig === 'SIGKILL', short({ r2, exit }))
  await host.start()
  const listed = (await host.list()).map((w) => w.slug)
  check('after the restart, widget a is live', listed.includes('a'), short(listed))
  const ins2 = await host.inspector()
  await ins2.run(`return wc.ctx.get('widgets').setProgram('a', 'root = Card([CardHeader("EDITED BY USER", "x")])', { by: 'user' })`)
  check('the user edit is stored', (await host.programText('a')).text?.includes('EDITED BY USER') === true)
  const r3 = await host.call('widget_install', { dir: v2 })
  const p = await host.programText('a')
  check('a reinstall of the same code keeps the edit', !r3.isError && r3.body?.programUpdated === false && p.text?.includes('EDITED BY USER') === true,
    `programUpdated ${short(r3.body?.programUpdated)} program ${short(p.text)}`)
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
