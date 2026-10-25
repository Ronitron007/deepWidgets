# deepWidgets `head`

This file is the head node for every agent in this repository. Read it before any other agent file. The rule that keeps it current is in `head.rules`.

## What this repository is `head.what`

deepWidgets is an unofficial fork of DeepSeek Harness (DSH). The fork is one squashed copy of DSH commit `22ddee3`. `UPSTREAM.md` gives the source commit and the license.

The goal is a floating desktop widget whose plugins run on Cordis. DSH already has a Cordis host process, a Cordis client in the renderer, and an Electron desktop app. Thus deepWidgets starts from DSH and turns off the parts that it does not use.

## Why most code does not run `head.why`

Most code in this repository is DSH code that deepWidgets does not need. The repository has 387 workspace packages. At boot, the desktop app composes 196 plugin rows. The floating widget needs only a small part of them.

The operator keeps the unused code on purpose. It shows how DSH writes Cordis plugins, and the operator reads it. Do not delete it to make the repository smaller.

## How the trim turns code off `head.trim`

- To turn off a plugin, set `disabled: true` on its row in a deepWidgets patch file. Put a `# deepwidgets-trim: <reason>` comment above the row. Keep the row.

- Keep each package that no row loads. Do not delete its files, and do not comment them out.

- When a kept file must change, comment out the old lines. Put the marker `deepwidgets-trim: <reason>` on the first commented line. `git grep deepwidgets-trim` lists each block.

- Delete packages only when the operator asks.

Code without a comment can still be off. A plugin row is off when a patch layer sets `disabled: true`, or when its `!!js` condition is true. A row that waits for a missing service stays pending and does not run. Thus a comment search does not tell you which code runs.

## Status `head.status`

| Item | State on 2026-10-24 |
|---|---|
| Rows that deepWidgets turns off | None yet. The unit `trim.profile` turns them off. DSH itself turns off some of the 196 rows, with `disabled: true` or a `!!js` condition. |
| Our packages | `deepwidgets/probe` (merged). `deepwidgets/trace` (host half and client half merged). `deepwidgets/trim` (planned). |
| Checks | `tools/smoke-desktop.mjs` boots the app. With `DSH_SMOKE_PROBE=1`, it also runs the probe test. With `DSH_SMOKE_TRACE=1`, it also runs the trace test. `tools/trace-late-row.mjs` checks that the trace finds late rows. `tools/trace-client-rows.mjs` checks the client half with no app. |

## Where things are `head.map`

| Path | Content |
|---|---|
| `docs/specs/` | `fork-trim.md` (spec `fork_trim`), `floating-widget.md` (spec `floating_widget`) |
| `docs/plans/` | One plan for each spec. Each plan unit is one PR. |
| `docs/canvas/` | JSON Canvas boards that show how a system works, such as `floating-widget-processes.canvas`. |
| `docs/tasks/` | The task file of a unit, written before the unit starts. `docs/tasks/README.md` is the task protocol. |
| `deepwidgets/` | The `@deepwidgets/*` packages, in plain JavaScript. A widget bundle, such as `probe`, has a host half and a client half. |
| `tools/` | deepWidgets scripts, such as the smoke check. |
| `.agents/skills/` | The skills. `.claude/skills` is a link to this folder. |
| `.claude/hooks/` | Claude Code hooks for this repository. |

## Upstream agent files `head.upstream`

The root `AGENTS.md` and 31 nested `CLAUDE.md` and `AGENTS.md` files come from DSH. Some of the nested files are snapshot fixtures, not rules. Use their code conventions when you edit DSH code. Do not follow their process rules: PR description templates, AI usage sections, labels, `gh stack`, CI gates, release steps, upgrade guides, Agent Notes, bilingual documents, and translations.

## Skills `head.skills`

The repository has 22 skills: 21 from DSH and the `cordis` skill from deepWidgets. A skill can load from its description alone. Thus check this table before you follow a skill.

| Use | Skills |
|---|---|
| Always, for Cordis work | `cordis`, `dsh-error-handling` |
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
DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs
node tools/trace-late-row.mjs
node tools/trace-client-rows.mjs
```
