#!/usr/bin/env node
/**
 * Host check of the turn-off and turn-on of an agent widget row (fix widget.row_toggle).
 * It boots the CLI host (web profile) on free loopback ports. An MCP SDK client installs the template widget with
 * widget_install, so the widget has the agent row deepwidgets-agent-<slug>. Then, for two rounds:
 * - the check writes the state of the widget with widget_call;
 * - setPluginEnabled of the plugin manager turns the row off, over the host inspector. The widget leaves widget_list,
 *   and its routes /api/widgets/<slug>/program and /call stop. The Loader keeps the same entry with a disposed fiber;
 * - setPluginEnabled turns the row on again. The same Loader entry gets a running fiber, the widget is back in
 *   widget_list, its routes answer, it has the same state, and a call works.
 * Before the fix, the agent-row gate (deepwidgets/widgets/src/gate.ts) dropped the load of an entry that kept a
 * disposed fiber, and the turn-on failed with "fiber state 4".
 * Prints `widgets-row-toggle: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first. It needs the machine lock of the smoke checks.
 */
import { spawn } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { pinnedFunction } from './in-host.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const requireFromMcp = createRequire(join(ROOT, 'deepwidgets/mcp/package.json'))
const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(requireFromMcp.resolve('@modelcontextprotocol/client')).href)

const work = await mkdtemp(join(process.env.WIDGETS_ROW_TOGGLE_TMP ?? tmpdir(), 'widgets-row-toggle-'))
const home = join(work, 'home')
const logPath = join(work, 'host.log')
const results = []
const SLUG = 'row-toggle'
const ROW = `deepwidgets-agent-${SLUG}`
let child
let cookie = ''
let base = ''
let inspectPort = 0

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${String(detail).slice(0, 600)}`}`)
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

async function startHost(port) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  child = spawn(process.execPath, [`--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
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
  // The login cookie, for the routes of the runtime.
  const login = await fetch(url, { redirect: 'manual' })
  cookie = login.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
  if (cookie === '') throw new Error(`the login gave no cookie (${String(login.status)})`)
}

/**
 * Run `body` in the host with `loader` (the one Loader) and `arg` in scope, over the inspector. Gives the value
 * that `body` returns.
 */
async function inHost(body, arg = null) {
  const targets = await (await fetch(`http://127.0.0.1:${String(inspectPort)}/json/list`)).json()
  const url = targets[0]?.webSocketDebuggerUrl
  if (typeof url !== 'string') throw new Error('the inspector has no target')
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve); socket.addEventListener('error', () => reject(new Error('inspector connection failed'))) })
  let next = 0
  const waiting = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    const item = waiting.get(message.id)
    if (item === undefined) return
    waiting.delete(message.id)
    if (message.error) item.reject(new Error(message.error.message))
    else if (message.result?.exceptionDetails) item.reject(new Error(message.result.exceptionDetails.exception?.description ?? 'evaluate failed'))
    else item.resolve(message.result)
  })
  const send = (method, params) => new Promise((resolve, reject) => { next += 1; waiting.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })) })
  try {
    const proto = await send('Runtime.evaluate', { expression: 'Function.prototype' })
    const functions = await send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId })
    const loaderProto = await send('Runtime.callFunctionOn', {
      objectId: functions.objects.objectId,
      functionDeclaration: 'function () { const found = this.filter((fn) => fn.name === "Loader" && typeof fn.prototype?.showLog === "function" && typeof fn.prototype?.locate === "function"); if (found.length !== 1) throw new Error("Loader functions " + found.length); return found[0].prototype }',
    })
    const loaders = await send('Runtime.queryObjects', { prototypeObjectId: loaderProto.result.objectId })
    const reply = await send('Runtime.callFunctionOn', {
      objectId: loaders.objects.objectId,
      awaitPromise: true,
      returnByValue: true,
      arguments: [{ value: arg }],
      functionDeclaration: pinnedFunction(`async function (arg) { if (this.length !== 1) throw new Error("Loader instances " + this.length); const loader = this[0]; ${body} }`),
    })
    return reply.result.value
  } finally {
    socket.close()
  }
}

/**
 * Turn the agent row of the widget on or off with setPluginEnabled, outside the hmr transaction store of the
 * inspector call. Gives the result, and the Loader entry of the row before and after: its fiber uid and whether it
 * is the same entry object.
 */
const toggleRow = (enabled) => inHost(`
  const manager = loader.ctx.get('pluginManager')
  const hmr = loader.ctx.get('hmr')
  if (hmr !== undefined && typeof hmr.executing?.exit !== 'function') throw new Error('the hmr service has no executing.exit')
  const wrap = (fn) => hmr === undefined ? fn() : hmr.executing.exit(fn)
  const entryOf = () => [...loader.entries()].find((entry) => entry.options.id === ${JSON.stringify(ROW)})
  const fiberOf = (entry) => entry === undefined ? 'no-entry' : entry.fiber === undefined ? 'no-fiber' : String(entry.fiber.uid)
  const rows = (await wrap(() => manager.listPlugins())).filter((row) => row.patchId === ${JSON.stringify(ROW)})
  if (rows.length !== 1) throw new Error('plugin rows of ${ROW}: ' + rows.length)
  const before = entryOf()
  const beforeFiber = fiberOf(before)
  globalThis.__dwRowToggleEntry ??= before
  const result = await wrap(() => manager.setPluginEnabled(rows[0].entryId, arg))
  const after = entryOf()
  return {
    application: result.application,
    error: result.error ?? null,
    before: beforeFiber,
    after: fiberOf(after),
    sameEntry: after === before && after === globalThis.__dwRowToggleEntry,
  }`, enabled)

/** The handshake of mcp_readme.handshake: a token only from a server that proves the nonce of mcp.json. */
async function connect() {
  const portFile = join(home, 'deepwidgets', 'mcp.json')
  let answer
  for (let i = 0; i < 120; i += 1) {
    const challenge = randomBytes(16).toString('base64url')
    answer = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'Row Toggle Check', challenge }) }).catch(() => undefined)
    if (answer?.status === 200) {
      const issued = await answer.json()
      const { nonce } = JSON.parse(readFileSync(portFile, 'utf8'))
      if (createHmac('sha256', nonce).update(challenge).digest('hex') !== issued.proof) throw new Error('the server did not prove the nonce of mcp.json')
      const client = new Client({ name: 'widgets-row-toggle-check', version: '0.0.0' })
      await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${issued.token}` } } }))
      return client
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`no token: ${String(answer?.status)}`)
}

function body(result) {
  if (result.structuredContent !== undefined) return result.structuredContent
  try { return JSON.parse(result.content?.[0]?.text ?? 'null') } catch { return null }
}

/** The status of the program route and of a `get` on the call route of the widget. */
async function routes() {
  const program = await fetch(`${base}/api/widgets/${SLUG}/program`, { headers: { cookie } })
  const call = await fetch(`${base}/api/widgets/${SLUG}/call`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'get' }) })
  return { program: program.status, call: call.status, count: (await call.json().catch(() => null))?.result?.count }
}

async function hostPart() {
  const port = await freePort()
  inspectPort = await freePort()
  base = `http://127.0.0.1:${String(port)}`
  console.log(`widgets-row-toggle: work folder ${work}, port ${String(port)}`)
  await startHost(port)
  const client = await connect()
  const call = async (name, args = {}) => {
    const answer = await client.callTool({ name, arguments: args })
    return { isError: answer.isError === true, body: body(answer) }
  }
  /** The widget_list item of the slug, or undefined. */
  const listed = async () => (await call('widget_list')).body?.widgets?.find((widget) => widget.slug === SLUG)

  const template = await call('widget_template', { slug: SLUG, title: 'Row Toggle Check' })
  const dir = join(work, 'agent', SLUG)
  for (const file of template.body?.files ?? []) {
    mkdirSync(dirname(join(dir, file.path)), { recursive: true })
    writeFileSync(join(dir, file.path), file.text)
  }
  const installed = await call('widget_install', { dir })
  check('widget_install of the template applies', !installed.isError && installed.body?.application === 'applied', JSON.stringify(installed.body))
  const first = await listed()
  check('the widget is live in widget_list', first !== undefined && first.off === undefined && first.failed === undefined, JSON.stringify(first))

  let count = 0
  for (const round of [1, 2]) {
    const added = await call('widget_call', { slug: SLUG, action: 'add', args: { by: 3 }, requestId: `toggle-${String(round)}-a` })
    count += 3
    check(`round ${String(round)}: widget_call add writes the state`, !added.isError && added.body?.result?.count === count, JSON.stringify(added.body))
    const liveRoutes = await routes()
    check(`round ${String(round)}: the routes answer before the turn-off`, liveRoutes.program === 200 && liveRoutes.call === 200 && liveRoutes.count === count, JSON.stringify(liveRoutes))

    const off = await toggleRow(false)
    check(`round ${String(round)}: setPluginEnabled off applies, and the Loader keeps the entry with a disposed fiber`,
      off.application === 'applied' && off.error === null && off.sameEntry && /^[1-9]\d*$/.test(off.before) && off.after === 'null', JSON.stringify(off))
    const offItem = await listed()
    check(`round ${String(round)}: the widget leaves widget_list`, offItem === undefined, JSON.stringify(offItem))
    const offRoutes = await routes()
    check(`round ${String(round)}: the routes of the widget stop`, offRoutes.program === 404 && offRoutes.call === 404, JSON.stringify(offRoutes))
    const offCall = await call('widget_call', { slug: SLUG, action: 'get' })
    check(`round ${String(round)}: widget_call gives unknown-widget`, offCall.isError && offCall.body?.error?.code === 'unknown-widget', JSON.stringify(offCall.body))

    const on = await toggleRow(true)
    check(`round ${String(round)}: setPluginEnabled on applies, and the same entry gets a running fiber`,
      on.application === 'applied' && on.error === null && on.sameEntry && on.before === 'null' && /^[1-9]\d*$/.test(on.after) && on.after !== off.before, JSON.stringify(on))
    const onItem = await listed()
    check(`round ${String(round)}: the widget is back in widget_list`, onItem !== undefined && onItem.off === undefined && onItem.failed === undefined, JSON.stringify(onItem))
    const read = await call('widget_call', { slug: SLUG, action: 'get' })
    check(`round ${String(round)}: the widget has the same state`, !read.isError && read.body?.result?.count === count, JSON.stringify(read.body))
    const again = await call('widget_call', { slug: SLUG, action: 'add', args: { by: 1 }, requestId: `toggle-${String(round)}-b` })
    count += 1
    check(`round ${String(round)}: a call works after the turn-on`, !again.isError && again.body?.result?.count === count, JSON.stringify(again.body))
    const onRoutes = await routes()
    check(`round ${String(round)}: the routes answer after the turn-on`, onRoutes.program === 200 && onRoutes.call === 200 && onRoutes.count === count, JSON.stringify(onRoutes))
  }
}

let exitCode = 1
try {
  await hostPart()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-row-toggle: pass')
    exitCode = 0
  } else {
    console.log(`widgets-row-toggle: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-row-toggle: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  child?.kill('SIGKILL')
}
process.exit(exitCode)
