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

## Out of scope `fork_trim.out_of_scope`

- The floating window. The spec `docs/specs/floating-widget.md` owns it.

- The agent, LLM providers, MCP, and the plugin manager.

- App packaging, code signing, and updates.

- Windows and Linux.
