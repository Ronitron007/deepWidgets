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
 * - a bundle with a raw setTimeout, or with while (true) and no exit, is refused by the lint gate;
 * - a bundle whose apply throws is refused by the test run gate;
 * - widget_remove removes the widget, and a new install gets the old state back;
 * - a host restart loads the agent widget again.
 * Window part: it runs tools/smoke-desktop.mjs with DSH_SMOKE_CREATE set to a template folder. The
 * smoke installs it over MCP into the desktop app and finds its window. Skip it with
 * WIDGETS_CREATE_DESKTOP=0. The window part needs the machine lock of the smoke checks.
 * Prints `widgets-create: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` (and the desktop build for the window part) first.
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

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const requireFromMcp = createRequire(join(ROOT, 'deepwidgets/mcp/package.json'))
const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(requireFromMcp.resolve('@modelcontextprotocol/client')).href)

const work = await mkdtemp(join(process.env.WIDGETS_CREATE_TMP ?? tmpdir(), 'widgets-create-'))
const home = join(work, 'home')
const logPath = join(work, 'host.log')
const results = []
let child

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
  child = spawn(process.execPath, [BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stderr.pipe(out)
  await new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error('the host did not print its URL in 90 s')), 90_000)
    child.stdout.on('data', (chunk) => {
      out.write(chunk)
      text += chunk
      if (/http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/.test(text)) { clearTimeout(timer); resolve() }
    })
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`the host exited with ${String(code)}`)) })
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

async function hostPart() {
  const port = await freePort()
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
    const want = ['widget_call', 'widget_changes', 'widget_describe', 'widget_guide', 'widget_install', 'widget_list', 'widget_reload', 'widget_remove', 'widget_template']
    check('tools/list has the four interact tools and the five create tools', JSON.stringify(tools) === JSON.stringify(want), JSON.stringify(tools))

    const guide = await call('widget_guide')
    const text = guide.body?.guide ?? ''
    check('widget_guide gives the widget API types and the OpenUI guide of the component set', !guide.isError && text.includes('interface WidgetContext') && text.includes('Card(') && text.includes('shadcn-widgets@1'), `${String(text.length)} characters`)

    const template = await call('widget_template', { slug: SLUG, title: 'Create Check' })
    const files = template.body?.files ?? []
    check('widget_template gives src/index.ts with the slug filled in', !template.isError && files.length === 1 && files[0].path === 'src/index.ts' && files[0].text.includes(`'${SLUG}'`), JSON.stringify(files.map((file) => file.path)))

    const dir = writeWidget(SLUG, files)
    const started = Date.now()
    const installed = await call('widget_install', { dir })
    check('widget_install of the template passes the gates and applies', !installed.isError && installed.body?.slug === SLUG && installed.body?.application === 'applied' && installed.body?.gates?.map((gate) => gate.gate).join() === 'compile,lint,test',
      `${String(Date.now() - started)} ms ${JSON.stringify(installed.body)}`)
    check('widget_list shows the installed widget', (await slugs()).includes(SLUG), JSON.stringify(await slugs()))
    const described = await call('widget_describe', { slug: SLUG })
    const addArgs = described.body?.actions?.find((action) => action.name === 'add')?.args
    check('widget_describe gives the zod args of the bundle as JSON Schema', addArgs?.type === 'object' && addArgs?.properties?.by?.type === 'integer', JSON.stringify(described.body?.actions))
    const added = await call('widget_call', { slug: SLUG, action: 'add', args: { by: 2 }, requestId: 'create-1' })
    const read = await call('widget_call', { slug: SLUG, action: 'get' })
    check('widget_call add and get work on the installed widget', !added.isError && read.body?.result?.count === 2, JSON.stringify([added.body, read.body]))

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

    const timer = await call('widget_install', { dir: writeWidget('create-timer', files, (text) => addToApply("setTimeout(() => { ctx.logger.info('tick') }, 10)")(text).replaceAll(`'${SLUG}'`, "'create-timer'")) })
    const timerError = timer.body?.error
    check('a bundle with a raw setTimeout is refused by the lint gate', timer.isError && timerError?.code === 'gate-failed' && timerError?.gate === 'lint' && timerError?.diagnostics?.some((line) => line.includes('setTimeout')) && typeof timerError?.nextStep === 'string',
      JSON.stringify(timerError))

    const looper = await call('widget_install', { dir: writeWidget('create-loop', files, (text) => addToApply('let spins = 0\n  while (true) { spins += 1 }')(text).replaceAll(`'${SLUG}'`, "'create-loop'")) })
    const loopError = looper.body?.error
    check('a bundle with while (true) and no exit is refused by the lint gate', looper.isError && loopError?.gate === 'lint' && loopError?.diagnostics?.some((line) => line.includes('no-endless-loop')), JSON.stringify(loopError))

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
    const back = await call('widget_install', { dir: writeWidget(`${SLUG}-v3`, files) })
    const kept = await call('widget_call', { slug: SLUG, action: 'get' })
    check('a new install after the remove gets the stored state back', !back.isError && kept.body?.result?.count === 6, JSON.stringify([back.body?.application, kept.body]))
  } finally {
    await client.close()
  }

  // A host start loads the installed bundle from the profile again.
  await stopHost()
  await startHost(port)
  client = await connect(base)
  try {
    check('after a host restart the agent widget loads at start with its state', (await slugs()).includes(SLUG) && (await call('widget_call', { slug: SLUG, action: 'get' })).body?.result?.count === 6, JSON.stringify(await slugs()))
  } finally {
    await client.close()
  }
  await stopHost()
  return readFileSync(join(work, 'agent', `${SLUG}-v3`, 'src', 'index.ts'), 'utf8')
}

/** Window part: the desktop smoke installs a template copy over MCP and finds its window. */
async function desktopPart(templateText) {
  const dir = join(work, 'agent', 'create-window')
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src', 'index.ts'), templateText.replaceAll(`'${SLUG}'`, "'create-window'"))
  const smoke = spawn(process.execPath, [join(ROOT, 'tools/smoke-desktop.mjs')], { env: { ...process.env, DSH_SMOKE_CREATE: dir }, stdio: ['ignore', 'pipe', 'pipe'] })
  let text = ''
  smoke.stdout.on('data', (chunk) => { text += chunk })
  smoke.stderr.on('data', (chunk) => { text += chunk })
  const code = await new Promise((resolve) => smoke.once('close', resolve))
  const last = text.trim().split('\n').slice(-3).join(' | ')
  check('desktop: an MCP install of the template opens its window, and widget_remove closes it', code === 0, `smoke exit ${String(code)}: ${last}`)
}

let exitCode = 1
try {
  const templateText = await hostPart()
  if (process.env.WIDGETS_CREATE_DESKTOP !== '0') await desktopPart(templateText)
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
