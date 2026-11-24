#!/usr/bin/env node
/**
 * Host check of the widget kit (unit kit.service, spec kit). It boots the CLI host (web profile) with a new DSH_HOME and
 * the pnpm of the app (tools/fixtures/kit-host.mjs), and calls the service `kit` over the Node inspector and the MCP
 * tools over a token handshake. It checks:
 * - kit.service.start: the first start makes kit version 1 with the 8 core links, each at the folder of the app, and
 *   read() lists no extra. The kit config has minimumReleaseAge 1440.
 * - kit.settings: a mode switch of mcpSettings keeps the key kit of the settings file.
 * - kit.service.calls: two add calls at once give versions 2 and 3, and version 3 has both extras.
 * - kit.gates: a page that imports date-fns fails the type gate before the kit has date-fns, and installs after
 *   add('date-fns@^4'), which makes version 2 with an exact version.
 * - kit.service.errors: in-core for a core package, not-found for a package and an extra that do not exist.
 * - kit.settings: with refuseBuilds ["core-js"], add('core-js') gives install-failed that names core-js, and the
 *   current version stays. With an empty list, the install script of core-js runs: the pnpm log of the new version has
 *   its `postinstall: Done` line.
 * - kit.checked.core_link: after add('recharts@^3'), the kit has exactly one react and one react-dom, the folders of the
 *   app. The range makes the kit save the exact version with a second pnpm run, which has node_modules: with no
 *   overrides, that run resolves React from npm.
 * - kit.folder: remove works, and the kit keeps the last 3 versions. After the remove, with no node_modules, the next
 *   host start installs the kit offline (kit.checked.offline: the lockfile of a remove needs trust-lockfile).
 * - kit.service.lock: the host and another process (tools/fixtures/kit-process.mjs) change the kit at once, and both
 *   changes finish. A start of another process during a change of the host waits, and leaves the change whole. While
 *   another process holds the lock, a page install gives kit-unavailable at once, and an install with no page/ applies.
 * - kit.folder: with core/react pointed at another real folder, an offline frozen install passes and uses that folder.
 *   The next host start points core/react at the app again.
 * - kit.gates: with the registry at an address that does not answer and no node_modules, the host start installs the
 *   kit offline, and a page install passes.
 * - kit.folder: with pnpm 10, the start makes the kit unavailable and names the version. A dsh CLI host with no package
 *   manager runs the pnpm of the repository, 11.28.5, not the pnpm on the PATH.
 * - kit.service.start: with no store and no node_modules, the host starts, read() says unavailable, a page install gives
 *   kit-unavailable in at most 5 s, and a widget with no page/ installs.
 * The check needs the npm registry for the changes. Prints `kit-service: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first. A run starts a host: take the machine lock of the smoke checks.
 */
import { spawn, spawnSync } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { cpSync, createWriteStream, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PNPM_ENTRY } from './fixtures/kit-host.mjs'
import { pageSource, writePageWidget } from './fixtures/page-widget.mjs'
import { pinnedFunction } from './in-host.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const HOST = join(ROOT, 'tools/fixtures/kit-host.mjs')
const KIT_PROCESS = join(ROOT, 'tools/fixtures/kit-process.mjs')
/** The dsh CLI with no package manager: the kit runs the pnpm of the repository. */
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const requireFromMcp = createRequire(join(ROOT, 'deepwidgets/mcp/package.json'))
const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(requireFromMcp.resolve('@modelcontextprotocol/client')).href)

const CORE = ['react', 'react-dom', '@types/react', '@types/react-dom', '@openuidev/react-lang', 'zod', '@deepwidgets/widget-kit', '@deepwidgets/shell']
/** An address that drops each packet, so a registry request waits and never gets an answer. */
const DEAD_REGISTRY = 'http://10.255.255.1/'
const PAGE_SLUG = 'kit-page'
const PLAIN_SLUG = 'kit-plain'
const workRoot = join(process.env.KIT_SERVICE_TMP ?? tmpdir(), 'deepwidgets-kit-service')
mkdirSync(workRoot, { recursive: true })
const work = await mkdtemp(join(workRoot, 'run-'))
const home = join(work, 'home')
const kitDir = join(home, 'deepwidgets', 'kit')
const settingsFile = join(home, 'deepwidgets', 'settings.json')
const logPath = join(work, 'host.log')
const results = []
let child
let base = ''
let inspectPort = 0

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${String(detail).slice(0, 1200)}`}`)
}

/** The real folder of each core package in the app, resolved as the page gates resolved them before the kit. */
function appCore() {
  const kit = realpathSync(join(ROOT, 'deepwidgets/widget-kit'))
  const folder = (from, name) => {
    const found = (createRequire(join(from, 'package.json')).resolve.paths(name) ?? []).map((path) => join(path, name)).find((path) => existsSync(join(path, 'package.json')))
    if (found === undefined) throw new Error(`no ${name} from ${from}`)
    return realpathSync(found)
  }
  const lang = folder(kit, '@openuidev/react-lang')
  return {
    'react': folder(kit, 'react'),
    'react-dom': folder(kit, 'react-dom'),
    '@types/react': folder(kit, '@types/react'),
    '@types/react-dom': folder(kit, '@types/react-dom'),
    '@openuidev/react-lang': lang,
    'zod': folder(lang, 'zod'),
    '@deepwidgets/widget-kit': kit,
    '@deepwidgets/shell': realpathSync(join(ROOT, 'deepwidgets/shell')),
  }
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

/** Start a host. `entry` is the script: the host with the pnpm of the app, or `BIN`, the dsh CLI with no package manager. */
async function startHost(port, env = {}, entry = HOST) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  out.write(`\n==== host start ${new Date().toISOString()} ${JSON.stringify(env)}\n`)
  child = spawn(process.execPath, [`--inspect=127.0.0.1:${String(inspectPort)}`, entry, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home, OPENUI_TELEMETRY_DISABLED: '1', ...env },
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

/** Run `body` in the host with `loader` (the one Loader) and `arg` in scope, over the inspector. */
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
 * The time that one step of the kit may take in the check. A change takes seconds, and the kit stops a pnpm run after
 * 600 s, so a step that gives no answer in this time fails, and the check goes on.
 */
const KIT_STEP_MS = 300_000

/** `promise`, or `fallback` when it gives no answer in {@link KIT_STEP_MS}. */
function bounded(promise, fallback) {
  let timer
  const late = new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), KIT_STEP_MS) })
  return Promise.race([promise, late]).finally(() => clearTimeout(timer))
}

const lateAnswer = (what) => ({ ok: false, code: 'check-timeout', message: `${what} gave no answer in ${String(KIT_STEP_MS)} ms` })

/** One call of the service `kit`: `{ ok, value }`, or `{ ok: false, code, pnpmCode, package, message }`. */
function kit(method, ...args) {
  return bounded(inHost(`
    const kit = loader.ctx.get('kit')
    if (kit === undefined) return { ok: false, code: 'no-service' }
    try {
      return { ok: true, value: await kit[arg.method](...arg.args) }
    } catch (error) {
      return { ok: false, code: error.code, pnpmCode: error.pnpmCode, package: error.package, message: error.message }
    }`, { method, args }), lateAnswer(`kit.${method}`))
}

/**
 * Calls of the service `kit` that start at once, in this order, in one evaluation in the host. Two inspector calls could
 * reach the host in the other order. Gives the answer of each call, as {@link kit} does.
 */
function kitAtOnce(calls) {
  return bounded(inHost(`
    const kit = loader.ctx.get('kit')
    if (kit === undefined) return arg.map(() => ({ ok: false, code: 'no-service' }))
    return await Promise.all(arg.map(([method, ...args]) => kit[method](...args).then(
      (value) => ({ ok: true, value }),
      (error) => ({ ok: false, code: error.code, pnpmCode: error.pnpmCode, package: error.package, message: error.message }))))`, calls),
  calls.map(([method]) => lateAnswer(`kit.${method}`)))
}

/** The handshake of mcp_readme.handshake, then an MCP client with the token. */
async function connect() {
  const portFile = join(home, 'deepwidgets', 'mcp.json')
  let answer
  for (let i = 0; i < 120; i += 1) {
    const challenge = randomBytes(16).toString('base64url')
    answer = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'Kit Check', challenge }) }).catch(() => undefined)
    if (answer?.status === 200) {
      const issued = await answer.json()
      const { nonce } = JSON.parse(readFileSync(portFile, 'utf8'))
      if (createHmac('sha256', nonce).update(challenge).digest('hex') !== issued.proof) throw new Error('the server did not prove the nonce of mcp.json')
      const client = new Client({ name: 'kit-service-check', version: '0.0.0' })
      await client.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${issued.token}` } } }))
      return async (name, args = {}) => {
        const result = await client.callTool({ name, arguments: args })
        let parsed = result.structuredContent
        if (parsed === undefined) {
          try { parsed = JSON.parse(result.content?.[0]?.text ?? 'null') } catch { parsed = null }
        }
        return { isError: result.isError === true, body: parsed }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`no token: ${String(answer?.status)}`)
}

const versionPath = (n) => join(kitDir, 'versions', String(n))
const currentTarget = () => readlinkSync(join(kitDir, 'current'))
const currentDir = () => join(kitDir, currentTarget())
const currentNumber = () => Number(currentTarget().split('/')[1])
/** True when the version folder `dir` has the mark that the kit writes after pnpm made its node_modules. */
const isWhole = (dir) => existsSync(join(dir, 'node_modules', '.deepwidgets-kit-whole'))
const versionsOnDisk = () => readdirSync(join(kitDir, 'versions')).filter((entry) => /^\d+$/.test(entry)).map(Number).sort((a, b) => a - b)
/** The package.json of a kit version. A version that a broken change left with no file reads as `{ missing: true }`, so its step fails with a line. */
const manifestOf = (dir) => existsSync(join(dir, 'package.json')) ? JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) : { missing: true, dependencies: {} }
const brief = (value) => JSON.stringify(value)?.slice(0, 900)

/** The library of the page of PAGE_SLUG: its Note shows a year that date-fns computes, through the root and a subpath. */
const DATE_LIBRARY = `import { createLibrary, defineComponent } from '@openuidev/react-lang'
import { z } from 'zod'
import { format } from 'date-fns'
import { addDays } from 'date-fns/addDays'
import { CardHeader } from '@deepwidgets/shell/components/card-header.tsx'

const Note = defineComponent({
  name: 'Note',
  description: 'One line of text and a year.',
  props: z.object({ text: z.string() }),
  component: ({ props }) => <p className="text-xs" data-dw="note">{props.text} {format(addDays(new Date(2026, 0, 1), 1), 'yyyy')}</p>,
})

const Stack = defineComponent({
  name: 'Stack',
  description: 'Children from top to bottom.',
  props: z.object({ children: z.array(z.union([CardHeader.ref, Note.ref])) }),
  component: ({ props, renderNode }) => <div className="flex flex-col gap-2">{renderNode(props.children)}</div>,
})

export const pageLibrary = createLibrary({ root: 'Stack', components: [Stack, CardHeader, Note] })
`

/** The bundle of PAGE_SLUG: the page fixture, with the library that imports date-fns. */
const pageDir = writePageWidget(join(work, 'agent', PAGE_SLUG), PAGE_SLUG, { 'page/library.tsx': DATE_LIBRARY })
/** A bundle with no page/. */
const plainDir = join(work, 'agent', PLAIN_SLUG)
mkdirSync(join(plainDir, 'src'), { recursive: true })
writeFileSync(join(plainDir, 'src', 'index.ts'), pageSource(PLAIN_SLUG))

/** Fence warnings of an install answer that name date-fns. */
const dateFnsWarnings = (answer) => (answer.body?.gates ?? []).flatMap((gate) => gate.warnings ?? []).filter((line) => line.includes('date-fns'))

/** The real folder of `name` as `from` (a real folder of a package) resolves it. */
function resolvedFrom(from, name) {
  const found = (createRequire(join(from, 'package.json')).resolve.paths(name) ?? []).map((path) => join(path, name)).find((path) => existsSync(join(path, 'package.json')))
  return found === undefined ? undefined : realpathSync(found)
}

async function firstHost(port, core) {
  await startHost(port)
  const call = await connect()

  // ---- kit.service.start: version 1 ----
  const first = await kit('read')
  const v1 = versionPath(1)
  const links = CORE.map((name) => {
    const link = join(v1, 'core', name)
    const isLink = existsSync(link) && lstatSync(link).isSymbolicLink()
    return { name, ok: isLink && realpathSync(link) === core[name] }
  })
  check('the first start makes kit version 1 with the 8 core links at the folders of the app, and read() lists no extra',
    first.ok && first.value.version === 1 && first.value.available === true && first.value.extras.length === 0 && first.value.core.length === 8
      && currentTarget() === 'versions/1' && links.every((link) => link.ok) && manifestOf(v1).dependencies.react === 'link:./core/react',
    brief({ first, links: links.filter((link) => !link.ok), current: currentTarget() }))
  const config = readFileSync(join(v1, 'pnpm-workspace.yaml'), 'utf8')
  check('the kit config has minimumReleaseAge 1440, dangerouslyAllowAllBuilds, and the core links in overrides',
    /^minimumReleaseAge: 1440$/m.test(config) && /^dangerouslyAllowAllBuilds: true$/m.test(config) && CORE.every((name) => config.includes(`${JSON.stringify(name)}: "link:./core/${name}"`)),
    config)

  // ---- kit.settings: the mode switch keeps the key kit ----
  mkdirSync(dirname(settingsFile), { recursive: true })
  writeFileSync(settingsFile, JSON.stringify({ kit: { refuseBuilds: [] } }))
  const switched = await inHost("return await loader.ctx.get('mcpSettings').setMode('create', true)")
  const afterSwitch = JSON.parse(readFileSync(settingsFile, 'utf8'))
  check('a mode switch of mcpSettings keeps the key kit of the settings file',
    switched?.ok === true && afterSwitch.modes?.create === true && JSON.stringify(afterSwitch.kit) === '{"refuseBuilds":[]}', brief({ switched, afterSwitch }))

  // ---- kit.gates: a page that imports date-fns, before and after the add ----
  const before = await call('widget_install', { dir: pageDir })
  check('before the kit has date-fns, the page that imports it fails the gate page-types',
    before.isError && before.body?.error?.code === 'gate-failed' && before.body.error.gate === 'page-types' && JSON.stringify(before.body.error.diagnostics).includes('date-fns'),
    brief(before.body))
  // kit.service.calls: two add calls at once run one after the other, in order.
  const [dateFns, ms] = await kitAtOnce([['add', 'date-fns@^4'], ['add', 'ms@^2']])
  const v2 = manifestOf(versionPath(2))
  const v3 = manifestOf(versionPath(3))
  check('two add calls at once give versions 2 and 3, and version 3 has both extras',
    dateFns.ok && ms.ok && dateFns.value.version === 2 && ms.value.version === 3 && currentTarget() === 'versions/3'
      && v2.dependencies.ms === undefined && /^2\.\d+\.\d+$/.test(v3.dependencies.ms ?? '') && v3.dependencies['date-fns'] === v2.dependencies['date-fns'],
    brief({ dateFns: dateFns.ok ? dateFns.value.version : dateFns, ms: ms.ok ? ms.value.version : ms, v2: v2.dependencies, v3: v3.dependencies }))
  check("add('date-fns@^4') makes version 2 with an exact version",
    dateFns.ok && /^4\.\d+\.\d+$/.test(v2.dependencies['date-fns'] ?? '')
      && dateFns.value.extras.some((extra) => extra.name === 'date-fns' && extra.version === v2.dependencies['date-fns']),
    brief({ dateFns, spec: v2.dependencies['date-fns'] }))
  const installed = await call('widget_install', { dir: pageDir })
  check('a page bundle that imports date-fns and date-fns/addDays installs, with no fence warning for date-fns',
    !installed.isError && installed.body?.application === 'applied' && installed.body.gates?.some((gate) => gate.gate === 'page-build' && gate.ok) && dateFnsWarnings(installed).length === 0,
    brief(installed.body?.error ?? { application: installed.body?.application, warnings: dateFnsWarnings(installed) }))

  // The link `page` of the slug names the build of this install.
  const pageLink = join(home, 'profiles', 'web', 'deepwidgets-widgets', PAGE_SLUG, 'page')
  const firstBuild = existsSync(pageLink) ? readlinkSync(pageLink) : undefined

  // ---- kit.service.errors ----
  const inCore = await kit('add', 'react@18')
  const removeCore = await kit('remove', 'zod')
  check('add and remove of a core package give in-core', !inCore.ok && inCore.code === 'in-core' && !removeCore.ok && removeCore.code === 'in-core', brief({ inCore, removeCore }))
  const missing = await kit('add', 'deepwidgets-no-such-package-zz9')
  const noExtra = await kit('remove', 'left-pad')
  check('add of a package that npm does not have, and remove of an extra that the kit does not have, give not-found',
    !missing.ok && missing.code === 'not-found' && missing.pnpmCode === 'ERR_PNPM_FETCH_404' && !noExtra.ok && noExtra.code === 'not-found' && currentTarget() === 'versions/3' && !existsSync(versionPath(4)),
    brief({ missing, noExtra }))

  // ---- kit.settings: refuseBuilds ----
  writeFileSync(settingsFile, JSON.stringify({ modes: { create: true }, kit: { refuseBuilds: ['core-js'] } }))
  const refused = await kit('add', 'core-js')
  check("with refuseBuilds [\"core-js\"], add('core-js') gives install-failed that names core-js, and version 3 stays",
    !refused.ok && refused.code === 'install-failed' && refused.pnpmCode === 'ERR_DEEPWIDGETS_KIT_REFUSED' && /^core-js@/.test(refused.package ?? '')
      && currentTarget() === 'versions/3' && !existsSync(versionPath(4)),
    brief(refused))
  writeFileSync(settingsFile, JSON.stringify({ modes: { create: true }, kit: { refuseBuilds: [] } }))
  const coreJs = await kit('add', 'core-js')
  const coreJsLog = coreJs.ok ? readFileSync(join(versionPath(4), 'pnpm.log'), 'utf8') : ''
  check('with an empty list, add of core-js makes version 4, and the install script of core-js runs',
    coreJs.ok && coreJs.value.version === 4 && /core-js@[^/\s]+\/node_modules\/core-js postinstall: Done/.test(coreJsLog),
    brief({ coreJs: coreJs.ok ? coreJs.value.extras : coreJs, log: coreJsLog.split('\n').filter((line) => line.includes('postinstall')) }))

  // ---- kit.checked.core_link: one react ----
  // kit.checked.core_link: a change runs `pnpm add` in a copy with no node_modules, and there pnpm keeps the core link
  // of React also with no overrides. The range makes the kit run pnpm again, online, to save the exact version. That
  // run has node_modules, and with no overrides it puts React from npm in place of the core. The step checks the kit
  // after that run.
  const recharts = await kit('add', 'recharts@^3')
  const v5 = versionPath(5)
  const store = existsSync(join(v5, 'node_modules', '.pnpm')) ? readdirSync(join(v5, 'node_modules', '.pnpm')) : []
  const copies = store.filter((entry) => /^react(?:-dom)?@/.test(entry))
  const rechartsDir = existsSync(join(v5, 'node_modules', 'recharts')) ? realpathSync(join(v5, 'node_modules', 'recharts')) : undefined
  const rechartsReact = rechartsDir === undefined ? undefined : resolvedFrom(rechartsDir, 'react')
  const rechartsReactDom = rechartsDir === undefined ? undefined : resolvedFrom(rechartsDir, 'react-dom')
  check("after add('recharts@^3'), exactly one react and one react-dom are in the kit, the folders of the app, and recharts has an exact version",
    recharts.ok && recharts.value.version === 5 && copies.length === 0 && rechartsReact === core.react && rechartsReactDom === core['react-dom']
      && realpathSync(join(v5, 'node_modules', 'react')) === core.react && /^3\.\d+\.\d+$/.test(manifestOf(v5).dependencies.recharts ?? ''),
    brief({ recharts: recharts.ok ? recharts.value.version : recharts, copies, rechartsReact, rechartsReactDom }))

  // ---- kit.gates: the build name hashes the kit version ----
  const again = await call('widget_install', { dir: pageDir })
  const secondBuild = existsSync(pageLink) ? readlinkSync(pageLink) : undefined
  check('an install of the same page sources after a kit change builds the page again',
    !again.isError && again.body?.application === 'applied' && firstBuild !== undefined && secondBuild !== undefined && secondBuild !== firstBuild,
    brief({ firstBuild, secondBuild, answer: again.body?.error ?? again.body?.application }))

  // ---- kit.folder: remove, and the last 3 versions ----
  const removed = await kit('remove', 'core-js')
  check('remove of core-js makes version 6 without it, and the kit keeps the last 3 versions',
    removed.ok && removed.value.version === 6 && manifestOf(versionPath(6)).dependencies['core-js'] === undefined && JSON.stringify(versionsOnDisk()) === '[4,5,6]'
      && removed.value.extras.map((extra) => extra.name).sort().join(',') === 'date-fns,ms,recharts',
    brief({ removed: removed.ok ? removed.value : removed, versions: versionsOnDisk() }))
  await stopHost()
}

/**
 * kit.checked.offline: `pnpm remove` writes a lockfile that pnpm does not list in cache/lockfile-verified.jsonl, so an
 * offline install of it needs trust-lockfile. The host start must install it offline.
 */
async function afterRemoveHost(port) {
  rmSync(join(currentDir(), 'node_modules'), { recursive: true, force: true })
  await startHost(port)
  const state = await kit('read')
  const log = readFileSync(logPath, 'utf8')
  check('after remove, with no node_modules, the host start installs kit version 6 offline',
    state.ok && state.value.available === true && state.value.version === 6 && isWhole(currentDir()) && existsSync(join(currentDir(), 'node_modules', 'recharts', 'package.json'))
      && /kit: kit version 6 is ready/.test(log.slice(log.lastIndexOf('==== host start'))),
    brief(state))
  await stopHost()
}

/** Run the kit in another process (tools/fixtures/kit-process.mjs): `start`, `add`, or `remove`. Gives its RESULT. */
function kitProcess(op, arg = '', env = {}) {
  let proc
  const answer = new Promise((resolve) => {
    proc = spawn(process.execPath, [KIT_PROCESS, kitDir, settingsFile, op, arg], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    proc.stdout.on('data', (chunk) => { out += chunk })
    proc.stderr.on('data', (chunk) => { err += chunk })
    proc.once('exit', (code) => {
      const line = out.split('\n').find((item) => item.startsWith('RESULT '))
      resolve(line === undefined ? { ok: false, code: `exit ${String(code)}`, message: err.slice(-600) } : JSON.parse(line.slice(7)))
    })
  })
  return bounded(answer, lateAnswer(`the kit process ${op}`)).then((result) => {
    if (result.code === 'check-timeout') proc.kill('SIGKILL')
    return result
  })
}

/** Wait until `test` is true, for at most `ms`. */
async function waitUntil(test, ms) {
  const until = Date.now() + ms
  while (Date.now() < until) {
    if (test()) return true
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return false
}

/** kit.service.lock: another process changes the kit while this host changes it, or starts while it changes. */
async function lockHost(port) {
  await startHost(port)
  // Two processes change the kit at once: the host and another process. Each change finishes, one after the other.
  const before = currentNumber()
  const other = kitProcess('add', 'dequal@^2')
  const here = await kit('add', 'clsx@^2')
  const there = await other
  const last = versionPath(before + 2)
  const deps = existsSync(last) ? manifestOf(last).dependencies : {}
  check('two processes that change the kit at once both finish, one after the other, and current names a whole version with both extras',
    here.ok && there.ok && [here.value.version, there.value.version].sort().join(',') === `${String(before + 1)},${String(before + 2)}`
      && currentNumber() === before + 2 && isWhole(last) && /^\d/.test(deps.clsx ?? '') && /^\d/.test(deps.dequal ?? ''),
    brief({ here: here.ok ? here.value.version : here, there: there.ok ? there.value.version : there, current: currentTarget(), deps }))
  // A start of another process during a change of the host waits for it, and leaves the change whole.
  const from = currentNumber()
  const changing = kit('add', 'nanoid@^5')
  const inWork = await waitUntil(() => existsSync(join(versionPath(from + 1), 'package.json')), 60_000)
  const starting = kitProcess('start')
  const [changed, started] = [await changing, await starting]
  check('a start during a change of another process leaves that change whole',
    inWork && changed.ok && changed.value.version === from + 1 && started.ok && started.value.available === true && started.value.version === from + 1
      && currentNumber() === from + 1 && isWhole(currentDir()) && existsSync(join(currentDir(), 'node_modules', 'nanoid', 'package.json')),
    brief({ inWork, changed: changed.ok ? changed.value.version : changed, started: started.ok ? { version: started.value.version, available: started.value.available, reason: started.value.reason } : started, current: currentTarget() }))

  // The page gates never wait for the lock. A process that is alive holds the lock file of the kit, as the start or the
  // change of another process does. It lives 60 s, so a page gate that waits for the lock gets it only after that.
  const call = await connect()
  const holder = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 60_000)'], { stdio: 'ignore' })
  const lockFile = join(kitDir, 'current.lock')
  writeFileSync(lockFile, `${String(holder.pid)}\n`)
  const busyStarted = performance.now()
  // An MCP request that times out (60 s) is an answer of this step, not a crash of the stage.
  const asked = (args) => bounded(call('widget_install', args), lateAnswer('widget_install')).catch((error) => ({ isError: true, body: { error: { code: 'client-error', message: String(error) } } }))
  const busy = await asked({ dir: pageDir })
  const busyMs = Math.round(performance.now() - busyStarted)
  const plain = await asked({ dir: plainDir })
  holder.kill('SIGKILL')
  rmSync(lockFile, { force: true })
  check('while another process holds the kit lock, a page install gives kit-unavailable with a next step to try again in at most 5 s, and a later install with no page/ applies',
    busy.isError && busy.body?.error?.code === 'kit-unavailable' && /again/.test(busy.body.error.nextStep ?? '') && busyMs <= 5000
      && !plain.isError && plain.body?.application === 'applied',
    brief({ busyMs, busy: busy.body?.error ?? busy.body?.application ?? busy, plain: plain.body?.error ?? plain.body?.application ?? plain }))
  await stopHost()
}

/**
 * kit.folder: the lockfile holds only the relative core links, so another real folder behind core/react installs. The
 * run is the offline install of the host start.
 */
function relinkPart(core) {
  const dir = currentDir()
  const other = join(work, 'react-copy')
  cpSync(core.react, other, { recursive: true })
  unlinkSync(join(dir, 'core', 'react'))
  symlinkSync(other, join(dir, 'core', 'react'), 'dir')
  rmSync(join(dir, 'node_modules'), { recursive: true, force: true })
  const run = spawnSync(process.execPath, [PNPM_ENTRY, 'install', '--offline', '--frozen-lockfile', '--config.trust-lockfile=true'], { cwd: dir, encoding: 'utf8', env: { ...process.env, OPENUI_TELEMETRY_DISABLED: '1' } })
  const react = existsSync(join(dir, 'node_modules', 'react')) ? realpathSync(join(dir, 'node_modules', 'react')) : undefined
  check('with core/react pointed at another real folder, an offline frozen install passes and uses that folder',
    run.status === 0 && react === realpathSync(other), brief({ status: run.status, react, out: `${run.stdout}${run.stderr}`.slice(-600) }))
}

async function deadRegistryHost(port, core) {
  // The start must install node_modules offline, with no answer from the registry.
  rmSync(join(currentDir(), 'node_modules'), { recursive: true, force: true })
  await startHost(port, { npm_config_registry: DEAD_REGISTRY })
  const call = await connect()
  const state = await kit('read')
  const relinked = realpathSync(join(currentDir(), 'core', 'react'))
  check('with the registry at an address that does not answer, the host start installs the kit offline and points core/react at the app again',
    state.ok && state.value.available === true && state.value.version === currentNumber() && relinked === core.react && isWhole(currentDir()),
    brief({ state, relinked }))
  const started = performance.now()
  const installed = await call('widget_install', { dir: pageDir })
  check('with the registry at an address that does not answer, a page install passes',
    !installed.isError && installed.body?.application === 'applied', brief({ ms: Math.round(performance.now() - started), answer: installed.body?.error ?? installed.body?.application }))
  await stopHost()
}

/** kit.folder: the kit runs only pnpm 11. A pnpm entry that says 10.28.1 makes the kit unavailable. */
async function pnpm10Host(port) {
  const fake = join(work, 'pnpm-10.mjs')
  writeFileSync(fake, "if (process.argv.includes('--version')) { console.log('10.28.1'); process.exit(0) }\nconsole.error('pnpm 10.28.1 of the check: only --version'); process.exit(1)\n")
  const before = currentTarget()
  await startHost(port, { KIT_HOST_PNPM: fake })
  const call = await connect()
  const state = await kit('read')
  const change = await kit('add', 'left-pad@^1')
  const page = await call('widget_install', { dir: pageDir })
  check('with pnpm 10, the start makes the kit unavailable and names 10.28.1, a change and a page install give kit-unavailable, and the kit stays',
    state.ok && state.value.available === false && (state.value.reason ?? '').includes('10.28.1') && !change.ok && change.code === 'kit-unavailable'
      && page.isError && page.body?.error?.code === 'kit-unavailable' && currentTarget() === before,
    brief({ state: state.ok ? { available: state.value.available, reason: state.value.reason } : state, change, page: page.body?.error?.code }))
  await stopHost()
}

/** kit.folder: a CLI host with no package manager runs the pnpm of the repository, 11.28.5, not the pnpm on the PATH. */
async function plainHost(port) {
  await startHost(port, {}, BIN)
  const state = await kit('read')
  const log = readFileSync(logPath, 'utf8')
  const ready = /kit: kit version \d+ is ready \(pnpm ([^)]+)\)/.exec(log.slice(log.lastIndexOf('==== host start')))?.[1]
  check('a CLI host with no package manager runs the pnpm of the repository, 11.28.5',
    state.ok && state.value.available === true && ready === '11.28.5', brief({ ready, state: state.ok ? { available: state.value.available, reason: state.value.reason } : state }))
  await stopHost()
}

async function noStoreHost(port) {
  rmSync(join(kitDir, 'store'), { recursive: true, force: true })
  rmSync(join(currentDir(), 'node_modules'), { recursive: true, force: true })
  await startHost(port)
  const call = await connect()
  const state = await kit('read')
  check('with no store and no node_modules, the host starts and read() says that the kit is unavailable',
    state.ok && state.value.available === false && /NO_OFFLINE_TARBALL|offline install/.test(state.value.reason ?? ''), brief(state))
  const started = performance.now()
  const page = await call('widget_install', { dir: pageDir })
  const ms = Math.round(performance.now() - started)
  check('with the kit unavailable, a page install gives kit-unavailable with a next step in at most 5 s',
    page.isError && page.body?.error?.code === 'kit-unavailable' && typeof page.body.error.nextStep === 'string' && page.body.error.nextStep.includes('page/') && ms <= 5000,
    brief({ ms, answer: page.body }))
  const plain = await call('widget_install', { dir: plainDir })
  check('with the kit unavailable, a bundle with no page/ installs', !plain.isError && plain.body?.application === 'applied', brief(plain.body?.error ?? plain.body?.application))
  await stopHost()
}

let exitCode = 1
try {
  const port = await freePort()
  inspectPort = await freePort()
  base = `http://127.0.0.1:${String(port)}`
  console.log(`kit-service: work folder ${work}, port ${String(port)}`)
  const core = appCore()
  // A stage that throws, such as on a kit that a broken change left with no current version, gives a FAIL line with the
  // error, and the next stage runs.
  const stages = [
    ['the first host', () => firstHost(port, core)],
    ['the start after remove', () => afterRemoveHost(port)],
    ['the lock steps', () => lockHost(port)],
    ['the core link to another folder', () => relinkPart(core)],
    ['the registry that does not answer', () => deadRegistryHost(port, core)],
    ['pnpm 10', () => pnpm10Host(port)],
    ['the host with no package manager', () => plainHost(port)],
    ['no store', () => noStoreHost(port)],
  ]
  for (const [stage, run] of stages) {
    try {
      await run()
    } catch (error) {
      check(`the stage "${stage}" ran to its end`, false, error instanceof Error ? error.stack : String(error))
      await stopHost().catch(() => undefined)
    }
  }
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('kit-service: pass')
    exitCode = 0
  } else {
    console.log(`kit-service: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`kit-service: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  child?.kill('SIGKILL')
}
process.exit(exitCode)
