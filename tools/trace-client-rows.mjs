import { Context } from '../vendor/cordis/lib/index.js'
import Loader from '../vendor/loader/lib/index.js'
import * as trace from '../deepwidgets/trace/index.js'

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

let finished = false
const timeout = setTimeout(() => {
  if (finished) return
  console.log('trace-client-rows: fail: timeout')
  process.exit(1)
}, 10_000)

function finish(line, code) {
  finished = true
  clearTimeout(timeout)
  console.log(line)
  process.exit(code)
}

function seqOk(list) {
  return list.every((message, index) => message.seq === index + 1)
}

function clientOnly(list) {
  return list.filter((message) => message.process === 'client')
}

function goodPending(list, id) {
  return list.some((message) => message.kind === 'plugin'
    && message.name === `cordis:${id}`
    && message.state === 'pending'
    && message.detail === `cordis:${id} waits for deepwidgets-missing`
    && !Object.hasOwn(message, 'snapshot'))
}

function snapshotLoader(list) {
  return list.some((message) => message.kind === 'service'
    && message.name === 'loader'
    && message.state === 'up'
    && message.snapshot === true)
}

function liveService(list, name) {
  return list.some((message) => message.kind === 'service'
    && message.name === name
    && message.state === 'up'
    && !Object.hasOwn(message, 'snapshot'))
}

function liveActive(list, id) {
  return list.some((message) => message.kind === 'plugin'
    && message.name === `cordis:${id}`
    && message.state === 'active'
    && message.detail === `cordis:${id}`
    && !Object.hasOwn(message, 'snapshot'))
}

async function readStream(route) {
  const controller = new AbortController()
  const timer = setTimeout(() => { controller.abort() }, 200)
  const messages = []
  try {
    const response = await route.fetch(new Request('http://127.0.0.1/api/trace', { signal: controller.signal }))
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      let step
      try {
        step = await reader.read()
      } catch (error) {
        if (error?.name === 'AbortError') break
        throw error
      }
      if (step.done) break
      buffer += decoder.decode(step.value, { stream: true })
      let split = buffer.indexOf('\n\n')
      while (split !== -1) {
        const frame = buffer.slice(0, split)
        buffer = buffer.slice(split + 2)
        const line = frame.split('\n').find((item) => item.startsWith('data: '))
        if (line !== undefined) messages.push(JSON.parse(line.slice(6)))
        split = buffer.indexOf('\n\n')
      }
    }
  } finally {
    clearTimeout(timer)
  }
  return messages
}

try {
  const host = new Context()
  const routes = []
  host.provide('webServer', { register: () => () => {} })
  host.provide('connection', { fetch: { register: (route) => { routes.push(route); return async () => {} } } })
  await host.plugin(Loader).await()
  await host.plugin(trace).await()
  if (routes.length !== 1) finish('trace-client-rows: fail: no trace route', 1)

  const statuses = []
  let loaded
  globalThis.window = { __ModuleLoader__: { load: (definition) => { loaded = definition } } }
  globalThis.location = { search: '?window=check' }
  globalThis.fetch = async (input, init) => {
    if (input !== 'api/trace') throw new Error(`trace-client-rows: unexpected fetch ${String(input)}`)
    const response = await routes[0].fetch(new Request('http://127.0.0.1/api/trace', init))
    statuses.push(response.status)
    return response
  }
  await import('../deepwidgets/trace/client.js')
  if (loaded?.id !== '@deepwidgets/trace') finish('trace-client-rows: fail: no client module', 1)

  const ctx = new Context()
  await ctx.plugin(Loader).await()
  const loader = ctx.get('loader')
  const late = Promise.withResolvers()
  const broken = Promise.withResolvers()
  const late2 = Promise.withResolvers()
  loader.builtins.trace = loaded.factory()
  loader.builtins.late = late.promise
  loader.builtins.broken = broken.promise
  loader.builtins.late2 = late2.promise
  const boot = loader.root.update([
    { id: 'trace', name: 'cordis:trace' },
    { id: 'late', name: 'cordis:late' },
    { id: 'broken', name: 'cordis:broken' },
  ])
  const postWait = Date.now()
  while (statuses.length < 1) {
    if (Date.now() - postWait > 1000) finish('trace-client-rows: fail: no post', 1)
    await wait(10)
  }
  await wait(10)
  late.resolve({ inject: ['deepwidgets-missing'], apply() {} })
  await wait(10)
  broken.reject(new Error('trace-client-rows import failed'))
  await boot
  await loader.await()
  await wait(10)
  const first = await readStream(routes[0])
  const created = loader.create({ id: 'late2', name: 'cordis:late2' })
  await wait(10)
  late2.resolve({ inject: ['deepwidgets-missing'], apply() {} })
  await created
  await loader.await()
  await wait(10)
  const second = await readStream(routes[0])
  ctx.provide('deepwidgets-missing', {})
  await loader.await()
  await wait(10)
  const third = await readStream(routes[0])

  const bad = statuses.find((status) => status !== 200)
  const firstClient = clientOnly(first)
  const secondClient = clientOnly(second)
  const thirdClient = clientOnly(third)
  const wrongWindow = clientOnly(third).find((message) => message.window !== 'check')
  const lateCount = secondClient.filter((message) => message.kind === 'plugin' && message.name === 'cordis:late').length
  if (bad !== undefined) finish(`trace-client-rows: fail: post status ${String(bad)}`, 1)
  if (!seqOk(first) || !seqOk(second) || !seqOk(third)) finish('trace-client-rows: fail: seq out of order', 1)
  if (wrongWindow !== undefined) finish(`trace-client-rows: fail: client window ${String(wrongWindow.window)}`, 1)
  if (!snapshotLoader(firstClient)) finish('trace-client-rows: fail: no snapshot message for service loader', 1)
  if (!goodPending(firstClient, 'late')) finish('trace-client-rows: fail: no pending message for cordis:late', 1)
  if (!goodPending(secondClient, 'late2')) finish('trace-client-rows: fail: no pending message for cordis:late2', 1)
  if (lateCount !== 1) finish('trace-client-rows: fail: more than one message for cordis:late', 1)
  if (!liveService(thirdClient, 'deepwidgets-missing')) finish('trace-client-rows: fail: no live service message for deepwidgets-missing', 1)
  if (!liveActive(thirdClient, 'late')) finish('trace-client-rows: fail: no live active message for cordis:late', 1)
  finish('trace-client-rows: pass', 0)
} catch (error) {
  console.error(error)
  finished = true
  clearTimeout(timeout)
  process.exit(1)
}
