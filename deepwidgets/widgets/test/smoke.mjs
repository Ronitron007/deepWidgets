// Boot once and print the registry. Usage: node smoke.mjs <port> <home>
import { startHost } from './harness.mjs'
const host = await startHost({ port: Number(process.argv[2]), home: process.argv[3], log: 'smoke.log' })
try {
  console.log('boot ms', host.bootMs)
  const list = await host.getJson('/api/widgets')
  console.log(JSON.stringify(list.body.widgets.map((w) => [w.slug, w.status, w.checkOk, w.actions.map((a) => a.name).join('|')])))
  const p = await host.getJson('/api/widgets/groceries/program')
  console.log(p.status, p.body.catalog, p.body.rev)
  const r = await fetch(host.base + '/mcp/token', { method: 'POST', body: '{"agent":"smoke"}' })
  console.log('token', r.status, await r.text())
} finally { await host.stop() }
