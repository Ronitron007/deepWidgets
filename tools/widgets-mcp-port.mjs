#!/usr/bin/env node
/**
 * Check of the fixed MCP port, the port file, and the token handshake (unit widget.mcp_port).
 * - setting: DEEPWIDGETS_MCP_PORT of the desktop Host gives the default, a set port, or a loud error.
 * - port_file: a CLI host (web profile) on port P writes $DSH_HOME/deepwidgets/mcp.json with
 *   { port: P, nonce, pid }, mode 0600. An agent reads the file, sends a random challenge to
 *   POST /mcp/token, and checks proof = HMAC-SHA256(nonce, challenge). The answer has no nonce.
 * - owner: a second CLI host on the same home does not overwrite the file of a live host, and its
 *   stop does not remove it.
 * - second_instance: the desktop app (tools/smoke-desktop.mjs with DEEPWIDGETS_MCP_PORT=P) starts
 *   while the first host holds P. It fails with `listen EADDRINUSE` for P, and Electron main keeps
 *   a port file whose owner is alive.
 * - clean_stop: SIGTERM of the host removes its port file.
 * - pid_reuse: a file whose pid is alive but whose start time differs is not owned; a new host replaces it.
 * - epoch: a token of an earlier host start gets 401 after a restart.
 * - replay: an attacker that never reads the file records a token answer; the host is SIGKILLed;
 *   the file stays; a fake server on P replays or echoes. The agent refuses each fake token. The
 *   mutant agent (no proof check) accepts it, so the check can fail.
 * - crash_cleanup: the desktop app fails on P while its home holds a port file of a dead host (its pid
 *   reused by a live process with another start time); Electron main removes the file.
 * Prints `widgets-mcp-port: pass` and exits 0 only when every check passes.
 * WIDGETS_MCP_PORT_SKIP_DESKTOP=1 skips second_instance and crash_cleanup (for quick mutant runs;
 * the run then does not pass).
 * Needs `corepack pnpm run build:artifacts` and the desktop build first. It starts the desktop
 * app, so run it under the machine smoke lock.
 */
import { spawn } from 'node:child_process'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer as createHttpServer, request as httpRequest } from 'node:http'
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
const skipDesktop = process.env.WIDGETS_MCP_PORT_SKIP_DESKTOP === '1'
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
const challenge = () => randomBytes(16).toString('base64url')
const proofOf = (nonce, text) => createHmac('sha256', nonce).update(text).digest('hex')
const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return undefined } }

/** Start a CLI host (web profile) on `port` with DSH_HOME `home`. Resolves when the host prints its URL. */
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

function stopped(child) {
  return new Promise((resolve) => { if (child.exitCode !== null || child.signalCode !== null) resolve(); else child.once('exit', () => resolve()) })
}

/** Wait until `test()` is true, or `ms` pass. Gives the last value of `test()`. */
async function waitFor(test, ms) {
  const end = Date.now() + ms
  let value = test()
  while (!value && Date.now() < end) {
    await sleep(250)
    value = test()
  }
  return value
}

/**
 * POST /mcp/token on `port` with `body`; gives the status and the JSON answer. Each request uses a
 * new connection: the servers on the port change during the check, and a pooled keep-alive socket
 * of a closed server fails the next request.
 */
function postToken(port, body) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(`http://127.0.0.1:${String(port)}/mcp/token`, {
      method: 'POST', agent: false, timeout: 10_000,
      headers: { 'content-type': 'application/json', connection: 'close' },
    }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (chunk) => { text += chunk })
      res.on('end', () => {
        let parsed = null
        try { parsed = JSON.parse(text) } catch { /* not JSON */ }
        resolve({ status: res.statusCode, body: parsed })
      })
    })
    req.once('timeout', () => req.destroy(new Error('POST /mcp/token timed out')))
    req.once('error', reject)
    req.end(JSON.stringify(body))
  })
}

/**
 * The agent side of `standing.hard.port_squat`, as deepwidgets/mcp/README.md tells it: read the port
 * file, send a random challenge, and check proof = HMAC-SHA256(nonce, challenge) before the token is used.
 * @param checkProof - false is the mutant: the agent trusts any server on the port.
 * @returns { token, port, answer } of the accepted answer.
 * @throws when the proof is wrong (with checkProof), or the request fails.
 */
async function agentToken(file, checkProof) {
  const { port, nonce } = JSON.parse(readFileSync(file, 'utf8'))
  if (!Number.isInteger(port) || typeof nonce !== 'string' || nonce === '') throw new Error(`the port file ${file} is not { port, nonce, pid }`)
  const sent = challenge()
  const { status, body } = await postToken(port, { agent: 'Port Check Agent', challenge: sent })
  if (status !== 200 || typeof body?.token !== 'string') throw new Error(`POST /mcp/token gave ${String(status)}`)
  if (checkProof) {
    const expected = Buffer.from(proofOf(nonce, sent))
    const got = Buffer.from(typeof body.proof === 'string' ? body.proof : '')
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) {
      throw new Error(`proof mismatch: the server on port ${String(port)} is not the host that wrote ${file}; the token was not used`)
    }
  }
  return { token: body.token, port, answer: body }
}

/** Run tools/smoke-desktop.mjs with `env`. `seed(home)` runs once the smoke home folder exists. */
async function runSmoke(env, smokeTmp, seed) {
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
  const exited = new Promise((resolve) => { child.once('exit', (exit) => { children.delete(child); resolve(exit) }) })
  const folderOf = () => readdirSync(smokeTmp).find((name) => name.startsWith('deepwidgets-smoke-desktop-'))
  // The smoke makes its home before it starts the app; the Host starts many seconds later.
  const folder = await waitFor(() => { const name = folderOf(); return name !== undefined && existsSync(join(smokeTmp, name, 'home')) ? join(smokeTmp, name) : undefined }, 30_000)
  if (folder !== undefined) seed?.(join(folder, 'home'))
  const code = await exited
  const desktopLog = folder !== undefined && existsSync(join(folder, 'desktop.log')) ? readFileSync(join(folder, 'desktop.log'), 'utf8') : ''
  return { code, output: output.trim(), folder, desktopLog }
}

/** The desktop app with DEEPWIDGETS_MCP_PORT=port while that port is taken. Gives the EADDRINUSE line and the smoke home. */
async function desktopOnTakenPort(port, label, seed) {
  // The default smoke bound (240 s): a first launch of a fresh worktree prepares its runtime first.
  const smoke = await runSmoke({ DEEPWIDGETS_MCP_PORT: String(port) }, join(work, label), seed)
  const inUse = smoke.desktopLog.split('\n').find((line) => /\blisten EADDRINUSE\b/u.test(line) && line.includes(`:${String(port)}`))
  const started = /desktop development: DSH_HOME=|Electron|dsh desktop/u.test(smoke.desktopLog)
  console.log(`  desktop ${label}: exit ${String(smoke.code)}, ${smoke.output.split('\n').at(-1) ?? ''}, app started ${String(started)}, log ${smoke.folder === undefined ? 'missing' : join(smoke.folder, 'desktop.log')}`)
  return { smoke, inUse, started }
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

  // port_file
  const first = await startHost(port)
  const file = await waitFor(() => readJson(portFile), 60_000)
  let mode
  try { mode = statSync(portFile).mode & 0o777 } catch { mode = undefined }
  check('the host writes $DSH_HOME/deepwidgets/mcp.json as { port, nonce, pid, started } with mode 0600',
    file?.port === port && file?.pid === first.pid && typeof file?.nonce === 'string' && file.nonce.length >= 16 && Math.abs((file?.started ?? 0) - Date.now()) < 300_000 && Object.keys(file).sort().join() === 'nonce,pid,port,started' && mode === 0o600,
    `${JSON.stringify(file === undefined ? null : { ...file, nonce: file.nonce === undefined ? undefined : '<set>' })} mode ${mode === undefined ? 'missing' : mode.toString(8)}`)
  let issued
  try { issued = await agentToken(portFile, true) } catch (error) { console.log(`  agent: ${error.message}`) }
  check('an agent reads mcp.json, sends a challenge, and the answer proof is HMAC-SHA256(nonce, challenge)', issued !== undefined && issued.port === port)
  check('the token answer has no nonce: it is only { token, agentId, proof }', issued !== undefined && Object.keys(issued.answer).sort().join() === 'agentId,proof,token' && !JSON.stringify(issued.answer).includes(file?.nonce ?? '\0'), JSON.stringify(Object.keys(issued?.answer ?? {})))
  const noChallenge = await postToken(port, { agent: 'No Challenge' })
  const shortChallenge = await postToken(port, { agent: 'Short Challenge', challenge: 'abc' })
  check('POST /mcp/token without a challenge of at least 16 bytes gets 400', noChallenge.status === 400 && shortChallenge.status === 400, `${String(noChallenge.status)} ${String(shortChallenge.status)}`)
  if (issued !== undefined) {
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

  // owner: a second host on the same home and another port.
  const before = readFileSync(portFile, 'utf8')
  const second = await startHost(await freePort())
  await sleep(3_000)
  check('a second host on the same home does not overwrite the file of the live host', readFileSync(portFile, 'utf8') === before)
  second.kill('SIGTERM')
  await stopped(second)
  check('the stop of the second host leaves the file of the live host', readFileSync(portFile, 'utf8') === before)

  // second_instance: the desktop app on the same port while the first host holds it.
  if (!skipDesktop) {
    const live = readFileSync(portFile, 'utf8')
    let seeded
    const run = await desktopOnTakenPort(port, 'second-instance', (smokeHome) => {
      mkdirSync(join(smokeHome, 'deepwidgets'), { recursive: true, mode: 0o700 })
      seeded = join(smokeHome, 'deepwidgets', 'mcp.json')
      writeFileSync(seeded, live, { mode: 0o600 })
    })
    check('the desktop app reached its Host start', run.started, run.started ? '' : 'no app output in the desktop log')
    check('a second app instance on the same fixed port fails loudly with listen EADDRINUSE for that port', run.smoke.code !== 0 && run.inUse !== undefined, run.inUse?.trim().slice(0, 200) ?? 'no EADDRINUSE line in the desktop log')
    check('Electron main keeps a port file whose owner is alive', seeded !== undefined && existsSync(seeded) && readFileSync(seeded, 'utf8') === live)
    let after
    try { after = await agentToken(portFile, true) } catch (error) { console.log(`  first host after the second start: ${error.message}`) }
    check('the first host still serves with a valid proof', after !== undefined && first.exitCode === null)
  }

  // clean_stop
  first.kill('SIGTERM')
  await stopped(first)
  check('SIGTERM of the host removes its port file', await waitFor(() => !existsSync(portFile), 10_000))

  // pid_reuse: a live pid (this check process) with another start time does not own the file.
  writeFileSync(portFile, `${JSON.stringify({ port: 1, nonce: 'reused-pid-file-nonce', pid: process.pid, started: 1 })}\n`, { mode: 0o600 })
  // replay: the reviewer's case. The attacker never reads the file.
  const third = await startHost(port)
  check('a file whose pid is alive with another start time is replaced by the new host', await waitFor(() => readJson(portFile)?.pid === third.pid, 60_000), JSON.stringify(readJson(portFile)?.pid))
  // epoch: the token of the first host start is void on this start.
  if (issued !== undefined) {
    const auth = (token) => new Promise((resolve, reject) => {
      const req = httpRequest(`http://127.0.0.1:${String(port)}/mcp`, {
        method: 'POST', agent: false,
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}`, connection: 'close' },
      }, (res) => { res.resume(); resolve({ status: res.statusCode }) })
      req.once('error', reject)
      req.end(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'epoch', version: '0' } } }))
    })
    const old = await auth(issued.token)
    let fresh
    try { fresh = await agentToken(portFile, true) } catch (error) { console.log(`  new handshake: ${error.message}`) }
    const now = fresh === undefined ? undefined : await auth(fresh.token)
    check('after a restart a token of the earlier start gets 401, and a new handshake gives a working token', old.status === 401 && now?.status === 200, `old ${String(old.status)}, new ${String(now?.status)}`)
  }
  const recorded = await postToken(port, { agent: 'Attacker', challenge: challenge() })
  third.kill('SIGKILL')
  await stopped(third)
  const stale = readFileSync(portFile, 'utf8')
  check('after SIGKILL the port file stays (stale)', readJson(portFile)?.pid === third.pid)
  const fakes = [
    ['that replays a recorded answer (and any nonce it leaked)', (sent) => ({ ...recorded.body, token: 'fake-token', ...(typeof recorded.body?.nonce === 'string' ? { proof: proofOf(recorded.body.nonce, sent) } : {}) })],
    ['that echoes the challenge as the proof', (sent) => ({ token: 'fake-token', agentId: 'fake', proof: sent, nonce: sent, challenge: sent })],
    ['with no proof', () => ({ token: 'fake-token', agentId: 'fake' })],
  ]
  for (const [label, answer] of fakes) {
    const fake = createHttpServer(async (req, res) => {
      let text = ''
      for await (const chunk of req) text += chunk
      let sent = ''
      try { sent = String(JSON.parse(text).challenge ?? '') } catch { /* no body */ }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(answer(sent)))
    })
    await new Promise((resolve, reject) => { fake.once('error', reject); fake.listen(port, '127.0.0.1', resolve) })
    try {
      let refused
      try { await agentToken(portFile, true) } catch (error) { refused = error.message }
      check(`a fake server ${label}: the agent refuses its token`, refused?.startsWith('proof mismatch') === true, refused ?? 'accepted')
      let mutant
      try { mutant = await agentToken(portFile, false) } catch (error) { mutant = { error: error.message } }
      check(`mutant (proof not checked) against the fake server ${label}: the fake token is accepted, so the check can fail`, mutant?.token === 'fake-token', JSON.stringify(mutant?.token ?? mutant))
    } finally {
      await new Promise((resolve) => fake.close(resolve))
    }
  }
  check('the stale port file stayed in place for the replay checks', readFileSync(portFile, 'utf8') === stale)

  // crash_cleanup: the desktop app fails on a taken port while its home holds a dead host's file.
  if (!skipDesktop) {
    const squatter = createServer()
    await new Promise((resolve, reject) => { squatter.once('error', reject); squatter.listen(port, '127.0.0.1', resolve) })
    let seeded
    try {
      const run = await desktopOnTakenPort(port, 'crash-cleanup', (smokeHome) => {
        mkdirSync(join(smokeHome, 'deepwidgets'), { recursive: true, mode: 0o700 })
        seeded = join(smokeHome, 'deepwidgets', 'mcp.json')
        // The dead host's pid, as if reused by a live process (this check) with another start time.
        writeFileSync(seeded, `${JSON.stringify({ ...JSON.parse(stale), pid: process.pid, started: 1 })}\n`, { mode: 0o600 })
      })
      check('crash_cleanup: the app fails with listen EADDRINUSE', run.smoke.code !== 0 && run.inUse !== undefined, run.inUse?.trim().slice(0, 200) ?? `app started ${String(run.started)}`)
      check('Electron main removes a port file whose owner is dead (pid reused, start time differs) when its Host fails', seeded !== undefined && !existsSync(seeded))
    } finally {
      await new Promise((resolve) => squatter.close(resolve))
    }
  } else {
    check('desktop checks skipped (WIDGETS_MCP_PORT_SKIP_DESKTOP=1)', false)
  }
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
