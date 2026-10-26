// Functional + fault checks against the real CLI host. Usage: node run.mjs <port> <home>
import { startHost, openStream, check } from './harness.mjs'

const port = Number(process.argv[2] ?? 47921)
const home = process.argv[3]
const results = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const host = await startHost({ port, home, env: { DEEPWIDGETS_WEATHER_MS: '3000' }, log: 'run.log' })
try {
  console.log(`boot to URL: ${host.bootMs} ms`)
  const list = await host.getJson('/api/widgets')
  const slugs = list.body.widgets.map((item) => item.slug).sort()
  check(results, 'registry lists sample widgets', ['faulty', 'groceries', 'weather'].every((slug) => slugs.includes(slug)), slugs.join(','))

  const program = await host.getJson('/api/widgets/groceries/program')
  check(results, 'GET program', program.status === 200 && program.body.program.includes('Groceries') && program.body.actions.map((a) => a.name).join() === 'list,add,toggle,remove', `rev=${program.body.rev} actions=${program.body.actions.map((a) => a.name)}`)

  // Push source: /call
  const groceries = openStream(host, 'groceries')
  const hello = await groceries.next((f) => f.type === 'hello')
  const add = await host.postJson('/api/widgets/groceries/call', { action: 'add', args: { text: 'milk' } })
  check(results, '/call add', add.status === 200 && add.body.ok && add.body.result.text === 'milk' && add.body.result.done === false, JSON.stringify(add.body))
  const pushCall = await groceries.next((f) => f.type === 'data' && f.rev > (hello.rev ?? -1))
  check(results, 'push from /call', pushCall.rev === add.body.rev, `rev ${pushCall.rev}`)
  const toggled = await host.postJson('/api/widgets/groceries/call', { action: 'toggle', args: { id: add.body.result.id } })
  check(results, 'toggle', toggled.body.result?.done === true)
  const listed = await host.postJson('/api/widgets/groceries/call', { action: 'list' })
  check(results, 'list query', Array.isArray(listed.body.result) && listed.body.result.some((row) => row.text === 'milk' && row.done))

  // Push source: another plugin
  const before = groceries.frames.length
  const poke = await host.postJson('/api/widgets-dev/poke', { slug: 'groceries' })
  const pushPlugin = await groceries.next((f) => f.type === 'data' && groceries.frames.indexOf(f) >= before)
  check(results, 'push from another plugin', poke.body.ok && pushPlugin.rev > toggled.body.rev, `rev ${pushPlugin.rev}`)

  // Push source: timer (weather every 3 s)
  const weather = openStream(host, 'weather')
  await weather.next((f) => f.type === 'hello')
  const pushTimer = await weather.next((f) => f.type === 'data', 12_000).catch((e) => ({ error: e.message }))
  const current = await host.postJson('/api/widgets/weather/call', { action: 'current' })
  check(results, 'push from timer (weather)', pushTimer.type === 'data', `state=${JSON.stringify(current.body.result)}`)
  const refresh = await host.postJson('/api/widgets/weather/call', { action: 'refresh', args: {} })
  check(results, 'weather refresh mutation', refresh.status === 200 && refresh.body.result !== null, JSON.stringify(refresh.body.result))

  // Program change
  const setProgram = await host.postJson('/api/widgets/groceries/program', { text: 'root = TextContent("Groceries v2")' })
  const pushProgram = await groceries.next((f) => f.type === 'program')
  check(results, 'push program', setProgram.body.ok && pushProgram.rev === setProgram.body.rev, `rev ${pushProgram.rev}`)

  // Error contract
  const boom = await host.postJson('/api/widgets/faulty/call', { action: 'boom' })
  check(results, 'handler throws -> 500 handler-error', boom.status === 500 && boom.body.error.code === 'handler-error', JSON.stringify(boom.body))
  const after = await host.postJson('/api/widgets/groceries/call', { action: 'list' })
  check(results, 'other widgets unaffected', after.status === 200)
  const unknown = await host.postJson('/api/widgets/groceries/call', { action: 'nope' })
  check(results, 'unknown action -> 404', unknown.status === 404 && unknown.body.error.code === 'unknown-action')
  const invalid = await host.postJson('/api/widgets/groceries/call', { action: 'add', args: { text: 5 } })
  check(results, 'invalid args -> 422', invalid.status === 422 && invalid.body.error.code === 'invalid-args', invalid.body.error?.message?.replace(/\n/g, ' '))
  const badBody = await host.api('/api/widgets/groceries/call', { method: 'POST', body: '{not json' })
  check(results, 'bad body -> 400', badBody.status === 400)
  const missing = await host.api('/api/widgets/ghost/call', { method: 'POST', body: '{}' })
  check(results, 'unknown slug -> 404 (no route)', missing.status === 404)

  // Hang -> timeout
  let started = performance.now()
  const hang = await host.postJson('/api/widgets/faulty/call', { action: 'hang' })
  check(results, 'hang -> 504 timeout', hang.status === 504 && hang.body.error.code === 'timeout', `${Math.round(performance.now() - started)} ms`)
  const n0 = (await host.postJson('/api/widgets/faulty/call', { action: 'bump', args: { by: 1 } })).body.result.n
  started = performance.now()
  const late = await host.postJson('/api/widgets/faulty/call', { action: 'writeLate' })
  await sleep(1_000)
  const n1 = (await host.postJson('/api/widgets/faulty/call', { action: 'bump', args: { by: 0 } })).body.result.n
  check(results, 'late write after timeout refused', late.status === 504 && n1 === n0, `n before=${n0} after=${n1}`)

  // Write with no window open, then open
  groceries.close()
  const quiet = await host.postJson('/api/widgets-dev/poke', { slug: 'groceries' })
  const reopened = openStream(host, 'groceries')
  const hello2 = await reopened.next((f) => f.type === 'hello')
  check(results, 'write with no stream; new stream sees rev in hello', quiet.body.ok && hello2.rev >= 1, `hello rev=${hello2.rev}`)

  // Dispose the registering plugin -> widget disappears
  const disposed = await host.postJson('/api/widgets-dev/dispose', { id: 'deepwidgets-widget-groceries' })
  const removed = await reopened.next((f) => f.type === 'removed').catch(() => null)
  const streamEnd = await Promise.race([reopened.done, sleep(2_000).then(() => 'still open')])
  const gone = await host.api('/api/widgets/groceries/program')
  const list2 = await host.getJson('/api/widgets')
  check(results, 'dispose plugin -> widget, routes, streams gone', disposed.body.ok && removed !== null && streamEnd === 'ended' && gone.status === 404 && !list2.body.widgets.some((w) => w.slug === 'groceries'),
    `removed=${removed !== null} stream=${streamEnd} program=${gone.status} list=${list2.body.widgets.map((w) => w.slug)}`)
  const weatherOk = await host.postJson('/api/widgets/weather/call', { action: 'current' })
  check(results, 'other widgets survive dispose', weatherOk.status === 200)
  weather.close()
} finally {
  await host.stop()
}
const failed = results.filter((r) => !r.ok).length
console.log(`run: ${results.length - failed} pass, ${failed} fail`)
process.exit(failed === 0 ? 0 : 1)
