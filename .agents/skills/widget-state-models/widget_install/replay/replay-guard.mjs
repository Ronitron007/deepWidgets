// records.not_for_widgets (widget_fv.install): the install records are not on ctx.widgets, and widget code that
// reaches the service widgetRecords gets an error. A call without a cast fails at the type gate.
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Host, writeWidget, program, compose, short, checks, recordOf } from './lib.mjs'
const work = mkdtempSync(join(tmpdir(), 'widget-state-models-install-guard-'))
const host = new Host(work)
const { check, done } = checks('replay guard')
const addAction = (action) => (text) => text.replace("      { name: 'reset',", `      ${action},\n      { name: 'reset',`)
const probe = `{ name: 'probe', kind: 'mutation', args: z.object({ now: z.literal(true) }), handler: async () => {
        const onWidgets = ['programRecord', 'restoreProgram', 'adoptSeed', 'clearOff'].filter((key) => typeof (ctx.widgets as unknown as Record<string, unknown>)[key] === 'function')
        const records = (ctx as unknown as { get(name: string): { restoreProgram(slug: string, record: undefined): Promise<void> } | undefined }).get('widgetRecords')
        let viaGet = records === undefined ? 'absent' : 'ran'
        try {
          if (records !== undefined) await records.restoreProgram('victim', undefined)
        } catch (error) {
          viaGet = \`refused: \${String(error)}\`
        }
        return { onWidgets, viaGet }
      } }`
try {
  await host.start()
  const tpl = (await host.call('widget_template', { slug: 'victim', title: 'Victim' })).body.files[0].text
  const victim = await host.call('widget_install', { dir: writeWidget(work, 'victim', tpl, program('VICTIM')) })
  check('install of the victim applies', !victim.isError, short(victim.body?.error ?? victim.body?.application))
  const tplA = (await host.call('widget_template', { slug: 'a', title: 'A' })).body.files[0].text
  const typed = await host.call('widget_install', { dir: writeWidget(work, 'a-typed', tplA, (text) => text.replace('export function apply(ctx: WidgetContext): void {', "export function apply(ctx: WidgetContext): void {\n  void ctx.widgets.restoreProgram('victim', undefined)")) })
  check('a bundle that calls ctx.widgets.restoreProgram fails at the type gate', typed.isError && typed.body?.error?.gate === 'lint', short(typed.body?.error))
  const r = await host.call('widget_install', { dir: writeWidget(work, 'a', tplA, compose(program('A'), addAction(probe))) })
  check('the probe bundle installs', !r.isError, short(r.body?.error ?? r.body?.application))
  const out = await host.call('widget_call', { slug: 'a', action: 'probe', args: { now: true }, requestId: 'probe-1' })
  const result = out.body?.result
  check('ctx.widgets has none of the install record methods', Array.isArray(result?.onWidgets) && result.onWidgets.length === 0, short(out.body))
  check('widget code that reaches widgetRecords does not run it', typeof result?.viaGet === 'string' && result.viaGet !== 'ran', short(result?.viaGet))
  const ins = await host.inspector()
  const record = await recordOf(ins, 'victim')
  check('the record of the victim stays', record?.text?.includes('VICTIM') === true, short(record))
  ins.close()
} catch (error) {
  check('the replay runs to its end', false, error instanceof Error ? error.stack : String(error))
} finally { await host.stop() }
done(work)
