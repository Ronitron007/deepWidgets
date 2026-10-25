import { Context } from '../vendor/cordis/lib/index.js'
import Loader from '../vendor/loader/lib/index.js'
import * as trace from '../deepwidgets/trace/index.js'

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

let finished = false
const timeout = setTimeout(() => {
  if (finished) return
  console.log('trace-late-row: fail: timeout')
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

function goodPending(list, id) {
  return list.some((message) => message.kind === 'plugin'
    && message.name === `name:cordis:${id}`
    && message.state === 'pending'
    && message.detail === `cordis:${id} waits for deepwidgets-missing`
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
  const ctx = new Context()
  const routes = []
  ctx.provide('webServer', { register: () => () => {} })
  ctx.provide('connection', { fetch: { register: (route) => { routes.push(route); return async () => {} } } })
  await ctx.plugin(Loader).await()
  const loader = ctx.get('loader')
  const late = Promise.withResolvers()
  const broken = Promise.withResolvers()
  const late2 = Promise.withResolvers()
  loader.builtins.trace = trace
  loader.builtins.late = late.promise
  loader.builtins.broken = broken.promise
  loader.builtins.late2 = late2.promise
  const boot = loader.root.update([
    { id: 'trace', name: 'cordis:trace' },
    { id: 'late', name: 'cordis:late' },
    { id: 'broken', name: 'cordis:broken' },
  ])
  const routeWait = Date.now()
  while (routes.length < 1) {
    if (Date.now() - routeWait > 1000) finish('trace-late-row: fail: no trace route', 1)
    await wait(10)
  }
  await wait(10)
  late.resolve({ inject: ['deepwidgets-missing'], apply() {} })
  await wait(10)
  broken.reject(new Error('trace-late-row import failed'))
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
  const lateCount = second.filter((message) => message.kind === 'plugin' && message.name === 'name:cordis:late').length
  if (!seqOk(first) || !seqOk(second)) finish('trace-late-row: fail: seq out of order', 1)
  if (!goodPending(first, 'late')) finish('trace-late-row: fail: no pending message for name:cordis:late', 1)
  if (!goodPending(second, 'late2')) finish('trace-late-row: fail: no pending message for name:cordis:late2', 1)
  if (lateCount !== 1) finish('trace-late-row: fail: more than one message for name:cordis:late', 1)
  finish('trace-late-row: pass', 0)
} catch (error) {
  console.error(error)
  finished = true
  clearTimeout(timeout)
  process.exit(1)
}
