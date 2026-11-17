/**
 * deepWidgets profile bundles. The Desktop profile takes its bundle list from the `web` template only when the profile
 * is created, and DSH has no step that adds a new template bundle to an existing profile. A profile made before the
 * unit `main.runtime` thus has no `@deepwidgets/widget-main`, and its panel stays empty (`main_widget.menu_bar`).
 *
 * Each boot adds only the template bundles that the profile never had. The operator can remove or turn off any bundle,
 * also a template bundle (`setBundleEnabled` of the plugin manager, or a hand edit of `package.json`), and the boot
 * does not add it back. The record file {@link TEMPLATE_RECORD} in the profile lists each template bundle that the
 * profile had. A profile with no record had the template of {@link TEMPLATE_BEFORE_RECORD}. A bundle that the profile
 * lists is never added again.
 * @module deepwidgets-profile-bundles
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readProfileManifest, writeProfileBundles } from '@deepseek-ai/dsh-app-boot'

/** The record of the template bundles that the profile had, in the profile directory. */
export const TEMPLATE_RECORD = 'deepwidgets-template-bundles.json'

/** The `web` template before the unit `main.runtime`, when the record did not exist yet. */
export const TEMPLATE_BEFORE_RECORD: readonly string[] = [
  '@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepwidgets/probe', '@deepwidgets/trace', '@deepwidgets/widgets',
  '@deepwidgets/widget-sample', '@deepwidgets/mcp', '@deepwidgets/trim',
]

/**
 * Add each bundle of `names` that `bundles` does not list. A bundle goes before the next template bundle that the list
 * has, so the patch layers keep the template order (`@deepwidgets/trim` stays after the widget bundles). With no later
 * template bundle in the list, it goes after the last earlier one, else at the end.
 * @param bundles - the bundle list of the profile.
 * @param template - the bundle list of the profile template.
 * @param names - the template bundles to add; the default is each template bundle.
 * @returns the new list; the same entries in the same order when no bundle of `names` is missing.
 */
export function withTemplateBundles(bundles: readonly string[], template: readonly string[], names: readonly string[] = template): string[] {
  const result = [...bundles]
  template.forEach((name, index) => {
    if (!names.includes(name) || result.includes(name)) return
    const next = template.slice(index + 1).find(later => result.includes(later))
    if (next !== undefined) { result.splice(result.indexOf(next), 0, name); return }
    const previous = template.slice(0, index).findLast(earlier => result.includes(earlier))
    result.splice(previous === undefined ? result.length : result.lastIndexOf(previous) + 1, 0, name)
  })
  return result
}

/**
 * Read the record of a profile. A missing or unreadable record gives undefined, so the boot uses the baseline of a
 * profile with no record. An unreadable record writes one warning.
 */
function readRecord(profileDir: string): string[] | undefined {
  const path = join(profileDir, TEMPLATE_RECORD)
  if (!existsSync(path)) return undefined
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as { bundles?: unknown }
    if (Array.isArray(value.bundles) && value.bundles.every(name => typeof name === 'string')) return value.bundles as string[]
  } catch { /* the warning below */ }
  console.warn(`deepwidgets-profile: ${path} is not a list of bundles; the boot uses the baseline of a profile with no record`)
  return undefined
}

/**
 * Add the template bundles that an existing profile never had, and record each template bundle as had.
 * The caller holds the profile lock.
 * @param profileDir - the profile directory with its `package.json`.
 * @param template - the bundle list of the profile template.
 * @returns the bundles that this call added, in template order; empty when the bundle list did not change.
 */
export function addTemplateBundles(profileDir: string, template: readonly string[]): string[] {
  const manifest = readProfileManifest('dsh', profileDir)
  const bundles = manifest.dsh?.profile?.bundles ?? []
  const record = readRecord(profileDir)
  const had = new Set(record ?? TEMPLATE_BEFORE_RECORD)
  const added = template.filter(name => !had.has(name) && !bundles.includes(name))
  if (added.length > 0) writeProfileBundles(profileDir, manifest, withTemplateBundles(bundles, template, added))
  const next = [...new Set([...had, ...template])]
  if (record === undefined || next.length !== record.length) {
    writeFileSync(join(profileDir, TEMPLATE_RECORD), `${JSON.stringify({ bundles: next }, undefined, 2)}\n`, { mode: 0o600 })
  }
  return added
}
