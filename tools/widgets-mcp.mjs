#!/usr/bin/env node
/**
 * Host check of the MCP server for widgets (unit widget.mcp).
 * It boots the CLI host (web profile) on a free loopback port and, with the MCP SDK client, checks:
 * widget_list names sample, widget_call add adds 1, widget_changes shows the change with `by` set
 * to the agent, a request with an Origin header gets 403, a request with no token gets 401, and a
 * bad token gets 401. It also checks the token file mode.
 * Prints `widgets-mcp: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` first.
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createWriteStream, mkdirSync, readFileSync, statSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
// The SDK client is a devDependency of @deepwidgets/mcp; resolve it from there.
const requireFromMcp = createRequire(join(ROOT, 'deepwidgets/mcp/package.json'))
const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(requireFromMcp.resolve('@modelcontextprotocol/client')).href)

const work = await mkdtemp(join(process.env.WIDGETS_MCP_TMP ?? tmpdir(), 'widgets-mcp-'))
const home = join(work, 'home')
const logPath = join(work, 'host.log')
const results = []
let child

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${detail}`}`)
}

/** A token request challenge (widget_phase2.mcp_port): 16 random bytes as base64url. */
const challenge = () => randomBytes(16).toString('base64url')

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

// ---- inspector: the Loader lookup of tools/widgets-runtime.mjs ----

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
    functionDeclaration: 'function () { if (this.length !== 1) throw new Error("Loader instances " + this.length); globalThis.__mcpCheck = { loader: this[0] } }',
  })
  return {
    /** Evaluate an async function body in the host; `mc` is the check scratch object. */
    async run(body) {
      const reply = await session.send('Runtime.evaluate', { expression: `(async (mc) => { ${body} })(globalThis.__mcpCheck)`, awaitPromise: true, returnByValue: true })
      return reply.result.value
    },
    close() { session.close() },
  }
}

/**
 * Call the real /mcp prefix route handler in the host with a fake socket address
 * (fence.non_loopback_bind): a LAN peer is not practical in a check.
 */
const CALL_ROUTE = `
  const fiber = mc.loader.ctx.plugin({ name: 'widgets-mcp-check', inject: ['webServer'], apply(ctx) { mc.ctx = ctx } })
  await fiber
  // prefixes is a TypeScript-private field of WebServer; the check reads the registered route from it.
  const route = mc.ctx.webServer.prefixes.get('/mcp')
  await fiber.dispose()
  if (route === undefined || typeof route.handler !== 'function') throw new Error('no /mcp prefix route')
  const call = (path, remoteAddress, host, body) => new Promise((resolve, reject) => {
    const chunks = body === undefined ? [] : [Buffer.from(body)]
    const req = {
      url: path, method: 'POST', socket: { remoteAddress },
      headers: { host, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      async *[Symbol.asyncIterator]() { for (const chunk of chunks) yield chunk },
    }
    let status
    const res = {
      headersSent: false,
      writeHead(code) { status = code; this.headersSent = true; return this },
      setHeader() {}, write() { return true }, on() { return this }, once() { return this },
      end() { resolve(status) },
    }
    Promise.resolve(route.handler(req, res)).catch(reject)
  })
  return {
    lanMcp: await call('/mcp', '192.168.1.5', HOST, '{}'),
    lanToken: await call('/mcp/token', '192.168.1.5', HOST, JSON.stringify({ agent: 'lan', challenge: CHALLENGE })),
    mappedMcp: await call('/mcp', '::ffff:127.0.0.1', HOST, '{}'),
    mappedToken: await call('/mcp/token', '::ffff:127.0.0.1', HOST, JSON.stringify({ agent: 'mapped', challenge: CHALLENGE })),
  }
`

let inspectPort

async function startHost(port) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  child = spawn(process.execPath, [`--inspect=127.0.0.1:${String(inspectPort)}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home },
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

/** One request over node:http, which can set any Host header. Gives the status. */
function rawHttp(url, headers, payload = '') {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers } }, (res) => { res.resume(); resolve(res.statusCode) })
    req.once('error', reject)
    req.end(payload)
  })
}

/** Unit check of the fence predicates (fence.non_loopback_bind, fence.host_userinfo): a real LAN socket is not practical here. */
async function predicateChecks() {
  const mod = await import(pathToFileURL(join(ROOT, 'deepwidgets/mcp/lib/index.js')).href)
  const addr = mod.isLoopbackAddress
  const host = mod.isLoopbackHost
  const loopAddrs = ['127.0.0.1', '127.8.9.10', '::1', '::ffff:127.0.0.1', '::ffff:127.200.1.1']
  const otherAddrs = [undefined, '', '10.0.0.5', '192.168.1.20', '::ffff:192.168.1.20', 'fe80::1', '::', '0.0.0.0', '128.0.0.1', '::ffff:10.0.0.1']
  check('isLoopbackAddress: loopback remote addresses pass, others fail',
    typeof addr === 'function' && loopAddrs.every((a) => addr(a) === true) && otherAddrs.every((a) => addr(a) === false),
    typeof addr === 'function' ? JSON.stringify([...loopAddrs, ...otherAddrs].map((a) => [a, addr(a)])) : 'not exported')
  const goodHosts = ['127.0.0.1', '127.0.0.1:8080', 'localhost', 'LOCALHOST:1', '[::1]', '[::1]:65535']
  const badHosts = [undefined, '', 'evil.com@127.0.0.1', 'evil.com@127.0.0.1:80', '127.0.0.1.evil.com', 'localhost.', '127.1', 'evil.com', '127.0.0.1:', '127.0.0.1:123456', 'user@localhost', '[::1]x']
  check('isLoopbackHost: only 127.0.0.1, localhost, [::1] with an optional port pass',
    typeof host === 'function' && goodHosts.every((h) => host(h) === true) && badHosts.every((h) => host(h) === false),
    typeof host === 'function' ? JSON.stringify([...goodHosts, ...badHosts].map((h) => [h, host(h)])) : 'not exported')
}

/** Parse the JSON body of one tool answer. */
function body(result) {
  if (result.structuredContent !== undefined) return result.structuredContent
  try { return JSON.parse(result.content?.[0]?.text ?? 'null') } catch { return null }
}

async function main() {
  const port = await freePort()
  inspectPort = await freePort()
  const base = `http://127.0.0.1:${String(port)}`
  console.log(`widgets-mcp: work folder ${work}, port ${String(port)}`)
  await predicateChecks()
  await startHost(port)

  // The bundles load after the URL prints; wait for the /mcp route.
  let tokenAnswer
  for (let i = 0; i < 60; i += 1) {
    tokenAnswer = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'Check Agent', challenge: challenge() }) })
    if (tokenAnswer.status !== 404) break
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  const issued = await tokenAnswer.json().catch(() => null)
  check('POST /mcp/token gives a token and an agentId', tokenAnswer.status === 200 && typeof issued?.token === 'string' && typeof issued?.agentId === 'string', `${String(tokenAnswer.status)} ${JSON.stringify(issued?.agentId)}`)
  const { token, agentId } = issued ?? {}
  const tokenFile = join(home, 'deepwidgets', 'mcp-tokens.json')
  let mode
  try { mode = statSync(tokenFile).mode & 0o777 } catch { mode = undefined }
  check('the token file is $DSH_HOME/deepwidgets/mcp-tokens.json with mode 0600', mode === 0o600, mode === undefined ? 'missing' : mode.toString(8))

  const client = new Client({ name: 'widgets-mcp-check', version: '0.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${String(token)}` } } })
  await client.connect(transport)
  try {
    const listed = (await client.listTools()).tools
    const tools = listed.map((tool) => tool.name).sort()
    const callSchema = listed.find((tool) => tool.name === 'widget_call')?.inputSchema
    check('tools/list advertises the input schema of widget_call', callSchema?.properties?.slug?.type === 'string' && callSchema?.properties?.args?.type === 'object' && callSchema?.required?.includes('action'), JSON.stringify(callSchema))
    check('tools are widget_call, widget_changes, widget_describe, widget_list', JSON.stringify(tools) === JSON.stringify(['widget_call', 'widget_changes', 'widget_describe', 'widget_list']), JSON.stringify(tools))

    const list = body(await client.callTool({ name: 'widget_list', arguments: {} }))
    check('widget_list names sample', list?.widgets?.some((widget) => widget.slug === 'sample'), JSON.stringify(list?.widgets))

    const described = body(await client.callTool({ name: 'widget_describe', arguments: { slug: 'sample' } }))
    const actions = new Map((described?.actions ?? []).map((action) => [action.name, action]))
    const addArgs = actions.get('add')?.args
    check('widget_describe sample lists get and add with the args schema of add',
      actions.get('get')?.kind === 'query' && actions.get('add')?.kind === 'mutation' && addArgs?.type === 'object' && addArgs?.properties?.by?.type === 'number' && typeof described?.state?.count === 'number',
      JSON.stringify(described?.actions))

    const before = body(await client.callTool({ name: 'widget_call', arguments: { slug: 'sample', action: 'get' } }))
    const added = body(await client.callTool({ name: 'widget_call', arguments: { slug: 'sample', action: 'add', args: { by: 1 }, requestId: 'mcp-check-1' } }))
    const after = body(await client.callTool({ name: 'widget_call', arguments: { slug: 'sample', action: 'get' } }))
    check('widget_call add adds 1', typeof before?.result?.count === 'number' && after?.result?.count === before.result.count + 1 && added?.rev === after?.rev, `${String(before?.result?.count)} -> ${String(after?.result?.count)}`)

    const changes = body(await client.callTool({ name: 'widget_changes', arguments: { since: list.cursor } }))
    const change = changes?.changes?.find((item) => item.slug === 'sample' && item.kind === 'state' && item.action === 'add')
    check('widget_changes shows the change with by set to the agent', change !== undefined && change.by === agentId, JSON.stringify(changes?.changes))

    const badArgs = await client.callTool({ name: 'widget_call', arguments: { slug: 'sample', action: 'add', args: [1] } })
    const badSlug = await client.callTool({ name: 'widget_describe', arguments: { slug: 5 } })
    const schemaErrors = [badArgs, badSlug].map((answer) => ({ isError: answer.isError, error: body(answer)?.error ?? answer.content?.[0]?.text }))
    check('tool input that fails the schema gives invalid-args with message and a nextStep to widget_describe',
      schemaErrors.every(({ isError, error }) => isError === true && error?.code === 'invalid-args' && typeof error.message === 'string' && error.message !== '' && /widget_describe/.test(error.nextStep ?? '')),
      JSON.stringify(schemaErrors))

    const unknown = await client.callTool({ name: 'widget_call', arguments: { slug: 'ghost', action: 'get' } })
    const error = body(unknown)?.error
    check('a tool error gives code, message, and nextStep', unknown.isError === true && error?.code === 'unknown-widget' && typeof error.message === 'string' && typeof error.nextStep === 'string', JSON.stringify(error))
  } finally {
    await client.close()
  }

  const initialize = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'raw', version: '0' } } })
  const raw = (headers) => fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers }, body: initialize })
  const withOrigin = await raw({ authorization: `Bearer ${String(token)}`, origin: base })
  check('a request with an Origin header gets 403', withOrigin.status === 403, String(withOrigin.status))
  const withFetchSite = await raw({ authorization: `Bearer ${String(token)}`, 'sec-fetch-site': 'same-origin' })
  check('a request with a Sec-Fetch-Site header gets 403', withFetchSite.status === 403, String(withFetchSite.status))
  const noToken = await raw({})
  check('a request with no token gets 401', noToken.status === 401, String(noToken.status))
  const badToken = await raw({ authorization: 'Bearer not-a-token' })
  check('a bad token gets 401', badToken.status === 401, String(badToken.status))
  // fetch cannot set Host; node:http can.
  const auth = { authorization: `Bearer ${String(token)}` }
  const badHost = await rawHttp(`${base}/mcp`, { ...auth, host: 'evil.example' }, initialize)
  check('a request whose Host is not loopback gets 403', badHost === 403, String(badHost))
  const badHostToken = await rawHttp(`${base}/mcp/token`, { host: 'evil.example' }, JSON.stringify({ agent: 'x' }))
  check('POST /mcp/token whose Host is not loopback gets 403', badHostToken === 403, String(badHostToken))
  const userinfo = await rawHttp(`${base}/mcp`, { ...auth, host: 'evil.com@127.0.0.1' }, initialize)
  const userinfoToken = await rawHttp(`${base}/mcp/token`, { host: 'evil.com@127.0.0.1' }, JSON.stringify({ agent: 'x' }))
  check('Host evil.com@127.0.0.1 gets 403 on /mcp and /mcp/token', userinfo === 403 && userinfoToken === 403, `/mcp ${String(userinfo)}, /mcp/token ${String(userinfoToken)}`)
  const tokenWithOrigin = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://evil.example' }, body: JSON.stringify({ agent: 'x' }) })
  check('POST /mcp/token with an Origin header gets 403', tokenWithOrigin.status === 403, String(tokenWithOrigin.status))

  // fence.non_loopback_bind: the real route handler, in the host, with a fake peer address.
  const inspector = await connectInspector(inspectPort)
  let peers
  try {
    peers = await inspector.run(CALL_ROUTE.replaceAll('HOST', JSON.stringify(`127.0.0.1:${String(port)}`)).replaceAll('CHALLENGE', JSON.stringify(challenge())))
  } finally {
    inspector.close()
  }
  check('the route handler refuses a peer 192.168.1.5 with 403 on /mcp and /mcp/token', peers?.lanMcp === 403 && peers?.lanToken === 403, JSON.stringify(peers))
  check('the route handler lets a peer ::ffff:127.0.0.1 through (/mcp 401 with no token, /mcp/token 200)', peers?.mappedMcp === 401 && peers?.mappedToken === 200, JSON.stringify(peers))

  // token.unbounded: the file keeps the newest 64 agents; the oldest token is dropped.
  const more = []
  for (let i = 0; i < 64; i += 1) {
    const answer = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: `cap-${String(i)}`, challenge: challenge() }) })
    more.push((await answer.json().catch(() => null))?.token)
  }
  let rows
  try { rows = Object.keys(JSON.parse(readFileSync(tokenFile, 'utf8'))).length } catch { rows = undefined }
  const oldest = await raw({ authorization: `Bearer ${String(token)}` })
  const keptOldest = await raw({ authorization: `Bearer ${String(more[0])}` })
  const newest = await raw({ authorization: `Bearer ${String(more.at(-1))}` })
  check('65 tokens keep the newest 64: the first token gets 401, the others work, the file has 64 rows',
    more.every((t) => typeof t === 'string') && oldest.status === 401 && keptOldest.status !== 401 && newest.status !== 401 && rows === 64,
    `first ${String(oldest.status)}, second ${String(keptOldest.status)}, last ${String(newest.status)}, rows ${String(rows)}`)
}

let exitCode = 1
try {
  await main()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-mcp: pass')
    exitCode = 0
  } else {
    console.log(`widgets-mcp: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-mcp: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  child?.kill('SIGKILL')
}
process.exit(exitCode)
