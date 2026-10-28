# Blocker of `ts.lint` `blockers.ts_lint`

The unit `ts.lint` adds the glob `"deepwidgets/*/src/**/*.{ts,tsx}"` to the two source override blocks of `.oxlintrc.json`. Then it fixes each lint error in the probe and trace source, with no change to behavior. The plan row `ts.lint` in `docs/plans/ts-move.md` and the spec section `ts_move.lint` give the scope.

## State `blockers.ts_lint.state`

| Item | State |
|---|---|
| Run decision | Open. `ts_move.lint` gives it to the operator. |
| Spike | Done on `96c77067`. The lint found 19 errors in 7 rules. |
| Design round 1 | `json_behavior` fixed. The lead added the rule `brief.ts_lint.change.erased`. |
| Design round 2 | `emit_gate` fixed. `executable_task` narrowed to three records. |
| Build, smoke, PR | Not started. |

The spike worktree `.worktrees/rohan-spike-ts-lint` is at `96c77067`, with the patch applied and no commit. The dry-run worktree `.worktrees/rohan-ts-lint` is also at `96c77067`, with no commit. Source: the round 2 message of Crusoe and the review of Codeine.

## Lint errors of the spike `blockers.ts_lint.errors`

| Rule | Count |
|---|---|
| `typescript(no-unnecessary-condition)` | 6 |
| `typescript(no-unnecessary-boolean-literal-compare)` | 4 |
| `typescript(no-floating-promises)` | 3 |
| `typescript(require-await)` | 2 |
| `typescript(no-unsafe-enum-comparison)` | 2 |
| `typescript(use-unknown-in-catch-callback-variable)` | 1 |
| `typescript(no-unsafe-assignment)` | 1 |

Verified (counted `LINT_BEFORE.txt` of the spike).

## Rule for the fixes `blockers.ts_lint.erased`

A lint fix can change behavior when it removes a guard that the types call unnecessary. Thus the lead set the rule `brief.ts_lint.change.erased`:

- Each fix changes only types, or adds `void` before a call. Types are annotations, `as` assertions, and `: unknown`.

- The emitted JavaScript keeps each property read, operator, guard, and import of the base.

- Two `require-await` fixes are exceptions. Each `async () => X` becomes `() => Promise.resolve(X)`, one in each `index.ts`.

The check `emit_diff` proves the rule. It compares the `.js` files of the base build and the head build with a saved expected diff. Any other difference makes it fail.

## Open blocker `blockers.ts_lint.executable_task`

Codeine found this in `loop.design_verify` round 2. The task draft gives no correct expected last line for three records:

- `component`. The real last line is `]`. The draft shows `... "match": true ...`.

- `sums`. The draft gives no last line.

- `constraints`. The draft gives no last line.

A worker who compares each last line cannot finish these records. The fix is small, but the unit used its two design rounds. Thus `handoff2.stop` sends it to the operator.

## What must be solved `blockers.ts_lint.next`

1. The operator says if `ts.lint` runs. If no, drop the unit, and Otter writes `handoff2.report`.

2. If yes, the operator permits a third design round for the three lines.

3. Crusoe fixes the three expected last lines.

4. Codeine does `loop.design_verify` round 3.

5. Crusoe opens the docs PR of the task file and merges it with a merge commit.

6. Crusoe does `loop.build`. Only one smoke run can run on the machine at a time.

7. Codeine does `loop.review`, with the full desktop vitest suite on the base and then on the head.

8. Otter merges the code PR and writes `handoff2.report`.

## Evidence `blockers.ts_lint.evidence`

The file `ts-lint-evidence.md` holds copies of the spike files. These are the task draft, the command file, the patch, the expected diff, the diff script, and the component script.

| File | sha256 |
|---|---|
| `DIFF.patch` | `7eba8271e81a0f8a8e088d9eed1989770a9f9b85a07eac782a1fae637e8980fa` |
| `emit.expected.diff` | `3a1a333db8318d1ac2df89cc270aab2e8e519d4f785c2e29172656feb0ad655c` |
| `COMPONENT.mjs` | `f2f21579a0acb6491e3af56179063eb49c85a1a2cc99899f689bdeca5bb87925` |

The source folders are in the Buzz workspace:

- `RESEARCH/DEEPWIDGETS_TS_LINT_SPIKE_20261028/` (spike, draft, dry run)

- `RESEARCH/DEEPWIDGETS_TS_LINT_COMBINED_REVIEW_20261028/` (design review)

- `RESEARCH/DEEPWIDGETS_TS_LINT_DESIGN_VERIFY_R1_20261028/` (verify round 1)

- `RESEARCH/DEEPWIDGETS_TS_LINT_DESIGN_VERIFY_R2_20261028/` (verify round 2)
