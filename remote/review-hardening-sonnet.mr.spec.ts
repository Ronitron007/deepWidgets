import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT: string = fileURLToPath(new URL('./', import.meta.url))
const DOC: string = ROOT + 'REVIEW-hardening-sonnet.md'
const VERDICT = /fixed correctly|partly|not fixed/i
const HEADING = /^#{1,6}\s/

function doc(): string {
  expect(existsSync(DOC), 'REVIEW-hardening-sonnet.md must exist at the repo root').toBe(true)
  return readFileSync(DOC, 'utf8')
}

function lines(): string[] {
  return doc().replace(/\s+$/, '').split('\n')
}

function section(re: RegExp): string {
  const ls = lines()
  const start = ls.findIndex((l) => HEADING.test(l) && re.test(l))
  expect(start, 'missing heading matching ' + String(re)).toBeGreaterThanOrEqual(0)
  const rest = ls.slice(start + 1)
  const end = rest.findIndex((l) => HEADING.test(l))
  return (end === -1 ? rest : rest.slice(0, end)).join('\n')
}

function refs(): { file: string; line: number }[] {
  const out: { file: string; line: number }[] = []
  const re = /(?<![\w/.-])((?:[\w.-]+\/)*[\w.-]+\.(?:ts|md|jsonc|json)):(\d+)(?:-(\d+))?/g
  for (const m of doc().matchAll(re)) out.push({ file: m[1], line: Number(m[3] ?? m[2]) })
  return out
}

describe('REVIEW-hardening-sonnet.md', () => {
  it('exists at the repo root, names commit b746154 and stays under 80 lines', () => {
    const text = doc()
    expect(text).toContain('b746154')
    const n = lines().length
    expect(n).toBeGreaterThanOrEqual(15)
    expect(n).toBeLessThan(80)
  })

  it('gives a fixed correctly / partly / not fixed verdict for each of the five areas', () => {
    const areas: Record<string, RegExp> = {
      lockout: /lockout/i,
      'sub/gid and denied-grants': /\bgid\b|denied[- ]grants/i,
      'fixed local error text': /error text|local error/i,
      'loopback redirect refusal': /redirect/i,
      'mcp 404 e2e pins': /\/mcp\/\*|404/i,
    }
    const ls = lines()
    for (const [name, re] of Object.entries(areas)) {
      expect(ls.some((l) => re.test(l) && VERDICT.test(l)), 'no verdict line for ' + name).toBe(true)
    }
  })

  it('covers the lockout sub-points: IPv6 /64 keying, atomic attempt, global ceiling, /admin/kill', () => {
    const text = doc()
    expect(text).toMatch(/\/64/)
    expect(text).toMatch(/atomic/i)
    expect(text).toMatch(/ceiling/i)
    expect(text).toMatch(/\/admin\/kill/)
  })

  it('cites at least 8 distinct file:line references that all resolve to real lines', () => {
    const found = refs()
    const distinct = new Set(found.map((r) => r.file + ':' + r.line))
    expect(distinct.size).toBeGreaterThanOrEqual(8)
    for (const r of found) {
      const p = ROOT + r.file
      expect(existsSync(p), r.file + ' must exist').toBe(true)
      const total = readFileSync(p, 'utf8').split('\n').length
      expect(r.line, r.file + ':' + r.line + ' line must be positive').toBeGreaterThan(0)
      expect(r.line, r.file + ':' + r.line + ' beyond end of file (' + total + ' lines)').toBeLessThanOrEqual(total)
    }
  })

  it('cites both worker/src and bridge/src files', () => {
    const found = refs()
    expect(found.some((r) => r.file.startsWith('worker/src/'))).toBe(true)
    expect(found.some((r) => r.file.startsWith('bridge/src/'))).toBe(true)
  })

  it('has a section for new problems introduced by the commit', () => {
    const body = section(/\bnew\b/i)
    expect(body.split('\n').some((l) => l.trim().length >= 20)).toBe(true)
  })

  it('lists numbered MUST-FIX items each with an exact Fix', () => {
    const body = section(/must-?fix/i)
    const items = body.split('\n').filter((l) => /^\s*(?:[-*]\s+)?(?:\*\*)?(?:MUST-FIX\s*)?\d+[.):]/i.test(l))
    expect(items.length).toBeGreaterThanOrEqual(1)
    items.forEach((l, i) => {
      const num = /(\d+)/.exec(l)
      expect(Number(num ? num[1] : -1)).toBe(i + 1)
    })
    const fixes = body.match(/fix\s*:/gi) ?? []
    expect(fixes.length).toBeGreaterThanOrEqual(items.length)
  })

  it('has an untested section', () => {
    const body = section(/untested/i)
    expect(body.trim().length).toBeGreaterThan(0)
  })

  it('notes MUST-FIX 1 (tool set) was rejected on purpose', () => {
    const ok = lines().some((l) => /must-?fix\s*1\b/i.test(l) && /tool/i.test(l) && /reject|on purpose|intentional/i.test(l))
    expect(ok).toBe(true)
  })
})
