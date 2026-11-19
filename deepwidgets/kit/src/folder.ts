/**
 * The files of one kit version (`kit.folder`), and the real folders of the core in the app.
 *
 * Each kit version is a pnpm project at `<kit>/versions/<n>`. pnpm 11 reads its settings and `overrides` only from
 * `pnpm-workspace.yaml`, not from `package.json`, so the overrides of the core links are in that file
 * (`kit.checked.core_link`). The store and the metadata cache are `<kit>/store` and `<kit>/cache`: each version
 * names them by the same relative path, because each version has the same depth.
 * @module @deepwidgets/kit/folder
 */
import { existsSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)

/** The core of `kit.terms`: the packages that each page needs. The kit links them to the copies of the app. */
export const CORE = [
  'react',
  'react-dom',
  '@types/react',
  '@types/react-dom',
  '@openuidev/react-lang',
  'zod',
  '@deepwidgets/widget-kit',
  '@deepwidgets/shell',
] as const

export type CoreName = (typeof CORE)[number]

const CORE_NAMES: ReadonlySet<string> = new Set(CORE)

/** True when `name` is a core package. */
export const isCore = (name: string): boolean => CORE_NAMES.has(name)

/** The dependency spec of a core package in a kit version: a link to `core/<name>` in the version. */
export const coreSpec = (name: CoreName): string => `link:./core/${name}`

/**
 * The real folder of each core package in the app. `@deepwidgets/widget-kit` resolves React, its types, and OpenUI,
 * and OpenUI resolves zod, so the page and the core share one copy of each.
 * @throws {Error} when a core package does not resolve from the app.
 */
export function appCoreFolders(): Record<CoreName, string> {
  const kit = realpathSync(dirname(require.resolve('@deepwidgets/widget-kit/package.json')))
  const kitRequire = createRequire(join(kit, 'package.json'))
  // A package can leave `package.json` out of its exports, so the folder comes from the node_modules lookup paths.
  const folder = (from: NodeJS.Require, name: string): string => {
    const found = (from.resolve.paths(name) ?? []).map((base) => join(base, name)).find((path) => existsSync(join(path, 'package.json')))
    if (found === undefined) throw new Error(`the core package ${name} does not resolve from the app`)
    return realpathSync(found)
  }
  const lang = folder(kitRequire, '@openuidev/react-lang')
  return {
    'react': folder(kitRequire, 'react'),
    'react-dom': folder(kitRequire, 'react-dom'),
    '@types/react': folder(kitRequire, '@types/react'),
    '@types/react-dom': folder(kitRequire, '@types/react-dom'),
    '@openuidev/react-lang': lang,
    'zod': folder(createRequire(join(lang, 'package.json')), 'zod'),
    '@deepwidgets/widget-kit': kit,
    '@deepwidgets/shell': realpathSync(dirname(require.resolve('@deepwidgets/shell/package.json'))),
  }
}

/** The `package.json` of version 1: the core links only. pnpm writes each later version. */
export function firstManifestText(): string {
  const dependencies = Object.fromEntries(CORE.map((name) => [name, coreSpec(name)]))
  return `${JSON.stringify({ name: 'deepwidgets-kit', version: '1.0.0', private: true, dependencies }, null, 2)}\n`
}

/**
 * The `pnpm-workspace.yaml` of a kit version: the store and the cache of the kit, the release hold of
 * `kit.release_hold`, the build policy of `kit.build_scripts`, and the core links again as overrides. Without the
 * overrides, pnpm can put a copy of React from npm in place of the core.
 */
export function workspaceText(): string {
  return [
    '# Written by @deepwidgets/kit (kit.folder). Do not edit: the next change of the kit writes it again.',
    'storeDir: ../../store',
    'cacheDir: ../../cache',
    'minimumReleaseAge: 1440',
    'dangerouslyAllowAllBuilds: true',
    'overrides:',
    ...CORE.map((name) => `  ${JSON.stringify(name)}: ${JSON.stringify(coreSpec(name))}`),
    '',
  ].join('\n')
}

/** The error code that the pnpmfile gives to a refused package. pnpm prints it as `[ERR_DEEPWIDGETS_KIT_REFUSED]`. */
export const REFUSED_CODE = 'ERR_DEEPWIDGETS_KIT_REFUSED'

/**
 * The `.pnpmfile.cjs` of a kit version (`kit.settings`). Its `readPackage` hook throws for each name of
 * `kit.refuseBuilds`, also for a package that another package needs, so the kit refuses the whole package. The list is
 * sorted, so the same list gives the same file and the same lockfile checksum.
 */
export function pnpmfileText(refused: readonly string[]): string {
  const names = JSON.stringify([...new Set(refused)].sort())
  return [
    '// Written by @deepwidgets/kit (kit.settings) from kit.refuseBuilds of the settings file. Do not edit.',
    `const REFUSED = new Set(${names})`,
    'module.exports = {',
    '  hooks: {',
    '    readPackage(pkg) {',
    `      if (REFUSED.has(pkg.name)) throw Object.assign(new Error(\`deepwidgets-kit: the package \${pkg.name}@\${pkg.version} is refused by kit.refuseBuilds\`), { code: '${REFUSED_CODE}' })`,
    '      return pkg',
    '    },',
    '  },',
    '}',
    '',
  ].join('\n')
}
