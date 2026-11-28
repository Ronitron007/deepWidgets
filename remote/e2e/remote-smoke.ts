/**
 * Post-deploy proof, and the OAuth helpers e2e/run.test.ts reuses: a pre-registered public client goes through
 * /authorize (consent page + owner passcode, cookies kept, redirect: 'manual'), finishes PKCE, lists the tools and
 * runs `widget_call groceries add`. Secrets (passcode, codes, tokens) are never printed.
 *
 * Run against a deployed relay with a bridge connected:
 *   DW_WORKER_URL=https://dw-relay.<subdomain>.workers.dev \
 *   DW_OWNER_PASSCODE_FILE=~/.deepwidgets-bridge/owner-passcode \
 *   npx tsx e2e/remote-smoke.ts
 * Optional: DW_CLIENT_ID (an existing client; otherwise one is created with /admin/clients), DW_SMOKE_ITEM.
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { UnauthorizedError, type OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { OAuthClientInformationMixed, OAuthClientMetadata, OAuthTokens } from '@modelcontextprotocol/sdk/shared/auth.js'

export const REDIRECT_URI = 'http://127.0.0.1:53682/callback'

/** Show only the length of a secret, never any of its characters. */
export const mask = (secret: string): string => `(${String(secret.length)} chars)`

export interface ConsentResult { status: number; location: string | null; code: string | null; body: string }

/** Drive the consent page like a browser: GET with redirect 'manual', keep the cookies, POST handle + passcode. */
export async function consent(authorizationUrl: URL | string, passcode: string, widgets = 'groceries', scopes?: string[]): Promise<ConsentResult> {
  const page = await fetch(authorizationUrl, { redirect: 'manual' })
  const html = await page.text()
  if (page.status !== 200) return { status: page.status, location: page.headers.get('location'), code: null, body: html }
  const cookie = page.headers.getSetCookie().map((line) => line.split(';')[0]).join('; ')
  const handle = /name="handle" value="([^"]+)"/.exec(html)?.[1]
  if (handle === undefined) throw new Error('consent: the page has no handle')
  const form = new URLSearchParams({ handle, passcode, widgets })
  if (scopes !== undefined) for (const scope of scopes) form.append('scope', scope)
  else for (const scope of html.matchAll(/name="scope" value="([^"]+)" checked/g)) form.append('scope', scope[1] ?? '')
  const answer = await fetch(new URL('/authorize', authorizationUrl), {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    body: form,
  })
  const location = answer.headers.get('location')
  const code = location === null ? null : new URL(location).searchParams.get('code')
  return { status: answer.status, location, code, body: await answer.text() }
}

/** An OAuthClientProvider for a pre-registered public client that consents with the owner passcode. */
export class OwnerConsentProvider implements OAuthClientProvider {
  private savedTokens: OAuthTokens | undefined
  private verifier = ''
  /** The authorization code of the last consent. */
  code: string | undefined

  constructor(private readonly clientId: string, private readonly passcode: string, private readonly scopes?: string[], private readonly widgets = 'groceries') {}

  get redirectUrl(): string { return REDIRECT_URI }
  get clientMetadata(): OAuthClientMetadata {
    return { client_name: 'dw-e2e', redirect_uris: [REDIRECT_URI], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }
  }
  clientInformation(): OAuthClientInformationMixed { return { client_id: this.clientId } }
  tokens(): OAuthTokens | undefined { return this.savedTokens }
  saveTokens(tokens: OAuthTokens): void { this.savedTokens = tokens }
  saveCodeVerifier(verifier: string): void { this.verifier = verifier }
  codeVerifier(): string { return this.verifier }
  async redirectToAuthorization(url: URL): Promise<void> {
    const result = await consent(url, this.passcode, this.widgets, this.scopes)
    if (result.code === null) throw new Error(`consent: no code (status ${String(result.status)})`)
    this.code = result.code
  }
}

/** Connect an MCP client: the first try gets 401 and consents, then finishAuth and reconnect. */
export async function connectWithOAuth(workerUrl: string, provider: OwnerConsentProvider): Promise<Client> {
  const url = new URL(`${workerUrl}/mcp`)
  const first = new Client({ name: 'dw-e2e', version: '0.0.0' })
  const transport = new StreamableHTTPClientTransport(url, { authProvider: provider })
  try {
    await first.connect(transport)
    return first
  } catch (error) {
    if (!(error instanceof UnauthorizedError) || provider.code === undefined) throw error
  }
  await transport.finishAuth(provider.code)
  const client = new Client({ name: 'dw-e2e', version: '0.0.0' })
  await client.connect(new StreamableHTTPClientTransport(url, { authProvider: provider }))
  return client
}

/** POST /admin/clients with the owner passcode; returns the new client id. */
export async function createClient(workerUrl: string, passcode: string, name = 'dw-e2e'): Promise<string> {
  const response = await fetch(`${workerUrl}/admin/clients`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-owner-passcode': passcode },
    body: JSON.stringify({ client_name: name, redirect_uris: [REDIRECT_URI], allowLoopback: true }),
  })
  const body = (await response.json()) as { client_id?: string; error?: string }
  if (response.status !== 201 || typeof body.client_id !== 'string') throw new Error(`admin/clients answered ${String(response.status)}: ${body.error ?? ''}`)
  return body.client_id
}

/** The error code of a tool result, or undefined when it is not an error. */
export function errorCode(result: unknown): string | undefined {
  const r = result as { isError?: boolean; structuredContent?: { error?: { code?: string } }; content?: { text?: string }[] }
  if (r.isError !== true) return undefined
  const fromStructured = r.structuredContent?.error?.code
  if (fromStructured !== undefined) return fromStructured
  try {
    return (JSON.parse(r.content?.[0]?.text ?? '{}') as { error?: { code?: string } }).error?.code ?? 'error'
  } catch {
    return 'error'
  }
}

async function main(): Promise<void> {
  const workerUrl = (process.env.DW_WORKER_URL ?? '').replace(/\/+$/, '')
  const passcodeFile = process.env.DW_OWNER_PASSCODE_FILE ?? ''
  if (workerUrl === '' || passcodeFile === '') throw new Error('set DW_WORKER_URL and DW_OWNER_PASSCODE_FILE')
  if (!/^https:\/\//.test(workerUrl) && !/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(workerUrl)) throw new Error('DW_WORKER_URL must be https (http only for loopback)')
  const passcode = (await readFile(passcodeFile, 'utf8')).trim()
  console.log(`smoke: relay ${workerUrl}, passcode ${mask(passcode)}`)
  const clientId = process.env.DW_CLIENT_ID || await createClient(workerUrl, passcode, 'dw-remote-smoke')
  console.log(`smoke: client ${clientId}`)
  const provider = new OwnerConsentProvider(clientId, passcode)
  const client = await connectWithOAuth(workerUrl, provider)
  console.log(`smoke: OAuth done, access token ${mask(provider.tokens()?.access_token ?? '')}`)
  const tools = (await client.listTools()).tools.map((t) => t.name).sort()
  console.log(`smoke: tools ${tools.join(', ')}`)
  const item = process.env.DW_SMOKE_ITEM ?? `smoke-${new Date().toISOString()}`
  const result = await client.callTool({ name: 'widget_call', arguments: { slug: 'groceries', action: 'add', args: { item } } })
  const code = errorCode(result)
  await client.close()
  if (code !== undefined) throw new Error(`widget_call failed: ${code}`)
  console.log(`smoke: widget_call groceries add ${JSON.stringify(item)} ok`)
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(`smoke: FAILED: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}
