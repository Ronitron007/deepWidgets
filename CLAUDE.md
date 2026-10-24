# deepWidgets `head`

This file is the head node for every agent in this repository. Read it before any other agent file. Keep it current: a commit that makes a fact here wrong must also fix this file.

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

Code without a comment can still be off. To know if code runs, find its plugin row, and read the row state in the patch files.

## Status `head.status`

| Item | State on 2026-10-24 |
|---|---|
| Rows turned off | None. All 196 rows load. The unit `trim.profile` turns rows off. |
| Our packages | `deepwidgets/probe` (merged). `deepwidgets/trace` (planned). |
| Checks | `tools/smoke-desktop.mjs` boots the app. With `DSH_SMOKE_PROBE=1`, it also runs the probe test. |

## Where things are `head.map`

| Path | Content |
|---|---|
| `docs/specs/` | `fork-trim.md` (spec `fork_trim`), `floating-widget.md` (spec `floating_widget`) |
| `docs/plans/` | One plan for each spec. Each plan unit is one PR. |
| `docs/tasks/` | One task file for each unit. `docs/tasks/README.md` is the task protocol. |
| `deepwidgets/` | The `@deepwidgets/*` packages. They are plain JavaScript bundles with a host half and a client half. |
| `tools/` | deepWidgets scripts, such as the smoke check. |
| `.agents/skills/` | The skills. `.claude/skills` is a link to this folder. |
| `.claude/hooks/` | Claude Code hooks for this repository. |

## Upstream agent files `head.upstream`

The root `AGENTS.md` and 31 nested `CLAUDE.md` and `AGENTS.md` files come from DSH. Use their code conventions when you edit DSH code. Do not follow their process rules: PR description templates, AI usage sections, labels, `gh stack`, CI gates, release steps, upgrade guides, Agent Notes, bilingual documents, and translations.

## Skills `head.skills`

The repository has 22 skills: 21 from DSH and the `cordis` skill from deepWidgets. A skill can load from its description alone. Thus check this table before you follow a skill.

| Use | Skills |
|---|---|
| Always, for Cordis work | `cordis`, `cordis-styling-nitpicking`, `dsh-error-handling` |
| Only when you change DSH client UI packages | `dsh-client-ui-ux`, `dsh-responsive-ui` |
| Only when you write or fix a test that starts processes or listens on a port | `dsh-ci-test-reliability` |
| Do not use. They serve DSH process rules. | `dsh-archive-agent-notes`, `dsh-code-review`, `dsh-create-upgrade-guide`, `dsh-doc`, `dsh-merging-stacked-prs`, `dsh-pr-description`, `dsh-pre-push-checks`, `dsh-prose-standard`, `dsh-translate-docs`, `dsh-trim-cot-leakage`, `record-browser-gif` |
| Do not use. Their features are off or out of scope. | `agent-experience`, `dsh-find-simplifications`, `dsh-official-plugin-artwork`, `dsh-session-projection`, `dsh-speed-up-perf` |

## Rules for agents `head.rules`

- A task file in `docs/tasks/` is the authority for its unit. Read `docs/tasks/README.md` before you start a task.

- If your change makes a fact in this file wrong, fix this file in the same PR. If your task file does not name `CLAUDE.md`, write the proposed change under `Findings` in your PR body.

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
```
