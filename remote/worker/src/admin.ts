/**
 * Owner admin endpoints (header x-owner-passcode, constant-time compare, behind the Lockout DO):
 * POST /admin/clients, GET /admin/grants, POST /admin/grants/:id/revoke, POST /admin/kill, GET /admin/audit.
 */
import type { OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import { clientIp, lockoutKey, passcodeMatches, redirectProblem } from './core.ts'
import type { Env } from './index.ts'

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    return typeof body === 'object' && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export async function handleAdmin(request: Request, env: Env): Promise<Response> {
  const { pathname } = new URL(request.url)
  const ok = passcodeMatches(request.headers.get('x-owner-passcode'), env.OWNER_PASSCODE)
  // The kill path is never lockout-gated, so an attacker cannot lock the owner out of the off switch.
  // The passcode is at least 43 characters, so guessing it here is not practical.
  if (pathname === '/admin/kill') {
    if (!ok) return json(401, { error: 'wrong or missing x-owner-passcode' })
  } else {
    const verdict = await env.LOCKOUT.getByName('admin').attempt(lockoutKey(clientIp(request)), ok)
    if (verdict === 'locked') return json(429, { error: 'too many wrong passcodes; try again in 15 minutes' })
    if (verdict !== 'ok') return json(401, { error: 'wrong or missing x-owner-passcode' })
  }
  const helpers: OAuthHelpers | undefined = env.OAUTH_PROVIDER
  if (helpers === undefined) return json(500, { error: 'the OAuth provider helpers are missing' })
  const relay = env.DEVICE.getByName(env.DEVICE_ID)

  if (pathname === '/admin/clients' && request.method === 'POST') {
    const body = await readJson(request)
    const name = body.client_name
    const uris = body.redirect_uris
    if (typeof name !== 'string' || name === '' || !Array.isArray(uris) || uris.length === 0 || !uris.every((u) => typeof u === 'string')) {
      return json(400, { error: 'send { client_name, redirect_uris: [..] }' })
    }
    const allowLoopback = body.allowLoopback === true
    for (const uri of uris as string[]) {
      const problem = redirectProblem(uri, allowLoopback)
      if (problem !== null) return json(400, { error: `redirect_uris: ${problem}` })
    }
    try {
      const client = await helpers.createClient({
        clientName: name,
        redirectUris: uris as string[],
        tokenEndpointAuthMethod: 'none',
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
      })
      return json(201, { client_id: client.clientId, client_name: client.clientName, redirect_uris: client.redirectUris, token_endpoint_auth_method: client.tokenEndpointAuthMethod })
    } catch (error) {
      return json(400, { error: error instanceof Error ? error.message : String(error) })
    }
  }
  if (pathname === '/admin/grants' && request.method === 'GET') {
    const { items } = await helpers.listUserGrants('owner')
    return json(200, { grants: items.map((g) => ({ id: g.id, clientId: g.clientId, scope: g.scope, metadata: g.metadata, createdAt: g.createdAt, expiresAt: g.expiresAt })) })
  }
  const revoke = /^\/admin\/grants\/([^/]+)\/revoke$/.exec(pathname)
  if (revoke !== null && request.method === 'POST') {
    const grantId = decodeURIComponent(revoke[1] ?? '')
    // The DO set first: calls stop at once even if the KV revoke is slow to reach every location.
    await relay.revokeGrant(grantId)
    await helpers.revokeGrant(grantId, 'owner')
    return json(200, { revoked: grantId })
  }
  if (pathname === '/admin/kill' && request.method === 'POST') {
    const body = await readJson(request)
    if (typeof body.on !== 'boolean') return json(400, { error: 'send { on: true | false }' })
    return json(200, await relay.setKill(body.on))
  }
  if (pathname === '/admin/audit' && request.method === 'GET') {
    return json(200, await relay.status())
  }
  return json(404, { error: 'not found' })
}
