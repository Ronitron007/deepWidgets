# Widget rows `widget_rows`

This file holds the design decisions of the unit `trim.widget_rows`. The widget system installs widget bundles while the app runs, and widgets refresh their data on timers. The unit `trim.profile` turned off the two rows that give these services. This unit turns them on again. This file covers only what the evidence below proves.

The file is not part of the spec `fork_trim`, because the reason for the unit is the widget system. The task file is `docs/tasks/trim-widget-rows.md`.

## Why the rows are needed `widget_rows.why`

| Row | Service | Why the widget system needs it |
|---|---|---|
| `hmr` | `hmr` | The plugin manager applies an install at once only when the `hmr` service exists. Without it, `installBundle` returns `restart-required` with the reason `no-hmr`. The widget design installs and reloads a widget on each change (decision `widget.dev_gates` on branch `rohan/widget-exploration`). |
| `timer` | `timer` | Widgets refresh their data with `ctx.timeout` and `ctx.interval`. |

## Evidence `widget_rows.evidence`

| Fact | Label |
|---|---|
| The trim patch turns off the entries `id: hmr` and `id: timer` in `deepwidgets/trim/cordis.patch.yml`. Its reason is "not needed: the boot test passes without it". | verified (read the file at `9d281c29`) |
| The DSH base row `hmr` has the condition `disabled: !!js "!ctx.get('profileContext')"` and the config `root: []`. The base row `timer` has no condition (`packages/bundle/base/cordis.patch.yml`). | verified (read the file) |
| The plugin manager checks `this.ownerContext.get('hmr')` before it applies a change. With no `hmr`, it does not apply the change at once (`packages/boot/plugin-manager/src/index.ts`, the method `configure` and the install path). | verified (read the file) |
| On the trimmed desktop host at `aba2f918`, `installBundle` of a small host bundle returned `restart-required` with `no-hmr`. With `hmr` and `timer` on again in a profile patch, it returned `applied` in 843 ms, and the plugin ran. | verified (the session "Check trim.profile keeps what widget creation needs" ran it on 2026-10-28). This document did not run it again. |
| Nobody ran the hello test, the probe test, the trace test, or the rows check with these two rows on. | not checked |

## Design `widget_rows.design`

- In `deepwidgets/trim/cordis.patch.yml`, comment out the entries `id: hmr` and `id: timer`. Put the marker `deepwidgets-trim: on again for the widget system (widget_rows)` on the first commented line. Do not delete the entries.

- Do not add a config for these rows. The DSH base config stays. Thus `hmr` loads only when `profileContext` exists. Its `root` stays empty, so it watches no source folder.

- Add `hmr` and `timer` to `deepwidgets/trim/rows.host.txt` as active rows, with the reason `on again (widget_rows)`.

- Keep `client-hmr`, `tools`, `system-prompt`, and `tool-plugin-manager` off. This unit does not need them.

- `fork_trim.out_of_scope` puts the plugin manager out of scope. This unit uses the plugin manager only to prove that an install applies at once. It does not build a feature on it.

## Proof `widget_rows.proof`

The unit is done when each of these is true:

- The rows check passes with the new row lists.

- A live install check installs a small fixture bundle into the booted trimmed desktop host and gets `applied`. The fixture plugin runs after the install.

- With the `hmr` entry turned off again, the live install check fails, because the result is `restart-required` with `no-hmr`.

- The smoke check, the hello test, the probe test, and the trace test pass.

## Open points `widget_rows.open`

These points are not decided. They stay out of this unit.

| Name | Point |
|---|---|
| `widget_rows.open.inspect` | The service `cordisInspect` needs the chain `cordis-inspect-providers`, `cordis-host-runner`, `tools`, and `system-prompt`. The trim turns off `tools` and `system-prompt`. The widget creation spec decides if agents use `cordis_inspect`. |
| `widget_rows.open.client_hmr` | Nobody checked if a widget with a client half needs `client-hmr`. |
| `widget_rows.open.check_form` | The form of the live install check. The task file decides it. Prior art: the Loader lookup over the host inspector in `tools/smoke-desktop.mjs`. |

## Decisions `widget_rows.decisions`

These decisions are fixed. If a finding needs a change to one of them, stop and ask the operator.

| Name | Decision |
|---|---|
| `widget_rows.decisions.scope` | Only the rows `hmr` and `timer` come on again. The rows `client-hmr`, `tools`, `system-prompt`, and `tool-plugin-manager` stay off. |
| `widget_rows.decisions.trim_method` | The unit turns rows on by comment, as the trim turns them off. It deletes no code. The rules are `fork_trim.method` in `docs/specs/fork-trim.md` and `head.trim` in `CLAUDE.md`. |
| `widget_rows.decisions.versions` | Do not change the Electron version (44.7.0) or the pnpm version (11.28.5). |
| `widget_rows.decisions.why` | The widget system installs and reloads widget bundles while the app runs (`widget.dev_gates`). Widgets refresh on timers. The decisions are in `docs/explore/widget-system/where-we-stand.md` on the branch `rohan/widget-exploration`. |

## Stop rules `widget_rows.stop`

- When a step fails and the task file gives no fallback for it, stop. Report the command, the exit code, and the last 40 lines of output.

- When a check shows that `hmr` or `timer` breaks a smoke check, the hello test, the probe test, or the trace test, stop and ask the operator. Do not turn off more rows to make the check pass.

- When the unit needs a row outside `widget_rows.decisions.scope`, stop and ask the operator.

## Unit `widget_rows.unit`

| Unit | Change | Check | Needs |
|---|---|---|---|
| `trim.widget_rows` | Turn the rows `hmr` and `timer` on again, as `widget_rows.design` tells. Add both rows to `deepwidgets/trim/rows.host.txt`. Add a live install check. | The checks of `widget_rows.proof`. With the `hmr` entry turned off again, the live install check must fail with `restart-required` and `no-hmr`. | `trim.profile` |
