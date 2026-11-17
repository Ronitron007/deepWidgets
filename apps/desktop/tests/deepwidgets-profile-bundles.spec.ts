import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { PROFILE_TEMPLATES } from '@deepseek-ai/dsh-official-bundles'
import { addTemplateBundles, TEMPLATE_BEFORE_RECORD, TEMPLATE_RECORD, withTemplateBundles } from '../src/deepwidgets-profile-bundles.ts'

const TEMPLATE = PROFILE_TEMPLATES.web!.bundles
const MAIN = '@deepwidgets/widget-main'
const SAMPLE = '@deepwidgets/widget-sample'

function profile(bundles: readonly string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'deepwidgets-profile-bundles-'))
  onTestFinished(() => { rmSync(dir, { recursive: true, force: true }) })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop', private: true, dependencies: { plugin: '1.0.0' }, dsh: { profile: { bundles } } }))
  return dir
}

function bundlesOf(dir: string): string[] {
  return (JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dsh: { profile: { bundles: string[] } } }).dsh.profile.bundles
}

function recordOf(dir: string): string[] {
  return (JSON.parse(readFileSync(join(dir, TEMPLATE_RECORD), 'utf8')) as { bundles: string[] }).bundles
}

describe('template bundles of an existing profile (main_widget.menu_bar)', () => {
  it('adds @deepwidgets/widget-main to a profile made before main.runtime, in its template place', () => {
    const dir = profile([...TEMPLATE_BEFORE_RECORD, 'plugin'])
    expect(addTemplateBundles(dir, TEMPLATE)).toEqual([MAIN])
    expect(bundlesOf(dir)).toEqual([...TEMPLATE, 'plugin'])
    expect((JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as { dependencies: unknown }).dependencies).toEqual({ plugin: '1.0.0' })
    expect(recordOf(dir)).toEqual(expect.arrayContaining([...TEMPLATE]))
  })

  it('does not add back a template bundle that the operator removed after the record', () => {
    const dir = profile([...TEMPLATE_BEFORE_RECORD])
    addTemplateBundles(dir, TEMPLATE)
    const removed = bundlesOf(dir).filter(name => name !== MAIN && name !== SAMPLE)
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'dsh-profile-desktop', private: true, dsh: { profile: { bundles: removed } } }))
    expect(addTemplateBundles(dir, TEMPLATE)).toEqual([])
    expect(bundlesOf(dir)).toEqual(removed)
  })

  it('does not add back a bundle of the old template that a profile with no record does not list', () => {
    const dir = profile([...TEMPLATE_BEFORE_RECORD.filter(name => name !== SAMPLE)])
    expect(addTemplateBundles(dir, TEMPLATE)).toEqual([MAIN])
    expect(bundlesOf(dir)).not.toContain(SAMPLE)
  })

  it('adds a template bundle that is new since the record', () => {
    const dir = profile([...TEMPLATE_BEFORE_RECORD])
    writeFileSync(join(dir, TEMPLATE_RECORD), JSON.stringify({ bundles: TEMPLATE.filter(name => name !== MAIN) }))
    expect(addTemplateBundles(dir, [...TEMPLATE])).toEqual([MAIN])
  })

  it('does not write the bundle list of a new profile, and writes its record', () => {
    const dir = profile([...TEMPLATE, 'plugin'])
    const before = readFileSync(join(dir, 'package.json'), 'utf8')
    expect(addTemplateBundles(dir, TEMPLATE)).toEqual([])
    expect(readFileSync(join(dir, 'package.json'), 'utf8')).toBe(before)
    expect(existsSync(join(dir, TEMPLATE_RECORD))).toBe(true)
    expect(recordOf(dir)).not.toContain('plugin')
  })

  it('uses the baseline of a profile with no record when the record is not a list', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => { warn.mockRestore() })
    const dir = profile([...TEMPLATE_BEFORE_RECORD])
    writeFileSync(join(dir, TEMPLATE_RECORD), '{broken')
    expect(addTemplateBundles(dir, TEMPLATE)).toEqual([MAIN])
    expect(warn).toHaveBeenCalledOnce()
    expect(recordOf(dir)).toEqual(expect.arrayContaining([...TEMPLATE]))
  })

  it('keeps the template order and the other bundles', () => {
    expect(withTemplateBundles(['a', 'x', 'd'], ['a', 'b', 'c', 'd'])).toEqual(['a', 'x', 'b', 'c', 'd'])
    expect(withTemplateBundles(['a', 'x'], ['a', 'b'])).toEqual(['a', 'b', 'x'])
    expect(withTemplateBundles(['x'], ['a', 'b'])).toEqual(['x', 'a', 'b'])
    expect(withTemplateBundles(['a', 'd'], ['a', 'b', 'c', 'd'], ['c'])).toEqual(['a', 'c', 'd'])
    expect(withTemplateBundles([], TEMPLATE)).toEqual([...TEMPLATE])
  })
})
