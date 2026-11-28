import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkKillFile } from '../bridge/src/main.ts'

describe('control-file guard (Codex real-pilot review)', () => {
  const home = mkdtempSync(join(tmpdir(), 'dw-guard-'))
  it('a name that starts with .. inside $DSH_HOME/deepwidgets is still inside', () => {
    expect(() => checkKillFile(join(home, 'deepwidgets', '..KILL'), home)).toThrow(/outside/)
    expect(() => checkKillFile(join(home, 'deepwidgets', '..', 'deepwidgets', 'x', 'denied'), home)).toThrow(/outside/)
  })
  it('a sibling of the deepwidgets folder is outside', () => {
    expect(checkKillFile(join(home, 'bridge', 'KILL'), home)).toBe(join(home, 'bridge', 'KILL'))
  })
})
