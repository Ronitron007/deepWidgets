# Move the deepWidgets packages to TypeScript `ts_move`

## Goal `ts_move.goal`

At `origin/main` `7353cbcd`, the packages `@deepwidgets/probe` and `@deepwidgets/trace` are plain JavaScript. The root build does not compile them, and the type check does not read them. This spec moves their source to TypeScript. Then the DSH build compiles, type checks, and bundles them in the same way as a DSH package.

The move changes the source form and the build. It does not change what the app does. `ts_move.keep` lists the behavior that must not change.

`@deepwidgets/trim` holds no code. It has a patch file and two row lists. The move does not change it.

In this spec, "DSH" means the DeepSeek Harness code in this repository. A "face" is one of the two TypeScript programs of DSH. The host face holds the code of the host process. The client face holds the code of the renderer.

## Decisions `ts_move.decisions`

The operator made these decisions in the handoff `handoff2`. These decisions do not change in this spec.

| Name | Decision |
|---|---|
| `decisions.ts_location` | The packages stay in `deepwidgets/`. The move changes the root build config to include them. It does not move them to `packages/`. |
| `decisions.ts_separate` | The packages keep their `@deepwidgets/*` names. The move adds them to the DSH build and type checks. |
| `decisions.ts_order` | Convert `@deepwidgets/probe` first. Then convert `@deepwidgets/trace`. |
| `decisions.electron` | Do not change the Electron version (44.7.0) or the pnpm version (11.28.5). |

## Evidence `ts_move.evidence`

Two spikes ran on the base `7353cbcd`, in the worktree `.worktrees/rohan-spike-prep-ts`. The reviewer (Codeine) reviewed each run. This spec uses the spike results only as the reviews qualify them.

| Spike | What it proves | Review |
|---|---|---|
| `spike.build_path` | The probe in TypeScript builds, type checks, and runs in the app. A type error makes the build fail. | `~/.buzz/RESEARCH/DEEPWIDGETS_PREP_TS_REVIEW_20261028/FINDINGS.md`: usable evidence. |
| `spike.page.rerun` | The build keeps `new URL('../page.html', import.meta.url)` as written. From `lib/index.js`, it finds a `page.html` at the package root. | `~/.buzz/RESEARCH/DEEPWIDGETS_PAGE_RERUN_REVIEW_20261028/REVIEW.md`: passes. |

The reviews name these limits:

- The runner did not save each shell exit code. For some commands, the review infers exit 0 from the end of the log (`review.prep.ts.exit_records`). The type error exits (1) are explicit in their logs.

- The spikes converted only the probe. They do not prove that the move of the trace works. Each claim about the trace in this spec has the label "inferred".

- The spikes do not test HMR.

The spike patch is `$TMPDIR/deepwidgets-prep-ts/patch/spike-build-path.patch`, sha256 `a4e1ca75a6db1f5217dd73abc0478e4266dcf8596305c8fecba3e1b9d5c0873e`. It holds the literal probe files.

## Package layout `ts_move.layout`

Each bundle uses the split-face layout of `packages/client/product-analytics`. That package has a real host half and a client half, as each deepWidgets bundle does. Each half gets its own TypeScript program. The reason: the host face and the client face merge different services into the same Cordis `Context` keys. One program cannot hold both (`tsconfig.host.json` lines 2-4, `tsconfig.client.json` lines 2-6). For example, the probe host half reads `process.pid`, and `tsconfig.base.client.json` has no `node` types.

| Part | `@deepwidgets/probe` | `@deepwidgets/trace` |
|---|---|---|
| `package.json` `main` and `types` | `lib/index.js` and `lib/types/index.d.ts` | the same |
| `package.json` `exports` | `.` to `{ "types": "./lib/types/index.d.ts", "default": "./lib/index.js" }`. `./client` to `{ "types": "./lib/types/client/index.d.ts", "default": "./lib/client.js" }`. `./package.json` stays. | the same |
| `package.json` `files` | `cordis.patch.yml`, `lib/index.js`, `lib/client.js`, `lib/types/**/*.d.ts` | the same, and `page.html` |
| `package.json` `peerDependencies` | `@deepseek-ai/cordis`: `workspace:~` | the same |
| `package.json` `devDependencies` | `@deepseek-ai/cordis` (`workspace:~`), `@deepseek-ai/dsh-client-ui-layout`, `@deepseek-ai/dsh-client-ui-renderer`, `@deepseek-ai/dsh-host-webserver` (each `workspace:*`), `react` (`^18.2.0`) | `@deepseek-ai/cordis` and `@deepseek-ai/cordis-plugin-loader` (each `workspace:~`), `@deepseek-ai/dsh-client-connection` and `@deepseek-ai/dsh-host-webserver` (each `workspace:*`) |
| `package.json` `scripts` | `"bundle": "tsdown"`, `"watch": "tsdown --watch"` | the same |
| `package.json` `name`, `version`, `private`, `type`, `dsh` | no change | no change |
| `tsconfig.json` | `files: []`, and one reference to each face config | the same |
| `tsconfig.host.json` | extends `../../tsconfig.base.json`. `rootDir` `src`, `outDir` `lib/types`, `tsBuildInfoFile` `lib/tsconfig.host.tsbuildinfo`. `files: ["src/index.ts"]`. References: `vendor/cordis`, `packages/host/webserver`. | the same compiler options and `files`. References: `vendor/cordis`, `vendor/loader`, `packages/host/webserver`, `packages/client/connection/tsconfig.host.json`. |
| `tsconfig.client.json` | extends `../../tsconfig.base.client.json`. The same folders, with `lib/tsconfig.client.tsbuildinfo`. `include: ["src"]`, `exclude: ["src/index.ts"]`. References: `vendor/cordis`, `packages/client/ui-renderer`, `packages/client/ui-layout`. | the same compiler options, `include`, and `exclude`. References: `vendor/cordis`, `vendor/loader`. |
| `tsdown.config.ts` | `export default clientBundle(import.meta.dirname, ['lib/types/index.js'])`, with `clientBundle` from `../../packages/client/tsdown.client.ts` | the same |
| `src/` | `src/index.ts` (host half), `src/client/index.ts` (client entry), `src/client/Probe.tsx` (the React component) | `src/index.ts` (host half), `src/client/index.ts` (client half) |
| Removed | `index.js`, `client.js` | `index.js`, `client.js` |
| No change | `cordis.patch.yml` | `cordis.patch.yml`, `page.html` |

Label of the probe column: verified (spike `spike.build_path`). Label of the trace column: inferred. The trace column follows the probe and the type sources in `ts_move.types`.

The build writes these files into `lib/`. The root `.gitignore` line 7 ignores `lib/`.

| File | Gate that writes it | Content |
|---|---|---|
| `lib/types/index.js`, `lib/types/index.d.ts` | `host-src` (`tsc -b`) | the host half |
| `lib/types/client/*.js`, `lib/types/client/*.d.ts` | `client-src` (`tsc -b`) | the client half |
| `lib/index.js` | `client-bundle` (tsdown) | the host half bundle that the Loader imports |
| `lib/client.js` | `client-bundle` (tsdown) | the client bundle that `client-modules` serves |

### Rules for the source `ts_move.layout.source`

- The move changes the file type, the module form, and the types. It keeps each function, each branch, each string, and each value.

- Each half exports `inject` and `apply`. The values of `inject` do not change.

- The client entry is `src/client/index.ts`. The helper `clientBundle` uses this path when the build sets no face (`packages/client/tsdown.client.ts` line 142).

- A half imports the types of a service with a type-only import. The client bundle rejects a value import of `@deepseek-ai/*` that is not a requested module (`tsdown.client.ts` lines 836-854).

- The client half of the trace has no value import. The reason: `tools/trace-client-rows.mjs` calls the bundle factory with no `require` (`ts_move.tools`).

- The client half of the probe imports `react` as a value. The bundle keeps `react` and `react/jsx-runtime` as externals, which the injected `require` gives (`packages/client/web/src/platform.ts` line 9). Verified (spike: `lib/client.js` requires both).

- The client module id stays `@deepwidgets/<package>`. `clientBundle` stamps the `name` of `package.json` into the bundle (`tsdown.client.ts` line 931).

## Types `ts_move.types`

| Half | Item | Type source | Package link |
|---|---|---|---|
| host | `ctx.webServer` | `import type {} from '@deepseek-ai/dsh-host-webserver'` (`packages/host/webserver/src/index.ts` line 32) | `devDependencies` |
| host | `ctx.connection` (trace) | `import type {} from '@deepseek-ai/dsh-client-connection'`, host face (`packages/client/connection/src/rpc-host.ts` lines 62-67) | `devDependencies` |
| host and client | `ctx.loader`, `fiber.entry` (trace) | `import type {} from '@deepseek-ai/cordis-plugin-loader'` (`vendor/loader/src/index.ts` lines 44-46 and 52-54) | `devDependencies` |
| host and client | `Context`, `ctx.effect`, `ctx.on`, `ctx.reflect`, `ctx.logger` | `import type { Context } from '@deepseek-ai/cordis'` (`vendor/cordis/src/context.ts`) | `devDependencies` and `peerDependencies` |
| host | `process`, `node:fs`, `Response`, `ReadableStream`, `TextEncoder` | `@types/node`, through `"types": ["node"]` in `tsconfig.base.json` line 26 | root `devDependencies` |
| client | `ctx.slots` (probe) | `import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'` (`packages/client/ui-renderer/src/client/index.ts` line 45) | `devDependencies` |
| client | the slot `shell.overlay` (probe) | `import type {} from '@deepseek-ai/dsh-client-ui-layout/client'` (`packages/client/ui-layout/src/client/index.ts` line 109) | `devDependencies` |
| client | React (probe) | `@types/react` in the root `devDependencies` | `react` in `devDependencies` |
| client | `fetch`, `location`, `URLSearchParams`, `queueMicrotask` (trace) | the `DOM` library in `tsconfig.base.client.json` | none |

The reason for each workspace link: `tsconfig.base.json` maps `@deepseek-ai/dsh-client-ui-layout` (line 297) but not its `/client` subpath. Thus TypeScript resolves that import through `node_modules`. The vendor packages also have hand-written aliases (lines 115-125). The links keep each import on one path.

Prior art for the client type of `ctx.loader`: `packages/client/modules/src/client/index.ts` line 14 imports `Loader` from `@deepseek-ai/cordis-plugin-loader`. Its `tsconfig.json` references `vendor/loader`.

Label of the probe rows: verified (spike compile). Label of the trace rows: verified (read) for the type sources, and inferred for the compile.

## Build path `ts_move.build_path`

The move changes three root files. It changes no build script.

1. Root `tsdown.config.ts`: add the glob `deepwidgets/*/tsdown.config.ts` to the `globSync` list on line 23. Comment out the old line, with the marker `deepwidgets-trim` (`head.trim` in `CLAUDE.md`).

2. `tsconfig.host.json`: add `{ "path": "./deepwidgets/<package>/tsconfig.host.json" }` to `references`.

3. `tsconfig.client.json`: add `{ "path": "./deepwidgets/<package>/tsconfig.client.json" }` to `references`.

The tested form of the root `tsdown.config.ts` change:

```ts
  // deepwidgets-trim: ts_move builds each deepwidgets package that has its own tsdown config.
  // const packages = workspacePackageGlobs(globSync(['vendor/*/package.json', 'packages/*/*/package.json'], { cwd: import.meta.dirname }))
  const packages = workspacePackageGlobs(globSync(['vendor/*/package.json', 'packages/*/*/package.json', 'deepwidgets/*/tsdown.config.ts'], { cwd: import.meta.dirname }))
```

`ts.probe` makes the `tsdown.config.ts` change. The glob also matches the trace after `ts.trace` adds `deepwidgets/trace/tsdown.config.ts`. Thus, of the three root files, `ts.trace` changes only the two aggregate tsconfig files. Inferred.

These files need no change: `scripts/build.ts`, `scripts/compile-referenced-projects.ts`, `scripts/workspace-package-globs.ts`, the member list of `pnpm-workspace.yaml` (it holds `deepwidgets/*`), `apps/cli/package.json` (it depends on each package), and `packages/util/official-bundles/src/bundles.ts`. The build scripts read the aggregate references and the root config. The helper `workspacePackageGlobs` takes the folder of each path. Thus a `tsdown.config.ts` path works the same as a manifest path. Verified (read, and spike `spike.build_path`).

The reason for the narrow glob: the glob `deepwidgets/*/package.json` also matches `deepwidgets/trim`. That package has no source. tsdown then stops with `Error: [@deepwidgets/trim] Cannot find entry: ["lib/types/{index,startup}.js"]`. Verified (spike `spike.build_path.fail.glob`, exit 1 reported by the runner). The narrow glob matches a package only when it has its own `tsdown.config.ts`.

`corepack pnpm run build:artifacts` builds the packages. It runs eight gates in this order: `native`, `host-typert`, `host-src`, `host-bundle`, `desktop-bundle`, `client-src`, `client-bundle`, `web` (`scripts/build.ts` lines 92-98). For a deepWidgets package, `host-bundle` does nothing, because `clientBundle` returns `SKIP_WORKSPACE_BUILD` for the host face (`tsdown.client.ts` line 148). Verified (spike: `run-gates: 8 passed, 0 failed`, exit 0 inferred from the log end).

## Page file `ts_move.page`

The trace host half reads `page.html` when the module loads. At the base, it reads `new URL('./page.html', import.meta.url)` (`deepwidgets/trace/index.js` line 4).

After the move:

- `page.html` stays at the package root, without change.

- `src/index.ts` reads `new URL('../page.html', import.meta.url)`.

- `package.json` `files` holds `page.html`.

The path is the same in each file that runs the host half. The files `src/index.ts` and `lib/index.js` are both one folder below the package root. The app and the tools run `lib/index.js`. Only tsdown reads `lib/types/index.js`.

Evidence: `spike.page.rerun` built a fixture with the tsdown options of the host half and `"type": "module"`. The output `lib/index.js` kept `../page.html` and found the root file (`page found`, exit 0). The old form `./page.html` did not find it (`page missing`, exit 1). Label: verified (spike, reviewed).

The real host half build also sets `define` and `deps` (`tsdown.client.ts` lines 274-283). Label for the claim that these options keep the URL: inferred. The trace test proves it in the app.

DSH ships the same form, for example `packages/experimental/ptc-runtime-python/src/launch.ts` lines 21-22.

## Tools `ts_move.tools`

`tools/trace-late-row.mjs` and `tools/trace-client-rows.mjs` import the trace files directly. `ts.trace` changes three import paths:

| File | Line | Base | After the move |
|---|---|---|---|
| `tools/trace-late-row.mjs` | 3 | `../deepwidgets/trace/index.js` | `../deepwidgets/trace/lib/index.js` |
| `tools/trace-client-rows.mjs` | 3 | `../deepwidgets/trace/index.js` | `../deepwidgets/trace/lib/index.js` |
| `tools/trace-client-rows.mjs` | 112 | `../deepwidgets/trace/client.js` | `../deepwidgets/trace/lib/client.js` |

The tools already import built files, for example `../vendor/cordis/lib/index.js` on line 1. Thus they already need `build:artifacts` first.

The built client has the form in this block (`tsdown.client.ts` lines 931-936):

```js
window.__ModuleLoader__.load({ id, factory: (require) => { /* ... */ return module.exports; } })
```

The tool `tools/trace-client-rows.mjs` calls `loaded.factory()` and gives the result to the Loader. The method `Loader.unwrapExports` keeps `module.exports`, because it has no `default` and no `__esModule` (`vendor/loader/src/index.ts` lines 201-208). Label: verified (read). Label for the claim that the tools pass on the built trace: inferred.

## Development `ts_move.dev`

The app loads the built `lib/` files, not the `src/` files.

- The desktop host runs `node --expose-internals <runtime>/node_modules/@deepseek-ai/dsh-desktop-host/lib/index.js` (`apps/desktop/src/host-process.ts` lines 199-207). The Loader imports each bundle by name. Thus Node uses `exports["."].default`, which is `./lib/index.js`.

- `client-modules` serves `exports["./client"]`, which is `./lib/client.js` (`packages/client/modules/src/index.ts` lines 201-212 and 904-909).

- Verified (spike): with `lib/index.js` moved away, the probe test gave `smoke-desktop: fail: probe text: missing`. With `lib/client.js` moved away, it gave `smoke-desktop: fail: host timeout`, and the desktop log names `lib/client.js` as missing.

At the base, a change to `index.js` or `client.js` takes effect at the next start of the app. Inferred: in the spike, the smoke check ran with no build and read the changed workspace files. After the move, a change to `src/` takes effect only after `corepack pnpm run build:artifacts`. `start:desktop` uses the `lib/` files on disk, because it runs `dev.ts --skip-build` (`apps/desktop/scripts/dev.ts` lines 94-98).

HMR does not reload a bundle at the base or after the move. The trim turns off the rows `hmr` and `client-hmr` (`deepwidgets/trim/cordis.patch.yml` lines 659-665). No spike tests HMR.

## Type check path `ts_move.typecheck`

| Gate | Command | How it includes a deepWidgets package |
|---|---|---|
| type check | `corepack pnpm run typecheck` | It runs `tsc -b` on each reference in `tsconfig.host.json` and `tsconfig.client.json` (`scripts/build.ts` lines 99-114). Thus the references of `ts_move.build_path` also put the packages in the type check. |
| build | `corepack pnpm run build:artifacts` | The gates `host-src` and `client-src` run the same `tsc -b`. |
| workspace constraints | `corepack pnpm run constraints` | It reads each member of `pnpm-workspace.yaml`. For a folder in `deepwidgets/`, it requires `"private": true`. It requires `workspace:*` for a `@deepseek-ai/dsh-*` dependency, and `workspace:~` for a vendor package (`scripts/check-workspace-constraints.ts` lines 506-529 and 682-698). No change. |
| path aliases | `corepack pnpm run verify-tsconfig-paths` | It reads only `packages/<group>/<dir>` with `@deepseek-ai/dsh-*` names. Not affected. |
| lint | `corepack pnpm exec tsx scripts/run-oxlint.ts <path>` | No rule applies to `deepwidgets/` at the base. `ts_move.lint` gives the change. |

Verified (spike) for the probe:

- A type error in `deepwidgets/probe/src/index.ts` made `build:artifacts` exit 1 and `typecheck` exit 1. Each log had 2 `FAILED host compiler` lines and the error `TS2322`.

- After the change, `typecheck` gave `run-gates: 5 passed, 0 failed`, the same as at the base. `constraints` and `verify-tsconfig-paths` passed. The review infers these exits from the log ends.

- A bad range in the probe manifest made the constraint script fail with `devDependencies.@deepseek-ai/dsh-host-webserver must use workspace:*, got ^0.0.0`.

### Lint `ts_move.lint`

At the base, `.oxlintrc.json` turns off the `correctness` category and has no top-level rule. Rules come only from `overrides`, and no override names `deepwidgets/`. Thus oxlint applies no rule to `deepwidgets/*/src`.

The last unit, `ts.lint`, adds `"deepwidgets/*/src/**/*.{ts,tsx}"` to the two source override blocks. These are the blocks that name `packages/*/*/src/**/*.{ts,tsx}` on lines 37 and 154. Then the deepWidgets source gets the same rules as a DSH source.

Verified (spike `spike.build_path.lint`): with the glob in the first block only, the converted probe code gave `typescript(no-floating-promises)` and `typescript(no-unsafe-assignment)`. The spike did not test the second block. Thus `ts.lint` also changes the source, with no change to behavior.

The operator decides whether `ts.lint` runs. `decisions.ts_separate` names the build and the type checks, not the lint. If the operator says no, the plan drops `ts.lint`, and the other units do not change.

## Lockfile `ts_move.lockfile`

Each new `devDependencies` block changes one importer in `pnpm-lock.yaml`. No `packages:` or `snapshots:` entry changes, because `react@18.3.1` is already in the lockfile.

| Unit | Change | Label |
|---|---|---|
| `ts.probe` | The line `  deepwidgets/probe: {}` becomes a `devDependencies` block of five entries. `git diff --numstat` gives `17 1 pnpm-lock.yaml`, in one hunk. | verified (spike `lock.diff`) |
| `ts.trace` | The line `  deepwidgets/trace: {}` becomes a `devDependencies` block of four entries, `14 1 pnpm-lock.yaml`, in one hunk. | inferred |

## Behavior that must not change `ts_move.keep`

| Item | Value at the base | Check that proves it |
|---|---|---|
| Row ids | `deepwidgets-probe` and `deepwidgets-trace`, in each `cordis.patch.yml` | The patch files do not change. The rows check passes. |
| Environment variables | `DEEPWIDGETS_PROBE=off` turns off the probe row. `DEEPWIDGETS_TRACE=off` turns off the trace row. Each `!!js` condition is in a `cordis.patch.yml`. | The off runs of the probe test and the trace test fail. |
| Probe route | `GET /api/probe`, one exact `ctx.webServer` route | The probe test passes. |
| Probe response body | `{ "ok": true, "pid": <host process id> }` | The probe test reads `probe pid <n>`, and `<n>` equals the host process id. |
| Probe page text | `probe pending`, `probe pid <n>`, `probe error <status>`, `probe error <message>`, `probe error fetch failed`. One `div` with `data-deepwidgets-probe`, in the slot `shell.overlay`, with the id `deepwidgets-probe`. | The probe test passes. |
| Trace routes | `GET /api/trace` and `POST /api/trace`: one exact `ctx.connection.fetch` route, with `methods: ['GET', 'POST']` and `requestBody: 'buffered'`. `GET /trace`: one exact `ctx.webServer` route. | The trace test passes. The trace off run fails. |
| Trace response bodies | For `POST`: `{ "added": <n> }`, or status 400 with `bad trace body` or `bad trace message <index>`. For `GET /api/trace`: the headers `content-type: text/event-stream; charset=utf-8` and `cache-control: no-cache`. Then `: open`, then one `data:` line for each message, and `: ping` each 15 seconds. For `GET /trace`: the bytes of `page.html`, with `content-type: text/html; charset=utf-8`. | The trace test, `tools/trace-late-row.mjs`, and `tools/trace-client-rows.mjs` pass. |
| Trace messages | The fields and their order: `seq`, `time`, `process`, `window` (only from `client`), `kind`, `name`, `state`, `detail` (only when it has text), `snapshot` (only when `true`). The rules of `floating_widget.message` and `floating_widget.names` in `docs/specs/floating-widget.md`. | The same three checks pass. |
| Trace page text | `page.html` | `page.html` does not change. The trace test reads the rows on `dsh-app://app/trace`. |
| Log and effect labels | `deepwidgets-probe: GET /api/probe`, `deepwidgets-trace: GET /trace`, `deepwidgets-trace: close streams`, `deepwidgets-trace: client sender`, and each `deepwidgets-trace: ... failed` warning | The task file gives the literal source. The reviewer compares it with the base. |
| Package names and client module ids | `@deepwidgets/probe` and `@deepwidgets/trace` | The probe test and the trace test pass. |

Each unit runs `git diff --exit-code origin/main -- deepwidgets/probe/cordis.patch.yml deepwidgets/trace/cordis.patch.yml deepwidgets/trace/page.html deepwidgets/trim`. It must exit 0.

## Text that the move makes wrong `ts_move.stale_text`

| File | Text at the base | Unit that changes it |
|---|---|---|
| `pnpm-workspace.yaml` line 4 | `# deepWidgets-owned plain-JS packages, outside the DSH TypeScript build globs.` | `ts.probe`. deepWidgets wrote this line in `probe.round_trip` (commit `1a59a4ec`). It is not a DSH line, so the unit replaces it with no marker. |
| `CLAUDE.md` `head.map`, row `deepwidgets/` | the words `in plain JavaScript` | `ts.probe` and `ts.trace`. Each task file lets the worker change this row. |
| `CLAUDE.md` `head.status`, row `Our packages` | No word about the source language | `ts.probe` and `ts.trace` |
| `CLAUDE.md` `head.map`, row `docs/specs/` | No `ts-move.md` | The first task file of `ts_move`. This docs PR does not change `CLAUDE.md`, because `CLAUDE.md` is outside `docs/`. |

## Out of scope `ts_move.out_of_scope`

- New behavior, and changes to the logic. For example, the list of fiber state words stays in each half of the trace, as at the base.

- The tools in `tools/`. They stay plain JavaScript. Only the import paths of `ts_move.tools` change.

- `@deepwidgets/trim`.

- HMR, and a test of reload.

- App packaging. Whether the packaged desktop build includes the deepWidgets packages is unknown.

- An upgrade of tsdown, TypeScript, Electron, or pnpm.

- The DSH CI gate sets (`check:all`, `check:ci:*`).

- The plain JavaScript template that agents use to write bundles (`packages/preset/agent-preset/skills/cordis-plugin-development/templates/`).

- The widget design: OpenUI, shells, and the window manager.
