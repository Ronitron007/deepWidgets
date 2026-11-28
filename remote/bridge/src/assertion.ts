/**
 * Verify the per-request signed assertion of the relay (ARCHITECTURE-r1.md section 5): a compact JWS, alg EdDSA (Ed25519),
 * checked with node:crypto against the public JWK pinned at pairing. verify never throws.
 */
import { createHash, createPublicKey, verify as verifySignature, type JsonWebKey, type KeyObject } from 'node:crypto'
import { isAllowedTool, SCOPE_OF, type AllowedTool } from './allowlist.ts'
import { createReplayCache, issuedBeforeStart } from './replay.ts'

/** Clock tolerance for exp and the bridge start, in seconds. */
export const TOLERANCE_SEC = 5
/** The longest lifetime an assertion may claim (exp - iat), in seconds. */
export const MAX_LIFETIME_SEC = 60
/** Args larger than this are refused (section 5, rate limits). */
export const MAX_ARGS_BYTES = 64 * 1024

const MAIN_SLUG = 'main'
const B64URL = /^[A-Za-z0-9_-]+$/

export interface Claims {
  v: 1
  iss: 'dw-relay'
  aud: string
  sub: string
  cid: string
  gid: string
  scope: string
  wid: string[]
  tool: AllowedTool
  ah: string
  iat: number
  exp: number
  jti: string
}

export type VerifyResult = { ok: true; claims: Claims } | { ok: false; reason: string }

export interface VerifierOptions {
  publicKey: JsonWebKey
  deviceId: string
  /** When the bridge started, on the local clock (ms). */
  startedAtMs: number
  /** Server time minus local time, in ms (from the hello frame). */
  clockOffsetMs?: number
}

export interface Verifier {
  verify(jws: string, argsJson: string): VerifyResult
  setClockOffset(ms: number): void
}

const fail = (reason: string): VerifyResult => ({ ok: false, reason })

function parseSegment(segment: string): unknown {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
}

const isString = (value: unknown): value is string => typeof value === 'string'
const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value > 0

export function createVerifier(opts: VerifierOptions): Verifier {
  const key: KeyObject = createPublicKey({ key: opts.publicKey, format: 'jwk' })
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('assertion: the pinned public key is not an Ed25519 key')
  const replay = createReplayCache()
  let offsetMs = opts.clockOffsetMs ?? 0

  function check(jws: string, argsJson: string): VerifyResult {
    if (typeof jws !== 'string' || typeof argsJson !== 'string') return fail('assertion or args missing')
    const parts = jws.split('.')
    if (parts.length !== 3 || !parts.every((part) => B64URL.test(part))) return fail('malformed assertion')
    const [head = '', body = '', sig = ''] = parts

    let header: unknown
    let payload: unknown
    try {
      header = parseSegment(head)
      payload = parseSegment(body)
    } catch {
      return fail('malformed assertion')
    }
    if (typeof header !== 'object' || header === null || (header as { alg?: unknown }).alg !== 'EdDSA') return fail('unsupported alg')
    if (!verifySignature(null, Buffer.from(`${head}.${body}`), key, Buffer.from(sig, 'base64url'))) return fail('bad signature')
    if (typeof payload !== 'object' || payload === null) return fail('malformed claims')

    const c = payload as Record<string, unknown>
    if (c.v !== 1) return fail('unsupported claims version')
    if (c.iss !== 'dw-relay') return fail('wrong issuer')
    if (c.aud !== opts.deviceId) return fail('wrong audience')
    if (c.sub !== 'owner') return fail('wrong subject')
    if (!isString(c.gid) || c.gid === '') return fail('missing grant id')
    if (!isTime(c.iat) || !isTime(c.exp)) return fail('missing iat or exp')
    if (!isString(c.jti) || c.jti === '' || !isString(c.tool) || !isString(c.scope) || !isString(c.ah) || !isString(c.cid)
      || !Array.isArray(c.wid) || !c.wid.every(isString)) return fail('malformed claims')

    const nowSec = (Date.now() + offsetMs) / 1000
    if (c.exp < nowSec - TOLERANCE_SEC) return fail('expired')
    if (c.exp <= c.iat || c.exp - c.iat > MAX_LIFETIME_SEC) return fail('lifetime over 60 s')
    if (c.iat > nowSec + TOLERANCE_SEC) return fail('issued in the future')
    if (issuedBeforeStart(c.iat, opts.startedAtMs, offsetMs, TOLERANCE_SEC)) return fail('issued before the bridge started')
    if (replay.seen(c.jti, nowSec)) return fail('replayed jti')
    // A validly signed, fresh assertion is single use, whatever the checks below say.
    replay.remember(c.jti, c.exp + TOLERANCE_SEC)

    if (!isAllowedTool(c.tool)) return fail('tool not in the allowlist')
    if (!c.scope.split(' ').includes(SCOPE_OF[c.tool])) return fail('scope does not cover the tool')
    if (Buffer.byteLength(argsJson, 'utf8') > MAX_ARGS_BYTES) return fail('args larger than 64 KiB')
    if (createHash('sha256').update(argsJson, 'utf8').digest('base64url') !== c.ah) return fail('args hash mismatch')

    let args: unknown
    try {
      args = JSON.parse(argsJson)
    } catch {
      return fail('args are not JSON')
    }
    if (typeof args !== 'object' || args === null || Array.isArray(args)) return fail('args are not a JSON object')
    const slug = (args as Record<string, unknown>).slug
    const needsSlug = c.tool === 'widget_call' || c.tool === 'widget_describe'
    if (slug === undefined && needsSlug) return fail('slug missing')
    if (slug !== undefined) {
      if (!isString(slug)) return fail('slug is not a string')
      if (slug === MAIN_SLUG) return fail('slug main is refused')
      if (!c.wid.includes('*') && !c.wid.includes(slug)) return fail('slug not in the granted widgets')
    }
    return { ok: true, claims: c as unknown as Claims }
  }

  return {
    verify(jws, argsJson) {
      try {
        return check(jws, argsJson)
      } catch {
        return fail('malformed assertion')
      }
    },
    setClockOffset(ms) {
      offsetMs = ms
    },
  }
}
