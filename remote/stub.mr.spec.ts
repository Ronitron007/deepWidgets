import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac, randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { request } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { startStub } from './stub/src/server.ts'

type Stub = Awaited<ReturnType<typeof startStub>>
type Reply = { status: number; body: string }
type Call = { tool: string; args: Record<string, unknown>; by: string }
type ToolResult = { isError?: boolean; structuredContent?: Record<string, unknown>; content?: unknown }
type PortFile = { port: number; nonce: string; pid: number; started: number }
type TokenAnswer = { token: string; agentId: string; proof: string }

const ALL_TOOLS = ['deepwidgets_modes', 'library_template', 'widget_call', 'widget_changes', 'widget_describe', 'widget_guide', 'widget_install', 'widget_list', 'widget_reload', 'widget_remove', 'widget_template']
const INIT = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'mr-raw', version: '0.0.0' } } })
const ACCEPT = 'application/json, text/event-stream'

let dshHome = ''
let stub: Stub
let clients: Client[] = []

function raw(port: number, opts: { method?: string; path: string; headers?: Record<string, string>; body?: string }): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, method: opts.method ?? 'GET', path: opts.path, headers: { 'content-type': 'application/json', ...opts.headers } }, (res) => {
      let text = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => { text += chunk })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: text }))
    })
    req.on('error', reject)
    req.end(opts.body)
  })
}

async function token(agent = 'remote:abc'): Promise<{ status: number; challenge: string; json: TokenAnswer }> {
  const challenge = randomBytes(16).toString('base64url')
  const r = await raw(stub.port, { method: 'POST', path: '/mcp/token', body: JSON.stringify({ agent, challenge }) })
  return { status: r.status, challenge, json: (r.status === 200 ? JSON.parse(r.body) : {}) as TokenAnswer }
}

async function readPortFile(): Promise<PortFile> {
  return JSON.parse(await readFile(join(dshHome, 'deepwidgets', 'mcp.json'), 'utf8')) as PortFile
}

async function connect(bearer: string): Promise<Client> {
  const client = new Client({ name: 'mr-stub-test', version: '0.0.0' })
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${stub.port}/mcp`), { requestInit: { headers: { authorization: `Bearer ${bearer}` } } }))
  clients.push(client)
  return client
}

async function callTool(client: Client, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as unknown as ToolResult
}

const recorded = async (): Promise<Call[]> => (await stub.calls()) as unknown as Call[]

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(Date.parse('2026-11-28T10:00:00.000Z'))
  dshHome = await mkdtemp(join(tmpdir(), 'mr-stub-'))
  stub = await startStub({ dshHome, port: 0 })
})

afterEach(async () => {
  for (const client of clients) await client.close().catch(() => undefined)
  clients = []
  await stub.close()
  await rm(dshHome, { recursive: true, force: true })
  vi.useRealTimers()
})

describe('stub deepWidgets server', () => {
  it('writes mcp.json { port, nonce, pid, started } with mode 0600 in a 0700 folder', async () => {
    const file = await readPortFile()
    expect(stub.port).toBeGreaterThan(0)
    expect(file.port).toBe(stub.port)
    expect(typeof file.nonce).toBe('string')
    expect(file.nonce.length).toBeGreaterThanOrEqual(16)
    expect(file.pid).toBe(process.pid)
    expect(typeof file.started).toBe('number')
    expect((await stat(join(dshHome, 'deepwidgets', 'mcp.json'))).mode & 0o777).toBe(0o600)
    expect((await stat(join(dshHome, 'deepwidgets'))).mode & 0o777).toBe(0o700)
  })

  it('answers POST /mcp/token with token, agentId and proof = hex HMAC-SHA256(nonce, challenge)', async () => {
    const { nonce } = await readPortFile()
    const r = await token('remote:abc')
    expect(r.status).toBe(200)
    expect(r.json.proof).toBe(createHmac('sha256', nonce).update(r.challenge).digest('hex'))
    expect(r.json.agentId).toMatch(/^remote-abc-[0-9a-f]{6}$/)
    expect(typeof r.json.token).toBe('string')
    expect(r.json.token.length).toBeGreaterThan(20)
  })

  it('refuses a bad agent or a bad challenge with 400', async () => {
    const good = randomBytes(16).toString('base64url')
    const bodies = [{ agent: '', challenge: good }, { agent: 'x'.repeat(65), challenge: good }, { agent: 'remote:abc', challenge: 'short' }, { agent: 'remote:abc' }]
    for (const body of bodies) {
      expect((await raw(stub.port, { method: 'POST', path: '/mcp/token', body: JSON.stringify(body) })).status).toBe(400)
    }
  })

  it('refuses a Host that is not loopback with 403', async () => {
    const body = JSON.stringify({ agent: 'remote:abc', challenge: randomBytes(16).toString('base64url') })
    expect((await raw(stub.port, { method: 'POST', path: '/mcp/token', headers: { host: 'example.com' }, body })).status).toBe(403)
    expect((await raw(stub.port, { method: 'POST', path: '/mcp/token', headers: { host: '127.0.0.1.evil.test' }, body })).status).toBe(403)
  })

  it('refuses a request with Origin or Sec-Fetch-Site with 403', async () => {
    const body = JSON.stringify({ agent: 'remote:abc', challenge: randomBytes(16).toString('base64url') })
    expect((await raw(stub.port, { method: 'POST', path: '/mcp/token', headers: { origin: 'http://127.0.0.1' }, body })).status).toBe(403)
    expect((await raw(stub.port, { method: 'POST', path: '/mcp/token', headers: { 'sec-fetch-site': 'same-origin' }, body })).status).toBe(403)
  })

  it('answers 401 on /mcp without a bearer or with an unknown bearer', async () => {
    expect((await raw(stub.port, { method: 'POST', path: '/mcp', headers: { accept: ACCEPT }, body: INIT })).status).toBe(401)
    expect((await raw(stub.port, { method: 'POST', path: '/mcp', headers: { accept: ACCEPT, authorization: 'Bearer nope' }, body: INIT })).status).toBe(401)
  })

  it('lists all 11 real tool names to a client with a valid bearer', async () => {
    const client = await connect((await token()).json.token)
    const names = (await client.listTools()).tools.map((tool) => tool.name).sort()
    expect(names).toEqual(ALL_TOOLS)
  })

  it('runs groceries add and list and records each call with by = agentId', async () => {
    const t = await token('remote:abc')
    const client = await connect(t.json.token)
    const added = await callTool(client, 'widget_call', { slug: 'groceries', action: 'add', args: { item: 'milk' } })
    expect(added.isError).not.toBe(true)
    const listed = await callTool(client, 'widget_call', { slug: 'groceries', action: 'list' })
    expect(JSON.stringify(listed)).toContain('milk')
    const seen = await recorded()
    expect(seen.length).toBe(2)
    expect(seen[0]).toMatchObject({ tool: 'widget_call', by: t.json.agentId, args: { slug: 'groceries', action: 'add', args: { item: 'milk' } } })
    expect(seen[1]).toMatchObject({ tool: 'widget_call', by: t.json.agentId })
  })

  it('hides main from widget_list and refuses widget_call on main', async () => {
    const client = await connect((await token()).json.token)
    const list = JSON.stringify(await callTool(client, 'widget_list', {}))
    expect(list).toContain('groceries')
    expect(list).not.toMatch(/[^a-z]main[^a-z]/)
    const refused = await callTool(client, 'widget_call', { slug: 'main', action: 'list' })
    expect(refused.isError).toBe(true)
    expect(JSON.stringify(refused)).toContain('unknown-widget')
  })

  it('returns a top-level source field and the actions from widget_describe of groceries', async () => {
    const client = await connect((await token()).json.token)
    const described = await callTool(client, 'widget_describe', { slug: 'groceries' })
    expect(described.isError).not.toBe(true)
    expect(typeof described.structuredContent?.source).toBe('string')
    const text = JSON.stringify(described)
    expect(text).toContain('add')
    expect(text).toContain('list')
  })

  it('restart writes a new nonce and voids earlier tokens', async () => {
    const before = await readPortFile()
    const old = await token()
    await connect(old.json.token)
    await stub.restart()
    const after = await readPortFile()
    expect(after.nonce).not.toBe(before.nonce)
    expect(after.port).toBe(before.port)
    expect((await raw(stub.port, { method: 'POST', path: '/mcp', headers: { accept: ACCEPT, authorization: `Bearer ${old.json.token}` }, body: INIT })).status).toBe(401)
    const fresh = await token()
    expect(fresh.status).toBe(200)
    expect(fresh.json.proof).toBe(createHmac('sha256', after.nonce).update(fresh.challenge).digest('hex'))
  })

  it('serves GET /__stub/calls and POST /__stub/restart', async () => {
    const client = await connect((await token()).json.token)
    await callTool(client, 'widget_list', {})
    const r = await raw(stub.port, { path: '/__stub/calls' })
    expect(r.status).toBe(200)
    const list = JSON.parse(r.body) as Call[]
    expect(list.map((call) => call.tool)).toEqual(['widget_list'])
    const { nonce } = await readPortFile()
    expect((await raw(stub.port, { method: 'POST', path: '/__stub/restart' })).status).toBe(200)
    expect((await readPortFile()).nonce).not.toBe(nonce)
    expect((await recorded()).length).toBe(1)
  })
})
