#!/usr/bin/env node
/**
 * Check of the fixed MCP port, the port file, and the nonce (unit widget.mcp_port).
 * - port_file: a CLI host (web profile) on port P writes $DSH_HOME/deepwidgets/mcp.json with
 *   { port: P, nonce }, mode 0600. An agent reads the file, gets a token, and the token answer
 *   carries the same nonce. The agent then uses /mcp with the token.
 * - second_instance: the desktop app (tools/smoke-desktop.mjs with DEEPWIDGETS_MCP_PORT=P) starts
 *   while that host holds P. It must fail, and its log must show `listen EADDRINUSE` for P. The
 *   first host keeps serving with the same nonce.
 * - port_squat: the host stops and a fake server takes P. An agent that checks the nonce refuses
 *   the fake token. The mutant (an agent that does not check the nonce) accepts it, so the check
 *   can fail.
 * - setting: DEEPWIDGETS_MCP_PORT of the desktop Host gives the default, a set port, or a loud error.
 * Prints `widgets-mcp-port: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` and the desktop build first. It starts the desktop
 * app, so run it under the machine smoke lock.
 */
import { spawn } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const requireFromMcp = createRequire(join(ROOT, 'deepwidgets/mcp/package.json'))
const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(requireFromMcp.resolve('@modelcontextprotocol/client')).href)

const work = await mkdtemp(join(process.env.WIDGETS_MCP_PORT_TMP ?? tmpdir(), 'widgets-mcp-port-'))
const home = join(work, 'home')
const logPath = join(work, 'host.log')
const portFile = join(home, 'deepwidgets', 'mcp.json')
const results = []
const children = new Set()

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Start a CLI host (web profile) on `port`. Resolves when the host prints its URL. */
async function startHost(port) {
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(logPath, { flags: 'a' })
  const child = spawn(process.execPath, [BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  child.once('exit', () => { children.delete(child) })
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
  return child
}

/** Wait until `file` exists and parses as JSON. The port file is written after the route is live. */
async function waitForJson(file, ms) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try { return JSON.parse(readFileSync(file, 'utf8')) } catch { await sleep(250) }
  }
  return undefined
}

/**
 * The agent side of `standing.hard.port_squat`: read the port file, ask for a token, and compare
 * the nonce of the answer with the nonce of the file before the token is used.
 * @param checkNonce - false is the mutant: the agent trusts any server on the port.
 * @returns { token, port, nonce } of the accepted answer.
 * @throws when the answer nonce is not the file nonce (with checkNonce), or the request fails.
 */
async function agentToken(file, checkNonce) {
  const { port, nonce } = JSON.parse(readFileSync(file, 'utf8'))
  if (!Number.isInteger(port) || typeof nonce !== 'string' || nonce === '') throw new Error(`the port file ${file} is not { port, nonce }`)
  const answer = await fetch(`http://127.0.0.1:${String(port)}/mcp/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agent: 'Port Check Agent' }),
    signal: AbortSignal.timeout(10_000),
  })
  const body = await answer.json().catch(() => null)
  if (answer.status !== 200 || typeof body?.token !== 'string') throw new Error(`POST /mcp/token gave ${String(answer.status)}`)
  if (checkNonce && body.nonce !== nonce) {
    throw new Error(`nonce mismatch: the server on port ${String(port)} is not the host that wrote ${file}; the token was not used`)
  }
  return { token: body.token, port, nonce: body.nonce }
}

/** Run tools/smoke-desktop.mjs with `env`; gives its exit code, its output, and its temp folder. */
async function runSmoke(env, smokeTmp) {
  mkdirSync(smokeTmp, { recursive: true })
  const child = spawn(process.execPath, [join(ROOT, 'tools/smoke-desktop.mjs')], {
    cwd: ROOT,
    env: { ...process.env, ...env, TMPDIR: smokeTmp },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk })
  child.stderr.on('data', (chunk) => { output += chunk })
  const code = await new Promise((resolve) => { child.once('exit', (exit) => { children.delete(child); resolve(exit) }) })
  const folder = readdirSync(smokeTmp).find((name) => name.startsWith('deepwidgets-smoke-desktop-'))
  return { code, output: output.trim(), folder: folder === undefined ? undefined : join(smokeTmp, folder) }
}

/** The port setting of the desktop Host: default, `0`, a number, and bad values that must stop the Host. */
async function settingChecks() {
  const { resolveMcpPort, DEFAULT_MCP_PORT } = await import(pathToFileURL(join(ROOT, 'apps/desktop-host/src/mcp-port.ts')).href)
  const good = [[undefined, DEFAULT_MCP_PORT], ['', DEFAULT_MCP_PORT], ['0', 0], ['48000', 48000], [' 47615 ', 47615]]
  const bad = ['abc', '-1', '1.5', '65536', '0x10', '1e3']
  const throws = (value) => { try { resolveMcpPort({ DEEPWIDGETS_MCP_PORT: value }); return false } catch { return true } }
  check('DEEPWIDGETS_MCP_PORT: unset gives the default 47615, numbers give that port, bad values throw',
    DEFAULT_MCP_PORT === 47615 && good.every(([value, port]) => resolveMcpPort(value === undefined ? {} : { DEEPWIDGETS_MCP_PORT: value }) === port) && bad.every(throws),
    JSON.stringify(bad.map((value) => [value, throws(value)])))
}

async function main() {
  await settingChecks()
  const port = await freePort()
  console.log(`widgets-mcp-port: work folder ${work}, port ${String(port)}`)
  const host = await startHost(port)

  // port_file
  const file = await waitForJson(portFile, 60_000)
  let mode
  try { mode = statSync(portFile).mode & 0o777 } catch { mode = undefined }
  check('the host writes $DSH_HOME/deepwidgets/mcp.json as { port, nonce } with mode 0600',
    file?.port === port && typeof file?.nonce === 'string' && file.nonce.length >= 16 && Object.keys(file).sort().join() === 'nonce,port' && mode === 0o600,
    `${JSON.stringify(file === undefined ? null : { ...file, nonce: file.nonce === undefined ? undefined : '<set>' })} mode ${mode === undefined ? 'missing' : mode.toString(8)}`)
  let issued
  try { issued = await agentToken(portFile, true) } catch (error) { check('an agent reads mcp.json and gets a token whose answer carries the file nonce', false, error.message) }
  if (issued !== undefined) {
    check('an agent reads mcp.json and gets a token whose answer carries the file nonce', issued.nonce === file.nonce && issued.port === port)
    const client = new Client({ name: 'widgets-mcp-port-check', version: '0.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${String(port)}/mcp`), { requestInit: { headers: { authorization: `Bearer ${issued.token}` } } })
    let tools = []
    try {
      await client.connect(transport)
      tools = (await client.listTools()).tools.map((tool) => tool.name)
    } catch (error) {
      console.log(`  /mcp failed: ${error.message}`)
    } finally {
      await client.close().catch(() => {})
    }
    check('the agent uses /mcp with that token', tools.includes('widget_list'), JSON.stringify(tools))
  }

  // second_instance: the desktop app with the same fixed port.
  const smoke = await runSmoke({ DEEPWIDGETS_MCP_PORT: String(port), DSH_SMOKE_TIMEOUT_MS: process.env.WIDGETS_MCP_PORT_SMOKE_TIMEOUT_MS ?? '60000' }, join(work, 'smoke'))
  const desktopLog = smoke.folder !== undefined && existsSync(join(smoke.folder, 'desktop.log')) ? readFileSync(join(smoke.folder, 'desktop.log'), 'utf8') : ''
  const inUse = desktopLog.split('\n').find((line) => /\blisten EADDRINUSE\b/u.test(line) && line.includes(`:${String(port)}`))
  console.log(`  desktop smoke: exit ${String(smoke.code)}, ${smoke.output.split('\n').at(-1) ?? ''}, log ${smoke.folder === undefined ? 'missing' : join(smoke.folder, 'desktop.log')}`)
  check('a second app instance on the same fixed port fails loudly with listen EADDRINUSE for that port', smoke.code !== 0 && inUse !== undefined, inUse?.trim().slice(0, 200) ?? 'no EADDRINUSE line in the desktop log')
  let after
  try { after = await agentToken(portFile, true) } catch (error) { console.log(`  first host after the second start: ${error.message}`) }
  check('the first host still serves with the same nonce', after?.nonce === file?.nonce && host.exitCode === null)

  // port_squat: the host stops; a fake server takes the port; the port file is stale or restored.
  const stale = readFileSync(portFile, 'utf8')
  host.kill('SIGKILL')
  await new Promise((resolve) => { if (host.exitCode !== null || host.signalCode !== null) resolve(); else host.once('exit', resolve) })
  const fakes = [
    ['with no nonce', () => ({ token: 'fake-token', agentId: 'fake' })],
    ['with another nonce', () => ({ token: 'fake-token', agentId: 'fake', nonce: 'not-the-host-nonce' })],
  ]
  for (const [label, answer] of fakes) {
    const fake = createHttpServer((req, res) => {
      req.resume()
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(answer()))
    })
    await new Promise((resolve, reject) => { fake.once('error', reject); fake.listen(port, '127.0.0.1', resolve) })
    try {
      let refused
      try { await agentToken(portFile, true) } catch (error) { refused = error.message }
      check(`a fake server ${label} on the port: the agent refuses its token`, refused?.startsWith('nonce mismatch') === true, refused ?? 'accepted')
      let mutant
      try { mutant = await agentToken(portFile, false) } catch (error) { mutant = error.message }
      check(`mutant (nonce not checked) against the fake server ${label}: the fake token is accepted, so the check can fail`, mutant?.token === 'fake-token', JSON.stringify(mutant))
    } finally {
      await new Promise((resolve) => fake.close(resolve))
    }
  }
  check('the stale port file stayed in place for the squat checks', readFileSync(portFile, 'utf8') === stale)
}

let exitCode = 1
try {
  await main()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('widgets-mcp-port: pass')
    exitCode = 0
  } else {
    console.log(`widgets-mcp-port: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`widgets-mcp-port: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  for (const child of children) child.kill('SIGKILL')
}
process.exit(exitCode)
