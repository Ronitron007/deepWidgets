# Open problems `blockers.problems`

These problems do not block a unit. Each row gives the problem and the work that solves it. The source is the follow-up list of each handoff (`records.md`), unless the row names a different source. Nobody checked each item again against `96c77067`.

## Problems outside the units `blockers.problems.pre_existing`

| Name | Problem | What must be solved |
|---|---|---|
| `env.node_engines` | The local Node is 22.23.0. The field `engines` asks for 24.9.0 or later. The build works on 22.23.0, and pnpm gives only a warning. | The operator decides if a Node 24.9 install is permitted. |
| `dev.restore_dialog` | The macOS crash-history restore dialog stops the Harness Dev app before it is ready. A smoke kill causes the dialog again. Each worktree bundle needs `defaults write ... ApplePersistenceIgnoreState -bool YES` as a workaround. | Add the launcher argument `-ApplePersistenceIgnoreState YES` to the desktop develop script, in a unit of its own. |
| `test.desktop_publish_workflow` | The full desktop vitest suite fails at the base and at the head, because `.github/workflows/desktop-publish.yml` does not exist in the fork. | Decide to add the workflow file or to turn off the test in the fork. |
| `test.login_shell_abort_timing` | The abort test in `apps/desktop/tests/login-shell-environment.spec.ts:179` fails when the login shell is slow, for example under machine load. | Give the test a longer wait, or run the suite under less load. |
| `lint.coverage_gap` | Lint applies no rule to `deepwidgets/` or `tools/*.mjs`. The unit `ts.lint` covers only `deepwidgets/*/src`. | Finish `ts.lint`. Then decide about `tools/*.mjs`. |
| `build.packaged_deepwidgets` | The packaged desktop build does not include the `@deepwidgets/*` packages. The step `prepare:packages` most likely stops with an error. An investigator inferred this from the code. Nobody ran a packaging build. | If the fork must ship a packaged app, write a unit for packaging. Source: `RESEARCH/DEEPWIDGETS_PREEXISTING_LINT_PACKAGED_20261028.md` in the Buzz workspace. |
| `smoke.temp_dirs` | Each smoke run leaves its temp folder. The folders used about 318 MB on 2026-10-25. Source: the lead ledger of `handoff`. | Remove the temp folder at the end of each smoke run. |
| `design.ts.lint.self_wake_evidence` | Nobody knows if a Crusoe message that mentions Crusoe starts a new Crusoe turn. The spike read strings in a binary file, and that does not prove the runtime behavior. The lean flow needs this, because Crusoe goes from one build part to the next with no lead message. | Test it once with a real message. |

## Fixes for task files and PR text `blockers.problems.should_fix`

These items change no product behavior. A task author or a reviewer can fix them in a later unit.

| Name | Unit | What must be solved |
|---|---|---|
| `design.ts.trace.exact_paths` | `ts.trace` | The staged-path checks count lines with `wc -l`. Compare exact names and status with `--no-renames`, and include the lockfile and `CLAUDE.md`. |
| `review.ts_trace.staged_count` | `ts.trace` spike | The spike check `fail.staged` counts a git rename once. Use `--no-renames`. |
| `design.ts.probe.exit_records` | `ts.probe` | Several checks of `docs/tasks/ts-probe.md` keep no exit record. Give each check a record. |
| `review.prep.ts.exit_records` | `prep.ts` | The spike report infers some exits from the end of a log. Record each exit. |
| `review.ts.probe.pr_evidence` (nit) | `ts.probe` | The PR body has no Base section, and Check gives no full commands. Follow `docs/tasks/README.md`. |
| `design.trim.profile.test_coverage` | `trim.profile` | The test command omits two spec files under `scripts/`. Add them. |
| `review.trim.profile.report_counts` | `trim.profile` | The PR body says 9 pending rows and a count of 196. The snapshot has 8 pending rows, and the task says 197. |
| `review.trim.profile.settle_budget` | `trim.profile` | The ablation used a smoke timeout of 240000 ms, not 120000 ms. The lead accepted it. Write the real budget into the task. |
| `review.trim_startup.appframe_description` (nit) | `trim.startup` | The layout module description still names `AppFrame`. |

## Ideas `blockers.problems.ideas`

These ideas are not problems. They are possible later work. `records.md` gives one sentence for each idea.

- `idea.trace_refresh_pending` and `idea.profile_migration` (`trim.profile`).

- `idea.trace_host.findings_counts` (`trace.host`).

- `idea.trace_sources.client_name_detail` and `idea.trace_sources.cancel_dispatched_post` (`trace.sources`).

- `idea.trace_window.dock_reopen`, `idea.trace_window.window_props_check`, `idea.trace_window.show_window_field`, `idea.trace_window.dsh_orb_prior_art`, and `idea.trace_window.head_status_date` (`trace.window`).

The reviewers rejected many other candidates. `records.md` lists them. They need no work.
