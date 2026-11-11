#!/usr/bin/env node
/**
 * Check of widget creation (unit widget.creation, spec widget_phase2.creation).
 *
 * Host part: it boots the CLI host (web profile) on a free loopback port. An MCP SDK client does the
 * token handshake with the proof check of mcp.json, then:
 * - widget_template and widget_guide give the template files and the guide;
 * - widget_install of the template: the widget shows in widget_list, and widget_call works;
 * - a second install of the slug replaces the bundle, and the state stays;
 * - widget_reload picks up an edited file;
 * - a reinstall that passes the gates and fails in the host is rolled back: the old bundle and the state stay;
 * - a bundle with a raw setTimeout, a globalThis., window., or self. timer, or an endless loop (also
 *   one with a break of a nested switch, in a .mts file) is refused by the lint gate;
 * - a bundle that calls fetch and console.log passes the gates;
 * - a bundle whose apply throws is refused by the test run gate;
 * - widget_remove removes the widget, and a new install gets the old state back and sets its new seed program;
 * - a host restart loads the agent widget again.
 * Modes (spec modes): widget_describe gives source for an installed widget; with modes.create false in the settings
 * file, widget_install, widget_reload, and widget_remove return mode-off and change no widget; true again works with
 * no restart; a file that does not parse turns no mode off.
 * Row names (unit widget.agent_rows, spec widget_phase2.creation.rows), read from the Loader over the host inspector:
 * - an agent bundle gets the row id deepwidgets-agent-<slug>;
 * - an install of the slug `sample` is refused with slug-taken, and the built-in sample stays live;
 * - a profile with an agent bundle of the older row id deepwidgets-widget-<slug> has one row after a
 *   reinstall of the slug, and the state stays;
 * - a bundle named deepwidgets-widget-<slug> from another folder is not the agent bundle: widget_remove keeps it;
 * - a crash in an agent widget is blamed on its deepwidgets-agent-<slug> row, and the next host start quarantines it.
 * Page gates (agent_library.build_gate), with the fixtures of tools/fixtures/page-widget.mjs:
 * - a bundle with a good page (components with zod schemas) installs in the CLI host with the warning that the render
 *   check was skipped. <profile>/deepwidgets-widgets/<slug>/page is a link to the build page-<hash>, with the base
 *   /widget/<slug>/;
 * - a replace with the same sources keeps the build; new sources get a new build, and a slug keeps its last 3 builds;
 * - the install refuses a page with a type error, an import of a package that is not on the list, an import of a file
 *   outside the page folder, a changed fixed file, a changed dw-core block, an @plugin, a postcss.config.mjs, and a
 *   symbolic link. The output fence refuses each page that pulls a secret file from outside page/: a stylesheet
 *   @import, also with no space and with a comment, a bare image-set() string, and new URL in a .tsx file. The old bundle and its page link stay, and no
 *   .tmp build or staging copy stays;
 * - a bundle with no page/ installs with the host gates only. The page link goes, and the builds stay.
 * Window part: it runs tools/smoke-desktop.mjs with DSH_SMOKE_CREATE set to a bundle with a good page and
 * DSH_SMOKE_CREATE_CASES set to render cases that install first: a page that loops forever (not-ready), a page whose
 * component throws (render-error), a page that overrides a dw-core style (lost-core-styles), and a page with no body
 * height and wide content (two warnings). The good page then passes the render check, and its window opens. Skip the
 * window part with WIDGETS_CREATE_DESKTOP=0. It needs the machine lock of the smoke checks.
 * Prints `widgets-create: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` (and the desktop build for the window part) first.
 */
import { spawn } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { cpSync, createWriteStream, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { pinnedFunction } from './in-host.mjs'
import { CHILD, LIBRARY, LOOPING_CHILD, LOST_STYLES, THROWING_LIBRARY, WARNING_STYLES, templateText, writePageWidget } from './fixtures/page-widget.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const requireFromMcp = createRequire(join(ROOT, 'deepwidgets/mcp/package.json'))
const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(requireFromMcp.resolve('@modelcontextprotocol/client')).href)

const work = await mkdtemp(join(process.env.WIDGETS_CREATE_TMP ?? tmpdir(), 'widgets-create-'))
const home = join(work, 'home')
const logPath = join(work, 'host.log')
const results = []
let child
let cookie = ''
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

async function startHost(port, env = {}) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  child = spawn(process.execPath, [`--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home, ...env },
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
  // The login cookie, for the program route of the runtime.
  const login = await fetch(url, { redirect: 'manual' })
  cookie = login.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
}

/** The program text that the runtime serves for `slug`. */
async function programText(port, slug) {
  const answer = await fetch(`http://127.0.0.1:${String(port)}/api/widgets/${slug}/program`, { headers: { cookie } })
  return (await answer.json().catch(() => null))?.text ?? `(status ${String(answer.status)})`
}

async function stopHost() {
  if (child === undefined || child.exitCode !== null) return
  const exited = new Promise((resolve) => child.once('exit', resolve))
  child.kill('SIGTERM')
  const timer = setTimeout(() => child.kill('SIGKILL'), 10_000)
  await exited
  clearTimeout(timer)
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

/** The Loader row ids of the bundles of `slug`: the agent row and the built-in (or older agent) row. */
const rowsOf = (slug) => inHost('return [...loader.entries()].map((entry) => entry.options.id).filter((id) => id === `deepwidgets-agent-${arg}` || id === `deepwidgets-agent-${arg}.b` || id === `deepwidgets-widget-${arg}`).sort()', slug)

/**
 * Install the local bundle folder `folder` with the plugin manager of the host. It runs outside the hmr transaction
 * store of the inspector call, as DSH watchConfig does, so it does not nest in a running transaction.
 */
const installInHost = (folder) => inHost(`
  const manager = loader.ctx.get('pluginManager')
  const hmr = loader.ctx.get('hmr')
  const run = () => manager.installBundle(arg)
  // A host with hmr must have the exit; without it the install can nest in a running transaction.
  if (hmr !== undefined && typeof hmr.executing?.exit !== 'function') throw new Error('the hmr service has no executing.exit')
  const result = hmr === undefined ? await run() : await hmr.executing.exit(run)
  return { application: result.application, error: result.error }`, folder)

/** The handshake of mcp_readme.handshake: a token only from a server that proves the nonce of mcp.json. */
async function connect(base) {
  const portFile = join(home, 'deepwidgets', 'mcp.json')
  let answer
  for (let i = 0; i < 120; i += 1) {
    const challenge = randomBytes(16).toString('base64url')
    answer = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'Create Check', challenge }) }).catch(() => undefined)
    if (answer?.status === 200) {
      const issued = await answer.json()
      const { nonce } = JSON.parse(readFileSync(portFile, 'utf8'))
      if (createHmac('sha256', nonce).update(challenge).digest('hex') !== issued.proof) throw new Error('the server did not prove the nonce of mcp.json')
      const client = new Client({ name: 'widgets-create-check', version: '0.0.0' })
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

/** Write the template files of `slug` into `work/agent/<name>`, with `edit` applied to src/index.ts. */
function writeWidget(name, files, edit = (text) => text) {
  const dir = join(work, 'agent', name)
  for (const file of files) {
    const path = join(dir, file.path)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, file.path === 'src/index.ts' ? edit(file.text) : file.text)
  }
  return dir
}

const applyLine = 'export function apply(ctx: WidgetContext): void {'
const addToApply = (code) => (text) => {
  if (!text.includes(applyLine)) throw new Error('the template changed: no apply line')
  return text.replace(applyLine, `${applyLine}\n  ${code}`)
}
const addAction = (action) => (text) => text.replace("      { name: 'reset',", `      ${action},\n      { name: 'reset',`)

const SLUG = 'create-check'
/** A Loader entry id ends with the row id of its options, as in tools/widgets-blame.mjs. */
const isRow = (row, id) => typeof row === 'string' && (row === id || row.endsWith(`:${id}`))

async function hostPart() {
  const port = await freePort()
  inspectPort = await freePort()
  const base = `http://127.0.0.1:${String(port)}`
  console.log(`widgets-create: work folder ${work}, port ${String(port)}`)
  await startHost(port)
  let client = await connect(base)
  const call = async (name, args = {}) => {
    const answer = await client.callTool({ name, arguments: args })
    return { isError: answer.isError === true, body: body(answer) }
  }
  const slugs = async () => (await call('widget_list')).body?.widgets?.map((widget) => widget.slug) ?? []
  try {
    const tools = (await client.listTools()).tools.map((tool) => tool.name).sort()
    const want = ['deepwidgets_modes', 'widget_call', 'widget_changes', 'widget_describe', 'widget_guide', 'widget_install', 'widget_list', 'widget_reload', 'widget_remove', 'widget_template']
    check('tools/list has deepwidgets_modes, the four interact tools, and the five create tools', JSON.stringify(tools) === JSON.stringify(want), JSON.stringify(tools))

    const guide = await call('widget_guide', { mode: 'create' })
    const text = guide.body?.guide ?? ''
    check('widget_guide gives the widget API types and the OpenUI guide of the component set', !guide.isError && text.includes('interface WidgetContext') && text.includes('Card(') && text.includes('shadcn-widgets@1'), `${String(text.length)} characters`)
    const chat = ['@ToAssistant', '@OpenUrl', 'ENTIRE response'].filter((part) => text.includes(part))
    check('widget_guide has no chat preamble and no steps that the shell ignores', chat.length === 0, JSON.stringify(chat))

    const template = await call('widget_template', { slug: SLUG, title: 'Create Check' })
    const files = template.body?.files ?? []
    check('widget_template gives src/index.ts with the slug filled in', !template.isError && files.length === 1 && files[0].path === 'src/index.ts' && files[0].text.includes(`'${SLUG}'`), JSON.stringify(files.map((file) => file.path)))

    check('widget_template and its src/index.ts name the create mode for widget_guide', /widget_guide with mode "create"/.test(template.body?.nextStep ?? '') && /widget_guide with mode "create"/.test(files[0]?.text ?? ''), JSON.stringify(template.body?.nextStep))

    const dir = writeWidget(SLUG, files)
    const started = Date.now()
    const installed = await call('widget_install', { dir })
    check('widget_install of the template passes the gates and applies', !installed.isError && installed.body?.slug === SLUG && installed.body?.application === 'applied' && installed.body?.gates?.map((gate) => gate.gate).join() === 'compile,lint,test',
      `${String(Date.now() - started)} ms ${JSON.stringify(installed.body)}`)
    check('widget_list shows the installed widget', (await slugs()).includes(SLUG), JSON.stringify(await slugs()))
    const agentRows = await rowsOf(SLUG)
    check('an agent bundle gets the row id deepwidgets-agent-<slug>', JSON.stringify(agentRows) === JSON.stringify([`deepwidgets-agent-${SLUG}`]), JSON.stringify(agentRows))

    // The built-in sample has the row deepwidgets-widget-sample. An agent bundle of the slug is refused.
    const clash = await call('widget_install', { dir: writeWidget('create-sample', files, (text) => text.replaceAll(`'${SLUG}'`, "'sample'")) })
    const sampleRows = await rowsOf('sample')
    const sample = await call('widget_call', { slug: 'sample', action: 'get' })
    check('an install of the slug sample is refused with slug-taken', clash.isError && clash.body?.error?.code === 'slug-taken', JSON.stringify(clash.body))
    check('the built-in sample stays live on its own row', JSON.stringify(sampleRows) === JSON.stringify(['deepwidgets-widget-sample']) && !sample.isError && typeof sample.body?.result?.count === 'number' && (await call('widget_describe', { slug: 'sample' })).body?.failed === undefined,
      `rows=${JSON.stringify(sampleRows)} get=${JSON.stringify(sample.body)}`)
    const described = await call('widget_describe', { slug: SLUG })
    const addArgs = described.body?.actions?.find((action) => action.name === 'add')?.args
    check('widget_describe gives the zod args of the bundle as JSON Schema', addArgs?.type === 'object' && addArgs?.properties?.by?.type === 'integer', JSON.stringify(described.body?.actions))
    const added = await call('widget_call', { slug: SLUG, action: 'add', args: { by: 2 }, requestId: 'create-1' })
    const read = await call('widget_call', { slug: SLUG, action: 'get' })
    check('widget_call add and get work on the installed widget', !added.isError && read.body?.result?.count === 2, JSON.stringify([added.body, read.body]))
    check('widget_describe gives source, the absolute install folder, for an installed widget', described.body?.source === dir, JSON.stringify(described.body?.source))
    await modesPart(call, slugs, files, dir)

    // A second install of the slug: a new action and a new seed program. The state stays.
    const replaced = await call('widget_install', { dir: writeWidget(`${SLUG}-v2`, files, (text) => addAction("{ name: 'double', kind: 'mutation', handler: (_args, w) => w.update((state) => ({ count: state.count * 2 })) }")(text).replace('"A counter"', '"A counter v2"')) })
    const replacedActions = (await call('widget_describe', { slug: SLUG })).body?.actions?.map((action) => action.name) ?? []
    const afterReplace = await call('widget_call', { slug: SLUG, action: 'get' })
    check('a second install of the slug replaces the bundle; the state stays', !replaced.isError && replaced.body?.replaced === true && replacedActions.includes('double') && afterReplace.body?.result?.count === 2,
      `${JSON.stringify(replaced.body)} actions=${JSON.stringify(replacedActions)} count=${String(afterReplace.body?.result?.count)}`)
    check('the replace sets the new seed program', replaced.body?.programUpdated === true, JSON.stringify(replaced.body?.programUpdated))

    // widget_reload reads the folder of the last install again.
    writeWidget(`${SLUG}-v2`, files, (text) => addAction("{ name: 'triple', kind: 'mutation', handler: (_args, w) => w.update((state) => ({ count: state.count * 3 })) }")(text))
    const reloaded = await call('widget_reload', { slug: SLUG })
    const tripled = await call('widget_call', { slug: SLUG, action: 'triple', requestId: 'create-2' })
    check('widget_reload picks up the edited file', !reloaded.isError && tripled.body?.result?.count === 6, JSON.stringify([reloaded.body, tripled.body]))

    // A reinstall that passes the gates (the stand-in widgets service of the test run has no
    // setProgram) and throws in the host. The old bundle comes back with its actions and state.
    const broken = await call('widget_install', { dir: writeWidget(`${SLUG}-broken`, files, (text) => addAction("{ name: 'broken', kind: 'query', handler: () => 0 }")(addToApply("if ('setProgram' in ctx.widgets) throw new Error('host only failure')")(text))) })
    const rolledActions = (await call('widget_describe', { slug: SLUG })).body?.actions?.map((action) => action.name) ?? []
    const rolledState = await call('widget_call', { slug: SLUG, action: 'get' })
    check('a reinstall that fails in the host is rolled back: the old actions and the state stay', broken.isError && broken.body?.error?.code === 'install-failed' && rolledActions.includes('triple') && !rolledActions.includes('broken') && rolledState.body?.result?.count === 6,
      `${JSON.stringify(broken.body?.error?.code)} actions=${JSON.stringify(rolledActions)} state=${JSON.stringify(rolledState.body)}`)

    const timer = await call('widget_install', { dir: writeWidget('create-timer', files, (text) => addToApply("setTimeout(() => { ctx.logger.info('tick') }, 10)")(text).replaceAll(`'${SLUG}'`, "'create-timer'")) })
    const timerError = timer.body?.error
    check('a bundle with a raw setTimeout is refused by the lint gate', timer.isError && timerError?.code === 'gate-failed' && timerError?.gate === 'lint' && timerError?.diagnostics?.some((line) => line.includes('setTimeout')) && typeof timerError?.nextStep === 'string',
      JSON.stringify(timerError))
    // A type error: tsgolint prints it with the real path of the staging folder.
    const typed = await call('widget_install', { dir: writeWidget('create-type', files, (text) => addToApply("const wrong: number = 'text'\n  ctx.logger.info(wrong)")(text).replaceAll(`'${SLUG}'`, "'create-type'")) })
    const typeLines = (typed.body?.error?.diagnostics ?? []).filter((line) => /^\S+:\d+:\d+: /.test(line))
    check('the gate diagnostics name the files relative to the source folder', typed.body?.error?.gate === 'lint' && typeLines.some((line) => line.includes('TS2322')) && typeLines.every((line) => line.startsWith('src/')), JSON.stringify(typed.body?.error?.diagnostics))

    const globalTimer = await call('widget_install', { dir: writeWidget('create-global-timer', files, (text) => addToApply("globalThis.setTimeout(() => { ctx.logger.info('tick') }, 10)\n  window.setInterval(() => { ctx.logger.info('tick') }, 10)\n  self.setTimeout(() => { ctx.logger.info('tick') }, 10)")(text).replaceAll(`'${SLUG}'`, "'create-global-timer'")) })
    const globalError = globalTimer.body?.error
    const banned = (globalError?.diagnostics ?? []).filter((line) => line.includes('no-restricted-properties'))
    check('a bundle with globalThis.setTimeout, window.setInterval, and self.setTimeout is refused by the lint gate', globalTimer.isError && globalError?.gate === 'lint' && banned.length === 3, JSON.stringify(globalError))

    // The web globals stay typed: fetch (a closed loopback port, so no network) and console.
    const webDir = writeWidget('create-web', files, (text) => addAction("{ name: 'load', kind: 'query', handler: async () => { const answer = await fetch(new URL('http://127.0.0.1:9/')).catch(() => undefined); return answer?.status ?? 0 } }")(addToApply("console.log('create-web', new TextEncoder().encode('a').length)")(text)).replaceAll(`'${SLUG}'`, "'create-web'"))
    const web = await call('widget_install', { dir: webDir })
    check('a bundle that calls fetch and console.log passes the gates', !web.isError && web.body?.application === 'applied', JSON.stringify(web.body?.error ?? web.body?.gates))
    if (!web.isError) await call('widget_remove', { slug: 'create-web' })

    const looper = await call('widget_install', { dir: writeWidget('create-loop', files, (text) => addToApply('let spins = 0\n  while (true) { spins += 1 }')(text).replaceAll(`'${SLUG}'`, "'create-loop'")) })
    const loopError = looper.body?.error
    check('a bundle with while (true) and no exit is refused by the lint gate', looper.isError && loopError?.gate === 'lint' && loopError?.diagnostics?.some((line) => line.includes('no-endless-loop')), JSON.stringify(loopError))

    // The break leaves only the switch. The loop is in a .mts file and runs late, past the test window.
    const mtsDir = writeWidget('create-loop-mts', files, (text) => `import { spin } from './spin.mjs'\n${addToApply('ctx.timeout(() => { spin(1) }, 2_000)')(text).replaceAll(`'${SLUG}'`, "'create-loop-mts'")}`)
    writeFileSync(join(mtsDir, 'src', 'spin.mts'), 'export function spin(n: number): void {\n  while (true) {\n    switch (n) {\n      case -1: break\n    }\n  }\n}\n')
    const mtsLoop = await call('widget_install', { dir: mtsDir })
    const mtsError = mtsLoop.body?.error
    check('a .mts loop whose only break leaves a nested switch is refused by the lint gate', mtsLoop.isError && mtsError?.gate === 'lint' && mtsError?.diagnostics?.some((line) => line.startsWith('src/spin.mts:') && line.includes('no-endless-loop')), JSON.stringify(mtsError))

    const thrower = await call('widget_install', { dir: writeWidget('create-throw', files, (text) => addToApply("if (Date.now() > 0) throw new Error('apply broke on purpose')")(text).replaceAll(`'${SLUG}'`, "'create-throw'")) })
    const throwError = thrower.body?.error
    check('a bundle whose apply throws is refused by the test run gate', thrower.isError && throwError?.code === 'gate-failed' && throwError?.gate === 'test' && throwError?.diagnostics?.some((line) => line.includes('apply broke on purpose')),
      JSON.stringify(throwError))
    const listed = await slugs()
    check('refused bundles never reach the host', !listed.includes('create-timer') && !listed.includes('create-throw'), JSON.stringify(listed))

    const removed = await call('widget_remove', { slug: SLUG })
    check('widget_remove removes the widget', !removed.isError && !(await slugs()).includes(SLUG), JSON.stringify(removed.body))
    const notAgent = await call('widget_remove', { slug: 'sample' })
    check('widget_remove refuses a widget that is not an agent bundle', notAgent.isError && notAgent.body?.error?.code === 'not-installed', JSON.stringify(notAgent.body))
    // The new install has a new seed program. The remove kept the stored program of the replace (v2).
    const back = await call('widget_install', { dir: writeWidget(`${SLUG}-v3`, files, (text) => text.replace('"A counter"', '"A counter v3"')) })
    const kept = await call('widget_call', { slug: SLUG, action: 'get' })
    check('a new install after the remove gets the stored state back', !back.isError && kept.body?.result?.count === 6, JSON.stringify([back.body?.application, kept.body]))
    const servedV3 = await programText(port, SLUG)
    check('a new install after the remove sets its new seed program', back.body?.programUpdated === true && servedV3.includes('A counter v3'), `programUpdated=${JSON.stringify(back.body?.programUpdated)} program=${servedV3.slice(0, 120)}`)
    const same = await call('widget_install', { dir: join(work, 'agent', `${SLUG}-v3`) })
    check('a reinstall of the same seed program leaves the stored program alone', !same.isError && same.body?.replaced === true && same.body?.programUpdated === false, JSON.stringify(same.body?.programUpdated))

    await legacyPart(call, slugs)
    await foreignPart(call)
    await pagePart(call, slugs)
  } finally {
    await client.close()
  }

  // A host start loads the installed bundle from the profile again.
  await stopHost()
  await startHost(port)
  client = await connect(base)
  try {
    check('after a host restart the agent widget loads at start with its state', (await slugs()).includes(SLUG) && (await call('widget_call', { slug: SLUG, action: 'get' })).body?.result?.count === 6, JSON.stringify(await slugs()))

    // An unhandled rejection in an agent widget ends the host. The test run gate skips the action: its args refuse {}.
    const crashSlug = 'create-crash'
    const crashDir = writeWidget(crashSlug, [{ path: 'src/index.ts', text: readFileSync(join(work, 'agent', SLUG, 'src', 'index.ts'), 'utf8') }], (text) =>
      addAction("{ name: 'crash', kind: 'mutation', args: z.object({ now: z.literal(true) }), handler: () => { void Promise.reject(new Error('agent crash on purpose')); return 0 } }")(text).replaceAll(`'${SLUG}'`, `'${crashSlug}'`))
    const crashInstall = await call('widget_install', { dir: crashDir })
    if (crashInstall.isError) throw new Error(`the install of ${crashSlug} failed: ${JSON.stringify(crashInstall.body)}`)
    const exited = new Promise((resolve) => { if (child.exitCode !== null) resolve(); else child.once('exit', resolve) })
    await call('widget_call', { slug: crashSlug, action: 'crash', args: { now: true }, requestId: 'crash-1' }).catch(() => undefined)
    const ended = await Promise.race([exited.then(() => true), new Promise((resolve) => setTimeout(() => resolve(false), 15_000))])
    let record = null
    try { record = JSON.parse(readFileSync(join(home, 'deepwidgets', 'crash.json'), 'utf8')) } catch { /* no record */ }
    check('a crash in an agent widget is blamed on its deepwidgets-agent-<slug> row', ended && isRow(record?.row, `deepwidgets-agent-${crashSlug}`), `exited=${String(ended)} record=${JSON.stringify(record)}`)
  } finally {
    await client.close().catch(() => undefined)
  }
  await stopHost()
  await startHost(port)
  client = await connect(base)
  try {
    const listed = (await call('widget_list')).body?.widgets ?? []
    const crashed = listed.find((widget) => widget.slug === 'create-crash')
    check('the next host start quarantines the blamed agent widget', typeof crashed?.failed === 'string', JSON.stringify(crashed))
  } finally {
    await client.close()
  }
  await stopHost()
  return readFileSync(join(work, 'agent', `${SLUG}-v3`, 'src', 'index.ts'), 'utf8')
}

const GATED = 'create-gated'

/**
 * The gate of the mode create (spec modes, modes.refusal). With `{ "modes": { "create": false } }`, widget_install,
 * widget_reload, and widget_remove return mode-off and change no widget. widget_template and widget_guide still answer.
 * After the file goes back to true, widget_install works with no restart. A file that does not parse turns no mode off.
 */
async function modesPart(call, slugs, files, dir) {
  const settingsFile = join(home, 'deepwidgets', 'settings.json')
  const gatedDir = writeWidget(GATED, files, (text) => text.replaceAll(`'${SLUG}'`, `'${GATED}'`))
  const snapshot = async () => ({
    slugs: (await slugs()).sort(),
    rows: await rowsOf(SLUG),
    state: (await call('widget_call', { slug: SLUG, action: 'get' })).body?.result,
    actions: (await call('widget_describe', { slug: SLUG })).body?.actions?.map((action) => action.name),
  })
  const before = await snapshot()

  writeFileSync(settingsFile, `${JSON.stringify({ modes: { create: false } })}\n`)
  const modes = (await call('deepwidgets_modes')).body
  check('with modes.create false, deepwidgets_modes shows create off', modes?.modes?.find((mode) => mode.name === 'create')?.on === false, JSON.stringify(modes?.modes))
  const refused = {
    install: await call('widget_install', { dir: gatedDir }),
    reinstall: await call('widget_install', { dir }),
    reload: await call('widget_reload', { slug: SLUG }),
    remove: await call('widget_remove', { slug: SLUG }),
  }
  for (const [name, answer] of Object.entries(refused)) {
    const error = answer.body?.error
    check(`with create off, ${name} returns mode-off naming the mode, the setting, and the settings file`,
      answer.isError && error?.code === 'mode-off' && error.mode === 'create' && error.setting === 'modes.create' && error.settingsFile === settingsFile
        && error.message.includes('create') && error.message.includes('modes.create') && error.message.includes(settingsFile) && /ask the user/i.test(error.nextStep ?? ''),
      JSON.stringify(answer.body))
  }
  const after = await snapshot()
  check('with create off, no widget changes', JSON.stringify(after) === JSON.stringify(before) && !after.slugs.includes(GATED), `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`)
  const template = await call('widget_template', { slug: GATED })
  const guide = await call('widget_guide', { mode: 'create' })
  check('with create off, widget_template and widget_guide still answer', !template.isError && template.body?.files?.length === 1 && !guide.isError && typeof guide.body?.guide === 'string', JSON.stringify([template.isError, guide.isError]))

  writeFileSync(settingsFile, `${JSON.stringify({ modes: { create: true } })}\n`)
  const back = await call('widget_install', { dir: gatedDir })
  check('after modes.create goes back to true, widget_install works with no restart', !back.isError && back.body?.slug === GATED && (await slugs()).includes(GATED), JSON.stringify(back.body?.error ?? back.body?.application))

  // modes.settings: a missing key means that each mode is on.
  for (const content of [{}, { modes: {} }]) {
    writeFileSync(settingsFile, `${JSON.stringify(content)}\n`)
    const shown = (await call('deepwidgets_modes')).body
    const again = await call('widget_install', { dir: gatedDir })
    check(`with the settings file ${JSON.stringify(content)}, create is on and widget_install is not refused`,
      shown?.modes?.find((mode) => mode.name === 'create')?.on === true && shown?.settingsError === undefined && !again.isError && again.body?.slug === GATED,
      JSON.stringify([shown?.modes?.find((mode) => mode.name === 'create'), again.body?.error ?? again.body?.application]))
  }

  writeFileSync(settingsFile, '{ "modes": { "create": false')
  const broken = (await call('deepwidgets_modes')).body
  const removed = await call('widget_remove', { slug: GATED })
  check('a settings file that does not parse turns no mode off: deepwidgets_modes reports the error, and widget_remove works',
    broken?.modes?.every((mode) => mode.on === true) === true && typeof broken?.settingsError === 'string' && !removed.isError && !(await slugs()).includes(GATED),
    JSON.stringify([broken, removed.body]))
  rmSync(settingsFile)
}

const LEGACY = 'create-legacy'

/**
 * A profile with an agent bundle of the older row id deepwidgets-widget-<slug>. The check makes it from an install
 * of the slug: it keeps a copy of the bundle folder, removes the bundle, renames the copy, and installs it with the
 * plugin manager. Then a reinstall of the slug leaves one row, and the state. The older bundle uses the folder of the
 * current name, so the new version goes under the second name deepwidgets-agent-<slug>.b (widget_fv.replace).
 */
async function legacyPart(call, slugs) {
  const source = writeWidget(LEGACY, [{ path: 'src/index.ts', text: readFileSync(join(work, 'agent', SLUG, 'src', 'index.ts'), 'utf8').replaceAll(`'${SLUG}'`, `'${LEGACY}'`) }])
  const first = await call('widget_install', { dir: source })
  if (first.isError) throw new Error(`the install of ${LEGACY} failed: ${JSON.stringify(first.body)}`)
  const profileDir = await inHost("return loader.ctx.get('pluginManager').profile.dir")
  const folder = join(profileDir, 'deepwidgets-widgets', LEGACY)
  const copy = join(work, 'legacy-bundle')
  cpSync(folder, copy, { recursive: true })
  const removed = await call('widget_remove', { slug: LEGACY })
  if (removed.isError) throw new Error(`the remove of ${LEGACY} failed: ${JSON.stringify(removed.body)}`)
  const oldName = `deepwidgets-widget-${LEGACY}`
  rmSync(folder, { recursive: true, force: true })
  cpSync(copy, folder, { recursive: true })
  const manifest = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'))
  writeFileSync(join(folder, 'package.json'), `${JSON.stringify({ ...manifest, name: oldName }, null, 2)}\n`)
  writeFileSync(join(folder, 'cordis.patch.yml'), ['- insert:', `    - id: ${oldName}`, `      name: ${oldName}`, ''].join('\n'))
  const seeded = await installInHost(folder)
  let live = false
  for (let i = 0; i < 50 && !live; i += 1) {
    live = (await slugs()).includes(LEGACY)
    if (!live) await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const seededRows = await rowsOf(LEGACY)
  const added = await call('widget_call', { slug: LEGACY, action: 'add', args: { by: 5 }, requestId: 'legacy-1' })
  check('the seeded profile has an agent bundle with the older row id', seeded?.application === 'applied' && live && JSON.stringify(seededRows) === JSON.stringify([oldName]) && added.body?.result?.count === 5,
    `install=${JSON.stringify(seeded)} live=${String(live)} rows=${JSON.stringify(seededRows)} add=${JSON.stringify(added.body)}`)

  const again = await call('widget_install', { dir: source })
  const rows = await rowsOf(LEGACY)
  const kept = await call('widget_call', { slug: LEGACY, action: 'get' })
  const dependencies = Object.keys(JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')).dependencies ?? {}).filter((name) => name.endsWith(`-${LEGACY}`) || name.endsWith(`-${LEGACY}.b`))
  check('a reinstall over the older row id leaves one row, deepwidgets-agent-<slug>.b', !again.isError && again.body?.replaced === true && JSON.stringify(rows) === JSON.stringify([`deepwidgets-agent-${LEGACY}.b`]) && JSON.stringify(dependencies) === JSON.stringify([`deepwidgets-agent-${LEGACY}.b`]),
    `install=${JSON.stringify(again.body?.error ?? again.body?.replaced)} rows=${JSON.stringify(rows)} dependencies=${JSON.stringify(dependencies)}`)
  check('a reinstall over the older row id keeps the state', kept.body?.result?.count === 5, JSON.stringify(kept.body))
}

const FOREIGN = 'create-foreign'

/**
 * A bundle with the older row name deepwidgets-widget-<slug> that is not from the agent folder. It is a plain plugin
 * with no widget. widget_remove of the agent widget <slug> removes only the agent bundle.
 */
async function foreignPart(call) {
  const source = writeWidget(FOREIGN, [{ path: 'src/index.ts', text: readFileSync(join(work, 'agent', SLUG, 'src', 'index.ts'), 'utf8').replaceAll(`'${SLUG}'`, `'${FOREIGN}'`) }])
  const agent = await call('widget_install', { dir: source })
  if (agent.isError) throw new Error(`the install of ${FOREIGN} failed: ${JSON.stringify(agent.body)}`)
  const foreignName = `deepwidgets-widget-${FOREIGN}`
  const folder = join(work, 'foreign-bundle')
  mkdirSync(folder, { recursive: true })
  writeFileSync(join(folder, 'package.json'), `${JSON.stringify({ name: foreignName, version: '1.0.0', private: true, type: 'module', exports: './index.js', dsh: { bundle: { patch: './cordis.patch.yml' } } }, null, 2)}\n`)
  writeFileSync(join(folder, 'index.js'), "export const name = 'foreign-plugin'\nexport function apply() {}\n")
  writeFileSync(join(folder, 'cordis.patch.yml'), ['- insert:', `    - id: ${foreignName}`, `      name: ${foreignName}`, ''].join('\n'))
  const foreign = await installInHost(folder)
  const both = await rowsOf(FOREIGN)
  check('the profile has the agent bundle and a foreign bundle with the older row name', foreign?.application === 'applied' && JSON.stringify(both) === JSON.stringify([`deepwidgets-agent-${FOREIGN}`, foreignName]),
    `install=${JSON.stringify(foreign)} rows=${JSON.stringify(both)}`)

  const removed = await call('widget_remove', { slug: FOREIGN })
  const rows = await rowsOf(FOREIGN)
  const profileDir = await inHost("return loader.ctx.get('pluginManager').profile.dir")
  const dependencies = Object.keys(JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8')).dependencies ?? {}).filter((name) => name.endsWith(`-${FOREIGN}`))
  check('widget_remove of the agent widget keeps the foreign bundle with the older row name', !removed.isError && JSON.stringify(rows) === JSON.stringify([foreignName]) && JSON.stringify(dependencies) === JSON.stringify([foreignName]),
    `remove=${JSON.stringify(removed.body)} rows=${JSON.stringify(rows)} dependencies=${JSON.stringify(dependencies)}`)
}

const PAGE = 'create-page'
const PAGE_GATES = 'compile,lint,test,page-files,page-types,page-build,page-render'
const BUILD = /^page-[0-9a-f]{16}$/

/** The builds page-<hash> in the folder of a slug, and the leftovers of the gates: .tmp builds. */
function pageEntries(slugDir) {
  const names = existsSync(slugDir) ? readdirSync(slugDir) : []
  return { builds: names.filter((name) => BUILD.test(name)).sort(), tmp: names.filter((name) => name.endsWith('.tmp')) }
}

/** The target of the page link of a slug, or null when the link is not there. */
function linkTarget(pageDir) {
  try { return lstatSync(pageDir).isSymbolicLink() ? readlinkSync(pageDir) : 'not a link' } catch { return null }
}

/**
 * The page gates (agent_library.build_gate) in the CLI host. The render check does not run here: the install answer
 * has the warning that it was skipped. The window part checks the render check in the desktop app.
 */
async function pagePart(call, slugs) {
  const profileDir = await inHost("return loader.ctx.get('pluginManager').profile.dir")
  const slugDir = join(profileDir, 'deepwidgets-widgets', PAGE)
  const pageDir = join(slugDir, 'page')
  const staging = join(profileDir, 'deepwidgets-widgets', '.page-staging')
  const good = await call('widget_install', { dir: writePageWidget(join(work, 'agent', PAGE), PAGE) })
  const index = existsSync(join(pageDir, 'index.html')) ? readFileSync(join(pageDir, 'index.html'), 'utf8') : ''
  check('a bundle with a good page, whose components have zod schemas, passes the page gates in the CLI host', !good.isError && good.body?.application === 'applied' && good.body?.gates?.map((gate) => gate.gate).join() === PAGE_GATES && (await slugs()).includes(PAGE) && LIBRARY.includes('z.object('),
    JSON.stringify(good.body?.error ?? good.body?.gates?.map((gate) => [gate.gate, gate.ok, gate.diagnostics])))
  check('in a CLI host, the install answer has the warning that the render check was skipped', good.body?.warnings?.some((line) => line.includes('render check') && line.includes('skipped')) === true, JSON.stringify(good.body?.warnings))
  const first = linkTarget(pageDir)
  check('<profile>/deepwidgets-widgets/<slug>/page is a link to the build page-<hash>, with the base /widget/<slug>/', good.body?.page === pageDir && BUILD.test(first ?? '') && index.includes(`/widget/${PAGE}/assets/`),
    `page=${JSON.stringify(good.body?.page)} link=${String(first)} index=${index.slice(0, 300)}`)

  // A replace puts the new version under the second name, in <slug>.b. The same sources keep their build.
  const again = await call('widget_install', { dir: join(work, 'agent', PAGE) })
  check('a replace with the same sources keeps the build and the link', !again.isError && again.body?.replaced === true && linkTarget(pageDir) === first && pageEntries(slugDir).builds.length === 1 && !existsSync(join(`${slugDir}.b`, 'page')),
    JSON.stringify(again.body?.error ?? pageEntries(slugDir)))
  // Four new sources: each gets a new build, and the slug keeps the last 3 builds.
  let last = first
  for (const round of [1, 2, 3, 4]) {
    const answer = await call('widget_install', { dir: writePageWidget(join(work, 'agent', `${PAGE}-v${String(round)}`), PAGE, { 'page/library.tsx': `${LIBRARY}// round ${String(round)}\n` }) })
    if (answer.isError) throw new Error(`the page install round ${String(round)} failed: ${JSON.stringify(answer.body)}`)
    last = linkTarget(pageDir)
  }
  const kept = pageEntries(slugDir)
  check('new sources get a new build, the link swaps to it, and the slug keeps its last 3 builds', BUILD.test(last ?? '') && last !== first && kept.builds.length === 3 && kept.builds.includes(last ?? '') && !kept.builds.includes(first ?? ''),
    `link=${String(last)} builds=${JSON.stringify(kept.builds)}`)
  const before = readFileSync(join(pageDir, 'index.html'), 'utf8')

  const outside = join(work, 'outside.ts')
  writeFileSync(outside, 'export const outside = 1\n')
  // Secret files in the widget root. From the staging copy of page/, ../../../ is the widget root.
  const widgetRoot = join(profileDir, 'deepwidgets-widgets')
  writeFileSync(join(widgetRoot, 'secret-page.css'), '.secret-leak { color: red; }\n')
  writeFileSync(join(widgetRoot, 'secret-page.txt'), 'SECRET-PAGE-TEXT')
  const pulls = (line) => line.includes('outside the page folder') && line.includes('secret-page.')
  const sheet = (text) => ({ 'page/extra.css': `${text}\n.extra { color: blue; }\n`, 'page/child.tsx': `import './extra.css'\n${CHILD}` })
  const styles = templateText('styles.css')
  const refused = [
    { name: 'a page with a type error', gate: 'page-types', files: { 'page/child.tsx': `${CHILD}\nexport const wrong: number = 'text'\n` }, find: (line) => line.startsWith('page/child.tsx:') && line.includes('TS2322') },
    { name: 'a page that imports a package that is not on the list', gate: 'page-types', files: { 'page/child.tsx': `import { BarChart } from 'recharts'\n${CHILD}\nexport const chart = BarChart\n` }, find: (line) => line.includes("'recharts'") && line.includes('TS2307') },
    { name: 'a page that imports a file outside the page folder', gate: 'page-build', files: { 'page/child.tsx': `import { outside } from '${outside}'\n${CHILD}\nexport const value = outside\n` }, find: (line) => line.includes('outside the page folder') },
    { name: 'a page with a changed fixed file', gate: 'page-files', files: { 'page/main.tsx': `${templateText('main.tsx')}// changed\n` }, find: (line) => line.startsWith('page/main.tsx:') },
    { name: 'a page with a changed dw-core block', gate: 'page-files', files: { 'page/styles.css': styles.replace('padding: 12px !important; box-sizing', 'padding: 0 !important; box-sizing') }, find: (line) => line.startsWith('page/styles.css:') && line.includes('dw-core') },
    { name: 'a stylesheet @import of a secret file', gate: 'page-build', files: sheet('@import "../../../secret-page.css";'), find: pulls },
    { name: 'a stylesheet @import of a secret file with no space', gate: 'page-build', files: sheet('@import"../../../secret-page.css";'), find: pulls },
    { name: 'a stylesheet @import of a secret file with a comment', gate: 'page-build', files: sheet('@import/**/"../../../secret-page.css";'), find: pulls },
    { name: 'a bare image-set() string of a secret file', gate: 'page-build', files: { 'page/styles.css': `${styles}.leak { background-image: image-set("../../../secret-page.txt" 1x); }\n` }, find: pulls },
    { name: 'new URL of a secret file in a .tsx file', gate: 'page-build', files: { 'page/child.tsx': `${CHILD}\nexport const leak = new URL('../../../secret-page.txt', import.meta.url).href\n` }, find: pulls },
    { name: 'an @plugin in a page stylesheet', gate: 'page-build', files: { 'page/styles.css': `${styles}@plugin "@tailwindcss/typography";\n` }, find: (line) => line.startsWith('page/styles.css:') && line.includes('@plugin') },
    { name: 'a page with a postcss.config.mjs', gate: 'page-build', files: { 'page/postcss.config.mjs': 'export default { plugins: {} }\n' }, find: (line) => line.startsWith('page/postcss.config.mjs:') },
  ]
  for (const [index, item] of refused.entries()) {
    const answer = await call('widget_install', { dir: writePageWidget(join(work, 'agent', `${PAGE}-bad-${String(index)}`), PAGE, item.files) })
    const error = answer.body?.error
    check(`the install refuses ${item.name} (gate ${item.gate})`, answer.isError && error?.code === 'gate-failed' && error?.gate === item.gate && error?.diagnostics?.some(item.find) === true && typeof error?.nextStep === 'string',
      JSON.stringify(error))
  }
  const linked = join(work, 'agent', `${PAGE}-link`)
  writePageWidget(linked, PAGE)
  symlinkSync(outside, join(linked, 'page', 'leak.ts'))
  const link = await call('widget_install', { dir: linked })
  check('the install refuses a page with a symbolic link (gate page-files)', link.isError && link.body?.error?.gate === 'page-files' && link.body?.error?.diagnostics?.some((line) => line.startsWith('page/leak.ts:')) === true, JSON.stringify(link.body?.error))
  const after = pageEntries(slugDir)
  const keptIndex = existsSync(join(pageDir, 'index.html')) ? readFileSync(join(pageDir, 'index.html'), 'utf8') : ''
  const read = await call('widget_call', { slug: PAGE, action: 'get' })
  check('after the refused installs, the old bundle and its page link stay, and no .tmp build or staging copy stays',
    keptIndex === before && linkTarget(pageDir) === last && read.body?.result?.note === 'ready from the test run' && after.tmp.length === 0 && (existsSync(staging) ? readdirSync(staging).length : 0) === 0,
    `link=${String(linkTarget(pageDir))} entries=${JSON.stringify(after)} staging=${JSON.stringify(existsSync(staging) ? readdirSync(staging) : [])} read=${JSON.stringify(read.body)}`)
  const offList = (await call('widget_install', { dir: join(work, 'agent', `${PAGE}-bad-1`) })).body?.error?.nextStep ?? ''
  check('the next step of a refused page names the allowed imports', offList.includes('@openuidev/react-lang') && offList.includes('zod') && offList.includes('@deepwidgets/shell/ui/*'), offList)

  // A bundle with no page/: the host gates only. The page link goes, and the builds stay.
  const plain = join(work, 'agent', `${PAGE}-plain`)
  writePageWidget(plain, PAGE)
  rmSync(join(plain, 'page'), { recursive: true })
  const noPage = await call('widget_install', { dir: plain })
  check('a bundle with no page/ installs with the host gates only; the page link goes, and the builds stay', !noPage.isError && noPage.body?.gates?.map((gate) => gate.gate).join() === 'compile,lint,test' && noPage.body?.page === undefined && linkTarget(pageDir) === null && pageEntries(slugDir).builds.length === 3,
    JSON.stringify(noPage.body?.error ?? { gates: noPage.body?.gates?.map((gate) => gate.gate), entries: pageEntries(slugDir) }))
  await call('widget_remove', { slug: PAGE })
}

/**
 * Window part: the desktop smoke runs the render cases, then installs a bundle with a good page over MCP and finds
 * its window.
 */
async function desktopPart() {
  const dir = writePageWidget(join(work, 'agent', 'create-window'), 'create-window')
  const styles = templateText('styles.css')
  const cases = [
    { dir: writePageWidget(join(work, 'agent', 'create-window-loop'), 'create-window-loop', { 'page/child.tsx': LOOPING_CHILD }), refuse: 'not-ready' },
    { dir: writePageWidget(join(work, 'agent', 'create-window-throw'), 'create-window-throw', { 'page/library.tsx': THROWING_LIBRARY }), refuse: 'render-error' },
    { dir: writePageWidget(join(work, 'agent', 'create-window-lost'), 'create-window-lost', { 'page/styles.css': `${styles}${LOST_STYLES}` }), refuse: 'lost-core-styles' },
    { dir: writePageWidget(join(work, 'agent', 'create-window-warn'), 'create-window-warn', { 'page/styles.css': `${styles}${WARNING_STYLES}` }), warnings: ['has no height', 'wider than the window'] },
  ]
  const casesFile = join(work, 'render-cases.json')
  writeFileSync(casesFile, JSON.stringify(cases))
  const smoke = spawn(process.execPath, [join(ROOT, 'tools/smoke-desktop.mjs')], { env: { ...process.env, DSH_SMOKE_CREATE: dir, DSH_SMOKE_CREATE_CASES: casesFile }, stdio: ['ignore', 'pipe', 'pipe'] })
  let text = ''
  smoke.stdout.on('data', (chunk) => { text += chunk })
  smoke.stderr.on('data', (chunk) => { text += chunk })
  const code = await new Promise((resolve) => smoke.once('close', resolve))
  const last = text.trim().split('\n').slice(-3).join(' | ')
  check('desktop: the render check refuses a page that loops (not-ready), a component that throws (render-error), and a lost dw-core style (lost-core-styles); it warns of no body height and wide content; then a good page passes, its window opens, and widget_remove closes it', code === 0, `smoke exit ${String(code)}: ${last}`)
}

let exitCode = 1
try {
  await hostPart()
  if (process.env.WIDGETS_CREATE_DESKTOP !== '0') await desktopPart()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-create: pass')
    exitCode = 0
  } else {
    console.log(`widgets-create: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-create: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  child?.kill('SIGKILL')
}
process.exit(exitCode)
