# Open blockers and problems `blockers`

This folder records the state of the fork at `origin/main` `96c77067` on 2026-10-28. It lists the merged PRs, the open blockers, and the open problems.

## State `blockers.state`

- The repository has 37 PRs. The state of all 37 PRs is `MERGED`. No PR is open, and no PR has the state `CLOSED`. Verified (ran `gh pr list --state all`).

- The unit `ts.lint` has no PR. Its spike and its task draft exist only outside the repository. The file `ts-lint.md` in this folder gives the details.

## Merged PRs by unit `blockers.prs`

| Unit | PRs | What the PRs contain | Status |
|---|---|---|---|
| Setup and rules | [Ronitron007/deepWidgets#1](https://github.com/Ronitron007/deepWidgets/pull/1), [Ronitron007/deepWidgets#4](https://github.com/Ronitron007/deepWidgets/pull/4), [Ronitron007/deepWidgets#5](https://github.com/Ronitron007/deepWidgets/pull/5), [Ronitron007/deepWidgets#11](https://github.com/Ronitron007/deepWidgets/pull/11) | The task protocol and the first two task files. The rule to trim by comment, not by delete. The denial of the lefthook build script. The head node for agents and a commit reminder hook. | merged |
| `skill.cordis_move` | [Ronitron007/deepWidgets#2](https://github.com/Ronitron007/deepWidgets/pull/2) | The Cordis skill under `.agents/skills` (17 files). | merged |
| `fork.baseline` | [Ronitron007/deepWidgets#3](https://github.com/Ronitron007/deepWidgets/pull/3) | The install, the build, and the boot of the DSH copy. | merged |
| `probe.round_trip` | [Ronitron007/deepWidgets#6](https://github.com/Ronitron007/deepWidgets/pull/6), [Ronitron007/deepWidgets#7](https://github.com/Ronitron007/deepWidgets/pull/7) | The task file. The probe bundle and the probe test. | merged |
| `floating_widget` spec and boards | [Ronitron007/deepWidgets#10](https://github.com/Ronitron007/deepWidgets/pull/10), [Ronitron007/deepWidgets#12](https://github.com/Ronitron007/deepWidgets/pull/12), [Ronitron007/deepWidgets#24](https://github.com/Ronitron007/deepWidgets/pull/24), [Ronitron007/deepWidgets#25](https://github.com/Ronitron007/deepWidgets/pull/25), [Ronitron007/deepWidgets#26](https://github.com/Ronitron007/deepWidgets/pull/26), [Ronitron007/deepWidgets#27](https://github.com/Ronitron007/deepWidgets/pull/27) | The spec and the plan, the spec fixups, the Float decision and the obstacles board, and three boards: widget anatomy, Cordis runtime, and webServer connection. | merged |
| `trace.host` | [Ronitron007/deepWidgets#13](https://github.com/Ronitron007/deepWidgets/pull/13), [Ronitron007/deepWidgets#14](https://github.com/Ronitron007/deepWidgets/pull/14), [Ronitron007/deepWidgets#16](https://github.com/Ronitron007/deepWidgets/pull/16), [Ronitron007/deepWidgets#15](https://github.com/Ronitron007/deepWidgets/pull/15) | The task file, two design-fix PRs, and the host half of the trace with the trace test. | merged |
| `trace.sources` | [Ronitron007/deepWidgets#17](https://github.com/Ronitron007/deepWidgets/pull/17), [Ronitron007/deepWidgets#19](https://github.com/Ronitron007/deepWidgets/pull/19), [Ronitron007/deepWidgets#20](https://github.com/Ronitron007/deepWidgets/pull/20), [Ronitron007/deepWidgets#18](https://github.com/Ronitron007/deepWidgets/pull/18) | The task file, two design-fix PRs, and the client half of the trace with the start-up steps. | merged |
| `trace.window` | [Ronitron007/deepWidgets#21](https://github.com/Ronitron007/deepWidgets/pull/21), [Ronitron007/deepWidgets#22](https://github.com/Ronitron007/deepWidgets/pull/22), [Ronitron007/deepWidgets#23](https://github.com/Ronitron007/deepWidgets/pull/23) | The task file, one design-fix PR, and the trace window that shows the trace rows. | merged |
| `trim.profile` | [Ronitron007/deepWidgets#8](https://github.com/Ronitron007/deepWidgets/pull/8), [Ronitron007/deepWidgets#9](https://github.com/Ronitron007/deepWidgets/pull/9), [Ronitron007/deepWidgets#28](https://github.com/Ronitron007/deepWidgets/pull/28), [Ronitron007/deepWidgets#29](https://github.com/Ronitron007/deepWidgets/pull/29), [Ronitron007/deepWidgets#31](https://github.com/Ronitron007/deepWidgets/pull/31) | The first task file and the host state check, two task refreshes, and the code that turns off the rows that the probe does not need. | merged |
| `trim.startup` | [Ronitron007/deepWidgets#29](https://github.com/Ronitron007/deepWidgets/pull/29), [Ronitron007/deepWidgets#30](https://github.com/Ronitron007/deepWidgets/pull/30) | The task file. The main window opens at once and shows hello. | merged |
| `ts_move` spec | [Ronitron007/deepWidgets#32](https://github.com/Ronitron007/deepWidgets/pull/32) | The spec and the plan of the TypeScript move. | merged |
| `ts.probe` | [Ronitron007/deepWidgets#33](https://github.com/Ronitron007/deepWidgets/pull/33), [Ronitron007/deepWidgets#34](https://github.com/Ronitron007/deepWidgets/pull/34), [Ronitron007/deepWidgets#35](https://github.com/Ronitron007/deepWidgets/pull/35) | The task file, one design-fix PR, and the probe in TypeScript. | merged |
| `ts.trace` | [Ronitron007/deepWidgets#36](https://github.com/Ronitron007/deepWidgets/pull/36), [Ronitron007/deepWidgets#37](https://github.com/Ronitron007/deepWidgets/pull/37) | The task file and the trace in TypeScript. | merged |
| `ts.lint` | none | The spike and the task draft only. | blocked |

The PR [Ronitron007/deepWidgets#29](https://github.com/Ronitron007/deepWidgets/pull/29) is in two rows, because it holds the task files of `trim.startup` and `trim.profile`.

## Open blockers `blockers.open`

| Blocker | Unit | What blocks | What must be solved | Who |
|---|---|---|---|---|
| `design.ts.lint.executable_task` | `ts.lint` | The task draft gives no correct expected last line for three records. The unit used its two design rounds (`handoff2.stop`). | The operator allowed a third design round on 2026-10-29. Crusoe fixes the three lines. Codeine verifies them. | Crusoe and Codeine |
| `handoff2.report` | `handoff2` | The final report waits for the end or the drop of `ts.lint`. | Otter writes the report. | Otter |

## Open problems that do not block `blockers.problems`

The file `problems.md` lists each open problem and the work that solves it. The file `records.md` holds the full follow-up lists of both handoffs, word for word.

These lists come from the follow-up files. Nobody checked each item again against `96c77067`.
