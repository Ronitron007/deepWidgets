# Plan for the TypeScript move `ts_move.plan`

This plan implements the spec `docs/specs/ts-move.md`. Each unit is one branch and one PR. Each unit has a check that must fail on purpose. The process rules are in `fork_trim.plan.process` in `docs/plans/fork-trim.md`.

The architect writes the task file of a unit from `origin/main` after the unit before it merges. The task file is `docs/tasks/<unit with . replaced by ->.md`.

## Units `ts_move.plan.units`

| Unit | Task file | Change | Check | Needs |
|---|---|---|---|---|
| `ts.probe` | `docs/tasks/ts-probe.md` | Add the glob `deepwidgets/*/tsdown.config.ts` to the root `tsdown.config.ts`. Add the probe references to `tsconfig.host.json` and `tsconfig.client.json`. Move the probe to the layout of `ts_move.layout`. Update `pnpm-lock.yaml`, the comment line in `pnpm-workspace.yaml`, and the rows of `CLAUDE.md` in `ts_move.stale_text`. | `build:artifacts` gives `run-gates: 8 passed, 0 failed`, and the probe `lib/` files exist. The probe test, the rows check, and the trace test pass. `typecheck` gives `run-gates: 5 passed, 0 failed`. A type error in `deepwidgets/probe/src/index.ts` must make `build:artifacts` and `typecheck` exit 1. With `deepwidgets/probe/lib/index.js` moved away, the probe test must fail. | `trim.profile` |
| `ts.trace` | `docs/tasks/ts-trace.md` | Add the trace references to the two aggregate tsconfig files. Move the trace to the layout of `ts_move.layout`. Read `../page.html`. Change the three import paths of `ts_move.tools`. Update `pnpm-lock.yaml` and the rows of `CLAUDE.md`. | The trace test passes, and its off run must fail. The two trace tools pass on the built files. The probe test and the rows check pass. A type error in `deepwidgets/trace/src/index.ts` must make `build:artifacts` exit 1. With `page.html` moved away, an import of `deepwidgets/trace/lib/index.js` must fail. | `ts.probe` |
| `ts.lint` | `docs/tasks/ts-lint.md` | Add `deepwidgets/*/src/**/*.{ts,tsx}` to the two source override blocks of `.oxlintrc.json` (`ts_move.lint`). Fix each lint error in the probe and trace source, with no change to behavior. | `corepack pnpm exec tsx scripts/run-oxlint.ts deepwidgets/probe/src deepwidgets/trace/src` exits 0. A `var` line added to a source file must make it exit 1 with `no-var`. Each check of `ts.trace` passes again. | `ts.trace` |

The order follows `decisions.ts_order`: the probe first, then the trace. `trim.profile` merged in PR #31 (merge commit `7353cbcd`). Thus `decisions.order` allows the start.

The operator decides whether `ts.lint` runs (`ts_move.lint`). If the operator says no, drop the row. The other units do not change.

## Checks of each unit `ts_move.plan.checks`

Each task file gives each check as one command, with its expected result line and its exit code. Each unit also runs these checks:

| Check | Expected result |
|---|---|
| `corepack pnpm --version` | `11.28.5`, exit 0 |
| `corepack pnpm install --frozen-lockfile` | exit 0 |
| `corepack pnpm run build:artifacts` | `run-gates: 8 passed, 0 failed`, exit 0 |
| `corepack pnpm --filter @deepseek-ai/dsh-desktop run build` | exit 0 |
| `node tools/smoke-desktop.mjs` | `smoke-desktop: pass`, exit 0 |
| `DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs` | `smoke-desktop: pass`, exit 0 |
| `DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs` | `smoke-desktop: pass`, exit 0 |
| `DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs` | `smoke-desktop: pass`, exit 0 |
| `DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs` | `smoke-desktop: pass`, exit 0 |
| `node tools/trace-late-row.mjs` | `trace-late-row: pass`, exit 0 |
| `node tools/trace-client-rows.mjs` | `trace-client-rows: pass`, exit 0 |
| `DSH_SMOKE_PROBE=1 DEEPWIDGETS_PROBE=off node tools/smoke-desktop.mjs` | must fail: `smoke-desktop: fail: probe text: missing`, exit 1 |
| `DSH_SMOKE_TRACE=1 DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs` | must fail: `smoke-desktop: fail: trace: status 404`, exit 1 |
| `corepack pnpm run typecheck` | `run-gates: 5 passed, 0 failed`, exit 0 |
| `corepack pnpm run constraints` | exit 0 |
| `corepack pnpm run verify-tsconfig-paths` | exit 0 |
| `git diff --exit-code origin/main -- deepwidgets/probe/cordis.patch.yml deepwidgets/trace/cordis.patch.yml deepwidgets/trace/page.html deepwidgets/trim` | no output, exit 0 |

The first eleven rows are the commands of `head.commands` in `CLAUDE.md`. The line `corepack pnpm run start:desktop` is not a check, because it runs the app until you quit it. The two off-run lines come from `docs/tasks/trim-profile.md` lines 331 and 333.

The checks also include each test file that imports a file that the unit changes. At the base, no test file names `deepwidgets/` or `@deepwidgets`. Verified (ran `git grep` on the test paths). The task file runs this search again on its own base.

## Evidence for the task files `ts_move.plan.evidence`

| Unit | Evidence that exists | Evidence that the task file still needs |
|---|---|---|
| `ts.probe` | `spike.build_path` on `7353cbcd`, reviewed. The literal probe files are in the spike patch (sha256 `a4e1ca75a6db1f5217dd73abc0478e4266dcf8596305c8fecba3e1b9d5c0873e`). | Each shell exit code, captured by the worker. The spike did not save some of them (`review.prep.ts.exit_records`). |
| `ts.trace` | `spike.page.rerun` (page path), reviewed. Type sources, read. | A spike on `origin/main` after `ts.probe` merges. It builds the literal trace files and runs the trace test and the two tools. The architect writes it during `loop.task`, and the worker runs it. The reviewed spikes do not prove the trace move. |
| `ts.lint` | `spike.build_path.lint`, reviewed. It tested only the first source override block. | A spike with the glob in both blocks, on the converted code. It records each rule that fails. |

No spike tests HMR. The trim turns off the rows `hmr` and `client-hmr`. Thus no unit has a check for reload.

The fresh spike worktree had no Electron binary. The runner used `node apps/desktop/node_modules/electron/install.js` once (spike report, reported by the runner). Each task file for a fresh worktree gives this fallback with its stop condition.
