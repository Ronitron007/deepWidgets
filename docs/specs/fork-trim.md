# Fork and trim the DeepSeek Harness `fork_trim`

## Goal `fork_trim.goal`

deepWidgets runs a trimmed copy of the DeepSeek Harness desktop app. In this spec, "DSH" means the DeepSeek Harness repository.

Two Cordis Contexts run. The `host` Context runs in the child host process. The `client` Context runs in the renderer. A Cordis Context is the object that holds the plugin tree of one process.

The two Contexts exchange data over the loopback HTTP server of the host. The renderer shows one test widget, the `probe` widget. All other DSH features go.

## Source `fork_trim.source`

The source is `deepseek-ai/deepseek-harness` on GitHub, branch `master`. The license is MIT, copyright 2026 DeepSeek.

The import is one squashed commit of one upstream commit. At the time of writing, upstream `master` is `22ddee3`. The import unit records the final SHA.

A new root file `UPSTREAM.md` records the upstream SHA, the commit date, and the license. The import keeps `LICENSE` and `THIRD_PARTY_NOTICES.md` without change.

The import removes the current deepWidgets files `plugins/`, `registry.json`, and `src/`. The DSH root files replace `package.json` and `.gitignore`. Untracked files in the main checkout stay as they are.

## Process model `fork_trim.process_model`

The trimmed app keeps the DSH process model.

| Process | Source | Runs | Talks to |
|---|---|---|---|
| Electron main | `apps/desktop` | windows, menus, the spawn of the host | host, by Node IPC: `ready`, `platform-session`, shutdown |
| host | `apps/desktop-host` | the `host` Context, the Cordis loader, HMR, the web server | renderer, by loopback HTTP and SSE |
| renderer | the web frontend at `dsh-app://app` | the `client` Context, the React shell | host, by `fetch` and SSE |

Electron main starts the host with `ELECTRON_RUN_AS_NODE=1` and `--expose-internals`. The loader and HMR need this flag, because they read private Node module internals.

## Trim method `fork_trim.method`

The trim turns code off. It does not delete code. The operator reads the code that the trim turns off, because it shows the DSH style for Cordis plugins. A deletion unit comes later, and only when the operator asks for it.

1. Turn off plugin rows first. A deepWidgets patch file sets `disabled: true` on each row to remove. DSH uses the same syntax in `packages/bundle/web-app/cordis.patch.yml`. Keep the row, and put a `# deepwidgets-trim: <reason>` comment above it.

2. Keep each package that no row loads. Do not delete its files, and do not comment them out.

3. When a kept file must change, comment out the lines. Do not delete them. Put the marker `deepwidgets-trim: <reason>` on the first commented line. Then `git grep deepwidgets-trim` finds each commented block.

4. After each cut, run the build, the boot smoke check, and the probe test. Do not start the next cut until all three pass.

The boot check decides what stays. Code reading only makes the first guess.

## Keep list `fork_trim.keep_list`

This list is a first guess. It is not verified. The `trim.profile` unit settles the list with the boot check.

| Area | Packages |
|---|---|
| Cordis | `vendor/cordis`, `vendor/loader`, `vendor/hmr`, `vendor/cosmokit`, `vendor/schemastery`, `vendor/logger-console`, `vendor/timer` |
| apps | `apps/desktop`, `apps/desktop-host` |
| host boot | `packages/boot/app-boot`, `packages/boot/hmr`, the host web server |
| client | `packages/client/connection`, `packages/client/hmr`, `packages/client/modules`, the web frontend boot, `packages/client/ui-layout` |
| test | the `probe` bundle |

## Probe `fork_trim.probe`

The `probe` bundle is the test widget. It has a host half and a client half, like the DSH template `templates/decoration`.

- The host half registers the route `GET /api/probe`. The route returns `{ "ok": true, "pid": <host process id> }`.

- The client half registers a React component in the slot `shell.overlay`. The component calls `fetch('api/probe')` and shows the text `probe pid <n>`.

The text shows only after a successful round trip from the `client` Context to the `host` Context. Thus the probe test fails when either Context, the route, or the slot fails.

## Agent files `fork_trim.agent_files`

At `22ddee3`, DSH contains 34 `CLAUDE.md` and `AGENTS.md` files. It also contains `.agents/` with 3,911 note files and 21 skills. In DSH, `.claude/skills` is a symbolic link to `../.agents/skills`.

- The root `CLAUDE.md` becomes a short deepWidgets file. It links to the DSH `AGENTS.md` for code rules.

- The nested agent files stay until their package goes.

- The Cordis skill goes to `.agents/skills/cordis/`. The symbolic link then shows it as `.claude/skills/cordis/`. The branch `rohan/chore-claude-cordis-skill` does not merge, because its path collides with the symbolic link.

## Git hooks `fork_trim.git_hooks`

The DSH `postinstall` script runs `scripts/install-lefthook.mjs`. This script installs `pre-commit`, `pre-merge-commit`, and `pre-push` hooks into the Git directory. These hooks run the DSH gates on each commit.

The `fork.baseline` unit removes the `postinstall` entry and `lefthook.yml` before the first install.

## Versions `fork_trim.versions`

| Item | Version | Source |
|---|---|---|
| Electron | 44.7.0 | `pnpm-workspace.yaml` pins it with `node-addon-require-builtin` 0.1.9 |
| pnpm | 11.28.5 | `packageManager` in `package.json`, through corepack |
| Node, for build tools | `^22.19.0` or `>=24.0.0` | `engines` in `package.json` |

Do not change the Electron version during the trim. An Electron upgrade is a separate unit with its own check.

## Widget rows `fork_trim.widget_rows`

The widget system installs widget bundles while the app runs, and widgets refresh their data on timers. The unit `trim.profile` turned off the two rows that give these services. This section turns them on again. It covers only what the evidence below proves.

### Why the rows are needed `fork_trim.widget_rows.why`

| Row | Service | Why the widget system needs it |
|---|---|---|
| `hmr` | `hmr` | The plugin manager applies an install at once only when the `hmr` service exists. Without it, `installBundle` returns `restart-required` with the reason `no-hmr`. The widget design installs and reloads a widget on each change (decision `widget.dev_gates` on branch `rohan/widget-exploration`). |
| `timer` | `timer` | Widgets refresh their data with `ctx.timeout` and `ctx.interval`. |

### Evidence `fork_trim.widget_rows.evidence`

| Fact | Label |
|---|---|
| The trim patch turns off the entries `id: hmr` and `id: timer` in `deepwidgets/trim/cordis.patch.yml`. Its reason is "not needed: the boot test passes without it". | verified (read the file at `9d281c29`) |
| The DSH base row `hmr` has the condition `disabled: !!js "!ctx.get('profileContext')"` and the config `root: []`. The base row `timer` has no condition (`packages/bundle/base/cordis.patch.yml`). | verified (read the file) |
| The plugin manager checks `this.ownerContext.get('hmr')` before it applies a change. With no `hmr`, it does not apply the change at once (`packages/boot/plugin-manager/src/index.ts`, the method `configure` and the install path). | verified (read the file) |
| On the trimmed desktop host at `aba2f918`, `installBundle` of a small host bundle returned `restart-required` with `no-hmr`. With `hmr` and `timer` on again in a profile patch, it returned `applied` in 843 ms, and the plugin ran. | verified (the session "Check trim.profile keeps what widget creation needs" ran it on 2026-10-28). This document did not run it again. |
| Nobody ran the hello test, the probe test, the trace test, or the rows check with these two rows on. | not checked |

### Design `fork_trim.widget_rows.design`

- In `deepwidgets/trim/cordis.patch.yml`, comment out the entries `id: hmr` and `id: timer`. Put the marker `deepwidgets-trim: on again for the widget system (fork_trim.widget_rows)` on the first commented line. Do not delete the entries.

- Do not add a config for these rows. The DSH base config stays. Thus `hmr` loads only when `profileContext` exists. Its `root` stays empty, so it watches no source folder.

- Add `hmr` and `timer` to `deepwidgets/trim/rows.host.txt` as active rows, with the reason `on again (fork_trim.widget_rows)`.

- Keep `client-hmr`, `tools`, `system-prompt`, and `tool-plugin-manager` off. This unit does not need them.

- `fork_trim.out_of_scope` puts the plugin manager out of scope. This unit uses the plugin manager only to prove that an install applies at once. It does not build a feature on it.

### Proof `fork_trim.widget_rows.proof`

The unit is done when each of these is true:

- The rows check passes with the new row lists.

- A live install check installs a small fixture bundle into the booted trimmed desktop host and gets `applied`. The fixture plugin runs after the install.

- With the `hmr` entry turned off again, the live install check fails, because the result is `restart-required` with `no-hmr`.

- The smoke check, the hello test, the probe test, and the trace test pass.

### Open points `fork_trim.widget_rows.open`

These points are not decided. They stay out of this unit.

| Name | Point |
|---|---|
| `fork_trim.widget_rows.open.inspect` | The service `cordisInspect` needs the chain `cordis-inspect-providers`, `cordis-host-runner`, `tools`, and `system-prompt`. The trim turns off `tools` and `system-prompt`. The widget creation spec decides if agents use `cordis_inspect`. |
| `fork_trim.widget_rows.open.client_hmr` | Nobody checked if a widget with a client half needs `client-hmr`. |
| `fork_trim.widget_rows.open.check_form` | The form of the live install check. The task file decides it. Prior art: the Loader lookup over the host inspector in `tools/smoke-desktop.mjs`. |

## Out of scope `fork_trim.out_of_scope`

- The floating window. The spec `docs/specs/floating-widget.md` owns it.

- The agent, LLM providers, MCP, and the plugin manager.

- App packaging, code signing, and updates.

- Windows and Linux.
