/**
 * deepWidgets profile bundles. The Desktop profile takes its bundle list from the `web` template only when the profile
 * is created, and DSH has no step that adds a new template bundle to an existing profile. A profile made before the
 * unit `main.runtime` thus has no `@deepwidgets/widget-main`, and its panel stays empty (`main_widget.menu_bar`).
 * Each boot adds each missing template bundle. The plugin manager never removes a template bundle from the list,
 * because a template bundle is not a profile dependency, so an added bundle was not removed by the operator.
 * @module deepwidgets-profile-bundles
 */
import { readProfileManifest, writeProfileBundles } from '@deepseek-ai/dsh-app-boot'

/**
 * Add each template bundle that `bundles` does not list. A missing bundle goes before the next template bundle that
 * the list has, so the patch layers keep the template order (`@deepwidgets/trim` stays after the widget bundles).
 * With no later template bundle in the list, it goes after the last earlier one, else at the end.
 * @param bundles - the bundle list of the profile.
 * @param template - the bundle list of the profile template.
 * @returns the new list; the same entries in the same order when no template bundle is missing.
 */
export function withTemplateBundles(bundles: readonly string[], template: readonly string[]): string[] {
  const result = [...bundles]
  template.forEach((name, index) => {
    if (result.includes(name)) return
    const next = template.slice(index + 1).find(later => result.includes(later))
    if (next !== undefined) { result.splice(result.indexOf(next), 0, name); return }
    const previous = template.slice(0, index).findLast(earlier => result.includes(earlier))
    result.splice(previous === undefined ? result.length : result.lastIndexOf(previous) + 1, 0, name)
  })
  return result
}

/**
 * Add the missing template bundles to the manifest of an existing profile. The caller holds the profile lock.
 * @param profileDir - the profile directory with its `package.json`.
 * @param template - the bundle list of the profile template.
 * @returns the bundles that this call added, in template order; empty when the manifest did not change.
 */
export function addTemplateBundles(profileDir: string, template: readonly string[]): string[] {
  const manifest = readProfileManifest('dsh', profileDir)
  const bundles = manifest.dsh?.profile?.bundles ?? []
  const added = template.filter(name => !bundles.includes(name))
  if (added.length > 0) writeProfileBundles(profileDir, manifest, withTemplateBundles(bundles, template))
  return added
}
