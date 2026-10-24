# deepWidgets

deepWidgets is an unofficial fork of DeepSeek Harness (DSH). `UPSTREAM.md` gives the source commit and the license.

## Goal

Trim DSH to two Cordis Contexts and one test widget. The spec is `docs/specs/fork-trim.md`. The plan is `docs/plans/fork-trim.md`. Tasks are in `docs/tasks/`.

## Rules for agents

- `AGENTS.md` and the nested `CLAUDE.md` and `AGENTS.md` files come from upstream DSH. Use their code conventions when you edit DSH code.

- Do not follow the upstream process rules. These include PR description templates, AI usage sections, labels, `gh stack`, CI gates, release steps, upgrade guides, Agent Notes, and translations.

- A task file in `docs/tasks/` is the authority for its unit. Read `docs/tasks/README.md` before you start a task.

- Do not delete code that the trim removes. Comment it out, and put the marker `deepwidgets-trim: <reason>` on the first commented line.

- Do not change the Electron version.

- Branch names start with `rohan/`. Branch from `origin/main` and open PRs against `main`. Never force-push.

- Never commit secrets.

## Commands

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
