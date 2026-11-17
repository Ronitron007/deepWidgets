#!/usr/bin/env node
/**
 * Host check of the main widget (unit main.runtime, spec main_widget).
 * It boots the CLI host (web profile) on a free loopback port. An MCP SDK client does the token handshake with the
 * proof check of mcp.json, installs a test widget with widget_install, then checks:
 * - main_widget.widget: widget_list does not list main; widget_describe and widget_call on main give the error of a
 *   slug that does not exist; widget_changes gives no change of main; widget_install of the slug main gives slug-taken;
 *   the hello frame of GET /api/widgets/events does not name main;
 * - main_widget.catalog: GET program of sample gives the catalog shadcn-widgets@1, and of main deepwidgets-main@1;
 * - main_widget.widgets: the query `widgets` of main lists sample and the test widget with each field of the table,
 *   and no row for main; Turn off keeps the row with the status turned-off and the state; Turn on brings back the
 *   same state, for the built-in sample and for the test widget; Remove refuses sample; Remove removes the test
 *   widget, and its state stays in storage.
 * The calls of main go through POST /api/widgets/main/call with the host cookie, as the page of main calls them.
 * Prints `widgets-main: pass` and exits 0 only when every check passes.
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

const SLUG = 'main-check'
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
    off.body?.ok === true && off.body.result?.ok === true && offRow?.status?.kind === 'turned-off' && JSON.stringify(offRow.state) === JSON.stringify(before?.state)
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
  const offMain = await route('main', 'turnOff', { slug: 'main' })
  // main_widget.widgets: a refusal is the result of the action, with a code, not a handler-error with a code in its message.
  check('Turn off refuses main with the code unknown-widget', offMain.body?.ok === true && offMain.body.result?.ok === false && offMain.body.result.code === 'unknown-widget', JSON.stringify(offMain.body))

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

  const log = readFileSync(logPath, 'utf8')
  check('the host log has no refusal of the install records', !log.includes('can not use the install records') && !log.includes('can not run host code'), '')
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
