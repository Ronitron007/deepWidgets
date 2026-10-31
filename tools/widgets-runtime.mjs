#!/usr/bin/env node
/**
 * Host check of the widget runtime (unit widget.runtime_core).
 * It boots the CLI host (web profile) on free loopback ports, checks each line of
 * widget_mvp.runtime.contract and widget_mvp.runtime.routes, restarts the host once,
 * and checks that a replayed requestId runs once.
 * Prints `widgets-runtime: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first.
 * In-host calls (register, setProgram, update, the conflict) go over the host inspector,
 * with the Loader lookup of tools/smoke-desktop.mjs.
 */
import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const work = await mkdtemp(join(process.env.WIDGETS_RUNTIME_TMP ?? tmpdir(), 'widgets-runtime-'))
const home = join(work, 'home')
const logPath = join(work, 'host.log')
const results = []
const children = new Set()

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${detail}`}`)
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

function portFree(port) {
  return new Promise((resolve) => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

// ---- host process ----

async function startHost(port, inspectPort) {
  for (const p of [port, inspectPort]) if (!(await portFree(p))) throw new Error(`port ${String(p)} is taken`)
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  const child = spawn(process.execPath, [`--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
  child.stderr.pipe(out)
  const url = await new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error('the host did not print its URL in 90 s')), 90_000)
    child.stdout.on('data', (chunk) => {
      out.write(chunk)
      text += chunk
      const match = text.match(/(http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`the host exited with ${String(code)}`)) })
  })
  const login = await fetch(url, { redirect: 'manual' })
  const cookie = login.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
  if (cookie === '') throw new Error(`the login gave no cookie (${String(login.status)})`)
  const base = `http://127.0.0.1:${String(port)}`
  const api = (path, init = {}) => fetch(base + path, { ...init, headers: { cookie, ...(init.body === undefined ? {} : { 'content-type': 'application/json' }), ...init.headers } })
  const getJson = async (path) => { const r = await api(path); return { status: r.status, body: await r.json().catch(() => null) } }
  const post = async (path, body) => {
    const r = await api(path, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })
    return { status: r.status, body: await r.json().catch(() => null) }
  }
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    child.once('exit', () => resolve())
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 10_000).unref()
  })
  const inspector = await connectInspector(inspectPort)
  return { base, cookie, api, getJson, post, stop, inspector }
}

// ---- inspector: Loader lookup as in tools/smoke-desktop.mjs ----

function cdpSession(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    const waiting = new Map()
    let next = 0
    socket.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          next += 1
          const id = next
          socket.send(JSON.stringify({ id, method, params }))
          return new Promise((done, fail) => { waiting.set(id, { resolve: done, reject: fail }) })
        },
        close() { socket.close() },
      })
    })
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data))
      const item = waiting.get(message.id)
      if (item === undefined) return
      waiting.delete(message.id)
      if (message.error) item.reject(new Error(message.error.message ?? 'cdp error'))
      else if (message.result?.exceptionDetails) {
        const details = message.result.exceptionDetails
        item.reject(new Error(details.exception?.description ?? details.text ?? 'evaluate failed'))
      } else item.resolve(message.result)
    })
    socket.addEventListener('error', () => {
      for (const item of waiting.values()) item.reject(new Error('debugger connection failed'))
      reject(new Error('debugger connection failed'))
    })
  })
}

async function connectInspector(inspectPort) {
  const targets = await (await fetch(`http://127.0.0.1:${String(inspectPort)}/json/list`)).json()
  if (typeof targets[0]?.webSocketDebuggerUrl !== 'string') throw new Error('the inspector has no target')
  const session = await cdpSession(targets[0].webSocketDebuggerUrl)
  const proto = await session.send('Runtime.evaluate', { expression: 'Function.prototype' })
  const functions = await session.send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId })
  const loaderProto = await session.send('Runtime.callFunctionOn', {
    objectId: functions.objects.objectId,
    functionDeclaration: 'function () { const found = this.filter((fn) => fn.name === "Loader" && typeof fn.prototype?.showLog === "function" && typeof fn.prototype?.locate === "function"); if (found.length !== 1) throw new Error("Loader functions " + found.length); return found[0].prototype }',
  })
  const loaders = await session.send('Runtime.queryObjects', { prototypeObjectId: loaderProto.result.objectId })
  await session.send('Runtime.callFunctionOn', {
    objectId: loaders.objects.objectId,
    functionDeclaration: 'function () { if (this.length !== 1) throw new Error("Loader instances " + this.length); globalThis.__widgetsCheck = { loader: this[0] } }',
  })
  return {
    /** Evaluate an async function body in the host; `wc` is the check scratch object. */
    async run(body) {
      const reply = await session.send('Runtime.evaluate', {
        expression: `(async (wc) => { ${body} })(globalThis.__widgetsCheck)`,
        awaitPromise: true,
        returnByValue: true,
      })
      return reply.result.value
    },
    close() { session.close() },
  }
}

// ---- server-sent events ----

function openStream(host, path) {
  const frames = []
  const waiters = []
  const controller = new AbortController()
  const done = (async () => {
    const response = await fetch(host.base + path, { headers: { cookie: host.cookie }, signal: controller.signal })
    if (!response.ok) throw new Error(`${path}: ${String(response.status)}`)
    const decoder = new TextDecoder()
    let buffer = ''
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true })
      let index
      while ((index = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)
        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const frame = JSON.parse(line.slice(6))
          frames.push(frame)
          for (const waiter of [...waiters]) if (waiter.test(frame)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(frame) }
        }
      }
    }
    return 'ended'
  })().catch((error) => (error.name === 'AbortError' ? 'aborted' : `error: ${error.message}`))
  return {
    frames,
    done,
    close: () => controller.abort(),
    next(test, ms = 5_000) {
      const found = frames.find(test)
      if (found) return Promise.resolve(found)
      return new Promise((resolve) => {
        const waiter = { test, resolve }
        waiters.push(waiter)
        setTimeout(() => { const i = waiters.indexOf(waiter); if (i !== -1) { waiters.splice(i, 1); resolve(null) } }, ms)
      })
    },
  }
}

// ---- the checks ----

/** The in-host check widget: actions that probe the queue, the timeout, and the errors. */
const CHECK_WIDGET = `
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  wc.def = {
    slug: 'check', title: 'Check', program: 'root = Card([])', initialState: { n: 0 }, timeoutMs: 2000,
    actions: [
      { name: 'add', kind: 'mutation', handler: async (_args, w) => { const seen = w.state.n; await pause(10); return w.update((s) => ({ ...s, n: seen + 1 })) } },
      { name: 'late', kind: 'mutation', timeoutMs: 300, handler: async (_args, w) => {
        await pause(600)
        wc.lateAborted = w.signal.aborted
        try { await w.update((s) => ({ ...s, n: s.n + 1000 })); wc.late = 'wrote' } catch (error) { wc.late = error.code ?? String(error) }
      } },
      { name: 'leak', kind: 'mutation', timeoutMs: 300, handler: async () => {
        await pause(600)
        try { await wc.ctx.widgets.update('check', (s) => ({ ...s, n: s.n + 1000 })); wc.leak = 'wrote' } catch (error) { wc.leak = error.code ?? String(error) }
      } },
      { name: 'boom', kind: 'mutation', handler: () => { throw new Error('boom on purpose') } },
      { name: 'slow', kind: 'mutation', handler: async (_args, w) => { await pause(800); return w.update((s) => ({ ...s, slow: true })) } },
      { name: 'quick', kind: 'mutation', timeoutMs: 200, handler: (_args, w) => w.update((s) => ({ ...s, quick: true })) },
      { name: 'get', kind: 'query', handler: (_args, w) => w.state },
    ],
  }
  wc.fiber = wc.loader.ctx.plugin({ name: 'widgets-check', inject: ['widgets'], apply(ctx) { wc.ctx = ctx; ctx.widgets.register(wc.def) } })
  await wc.fiber
  return wc.ctx.widgets.list().map((w) => w.slug)
`

async function firstHost(host) {
  const list = await host.getJson('/api/widgets')
  const sample = list.body?.widgets?.find((w) => w.slug === 'sample')
  check('GET /api/widgets lists sample with { slug, title, rev, programRev }', list.status === 200 && sample !== undefined && ['slug', 'title', 'rev', 'programRev'].every((k) => k in sample), JSON.stringify(list.body))

  const program = await host.getJson('/api/widgets/sample/program')
  check('GET program gives { rev, text }', program.status === 200 && program.body.rev === 1 && program.body.text.includes('Mutation("add"'), `rev=${String(program.body?.rev)}`)

  const events = openStream(host, '/api/widgets/events')
  const eventsHello = await events.next((f) => f.type === 'hello')
  check('events stream: first frame hello with slugs', events.frames[0]?.type === 'hello' && eventsHello?.slugs?.includes('sample'), JSON.stringify(eventsHello))

  const stream = openStream(host, '/api/widgets/sample/stream')
  const hello = await stream.next((f) => f.type === 'hello')
  check('slug stream: first frame hello { rev, programRev }', stream.frames[0]?.type === 'hello' && hello.rev === 0 && hello.programRev === 1, JSON.stringify(hello))

  // 10 parallel add calls give +10.
  const adds = await Promise.all(Array.from({ length: 10 }, () => host.post('/api/widgets/sample/call', { action: 'add', args: { by: 1 } })))
  const got = await host.post('/api/widgets/sample/call', { action: 'get' })
  check('sample: 10 parallel add calls give +10', adds.every((a) => a.status === 200 && a.body.ok) && got.body.result.count === 10 && got.body.rev === 10, `count=${String(got.body?.result?.count)} rev=${String(got.body?.rev)}`)
  const data = await stream.next((f) => f.type === 'data' && f.rev === 10)
  check('slug stream: data { rev }', data !== null, JSON.stringify(stream.frames.filter((f) => f.type === 'data').at(-1)))

  const slugs = await host.inspector.run(CHECK_WIDGET)
  check('register from a plugin fiber', Array.isArray(slugs) && slugs.includes('check'), JSON.stringify(slugs))
  const added = await events.next((f) => f.type === 'added' && f.slug === 'check')
  check('events stream: added', added !== null)
  const checkStream = openStream(host, '/api/widgets/check/stream')
  await checkStream.next((f) => f.type === 'hello')

  // The queue: read-wait-write handlers lose updates without it.
  await Promise.all(Array.from({ length: 10 }, () => host.post('/api/widgets/check/call', { action: 'add' })))
  const n = (await host.post('/api/widgets/check/call', { action: 'get' })).body.result.n
  check('queue: 10 parallel read-wait-write add calls give +10', n === 10, `n=${String(n)}`)

  // The timeout: 504, w.signal aborted, and the later write refused.
  const late = await host.post('/api/widgets/check/call', { action: 'late' })
  await sleep(700)
  const afterLate = (await host.post('/api/widgets/check/call', { action: 'get' })).body.result.n
  const lateFacts = await host.inspector.run('return { late: wc.late, aborted: wc.lateAborted }')
  check('timeout: 504 timeout', late.status === 504 && late.body.error?.code === 'timeout', JSON.stringify(late.body))
  check('timeout: w.signal aborted and the later write is refused', lateFacts.aborted === true && lateFacts.late === 'timeout' && afterLate === 10, `late=${String(lateFacts.late)} aborted=${String(lateFacts.aborted)} n=${String(afterLate)}`)

  // The timeout also refuses a later ctx.widgets.update of that call (not only w.update).
  const leak = await host.post('/api/widgets/check/call', { action: 'leak' })
  await sleep(700)
  const afterLeak = (await host.post('/api/widgets/check/call', { action: 'get' })).body.result.n
  const leakFact = await host.inspector.run('return wc.leak')
  check('timeout: a later ctx.widgets.update of the call is refused', leak.status === 504 && leakFact === 'timeout' && afterLeak === 10, `status=${String(leak.status)} leak=${String(leakFact)} n=${String(afterLeak)}`)

  // busy: a job that waits longer than its timeout fails and does not run.
  const slow = host.post('/api/widgets/check/call', { action: 'slow' })
  await sleep(50)
  const quick = await host.post('/api/widgets/check/call', { action: 'quick' })
  await slow
  const afterBusy = (await host.post('/api/widgets/check/call', { action: 'get' })).body.result
  check('busy: 503 busy and the job did not run', quick.status === 503 && quick.body.error?.code === 'busy' && afterBusy.slow === true && afterBusy.quick === undefined, `${String(quick.status)} ${JSON.stringify(afterBusy)}`)

  // Error codes and their statuses.
  const boom = await host.post('/api/widgets/check/call', { action: 'boom' })
  check('handler-error 500', boom.status === 500 && boom.body.error?.code === 'handler-error', JSON.stringify(boom.body))
  const unknownAction = await host.post('/api/widgets/sample/call', { action: 'nope' })
  check('unknown-action 404', unknownAction.status === 404 && unknownAction.body.error?.code === 'unknown-action')
  const invalid = await host.post('/api/widgets/sample/call', { action: 'add', args: { by: 'x' } })
  check('invalid-args 422', invalid.status === 422 && invalid.body.error?.code === 'invalid-args')
  const badJson = await host.post('/api/widgets/sample/call', '{not json')
  const noAction = await host.post('/api/widgets/sample/call', { args: {} })
  check('bad-request 400', badJson.status === 400 && badJson.body.error?.code === 'bad-request' && noAction.status === 400 && noAction.body.error?.code === 'bad-request')
  const ghostRoute = await host.post('/api/widgets/ghost/call', { action: 'get' })
  const ghost = await host.inspector.run(`try { await wc.ctx.widgets.call('ghost', 'get', {}, { caller: 'check' }); return null } catch (error) { return { code: error.code, status: error.status } }`)
  check('unknown-widget 404', ghostRoute.status === 404 && ghost?.code === 'unknown-widget' && ghost.status === 404, JSON.stringify(ghost))
  const first = await host.post('/api/widgets/sample/call', { action: 'add', args: { by: 1 }, requestId: 'k1' })
  const reused = await host.post('/api/widgets/sample/call', { action: 'add', args: { by: 2 }, requestId: 'k1' })
  const repeat = await host.post('/api/widgets/sample/call', { action: 'add', args: { by: 1 }, requestId: 'k1' })
  check('idempotency-conflict 409', first.status === 200 && reused.status === 409 && reused.body.error?.code === 'idempotency-conflict', JSON.stringify(reused.body))
  check('a replayed requestId in one host gives replayed and runs once', repeat.body.replayed === true && repeat.body.rev === first.body.rev, JSON.stringify(repeat.body))
  const conflict = await host.inspector.run(`try { wc.ctx.widgets.register(wc.def); return null } catch (error) { return { code: error.code, status: error.status } }`)
  check('conflict 409 on a second live register', conflict?.code === 'conflict' && conflict.status === 409, JSON.stringify(conflict))

  // update() and setProgram() from a plugin, the change feed, and the program frame.
  const cursor = await host.inspector.run(`return wc.ctx.widgets.cursor()`)
  const updated = await host.inspector.run(`return wc.ctx.widgets.update('sample', (s) => ({ count: s.count + 100 }), { by: 'check-timer' })`)
  const changes = await host.inspector.run(`return wc.ctx.widgets.changes(${JSON.stringify(cursor)})`)
  check('update() writes through the queue and the change feed names the writer', updated?.count === 111 && changes.changes.some((c) => c.slug === 'sample' && c.kind === 'state' && c.by === 'check-timer'), JSON.stringify(changes.changes))
  const before = stream.frames.length
  const setProgram = await host.inspector.run(`return wc.ctx.widgets.setProgram('sample', 'root = Card([])', { by: 'check' })`)
  const programFrame = await stream.next((f) => f.type === 'program' && stream.frames.indexOf(f) >= before)
  const programAfter = await host.getJson('/api/widgets/sample/program')
  check('slug stream: program { rev }', setProgram?.rev === 2 && programFrame?.rev === 2 && programAfter.body.text === 'root = Card([])', JSON.stringify(programFrame))

  // removed: the owner fiber ends.
  await host.inspector.run('await wc.fiber.dispose()')
  const removed = await checkStream.next((f) => f.type === 'removed')
  const ended = await Promise.race([checkStream.done, sleep(2_000).then(() => 'still open')])
  const removedEvent = await events.next((f) => f.type === 'removed' && f.slug === 'check')
  const goneRoute = await host.post('/api/widgets/check/call', { action: 'get' })
  check('slug stream: removed, then the stream ends and the routes go', removed !== null && ended === 'ended' && goneRoute.status === 404, `stream=${ended} route=${String(goneRoute.status)}`)
  check('events stream: removed', removedEvent !== null)

  // The sample timer: tickMs > 0 adds 1 at that interval.
  const tickStart = (await host.post('/api/widgets/sample/call', { action: 'get' })).body.result.count
  await host.inspector.run(`const entry = [...wc.loader.entries()].find((e) => e.options.id === 'deepwidgets-widget-sample'); await entry.fiber.update({ tickMs: 100 }, true)`)
  await sleep(700)
  const ticked = (await host.post('/api/widgets/sample/call', { action: 'get' })).body.result.count
  check('sample timer: tickMs 100 adds 1 at that interval', ticked - tickStart >= 3, `count ${String(tickStart)} -> ${String(ticked)}`)
  await host.inspector.run(`const entry = [...wc.loader.entries()].find((e) => e.options.id === 'deepwidgets-widget-sample'); await entry.fiber.update({ tickMs: 0 }, true)`)

  events.close()
  stream.close()
}

async function main() {
  const port = await freePort()
  const inspectPort = await freePort()
  console.log(`widgets-runtime: work folder ${work}, port ${String(port)}, inspector ${String(inspectPort)}`)
  let host = await startHost(port, inspectPort)
  let replay
  try {
    await firstHost(host)
    replay = await host.post('/api/widgets/sample/call', { action: 'add', args: { by: 5 }, requestId: 'restart-1' })
  } finally {
    host.inspector.close()
    await host.stop()
  }

  host = await startHost(port, inspectPort)
  try {
    const count = (await host.post('/api/widgets/sample/call', { action: 'get' })).body.result.count
    const again = await host.post('/api/widgets/sample/call', { action: 'add', args: { by: 5 }, requestId: 'restart-1' })
    const after = (await host.post('/api/widgets/sample/call', { action: 'get' })).body.result.count
    check('state survives the restart', count === replay.body.result.count, `before=${JSON.stringify(replay.body.result)} after=${String(count)}`)
    check('restart: a replayed requestId gives replayed: true and runs once', again.status === 200 && again.body.replayed === true && again.body.rev === replay.body.rev && after === count, `answer=${JSON.stringify(again.body)} count ${String(count)} -> ${String(after)}`)
    const other = await host.post('/api/widgets/sample/call', { action: 'add', args: { by: 6 }, requestId: 'restart-1' })
    check('restart: the same requestId with other args gives idempotency-conflict', other.status === 409 && other.body.error?.code === 'idempotency-conflict')
  } finally {
    host.inspector.close()
    await host.stop()
  }
}

let exitCode = 1
try {
  await main()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-runtime: pass')
    exitCode = 0
  } else {
    console.log(`widgets-runtime: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-runtime: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  for (const child of children) child.kill('SIGKILL')
}
process.exit(exitCode)
