/**
 * The dw-relay Worker: OAuth 2.1 (workers-oauth-provider) in front of a stateless remote MCP endpoint at /mcp, the
 * owner consent page and admin endpoints, and /device/connect for the one bridge (ARCHITECTURE.md section 14).
 */
import OAuthProvider, { type OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import { handleAdmin } from './admin.ts'
import { handleAuthorize } from './authorize.ts'
import { credentialMatches, effectiveScope, SCOPES } from './core.ts'
import type { Lockout } from './lockout.ts'
import { mcpFetch } from './mcp.ts'
import type { DeviceRelay } from './relay.ts'

export { DeviceRelay } from './relay.ts'
export { Lockout } from './lockout.ts'

export interface Env {
  OAUTH_KV: KVNamespace
  DEVICE: DurableObjectNamespace<DeviceRelay>
  LOCKOUT: DurableObjectNamespace<Lockout>
  /** The public origin, e.g. https://dw-relay.<subdomain>.workers.dev (http only on loopback for wrangler dev). */
  PUBLIC_URL: string
  DEVICE_ID: string
  OWNER_PASSCODE?: string
  /** Ed25519 private JWK as JSON text. */
  ASSERTION_SIGNING_KEY?: string
  /** Hex SHA-256 of the device credential the bridge presents. */
  DEVICE_CREDENTIAL_SHA256?: string
  /** Set by the OAuth provider before it calls the default handler. */
  OAUTH_PROVIDER?: OAuthHelpers
}

/** The bridge dials in here. The credential hash is checked in constant time before the DO is addressed. */
async function deviceConnect(request: Request, env: Env): Promise<Response> {
  if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('expected a WebSocket upgrade', { status: 426 })
  const credential = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1] ?? ''
  if (env.DEVICE_ID === '' || !(await credentialMatches(credential, env.DEVICE_CREDENTIAL_SHA256 ?? ''))) {
    return new Response('unauthorized', { status: 401 })
  }
  const headers = new Headers({ Upgrade: 'websocket', 'x-dw-device-id': env.DEVICE_ID })
  return env.DEVICE.getByName(env.DEVICE_ID).fetch(new Request(request.url, { headers }))
}

const router: ExportedHandler<Env> = {
  async fetch(request, env) {
    const { pathname } = new URL(request.url)
    if (pathname === '/authorize') return handleAuthorize(request, env)
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return handleAdmin(request, env)
    return new Response('Not Found', { status: 404 })
  },
}

function buildProvider(publicUrl: string): OAuthProvider<Env> {
  return new OAuthProvider<Env>({
    apiRoute: '/mcp',
    apiHandler: { fetch: (request, env, ctx) => mcpFetch(request as Request, env, ctx) },
    defaultHandler: router,
    authorizeEndpoint: '/authorize',
    tokenEndpoint: '/token',
    scopesSupported: [...SCOPES],
    requiredScopes: [...SCOPES],
    resourceMetadata: { resource: `${publicUrl}/mcp`, resource_name: 'deepWidgets' },
    accessTokenTTL: 900,
    refreshTokenTTL: 2_592_000,
    // completeAuthorization cannot take the grant id; put it (and the client id) into the access token props here.
    // The scope in the props is cut down to what this token asked for, so a downscoped token cannot call more tools.
    tokenExchangeCallback: ({ grantId, clientId, props, requestedScope }) => {
      const p = props as Record<string, unknown>
      return { accessTokenProps: { ...p, grantId, clientId, scope: effectiveScope(typeof p.scope === 'string' ? p.scope : '', requestedScope) } }
    },
  })
}

/** Cached per isolate and per PUBLIC_URL (the resource differs between wrangler dev and workers.dev). */
let cached: { url: string; provider: OAuthProvider<Env> } | undefined

export default {
  async fetch(request, env, ctx) {
    if (new URL(request.url).pathname === '/device/connect') return deviceConnect(request, env)
    const url = env.PUBLIC_URL.replace(/\/+$/, '')
    if (cached?.url !== url) cached = { url, provider: buildProvider(url) }
    return cached.provider.fetch(request, env, ctx)
  },
} satisfies ExportedHandler<Env>
