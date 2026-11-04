# deepWidgets `head`

This file is the head node for every agent in this repository. Read it before any other agent file. The rule that keeps it current is in `head.rules`.

## What this repository is `head.what`

deepWidgets is an unofficial fork of DeepSeek Harness (DSH). The fork started as one squashed copy of DSH commit `22ddee3`. On 2026-11-02, [Ronitron007/deepWidgets#73](https://github.com/Ronitron007/deepWidgets/pull/73) merged DSH `master` `ce7073d5` into the fork through the vendor branch `rohan/dsh-upstream`. That upstream commit has Cordis `4.0.0-rc.11`. `docs/plans/upstream-sync.md` tells how a sync works. `UPSTREAM.md` gives the upstream commits and the license.

The goal is a floating desktop widget whose plugins run on Cordis. DSH already has a Cordis host process, a Cordis client in the renderer, and an Electron desktop app. Thus deepWidgets starts from DSH and turns off the parts that it does not use.

## Why most code does not run `head.why`

Most code in this repository is DSH code that deepWidgets does not need. The repository has 403 workspace packages, with the root. At boot, the desktop app composes 201 plugin rows. The floating widget needs only a small part of them.

The operator keeps the unused code on purpose. It shows how DSH writes Cordis plugins, and the operator reads it. Do not delete it to make the repository smaller.

## How the trim turns code off `head.trim`

- To turn off a plugin, set `disabled: true` on its row in a deepWidgets patch file. Put a `# deepwidgets-trim: <reason>` comment above the row. Keep the row.

- Keep each package that no row loads. Do not delete its files, and do not comment them out.

- When a kept file must change, comment out the old lines. Put the marker `deepwidgets-trim: <reason>` on the first commented line. `git grep deepwidgets-trim` lists each block.

- Delete packages only when the operator asks.

Code without a comment can still be off. A plugin row is off when a patch layer sets `disabled: true`, or when its `!!js` condition is true. A row that waits for a missing service stays pending and does not run. Thus a comment search does not tell you which code runs.

## Status `head.status`

| Item | State on 2026-11-04 |
|---|---|
| Rows that deepWidgets turns off | `deepwidgets/trim/cordis.patch.yml` turns off 161 of the 201 rows. The rows `hmr` and `timer` are on again for the widget system (`widget_rows`). Some kept rows stay pending, because the agent rows are off. |
| Our packages | `deepwidgets/probe` and `deepwidgets/trace` (TypeScript). `deepwidgets/trim`: the trim patch, the row lists, and the test bundle `fixtures/widget-rows-install`. The widget MVP (spec `widget_mvp`) adds these packages: `deepwidgets/widgets` (the runtime, service `widgets`), `deepwidgets/widget-sample` (the `sample` counter), `deepwidgets/shell` (the widget page, built with Vite), `deepwidgets/mcp` (the MCP server for agents, see its `README.md`). Electron main opens one floating window for each widget (`apps/desktop/src/deepwidgets-windows.ts`). |
| MCP port | The desktop host binds the fixed port `DEEPWIDGETS_MCP_PORT` (default 47615). It writes `$DSH_HOME/deepwidgets/mcp.json`. Smoke runs use port 0. |
| Main window | The app opens the main window at once, with no welcome window. The main window shows only `hello` and the probe text. |
| Checks | The scripts in `tools/` check the app, the host, and the widgets. `head.checks` lists each script and each smoke flag. |

## Checks `head.checks`

The smoke check `tools/smoke-desktop.mjs` boots the app. Each flag below adds a test to the run, or changes how the run works.

- `DSH_SMOKE_PROBE=1` runs the probe test.

- `DSH_SMOKE_TRACE=1` runs the trace test.

- `DSH_SMOKE_HELLO=1` runs the hello test.

- `DSH_SMOKE_ROWS=<folder>` compares the loaded rows with the row lists in that folder.

- `DSH_SMOKE_ROWS_SAVE=<file>` writes the host row snapshot to that file. It needs `DSH_SMOKE_ROWS`.

- `DSH_SMOKE_ROWS_SNAPSHOT=<file>` compares that snapshot with `rows.host.txt` and does not start the app. It needs `DSH_SMOKE_ROWS`.

- `DSH_SMOKE_INSTALL=<absolute bundle folder>` installs that bundle into the running host. The bundle must apply at once, and its plugin must run.

- `DSH_SMOKE_WIDGET=<slug>` checks the widget page and its live refresh.

- `DSH_SMOKE_WINDOWS=1` checks that `sample` gets one window. The window must close when the `sample` row turns off.

- `DSH_SMOKE_CREATE=<widget source folder>` installs that folder over MCP with `widget_install`. Then it finds the window and removes the widget.

- `DSH_SMOKE_HOST_RESTART=1` kills the host two times. After the first kill, the `sample` page and the main window must come back. Then the check kills the host again and quits the app while the restart waits. The app must exit by itself.

- `DSH_SMOKE_HOST_RESTART=boot` kills the host while the main window starts.

- `DSH_SMOKE_HOST_RESTART=give-up` checks safe mode and the fatal dialog.

- `DSH_SMOKE_HOST_RESTART=blame` installs a widget that crashes the host. Its page must show failed, and the restart must not use safe mode. A changed file of the widget must lift the quarantine.

- `DSH_SMOKE_HOST_RESTART=watchdog` checks that the watchdog stops a looping widget.

- `DSH_SMOKE_TIMEOUT_MS` sets the time limit of the run in milliseconds. The default is 240000.

These scripts run with no app, unless the item says otherwise:

- `tools/widgets-runtime.mjs` and `tools/widgets-mcp.mjs` check the runtime and the MCP server with a host.

- `tools/widgets-mcp-port.mjs` checks the fixed port. It also boots the app two times, unless `WIDGETS_MCP_PORT_SKIP_DESKTOP=1`.

- `tools/trace-late-row.mjs` checks that the trace finds late rows.

- `tools/trace-client-rows.mjs` checks the client half of the trace.

- `tools/widgets-blame.mjs` checks the crash blame and the quarantine with a host.

- `tools/widgets-watchdog.mjs` checks the watchdog with a host.

- `tools/widgets-create.mjs` checks widget creation over MCP with a host. Then it runs the `DSH_SMOKE_CREATE` smoke, unless `WIDGETS_CREATE_DESKTOP=0`.

- `tools/widgets-action-replay.mjs` replays the `action_contract` model paths of widget actions on a host.

- `tools/widgets-install-replay.mjs` runs the `widget_install` replays of the `widget-state-models` skill on a host.

- `tools/dsh-upstream-check.sh` lists the upstream DSH changes in the parts that deepWidgets uses, and the merge conflicts.

- `tools/verify-import.sh` compares the import commit with the upstream commit in `UPSTREAM.md`.

The file `tools/smoke-desktop-linux.mjs` is not a check. It gives the Linux helpers of `tools/smoke-desktop.mjs`.

## Where things are `head.map`

| Path | Content |
|---|---|
| `docs/specs/` | `fork-trim.md` (`fork_trim`), `floating-widget.md` (`floating_widget`), `ts-move.md` (`ts_move`), `widget-rows.md` (`widget_rows`), `widget-mvp.md` (`widget_mvp`), `widget-phase2.md` (`widget_phase2`), `handoff.md` (`handoff`, proposed), `handoff-evidence.md` (`handoff_evidence`), `widget-fv.md` (`widget_fv`), `mcp-consent.md` (`mcp_consent`) |
| `docs/explore/widget-system/` | The widget decisions (`where-we-stand.md`, `standing.decided`), the checked facts, the open points, and the spikes `widget-kit-spike.md` (`kit_spike`) and `plugins-spike.md` (`plugins_spike`) |
| `docs/plans/` | The plans of the specs. Each plan unit is one PR. |
| `docs/canvas/` | JSON Canvas boards that show how a system works, such as `floating-widget-processes.canvas`. |
| `docs/tasks/` | The task file of a unit, written before the unit starts. `docs/tasks/README.md` is the task protocol. |
| `deepwidgets/` | The `@deepwidgets/*` packages. Each package with code is in TypeScript. `build:artifacts` compiles each one, except `shell`, into `lib/`. The app and the tools load `lib/` (spec `ts_move`). `build:web` builds `shell` with Vite into `deepwidgets/shell/dist/widget`. `trim` has no package code, only a test bundle. A widget bundle, such as `probe`, has a host half and a client half. |
| `tools/` | deepWidgets scripts, such as the smoke check. |
| `.agents/skills/` | The skills. `.claude/skills` is a link to this folder. |
| `.claude/hooks/` | Claude Code hooks for this repository. |

## Upstream agent files `head.upstream`

The root `AGENTS.md` and 31 nested `CLAUDE.md` and `AGENTS.md` files come from DSH. Some of the nested files are snapshot fixtures, not rules. Use their code conventions when you edit DSH code. Do not follow their process rules: PR description templates, AI usage sections, labels, `gh stack`, CI gates, release steps, upgrade guides, Agent Notes, bilingual documents, and translations.

## Skills `head.skills`

The repository has 23 skills: 21 from DSH, and the `cordis` and `widget-state-models` skills from deepWidgets. A skill can load from its description alone. Thus check this table before you follow a skill.

| Use | Skills |
|---|---|
| Always, for Cordis work | `cordis`, `dsh-error-handling` |
| When you change a file that the widget state models cover, or fix a finding of `widget_fv` | `widget-state-models` |
| Only when you review Cordis plugin code | `cordis-styling-nitpicking` |
| Only when you write comments or JSDoc in DSH code | `dsh-prose-standard` |
| Only when you change DSH client UI packages | `dsh-client-ui-ux`, `dsh-responsive-ui` |
| Only when you write or fix a test that starts processes or listens on a port | `dsh-ci-test-reliability` |
| Do not use. They serve DSH process rules. | `dsh-archive-agent-notes`, `dsh-code-review`, `dsh-create-upgrade-guide`, `dsh-doc`, `dsh-find-simplifications`, `dsh-merging-stacked-prs`, `dsh-pr-description`, `dsh-pre-push-checks`, `dsh-translate-docs`, `dsh-trim-cot-leakage`, `record-browser-gif` |
| Do not use. Their features are off or out of scope. | `agent-experience`, `dsh-official-plugin-artwork`, `dsh-session-projection`, `dsh-speed-up-perf` |

Some skills that you use point to a skill in a "Do not use" row, or to Agent Notes. Skip those steps.

## Rules for agents `head.rules`

- A task file in `docs/tasks/` is the authority for its unit. Read `docs/tasks/README.md` before you start a task.

- Keep this file current. A change can make a fact in this file wrong or missing. If your task file lets you edit that part of `CLAUDE.md`, fix it in the same PR. Otherwise do not edit this file. Write the proposed change under `Findings` in your PR body.

- Do not change the Electron version.

- Branch names start with `rohan/`. Branch from `origin/main` and open PRs against `main`. Never force-push.

- Never commit secrets.

## Commands `head.commands`

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version
corepack pnpm install --frozen-lockfile
corepack pnpm run build:artifacts
corepack pnpm --filter @deepseek-ai/dsh-desktop run build
corepack pnpm run start:desktop
node tools/smoke-desktop.mjs
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs
DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs
DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs
DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs
DSH_SMOKE_INSTALL="$PWD/deepwidgets/trim/fixtures/widget-rows-install" node tools/smoke-desktop.mjs
DSH_SMOKE_WIDGET=sample node tools/smoke-desktop.mjs
DSH_SMOKE_WINDOWS=1 node tools/smoke-desktop.mjs
node tools/widgets-runtime.mjs
node tools/widgets-mcp.mjs
node tools/widgets-mcp-port.mjs
DSH_SMOKE_HOST_RESTART=1 node tools/smoke-desktop.mjs
DSH_SMOKE_HOST_RESTART=boot node tools/smoke-desktop.mjs
DSH_SMOKE_HOST_RESTART=give-up node tools/smoke-desktop.mjs
DSH_SMOKE_HOST_RESTART=blame node tools/smoke-desktop.mjs
DSH_SMOKE_HOST_RESTART=watchdog node tools/smoke-desktop.mjs
DSH_SMOKE_ROWS=deepwidgets/trim DSH_SMOKE_ROWS_SAVE="${TMPDIR:-/tmp}/rows.json" node tools/smoke-desktop.mjs
DSH_SMOKE_ROWS=deepwidgets/trim DSH_SMOKE_ROWS_SNAPSHOT="${TMPDIR:-/tmp}/rows.json" node tools/smoke-desktop.mjs
node tools/widgets-blame.mjs
node tools/widgets-watchdog.mjs
node tools/widgets-create.mjs
node tools/widgets-action-replay.mjs
node tools/widgets-install-replay.mjs
tools/dsh-upstream-check.sh
tools/verify-import.sh d15b5ec5
node tools/trace-late-row.mjs
node tools/trace-client-rows.mjs
```

Before an install that pulls `@openuidev` packages, set `OPENUI_TELEMETRY_DISABLED=1`.

Several agents share this Mac. Thus only one app or smoke run can occur at a time. Do these steps for each run:

1. Take the lock with `until mkdir /tmp/deepwidgets-smoke.lock 2>/dev/null; do sleep 15; done`.

2. Do the run.

3. Remove the lock with `rmdir /tmp/deepwidgets-smoke.lock`.

Under machine load, the watchdog can stop a healthy host. The open point "Watchdog threshold" in `widget_fv.open` (`docs/specs/widget-fv.md`) records this. Until a decision closes that point, run a failed check one more time.

A check that installs a bundle over the Node inspector must run the install in `hmr.executing.exit`. Without it, the install can fail with `HMR transactions cannot be nested`.
