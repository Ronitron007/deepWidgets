/** Probe the real deepWidgets host through the bridge's own local client (no relay). Prints no secrets. */
import { createLocal } from '../bridge/src/local.ts'
const local = createLocal({ dshHome: process.env.DSH_HOME ?? '', log: (l) => console.log('log', l) })
const claims = (tool: string) => ({ cid: 'probe', gid: 'probe', tool }) as never
for (const [tool, args] of [['widget_list', {}], ['widget_describe', { slug: 'sample' }], ['widget_changes', {}]] as const) {
  const r = await local.call(claims(tool), args as Record<string, unknown>)
  console.log(tool, JSON.stringify(r).slice(0, 900))
}
