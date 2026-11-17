import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished } from 'vitest'
import { PROFILE_TEMPLATES } from '@deepseek-ai/dsh-official-bundles'
import { addTemplateBundles, withTemplateBundles } from '../src/deepwidgets-profile-bundles.ts'

const TEMPLATE = PROFILE_TEMPLATES.web!.bundles
const MAIN = '@deepwidgets/widget-main'

function profile(bundles: readonly string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'deepwidgets-profile-bundles-'))
  onTestFinished(() => { rmSync(dir, { recursive: true, force: true }) })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop', private: true, dependencies: { plugin: '1.0.0' }, dsh: { profile: { bundles } } }))
  return dir
}

describe('template bundles of an existing profile (main_widget.menu_bar)', () => {
  it('adds @deepwidgets/widget-main to a profile made before main.runtime, in its template place', () => {
    const old = [...TEMPLATE.filter(name => name !== MAIN), 'plugin']
    const dir = profile(old)
    expect(addTemplateBundles(dir, TEMPLATE)).toEqual([MAIN])
    const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dependencies: unknown; dsh: { profile: { bundles: string[] } } }
    expect(manifest.dsh.profile.bundles).toEqual([...TEMPLATE, 'plugin'])
    expect(manifest.dependencies).toEqual({ plugin: '1.0.0' })
  })

  it('does not write a profile that lists each template bundle', () => {
    const dir = profile([...TEMPLATE, 'plugin'])
    const before = readFileSync(join(dir, 'package.json'), 'utf8')
    expect(addTemplateBundles(dir, TEMPLATE)).toEqual([])
    expect(readFileSync(join(dir, 'package.json'), 'utf8')).toBe(before)
  })

  it('keeps the template order and the other bundles', () => {
    expect(withTemplateBundles(['a', 'x', 'd'], ['a', 'b', 'c', 'd'])).toEqual(['a', 'x', 'b', 'c', 'd'])
    expect(withTemplateBundles(['a', 'x'], ['a', 'b'])).toEqual(['a', 'b', 'x'])
    expect(withTemplateBundles(['x'], ['a', 'b'])).toEqual(['x', 'a', 'b'])
    expect(withTemplateBundles([], TEMPLATE)).toEqual([...TEMPLATE])
  })
})
