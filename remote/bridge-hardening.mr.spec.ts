import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createHash, generateKeyPairSync, randomBytes, sign, type KeyObject } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createVerifier } from './bridge/src/assertion.ts'
import * as localModule from './bridge/src/local.ts'
import * as mainModule from './bridge/src/main.ts'

type LocalOutcome = { ok: boolean; code?: string; message?: string }
type LocalLike = { call(claims: { cid: string; tool: string }, args: Record<string, unknown>): Promise<LocalOutcome> }

const T0 = Date.parse('2026-11-28T10:00:00.000Z')
const DEVICE = 'dev_test'
const keys = generateKeyPairSync('ed25519')
const publicKey = keys.publicKey.export({ format: 'jwk' })
const CALL_ARGS = JSON.stringify({ slug: 'groceries', action: 'add', args: { item: 'milk' } })
const main = mainModule as unknown as Record<string, unknown>
const local = localModule as unknown as Record<string, unknown>
let dir = ''

function signAssertion(privateKey: KeyObject, claims: Record<string, unknown>): string {
  const head = Buffer.from(JSON.stringify({ alg: 'EdDSA', kid: 'test-key', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${head}.${body}.${sign(null, Buffer.from(`${head}.${body}`), privateKey).toString('base64url')}`
}

function claims(over: Record<string, unknown> = {}, drop: string[] = []): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000)
  const c: Record<string, unknown> = {
    v: 1, iss: 'dw-relay', aud: DEVICE, sub: 'owner', cid: 'client_abc123', gid: 'grant_1', scope: 'widgets:read widgets:call',
    wid: ['groceries'], tool: 'widget_call', ah: createHash('sha256').update(CALL_ARGS).digest('base64url'),
    iat: now, exp: now + 30, jti: randomBytes(16).toString('base64url'), ...over,
  }
  for (const key of drop) delete c[key]
  return c
}

const verify = (c: Record<string, unknown>): { ok: boolean } =>
  createVerifier({ publicKey, deviceId: DEVICE, startedAtMs: T0 - 600_000, clockOffsetMs: 0 }).verify(signAssertion(keys.privateKey, c), CALL_ARGS)

function mainFn<T>(name: string): T {
  const value = main[name]
  if (typeof value !== 'function') throw new Error(`bridge/src/main.ts does not export the function ${name}`)
  return value as T
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  dir = await mkdtemp(join(tmpdir(), 'dw-bridge-hardening-'))
})

afterAll(async () => {
  vi.useRealTimers()
  await rm(dir, { recursive: true, force: true })
})

describe('bridge grant binding', () => {
  it('refuses an assertion whose sub is not owner', () => {
    expect(verify(claims()).ok).toBe(true)
    expect(verify(claims({ sub: 'someone' })).ok).toBe(false)
    expect(verify(claims({}, ['sub'])).ok).toBe(false)
  })

  it('refuses an assertion without a non-empty string gid', () => {
    expect(verify(claims({ gid: '' })).ok).toBe(false)
    expect(verify(claims({ gid: 7 })).ok).toBe(false)
    expect(verify(claims({}, ['gid'])).ok).toBe(false)
  })

  it('defaultDeniedGrantsFile is denied-grants beside the kill file', () => {
    const defaultDeniedGrantsFile = mainFn<(killFile: string) => string>('defaultDeniedGrantsFile')
    expect(defaultDeniedGrantsFile(join(dir, 'bridge', 'KILL'))).toBe(join(dir, 'bridge', 'denied-grants'))
  })

  it('isGrantDenied reads one grant id per line and treats a missing file as empty', async () => {
    const isGrantDenied = mainFn<(file: string, gid: string) => Promise<boolean>>('isGrantDenied')
    expect(await isGrantDenied(join(dir, 'missing-denied-grants'), 'grant_1')).toBe(false)
    const file = join(dir, 'denied-grants')
    await writeFile(file, 'grant_a\n  grant_b  \r\n\n')
    expect(await isGrantDenied(file, 'grant_a')).toBe(true)
    expect(await isGrantDenied(file, 'grant_b')).toBe(true)
    expect(await isGrantDenied(file, 'grant_c')).toBe(false)
    expect(await isGrantDenied(file, 'grant')).toBe(false)
  })

  it('isGrantDenied fails closed when the deny-list cannot be read', async () => {
    const isGrantDenied = mainFn<(file: string, gid: string) => Promise<boolean>>('isGrantDenied')
    const path = join(dir, 'denied-as-directory')
    await mkdir(path)
    expect(await isGrantDenied(path, 'grant_1')).toBe(true)
  })
})

describe('bridge local error text', () => {
  it('local-unavailable leaves the bridge with one fixed message, whatever the local detail', async () => {
    const messages = local.LOCAL_ERROR_MESSAGES as Record<string, unknown> | undefined
    expect(typeof messages?.['local-unavailable']).toBe('string')
    expect(typeof messages?.['local-error']).toBe('string')
    expect(messages?.['local-error']).not.toBe(messages?.['local-unavailable'])
    const createLocal = local.createLocal as (opts: { dshHome: string; log?: (line: string) => void }) => LocalLike
    const empty = join(dir, 'home-empty')
    await mkdir(empty)
    const shapeless = join(dir, 'home-shapeless')
    await mkdir(join(shapeless, 'deepwidgets'), { recursive: true })
    await writeFile(join(shapeless, 'deepwidgets', 'mcp.json'), '{}')
    const notJson = join(dir, 'home-not-json')
    await mkdir(join(notJson, 'deepwidgets'), { recursive: true })
    await writeFile(join(notJson, 'deepwidgets', 'mcp.json'), 'not json')
    for (const home of [empty, shapeless, notJson]) {
      const r = await createLocal({ dshHome: home, log: () => undefined }).call({ cid: 'client_abc', tool: 'widget_list' }, {})
      expect(r.ok).toBe(false)
      expect(r.code).toBe('local-unavailable')
      expect(r.message).toBe(messages?.['local-unavailable'])
    }
  })
})
