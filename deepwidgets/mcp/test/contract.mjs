// Action contract + MCP checks against the real CLI host, with the official SDK client.
// Usage: WIDGETS_NOTES=<dir>/ node contract.mjs <port> <home>   (exit 0 = all pass)
import { request as httpRequest } from 'node:http'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { startHost, openStream, check } from '../../widgets/test/harness.mjs'

const port = Number(process.argv[2] ?? 47972)
const home = process.argv[3]
const results = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function raw(method, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port, method, path, headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...headers } }, (res) => {
      let text = ''
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => resolve({ status: res.statusCode, body: text }))
    })
    req.on('error', reject)
    if (body) req.write(body)
    req.end()
  })
}

async function agent(name) {
  const res = await raw('POST', '/mcp/token', { host: `127.0.0.1:${port}` }, JSON.stringify({ agent: name }))
  const { token, agentId } = JSON.parse(res.body)
  const client = new Client({ name, version: '0' })
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${token}` } } })
  await client.connect(transport)
  const tool = async (toolName, args = {}) => {
    const out = await client.callTool({ name: toolName, arguments: args })
    return { isError: Boolean(out.isError), body: out.structuredContent ?? out.content?.[0]?.text, text: out.content?.[0]?.text }
  }
  const call = (slug, action, args, requestId) => tool('widget_call', { slug, action, ...(args ? { args } : {}), ...(requestId ? { requestId } : {}) })
  return { client, token, agentId, tool, call, close: () => client.close() }
}

const host = await startHost({ port, home, log: 'contract.log' })
try {
  // ---- fence + identity ----
  const init = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
  const tokenRes = await raw('POST', '/mcp/token', { host: `127.0.0.1:${port}` }, '{"agent":"probe"}')
  const probeToken = JSON.parse(tokenRes.body).token
  const accept = { accept: 'application/json, text/event-stream', authorization: `Bearer ${probeToken}` }
  check(results, 'fence: token handshake 200', tokenRes.status === 200)
  check(results, 'fence: Origin refused 403', (await raw('POST', '/mcp', { host: `127.0.0.1:${port}`, origin: `http://127.0.0.1:${port}`, ...accept }, init)).status === 403)
  check(results, 'fence: Sec-Fetch-Site refused 403', (await raw('POST', '/mcp', { host: `127.0.0.1:${port}`, 'sec-fetch-site': 'same-origin', ...accept }, init)).status === 403)
  check(results, 'fence: rebinding Host refused 403', (await raw('POST', '/mcp/token', { host: 'evil.example' }, '{}')).status === 403)
  check(results, 'fence: no bearer 401', (await raw('POST', '/mcp', { host: `127.0.0.1:${port}`, accept: accept.accept }, init)).status === 401)

  // ---- tools ----
  const a = await agent('agent-a')
  const b = await agent('agent-b')
  const tools = (await a.client.listTools()).tools.map((t) => t.name).sort()
  check(results, 'tools/list has the 7 tools', tools.join() === 'widget_call,widget_changes,widget_describe,widget_guide,widget_inspect,widget_list,widget_save', tools.join())
  const list = await a.tool('widget_list')
  const cursor0 = list.body.cursor
  check(results, 'widget_list', list.body.widgets.some((w) => w.slug === 'groceries' && w.actions.includes('add:mutation')), JSON.stringify(list.body.widgets.map((w) => w.slug)))
  const describe = await a.tool('widget_describe', { slug: 'groceries' })
  check(results, 'widget_describe has JSON schema args', describe.body.actions.find((x) => x.name === 'add')?.args?.properties?.text?.type === 'string')

  // ---- requestId dedupe ----
  const add1 = await a.call('groceries', 'add', { text: 'eggs' }, 'r1')
  const add2 = await a.call('groceries', 'add', { text: 'eggs' }, 'r1')
  const conflict = await a.call('groceries', 'add', { text: 'milk' }, 'r1')
  const rows = (await a.call('groceries', 'list')).body.result.rows
  check(results, 'requestId: replay returns the first result, runs once', !add1.isError && add2.body.replayed === true && add2.body.result.id === add1.body.result.id && rows.filter((r) => r.text === 'eggs').length === 1, `rows=${rows.length}`)
  check(results, 'requestId: same id, other args -> idempotency-conflict', conflict.isError && conflict.body.error.code === 'idempotency-conflict')

  // ---- change feed: user click shows up for the agent; own changes hidden ----
  const user = await host.postJson('/api/widgets/groceries/call', { action: 'add', args: { text: 'from-user' } })
  const feed = await a.tool('widget_changes', { since: cursor0 })
  const kinds = feed.body.changes.map((c) => `${c.slug}:${c.kind}:${c.by}`)
  check(results, 'widget_changes: user change visible, own hidden', user.status === 200 && kinds.includes('groceries:state:user') && !feed.body.changes.some((c) => c.by === a.agentId), kinds.join(' '))
  const feedB = await b.tool('widget_changes', { since: cursor0 })
  check(results, 'widget_changes: other agent sees agent A', feedB.body.changes.some((c) => c.by === a.agentId && c.action === 'add'))
  const stale = await a.tool('widget_changes', { since: 'deadbeef:3' })
  check(results, 'widget_changes: foreign epoch -> reset + nextStep', stale.body.reset === true && typeof stale.body.nextStep === 'string')

  // ---- queue: read-wait-write handlers do not lose updates ----
  const n0 = (await a.call('faulty', 'peek')).body.result.n
  await Promise.all(Array.from({ length: 10 }, (_, i) => (i % 2 ? a : b).call('faulty', 'incr')))
  const n1 = (await a.call('faulty', 'peek')).body.result.n
  check(results, 'queue: 10 concurrent incr -> +10', n1 - n0 === 10, `${n0} -> ${n1}`)

  // ---- busy after queue wait (slow: 2500 ms run, 3000 ms limit) ----
  const done0 = (await a.call('faulty', 'peek')).body.result.slowDone
  const slow = await Promise.all([a.call('faulty', 'slow', { ms: 2500 }), b.call('faulty', 'slow', { ms: 2500 }), a.call('faulty', 'slow', { ms: 2500 })])
  await sleep(200)
  const done1 = (await a.call('faulty', 'peek')).body.result.slowDone
  const codes = slow.map((s) => (s.isError ? s.body.error.code : 'ok'))
  check(results, 'busy: third waits past its limit and does not run', codes.join() === 'ok,ok,busy' && done1 - done0 === 2, `${codes} ran=${done1 - done0}`)

  // ---- timer/plugin writes use the same queue ----
  const c1 = (await b.tool('widget_list')).body.cursor
  const slowRun = a.call('faulty', 'slow', { ms: 800 })
  await sleep(50)
  const poke = await host.postJson('/api/widgets-dev/poke', { slug: 'faulty' })
  await slowRun
  const order = (await b.tool('widget_changes', { since: c1 })).body.changes.filter((c) => c.slug === 'faulty').map((c) => c.action ?? c.by)
  check(results, 'plugin update waits behind a running mutation', poke.body.ok && order[0] === 'slow' && String(order[1]).startsWith('plugin:'), order.join(' > ') + ' poke=' + JSON.stringify(poke.body).slice(0, 200))

  // ---- timeout, abort, late write refused ----
  const hang = await a.call('faulty', 'hang')
  check(results, 'timeout: hung query -> timeout', hang.isError && hang.body.error.code === 'timeout')
  const nBefore = (await a.call('faulty', 'peek')).body.result.n
  const late = await a.call('faulty', 'writeLate', undefined, 'late-1')
  await sleep(800)
  const nAfter = (await a.call('faulty', 'peek')).body.result.n
  check(results, 'timeout: late write refused, partial=false', late.isError && late.body.error.code === 'timeout' && late.body.error.details?.partial === false && nAfter === nBefore, `n ${nBefore} -> ${nAfter}`)

  // ---- quota ----
  const fill = await a.call('faulty', 'fill', { bytes: 100_000 })
  const blob = (await a.call('faulty', 'peek')).body.result.blob
  check(results, 'quota: write over 64 KiB refused, state unchanged', fill.isError && fill.body.error.code === 'quota' && blob === 0, fill.body.error?.message)

  // ---- errors carry nextStep ----
  const unknown = await a.call('nope', 'list')
  const badArgs = await a.call('groceries', 'add', { text: 5 })
  check(results, 'errors: unknown widget / invalid args with nextStep', unknown.body.error.code === 'unknown-widget' && badArgs.body.error.code === 'invalid-args' && typeof badArgs.body.error.nextStep === 'string')

  // ---- drift: register, inspect, program edit ----
  const drifty = await a.tool('widget_inspect', { slug: 'drifty' })
  check(results, 'drift at register shown in widget_inspect', drifty.body.checkOk === false && drifty.body.check.drift.some((d) => d.tool === 'archive'), JSON.stringify(drifty.body.check?.drift))
  const groceriesInspect = await a.tool('widget_inspect', { slug: 'groceries' })
  check(results, 'groceries program passes the check', groceriesInspect.body.check?.ok === true, JSON.stringify(groceriesInspect.body.check?.errors))
  const badEdit = await host.postJson('/api/widgets/groceries/program', { text: 'root = Card([TextContent("x")])\nq = Mutation("wipe", {})' })
  check(results, 'program edit with drift refused 422', badEdit.status === 422 && badEdit.body.error.details.drift[0].tool === 'wipe')

  // ---- create mode: data widget save ----
  const guide = await a.tool('widget_guide', {})
  check(results, 'widget_guide text', typeof guide.text === 'string' && guide.text.includes('Query') && guide.text.includes('table'), `${guide.text?.length} chars`)
  const booksProgram = 'root = Card([CardHeader("Books"), body])\nr = Query("list", {}, {rows: []})\nbody = @Count(r.rows) == 0 ? Empty("No books") : List(@Each(r.rows, "b", TextContent(b.title)))'
  const table = { fields: { title: { type: 'string', required: true }, read: { type: 'boolean', default: false } } }
  const save1 = await a.tool('widget_save', { slug: 'books', title: 'Books', table, program: booksProgram })
  const bookAdd = await a.call('books', 'add', { title: 'Dune' })
  const booksRoute = await host.getJson('/api/widgets/books/program')
  check(results, 'widget_save creates a data widget (routes live, actions work)', save1.body?.created === true && !bookAdd.isError && booksRoute.status === 200, JSON.stringify(save1.body))
  const stream = openStream(host, 'books')
  await stream.next((f) => f.type === 'hello')
  const drifted = await a.tool('widget_save', { slug: 'books', title: 'Books', table, program: `${booksProgram}\nz = Mutation("archive", {})` })
  const stillServes = await a.call('books', 'list')
  check(results, 'widget_save with drift refused; old version keeps serving', drifted.isError && drifted.body.error.code === 'invalid-program' && drifted.body.error.details.drift[0].tool === 'archive' && stillServes.body.result.rows.length === 1)
  const same = await a.tool('widget_save', { slug: 'books', title: 'Books', table, program: booksProgram })
  check(results, 'widget_save same content -> unchanged', same.body.unchanged === true)
  const v2 = await a.tool('widget_save', { slug: 'books', title: 'Books v2', table, program: booksProgram.replace('"Books"', '"My books"') })
  const pushed = await stream.next((f) => f.type === 'program').catch(() => null)
  const afterV2 = await a.call('books', 'list')
  check(results, 'widget_save replace: in place, program pushed, rows kept', v2.body.created === false && pushed !== null && afterV2.body.result.rows.length === 1, JSON.stringify(v2.body))
  stream.close()
  const conflictSave = await a.tool('widget_save', { slug: 'groceries', title: 'x', table, program: booksProgram })
  check(results, 'widget_save on a package slug -> conflict', conflictSave.body.error?.code === 'conflict')

  // ---- safe replace of a package widget (standby + promote) ----
  const swap = (variant, op) => host.postJson('/api/widgets-dev/swap', { variant, op })
  const s1 = await swap('v1')
  const swapStream = openStream(host, 'swap')
  await swapStream.next((f) => f.type === 'hello')
  let gaps = 0
  let polling = true
  const poller = (async () => { while (polling) { const r = await host.api('/api/widgets/swap/program'); if (r.status !== 200) gaps += 1; await r.arrayBuffer(); await sleep(10) } })()
  const sBroken = await swap('broken')
  const sV2 = await swap('v2')
  const sUnload = await swap('v1', 'unload')
  const promoted = await swapStream.next((f) => f.type === 'program').catch(() => null)
  await sleep(100)
  polling = false
  await poller
  const swapList = await a.call('swap', 'list')
  check(results, 'safe replace: broken version leaves v1 serving', s1.body.title === 'Swap v1' && sBroken.body.title === 'Swap v1' && sBroken.body.status === 'ok', JSON.stringify({ broken: sBroken.body.fiberState }))
  check(results, 'safe replace: v2 waits as standby, then takes over with no 404', sV2.body.standby === 1 && sV2.body.title === 'Swap v1' && sUnload.body.title === 'Swap v2' && sUnload.body.program.includes('v2') && promoted !== null && gaps === 0 && !swapList.isError, `gaps=${gaps}`)
  swapStream.close()

  for (const client of [a, b]) await client.close()
} finally {
  await host.stop()
}
const failed = results.filter((r) => !r.ok).length
console.log(`contract: ${results.length - failed} pass, ${failed} fail`)
process.exit(failed === 0 ? 0 : 1)
