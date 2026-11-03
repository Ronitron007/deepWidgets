#!/usr/bin/env node
// Replay of the TLC bug paths of ActionContract.tla against the real runtime at the sync commit (see SKILL.md).
// Drives a CLI host as tools/widgets-runtime.mjs does (helpers copied from it).
// Usage: node replay.mjs <crash|late|overlap>
import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'

// The checkout that holds this skill: action_contract -> widget-state-models -> skills -> .agents -> root.
const ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const work = await mkdtemp(join(tmpdir(), 'widget-state-models-action-'))
const home = join(work, 'home')
const logPath = join(work, 'host.log')
const children = new Set()
const t0 = Date.now()
const say = (msg) => console.log(`[${String(Date.now() - t0).padStart(5)} ms] ${msg}`)
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

async function startHost(port, inspectPort) {
  if (port === 47615 || inspectPort === 47615) throw new Error('port 47615 belongs to the user app')
  for (const p of [port, inspectPort]) if (!(await portFree(p))) throw new Error(`port ${String(p)} is taken`)
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  const child = spawn(process.execPath, [`--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home, env: { ...process.env, DSH_HOME: home }, stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
  child.stderr.pipe(out)
  const url = await new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error('no URL in 90 s')), 90_000)
    child.stdout.on('data', (chunk) => {
      out.write(chunk)
      text += chunk
      const match = text.match(/(http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`host exited ${String(code)}`)) })
  })
  const login = await fetch(url, { redirect: 'manual' })
  const cookie = login.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
  const base = `http://127.0.0.1:${String(port)}`
  const post = async (path, body) => {
    const r = await fetch(base + path, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { status: r.status, body: await r.json().catch(() => null) }
  }
  const kill = () => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    child.once('exit', () => resolve())
    child.kill('SIGKILL')
  })
  const inspector = await connectInspector(inspectPort)
  return { post, kill, inspector }
}

const WIDGET = `
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  wc.pause = pause
  wc.def = {
    slug: 'fv', title: 'FV', program: 'root = Card([])', initialState: { n: 0 }, timeoutMs: 5000,
    actions: [
      { name: 'writeThenWait', kind: 'mutation', timeoutMs: 10000, handler: async (_a, w) => {
        await w.update((s) => ({ ...s, n: s.n + 1 })); wc.wroteAt = Date.now(); await pause(3000); return 'done' } },
      { name: 'quickWrite', kind: 'mutation', timeoutMs: 300, handler: async (_a, w) => {
        wc.quickStart = Date.now(); await w.update((s) => ({ ...s, n: s.n + 1 })); return 'done' } },
      { name: 'rmw', kind: 'mutation', handler: async (_a, w) => {
        wc.rmwStart = Date.now(); wc.rmwSeen = w.state.n; const seen = w.state.n; await pause(10)
        await w.update((s) => ({ ...s, n: seen + 1 })); return 'done' } },
      { name: 'nearEdge', kind: 'mutation', timeoutMs: 200, handler: async (args, w) => {
        await pause(args.wait); await w.update((s) => ({ ...s, n: s.n + 1 })); return 'done' } },
      { name: 'get', kind: 'query', handler: (_a, w) => w.state },
    ],
  }
  wc.fiber = wc.loader.ctx.plugin({ name: 'fv-check', inject: ['widgets'], apply(ctx) { wc.ctx = ctx; ctx.widgets.register(wc.def) } })
  await wc.fiber
  return wc.ctx.widgets.get('fv')
`
// Slow disk: delay each rename of the json backend publish while globalThis.__fvSlow > 0 (no product code change).
const SLOW_DISK = `
  const fsp = process.getBuiltinModule('node:fs/promises')
  if (!globalThis.__fvRename) {
    globalThis.__fvRename = fsp.rename
    fsp.rename = async (...args) => { if (globalThis.__fvSlow > 0) await new Promise((r) => setTimeout(r, globalThis.__fvSlow)); return globalThis.__fvRename(...args) }
    process.getBuiltinModule('node:module').syncBuiltinESMExports()
  }
  return 'patched'
`
const state = (host) => host.inspector.run(`const s = wc.ctx.widgets.get('fv'); return { rev: s.rev, n: s.data.n, now: Date.now() }`)

async function crash(port, inspectPort) {
  let host = await startHost(port, inspectPort)
  say(`host 1 up; widget: ${JSON.stringify(await host.inspector.run(WIDGET))}`)
  say('1-6. call A (requestId r1) arrives, queues, starts, its handler calls w.update')
  const pending = host.post('/api/widgets/fv/call', { action: 'writeThenWait', requestId: 'r1' }).catch((e) => ({ error: e.message }))
  for (;;) { const s = await state(host); if (s.rev === 1) { say(`7. call A: the write lands: ${JSON.stringify(s)}`); break } await sleep(20) }
  await host.kill()
  say(`8. the host restarts (SIGKILL while the handler still runs); call A answer: ${JSON.stringify(await pending)}`)
  host.inspector.close()
  host = await startHost(port, inspectPort)
  say(`host 2 up; widget: ${JSON.stringify(await host.inspector.run(WIDGET))}`)
  say('9-15. the retry of A (same requestId r1) arrives')
  const retry = await host.post('/api/widgets/fv/call', { action: 'writeThenWait', requestId: 'r1' })
  const after = await state(host)
  say(`retry answer: ${JSON.stringify(retry)}; state: ${JSON.stringify(after)}`)
  say(after.n === 2 ? 'CONFIRMED AtMostOnce breaks: requestId r1 changed the state twice' : 'NOT confirmed')
  const again = await host.post('/api/widgets/fv/call', { action: 'writeThenWait', requestId: 'r1' })
  say(`a third send of r1 now replays: ${JSON.stringify(again)}`)
  host.inspector.close(); await host.kill()
}

async function late(port, inspectPort) {
  const host = await startHost(port, inspectPort)
  say(`host up; widget: ${JSON.stringify(await host.inspector.run(WIDGET))}`)
  say(`slow disk: ${await host.inspector.run(SLOW_DISK)}; each publish waits 1000 ms`)
  await host.inspector.run('globalThis.__fvSlow = 1000')
  const cursor = await host.inspector.run(`return wc.ctx.widgets.cursor()`)
  say('1-6. call A (quickWrite, timeout 300 ms, requestId r2) arrives, starts, its write passes the abort check and goes to disk')
  const a = await host.post('/api/widgets/fv/call', { action: 'quickWrite', requestId: 'r2' })
  say(`7. call A times out: ${JSON.stringify(a)}; state now ${JSON.stringify(await state(host))}`)
  for (;;) { const s = await state(host); if (s.rev === 1) { say(`8. call A: the write lands after the timeout: ${JSON.stringify(s)}`); break } await sleep(20) }
  const ch = await host.inspector.run(`return wc.ctx.widgets.changes(${JSON.stringify(cursor)}).changes`)
  say(`change feed: ${JSON.stringify(ch)}`)
  say(a.status === 504 ? 'CONFIRMED NoLateWrite breaks: a 504 call wrote the state' : 'NOT confirmed')
  await host.inspector.run('globalThis.__fvSlow = 0')
  say('9-15 (no restart). the retry of A (requestId r2) arrives')
  const retry = await host.post('/api/widgets/fv/call', { action: 'quickWrite', requestId: 'r2' })
  const s = await state(host)
  say(`retry answer: ${JSON.stringify(retry)}; state ${JSON.stringify(s)}`)
  say(s.n === 2 && retry.body?.replayed === undefined ? 'CONFIRMED AtMostOnce breaks with no restart: r2 wrote twice' : 'NOT confirmed')
  host.inspector.close(); await host.kill()
}

async function overlap(port, inspectPort) {
  const host = await startHost(port, inspectPort)
  say(`host up; widget: ${JSON.stringify(await host.inspector.run(WIDGET))}`)
  say(`slow disk: ${await host.inspector.run(SLOW_DISK)}; each publish waits 1000 ms`)
  await host.inspector.run('globalThis.__fvSlow = 1000')
  const cursor = await host.inspector.run(`return wc.ctx.widgets.cursor()`)
  say('1-7. call A (quickWrite, timeout 300 ms) starts and its write goes to disk; call B (rmw, read-wait-write) queues behind it')
  const a = host.post('/api/widgets/fv/call', { action: 'quickWrite' })
  await sleep(50)
  const b = host.post('/api/widgets/fv/call', { action: 'rmw' })
  const ra = await a
  say(`8. call A times out: ${JSON.stringify(ra)}`)
  const rb = await b
  const facts = await host.inspector.run(`return { quickStart: wc.quickStart, rmwStart: wc.rmwStart, rmwSeen: wc.rmwSeen }`)
  const ch = await host.inspector.run(`return wc.ctx.widgets.changes(${JSON.stringify(cursor)}).changes`)
  const s = await state(host)
  const landA = ch.find((c) => c.action === 'quickWrite')?.at
  say(`9. call B starts at +${facts.rmwStart - facts.quickStart} ms and reads n=${facts.rmwSeen}; 10. call A's write lands at +${landA - facts.quickStart} ms`)
  say(`call B answer: ${JSON.stringify(rb)}; change feed: ${JSON.stringify(ch)}; state ${JSON.stringify(s)}`)
  say(facts.rmwStart < landA && s.rev === 2 && s.n === 1 ? 'CONFIRMED OneAtATime breaks: B ran while A\'s write was pending; 2 writes landed, n went up by 1 (lost update)' : 'NOT confirmed')
  host.inspector.close(); await host.kill()
}

// No slow-disk patch: write close to the timeout, many times, and count 504 calls whose write landed.
async function natural(port, inspectPort) {
  const host = await startHost(port, inspectPort)
  say(`host up; widget: ${JSON.stringify(await host.inspector.run(WIDGET))}`)
  let lateWrites = 0
  let timeouts = 0
  for (let i = 0; i < 400; i += 1) {
    const wait = 190 + (i % 12)
    const before = (await state(host)).rev
    const r = await host.post('/api/widgets/fv/call', { action: 'nearEdge', args: { wait } })
    await sleep(60)
    const after = (await state(host)).rev
    if (r.status === 504) { timeouts += 1; if (after > before) { lateWrites += 1; say(`try ${i}: wait ${wait} ms -> 504 and the write landed (rev ${before} -> ${after})`) } }
  }
  say(`${timeouts} calls got 504; ${lateWrites} of them wrote the state anyway`)
  host.inspector.close(); await host.kill()
}

const scenario = process.argv[2]
let code = 1
try {
  const port = await freePort()
  const inspectPort = await freePort()
  say(`work ${work}, port ${port}, inspector ${inspectPort}`)
  await ({ crash, late, overlap, natural })[scenario](port, inspectPort)
  code = 0
} catch (error) {
  console.log(`replay failed: ${error.stack} (host log ${logPath})`)
} finally {
  for (const child of children) child.kill('SIGKILL')
}
process.exit(code)
