// Fail-loud isolation: a widget whose timer throws is quarantined, the host stays up;
// an error outside widgets still exits the host. Usage: node quarantine.mjs <port> <home>
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { startHost, openStream, check, NOTES } from './harness.mjs'

const port = Number(process.argv[2] ?? 47975)
const home = process.argv[3]
const results = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

for (const [mode, event] of [['throw', 'uncaughtException'], ['reject', 'unhandledRejection']]) {
  const log = `quarantine-${mode}.log`
  const host = await startHost({ port, home: `${home}-${mode}`, env: { DEEPWIDGETS_WIDGETS_BOMB: mode, DEEPWIDGETS_BOMB_MS: '3000' }, log })
  try {
    const before = await host.getJson('/api/widgets')
    const stream = openStream(host, 'bomb')
    await stream.next((f) => f.type === 'hello')
    const groceries = openStream(host, 'groceries')
    await groceries.next((f) => f.type === 'hello')
    const failed = await stream.next((f) => f.type === 'failed', 8_000).catch(() => null)
    await sleep(300)
    const after = await host.getJson('/api/widgets')
    const bomb = after.body.widgets.find((w) => w.slug === 'bomb')
    const route = await host.api('/api/widgets/bomb/program')
    const add = await host.postJson('/api/widgets/groceries/call', { action: 'add', args: { text: `after-${mode}` } })
    const push = await groceries.next((f) => f.type === 'data', 3_000).catch(() => null)
    const weather = await host.postJson('/api/widgets/weather/call', { action: 'current' })
    const text = readFileSync(join(NOTES, log), 'utf8')
    check(results, `${mode}: bomb listed before`, before.body.widgets.some((w) => w.slug === 'bomb' && w.status === 'ok'))
    check(results, `${mode}: stream got {type:"failed"}`, failed !== null, failed?.message)
    check(results, `${mode}: bomb quarantined (status failed, ${event})`, bomb?.status === 'failed' && bomb.failure?.event === event, JSON.stringify(bomb?.failure))
    check(results, `${mode}: bomb routes 404`, route.status === 404)
    check(results, `${mode}: host alive, others serve + push`, host.child.exitCode === null && add.status === 200 && push !== null && weather.status === 200)
    check(results, `${mode}: claim logged`, text.includes('claimed by a widget quarantine'))
    groceries.close()
    stream.close()
  } finally {
    await host.stop()
  }
}

// Unclaimed error: fail-loud keeps its exit.
const host = await startHost({ port, home: `${home}-crash`, log: 'quarantine-crash.log' })
try {
  await host.postJson('/api/widgets-dev/crash', {})
  const code = await Promise.race([new Promise((resolve) => host.child.once('exit', (c) => resolve(c))), sleep(8_000).then(() => 'alive')])
  const text = readFileSync(join(NOTES, 'quarantine-crash.log'), 'utf8')
  check(results, 'unclaimed error still exits 1 (fail-loud kept)', code === 1 && text.includes('fatal uncaught exception'), `exit=${code}`)
} finally {
  await host.stop()
}
const failedCount = results.filter((r) => !r.ok).length
console.log(`quarantine: ${results.length - failedCount} pass, ${failedCount} fail`)
process.exit(failedCount === 0 ? 0 : 1)
