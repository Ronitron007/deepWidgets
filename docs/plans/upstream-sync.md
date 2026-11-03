# Plan for the upstream sync `upstream_sync.plan`

This plan tells how deepWidgets takes new commits from DeepSeek Harness (DSH). DSH is the upstream repository `deepseek-ai/deepseek-harness`. The branch `master` of DSH is the upstream head.

## Method `upstream_sync.plan.method`

deepWidgets uses a vendor branch. A vendor branch is a branch that holds only upstream trees.

- The vendor branch is `rohan/dsh-upstream`. It starts at the import commit `82d53618`. The tree of that commit is DSH `22ddee3` plus 4 deepWidgets files.

- Each sync adds one commit to the vendor branch. The tree of that commit is the new upstream head plus the same 4 files. The commit message names the upstream SHA.

- The 4 files are `UPSTREAM.md`, `docs/plans/fork-trim.md`, `docs/specs/fork-trim.md`, and `tools/verify-import.sh`.

- The vendor branch has no PR. Nobody force-pushes it.

- The sync branch `rohan/upstream-sync` starts at `origin/main`. It merges the vendor branch with a merge commit. Thus the last vendor commit becomes the merge base. The next sync then shows only the new upstream changes.

The report script `tools/dsh-upstream-check.sh` lists the upstream changes in the parts that deepWidgets uses. It also simulates the merge and lists the conflicts. The script does not change the repository.

## Conflict rules `upstream_sync.plan.conflicts`

- Keep each `deepwidgets-trim` block. Follow `head.trim` in `CLAUDE.md`.

- Keep the deepWidgets code, such as the widget windows and the MCP port.

- Take the upstream fixes and features in the same file.

- Keep the deletes of the `.github` files.

- Do not change the Electron version. If upstream changes it, keep the deepWidgets version.

- If upstream adds or renames a plugin row, update the trim patch and the row lists. Name each change in the PR body.

- If a conflict needs a product choice that this plan does not settle, stop. Report the choice and the options.

## Checks `upstream_sync.plan.checks`

Run each check in the foreground. Record each exit code. Commit only when each exit code is 0.

- Install the packages with `OPENUI_TELEMETRY_DISABLED=1 corepack pnpm install --frozen-lockfile`.

- Run `build:artifacts`, `build:web`, and the desktop build.

- Run `typecheck` and `lint`.

- Run the vitest specs of the supervisor and the crash policy.

- Run `widgets-runtime`, `widgets-mcp`, `widgets-blame`, `widgets-watchdog`, and `widgets-create`.

- Run `trace-late-row` and `trace-client-rows`.

- Run the smokes: plain, rows, `DSH_SMOKE_WIDGET=sample`, `DSH_SMOKE_WINDOWS=1`, `DSH_SMOKE_HOST_RESTART=blame`, and `DSH_SMOKE_HOST_RESTART=watchdog`.

The check `widgets-blame` has a known flake on the base. If it fails, run it again, up to 3 runs. Record each exit code.

Before each app run or smoke run, get the machine lock `/tmp/deepwidgets-smoke.lock`. After the run, release the lock.
