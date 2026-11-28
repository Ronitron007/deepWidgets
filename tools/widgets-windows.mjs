#!/usr/bin/env node
/**
 * Host check of the window data (unit wm.store, spec window_manager). It boots the CLI host (web profile) on a free
 * loopback port, with the host cookie, and an MCP SDK client with the token handshake of mcp.json. Then it checks:
 * - window_manager.route: POST /api/widget-windows/sample sets the layer, the lock, and a position. Each answer gives the
 *   whole window data, and the hello frame of GET /api/widgets/events gives the values with `chosen`. A Hide and a Show
 *   of main keep them. A size for sample gives not-resizable and changes nothing. A body with a lone x or an unknown
 *   field gives bad-request. The route refuses main with unknown-widget. A slug that is turned off or removed gets the
 *   JSON error no-window. A slug that this host never knew has no exact route, so it gets the 404 of the shared channel.
 * - window_manager.data: after a host restart, the hello frame gives the same values.
 * - window_manager.defaults: a test widget with window { layer: 'normal', width: 400, height: 200, resizable: true }
 *   gets these values in its first added frame. A reinstall with width 500 keeps 400: no frame and no hello gives 500.
 *   Turn off and Turn on keep 400. An agent widget_remove and a widget_install keep 400. The Remove of main deletes the
 *   record, and the next widget_install with width 500 gives 500. A size for the test widget is stored.
 * - window_manager.route: reset deletes the position of sample and its choice.
 * - window_manager.defaults: a definition with a bad window value fails its registration with a TypeError.
 * - window_manager.route: a page of sample can not reach the route: the widget origin gives 404 for
 *   /api/widget-windows/sample (widgetRoute of apps/desktop/src/deepwidgets-origin.ts). DSH_SMOKE_WM=1 calls it from the
 *   real page too.
 * Prints `widgets-windows: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first. A run starts a host: take the machine lock of the smoke checks.
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
const { widgetRoute } = await import(pathToFileURL(join(ROOT, 'apps/desktop/src/deepwidgets-origin.ts')).href)

const SLUG = 'windows-check'
const work = await mkdtemp(join(process.env.WIDGETS_WINDOWS_TMP ?? tmpdir(), 'widgets-windows-'))
const home = join(work, 'home')
const logPath = join(work, 'host.log')
const results = []
let child
let cookie = ''
let base = ''
let inspectPort = 0

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${String(detail).slice(0, 900)}`}`)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function stopHost() {
  if (child === undefined || child.exitCode !== null) return
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.kill('SIGTERM')
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
  await exited
  clearTimeout(timer)
}

/** Start the CLI host on `port`, and log in with the token URL that it prints. */
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
  const login = await fetch(url, { redirect: 'manual' })
  cookie = login.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
}

/** Run `body` in the host with `loader` (the one Loader) and `arg` in scope, over the inspector, as tools/widgets-main.mjs does. */
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

/** The handshake of mcp_readme.handshake: a token only from a server that proves the nonce of mcp.json. */
async function connect() {
  const portFile = join(home, 'deepwidgets', 'mcp.json')
  let answer
  for (let i = 0; i < 120; i += 1) {
    const challenge = randomBytes(16).toString('base64url')
    answer = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'Windows Check', challenge }) }).catch(() => undefined)
    if (answer?.status === 200) {
      const issued = await answer.json()
      const { nonce } = JSON.parse(readFileSync(portFile, 'utf8'))
      if (createHmac('sha256', nonce).update(challenge).digest('hex') !== issued.proof) throw new Error('the server did not prove the nonce of mcp.json')
      const client = new Client({ name: 'widgets-windows-check', version: '0.0.0' })
      await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${issued.token}` } } }))
      return client
    }
    await sleep(500)
  }
  throw new Error(`no token: ${String(answer?.status)}`)
}

function body(result) {
  if (result.structuredContent !== undefined) return result.structuredContent
  try { return JSON.parse(result.content?.[0]?.text ?? 'null') } catch { return null }
}

/** One action of the widget `slug` through its call route, as a page calls it. */
async function route(slug, action, args = {}) {
  const answer = await fetch(`${base}/api/widgets/${slug}/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ action, args }),
  })
  return { status: answer.status, body: await answer.json().catch(() => null) }
}

/** One change of the window data through POST /api/widget-windows/<slug>, as Electron main sends it. */
async function windowRoute(slug, change) {
  const answer = await fetch(`${base}/api/widget-windows/${slug}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify(change),
  })
  const text = await answer.text()
  let parsed = null
  try { parsed = JSON.parse(text) } catch { /* not JSON */ }
  return { status: answer.status, body: parsed, text: text.slice(0, 200) }
}

/** Open GET /api/widgets/events and keep its frames. `next` waits for a frame that `test` takes. */
async function openEvents() {
  const controller = new AbortController()
  const answer = await fetch(`${base}/api/widgets/events`, { headers: { cookie, accept: 'text/event-stream' }, signal: controller.signal })
  const reader = answer.body.pipeThrough(new TextDecoderStream()).getReader()
  const frames = []
  let text = ''
  const pump = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) return
        text += value
        for (let cut = text.indexOf('\n\n'); cut >= 0; cut = text.indexOf('\n\n')) {
          for (const line of text.slice(0, cut).split('\n')) if (line.startsWith('data: ')) frames.push(JSON.parse(line.slice(6)))
          text = text.slice(cut + 2)
        }
      }
    } catch { /* the stream was closed */ }
  })()
  return {
    frames,
    async next(test, ms = 10_000) {
      for (const until = Date.now() + ms; Date.now() < until; await sleep(50)) {
        const found = frames.find(test)
        if (found !== undefined) return found
      }
      return undefined
    },
    close() {
      controller.abort()
      return pump
    },
  }
}

/** The first frame of GET /api/widgets/events. */
async function eventsHello() {
  const stream = await openEvents()
  try {
    return await stream.next((frame) => frame.type === 'hello')
  } finally {
    await stream.close()
  }
}

/** The window data of `slug` in a new hello frame. */
async function helloWindow(slug) {
  return (await eventsHello())?.windows?.[slug]
}

/** The rows of the query `widgets` of main, by slug. */
async function mainRows() {
  const answer = await route('main', 'widgets')
  if (answer.body?.ok !== true) throw new Error(`the query widgets of main failed: ${JSON.stringify(answer)}`)
  return new Map(answer.body.result.widgets.map((row) => [row.slug, row]))
}

/** Wait until `test` holds for the rows of main, for at most 20 s. */
async function waitRows(test) {
  let rows = await mainRows()
  for (let i = 0; i < 200 && !test(rows); i += 1) {
    await sleep(100)
    rows = await mainRows()
  }
  return rows
}

/** True when `window` has each field of `want` with the same value; `x: undefined` means no position. */
function hasWindow(window, want) {
  if (typeof window !== 'object' || window === null) return false
  return Object.entries(want).every(([key, value]) => (value === undefined ? !(key in window) : JSON.stringify(window[key]) === JSON.stringify(value)))
}

/** The source of the test widget: the template with the field window of the definition. */
function testSource(templateText, width, { layer = 'normal', resizable = true } = {}) {
  const window = `window: { layer: '${layer}', width: ${String(width)}, height: 200, resizable: ${String(resizable)} },`
  const marked = templateText.replace("    program: PROGRAM,\n", `    program: PROGRAM,\n    ${window}\n`)
  if (marked === templateText) throw new Error('the template has no line "program: PROGRAM,"')
  return marked
}

async function samplePart() {
  const layer = await windowRoute('sample', { layer: 'normal' })
  const locked = await windowRoute('sample', { locked: true })
  const placed = await windowRoute('sample', { x: 300, y: 200 })
  const want = { shown: true, layer: 'normal', locked: true, x: 300, y: 200, width: 320, height: 300, resizable: false, chosen: ['layer', 'locked', 'x', 'y'] }
  check('the route sets the layer, the lock, and a position of sample, and each answer gives the whole window data',
    [layer, locked, placed].every((answer) => answer.status === 200 && answer.body?.ok === true) && hasWindow(placed.body?.window, want),
    JSON.stringify({ layer: layer.body, locked: locked.body, placed: placed.body }))
  const hello = await eventsHello()
  check('the hello frame gives the values of sample with chosen, and does not name main',
    hasWindow(hello?.windows?.sample, want) && hello?.shown?.sample === true && hello.windows.main === undefined && !hello.slugs.includes('main'),
    JSON.stringify(hello?.windows))

  const hidden = await route('main', 'hide', { slug: 'sample' })
  const afterHide = await helloWindow('sample')
  const shown = await route('main', 'show', { slug: 'sample' })
  const afterShow = await helloWindow('sample')
  check('a Hide and a Show of main keep the other window data of sample',
    hidden.body?.result?.ok === true && shown.body?.result?.ok === true && hasWindow(afterHide, { ...want, shown: false }) && hasWindow(afterShow, want),
    JSON.stringify({ afterHide, afterShow }))

  const size = await windowRoute('sample', { width: 400, height: 250 })
  const afterSize = await helloWindow('sample')
  check('a size for sample gives not-resizable and changes nothing',
    size.status === 409 && size.body?.ok === false && size.body.error?.code === 'not-resizable' && hasWindow(afterSize, want),
    JSON.stringify({ size, afterSize }))
  const lone = await windowRoute('sample', { x: 5 })
  const unknown = await windowRoute('sample', { opacity: 0.5 })
  const small = await windowRoute('sample', { width: 10, height: 10 })
  const empty = await windowRoute('sample', {})
  const large = await windowRoute('sample', { width: 400, height: 5000 })
  check('a lone x, an unknown field, a size out of the limits, and an empty body give bad-request',
    [lone, unknown, small, large, empty].every((answer) => answer.status === 400 && answer.body?.error?.code === 'bad-request'),
    JSON.stringify({ lone: lone.body, unknown: unknown.body, small: small.body, large: large.body, empty: empty.body }))
  // size_limits_not_in_spec: the refusal of a size out of the limits of window_manager.provisional names the limits.
  check('the refusal of a size out of the limits names 80 to 4096 points',
    [small, large].every((answer) => String(answer.body?.error?.message).includes('whole numbers of points from 80 to 4096')),
    JSON.stringify({ small: small.body, large: large.body }))
  const main = await windowRoute('main', { layer: 'normal' })
  const none = await windowRoute('no-such-widget', { layer: 'normal' })
  check('the route refuses main with unknown-widget, and a slug that this host never knew gets 404',
    main.status === 404 && main.body?.error?.code === 'unknown-widget' && none.status === 404,
    JSON.stringify({ main, none }))
  return want
}

async function hostPart() {
  const port = await freePort()
  inspectPort = await freePort()
  base = `http://127.0.0.1:${String(port)}`
  console.log(`widgets-windows: work folder ${work}, port ${String(port)}`)
  await startHost(port)
  let client = await connect()
  const call = async (name, args = {}) => {
    const answer = await client.callTool({ name, arguments: args })
    return { isError: answer.isError === true, body: body(answer) }
  }

  const sampleWant = await samplePart()

  // ---- window_manager.data: the record stays across a host start ----
  await client.close().catch(() => undefined)
  await stopHost()
  await startHost(port)
  client = await connect()
  await waitRows((rows) => rows.get('sample')?.status?.kind === 'live')
  const restarted = await helloWindow('sample')
  check('after a host restart, the hello frame gives the same values of sample', hasWindow(restarted, sampleWant), JSON.stringify(restarted))

  // ---- window_manager.defaults: the agent defaults apply only to a new widget ----
  const template = await call('widget_template', { slug: SLUG, title: 'Windows Check' })
  const files = template.body?.files ?? []
  const dir = join(work, 'agent', SLUG)
  for (const file of files) {
    mkdirSync(dirname(join(dir, file.path)), { recursive: true })
    writeFileSync(join(dir, file.path), file.text)
  }
  const source = join(dir, 'src', 'index.ts')
  const templateText = readFileSync(source, 'utf8')
  writeFileSync(source, testSource(templateText, 400))
  const defaults = { shown: true, layer: 'normal', locked: false, x: undefined, y: undefined, width: 400, height: 200, resizable: true, chosen: [] }
  const stream = await openEvents()
  await stream.next((frame) => frame.type === 'hello')
  const installed = await call('widget_install', { dir })
  const added = await stream.next((frame) => frame.type === 'added' && frame.slug === SLUG)
  await stream.close()
  check('the test widget gets its agent defaults in its first added frame',
    !installed.isError && installed.body?.application === 'applied' && hasWindow(added?.window, defaults) && added?.shown === true,
    JSON.stringify({ installed: installed.body?.error ?? installed.body?.application, added }))
  await sleep(500)
  const stored = await helloWindow(SLUG)
  check('the hello frame of the test widget gives the same agent defaults', hasWindow(stored, defaults), JSON.stringify(stored))

  // A reinstall with width 500: no frame and no hello may give 500.
  writeFileSync(source, testSource(templateText, 500))
  const watch = await openEvents()
  await watch.next((frame) => frame.type === 'hello')
  const reinstalled = await call('widget_install', { dir })
  await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live')
  await sleep(1000)
  const reinstalledHello = await helloWindow(SLUG)
  await watch.close()
  const leaked = watch.frames.filter((frame) => frame.slug === SLUG && frame.window !== undefined && frame.window.width !== 400)
  check('a reinstall with width 500 keeps 400: no frame and no hello gives 500',
    !reinstalled.isError && reinstalled.body?.application === 'applied' && leaked.length === 0 && hasWindow(reinstalledHello, defaults),
    JSON.stringify({ reinstalled: reinstalled.body?.error ?? reinstalled.body?.application, leaked, hello: reinstalledHello }))

  // Turn off and Turn on keep it.
  const off = await route('main', 'turnOff', { slug: SLUG })
  await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'turned-off')
  // route_404_not_no_window: a slug with no live or failed entry gets the JSON error no-window.
  const offRoute = await windowRoute(SLUG, { layer: 'top' })
  check('the route gives no-window for a turned-off slug, and writes nothing',
    offRoute.status === 404 && offRoute.body?.ok === false && offRoute.body.error?.code === 'no-window',
    JSON.stringify(offRoute))
  const on = await route('main', 'turnOn', { slug: SLUG })
  await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live')
  await sleep(500)
  const turned = await helloWindow(SLUG)
  check('Turn off and Turn on keep 400', off.body?.result?.ok === true && on.body?.result?.ok === true && hasWindow(turned, defaults), JSON.stringify({ off: off.body, on: on.body, turned }))

  // An agent widget_remove and a widget_install keep it.
  const removed = await call('widget_remove', { slug: SLUG })
  const removedRoute = await windowRoute(SLUG, { layer: 'top' })
  check('the route gives no-window for a removed slug', removedRoute.status === 404 && removedRoute.body?.error?.code === 'no-window', JSON.stringify(removedRoute))
  const back = await call('widget_install', { dir })
  await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live')
  await sleep(500)
  const kept = await helloWindow(SLUG)
  check('an agent widget_remove and a widget_install keep 400',
    !removed.isError && !back.isError && back.body?.application === 'applied' && hasWindow(kept, defaults),
    JSON.stringify({ removed: removed.body?.error ?? removed.body?.application, back: back.body?.error ?? back.body?.application, kept }))

  // A size for the resizable test widget is an operator choice.
  const sized = await windowRoute(SLUG, { width: 450, height: 250 })
  const sizedHello = await helloWindow(SLUG)
  check('a size for the resizable test widget is stored as an operator choice',
    sized.status === 200 && hasWindow(sizedHello, { ...defaults, width: 450, height: 250, chosen: ['width', 'height'] }),
    JSON.stringify({ sized: sized.body, hello: sizedHello }))

  // The Remove of main deletes the record: the next install with width 500 is a new widget.
  const operatorRemoved = await route('main', 'remove', { slug: SLUG })
  const freshStream = await openEvents()
  await freshStream.next((frame) => frame.type === 'hello')
  const fresh = await call('widget_install', { dir })
  const freshAdded = await freshStream.next((frame) => frame.type === 'added' && frame.slug === SLUG)
  await freshStream.close()
  await sleep(500)
  const freshHello = await helloWindow(SLUG)
  const newDefaults = { ...defaults, width: 500 }
  check('the Remove of main deletes the record, and the next widget_install with width 500 gives 500',
    operatorRemoved.body?.result?.ok === true && !fresh.isError && fresh.body?.application === 'applied' && hasWindow(freshAdded?.window, newDefaults) && hasWindow(freshHello, newDefaults),
    JSON.stringify({ removed: operatorRemoved.body?.result, fresh: fresh.body?.error ?? fresh.body?.application, added: freshAdded?.window, hello: freshHello }))

  // ---- partial_record_takes_later_defaults: the decision of 2026-11-28 in window_manager.defaults ----
  // A record with no agent defaults (from before wm.store, or from a Hide of a failed entry) takes them one time, at the
  // next registration, and keeps its shown state. The check makes such a record with a forget and a Hide.
  const partial = await inHost(`
    const records = loader.ctx.get('widgetRecords')
    await records.forgetWindow(arg)
    await records.setWindowShown(arg, false)
    return records.windowShown(arg)`, SLUG)
  writeFileSync(source, testSource(templateText, 600, { layer: 'top', resizable: false }))
  const partialInstall = await call('widget_install', { dir })
  await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live')
  await sleep(500)
  const partialHello = await helloWindow(SLUG)
  const taken = { shown: false, layer: 'top', locked: false, x: undefined, y: undefined, width: 600, height: 200, resizable: false, chosen: [] }
  check('a record with only the shown state takes the agent defaults at the next reinstall, and keeps its shown state',
    partial === false && !partialInstall.isError && partialInstall.body?.application === 'applied' && hasWindow(partialHello, taken),
    JSON.stringify({ partial, installed: partialInstall.body?.error ?? partialInstall.body?.application, hello: partialHello }))
  writeFileSync(source, testSource(templateText, 700, { layer: 'normal', resizable: true }))
  const secondInstall = await call('widget_install', { dir })
  await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live')
  await sleep(500)
  const secondHello = await helloWindow(SLUG)
  check('a second reinstall with other agent defaults keeps the defaults that the record took one time',
    !secondInstall.isError && secondInstall.body?.application === 'applied' && hasWindow(secondHello, taken),
    JSON.stringify({ installed: secondInstall.body?.error ?? secondInstall.body?.application, hello: secondHello }))

  // ---- window_manager.route: reset ----
  const reset = await windowRoute('sample', { reset: true })
  const resetHello = await helloWindow('sample')
  const resetWant = { ...sampleWant, x: undefined, y: undefined, chosen: ['layer', 'locked'] }
  check('reset deletes the position of sample and its choice', reset.status === 200 && hasWindow(reset.body?.window, resetWant) && hasWindow(resetHello, resetWant),
    JSON.stringify({ reset: reset.body, hello: resetHello }))
  const resetWithPlace = await windowRoute('sample', { reset: true, x: 1, y: 2 })
  check('reset with a position gives bad-request', resetWithPlace.status === 400 && resetWithPlace.body?.error?.code === 'bad-request', JSON.stringify(resetWithPlace.body))

  // ---- window_manager.defaults: a bad window value fails the registration ----
  const bad = await inHost(`
    const widgets = loader.ctx.get('widgets')
    const tries = [{ layer: 'desktop' }, { width: 50 }, { height: 300.5 }, { resizable: 'yes' }, { opacity: 1 }, 'top']
    return tries.map((window) => {
      try {
        widgets.register({ slug: 'bad-window', title: 'Bad', program: '', initialState: null, actions: [], window })
        return 'registered'
      } catch (error) {
        return error.name + ': ' + error.message
      }
    })`)
  check('a definition with a bad window value fails its registration with a TypeError',
    Array.isArray(bad) && bad.length === 6 && bad.every((line) => line.startsWith('TypeError: widgets: bad-window: window'))
      && bad[1].includes('whole number of points from 80 to 4096'),
    JSON.stringify(bad))
  const badListed = (await eventsHello())?.slugs?.includes('bad-window')
  check('the refused definition has no window', badListed === false, String(badListed))

  // ---- gate_gap_misleads_agent: the test gate refuses a bad window value, with a next step that names the field ----
  const badDir = join(work, 'agent', 'windows-bad')
  const gateCases = [
    { window: 'window: { width: 50 },', diagnostic: 'window.width must be a whole number of points from 80 to 4096' },
    { window: 'window: JSON.parse(\'{"opacity": 1}\') as { layer?: "top" },', diagnostic: 'window has the unknown field "opacity"' },
  ]
  for (const item of gateCases) {
    mkdirSync(join(badDir, 'src'), { recursive: true })
    const text = templateText.replaceAll(`'${SLUG}'`, "'windows-bad'").replace('    program: PROGRAM,\n', `    program: PROGRAM,\n    ${item.window}\n`)
    writeFileSync(join(badDir, 'src', 'index.ts'), text)
    const refused = await call('widget_install', { dir: badDir })
    const error = refused.body?.error
    check(`widget_install of a bad window value gives gate-failed at the test gate, with a next step that names the field: ${item.diagnostic}`,
      refused.isError && error?.code === 'gate-failed' && error.gate === 'test' && error.diagnostics?.some((line) => line.includes(item.diagnostic))
        && typeof error.nextStep === 'string' && error.nextStep.includes('field window') && error.nextStep.includes('whole numbers of points from 80 to 4096'),
      JSON.stringify(error))
  }

  // ---- window_manager.route: the page of sample can not reach the route ----
  const pageRoutes = [true, false].map((hasPage) => widgetRoute('sample', '/api/widget-windows/sample', hasPage))
  check('the widget origin of sample gives 404 for /api/widget-windows/sample', pageRoutes.every((answer) => answer.kind === 'status' && answer.status === 404), JSON.stringify(pageRoutes))

  await client.close().catch(() => undefined)
}

let exitCode = 1
try {
  await hostPart()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-windows: pass')
    exitCode = 0
  } else {
    console.log(`widgets-windows: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-windows: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  child?.kill('SIGKILL')
}
process.exit(exitCode)
