#!/usr/bin/env node
/**
 * Replays of the `action_contract` model paths (spec widget_fv.action, unit widget.action_settle).
 * It boots the CLI host (web profile) on free loopback ports, as tools/widgets-runtime.mjs does,
 * and runs these replays:
 *
 * - `late`: a write is on a slow disk when the timeout fires. The call waits for the write and
 *   gives `timeout-after-write` with the rev, not `timeout`. A retry gives that answer again.
 * - `natural`: 400 calls that write close to their timeout, with no slow disk. No call that
 *   gives `timeout` writes (rule NoLateWrite). Each `timeout-after-write` call wrote once.
 * - `overlap`: call A writes to a slow disk past its timeout. Call B reads, waits, and writes.
 *   No update is lost (rule OneAtATime).
 * - `crash`: SIGKILL after the state write and before the outcome record. The retry gives
 *   `replayed: true` and `resultLost: true`, and the state changed once (rule AtMostOnce).
 * - `nested`: a handler writes, then a nested ctx.widgets.call of another slug gives
 *   `timeout-after-write`. The outer call gives `handler-error` with its own rev, and a retry
 *   gives that answer again.
 * - `hang`: a handler writes, then hangs. The call gives `timeout-after-write` with the rev,
 *   the next mutation of the slug runs, the later write of the hung handler is refused, and
 *   a retry gives the recorded answer.
 *
 * Set WIDGETS_ACTION_REPLAY to a comma list of replay names to run only those.
 * Prints `widgets-action-replay: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first.
 */
import { spawn } from 'node:child_process'
import { createWriteStream, mkdirSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { pinnedExpression } from './lib/in-host.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const work = await mkdtemp(join(process.env.WIDGETS_RUNTIME_TMP ?? tmpdir(), 'widgets-action-replay-'))
const logPath = join(work, 'host.log')
const results = []
const children = new Set()
/** The port of the operator's app. A replay never binds it. */
const USER_APP_PORT = 47615

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
        expression: pinnedExpression(`(async (wc) => { ${body} })(globalThis.__widgetsCheck)`),
        awaitPromise: true,
        returnByValue: true,
      })
      return reply.result.value
    },
    close() { session.close() },
  }
}

// ---- host process ----

/** Start a host with its home in `home`. `kill` sends SIGKILL, so nothing drains. */
async function startHost(home) {
  const port = await freePort()
  const inspectPort = await freePort()
  if (port === USER_APP_PORT || inspectPort === USER_APP_PORT) throw new Error(`port ${String(USER_APP_PORT)} belongs to the operator's app`)
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
  /** A call that gets no answer in 15 s gives status 0, so a hung call fails a check and does not hang the replay. */
  const post = async (path, body) => {
    try {
      const r = await fetch(base + path, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) })
      return { status: r.status, body: await r.json().catch(() => null) }
    } catch (error) {
      if (error?.name === 'TimeoutError') return { status: 0, body: { error: 'no answer in 15 s' } }
      throw error
    }
  }
  const kill = () => new Promise((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) return resolve()
    child.once('exit', () => resolve())
    child.kill('SIGKILL')
  })
  const inspector = await connectInspector(inspectPort)
  const close = async () => { inspector.close(); await kill() }
  return { post, kill, close, inspector }
}

// ---- the replay widget and the slow disk ----

const WIDGET = `
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  wc.def = {
    slug: 'fv', title: 'FV', program: 'root = Card([])', initialState: { n: 0 }, timeoutMs: 5000,
    actions: [
      { name: 'writeThenWait', kind: 'mutation', timeoutMs: 10000, handler: async (_a, w) => {
        await w.update((s) => ({ ...s, n: s.n + 1 })); await pause(3000); return 'done' } },
      { name: 'quickWrite', kind: 'mutation', timeoutMs: 300, handler: async (_a, w) => {
        wc.quickStart = Date.now(); await w.update((s) => ({ ...s, n: s.n + 1 })); return 'done' } },
      { name: 'rmw', kind: 'mutation', handler: async (_a, w) => {
        wc.rmwStart = Date.now(); wc.rmwSeen = w.state.n; const seen = w.state.n; await pause(10)
        await w.update((s) => ({ ...s, n: seen + 1 })); return 'done' } },
      { name: 'nearEdge', kind: 'mutation', timeoutMs: 200, handler: async (args, w) => {
        await pause(args.wait); await w.update((s) => ({ ...s, n: s.n + 1 })); return 'done' } },
      { name: 'writeThenHang', kind: 'mutation', timeoutMs: 300, handler: async (_a, w) => {
        await w.update((s) => ({ ...s, n: s.n + 1 })); await pause(600)
        try { await w.update((s) => ({ ...s, n: s.n + 100 })); wc.hangLate = 'wrote' } catch (error) { wc.hangLate = error.code ?? String(error) }
        await new Promise(() => {}) } },
      { name: 'nestedAfterWrite', kind: 'mutation', handler: async (_a, w) => {
        await w.update((s) => ({ ...s, n: s.n + 1 }))
        return wc.ctx.widgets.call('fv2', 'slowWrite', {}, { caller: 'nested' }) } },
      { name: 'get', kind: 'query', handler: (_a, w) => w.state },
    ],
  }
  wc.def2 = {
    slug: 'fv2', title: 'FV2', program: 'root = Card([])', initialState: { n: 0 }, timeoutMs: 5000,
    actions: [
      { name: 'bump', kind: 'mutation', handler: (_a, w) => w.update((s) => ({ ...s, n: s.n + 1 })) },
      { name: 'get', kind: 'query', handler: (_a, w) => w.state },
      { name: 'slowWrite', kind: 'mutation', timeoutMs: 200, handler: async (_a, w) => {
        await w.update((s) => ({ ...s, n: s.n + 1 })); await pause(1000); return 'done' } },
    ],
  }
  wc.fiber = wc.loader.ctx.plugin({ name: 'fv-check', inject: ['widgets'], apply(ctx) { wc.ctx = ctx; ctx.widgets.register(wc.def); ctx.widgets.register(wc.def2) } })
  await wc.fiber
  return wc.ctx.widgets.get('fv')
`

/** Delay each rename of the json backend publish while `globalThis.__fvSlow > 0`. No product code changes. */
const SLOW_DISK = `
  const fsp = process.getBuiltinModule('node:fs/promises')
  if (!globalThis.__fvRename) {
    globalThis.__fvRename = fsp.rename
    fsp.rename = async (...args) => { if (globalThis.__fvSlow > 0) await new Promise((r) => setTimeout(r, globalThis.__fvSlow)); return globalThis.__fvRename(...args) }
    process.getBuiltinModule('node:module').syncBuiltinESMExports()
  }
  return 'patched'
`

/** Wait until both slugs have their seed records, so no seed write waits on the slow disk. */
async function seeded(host) {
  for (const slug of ['fv', 'fv2']) {
    const r = await host.post(`/api/widgets/${slug}/call`, { action: 'get' })
    if (r.status !== 200) throw new Error(`the seed of ${slug} failed: ${JSON.stringify(r.body)}`)
  }
}

const state = (host) => host.inspector.run(`const s = wc.ctx.widgets.get('fv'); return { rev: s.rev, n: s.data.n }`)

async function waitFor(test, ms = 15_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    if (await test().catch(() => false)) return true
    await sleep(20)
  }
  return false
}

// ---- the replays ----

/** NoLateWrite, slow disk: the write is on disk when the timeout fires. */
async function late() {
  const host = await startHost(join(work, 'late'))
  try {
    await host.inspector.run(WIDGET)
    await seeded(host)
    await host.inspector.run(SLOW_DISK)
    await host.inspector.run('globalThis.__fvSlow = 1000')
    const a = await host.post('/api/widgets/fv/call', { action: 'quickWrite', requestId: 'r2' })
    await sleep(1500)
    const after = await state(host)
    const timedOutAndWrote = a.body?.error?.code === 'timeout' && after.rev > 0
    check('late: a call whose write is on disk at the timeout gives timeout-after-write with rev 1', !timedOutAndWrote && a.status === 504 && a.body?.error?.code === 'timeout-after-write' && a.body.error.rev === 1 && after.n === 1,
      `answer ${String(a.status)} ${JSON.stringify(a.body)}; state ${JSON.stringify(after)}`)
    await host.inspector.run('globalThis.__fvSlow = 0')
    const retry = await host.post('/api/widgets/fv/call', { action: 'quickWrite', requestId: 'r2' })
    const again = await state(host)
    check('late: the retry gives the recorded answer and does not write again', retry.status === 504 && retry.body?.error?.code === 'timeout-after-write' && retry.body.error.rev === 1 && again.n === 1,
      `retry ${JSON.stringify(retry.body)}; state ${JSON.stringify(again)}`)
  } finally {
    await host.close()
  }
}

/** NoLateWrite, no slow disk: many writes close to the timeout. */
async function natural() {
  const host = await startHost(join(work, 'natural'))
  try {
    await host.inspector.run(WIDGET)
    const calls = 400
    let timeouts = 0
    let lateWrites = 0
    let okWrites = 0
    let afterWrite = 0
    let other = 0
    for (let i = 0; i < calls; i += 1) {
      const before = (await state(host)).rev
      const r = await host.post('/api/widgets/fv/call', { action: 'nearEdge', args: { wait: 190 + (i % 12) } })
      // A refused write settles at once. Wait past it before the rev is read.
      await sleep(60)
      const after = (await state(host)).rev
      const code = r.body?.error?.code
      if (code === 'timeout') {
        timeouts += 1
        if (after > before) lateWrites += 1
      } else if (code === 'timeout-after-write' && after === before + 1 && r.body.error.rev === after) afterWrite += 1
      else if (r.status === 200 && after === before + 1) okWrites += 1
      else other += 1
    }
    check(`natural: of ${String(calls)} calls, no call that gives timeout writes`, calls >= 300 && lateWrites === 0 && other === 0,
      `${String(timeouts)} gave timeout, ${String(lateWrites)} of them wrote; ${String(afterWrite)} gave timeout-after-write and wrote once; ${String(okWrites)} gave ok and wrote once; ${String(other)} other`)
  } finally {
    await host.close()
  }
}

/** OneAtATime: B must not run while the write of A is on disk. */
async function overlap() {
  const host = await startHost(join(work, 'overlap'))
  try {
    await host.inspector.run(WIDGET)
    await seeded(host)
    await host.inspector.run(SLOW_DISK)
    await host.inspector.run('globalThis.__fvSlow = 1000')
    const a = host.post('/api/widgets/fv/call', { action: 'quickWrite' })
    await sleep(50)
    const b = host.post('/api/widgets/fv/call', { action: 'rmw' })
    const [ra, rb] = await Promise.all([a, b])
    await host.inspector.run('globalThis.__fvSlow = 0')
    await sleep(1500)
    const s = await state(host)
    const facts = await host.inspector.run('return { rmwSeen: wc.rmwSeen, rmwStartMs: wc.rmwStart - wc.quickStart }')
    check('overlap: no lost update (two writes, n is 2)', s.rev === 2 && s.n === 2 && facts.rmwSeen === 1,
      `A ${String(ra.status)} ${JSON.stringify(ra.body)}; B ${String(rb.status)} ${JSON.stringify(rb.body)}; B read n=${String(facts.rmwSeen)} at +${String(facts.rmwStartMs)} ms; state ${JSON.stringify(s)}`)
  } finally {
    await host.close()
  }
}

/** AtMostOnce: SIGKILL between the state write and the outcome record. */
async function crash() {
  const home = join(work, 'crash')
  let host = await startHost(home)
  try {
    await host.inspector.run(WIDGET)
    const pending = host.post('/api/widgets/fv/call', { action: 'writeThenWait', requestId: 'r1' }).catch((error) => ({ error: error.message }))
    // The handler waits 3 s after its write, so the kill lands between the two writes.
    const landed = await waitFor(async () => (await state(host)).rev === 1)
    await host.kill()
    await pending
    host.inspector.close()
    check('crash: the state write landed before the SIGKILL', landed)
  } catch (error) {
    await host.close()
    throw error
  }
  host = await startHost(home)
  try {
    await host.inspector.run(WIDGET)
    const retry = await host.post('/api/widgets/fv/call', { action: 'writeThenWait', requestId: 'r1' })
    const after = await state(host)
    check('crash: the retry after the SIGKILL gives replayed: true, resultLost: true, and n is 1', retry.status === 200 && retry.body?.replayed === true && retry.body.resultLost === true && retry.body.result === null && retry.body.rev === 1 && after.n === 1,
      `retry ${String(retry.status)} ${JSON.stringify(retry.body)}; state ${JSON.stringify(after)}`)
    const other = await host.post('/api/widgets/fv/call', { action: 'quickWrite', requestId: 'r1' })
    check('crash: the same requestId on another action gives idempotency-conflict', other.status === 409 && other.body?.error?.code === 'idempotency-conflict', JSON.stringify(other.body))
  } finally {
    await host.close()
  }
}

/** widget_fv.action: a handler that hangs after its write never holds the slot. */
async function hang() {
  const host = await startHost(join(work, 'hang'))
  try {
    await host.inspector.run(WIDGET)
    const hung = await host.post('/api/widgets/fv/call', { action: 'writeThenHang', requestId: 'h1' })
    check('hang: the call gives 504 timeout-after-write with rev 1', hung.status === 504 && hung.body?.error?.code === 'timeout-after-write' && hung.body.error.rev === 1,
      `${String(hung.status)} ${JSON.stringify(hung.body)}`)
    const next = await host.post('/api/widgets/fv/call', { action: 'quickWrite' })
    check('hang: the next mutation of the slug runs and does not get busy', next.status === 200 && next.body?.rev === 2, `${String(next.status)} ${JSON.stringify(next.body)}`)
    await sleep(800)
    const facts = await host.inspector.run('return wc.hangLate')
    const s = await state(host)
    check('hang: the later write of the hung handler is refused', facts === 'timeout' && s.rev === 2 && s.n === 2, `later write ${String(facts)}; state ${JSON.stringify(s)}`)
    const retry = await host.post('/api/widgets/fv/call', { action: 'writeThenHang', requestId: 'h1' })
    const after = await state(host)
    check('hang: the retry gives the recorded answer and does not write', retry.status === 504 && retry.body?.error?.code === 'timeout-after-write' && retry.body.error.rev === 1 && after.rev === 2,
      `${String(retry.status)} ${JSON.stringify(retry.body)}; state ${JSON.stringify(after)}`)
  } finally {
    await host.close()
  }
}

/** widget_fv.action: the code and rev of a nested call do not pass through the outer call. */
async function nested() {
  const host = await startHost(join(work, 'nested'))
  try {
    await host.inspector.run(WIDGET)
    for (let i = 0; i < 3; i += 1) await host.post('/api/widgets/fv2/call', { action: 'bump' })
    const outer = await host.post('/api/widgets/fv/call', { action: 'nestedAfterWrite', requestId: 'n1' })
    const s = await state(host)
    const other = await host.inspector.run(`return wc.ctx.widgets.get('fv2').rev`)
    check('nested: a nested timeout-after-write gives the outer call handler-error with the outer rev', outer.status === 500 && outer.body?.error?.code === 'handler-error' && outer.body.error.rev === 1 && s.rev === 1 && other === 4,
      `${String(outer.status)} ${JSON.stringify(outer.body)}; fv ${JSON.stringify(s)}; fv2 rev ${String(other)}`)
    const retry = await host.post('/api/widgets/fv/call', { action: 'nestedAfterWrite', requestId: 'n1' })
    const after = await state(host)
    check('nested: the retry gives the recorded answer and does not write', retry.status === 500 && retry.body?.error?.code === 'handler-error' && retry.body.error.rev === 1 && after.rev === 1,
      `${String(retry.status)} ${JSON.stringify(retry.body)}; fv ${JSON.stringify(after)}`)
  } finally {
    await host.close()
  }
}

const REPLAYS = { late, natural, overlap, crash, nested, hang }

let exitCode = 1
try {
  const names = (process.env.WIDGETS_ACTION_REPLAY ?? Object.keys(REPLAYS).join(',')).split(',').map((name) => name.trim()).filter((name) => name !== '')
  for (const name of names) if (!(name in REPLAYS)) throw new Error(`no replay ${JSON.stringify(name)}`)
  console.log(`widgets-action-replay: work folder ${work}; replays ${names.join(', ')}`)
  for (const name of names) await REPLAYS[name]()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-action-replay: pass')
    exitCode = 0
  } else {
    console.log(`widgets-action-replay: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-action-replay: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  for (const child of children) child.kill('SIGKILL')
}
process.exit(exitCode)
