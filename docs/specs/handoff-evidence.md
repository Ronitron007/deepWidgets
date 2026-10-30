# Handoff failures `handoff_evidence`

This file lists the handoff failures that the spec `handoff` uses as evidence. A research pass on 2026-10-30 read the PR comments and the records in `docs/blockers/`. It found 28 failures in PRs 3 to 46. Each row gives one failure, its class, the step that found it, and the source.

## Classes `handoff_evidence.classes`

| Class | Meaning | Count |
|---|---|---|
| `non_discriminating` | A check passes for a wrong change. | 6 failures, 9 times |
| `missing_fact` | The task did not give a fact that the work needs. | 6 |
| `wrong_assumption` | The task or the reviewer stated a false fact. | 5, of which 2 came from the reviewer |
| `wrong_expected` | The task gave an expected output that the base does not give. | 3 |
| `stale_base` | The task measured an output at an old base. | 1 |
| `receiver_skipped` | The receiver did not do a step that the task tells. | 3 |
| `scope` | The task put the work in the wrong spec or unit. | 1 |
| `other` | Environment, a shared worktree, or two sources of authority. | 3 |
| `unreachable_evidence` | The task cites a file that the receiver cannot read. | latent, no round cost found |

The row `ts.lint.executable_task` has two classes. Without `unreachable_evidence`, the class counts add up to 28. Of these 28, 20 are in the content of the sender. These are the classes `non_discriminating`, `missing_fact`, `wrong_expected`, `stale_base`, `scope`, and the 3 sender rows of `wrong_assumption`. Only 3 failures came from a receiver that did not read the task.

## Rows `handoff_evidence.rows`

| Failure | Class | Found by | Source |
|---|---|---|---|
| `fork_baseline` hook check misses the lefthook build script, and `find` exits 0 | `missing_fact` | code review | [Ronitron007/deepWidgets#3](https://github.com/Ronitron007/deepWidgets/pull/3) |
| `trim.profile.host_rows` calls each state that is not active "inactive" | `non_discriminating` | design review | [Ronitron007/deepWidgets#8](https://github.com/Ronitron007/deepWidgets/pull/8) |
| `trace_host.late_pending` assumes that the Loader fires one event for each row | `wrong_assumption` | design review spike, on two PRs | [Ronitron007/deepWidgets#13](https://github.com/Ronitron007/deepWidgets/pull/13) |
| `trace_host.post_check` passes when the receiver drops valid messages | `non_discriminating` | design review | [Ronitron007/deepWidgets#13](https://github.com/Ronitron007/deepWidgets/pull/13) |
| `trace_host.live_events_unchecked` passes with a mutated listener | `non_discriminating` | code review mutation | [Ronitron007/deepWidgets#15](https://github.com/Ronitron007/deepWidgets/pull/15) |
| `trace_sources.startup_fetch_fixture` breaks the fetch stub of a start-up test | `missing_fact` | code review full test run | [Ronitron007/deepWidgets#18](https://github.com/Ronitron007/deepWidgets/pull/18) |
| `trace_sources.welcome_fetch_isolation` breaks a sibling test | `missing_fact` | design verify | [Ronitron007/deepWidgets#20](https://github.com/Ronitron007/deepWidgets/pull/20) |
| `trace_sources.main_window_step_smoke` false blocker from two runs in one worktree | `other` | lead log check | [Ronitron007/deepWidgets#18](https://github.com/Ronitron007/deepWidgets/pull/18) |
| `trace_window.numstat_base` measured at a base before the task file | `stale_base` | design review | [Ronitron007/deepWidgets#22](https://github.com/Ronitron007/deepWidgets/pull/22) |
| `trim.profile.test_totals` reviewer predicted wrong totals | `wrong_assumption` | measured run | [Ronitron007/deepWidgets#29](https://github.com/Ronitron007/deepWidgets/pull/29) |
| `trim.startup` stops on a failed runtime download with no fallback | `other` | reviewer stop rule | [Ronitron007/deepWidgets#30](https://github.com/Ronitron007/deepWidgets/pull/30) |
| `trim.profile.run_report` receiver did not post the run report | `receiver_skipped` | code review | [Ronitron007/deepWidgets#31](https://github.com/Ronitron007/deepWidgets/pull/31) |
| `trim.profile.settle_budget` a lead brief changed a value of the task | `other` | code review | [Ronitron007/deepWidgets#31](https://github.com/Ronitron007/deepWidgets/pull/31) |
| `trim.profile.report_counts` task count 196, actual 197 | `wrong_expected` | code review | [Ronitron007/deepWidgets#31](https://github.com/Ronitron007/deepWidgets/pull/31) |
| `trim.profile.test_coverage` test command omits two spec files | `missing_fact` | design review | [Ronitron007/deepWidgets#28](https://github.com/Ronitron007/deepWidgets/pull/28) |
| `ts.probe.test_regression` compares only totals | `non_discriminating` | design review | [Ronitron007/deepWidgets#33](https://github.com/Ronitron007/deepWidgets/pull/33) |
| `ts.probe.pr_evidence` PR body omits the sections `Base` and full commands | `receiver_skipped` | code review | [Ronitron007/deepWidgets#35](https://github.com/Ronitron007/deepWidgets/pull/35) |
| `exact_paths` family: a path count, not the exact path set, on four units | `non_discriminating` | reviews | [Ronitron007/deepWidgets#33](https://github.com/Ronitron007/deepWidgets/pull/33), [Ronitron007/deepWidgets#36](https://github.com/Ronitron007/deepWidgets/pull/36), [Ronitron007/deepWidgets#44](https://github.com/Ronitron007/deepWidgets/pull/44) |
| `ts.lint.json_behavior` the sender spike patch changed JSON null behavior | `wrong_assumption` | design review | `docs/blockers/ts-lint.md` |
| `ts.lint.executable_task` placeholders, then wrong expected last lines | `missing_fact`, then `wrong_expected` | design verify, three rounds | `docs/blockers/ts-lint.md` |
| `ts.lint.emit_gate` a command ends with `true` and always exits 0 | `non_discriminating` | design verify | `docs/blockers/ts-lint.md` |
| `ts.lint.artifact_count` the count changes with a dirty tree | `wrong_expected` | code review | [Ronitron007/deepWidgets#42](https://github.com/Ronitron007/deepWidgets/pull/42) |
| `ts.lint.self_wake_evidence` binary strings taken as proof of runtime behavior | `wrong_assumption` | design review | `docs/blockers/problems.md` |
| `trim.creation_gap` the check of `trim.profile` did not encode the intent "keep what widget creation needs" | `missing_fact` | a separate session, days later | `docs/tasks/trim-profile.md` |
| `trim.widget_rows.must_fail` the worker set a flag so that the off run passed | `receiver_skipped` | run review | [Ronitron007/deepWidgets#44](https://github.com/Ronitron007/deepWidgets/pull/44) |
| `trim.widget_rows` placement in `fork_trim`, not in the widget spec | `scope` | operator | [Ronitron007/deepWidgets#45](https://github.com/Ronitron007/deepWidgets/pull/45) |
| PR 3 reviewer false observation | `wrong_assumption` | the reviewer | [Ronitron007/deepWidgets#3](https://github.com/Ronitron007/deepWidgets/pull/3) |
| Evidence paths in `$TMPDIR` and `~/.buzz/RESEARCH` in 13 task files | `unreachable_evidence` | `grep` | `docs/tasks/` |
