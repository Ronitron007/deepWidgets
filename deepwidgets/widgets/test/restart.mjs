// Restart checks: data survives, old cookie still works, a reconnecting SSE client recovers.
// Also the crash-on-load row. Usage: node restart.mjs <port> <home>
import { startHost, check } from './harness.mjs'

const port = Number(process.argv[2] ?? 47922)
const home = process.argv[3]
const results = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Minimal EventSource-like client: reconnects after 'retry' ms on end or error. */
function reconnectingStream(base, slug, cookie) {
  const state = { frames: [], connects: 0, downSince: null, gaps: [], stop: false }
  ;(async () => {
    while (!state.stop) {
      try {
        const response = await fetch(`${base}/api/widgets/${slug}/stream`, { headers: { cookie } })
        if (!response.ok) throw new Error(String(response.status))
        state.connects += 1
        if (state.downSince !== null) { state.gaps.push(Date.now() - state.downSince); state.downSince = null }
        let buffer = ''
        const decoder = new TextDecoder()
        for await (const chunk of response.body) {
          buffer += decoder.decode(chunk, { stream: true })
          for (const line of buffer.split('\n')) if (line.startsWith('data: ')) state.frames.push(JSON.parse(line.slice(6)))
          buffer = buffer.slice(buffer.lastIndexOf('\n') + 1)
          if (state.stop) break
        }
      } catch (error) {
        state.lastError = String(error.cause?.code ?? error.message)
      }
      state.downSince ??= Date.now()
      await sleep(1000)
    }
  })()
  return state
}

let host = await startHost({ port, home, log: 'restart.log' })
const cookie = host.cookie
const add = await host.postJson('/api/widgets/groceries/call', { action: 'add', args: { text: 'eggs' } })
await host.postJson('/api/widgets/groceries/program', { text: 'root = TextContent("persisted program")' })
const client = reconnectingStream(host.base, 'groceries', cookie)
await sleep(500)
const revBefore = add.body.rev
await host.stop()
const stoppedAt = Date.now()
host = await startHost({ port, home, log: 'restart.log' })
console.log(`restart boot ${host.bootMs} ms`)
try {
  const oldCookie = await fetch(`${host.base}/api/widgets`, { headers: { cookie } })
  check(results, 'old cookie valid after restart', oldCookie.status === 200, `status ${oldCookie.status}`)
  const listed = await host.postJson('/api/widgets/groceries/call', { action: 'list' })
  check(results, 'state survives restart', listed.body.result.some((row) => row.text === 'eggs'), `rows=${listed.body.result.length} rev=${listed.body.rev} (before ${revBefore}+)`)
  const program = await host.getJson('/api/widgets/groceries/program')
  check(results, 'program edit survives restart (stored wins over package seed)', program.body.program.includes('persisted program'), `rev ${program.body.rev}`)
  await sleep(2500)
  const hellos = client.frames.filter((f) => f.type === 'hello')
  check(results, 'SSE client reconnects after restart', client.connects >= 2 && hellos.length >= 2, `connects=${client.connects} gap=${client.gaps[0]} ms (host down ${host.bootMs}+ ms) lastError=${client.lastError}`)
  const pokeBefore = client.frames.length
  await host.postJson('/api/widgets-dev/poke', { slug: 'groceries' })
  await sleep(300)
  check(results, 'reconnected client gets pushes', client.frames.slice(pokeBefore).some((f) => f.type === 'data'))
} finally {
  client.stop = true
  await host.stop()
}

// Crash on load
host = await startHost({ port, home: `${home}-broken`, env: { DEEPWIDGETS_WIDGETS_BROKEN: '1' }, log: 'broken.log' })
try {
  await sleep(500)
  const rows = await host.getJson('/api/widgets-dev/rows')
  const broken = rows.body.find((row) => row.optionsId === 'deepwidgets-widget-broken' || row.id === 'deepwidgets-widget-broken')
  const list = await host.getJson('/api/widgets')
  const slugs = list.body.widgets.map((w) => w.slug)
  check(results, 'crashed plugin: fiber failed, its widget removed', broken?.state === 3 && !slugs.includes('broken'), `fiber state=${broken?.state} (3=failed) slugs=${slugs}`)
  const brokenRoute = await host.api('/api/widgets/broken/program')
  check(results, 'crashed plugin: routes gone', brokenRoute.status === 404)
  const ok = await host.postJson('/api/widgets/groceries/call', { action: 'list' })
  check(results, 'crashed plugin: runtime and others fine', ok.status === 200)
} finally {
  await host.stop()
}
const failed = results.filter((r) => !r.ok).length
console.log(`restart: ${results.length - failed} pass, ${failed} fail`)
process.exit(failed === 0 ? 0 : 1)
