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
import { createWriteStream, mkdirSync, statSync } from 'node:fs'
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
  child = spawn(process.execPath, [BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
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

/** Parse the JSON body of one tool answer. */
function body(result) {
  return result.structuredContent ?? JSON.parse(result.content?.[0]?.text ?? 'null')
}

async function main() {
  const port = await freePort()
  const base = `http://127.0.0.1:${String(port)}`
  console.log(`widgets-mcp: work folder ${work}, port ${String(port)}`)
  await startHost(port)

  // The bundles load after the URL prints; wait for the /mcp route.
  let tokenAnswer
  for (let i = 0; i < 60; i += 1) {
    tokenAnswer = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'Check Agent' }) })
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
    const tools = (await client.listTools()).tools.map((tool) => tool.name).sort()
    check('tools are widget_call, widget_changes, widget_describe, widget_list', JSON.stringify(tools) === JSON.stringify(['widget_call', 'widget_changes', 'widget_describe', 'widget_list']), JSON.stringify(tools))

    const list = body(await client.callTool({ name: 'widget_list', arguments: {} }))
    check('widget_list names sample', list?.widgets?.some((widget) => widget.slug === 'sample'), JSON.stringify(list?.widgets))

    const before = body(await client.callTool({ name: 'widget_call', arguments: { slug: 'sample', action: 'get' } }))
    const added = body(await client.callTool({ name: 'widget_call', arguments: { slug: 'sample', action: 'add', args: { by: 1 }, requestId: 'mcp-check-1' } }))
    const after = body(await client.callTool({ name: 'widget_call', arguments: { slug: 'sample', action: 'get' } }))
    check('widget_call add adds 1', typeof before?.result?.count === 'number' && after?.result?.count === before.result.count + 1 && added?.rev === after?.rev, `${String(before?.result?.count)} -> ${String(after?.result?.count)}`)

    const changes = body(await client.callTool({ name: 'widget_changes', arguments: { since: list.cursor } }))
    const change = changes?.changes?.find((item) => item.slug === 'sample' && item.kind === 'state' && item.action === 'add')
    check('widget_changes shows the change with by set to the agent', change !== undefined && change.by === agentId, JSON.stringify(changes?.changes))

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
  const badHost = await new Promise((resolve, reject) => {
    const req = httpRequest(`${base}/mcp`, { method: 'POST', headers: { host: 'evil.example', authorization: `Bearer ${String(token)}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' } }, (res) => { res.resume(); resolve(res.statusCode) })
    req.once('error', reject)
    req.end(initialize)
  })
  check('a request whose Host is not loopback gets 403', badHost === 403, String(badHost))
  const tokenWithOrigin = await fetch(`${base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://evil.example' }, body: JSON.stringify({ agent: 'x' }) })
  check('POST /mcp/token with an Origin header gets 403', tokenWithOrigin.status === 403, String(tokenWithOrigin.status))
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
