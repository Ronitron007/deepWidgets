/**
 * Pure helpers of the relay Worker: scope to tools, the grant props shape, the device credential check and the
 * lockout policy. No Cloudflare imports, so the unit tests run them in plain Node.
 */
import type { InteractTool } from './assertion.ts'

export const SCOPES = ['widgets:read', 'widgets:call'] as const
export type Scope = (typeof SCOPES)[number]

/** The only tools the relay ever offers, with the scope each needs. Create-mode tools are never here. */
export const TOOL_SCOPE: Readonly<Record<InteractTool, Scope>> = Object.freeze({
  widget_list: 'widgets:read',
  widget_describe: 'widgets:read',
  widget_changes: 'widgets:read',
  widget_call: 'widgets:call',
})

/** The interact tools a space-separated scope string allows; none for an empty or unknown scope. */
export function toolsForScope(scope: string): InteractTool[] {
  const granted = new Set(scope.split(' ').filter((s) => s !== ''))
  return (Object.keys(TOOL_SCOPE) as InteractTool[]).filter((tool) => granted.has(TOOL_SCOPE[tool]))
}

/** The scopes of the grant that this token also asked for (a token may be downscoped; it never widens). */
export function effectiveScope(grantScope: string, requested: readonly string[]): string {
  const want = new Set(requested)
  return grantScope.split(' ').filter((x) => x !== '' && want.has(x)).join(' ')
}

export interface GrantProps {
  owner: string
  deviceId: string
  widgets: string[]
  scope: string
  grantId: string
}

const isText = (value: unknown): value is string => typeof value === 'string' && value !== ''

/** The props of an access token, or null when any field is missing or mistyped. */
export function parseGrantProps(value: unknown): GrantProps | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  if (!isText(v.owner) || !isText(v.deviceId) || !isText(v.grantId) || typeof v.scope !== 'string') return null
  if (!Array.isArray(v.widgets) || !v.widgets.every(isText)) return null
  return { owner: v.owner, deviceId: v.deviceId, widgets: [...(v.widgets as string[])], scope: v.scope, grantId: v.grantId }
}

const encoder = new TextEncoder()

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Compare two strings in time that depends only on their lengths. */
export function constantTimeEqual(a: string, b: string): boolean {
  const x = encoder.encode(a)
  const y = encoder.encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

/** True only when the SHA-256 hex of the presented credential is the configured one. */
export async function credentialMatches(presented: string, expectedSha256Hex: string): Promise<boolean> {
  if (presented === '' || expectedSha256Hex === '') return false
  return constantTimeEqual(await sha256Hex(presented), expectedSha256Hex.trim().toLowerCase())
}

/** The owner passcode check; fails closed when the configured passcode is missing or shorter than 43 characters (about 256 bits as base64). */
export function passcodeMatches(presented: string | null | undefined, configured: string | undefined): boolean {
  if (configured === undefined || configured.length < 43 || typeof presented !== 'string') return false
  return constantTimeEqual(presented, configured)
}

export const LOCKOUT_WINDOW_MS = 900_000
export const LOCKOUT_PER_IP = 5
/** Most keys kept; beyond this the oldest failures are dropped (each key still locks on its own five). */
const LOCKOUT_MAX_ENTRIES = 1000

export interface LockoutState { failures: { ip: string; at: number }[] }
export type LockoutVerdict = 'ok' | 'wrong' | 'locked'

export const emptyLockout = (): LockoutState => ({ failures: [] })

const recent = (s: LockoutState, now: number) => s.failures.filter((f) => f.at > now - LOCKOUT_WINDOW_MS)

/** Per-key only: failures from other keys never lock this one (no global ceiling an attacker could fill). */
export function recordFailure(s: LockoutState, key: string, now: number): LockoutState {
  return { failures: capEntries([...recent(s, now), { ip: key, at: now }]) }
}

/** Over the cap, drop the oldest failures of keys that are not yet locked first, so a flood of one-off keys cannot evict an active ban. */
function capEntries(failures: { ip: string; at: number }[]): { ip: string; at: number }[] {
  let excess = failures.length - LOCKOUT_MAX_ENTRIES
  if (excess <= 0) return failures
  const counts = new Map<string, number>()
  for (const f of failures) counts.set(f.ip, (counts.get(f.ip) ?? 0) + 1)
  const kept = failures.filter((f) => {
    if (excess > 0 && (counts.get(f.ip) ?? 0) < LOCKOUT_PER_IP) { excess -= 1; return false }
    return true
  })
  return excess > 0 ? kept.slice(excess) : kept
}

export function isLocked(s: LockoutState, key: string, now: number): boolean {
  return recent(s, now).filter((f) => f.ip === key).length >= LOCKOUT_PER_IP
}

/** Check and count in one step, so a parallel burst cannot pass the check together (the DO runs it atomically). */
export function lockoutAttempt(s: LockoutState, key: string, ok: boolean, now: number): { state: LockoutState; result: LockoutVerdict } {
  if (isLocked(s, key, now)) return { state: s, result: 'locked' }
  if (ok) return { state: s, result: 'ok' }
  return { state: recordFailure(s, key, now), result: 'wrong' }
}

/** IPv4 whole; IPv6 by its /64 prefix (one host usually owns a whole /64); anything else as given. */
export function lockoutKey(rawIp: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(rawIp.trim())
  const ip = (mapped?.[1] ?? rawIp.trim()).slice(0, 64)
  if (!ip.includes(':')) return ip
  const [head = '', tail = ''] = ip.toLowerCase().split('::')
  const h = head === '' ? [] : head.split(':')
  const t = ip.includes('::') ? (tail === '' ? [] : tail.split(':')) : []
  const groups = ip.includes('::') ? [...h, ...Array<string>(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h
  return `v6:${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`
}

export function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP') ?? 'unknown'
}

/** Loopback redirects are refused unless asked for: the provider ignores the port for them (any local process could take the code). */
export function redirectProblem(uri: string, allowLoopback: boolean): string | null {
  let url: URL
  try { url = new URL(uri) } catch { return `${uri} is not a URL` }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '')
  const loopback = host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^::ffff:(7f[0-9a-f]{2}:[0-9a-f]{1,4}|127\.\d+\.\d+\.\d+)$/.test(host) || /^127\.\d+\.\d+\.\d+$/.test(host)
  if (loopback) return allowLoopback ? (url.protocol === 'http:' || url.protocol === 'https:' ? null : `${uri} must be http(s)`) : `${uri} is loopback; send allowLoopback: true to allow it`
  return url.protocol === 'https:' ? null : `${uri} must be https`
}
