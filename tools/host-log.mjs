#!/usr/bin/env node
/**
 * Check of the host log (unit host.log, spec safe_host.log).
 * Host part: it boots the CLI host (web profile) on a free loopback port with a new home. It makes the folder
 * $DSH_HOME/deepwidgets read-only and asks for a token. @deepwidgets/mcp can not write the token file, so it answers
 * 500 and logs one error line through ctx.logger. The check finds that line in the stdout of the host.
 * Window part: it runs tools/smoke-desktop.mjs with DSH_SMOKE_LOG=1, which does the same in the app and finds the
 * line in the output of `start:desktop`. Skip the window part with HOST_LOG_DESKTOP=0. It needs the machine lock of
 * the smoke checks.
 * Prints `host-log: pass` and exits 0 only when every check passes.
 * Needs `corepack pnpm run build:artifacts` (and the desktop build for the window part) first.
 */
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, createWriteStream, mkdirSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
/** The error line of `issueToken` in deepwidgets/mcp/src/index.ts, as the console exporter prints it. Same pattern as tools/smoke-desktop.mjs. */
const TOKEN_LOG_LINE = /\[E\] .*mcp: the token file \S+mcp-tokens\.json was not written; no token was issued/u

const work = await mkdtemp(join(process.env.HOST_LOG_TMP ?? tmpdir(), 'host-log-'))
const home = join(work, 'home')
const logPath = join(work, 'host.log')
const results = []
let child
let stdout = ''

function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok) })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${detail}`}`)
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
    const timer = setTimeout(() => reject(new Error('the host did not print its URL in 90 s')), 90_000)
    child.stdout.on('data', (chunk) => {
      out.write(chunk)
      stdout += chunk
      if (/http:\/\/127\.0\.0\.1:\d+\/\?token=\S+/.test(stdout)) { clearTimeout(timer); resolve() }
    })
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`the host exited with ${String(code)}`)) })
  })
}

function requestToken(base) {
  return fetch(`${base}/mcp/token`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'host-log check', challenge: randomBytes(16).toString('base64url') }),
  })
}

async function hostPart() {
  const port = await freePort()
  await startHost(port)
  const base = `http://127.0.0.1:${String(port)}`
  // The bundles load after the URL prints; wait for the /mcp route.
  let first
  for (let i = 0; i < 60; i += 1) {
    first = await requestToken(base)
    if (first.status !== 404) break
    await delay(500)
  }
  check('POST /mcp/token gives a token', first.status === 200, String(first.status))

  const folder = join(home, 'deepwidgets')
  chmodSync(folder, 0o500)
  let refused
  try {
    refused = await requestToken(base)
  } finally {
    chmodSync(folder, 0o700)
  }
  check('POST /mcp/token gets 500 while the token folder is read-only', refused.status === 500, String(refused.status))
  for (let i = 0; i < 50 && !TOKEN_LOG_LINE.test(stdout); i += 1) await delay(100)
  const line = stdout.split('\n').find((text) => TOKEN_LOG_LINE.test(text))
  check('the stdout of the host has the ctx.logger line of @deepwidgets/mcp', line !== undefined, line ?? 'no line "[E] ... mcp: the token file ... was not written; no token was issued"')
}

async function desktopPart() {
  const smoke = spawn(process.execPath, [join(ROOT, 'tools/smoke-desktop.mjs')], { env: { ...process.env, DSH_SMOKE_LOG: '1' }, stdio: ['ignore', 'pipe', 'pipe'] })
  let text = ''
  smoke.stdout.on('data', (chunk) => { text += chunk })
  smoke.stderr.on('data', (chunk) => { text += chunk })
  const code = await new Promise((resolve) => smoke.once('close', resolve))
  const last = text.trim().split('\n').slice(-3).join(' | ')
  check('desktop: the output of start:desktop has the ctx.logger line of @deepwidgets/mcp', code === 0, `smoke exit ${String(code)}: ${last}`)
}

let exitCode = 1
try {
  await hostPart()
  if (process.env.HOST_LOG_DESKTOP !== '0') await desktopPart()
  const failed = results.filter((r) => !r.ok).length
  if (failed === 0 && results.length > 0) {
    console.log('host-log: pass')
    exitCode = 0
  } else {
    console.log(`host-log: fail: ${String(failed)} of ${String(results.length)} checks failed (host log ${logPath})`)
  }
} catch (error) {
  console.log(`host-log: fail: ${error instanceof Error ? error.stack : String(error)} (host log ${logPath})`)
} finally {
  child?.kill('SIGKILL')
}
process.exit(exitCode)
