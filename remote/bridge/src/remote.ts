/**
 * Round-2 bridge deltas (ARCHITECTURE.md section 14, bridge/): own-clock hello, `wid` filtering of read results,
 * the DW_REMOTE_HOURS time box, the ping interval and the local call timeout.
 */

/** The bridge sends a literal `ping` this often; the relay answers `pong` without waking up. */
export const PING_INTERVAL_MS = 20_000
/** How long the bridge waits for the local server before it answers `local-error` (the relay waits 30 s). */
export const LOCAL_TIMEOUT_MS = 10_000
const DEFAULT_REMOTE_HOURS = 8

/** The device id of a hello frame. Any serverTime is ignored: the bridge judges iat and exp on its own clock. */
export function parseHello(frame: unknown): { deviceId: string } | null {
  if (typeof frame !== 'object' || frame === null) return null
  const { type, deviceId } = frame as Record<string, unknown>
  if (type !== 'hello' || typeof deviceId !== 'string' || deviceId === '') return null
  return { deviceId }
}

/** How long the bridge may run: DW_REMOTE_HOURS hours (default 8). Throws on a non-positive or non-numeric value. */
export function remoteLifetimeMs(env: Record<string, string | undefined>): number {
  const raw = env.DW_REMOTE_HOURS
  if (raw === undefined || raw.trim() === '') return DEFAULT_REMOTE_HOURS * 3_600_000
  const hours = Number(raw)
  if (!Number.isFinite(hours) || hours <= 0) throw new Error('bridge: DW_REMOTE_HOURS must be a positive number of hours')
  return Math.round(hours * 3_600_000)
}

/** The value of `promise`, or 'timeout' when it does not settle within `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | 'timeout'> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const late = new Promise<'timeout'>((done) => { timer = setTimeout(() => done('timeout'), ms) })
  return Promise.race([promise, late]).finally(() => { clearTimeout(timer) })
}

const KEY_OF: Partial<Record<string, string>> = { widget_list: 'widgets', widget_changes: 'changes' }

function keepSigned(body: unknown, key: string, wid: readonly string[]): unknown {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return body
  const items = (body as Record<string, unknown>)[key]
  if (!Array.isArray(items)) return body
  const kept = items.filter((item: unknown) => typeof item === 'object' && item !== null && wid.includes(String((item as { slug?: unknown }).slug)))
  return { ...(body as Record<string, unknown>), [key]: kept }
}

/**
 * Keep only the signed `wid` slugs in widget_list widgets and widget_changes changes, in structuredContent and in
 * the JSON text content. Other tools, and a wid of '*', pass unchanged.
 */
export function filterByWid(tool: string, result: Record<string, unknown>, wid: readonly string[]): Record<string, unknown> {
  const key = KEY_OF[tool]
  if (key === undefined || wid.includes('*')) return result
  const out: Record<string, unknown> = { ...result }
  if (result.structuredContent !== undefined) out.structuredContent = keepSigned(result.structuredContent, key, wid)
  if (Array.isArray(result.content)) {
    out.content = result.content.map((item: unknown) => {
      const text = (item as { type?: unknown; text?: unknown }).text
      if ((item as { type?: unknown }).type !== 'text' || typeof text !== 'string') return item
      try {
        return { ...(item as object), text: JSON.stringify(keepSigned(JSON.parse(text), key, wid)) }
      } catch {
        // Not JSON: it may name any widget, so a remote caller does not see it.
        return { ...(item as object), text: '' }
      }
    })
  }
  return out
}
