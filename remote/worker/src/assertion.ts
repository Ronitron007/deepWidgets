/**
 * Sign the per-request assertion the bridge verifies (bridge/src/assertion.ts): a compact JWS, alg EdDSA (Ed25519).
 * WebCrypto only, so the same code runs in workerd and in Node (the unit tests verify it with the bridge verifier).
 */

export type InteractTool = 'widget_list' | 'widget_describe' | 'widget_call' | 'widget_changes'

export interface Claims {
  v: 1
  iss: 'dw-relay'
  aud: string
  sub: 'owner'
  cid: string
  gid: string
  scope: string
  wid: string[]
  tool: InteractTool
  ah: string
  iat: number
  exp: number
  jti: string
}

export interface ClaimsInput {
  deviceId: string
  clientId: string
  grantId: string
  scope: string
  widgets: string[]
  tool: InteractTool
  argsJson: string
  nowSec: number
}

/** exp - iat, in seconds; the bridge refuses anything over 60. */
export const ASSERTION_LIFETIME_SEC = 30

const encoder = new TextEncoder()

export function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The base64url SHA-256 of the args JSON (UTF-8): the `ah` claim. */
export async function argsHash(argsJson: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(argsJson))))
}

export async function buildClaims(input: ClaimsInput): Promise<Claims> {
  return {
    v: 1,
    iss: 'dw-relay',
    aud: input.deviceId,
    sub: 'owner',
    cid: input.clientId,
    gid: input.grantId,
    scope: input.scope,
    wid: [...input.widgets],
    tool: input.tool,
    ah: await argsHash(input.argsJson),
    iat: input.nowSec,
    exp: input.nowSec + ASSERTION_LIFETIME_SEC,
    jti: base64url(crypto.getRandomValues(new Uint8Array(16))),
  }
}

/** The private JWK may come as an object or as its JSON text (the ASSERTION_SIGNING_KEY secret). */
export async function importSigningKey(privateJwk: object | string): Promise<CryptoKey> {
  const jwk = (typeof privateJwk === 'string' ? JSON.parse(privateJwk) : privateJwk) as JsonWebKey
  if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.d !== 'string') throw new Error('assertion: the signing key is not an Ed25519 private JWK')
  return await crypto.subtle.importKey('jwk', { kty: 'OKP', crv: 'Ed25519', d: jwk.d, x: jwk.x }, { name: 'Ed25519' }, false, ['sign'])
}

export async function signAssertion(privateJwk: object | string | CryptoKey, claims: Claims): Promise<string> {
  const key = privateJwk instanceof CryptoKey ? privateJwk : await importSigningKey(privateJwk)
  const head = base64url(encoder.encode(JSON.stringify({ alg: 'EdDSA', typ: 'JWT' })))
  const body = base64url(encoder.encode(JSON.stringify(claims)))
  const signature = await crypto.subtle.sign({ name: 'Ed25519' }, key, encoder.encode(`${head}.${body}`))
  return `${head}.${body}.${base64url(new Uint8Array(signature))}`
}
