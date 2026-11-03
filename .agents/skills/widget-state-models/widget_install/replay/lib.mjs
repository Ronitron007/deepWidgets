// Replay harness: a CLI host of this checkout (build it first), driven over MCP as tools/widgets-create.mjs does,
// plus the host inspector as tools/widgets-runtime.mjs does.
import { spawn } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

// The checkout that holds this skill: replay -> widget_install -> widget-state-models -> skills -> .agents -> root.
export const ROOT = fileURLToPath(new URL('../../../../../', import.meta.url))
const BIN = join(ROOT, 'apps/cli/lib/bin.js')
const requireFromMcp = createRequire(join(ROOT, 'deepwidgets/mcp/package.json'))
const { Client, StreamableHTTPClientTransport } = await import(pathToFileURL(requireFromMcp.resolve('@modelcontextprotocol/client')).href)

export function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { const { port } = server.address(); server.close(() => resolve(port)) })
  })
}

export class Host {
  constructor(work) { this.work = work; this.home = join(work, 'home'); this.log = join(work, 'host.log') }
  async start(env = {}) {
    if (this.port === undefined) { this.port = await freePort(); this.inspectPort = await freePort() }
    if (this.port === 47615 || this.inspectPort === 47615) throw new Error('refusing port 47615')
    mkdirSync(this.home, { recursive: true })
    const out = createWriteStream(this.log, { flags: 'a' })
    this.child = spawn(process.execPath, [`--inspect=127.0.0.1:${this.inspectPort}`, BIN, '--profile', 'web', '--host', '127.0.0.1', '--port', String(this.port), '--no-open'], {
      cwd: this.home, env: { ...process.env, DSH_HOME: this.home, OPENUI_TELEMETRY_DISABLED: '1', ...env }, stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.exited = new Promise((resolve) => this.child.once('exit', (code, sig) => resolve({ code, sig })))
    this.child.stderr.pipe(out)
    await new Promise((resolve, reject) => {
      let text = ''
      const timer = setTimeout(() => reject(new Error('no URL in 90 s')), 90_000)
      this.child.stdout.on('data', (chunk) => { out.write(chunk); text += chunk; const m = text.match(/(http:\/\/127\.0\.0\.1:\d+\/\?token=\S+)/); if (m) { clearTimeout(timer); this.url = m[1]; resolve() } })
      this.child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`host exited ${code}`)) })
    })
    this.base = `http://127.0.0.1:${this.port}`
    const login = await fetch(this.url, { redirect: 'manual' })
    this.cookie = login.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
    this.client = await this.connect()
  }
  async connect() {
    const portFile = join(this.home, 'deepwidgets', 'mcp.json')
    for (let i = 0; i < 120; i += 1) {
      const challenge = randomBytes(16).toString('base64url')
      const answer = await fetch(`${this.base}/mcp/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ agent: 'FV Replay', challenge }) }).catch(() => undefined)
      if (answer?.status === 200) {
        const issued = await answer.json()
        const { nonce } = JSON.parse(readFileSync(portFile, 'utf8'))
        if (createHmac('sha256', nonce).update(challenge).digest('hex') !== issued.proof) throw new Error('bad proof')
        const client = new Client({ name: 'fv-replay', version: '0.0.0' })
        await client.connect(new StreamableHTTPClientTransport(new URL(`${this.base}/mcp`), { requestInit: { headers: { authorization: `Bearer ${issued.token}` } } }))
        return client
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    throw new Error('no token')
  }
  async call(name, args = {}) {
    const answer = await this.client.callTool({ name, arguments: args }, undefined, { timeout: 300_000 })
    let body = answer.structuredContent
    if (body === undefined) { try { body = JSON.parse(answer.content?.[0]?.text ?? 'null') } catch { body = answer.content?.[0]?.text } }
    return { isError: answer.isError === true, body }
  }
  async programText(slug) {
    const answer = await fetch(`${this.base}/api/widgets/${slug}/program`, { headers: { cookie: this.cookie } })
    const body = await answer.json().catch(() => null)
    return { status: answer.status, text: body?.text ?? null, rev: body?.rev ?? null }
  }
  async list() { return (await this.call('widget_list')).body?.widgets ?? [] }
  async inspector() {
    const targets = await (await fetch(`http://127.0.0.1:${this.inspectPort}/json/list`)).json()
    const ws = new WebSocket(targets[0].webSocketDebuggerUrl)
    await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j) })
    let next = 0; const waiting = new Map()
    ws.addEventListener('message', (e) => { const m = JSON.parse(String(e.data)); const w = waiting.get(m.id); if (!w) return; waiting.delete(m.id); m.error ? w.j(new Error(m.error.message)) : m.result?.exceptionDetails ? w.j(new Error(m.result.exceptionDetails.exception?.description ?? 'eval failed')) : w.r(m.result) })
    const send = (method, params = {}) => { next += 1; const id = next; ws.send(JSON.stringify({ id, method, params })); return new Promise((r, j) => waiting.set(id, { r, j })) }
    const proto = await send('Runtime.evaluate', { expression: 'Function.prototype' })
    const fns = await send('Runtime.queryObjects', { prototypeObjectId: proto.result.objectId })
    const lp = await send('Runtime.callFunctionOn', { objectId: fns.objects.objectId, functionDeclaration: 'function () { const f = this.filter((fn) => fn.name === "Loader" && typeof fn.prototype?.showLog === "function" && typeof fn.prototype?.locate === "function"); if (f.length !== 1) throw new Error("Loader functions " + f.length); return f[0].prototype }' })
    const loaders = await send('Runtime.queryObjects', { prototypeObjectId: lp.result.objectId })
    await send('Runtime.callFunctionOn', { objectId: loaders.objects.objectId, functionDeclaration: 'function () { globalThis.__fv = { loader: this[0], ctx: this[0].ctx } }' })
    this.ws = ws
    return { send, run: async (body) => (await send('Runtime.evaluate', { expression: `(async (wc) => { ${body} })(globalThis.__fv)`, awaitPromise: true, returnByValue: true })).result.value, close: () => ws.close() }
  }
  async stop() {
    try { await this.client?.close() } catch {}
    try { this.ws?.close() } catch {}
    if (this.child === undefined || this.child.exitCode !== null || this.child.signalCode !== null) return
    this.child.kill('SIGTERM')
    const t = setTimeout(() => this.child.kill('SIGKILL'), 10_000)
    await this.exited; clearTimeout(t)
  }
  kill() { this.child?.kill('SIGKILL') }
}

const APPLY_END = '    ],\n  })\n}'
/** Write the template of `slug` into work/agent/<name>; `edit` changes src/index.ts. */
export function writeWidget(work, name, text, edit = (x) => x) {
  const dir = join(work, 'agent', name)
  mkdirSync(join(dir, 'src'), { recursive: true })
  writeFileSync(join(dir, 'src', 'index.ts'), edit(text))
  return dir
}
export const program = (label) => (text) => text.replace('"A counter"', `"${label}"`)
export const afterRegister = (code) => (text) => {
  if (!text.includes(APPLY_END)) throw new Error('template changed')
  return text.replace(APPLY_END, `    ],\n  })\n  ${code}\n}`)
}
export const imports = (line) => (text) => `${line}\n${text}`
export const compose = (...fs) => (x) => fs.reduce((v, f) => f(v), x)
export const short = (v) => JSON.stringify(v)?.slice(0, 700)

/** The checks of one replay. `done` prints the verdict and exits 0 only when each check passed. */
export function checks(label) {
  const results = []
  return {
    check(name, ok, detail = '') {
      results.push(Boolean(ok))
      console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail === '' ? '' : `: ${String(detail).slice(0, 600)}`}`)
    },
    done(work) {
      const failed = results.filter((ok) => !ok).length
      const pass = failed === 0 && results.length > 0
      console.log(`${label}: ${pass ? 'pass' : `fail: ${String(failed)} of ${String(results.length)} checks failed`} (work ${work})`)
      process.exitCode = pass ? 0 : 1
    },
  }
}

/** The widget registers 8 s after apply in the host, and at once in the test run of the gates. */
export const lateRegister = (text) => {
  if (!text.includes('  ctx.widgets.register({') || !text.includes(APPLY_END)) throw new Error('template changed')
  return text.replace('  ctx.widgets.register({', '  const register = (): void => {\n    ctx.widgets.register({')
    .replace(APPLY_END, "    ],\n  })\n  }\n  if ('setProgram' in ctx.widgets) ctx.timeout(register, 8_000)\n  else register()\n}")
}
/** The program record of `slug`, read in the host through the service `widgetRecords`. */
export const recordOf = (ins, slug) => ins.run(`const r = await wc.ctx.get('widgetRecords').programRecord(${JSON.stringify(slug)}); return r === undefined ? null : { rev: r.rev, text: r.text, seed: r.seed ?? null }`)
