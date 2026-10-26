// Start the real DSH CLI host (web profile) on one port, log in, and give fetch helpers.
import { spawn } from 'node:child_process'
import { mkdirSync, createWriteStream } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import net from 'node:net'

const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')

export const NOTES = process.env.WIDGETS_NOTES ?? fileURLToPath(new URL('./out/', import.meta.url))

export function portFree(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

export async function startHost({ port, home, env = {}, nodeArgs = [], log = 'host.log' }) {
  if (!(await portFree(port))) throw new Error(`port ${port} is taken`)
  mkdirSync(home, { recursive: true })
  const out = createWriteStream(join(NOTES, log), { flags: 'a' })
  const child = spawn(process.execPath, [...nodeArgs, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(port), '--no-open'], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home, DEEPWIDGETS_WIDGETS_DEV: '1', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  child.stderr.pipe(out)
  const started = Date.now()
  const url = await new Promise((resolve, reject) => {
    let text = ''
    const timer = setTimeout(() => reject(new Error(`host did not print its URL in 60s: ${text}`)), 60_000)
    child.stdout.on('data', (chunk) => {
      out.write(chunk)
      text += chunk
      const match = text.match(/(http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/)
      if (match) { clearTimeout(timer); resolve(match[1]) }
    })
    child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`host exited ${code}: ${text}`)) })
  })
  const bootMs = Date.now() - started
  const login = await fetch(url, { redirect: 'manual' })
  const cookie = login.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
  if (cookie === '') throw new Error(`login gave no cookie (${login.status})`)
  const base = `http://127.0.0.1:${port}`
  const api = (path, init = {}) => fetch(base + path, { ...init, headers: { cookie, ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } })
  const getJson = async (path) => { const r = await api(path); return { status: r.status, body: await r.json() } }
  const postJson = async (path, body) => { const r = await api(path, { method: 'POST', body: JSON.stringify(body) }); return { status: r.status, body: await r.json() } }
  const stop = () => new Promise((resolve) => {
    if (child.exitCode !== null) return resolve()
    child.once('exit', () => resolve())
    child.kill('SIGTERM')
    setTimeout(() => child.kill('SIGKILL'), 10_000).unref()
  })
  return { child, base, cookie, api, getJson, postJson, stop, bootMs }
}

/** Open one raw SSE stream; collects parsed `data:` frames. */
export function openStream(host, slug, { cookie = host.cookie, base = host.base } = {}) {
  const frames = []
  const controller = new AbortController()
  const waiters = []
  const done = (async () => {
    const response = await fetch(`${base}/api/widgets/${slug}/stream`, { headers: { cookie }, signal: controller.signal })
    if (!response.ok) throw new Error(`stream ${slug}: ${response.status}`)
    const decoder = new TextDecoder()
    let buffer = ''
    for await (const chunk of response.body) {
      buffer += decoder.decode(chunk, { stream: true })
      let index
      while ((index = buffer.indexOf('\n\n')) !== -1) {
        const block = buffer.slice(0, index)
        buffer = buffer.slice(index + 2)
        for (const line of block.split('\n')) {
          if (!line.startsWith('data: ')) continue
          const frame = { at: performance.now(), ...JSON.parse(line.slice(6)) }
          frames.push(frame)
          for (const waiter of [...waiters]) if (waiter.test(frame)) { waiters.splice(waiters.indexOf(waiter), 1); waiter.resolve(frame) }
        }
      }
    }
    return 'ended'
  })().catch((error) => (error.name === 'AbortError' ? 'aborted' : `error: ${error.message}`))
  return {
    frames,
    done,
    close: () => controller.abort(),
    next(test, ms = 5_000) {
      const found = frames.find(test)
      if (found) return Promise.resolve(found)
      return new Promise((resolve, reject) => {
        const waiter = { test, resolve }
        waiters.push(waiter)
        setTimeout(() => { const i = waiters.indexOf(waiter); if (i !== -1) { waiters.splice(i, 1); reject(new Error('stream wait timed out')) } }, ms)
      })
    },
  }
}

export function check(results, name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`)
}
