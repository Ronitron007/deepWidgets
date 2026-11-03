// widget_fv.replace (review round 2): the fallback, and an install never removes the last good version. v1 goes under
// the first name, and v2 is committed under the second name. Install v3 is killed after its commit, before the old
// bundle goes (a conditional breakpoint). v3 throws in apply at the next start. Then:
// - the committed v3 failed, so v2 takes the slug (the fallback), with its state;
// - the file committed.json still names v3: the next install that succeeds decides;
// - an install that fails keeps v2 live: it removes the broken v3, never v2.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, ROOT, writeWidget, program, afterRegister, compose, short, checks, agentDeps } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-fallback-'))
const host = new Host(work)
const { check, done } = checks('replay fallback')
const A = 'deepwidgets-agent-a'
const B = 'deepwidgets-agent-a.b'
const applyLine = 'export function apply(ctx: WidgetContext): void {'
const atApplyStart = (code) => (text) => {
  if (!text.includes(applyLine)) throw new Error('template changed')
  return text.replace(applyLine, `${applyLine}\n  ${code}`)
}
/** The 0-based line of the removal of the old bundle in loadNew, after the commit, in the built @deepwidgets/mcp. */
function removalLine() {
  const lines = readFileSync(join(ROOT, 'deepwidgets/mcp/lib/index.js'), 'utf8').split('\n')
  const found = lines.flatMap((line, index) => line.includes('const removal = await this.services.pluginManager.removeBundle(old)') ? [index] : [])
  if (found.length !== 1) throw new Error(`the removal of the old bundle is on ${String(found.length)} lines of the built file`)
  return found[0]
}
const rowsOf = async (ins) => {
  const rows = await ins.run("return wc.ctx.get('widgetRecords').rowsOf('a')")
  return Object.fromEntries(Object.entries(rows ?? {}).map(([kind, row]) => [kind, String(row).slice(String(row).lastIndexOf(':') + 1)]))
}
const count = async () => (await host.call('widget_call', { slug: 'a', action: 'get' })).body?.result?.count
const committed = () => { try { return JSON.parse(readFileSync(join(host.home, 'deepwidgets/committed.json'), 'utf8')).a } catch { return undefined } }
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  await host.call('widget_install', { dir: writeWidget(work, 'a-v1', tpl, program('SEED-P1')) })
  const r2 = await host.call('widget_install', { dir: writeWidget(work, 'a-v2', tpl, program('SEED-P2')) })
  await host.call('widget_call', { slug: 'a', action: 'add', args: { by: 5 }, requestId: 'r1' })
  check('v2 is committed under the second name', !r2.isError && JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([B]) && committed() === B && await count() === 5, short(r2.body?.error ?? agentDeps(host.home, 'a')))
  const deadline = Date.now() + 20_000
  const v3 = writeWidget(work, 'a-v3', tpl, compose(program('SEED-P3'), atApplyStart(`if ('setProgram' in ctx.widgets && Date.now() > ${deadline}) throw new Error('v3 no longer starts')`)))
  const ins = await host.inspector()
  await ins.send('Debugger.enable')
  const bp = await ins.send('Debugger.setBreakpointByUrl', { urlRegex: 'deepwidgets/mcp/lib/index\\.js$', lineNumber: removalLine(), condition: "process.kill(process.pid, 'SIGKILL'), false" })
  check('the fault is armed after the commit of loadNew', bp.locations?.length === 1, short(bp.locations))
  await host.call('widget_install', { dir: v3 }).catch(() => undefined)
  const exit = await host.exited
  check('the host dies during install v3, after the commit', exit.sig === 'SIGKILL' && committed() === A && JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([A, B]), short({ exit, committed: committed(), deps: agentDeps(host.home, 'a') }))
  while (Date.now() <= deadline) await new Promise((r) => setTimeout(r, 500))

  await host.start()
  const ins2 = await host.inspector()
  const rows = await rowsOf(ins2)
  const listed = (await host.list()).find((w) => w.slug === 'a')
  check('v3 throws at the start, and v2 takes the slug with its state (the fallback)', rows?.live === B && rows?.fallback === A && listed?.failed === undefined && await count() === 5, short({ rows, listed }))
  check('committed.json still names v3', committed() === A, String(committed()))
  const bad = writeWidget(work, 'a-bad', tpl, compose(program('SEED-BAD'), afterRegister("if ('setProgram' in ctx.widgets) throw new Error('host only failure after register')")))
  const r4 = await host.call('widget_install', { dir: bad })
  const after = (await host.list()).find((w) => w.slug === 'a')
  check('an install that fails leaves v2 live with its state', r4.isError && after !== undefined && after.failed === undefined && await count() === 5, short({ r4: r4.body?.error?.code, after }))
  check('the install removed the broken v3, never v2', JSON.stringify(agentDeps(host.home, 'a')) === JSON.stringify([B]), short(agentDeps(host.home, 'a')))
  ins2.close()
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
