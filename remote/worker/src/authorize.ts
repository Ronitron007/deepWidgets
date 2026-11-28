/**
 * GET/POST /authorize: the owner's consent page, built on the provider's consent helpers (beginConsent binds a
 * handle to the browser with a __Host- cookie; approveConsent checks it). POST needs the owner passcode, checked in
 * constant time behind the Lockout DO. A wrong passcode consumes nothing, so the owner may retry; it is counted.
 */
import type { AuthRequest, OAuthHelpers } from '@cloudflare/workers-oauth-provider'
import { clientIp, lockoutKey, passcodeMatches, SCOPES } from './core.ts'
import type { Env } from './index.ts'

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/
const SCOPE_WORDS: Record<string, string> = {
  'widgets:read': 'See the granted widgets: list them, describe their actions and state, and read their change feed.',
  'widgets:call': 'Run actions of the granted widgets (this can change their data).',
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

function page(status: number, title: string, body: string, headers?: Headers): Response {
  const out = new Headers(headers)
  out.set('content-type', 'text/html; charset=utf-8')
  out.set('cache-control', 'no-store')
  out.set('x-frame-options', 'DENY')
  out.set('content-security-policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'")
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="font-family:system-ui;max-width:40rem;margin:2rem auto"><h1>${escapeHtml(title)}</h1>${body}</body></html>`
  return new Response(html, { status, headers: out })
}

const helpersOf = (env: Env): OAuthHelpers => {
  if (env.OAUTH_PROVIDER === undefined) throw new Error('authorize: the OAuth provider helpers are missing')
  return env.OAUTH_PROVIDER
}

async function renderConsent(request: Request, env: Env): Promise<Response> {
  const helpers = helpersOf(env)
  let authRequest: AuthRequest
  try {
    authRequest = await helpers.parseAuthRequest(request)
  } catch (error) {
    return page(400, 'Bad authorization request', `<p>${escapeHtml(error instanceof Error ? error.message : String(error))}</p>`)
  }
  if (await helpers.lookupClient(authRequest.clientId) === null) return page(400, 'Unknown client', '<p>This client is not registered.</p>')
  const facts = await helpers.describeConsent(authRequest)
  const { handle, headers } = await helpers.beginConsent(authRequest)
  const requested = facts.scope.length === 0 ? [...SCOPES] : facts.scope
  const scopes = SCOPES.map((scope) =>
    `<li><label><input type="checkbox" name="scope" value="${scope}"${requested.includes(scope) ? ' checked' : ''}> <code>${scope}</code>: ${escapeHtml(SCOPE_WORDS[scope] ?? scope)}</label></li>`).join('')
  const body = `
<p>An agent asks to use widgets on your device through the deepWidgets relay.</p>
<dl>
  <dt>Client name (self-declared)</dt><dd>${escapeHtml(facts.clientName)}</dd>
  <dt>Client id</dt><dd><code>${escapeHtml(facts.clientId)}</code></dd>
  <dt>Redirect URI (tokens go here)</dt><dd><code>${escapeHtml(facts.redirectUri)}</code>${facts.redirectIsLoopback ? ' (a local app on the requesting computer: any local program could be listening)' : ''}</dd>
  <dt>Device</dt><dd><code>${escapeHtml(env.DEVICE_ID)}</code></dd>
</dl>
<form method="post" action="/authorize">
  <input type="hidden" name="handle" value="${escapeHtml(handle)}">
  <p>Scopes:</p><ul>${scopes}</ul>
  <p><label>Widgets (comma separated slugs): <input name="widgets" value="groceries"></label></p>
  <p><label>Owner passcode: <input type="password" name="passcode" autocomplete="current-password" required></label></p>
  <p><button type="submit">Allow</button></p>
</form>`
  return page(200, 'Allow remote widget access?', body, headers)
}

async function approve(request: Request, env: Env): Promise<Response> {
  const helpers = helpersOf(env)
  const key = lockoutKey(clientIp(request))
  const lockout = env.LOCKOUT.getByName('authorize')
  const form = await request.formData()
  const passcode = form.get('passcode')
  const ok = passcodeMatches(typeof passcode === 'string' ? passcode : null, env.OWNER_PASSCODE)
  const verdict = await lockout.attempt(key, ok)
  if (verdict === 'locked') return page(429, 'Too many attempts', '<p>Too many wrong passcodes. Try again in 15 minutes.</p>')
  if (verdict !== 'ok') return page(403, 'Wrong passcode', '<p>The passcode is wrong. Go back and try again.</p>')
  const handle = form.get('handle')
  const scope = form.getAll('scope').filter((s): s is string => typeof s === 'string' && (SCOPES as readonly string[]).includes(s))
  const widgetsField = form.get('widgets')
  const widgets = [...new Set((typeof widgetsField === 'string' ? widgetsField : '').split(',').map((s) => s.trim()).filter((s) => s !== ''))]
  if (scope.length === 0) return page(400, 'No scope', '<p>Pick at least one scope.</p>')
  if (widgets.length === 0 || !widgets.every((slug) => SLUG.test(slug) && slug !== 'main')) {
    return page(400, 'Bad widget list', '<p>List widget slugs (lowercase letters, digits and dashes), never <code>main</code>.</p>')
  }
  let approved: Awaited<ReturnType<OAuthHelpers['approveConsent']>>
  try {
    approved = await helpers.approveConsent(request, typeof handle === 'string' ? handle : '', { scope })
  } catch (error) {
    return page(400, 'Consent expired', `<p>${escapeHtml(error instanceof Error ? error.message : String(error))}. Start again from the agent.</p>`)
  }
  const granted = approved.request.scope
  // The grant id is not known here: tokenExchangeCallback adds it to the access token props.
  const { redirectTo } = await helpers.completeAuthorization({
    request: approved.request,
    userId: 'owner',
    scope: granted,
    metadata: { deviceId: env.DEVICE_ID, widgets },
    props: { owner: 'owner', deviceId: env.DEVICE_ID, widgets, scope: granted.join(' ') },
    revokeExistingGrants: false,
  })
  const headers = new Headers(approved.headers)
  headers.set('location', redirectTo)
  return new Response(null, { status: 302, headers })
}

export async function handleAuthorize(request: Request, env: Env): Promise<Response> {
  if (request.method === 'GET') return renderConsent(request, env)
  if (request.method === 'POST') return approve(request, env)
  return new Response('method not allowed', { status: 405, headers: { allow: 'GET, POST' } })
}
