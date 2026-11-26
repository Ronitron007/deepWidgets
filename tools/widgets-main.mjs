#!/usr/bin/env node
/**
 * Host check of the main widget (unit main.runtime, spec main_widget) and of its kit section (unit kit.pane, spec kit).
 * It boots the CLI host (web profile) on a free loopback port. An MCP SDK client does the token handshake with the
 * proof check of mcp.json, installs a test widget with widget_install, then checks:
 * - main_widget.widget: widget_list does not list main; widget_describe and widget_call on main give the error of a
 *   slug that does not exist; widget_changes gives no change of main; widget_install of the slug main gives slug-taken;
 *   the hello frame of GET /api/widgets/events does not name main;
 * - main_widget.catalog: GET program of sample gives the catalog shadcn-widgets@1, and of main deepwidgets-main@1;
 * - main_widget.widgets: the query `widgets` of main lists sample and the test widget with each field of the table,
 *   and no row for main; Turn off keeps the row with the status turned-off and the state; Turn on brings back the
 *   same state, for the built-in sample and for the test widget; Remove refuses sample; Remove removes the test
 *   widget, and its state stays in storage. A refusal of an action of main is its result, with a code.
 * - main_widget.widgets and widget_reload: a reload of a widget that the operator turned off keeps it off, with the
 *   warning turned-off, and keeps its state; Turn on brings it back, and a reload after it gives a live widget. A later
 *   reload of the widget while it is off starts no code (the change feed of the runtime has no `added`). A Turn off
 *   that refuses stores nothing. An agent widget_remove keeps a Turn off: a later widget_install comes up off.
 * - main_widget.settings: widget_call of settings, setMode, and setLoginItem of main gives unknown-widget. The query
 *   settings gives the modes from the settings file, the port and the path of mcp.json (not the nonce), and no login item
 *   in a CLI host. setMode of create writes the file and keeps each other key, and widget_install then gives mode-off. A
 *   file that does not parse shows its error, and setMode refuses with settings-unreadable and keeps it. create on
 *   again: widget_install works. A third host start has an IPC parent that never answers: the query settings still
 *   gives the modes and the port, and the login item and setLoginItem give login-item-failed, not a timeout.
 * - main_widget.window_state: widget_call of show and hide of main gives unknown-widget. A Hide and a Show sent together
 *   end shown, and a queued Hide and then a forget leave no record (window_writes_skip_queued_write). Hide of sample gives the row the
 *   window hidden, a `window` frame on the events route, and the hidden state in its hello. Hide refuses main with
 *   unknown-widget and a slug with no window with no-window. An agent widget_remove keeps the hidden state of the test
 *   widget: the next widget_install comes up hidden (agent_remove_reinstall_unhides). The Remove of main ends it: the
 *   next widget_install starts it as shown. Sample stays hidden across the next host start; then Show shows it.
 * - main_widget.widgets in safe mode: a second host start with DEEPWIDGETS_SAFE_MODE=1. An agent widget keeps the status
 *   safe-mode, and the field turnedOff follows Turn off and Turn on.
 * - kit.pane: widget_call of kitAdd, kitRemove, and setRefuseBuilds of main gives unknown-widget. The part kit of the
 *   query settings shows ready, the kit version, the 8 core packages, no extra, and an empty refuse list. kitAdd of
 *   date-fns@^4 answers started in at most 1 s. Then the status is changing, a second kitAdd and a kitRemove give
 *   kit-busy, and later the status is ready, with date-fns at an exact version and a last change with no error. A core
 *   package gives in-core at once, and a spec that is not a package name gives not-found at once. setRefuseBuilds of
 *   core-js keeps the key modes, and then kitAdd of core-js ends with a last change of install-failed that names
 *   core-js. kitRemove removes date-fns. A name that npm does not accept gives bad-name, and the old name JSONStream is
 *   written. A settings file that does not parse makes only the refuse list a refusal. With the row of the kit off, the part kit is the refusal unavailable, and the modes still
 *   show. These steps need the npm registry.
 * - kit.pane.service: a fourth host start, while another live process holds the kit lock. The query settings answers in
 *   at most 2 s, with the kit status starting and the modes, and kitAdd and kitRemove give kit-unavailable at once. A
 *   fifth host start with a link current that names no kit version: the status is unavailable, and kitAdd and kitRemove
 *   give kit-unavailable at once.
 * The calls of main go through POST /api/widgets/main/call with the host cookie, as the page of main calls them.
 * Prints `widgets-main: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first. A run starts a host: take the machine lock of the smoke checks.
 */
import { spawn } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { createWriteStream, lstatSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
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

const SLUG = 'main-check'
/** The agent widget of the safe-mode part. */
const SAFE_SLUG = 'main-safe'
const work = await mkdtemp(join(process.env.WIDGETS_MAIN_TMP ?? tmpdir(), 'widgets-main-'))
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

/** Start the CLI host. With `ipc`, the host gets an IPC channel to this script, which never answers on it. */
async function startHost(port, env = {}, { ipc = false } = {}) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  child = spawn(process.execPath, [`--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home, ...env },
    stdio: ipc ? ['ignore', 'pipe', 'pipe', 'ipc'] : ['ignore', 'pipe', 'pipe'],
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

/** Run `body` in the host with `loader` (the one Loader) and `arg` in scope, over the inspector, as tools/widgets-create.mjs does. */
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
    answer = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'Main Check', challenge }) }).catch(() => undefined)
    if (answer?.status === 200) {
      const issued = await answer.json()
      const { nonce } = JSON.parse(readFileSync(portFile, 'utf8'))
      if (createHmac('sha256', nonce).update(challenge).digest('hex') !== issued.proof) throw new Error('the server did not prove the nonce of mcp.json')
      const client = new Client({ name: 'widgets-main-check', version: '0.0.0' })
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

/** One action of the widget `slug` through its call route, as a page calls it. */
async function route(slug, action, args = {}) {
  const answer = await fetch(`${base}/api/widgets/${slug}/call`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ action, args }),
  })
  return { status: answer.status, body: await answer.json().catch(() => null) }
}

/** GET program of `slug`. */
async function program(slug) {
  const answer = await fetch(`${base}/api/widgets/${slug}/program`, { headers: { cookie } })
  return { status: answer.status, body: await answer.json().catch(() => null) }
}

/** The first frame of GET /api/widgets/events. */
async function eventsHello() {
  const controller = new AbortController()
  const answer = await fetch(`${base}/api/widgets/events`, { headers: { cookie, accept: 'text/event-stream' }, signal: controller.signal })
  const reader = answer.body.pipeThrough(new TextDecoderStream()).getReader()
  let text = ''
  try {
    while (!text.includes('"type":"hello"') || !/"type":"hello"[^\n]*\n/.test(text)) {
      const { value, done } = await reader.read()
      if (done) break
      text += value
    }
  } finally {
    controller.abort()
  }
  const line = text.split('\n').find((item) => item.startsWith('data: ') && item.includes('"hello"'))
  return line === undefined ? null : JSON.parse(line.slice(6))
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
    async next(test, ms = 5000) {
      for (const until = Date.now() + ms; Date.now() < until; await new Promise((resolve) => setTimeout(resolve, 50))) {
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

/** The rows of the query `widgets` of main, by slug. */
async function mainRows() {
  const answer = await route('main', 'widgets')
  if (answer.body?.ok !== true) throw new Error(`the query widgets of main failed: ${JSON.stringify(answer)}`)
  return new Map(answer.body.result.widgets.map((row) => [row.slug, row]))
}

/** Wait until `test` holds for the rows of main, for at most 10 s. */
async function waitRows(test) {
  let rows = await mainRows()
  for (let i = 0; i < 100 && !test(rows); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    rows = await mainRows()
  }
  return rows
}

/** Whether `row` has each field of main_widget.widgets for a live widget. */
function liveFields(row, { title, agent, rowId, packageName, source }) {
  const problems = []
  if (row === undefined) return ['no row']
  if (row.title !== title) problems.push(`title ${JSON.stringify(row.title)}`)
  if (row.status?.kind !== 'live') problems.push(`status ${JSON.stringify(row.status)}`)
  if (row.catalog !== 'shadcn-widgets@1') problems.push(`catalog ${JSON.stringify(row.catalog)}`)
  if (typeof row.state?.rev !== 'number' || typeof row.state?.data !== 'object') problems.push(`state ${JSON.stringify(row.state)}`)
  if (typeof row.program?.rev !== 'number' || row.program.rev < 1) problems.push(`program ${JSON.stringify(row.program)}`)
  const actions = row.actions ?? []
  if (actions.length === 0 || !actions.every((action) => typeof action.name === 'string' && (action.kind === 'query' || action.kind === 'mutation') && 'args' in action && typeof action.timeoutMs === 'number')) problems.push(`actions ${JSON.stringify(row.actions)}`)
  if (row.agent !== agent) problems.push(`agent ${JSON.stringify(row.agent)}`)
  if (row.source !== source) problems.push(`source ${JSON.stringify(row.source)}`)
  if (!Array.isArray(row.rows) || row.rows.length !== 1 || row.rows[0].id !== rowId || row.rows[0].name !== packageName || row.rows[0].enabled !== true || typeof row.rows[0].entryId !== 'string') problems.push(`rows ${JSON.stringify(row.rows)}`)
  if (row.window !== 'shown') problems.push(`window ${JSON.stringify(row.window)}`)
  return problems
}

/** Turn `slug` off and on through main, and check the row and its state at each step. */
async function offAndOn(slug, rowId) {
  const before = (await mainRows()).get(slug)
  const off = await route('main', 'turnOff', { slug })
  const offRows = await waitRows((rows) => rows.get(slug)?.status?.kind === 'turned-off')
  const offRow = offRows.get(slug)
  const listed = (await fetch(`${base}/api/widgets`, { headers: { cookie } }).then((answer) => answer.json())).widgets.map((widget) => widget.slug)
  check(`${slug}: Turn off keeps the row in the query with the status turned-off and the same state`,
    off.body?.ok === true && off.body.result?.ok === true && offRow?.status?.kind === 'turned-off' && offRow.turnedOff === true && JSON.stringify(offRow.state) === JSON.stringify(before?.state)
      && offRow.rows?.length === 1 && offRow.rows[0].id === rowId && offRow.rows[0].enabled === false && !listed.includes(slug),
    JSON.stringify({ off: off.body, row: offRow, before: before?.state, listed }))
  check(`${slug}: a widget that is turned off has no title, catalog, actions, or window`,
    offRow !== undefined && offRow.title === undefined && offRow.catalog === undefined && offRow.actions === undefined && offRow.window === undefined && offRow.program?.rev === before?.program?.rev,
    JSON.stringify(offRow))
  const on = await route('main', 'turnOn', { slug })
  const onRows = await waitRows((rows) => rows.get(slug)?.status?.kind === 'live')
  const onRow = onRows.get(slug)
  check(`${slug}: Turn on brings back the widget with the same state`,
    on.body?.ok === true && on.body.result?.ok === true && onRow?.status?.kind === 'live' && JSON.stringify(onRow.state) === JSON.stringify(before?.state) && onRow.rows?.[0]?.enabled === true,
    JSON.stringify({ on: on.body, row: onRow?.status, state: onRow?.state, before: before?.state }))
}

/**
 * main_widget.widgets: the operator turns the test widget off, and an agent reloads it. The new version stays off, and
 * the answer has the warning turned-off. Turn on brings it back. A reload after the Turn on gives a live widget, also
 * when the profile patch still has the Turn off of the row name that the reload uses again.
 */
async function reloadKeepsTurnOff(call) {
  const kept = (await mainRows()).get(SLUG)?.state
  const turned = await route('main', 'turnOff', { slug: SLUG })
  await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'turned-off')
  const reloaded = await call('widget_reload', { slug: SLUG })
  const row = (await mainRows()).get(SLUG)
  const listed = (await call('widget_list')).body?.widgets?.map((widget) => widget.slug) ?? []
  check('a reload keeps a widget that the operator turned off off', turned.body?.result?.ok === true && !reloaded.isError && reloaded.body?.application === 'applied'
    && row?.status?.kind === 'turned-off' && row.rows?.length === 1 && row.rows[0].id === `deepwidgets-agent-${SLUG}.b` && row.rows[0].enabled === false && !listed.includes(SLUG),
    JSON.stringify({ turned: turned.body?.result, reloaded: reloaded.body?.error ?? reloaded.body?.application, row: { status: row?.status, rows: row?.rows }, listed }))
  check('the reload answer has the warning turned-off, and its next step asks for a Turn on in the main window',
    reloaded.body?.turnedOff?.code === 'turned-off' && /turn it on in the main window/.test(reloaded.body?.nextStep ?? ''), JSON.stringify({ turnedOff: reloaded.body?.turnedOff, nextStep: reloaded.body?.nextStep }))
  check('the reload of a widget that is off keeps its state', row?.state !== undefined && JSON.stringify(row.state) === JSON.stringify(kept), JSON.stringify({ state: row?.state, kept }))
  const on = await route('main', 'turnOn', { slug: SLUG })
  const onRow = (await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live')).get(SLUG)
  check('Turn on after the reload brings the new version back with the same state', on.body?.result?.ok === true && onRow?.status?.kind === 'live' && JSON.stringify(onRow.state) === JSON.stringify(kept),
    JSON.stringify({ on: on.body?.result, status: onRow?.status, state: onRow?.state }))
  const again = await call('widget_reload', { slug: SLUG })
  const againRow = (await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live' && rows.get(SLUG)?.rows?.[0]?.id === `deepwidgets-agent-${SLUG}`)).get(SLUG)
  check('a reload after the Turn on gives a live widget under the first row name', !again.isError && again.body?.turnedOff === undefined && againRow?.status?.kind === 'live'
    && againRow.rows?.length === 1 && againRow.rows[0].id === `deepwidgets-agent-${SLUG}` && JSON.stringify(againRow.state) === JSON.stringify(kept),
    JSON.stringify({ again: again.body?.error ?? again.body?.application, status: againRow?.status, rows: againRow?.rows }))
}

/**
 * turned_off_row_runs_at_reload: reloadKeepsTurnOff turned the row `.b` on, and its last reload removed `.b`. The Turn on
 * of `.b` was an override in the profile patch. While the widget is off, a reload under the name `.b` again must not
 * start its code: the change feed of the runtime gets no `added` for the slug.
 */
async function turnedOffReloadRunsNoCode(call) {
  const turned = await route('main', 'turnOff', { slug: SLUG })
  await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'turned-off')
  const cursor = await inHost("return loader.ctx.get('widgets').cursor()")
  const reloaded = await call('widget_reload', { slug: SLUG })
  const feed = await inHost("return loader.ctx.get('widgets').changes(arg.cursor).changes.filter((change) => change.slug === arg.slug).map((change) => change.kind)", { cursor, slug: SLUG })
  const row = (await mainRows()).get(SLUG)
  check('a reload of a widget that is off starts no code, also under a row name with an old Turn on', turned.body?.result?.ok === true && !reloaded.isError && reloaded.body?.turnedOff?.code === 'turned-off'
    && Array.isArray(feed) && !feed.includes('added') && !(reloaded.body?.warnings ?? []).some((line) => line.includes('code ran once'))
    && row?.status?.kind === 'turned-off' && row.rows?.length === 1 && row.rows[0].id === `deepwidgets-agent-${SLUG}.b` && row.rows[0].enabled === false,
    JSON.stringify({ feed, turnedOff: reloaded.body?.turnedOff, error: reloaded.body?.error, warnings: reloaded.body?.warnings, row: { status: row?.status, rows: row?.rows } }))
}

/** refused_turn_off_stored: a Turn off that refuses (no row of the slug) stores nothing in the Turn off record. */
async function refusedTurnOffStoresNothing() {
  const refused = await route('main', 'turnOff', { slug: 'ghost-w' })
  const profileDir = await inHost("return loader.ctx.get('pluginManager').profile.dir")
  let stored = []
  try {
    stored = JSON.parse(readFileSync(join(profileDir, 'deepwidgets-widgets', '.turned-off.json'), 'utf8'))
  } catch (error) {
    if (error?.code !== 'ENOENT') stored = [`unreadable: ${String(error)}`]
  }
  check('a Turn off that refuses with no-row stores no Turn off', refused.body?.result?.ok === false && refused.body.result.code === 'no-row' && Array.isArray(stored) && !stored.includes('ghost-w'),
    JSON.stringify({ refused: refused.body?.result, stored }))
}

/**
 * turn_off_undone_by_remove_install: the test widget is off. An agent `widget_remove` keeps the Turn off, so a later
 * `widget_install` of the same folder comes up off, with the warning turned-off and the state kept. Turn on brings it back.
 */
async function agentRemoveKeepsTurnOff(call, dir) {
  const kept = (await mainRows()).get(SLUG)?.state
  const removed = await call('widget_remove', { slug: SLUG })
  const cursor = await inHost("return loader.ctx.get('widgets').cursor()")
  const installed = await call('widget_install', { dir })
  const feed = await inHost("return loader.ctx.get('widgets').changes(arg.cursor).changes.filter((change) => change.slug === arg.slug).map((change) => change.kind)", { cursor, slug: SLUG })
  const row = (await mainRows()).get(SLUG)
  const listed = (await call('widget_list')).body?.widgets?.map((widget) => widget.slug) ?? []
  check('after an agent widget_remove, widget_install of a widget that the operator turned off installs it off', !removed.isError && removed.body?.application === 'applied'
    && !installed.isError && installed.body?.turnedOff?.code === 'turned-off' && Array.isArray(feed) && !feed.includes('added')
    && row?.status?.kind === 'turned-off' && JSON.stringify(row.state) === JSON.stringify(kept) && !listed.includes(SLUG),
    JSON.stringify({ removed: removed.body?.error ?? removed.body?.application, installed: installed.body?.error ?? installed.body?.turnedOff, feed, status: row?.status, state: row?.state, kept, listed }))
  const on = await route('main', 'turnOn', { slug: SLUG })
  const onRow = (await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live')).get(SLUG)
  check('Turn on after the agent remove and install brings the widget back with the same state', on.body?.result?.ok === true && onRow?.status?.kind === 'live' && JSON.stringify(onRow.state) === JSON.stringify(kept),
    JSON.stringify({ on: on.body?.result, status: onRow?.status, state: onRow?.state }))
}

/**
 * main_widget.window_state: the actions show and hide of main. The test widget is live when this part starts, and it is
 * live again at its end. Sample stays hidden, so the next host start checks that the host kept the choice.
 */
async function windowPart(call, dir) {
  for (const action of ['show', 'hide']) {
    const hidden = await call('widget_call', { slug: 'main', action, args: { slug: 'sample' } })
    check(`widget_call of the action ${action} of main gives unknown-widget`, hidden.isError && hidden.body?.error?.code === 'unknown-widget', JSON.stringify(hidden.body))
  }
  // window_writes_skip_queued_write: a Hide and a Show sent together end shown, because the last request wins. A Hide
  // in the queue and then a forget leave no record, so the window shows. Each case starts with no record.
  const race = await inHost(`
    const records = loader.ctx.get('widgetRecords')
    await records.forgetWindow('sample')
    await Promise.all([records.setWindowShown('sample', false), records.setWindowShown('sample', true)])
    const hideThenShow = records.windowShown('sample')
    await records.forgetWindow('sample')
    await Promise.all([records.setWindowShown('sample', false), records.forgetWindow('sample')])
    return { hideThenShow, hideThenForget: records.windowShown('sample') }`)
  check('a Hide and a Show sent together end shown, and a queued Hide and then a forget leave the window shown',
    race?.hideThenShow === true && race.hideThenForget === true, JSON.stringify(race))
  const stream = await openEvents()
  const opened = await stream.next((frame) => frame.type === 'hello')
  const hide = await route('main', 'hide', { slug: 'sample' })
  const frame = await stream.next((item) => item.type === 'window' && item.slug === 'sample')
  await stream.close()
  const row = (await waitRows((rows) => rows.get('sample')?.window === 'hidden')).get('sample')
  const hello = await eventsHello()
  check('hide of main hides sample: the row has the window hidden, a window frame tells Electron main, and the hello gives the hidden state',
    opened?.shown?.sample === true && hide.body?.result?.ok === true && hide.body.result.window === 'hidden' && row?.window === 'hidden'
      && frame?.shown === false && hello?.slugs?.includes('sample') && hello.shown?.sample === false && !hello.slugs.includes('main') && hello.shown.main === undefined,
    JSON.stringify({ opened, hide: hide.body, row: row?.window, frame, hello }))
  const again = await route('main', 'hide', { slug: 'sample' })
  check('a second hide of sample gives the same result', again.body?.result?.ok === true && again.body.result.window === 'hidden', JSON.stringify(again.body))
  const main = await route('main', 'hide', { slug: 'main' })
  const none = await route('main', 'hide', { slug: 'no-such-widget' })
  check('hide refuses main with unknown-widget and a slug with no window with no-window',
    main.body?.ok === true && main.body.result?.ok === false && main.body.result.code === 'unknown-widget'
      && none.body?.ok === true && none.body.result?.ok === false && none.body.result.code === 'no-window',
    JSON.stringify({ main: main.body, none: none.body }))

  // agent_remove_reinstall_unhides: an agent widget_remove keeps the Hide of the operator, as it keeps a Turn off. The
  // next widget_install comes up hidden, and its `added` frame says so.
  const hideTest = await route('main', 'hide', { slug: SLUG })
  const hiddenTest = (await waitRows((rows) => rows.get(SLUG)?.window === 'hidden')).get(SLUG)
  const removed = await call('widget_remove', { slug: SLUG })
  const installStream = await openEvents()
  await installStream.next((item) => item.type === 'hello')
  const installed = await call('widget_install', { dir })
  const added = await installStream.next((item) => item.type === 'added' && item.slug === SLUG)
  await installStream.close()
  const back = (await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live')).get(SLUG)
  const backHello = await eventsHello()
  check('an agent widget_remove keeps the hidden state: the next widget_install comes up hidden, with shown false in its added frame',
    hideTest.body?.result?.ok === true && hiddenTest?.window === 'hidden' && !removed.isError && removed.body?.application === 'applied' && !installed.isError && installed.body?.application === 'applied'
      && added?.shown === false && back?.window === 'hidden' && backHello?.shown?.[SLUG] === false,
    JSON.stringify({ hide: hideTest.body?.result, hidden: hiddenTest?.window, removed: removed.body?.error ?? removed.body?.application, installed: installed.body?.error ?? installed.body?.application, added, back: back?.window, hello: backHello?.shown }))

  // Only the Remove of the operator in main ends the Hide: the next install is a new widget, so its window starts as shown.
  const operatorRemoved = await route('main', 'remove', { slug: SLUG })
  const reinstalled = await call('widget_install', { dir })
  const fresh = (await waitRows((rows) => rows.get(SLUG)?.status?.kind === 'live')).get(SLUG)
  const freshHello = await eventsHello()
  check('the Remove of main ends the hidden state: the next widget_install of the test widget starts as shown',
    operatorRemoved.body?.result?.ok === true && !reinstalled.isError && reinstalled.body?.application === 'applied' && fresh?.window === 'shown' && freshHello?.shown?.[SLUG] === true,
    JSON.stringify({ removed: operatorRemoved.body?.result, installed: reinstalled.body?.error ?? reinstalled.body?.application, fresh: fresh?.window, hello: freshHello?.shown }))
}

/** The core of the kit (kit.terms), in the order of read(). */
const KIT_CORE = ['react', 'react-dom', '@types/react', '@types/react-dom', '@openuidev/react-lang', 'zod', '@deepwidgets/widget-kit', '@deepwidgets/shell']
/** The time that one change of the kit may take in this check. A change runs pnpm online. */
const KIT_CHANGE_MS = 300_000

/** The part kit of the query settings of main, or `{ queryError }` when the query failed. */
async function kitSettings() {
  const answer = await route('main', 'settings').catch((error) => ({ status: 0, body: { error: String(error) } }))
  return answer.body?.ok === true ? answer.body.result?.kit : { queryError: answer.body ?? answer.status }
}

/** Poll the part kit until `test` holds, for at most `ms`. Gives the last part and each status that a poll saw, in order. */
async function waitKit(test, ms) {
  const seen = []
  const note = (kit) => { if (typeof kit?.status === 'string' && seen.at(-1) !== kit.status) seen.push(kit.status) }
  let kit = await kitSettings()
  note(kit)
  for (const until = Date.now() + ms; !test(kit) && Date.now() < until;) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    kit = await kitSettings()
    note(kit)
  }
  return { kit, seen }
}

/** One action of main through its call route, with the time of the answer in ms. */
async function timedRoute(action, args) {
  const started = performance.now()
  const answer = await route('main', action, args)
  return { ...answer, ms: Math.round(performance.now() - started) }
}

const kitReady = (kit) => kit?.ok === true && kit.status === 'ready'
const extraNames = (kit) => (kit?.extras ?? []).map((extra) => extra.name)
/** The code of a refusal of main, or undefined for an answer that is not a refusal. */
const refusedWith = (answer) => answer.body?.ok === true && answer.body.result?.ok === false ? answer.body.result.code : undefined

/**
 * kit.pane.actions: the actions of the kit section, with the kit of this host and the npm registry. The part kit of the
 * query settings, kitAdd and kitRemove that answer at once while pnpm runs, the refusals in-core and kit-busy, and
 * setRefuseBuilds with the refuse list of the kit (kit.settings). The settings file has the key modes from settingsPart.
 */
async function kitPart(call) {
  const settingsFile = join(home, 'deepwidgets', 'settings.json')
  for (const [action, args] of [['kitAdd', { spec: 'ms@^2' }], ['kitRemove', { name: 'ms' }], ['setRefuseBuilds', { names: [] }]]) {
    const hidden = await call('widget_call', { slug: 'main', action, args })
    check(`widget_call of the action ${action} of main gives unknown-widget`, hidden.isError && hidden.body?.error?.code === 'unknown-widget', JSON.stringify(hidden.body))
  }

  // ---- the part kit: ready, the version, the core, no extra ----
  const first = (await waitKit(kitReady, 120_000)).kit
  check('the part kit of the query settings shows the status ready, the kit version, the 8 core packages with their versions, no extra, and an empty refuse list',
    kitReady(first) && Number.isInteger(first.version) && first.version >= 1 && first.available === true && first.change === undefined && first.last === undefined
      && JSON.stringify(first.core?.map((item) => item.name)) === JSON.stringify(KIT_CORE) && first.core.every((item) => /^\d+\.\d+\.\d+/.test(item.version))
      && Array.isArray(first.extras) && first.extras.length === 0
      && first.refuseBuilds?.ok === true && first.refuseBuilds.file === settingsFile && JSON.stringify(first.refuseBuilds.names) === '[]',
    JSON.stringify(first))

  // ---- kitAdd answers at once; the status goes from changing to ready ----
  const added = await timedRoute('kitAdd', { spec: 'date-fns@^4' })
  const during = await kitSettings()
  const busyAdd = await route('main', 'kitAdd', { spec: 'ms@^2' })
  const busyRemove = await route('main', 'kitRemove', { name: 'date-fns' })
  check('kitAdd of date-fns@^4 answers started in at most 1 s', added.body?.ok === true && added.body.result?.ok === true && added.body.result.started?.kind === 'add'
    && added.body.result.started.spec === 'date-fns@^4' && typeof added.body.result.started.startedAt === 'number' && added.ms <= 1000,
  JSON.stringify({ ms: added.ms, body: added.body }))
  check('right after the answer, the status is changing, with the change date-fns@^4',
    during?.ok === true && during.status === 'changing' && during.change?.kind === 'add' && during.change.spec === 'date-fns@^4', JSON.stringify(during))
  check('a second kitAdd and a kitRemove while a change runs answer kit-busy', refusedWith(busyAdd) === 'kit-busy' && refusedWith(busyRemove) === 'kit-busy',
    JSON.stringify({ add: busyAdd.body, remove: busyRemove.body }))
  const addedEnd = await waitKit(kitReady, KIT_CHANGE_MS)
  const dateFns = addedEnd.kit?.extras?.find((extra) => extra.name === 'date-fns')
  check('the status goes from changing to ready, with date-fns as an extra at an exact version and a last change with no error',
    kitReady(addedEnd.kit) && addedEnd.seen.includes('changing') && /^4\.\d+\.\d+$/.test(dateFns?.version ?? '') && addedEnd.kit.version === first.version + 1
      && addedEnd.kit.change === undefined && addedEnd.kit.last?.kind === 'add' && addedEnd.kit.last.spec === 'date-fns@^4' && addedEnd.kit.last.error === undefined
      && addedEnd.kit.last.version === first.version + 1 && typeof addedEnd.kit.last.endedAt === 'number',
    JSON.stringify({ seen: addedEnd.seen, kit: addedEnd.kit }))

  // ---- refusals before a change starts ----
  const inCore = await timedRoute('kitAdd', { spec: 'react' })
  const removeCore = await timedRoute('kitRemove', { name: 'zod' })
  const badSpec = await timedRoute('kitAdd', { spec: 'Not A Spec' })
  const afterRefusals = await kitSettings()
  check('kitAdd and kitRemove of a core package answer in-core at once, and the kit takes no change',
    refusedWith(inCore) === 'in-core' && refusedWith(removeCore) === 'in-core' && inCore.ms <= 1000 && removeCore.ms <= 1000
      && kitReady(afterRefusals) && afterRefusals.last?.spec === 'date-fns@^4' && afterRefusals.version === addedEnd.kit.version,
    JSON.stringify({ inCore: inCore.body, removeCore: removeCore.body, ms: [inCore.ms, removeCore.ms], last: afterRefusals?.last }))
  check('kitAdd of a spec that is not a package name answers not-found at once, and the kit takes no change',
    refusedWith(badSpec) === 'not-found' && badSpec.ms <= 1000 && kitReady(afterRefusals), JSON.stringify({ ms: badSpec.ms, body: badSpec.body }))

  // ---- setRefuseBuilds keeps the key modes; a refused package ends with install-failed ----
  const beforeFile = JSON.parse(readFileSync(settingsFile, 'utf8'))
  const refuse = await route('main', 'setRefuseBuilds', { names: ['core-js', 'core-js'] })
  const writtenFile = JSON.parse(readFileSync(settingsFile, 'utf8'))
  const listed = await kitSettings()
  check('setRefuseBuilds of core-js writes kit.refuseBuilds with each name once, keeps the key modes, and the part kit shows the list',
    refuse.body?.result?.ok === true && JSON.stringify(refuse.body.result.names) === '["core-js"]' && refuse.body.result.file === settingsFile
      && beforeFile.modes !== undefined && JSON.stringify(writtenFile.modes) === JSON.stringify(beforeFile.modes) && JSON.stringify(writtenFile.kit?.refuseBuilds) === '["core-js"]'
      && listed?.refuseBuilds?.ok === true && JSON.stringify(listed.refuseBuilds.names) === '["core-js"]',
    JSON.stringify({ refuse: refuse.body, beforeFile, writtenFile, list: listed?.refuseBuilds }))
  const coreJs = await timedRoute('kitAdd', { spec: 'core-js' })
  const coreJsEnd = await waitKit((kit) => kitReady(kit) && kit.last?.spec === 'core-js', KIT_CHANGE_MS)
  const coreJsLast = coreJsEnd.kit?.last
  check('with core-js refused, kitAdd of core-js answers started, and the change ends with a last change of install-failed that names core-js, and the kit stays',
    coreJs.body?.result?.ok === true && coreJs.ms <= 1000 && kitReady(coreJsEnd.kit) && coreJsLast?.kind === 'add' && coreJsLast.error?.code === 'install-failed'
      && (/^core-js(?:@|$)/.test(coreJsLast.error.package ?? '') || coreJsLast.error.message.includes('core-js'))
      && coreJsEnd.kit.version === addedEnd.kit.version && !extraNames(coreJsEnd.kit).includes('core-js'),
    JSON.stringify({ ms: coreJs.ms, started: coreJs.body, seen: coreJsEnd.seen, last: coreJsLast, version: coreJsEnd.kit?.version }))

  // ---- kitRemove removes the extra ----
  const removed = await timedRoute('kitRemove', { name: 'date-fns' })
  const removedEnd = await waitKit((kit) => kitReady(kit) && kit.last?.kind === 'remove', KIT_CHANGE_MS)
  check('kitRemove of date-fns answers started at once, and the change removes the extra',
    removed.body?.result?.ok === true && removed.body.result.started?.kind === 'remove' && removed.body.result.started.name === 'date-fns' && removed.ms <= 1000
      && kitReady(removedEnd.kit) && !extraNames(removedEnd.kit).includes('date-fns') && removedEnd.kit.last?.name === 'date-fns' && removedEnd.kit.last.error === undefined
      && removedEnd.kit.version === addedEnd.kit.version + 1,
    JSON.stringify({ ms: removed.ms, removed: removed.body, seen: removedEnd.seen, kit: removedEnd.kit }))

  // ---- bad-name, and a settings file that does not parse ----
  const kept = readFileSync(settingsFile, 'utf8')
  const bad = await route('main', 'setRefuseBuilds', { names: ['core-js', 'Bad Name!'] })
  check('setRefuseBuilds of a name that npm does not accept gives bad-name, and the file stays',
    refusedWith(bad) === 'bad-name' && bad.body.result.message.includes('Bad Name!') && readFileSync(settingsFile, 'utf8') === kept, JSON.stringify(bad.body))
  // kit.pane.actions: an old package with capital letters can reach the kit as a dependency of an extra.
  const legacy = await route('main', 'setRefuseBuilds', { names: ['JSONStream'] })
  check('setRefuseBuilds of the old npm name JSONStream writes the name',
    legacy.body?.result?.ok === true && JSON.stringify(legacy.body.result.names) === '["JSONStream"]'
      && JSON.stringify(JSON.parse(readFileSync(settingsFile, 'utf8')).kit?.refuseBuilds) === '["JSONStream"]',
    JSON.stringify(legacy.body))
  const broken = '{ "kit": { "refuseBuilds": '
  writeFileSync(settingsFile, broken)
  const brokenKit = await kitSettings()
  const brokenSet = await route('main', 'setRefuseBuilds', { names: [] })
  check('with a settings file that does not parse, only the refuse list of the part kit is a refusal, and setRefuseBuilds refuses with settings-unreadable and keeps the file',
    kitReady(brokenKit) && brokenKit.core?.length === 8 && brokenKit.refuseBuilds?.ok === false && brokenKit.refuseBuilds.code === 'settings-unreadable'
      && refusedWith(brokenSet) === 'settings-unreadable' && readFileSync(settingsFile, 'utf8') === broken,
    JSON.stringify({ list: brokenKit?.refuseBuilds, status: brokenKit?.status, set: brokenSet.body }))
  writeFileSync(settingsFile, kept)
  const cleared = await route('main', 'setRefuseBuilds', { names: [] })
  check('setRefuseBuilds of an empty list clears the list', cleared.body?.result?.ok === true && JSON.stringify(JSON.parse(readFileSync(settingsFile, 'utf8')).kit?.refuseBuilds) === '[]',
    JSON.stringify(cleared.body))

  // ---- a host with no service kit: the part kit is a refusal, and the other sections still show ----
  const toggle = (enabled) => inHost(`
    const manager = loader.ctx.get('pluginManager')
    const hmr = loader.ctx.get('hmr')
    const rows = (await manager.listPlugins()).filter((row) => row.moduleName === '@deepwidgets/kit')
    if (rows.length !== 1) throw new Error('plugin rows of the kit: ' + rows.length)
    const run = async () => (await manager.setPluginEnabled(rows[0].entryId, arg)).application
    return hmr === undefined ? await run() : await hmr.executing.exit(run)`, enabled)
  const off = await toggle(false)
  const noKit = await route('main', 'settings')
  const noKitAdd = await route('main', 'kitAdd', { spec: 'ms@^2' })
  const on = await toggle(true)
  const back = (await waitKit(kitReady, 120_000)).kit
  check('with the row of the kit off, the part kit is a refusal unavailable, the modes still show, and kitAdd gives kit-unavailable',
    off === 'applied' && noKit.body?.ok === true && noKit.body.result?.kit?.ok === false && noKit.body.result.kit.code === 'unavailable' && noKit.body.result.modes?.ok === true
      && refusedWith(noKitAdd) === 'kit-unavailable',
    JSON.stringify({ off, kit: noKit.body?.result?.kit, modes: noKit.body?.result?.modes?.ok, add: noKitAdd.body }))
  check('with the row of the kit on again, the kit is ready, and its new start has no last change',
    on === 'applied' && kitReady(back) && back.last === undefined && back.version === removedEnd.kit.version, JSON.stringify({ on, kit: back }))
}

/**
 * kit.pane.service: another live process holds the lock of the kit at host start, so the kit start waits for it. The
 * query settings reads snapshot(), so it answers in at most 2 s, with the kit status starting and the modes. kitAdd
 * and kitRemove give kit-unavailable at once. When the holder ends, the start takes the lock over and the kit is ready.
 */
async function kitLockPart(port) {
  await stopHost()
  const lockFile = join(home, 'deepwidgets', 'kit', 'current.lock')
  const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 120_000)'], { stdio: 'ignore' })
  writeFileSync(lockFile, `${String(holder.pid)}\n`)
  try {
    await startHost(port)
    let up = await route('main', 'widgets').catch(() => undefined)
    for (let i = 0; i < 100 && up?.body?.ok !== true; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      up = await route('main', 'widgets').catch(() => undefined)
    }
    const read = await timedRoute('settings', {})
    const settings = read.body?.result
    check('while another process holds the kit lock at host start, the query settings answers in at most 2 s, with the kit status starting and the modes',
      read.status === 200 && read.body?.ok === true && read.ms <= 2000 && settings?.kit?.ok === true && settings.kit.status === 'starting' && settings.modes?.ok === true
        && holder.exitCode === null,
      JSON.stringify({ ms: read.ms, status: read.status, kit: settings?.kit, modes: settings?.modes?.ok, error: read.body?.error }))
    const add = await timedRoute('kitAdd', { spec: 'ms@^2' })
    const remove = await timedRoute('kitRemove', { name: 'ms' })
    check('while the kit starts, kitAdd and kitRemove answer kit-unavailable at once',
      refusedWith(add) === 'kit-unavailable' && refusedWith(remove) === 'kit-unavailable' && add.ms <= 1000 && remove.ms <= 1000,
      JSON.stringify({ add: add.body, remove: remove.body, ms: [add.ms, remove.ms] }))
    holder.kill('SIGKILL')
    const ready = await waitKit(kitReady, 60_000)
    check('when the holder of the lock ends, the kit start ends, and the kit is ready', kitReady(ready.kit) && ready.kit.change === undefined, JSON.stringify(ready))
  } finally {
    holder.kill('SIGKILL')
    rmSync(lockFile, { force: true })
  }
}

/**
 * kit.service.start: the link `current` of the kit names no kit version, so the start makes the kit unavailable. The
 * status is unavailable with the reason, and kitAdd and kitRemove answer kit-unavailable at once. A kit with no extra
 * installs offline also with no store, so this part breaks the link, not the store.
 */
async function kitUnavailablePart(port) {
  await stopHost()
  const link = join(home, 'deepwidgets', 'kit', 'current')
  const target = readlinkSync(link)
  unlinkSync(link)
  symlinkSync('versions/none', link, 'dir')
  try {
    await startHost(port)
    const { kit } = await waitKit((value) => value?.ok === true && value.status !== 'starting', 60_000)
    const add = await timedRoute('kitAdd', { spec: 'ms@^2' })
    const remove = await timedRoute('kitRemove', { name: 'ms' })
    check('with a link current that names no kit version, the kit status is unavailable with the reason, and kitAdd and kitRemove answer kit-unavailable at once',
      kit?.ok === true && kit.status === 'unavailable' && kit.available === false && (kit.reason ?? '').includes('not a kit version')
        && refusedWith(add) === 'kit-unavailable' && refusedWith(remove) === 'kit-unavailable' && add.ms <= 1000 && remove.ms <= 1000,
      JSON.stringify({ kit: { status: kit?.status, reason: kit?.reason }, add: add.body, remove: remove.body, ms: [add.ms, remove.ms] }))
  } finally {
    // rmSync follows a link to a folder, so the link goes with unlink.
    if (lstatSync(link, { throwIfNoEntry: false }) !== undefined) unlinkSync(link)
    symlinkSync(target, link, 'dir')
  }
}

/** main_widget.window_state: after a host start, sample is still hidden. Show shows it, and the hello gives shown again. */
async function windowKeptPart() {
  const kept = (await waitRows((rows) => rows.get('sample')?.status?.kind === 'live')).get('sample')
  const hello = await eventsHello()
  check('after a host start, the window of sample is still hidden', kept?.window === 'hidden' && hello?.shown?.sample === false, JSON.stringify({ row: kept?.window, hello }))
  const show = await route('main', 'show', { slug: 'sample' })
  const shown = (await waitRows((rows) => rows.get('sample')?.window === 'shown')).get('sample')
  const after = await eventsHello()
  check('show of main shows sample again', show.body?.result?.ok === true && show.body.result.window === 'shown' && shown?.window === 'shown' && after?.shown?.sample === true,
    JSON.stringify({ show: show.body, row: shown?.window, hello: after?.shown }))
}

/**
 * main_widget.settings: the host half of the Settings tab. The MCP tools do not show its actions. The query `settings`
 * gives the modes from the settings file, the port and the path of mcp.json, and no login item in a CLI host. A switch
 * of create writes the file in the shape of modes.settings and keeps each other key; then widget_install gives mode-off.
 * A file that does not parse shows its error, and a switch refuses with settings-unreadable and does not change it.
 * create on again: the install works.
 */
async function settingsPart(call, dir) {
  const settingsFile = join(home, 'deepwidgets', 'settings.json')
  const portFile = join(home, 'deepwidgets', 'mcp.json')
  for (const action of ['settings', 'setMode', 'setLoginItem']) {
    const hidden = await call('widget_call', { slug: 'main', action, args: action === 'setMode' ? { mode: 'create', on: false } : action === 'setLoginItem' ? { open: true } : {} })
    check(`widget_call of the action ${action} of main gives unknown-widget`, hidden.isError && hidden.body?.error?.code === 'unknown-widget', JSON.stringify(hidden.body))
  }
  const read = await route('main', 'settings')
  const settings = read.body?.result
  const mcpFile = JSON.parse(readFileSync(portFile, 'utf8'))
  const names = settings?.modes?.modes?.map((mode) => `${mode.name}:${String(mode.setting)}:${String(mode.on)}`)
  check('the query settings gives each mode from the settings file, with interact always on',
    read.body?.ok === true && settings?.modes?.ok === true && settings.modes.file === settingsFile && settings.modes.error === undefined
      && JSON.stringify(names) === '["interact:null:true","create:modes.create:true","library:modes.library:true"]',
    JSON.stringify(settings?.modes))
  check('the query settings gives the port and the path of mcp.json, and not its nonce',
    settings?.port?.ok === true && settings.port.port === mcpFile.port && settings.port.file === portFile && !JSON.stringify(settings).includes(mcpFile.nonce),
    JSON.stringify({ port: settings?.port, file: mcpFile.port }))
  check('the query settings gives no login item in a CLI host', settings?.loginItem?.ok === false && settings.loginItem.code === 'unavailable', JSON.stringify(settings?.loginItem))
  const login = await route('main', 'setLoginItem', { open: true })
  check('setLoginItem refuses in a CLI host with unavailable', login.body?.ok === true && login.body.result?.ok === false && login.body.result.code === 'unavailable', JSON.stringify(login.body))
  const unknown = await route('main', 'setMode', { mode: 'interact', on: false })
  check('setMode refuses interact with unknown-mode', unknown.body?.ok === true && unknown.body.result?.ok === false && unknown.body.result.code === 'unknown-mode', JSON.stringify(unknown.body))

  // The other keys of the file stay: a key at the top, and keys of other modes.
  mkdirSync(dirname(settingsFile), { recursive: true })
  writeFileSync(settingsFile, JSON.stringify({ note: 'kept', modes: { library: true, kit: false } }))
  const off = await route('main', 'setMode', { mode: 'create', on: false })
  const written = JSON.parse(readFileSync(settingsFile, 'utf8'))
  check('setMode create false writes "create": false and keeps each other key',
    off.body?.result?.ok === true && off.body.result.modes?.find((mode) => mode.name === 'create')?.on === false
      && JSON.stringify(written) === JSON.stringify({ note: 'kept', modes: { library: true, kit: false, create: false } }),
    JSON.stringify({ off: off.body, written }))
  const refused = await call('widget_install', { dir })
  const modes = await call('deepwidgets_modes')
  check('with create off from the Settings tab, widget_install gives mode-off, and deepwidgets_modes shows create off',
    refused.isError && refused.body?.error?.code === 'mode-off' && refused.body.error.mode === 'create' && modes.body?.modes?.find((mode) => mode.name === 'create')?.on === false,
    JSON.stringify({ refused: refused.body?.error ?? refused.body?.application, modes: modes.body?.modes }))

  // A file that does not parse: the tab shows its error, and a switch does not change it.
  const broken = '{ "modes": { "create": false '
  writeFileSync(settingsFile, broken)
  const brokenRead = (await route('main', 'settings')).body?.result?.modes
  const brokenSet = await route('main', 'setMode', { mode: 'create', on: true })
  check('a settings file that does not parse shows its parse error, and setMode refuses with settings-unreadable and keeps the file',
    typeof brokenRead?.error === 'string' && brokenRead.error.includes('not JSON') && brokenSet.body?.result?.ok === false && brokenSet.body.result.code === 'settings-unreadable'
      && readFileSync(settingsFile, 'utf8') === broken,
    JSON.stringify({ brokenRead, brokenSet: brokenSet.body?.result, file: readFileSync(settingsFile, 'utf8') }))

  writeFileSync(settingsFile, JSON.stringify({ modes: { create: false } }))
  const on = await route('main', 'setMode', { mode: 'create', on: true })
  const back = JSON.parse(readFileSync(settingsFile, 'utf8'))
  const installed = await call('widget_install', { dir })
  check('setMode create true writes "create": true, and widget_install works again',
    on.body?.result?.ok === true && back.modes?.create === true && !installed.isError && installed.body?.application === 'applied',
    JSON.stringify({ on: on.body?.result, back, installed: installed.body?.error ?? installed.body?.application }))
  const removed = await call('widget_remove', { slug: SLUG })
  check('the test widget installed for the settings check is removed', !removed.isError, JSON.stringify(removed.body?.error ?? removed.body?.application))
}

async function hostPart() {
  const port = await freePort()
  inspectPort = await freePort()
  base = `http://127.0.0.1:${String(port)}`
  console.log(`widgets-main: work folder ${work}, port ${String(port)}`)
  await startHost(port)
  const client = await connect()
  const call = async (name, args = {}) => {
    const answer = await client.callTool({ name, arguments: args })
    return { isError: answer.isError === true, body: body(answer) }
  }

  // ---- the test widget: the template, with its count at 3 ----
  const template = await call('widget_template', { slug: SLUG, title: 'Main Check' })
  const files = template.body?.files ?? []
  const dir = join(work, 'agent', SLUG)
  for (const file of files) {
    mkdirSync(dirname(join(dir, file.path)), { recursive: true })
    writeFileSync(join(dir, file.path), file.text)
  }
  const installed = await call('widget_install', { dir })
  const added = await call('widget_call', { slug: SLUG, action: 'add', args: { by: 3 }, requestId: 'main-check-1' })
  const sampleAdded = await call('widget_call', { slug: 'sample', action: 'add', args: { by: 2 }, requestId: 'main-check-2' })
  check('widget_install installs the test widget, and add works', !installed.isError && installed.body?.application === 'applied' && added.body?.result?.count === 3 && sampleAdded.body?.result?.count === 2,
    JSON.stringify({ installed: installed.body?.error ?? installed.body?.application, added: added.body, sample: sampleAdded.body }))
  // A second agent widget for the safe-mode part at the end.
  const safeDir = join(work, 'agent', SAFE_SLUG)
  mkdirSync(join(safeDir, 'src'), { recursive: true })
  writeFileSync(join(safeDir, 'src', 'index.ts'), files[0].text.replaceAll(`'${SLUG}'`, `'${SAFE_SLUG}'`))
  const safeInstalled = await call('widget_install', { dir: safeDir })
  check('widget_install installs the second test widget', !safeInstalled.isError && safeInstalled.body?.application === 'applied', JSON.stringify(safeInstalled.body?.error ?? safeInstalled.body?.application))

  // ---- main_widget.widget: the MCP server does not show main ----
  const mainLive = await route('main', 'widgets')
  const listed = (await call('widget_list')).body?.widgets?.map((widget) => widget.slug) ?? []
  check('the main widget is live in the host', mainLive.status === 200 && mainLive.body?.ok === true, JSON.stringify(mainLive).slice(0, 300))
  check('widget_list does not list main', listed.includes('sample') && listed.includes(SLUG) && !listed.includes('main'), JSON.stringify(listed))
  const callMain = await call('widget_call', { slug: 'main', action: 'widgets' })
  const callNone = await call('widget_call', { slug: 'no-such-widget', action: 'widgets' })
  check('widget_call on main gives the error of a slug that does not exist', callMain.isError && callMain.body?.error?.code === 'unknown-widget' && callNone.body?.error?.code === 'unknown-widget'
    && callMain.body.error.message === callNone.body.error.message.replace('no-such-widget', 'main') && callMain.body.error.nextStep === callNone.body.error.nextStep,
    JSON.stringify({ main: callMain.body, none: callNone.body }))
  const describeMain = await call('widget_describe', { slug: 'main' })
  check('widget_describe on main gives unknown-widget', describeMain.isError && describeMain.body?.error?.code === 'unknown-widget', JSON.stringify(describeMain.body))
  const clashDir = join(work, 'agent', 'main-clash')
  mkdirSync(join(clashDir, 'src'), { recursive: true })
  writeFileSync(join(clashDir, 'src', 'index.ts'), files[0].text.replaceAll(`'${SLUG}'`, "'main'"))
  const clash = await call('widget_install', { dir: clashDir })
  check('widget_install of the slug main gives slug-taken', clash.isError && clash.body?.error?.code === 'slug-taken', JSON.stringify(clash.body?.error))
  const hello = await eventsHello()
  check('the hello frame of the events route does not name main', Array.isArray(hello?.slugs) && hello.slugs.includes('sample') && !hello.slugs.includes('main'), JSON.stringify(hello))

  // ---- main_widget.catalog ----
  const sampleProgram = await program('sample')
  const mainProgram = await program('main')
  check('GET program of sample gives the catalog shadcn-widgets@1', sampleProgram.status === 200 && sampleProgram.body?.catalog === 'shadcn-widgets@1', JSON.stringify(sampleProgram.body?.catalog))
  check('GET program of main gives the catalog deepwidgets-main@1', mainProgram.status === 200 && mainProgram.body?.catalog === 'deepwidgets-main@1', JSON.stringify(mainProgram.body?.catalog))

  // ---- main_widget.widgets: the query ----
  const rows = await mainRows()
  // widgets_query_cost: the time of the query widgets, for the PR. Five calls; the first one warms the caches.
  const times = []
  for (let i = 0; i < 5; i += 1) {
    const started = performance.now()
    await mainRows()
    times.push(Math.round(performance.now() - started))
  }
  console.log(`INFO the query widgets took ${JSON.stringify(times)} ms with ${String(rows.size)} rows`)
  check('the query of main has no row for main', !rows.has('main'), JSON.stringify([...rows.keys()]))
  const sampleProblems = liveFields(rows.get('sample'), { title: 'Sample', agent: false, rowId: 'deepwidgets-widget-sample', packageName: '@deepwidgets/widget-sample', source: undefined })
  check('the query of main lists sample with each field', sampleProblems.length === 0 && rows.get('sample')?.state?.data?.count === 2, `${sampleProblems.join('; ')} ${JSON.stringify(rows.get('sample'))}`)
  const testProblems = liveFields(rows.get(SLUG), { title: 'Main Check', agent: true, rowId: `deepwidgets-agent-${SLUG}`, packageName: `deepwidgets-agent-${SLUG}`, source: dir })
  check('the query of main lists the test widget with each field', testProblems.length === 0 && rows.get(SLUG)?.state?.data?.count === 3, `${testProblems.join('; ')} ${JSON.stringify(rows.get(SLUG))}`)
  const text = await route('main', 'program', { slug: 'sample' })
  check('the query program of main gives the program text of sample', text.body?.ok === true && text.body.result?.ok === true && typeof text.body.result.text === 'string' && text.body.result.text.includes('Card') && text.body.result.rev === rows.get('sample')?.program?.rev,
    JSON.stringify(text.body).slice(0, 300))

  // ---- Turn off and Turn on ----
  await offAndOn('sample', 'deepwidgets-widget-sample')
  await offAndOn(SLUG, `deepwidgets-agent-${SLUG}`)
  await reloadKeepsTurnOff(call)
  await turnedOffReloadRunsNoCode(call)
  await refusedTurnOffStoresNothing()
  await agentRemoveKeepsTurnOff(call, dir)
  const offMain = await route('main', 'turnOff', { slug: 'main' })
  // main_widget.widgets: a refusal is the result of the action, with a code, not a handler-error with a code in its message.
  check('Turn off refuses main with the code unknown-widget', offMain.body?.ok === true && offMain.body.result?.ok === false && offMain.body.result.code === 'unknown-widget', JSON.stringify(offMain.body))
  await windowPart(call, dir)

  // ---- Remove ----
  const before = (await mainRows()).get(SLUG)?.state
  const refused = await route('main', 'remove', { slug: 'sample' })
  const sampleAfter = (await mainRows()).get('sample')
  check('Remove refuses sample with the code built-in, and sample stays live', refused.body?.ok === true && refused.body.result?.ok === false && refused.body.result.code === 'built-in' && sampleAfter?.status?.kind === 'live',
    JSON.stringify({ refused: refused.body, sample: sampleAfter?.status }))
  const none = await route('main', 'remove', { slug: 'no-such-widget' })
  check('Remove of a slug with no agent bundle gives the code of the installer and its diagnostics', none.body?.ok === true && none.body.result?.ok === false && none.body.result.code === 'not-installed' && Array.isArray(none.body.result.diagnostics),
    JSON.stringify(none.body))
  const removed = await route('main', 'remove', { slug: SLUG })
  const afterRows = await waitRows((items) => !items.has(SLUG))
  const stored = await inHost("return await loader.ctx.get('widgetRecords').stateRecord(arg)", SLUG)
  const listedAfter = (await call('widget_list')).body?.widgets?.map((widget) => widget.slug) ?? []
  check('Remove removes the test widget', removed.body?.ok === true && removed.body.result?.ok === true && removed.body.result.application === 'applied' && !afterRows.has(SLUG) && !listedAfter.includes(SLUG),
    JSON.stringify({ removed: removed.body, rows: [...afterRows.keys()], listed: listedAfter }))
  check('Remove keeps the state of the test widget in storage', stored !== undefined && JSON.stringify(stored) === JSON.stringify(before) && stored?.data?.count === 3, JSON.stringify({ stored, before }))

  // ---- widget_changes: the row of main goes off and on, so the feed of the runtime has a removed and an added change of main ----
  const cursor = (await call('widget_list')).body?.cursor
  const restarted = await inHost(`
    const manager = loader.ctx.get('pluginManager')
    const hmr = loader.ctx.get('hmr')
    const rows = (await manager.listPlugins()).filter((row) => row.moduleName === '@deepwidgets/widget-main')
    if (rows.length !== 1) throw new Error('plugin rows of widget-main: ' + rows.length)
    const run = async () => [await manager.setPluginEnabled(rows[0].entryId, false), await manager.setPluginEnabled(rows[0].entryId, true)].map((result) => result.application)
    return hmr === undefined ? await run() : await hmr.executing.exit(run)`)
  let back = await route('main', 'widgets')
  for (let i = 0; i < 100 && back.body?.ok !== true; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    back = await route('main', 'widgets')
  }
  const raw = await inHost("return loader.ctx.get('widgets').changes(arg).changes.map((change) => change.slug + ':' + change.kind)", cursor)
  const changes = await call('widget_changes', { since: cursor })
  check('widget_changes gives no change of main', JSON.stringify(restarted) === '["applied","applied"]' && back.body?.ok === true && raw.includes('main:removed') && raw.includes('main:added')
    && !changes.isError && Array.isArray(changes.body?.changes) && !changes.body.changes.some((change) => change.slug === 'main'),
    JSON.stringify({ restarted, raw, tool: changes.body?.changes?.map((change) => change.slug) }))

  await settingsPart(call, dir)
  await kitPart(call)

  const log = readFileSync(logPath, 'utf8')
  check('the host log has no refusal of the install records', !log.includes('can not use the install records') && !log.includes('can not run host code'), '')
  await client.close().catch(() => undefined)
  await safeModePart(port)
  await silentParentPart(port)
  await kitLockPart(port)
  await kitUnavailablePart(port)
}

/**
 * login_limit_equals_action_limit: a host whose parent (Electron main) never answers the IPC message of the login item.
 * The query `settings` still gives the modes and the port, with the login item as login-item-failed, and setLoginItem
 * gives login-item-failed. Neither one gives the timeout of the whole action.
 */
async function silentParentPart(port) {
  await stopHost()
  await startHost(port, {}, { ipc: true })
  let up = await route('main', 'settings').catch(() => undefined)
  for (let i = 0; i < 100 && up?.body?.ok !== true; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    up = await route('main', 'settings').catch(() => undefined)
  }
  const started = Date.now()
  const read = await route('main', 'settings')
  const readMs = Date.now() - started
  const settings = read.body?.result
  check('with a parent that never answers, the query settings gives the modes and the port, and the login item as login-item-failed',
    read.status === 200 && read.body?.ok === true && settings?.modes?.ok === true && settings.port?.ok === true && typeof settings.port.port === 'number'
      && settings.loginItem?.ok === false && settings.loginItem.code === 'login-item-failed' && settings.loginItem.message.includes('unknown') && readMs < 5_000,
    JSON.stringify({ status: read.status, ms: readMs, modes: settings?.modes?.ok, port: settings?.port, loginItem: settings?.loginItem, error: read.body?.error }))
  const setAt = Date.now()
  const set = await route('main', 'setLoginItem', { open: true })
  const setMs = Date.now() - setAt
  check('with a parent that never answers, setLoginItem gives login-item-failed, not a timeout of the action',
    set.status === 200 && set.body?.ok === true && set.body.result?.ok === false && set.body.result.code === 'login-item-failed' && setMs < 5_000,
    JSON.stringify({ status: set.status, ms: setMs, body: set.body }))
}

/**
 * main_widget.widgets in safe mode: the agent widget SAFE_SLUG keeps the status safe-mode, and the field turnedOff
 * follows Turn off and Turn on.
 */
async function safeModePart(port) {
  await stopHost()
  await startHost(port, { DEEPWIDGETS_SAFE_MODE: '1' })
  let up = await route('main', 'widgets').catch(() => undefined)
  for (let i = 0; i < 100 && up?.body?.ok !== true; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 100))
    up = await route('main', 'widgets').catch(() => undefined)
  }
  await windowKeptPart()
  const first = await waitRows((rows) => rows.get(SAFE_SLUG)?.status?.kind === 'safe-mode')
  check('safe mode: the agent widget has the status safe-mode and no turnedOff', first.get(SAFE_SLUG)?.status?.kind === 'safe-mode' && first.get(SAFE_SLUG)?.turnedOff === undefined, JSON.stringify(first.get(SAFE_SLUG)))
  const off = await route('main', 'turnOff', { slug: SAFE_SLUG })
  const offRow = (await waitRows((rows) => rows.get(SAFE_SLUG)?.turnedOff === true)).get(SAFE_SLUG)
  check('safe mode: Turn off keeps the status safe-mode and sets turnedOff', off.body?.result?.ok === true && offRow?.status?.kind === 'safe-mode' && offRow.turnedOff === true && offRow.rows?.every((row) => row.enabled === false),
    JSON.stringify({ off: off.body, row: offRow }))
  const on = await route('main', 'turnOn', { slug: SAFE_SLUG })
  const onRow = (await waitRows((rows) => rows.get(SAFE_SLUG)?.turnedOff === undefined)).get(SAFE_SLUG)
  check('safe mode: Turn on keeps the status safe-mode and clears turnedOff', on.body?.result?.ok === true && onRow?.status?.kind === 'safe-mode' && onRow.turnedOff === undefined && onRow.rows?.every((row) => row.enabled === true),
    JSON.stringify({ on: on.body, row: onRow }))
}

let exitCode = 1
try {
  await hostPart()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-main: pass')
    exitCode = 0
  } else {
    console.log(`widgets-main: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-main: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  child?.kill('SIGKILL')
}
process.exit(exitCode)
