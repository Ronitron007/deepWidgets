import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkKillFile, deviceUrl } from '../bridge/src/main.ts'

describe('bridge transport and kill-file checks (Codex review)', () => {
  it('requires https for a non-loopback relay and refuses credentials in the URL', () => {
    expect(deviceUrl('https://relay.example.workers.dev')).toBe('wss://relay.example.workers.dev/device/connect')
    expect(deviceUrl('http://127.0.0.1:8787')).toBe('ws://127.0.0.1:8787/device/connect')
    expect(() => deviceUrl('http://relay.example.com')).toThrow(/https/)
    expect(() => deviceUrl('https://user:pw@relay.example.com')).toThrow(/credentials/)
  })

  it('sees a kill file reached through a symlink into $DSH_HOME/deepwidgets', () => {
    const base = mkdtempSync(join(tmpdir(), 'dw-kill-'))
    const dsh = join(base, 'dsh')
    mkdirSync(join(dsh, 'deepwidgets'), { recursive: true })
    mkdirSync(join(base, 'state'))
    symlinkSync(join(dsh, 'deepwidgets'), join(base, 'state', 'alias'))
    expect(() => checkKillFile(join(base, 'state', 'alias', 'KILL'), dsh)).toThrow(/outside/)
    expect(checkKillFile(join(base, 'state', 'KILL'), dsh)).toContain('KILL')
  })
})

import { effectiveScope } from '../worker/src/core.ts'
describe('effective token scope (Codex review)', () => {
  it('a token never gets more than its grant, and only what it asked for', () => {
    expect(effectiveScope('widgets:read widgets:call', ['widgets:read'])).toBe('widgets:read')
    expect(effectiveScope('widgets:read', ['widgets:read', 'widgets:call'])).toBe('widgets:read')
    expect(effectiveScope('widgets:read widgets:call', [])).toBe('')
  })
})
