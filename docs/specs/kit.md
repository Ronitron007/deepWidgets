# Widget kit `kit`

The kit is the set of packages that the page of a widget can import. This spec builds the unit `kit.service`. The other kit units wait for the operator's direction. `kit.later` lists them. The data comes from the spike `kit_spike` (2026-11-03) and the spike of 2026-11-19 (`kit.checked`).

## Terms `kit.terms`

- **Kit:** one pnpm project for each profile, at `$DSH_HOME/deepwidgets/kit/`.

- **Core:** the 8 packages that each page needs: `react`, `react-dom`, `@types/react`, `@types/react-dom`, `@openuidev/react-lang`, `zod`, `@deepwidgets/widget-kit`, and `@deepwidgets/shell`.

- **Extra:** a package from npm that the kit holds next to the core, such as `date-fns`.

- **Kit version:** a number. Each change of the kit adds one.

## Decisions `kit.decisions`

The operator gave these decisions on 2026-11-18 and 2026-11-19.

| Decision | Answer | Data |
|---|---|---|
| `kit.packaging` | One kit project with a frozen lockfile and a local store (strategy S2 of `kit_spike.strategies`). A widget build links to the kit and uses no network. | S2 builds offline, gives the same result each time, and fails fast. A kit change does not break a built page, because each page holds its own copy of each package. |
| `kit.core` | The core is the 8 packages of `kit.terms`. The kit links them to the copies of the app. They change only with an app update. The operator can change this decision later. | The core and each page break when an extra changes the version of React, or adds a second React. |
| `kit.build_scripts` | The install scripts of each extra run. The setting `kit.refuseBuilds` names the packages that the kit refuses. An install that meets a refused package fails and names it. Later, a prompt to the operator replaces the setting. | An install script runs on the Mac of the operator. |
| `kit.release_hold` | Keep the pnpm wait of 24 hours on new versions (`minimumReleaseAge` 1440). | An attack on npm usually adds a bad version that npm removes within hours. Whether a security fix can skip the wait is `deferred.kit_pins_security`. |
| `kit.spec_home` | This spec. `agent_library.later` points to it. | The kit has its own folder, settings, tools, pane, and model. |

## The kit folder `kit.folder`

```
$DSH_HOME/deepwidgets/kit/
  current -> versions/<n>
  versions/<n>/
    package.json
    pnpm-lock.yaml
    .pnpmfile.cjs
    core/<name> -> the folder of the core package in the app
    node_modules/
  store/
  cache/
```

- Each kit version is a full pnpm project in `versions/<n>`. The link `current` points to the newest version.

- `package.json` names each core package as `link:./core/<name>`. `pnpm-workspace.yaml` of the version names each one in `overrides`, with the same link, because pnpm 11 ignores `overrides` in `package.json`. Without the overrides, pnpm can put a copy of React from npm in place of the core (`kit.checked.core_link`).

- `package.json` names each extra with an exact version. `pnpm add --save-exact` with a range still writes a range, so the service writes the exact version that pnpm resolved.

- Each link in `core/` points to the real folder of the core package in the app. The host points each link again at each start. Thus an app update changes the core, and the lockfile does not change, because it holds only the relative links.

- `store/` is the pnpm store, and `cache/` is the metadata cache of pnpm. Each kit version uses both.

- The kit keeps the last 3 versions and removes older ones. The unit `kit.pins` can change this rule.

- The kit runs pnpm with the command that the host gets from the app (`standing.checked.pnpm_in_app`). The plugin manager of DSH runs pnpm the same way (`packages/boot/plugin-manager/src/index.ts`).

- The kit runs only pnpm 11. pnpm 10 prints its error codes in another form, and it uses another store folder (`store/v10`, not `store/v11`). Thus a kit that pnpm 11 made is not whole under pnpm 10. A CLI host with no package manager in its profile uses the pnpm version of the repository, 11.28.5.

## The settings `kit.settings`

The settings file is `$DSH_HOME/deepwidgets/settings.json`, the file of the modes (`modes.settings`).

```json
{ "kit": { "refuseBuilds": ["core-js"] } }
```

- `kit.refuseBuilds` is a list of package names. A missing key means an empty list.

- The service `mcpSettings` of `@deepwidgets/mcp` writes this file and keeps the keys that it does not own (`main_widget.settings`). Thus the key `kit` stays when a mode switch writes the file.

- A refused package can not be in the kit. The hook `readPackage` of `.pnpmfile.cjs` refuses it, also when another package needs it. Thus the kit refuses the whole package, not only its script (`kit.checked.build_scripts`).

- Each other install script runs (`dangerouslyAllowAllBuilds`).

- A change of the list changes the pnpmfile. Thus the next change of the kit makes a new kit version, and that version does not use the frozen lockfile.

## The service `kit.service`

A new package, `@deepwidgets/kit`, in `deepwidgets/kit/`, gives the Cordis service `kit`.

### At host start `kit.service.start`

1. The service checks the major version of pnpm. When it is not 11, the kit is unavailable, and the error names the version.

2. If the kit has no version, the service makes version 1 with the core only. This step uses no network.

3. The service points each link in `core/` at the folder of the core package in the app.

4. If `node_modules` of the current version is missing, the service installs it offline from the store, with the frozen lockfile and `trust-lockfile`. The wait of 24 hours ran when the change wrote the lockfile, so this step does not check it again (`kit.checked.offline`).

5. If that install fails, the kit is unavailable. The service does not stop the host. Each page install then fails with `kit-unavailable`, and a bundle with no `page/` installs as before.

### The calls `kit.service.calls`

| Call | What it does |
|---|---|
| `read()` | Gives the kit version, the core with its versions, and the extras with their versions. |
| `add(spec)` | Adds one extra. `spec` is a name with an optional range or version, such as `date-fns@^4`. |
| `remove(name)` | Removes one extra. |
| `folders()` | Gives the real folder of each core package and each extra of the current version, for the page gates. |

These steps make one change, `add` or `remove`:

1. Copy the current version to `versions/<n+1>`, without `node_modules`. The copy has the same depth as the old version, so the relative paths of the lockfile stay correct (`kit.checked.offline`).

2. Run `pnpm add --save-exact <spec>` or `pnpm remove <name>` in the copy. Only this step uses the network.

3. If a step fails, remove the copy. The current version does not change.

4. Point `current` to the copy. The kit version is now `n+1`.

The service runs one change at a time, in order.

### The lock `kit.service.lock`

- The dev app and a CLI host can use the same `$DSH_HOME`. Thus two processes can change the same kit.

- Each change and each start holds a file lock on the kit. The lock is `withFileLock` of `@deepseek-ai/dsh-atomic-write`, which takes over the lock of a process that ended. The DSH CLI holds the same kind of lock around each pnpm run of a profile (`apps/cli/src/plugin.ts`).

- A start waits while another process changes the kit. Thus the start never removes a version that another process still makes.

- Without the lock, two processes both wrote `versions/2`, and `current` pointed at a folder that was gone. After that, each start found the kit unavailable (the review of PR #140, verified by a run).

### Errors `kit.service.errors`

| Code | When |
|---|---|
| `in-core` | `add` or `remove` names a core package |
| `not-found` | npm has no such package or version |
| `install-failed` | pnpm failed. The answer gives the pnpm code and the package. A refused package (`kit.settings`) and a version newer than 24 hours (`ERR_PNPM_NO_MATURE_MATCHING_VERSION`) give this code. |
| `kit-unavailable` | The kit can not be made whole offline (`kit.service.start`) |

## The page gates `kit.gates`

- The page gates of `agent_library.build_gate` get the core folders from `folders()` of the kit, not from the install of the app.

- Each extra of the current kit version is an allowed import of a page, with its subpaths. The gates link it into the staging `node_modules` next to the core.

- A widget build uses no network.

- The name of a page build hashes the page sources and the kit version. Thus an install after a kit change builds the page again, and does not use the old build.

- The host half of a widget can not import an extra yet. The unit `kit.host_extras` adds that.

## Checked facts `kit.checked`

The spike of 2026-11-19 ran pnpm 11.28.5 with node 24.8.0. Each row is verified by a run.

| Fact | Result |
|---|---|
| `kit.checked.build_scripts` | `dangerouslyAllowAllBuilds` ignores the `false` entries of `allowBuilds`. `neverBuiltDependencies` is gone in pnpm 11. A `readPackage` hook that throws for a refused name fails the install and names the package, also for a package that another package needs. A frozen install with a changed pnpmfile fails with `LOCKFILE_CONFIG_MISMATCH`. |
| `kit.checked.release_hold` | With a range, pnpm picks the newest version that is old enough. An exact version that is too new fails with `ERR_PNPM_NO_MATURE_MATCHING_VERSION`. `minimumReleaseAgeExclude` lifts the wait for one package. |
| `kit.checked.core_link` | With `link:` only, `pnpm add recharts` put React 19.3.1 from npm in place of the linked React 18.3.1, when `node_modules` was there. With no `node_modules`, pnpm kept the linked React. A change runs `pnpm add` in a copy with no `node_modules`, and then a second run, with `node_modules`, writes the exact version. Without the overrides, that second run fetched React from npm. With the same links in `overrides`, the kit kept one React, the copy of the app, with no peer warning. |
| `kit.checked.offline` | An offline frozen install of a copy at the same depth took 1.85 s. A copy 2 levels deeper failed with `ERR_PNPM_OUTDATED_LOCKFILE`. With no store, the install failed in 0.43 s with `ERR_PNPM_NO_OFFLINE_TARBALL`. Without `trust-lockfile`, an offline install passes only when pnpm listed the lockfile in `cache/lockfile-verified.jsonl`. `pnpm add` lists its lockfile, but `pnpm remove` did not, and the next offline install failed with `ERR_PNPM_NO_OFFLINE_META` with the store present. With `trust-lockfile`, it passed in 1.7 s (the run of the implementer, 2026-11-19). |

## Open points `kit.open`

- `kit.packaged`: the packaged app keeps the core in `app.asar`, and its file rules remove the type files (`apps/desktop/packaging/README.md`). Thus the links of `kit.folder` work only in the dev app and in a CLI host. The packaged app can not be built today (`build.packaged_deepwidgets`). When it can, a unit must unpack the core next to `app.asar` and keep its type files.

## Later `kit.later`

These units follow, in this order. Each one waits for the operator's direction.

- `kit.host_extras`: the host half of a widget can import an extra.

- `kit.tools`: the MCP mode `kit` with `kit_read`, `kit_describe`, `kit_add`, and `kit_remove`, and the setting that lets agents add packages.

- `kit.pins`: each widget records its kit version, and a rebuild happens only on request.

- `kit.pane`: the settings pane and `/api/kit`.

- `kit.model`: a TLA+ model of the kit, and a change to `WidgetInstall.tla` for the page gates.
