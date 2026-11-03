# Agent plugins, safe HMR, and modes `plugins_spike`

This file records three spikes, run on 2026-11-04 at `origin/main` `a4248829`. It is not a spec. A spec follows only after the operator gives the whole direction. A row is measured or read unless it says "inferred" or "a guess".

## Operator direction so far `plugins_spike.direction`

- Agents can write their own Cordis plugins, not only widgets.

- An MCP tool lets an agent inject more services into a widget or a plugin. A setting enables this, as `agentsMayAddPackages` does for packages.

- Plugin development and HMR must not stop the host.

- An agent must know the modes of operation and what each mode needs.

## How DSH Creator mode does it `plugins_spike.creator`

1. The preset `cordis` gives the agent bash, file tools, `cordis_inspect_list`, `cordis_inspect_query`, `plugin_manager` with 8 actions, the `plugin_market` tools, and the skills `cordis-plugin-development` and `cordis-composition-reference`.

2. The agent copies a template into its workspace and calls `install_bundle` with the folder.

3. `install_bundle` asks for sandbox approval, takes the profile lock, checks the version, runs `pnpm add link:`, and selects the bundle. HMR `reconcileProfile` applies it.

4. Creator mode has no inject allow-list, no type check, no lint, and no test run. A failed activation leaves the bundle installed.

## Plugins and widgets in our host `plugins_spike.kinds`

| Item | Plain plugin | Widget |
|---|---|---|
| What it is | A Loader row with any `inject`, routes, and storage | A plugin that calls `ctx.widgets.register` |
| Action contract, window, gates | No | Yes |
| Blame | No: a crash is "blamed on no widget" | Yes |

One bundle can hold both. Four things block that today: the widget type file, the test run (it gives only `timer` and a stand-in `widgets`), the guide, and the type paths, which allow only `zod`.

## Prototype `plugins_spike.proto`

The spike installed an agent-style plugin through our plugin manager in a CLI host, without our gates.

| Case | Result |
|---|---|
| Install a plugin with `webServer` and `storageDomain` | Applied in 2.9 s. The route stores and serves data. |
| A request with no cookie to that route | 200. A `webServer` route has no cookie check. |
| Replace: remove, then install | Applied in 4.1 s. The data stays. |
| `apply` throws, or an inject is missing | `failed`. The host stays up. The bundle stays installed. |
| A route handler throws | 400. The host stays up. |
| A floating promise rejection, or a timer callback throws | The host exits. No widget is blamed. |
| Host restart | The plugin loads again, and the data stays. |

## Inject access `plugins_spike.inject`

- The bundle keeps `export const inject`. The test run reports it, and the installer refuses a name that is not in the allow-list of the settings, with `inject-denied`.

- `ctx.get()` ignores `inject`. Thus the allow-list declares and types the access. It is not a sandbox.

- The type file comes from the `lib/types` of each allowed package. The test run gives a stand-in for each allowed service. `plugin_guide` gives the live allow-list as tool output.

| Tier | Services | Evidence |
|---|---|---|
| Stops the host | `loader`, `hmr`, `pluginManager`, `configEditor`, `settings`, `storage`, `clientModules`, `typert` | A plugin stopped `hmr` through `loader`. After that, `removeBundle` failed with `stop-profile`. A plugin that stopped `pluginManager` removed it until restart. |
| Secret | `credentials` | |
| Exposure | `webServer` | Routes have no cookie check |
| Safe by default | `storageDomain`, `connection`, `timer`, `widgets` | |

## Setting and tools `plugins_spike.tools`

This is a design from the spike, not a decision.

- Settings fields on the row `deepwidgets-mcp`, saved through the DSH `settings` service: `agentsMayInstallPlugins` (off by default) and `agentPluginInject` (the allow-list). A second switch for the services that stop the host is the operator's decision.

- Tools beside `widget_*` and `kit_*`: `plugin_guide`, `plugin_template`, `plugin_install`, `plugin_reload`, `plugin_remove`, and `plugin_list`. `widget_install` uses the same allow-list.

- The row id is `deepwidgets-agent-plugin-<name>`. A settings change sends `tools/list_changed`.

- An "Agents" pane in the main window holds the consent list, the kit extras, the plugin switch, and the installed plugins.

## Safe plugin development and HMR `plugins_spike.hmr`

### DSH lessons

| Lesson | Take or skip |
|---|---|
| A time limit on `runExclusive` and on Cordis `_unload` | Take. Neither has a limit today. |
| The update-with-restore of `updateBundle` | Take. A reload removes the old version first today. |
| `partialReload` rollback | Skip. It serves only the file watcher, and the host watches no files (`hmr.root=[]`). |
| The fail-loud claimer that resumes after an error | Skip. Resuming after a half-applied write is not safe. |

### What our framework covers for a plain plugin

| Item | State |
|---|---|
| Blame for `apply` and its timers | Works as is |
| Blame for `ctx.on` listeners | Needs a change: no blame when the plugin never calls `register` |
| Root and hash of the crash record | Needs a change: both are null, so a quarantine never lifts by hash |
| Quarantine | Needs a change: rows outside `deepwidgets-(widget\|agent)-*` are not wrapped |
| Watchdog | Works in `apply`. It misses top-level module code. |
| Supervisor backoff | Works as is |
| Safe mode | Needs a change: it refuses only `register`, so plain plugins still run |
| Gates | Need a change: the test run allows only `widgets` and `timer`, and it never disposes or reloads |

### Tests of HMR dangers

| Case | Result |
|---|---|
| `apply` throws (sync, async, after register) | Contained. The host stays up. The old version is gone. |
| A disposer throws | Contained |
| A disposer never ends | `removeBundle`, `runExclusive`, and each later install wait forever. No blame, no watchdog. |
| A plugin stops the `storageDomain` provider | Widgets give 404 until restart, also after the plugin is removed. |
| A plugin stops the `webServer` provider | HTTP and MCP stop. The process lives, so the supervisor does nothing. |
| A plugin changes a shared service at run time | It works. `ctx.set` on a shared service is refused. |
| Leaks over 4 reloads | Raw timers 19 to 76 ticks per second, `process.on` listeners 2 to 5, heap 75 MB to 119 MB. They stay after removal. |
| An old leaked timer throws after a reload | The new version, which did nothing wrong, is quarantined |
| A loop in top-level code at install | Killed, but not blamed. At boot, also in safe mode, it is not killed and delays the boot by 5 s. |
| A plugin that reloads itself | About 18 reloads per second. Nothing stops it. |

### Gaps

| Gap | What it needs | Size (inferred) |
|---|---|---|
| A disposer that never ends | A time limit on each disposer and on `runExclusive`, then quarantine. Add it to a model. | S |
| Blame outside widgets | Blame each agent row, record root and hash at install, wrap `ctx.on` events | S |
| Safe mode and boot | Turn off agent rows in safe mode. Start the watchdog before agent rows load. Add it to a model. | S |
| Reload gate | A test run that loads, disposes, and loads again, and counts the handles | M |
| Rollback | Keep the old version live when a reload fails. `widget_fv.replace` covers widgets only. Add it to a model. | M |
| Lint | Refuse raw timers, `process.on`, and global writes | M |
| Service guard | A proxy for each plugin that blocks provider `dispose`, `reflect`, and prototype writes | L |
| Reload rate | A restart limit for each plugin, as in Erlang/OTP. Add it to a model. | M |
| Resource limits | Run agent plugins in a worker or an Electron `utilityProcess` | L |

## Modes of operation `plugins_spike.modes`

| Mode | Goal | Tools | Gate |
|---|---|---|---|
| Interact | Call actions | `widget_list`, `widget_describe`, `widget_call`, `widget_changes` | None |
| Create | Create or edit a widget | `widget_template`, `widget_install`, `widget_reload`, `widget_remove` | None |
| Library | Write its own OpenUI library and `<Renderer>` child | `library_*` (inferred) | None (inferred) |
| Kit | Manage kit packages | `kit_read`, `kit_describe`, `kit_add`, `kit_remove` | `agentsMayAddPackages` |
| Plugin | Write plugins and inject services | `plugin_*` | `agentsMayInstallPlugins` |

What Claude Code 2.1.317 does, measured against a local fake model API with no paid run:

| Way | Result |
|---|---|
| MCP prompts | They show in the operator's `/` menu. The model never sees their names. |
| MCP resources | Claude Code reads none by itself |
| Tool descriptions and `instructions` | They are not read again during a session |
| `readOnlyHint` | Read-only calls run in parallel. The permission prompt stays. |
| `destructiveHint` | No effect |
| A new tool | It shows on the next turn |

The proposal from the spike:

- One read-only tool, `deepwidgets_modes`, gives each mode, its tools, its guide, and whether its setting is on. It costs about 280 tokens for each call.

- `instructions` says only "Call deepwidgets_modes first."

- `widget_guide({mode})` gives the guide of each mode as tool output.

- Tool names start with their area: `widget_`, `kit_`, `library_`, `plugin_`.

- A gated tool is always listed. When its setting is off, it refuses with `mode-off`, the setting name, and a next step.

- Prompts are shortcuts for the operator only.

GitHub's MCP server uses the same shape, with named toolsets.

## Files `plugins_spike.files`

The spike files are in `~/.deepwidgets/spikes/plugins/`, `~/.deepwidgets/spikes/hmr-safety/`, and `~/.deepwidgets/spikes/modes/` on the operator's Mac. They are not in git.
