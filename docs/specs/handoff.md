# Handoff protocol `handoff`

Status: proposed on 2026-10-31. This spec tells how a planning agent gives one unit of work to a coding agent on the cloud server. It replaces the handoff documents of the lead, architect, worker, and reviewer sessions.

## Goal `handoff.goal`

The protocol must make sure of these four results:

- The receiver gets all the knowledge of the unit from the repository at one commit.

- Before work starts, a script proves that each check of the unit gives the expected output and can fail.

- A reviewer that the sender does not control looks for missing facts, wrong assumptions, and scope mistakes.

- After the work, a script decides if the result passes. The report of the receiver does not decide it.

## Why `handoff.why`

`docs/specs/handoff-evidence.md` lists 28 past handoff failures. In 20 of them, the task of the sender was wrong. Only 3 came from a receiver that did not read the task. Thus the protocol checks the task of the sender first.

A restatement by the receiver finds only the smallest class. It does not find a wrong expected output or a weak check. Thus the protocol uses no prose restatement. The receiver gives only a mechanical acknowledgment, `handoff.gate.ack`.

No method can prove that a set of checks is the same as the intent of the sender. Research on intent formalization states this limit (Lahiri, FMCAD 2024). Thus the protocol proves what a script can prove. A reviewer looks for the rest.

## Terms `handoff.terms`

| Term | Meaning |
|---|---|
| sender | The planning agent that writes the design, the task file, and the manifest. |
| receiver | The coding agent on the cloud server, for example Claude Code or cursor-cli. |
| reviewer | A fresh agent on a model that is different from the model of the sender. It does not see the transcript of the sender. |
| checker | The script that runs `handoff.gate.lint`, `handoff.gate.base_run`, `handoff.gate.ack`, and `handoff.gate.done`. |
| unit | One plan unit. One unit gives one PR. |
| intent item | One design sentence that the unit must make true. It has a dotted id, for example `widget_rows.proof.install_applies`. |
| check | One command with an expected exit code and an expected last output line, at the base and at the head. |
| mutant | One command that changes the work tree so that its check must fail. |
| base | The full SHA of the commit on `main` that the receiver branches from. |
| go commit | The commit on `main` that holds the task file and the manifest that passed the gates. |
| record | One line `<id> exit=<code> <last output line>`. |

## Files `handoff.files`

| Path | Content | Writer |
|---|---|---|
| `docs/specs/<spec>.md` | The design. Each intent item has a dotted id. | sender |
| `docs/tasks/<unit>.md` | The task file. It holds the goal, the facts with evidence, the steps, and the allowed files. | sender |
| `docs/tasks/<unit>.checks.yml` | The manifest of `handoff.manifest`. | sender |
| `docs/evidence/<unit>/` | Copies of spike logs, review records, and other evidence that the task cites. | sender |
| `docs/handoff/lessons.md` | The lesson rules of `handoff.lessons`. Each rule names the findings that caused it. | sender |
| `.github/ISSUE_TEMPLATE/handoff.yml` | The issue form of `handoff.issue`. | the first plan unit |
| the checker script | The checker. Its design comes in the next deliverable. | the first plan unit |

Each path that a task file or a manifest cites must be in `git ls-files` at the go commit. A path in `$TMPDIR`, `~`, `/Users/`, `/private/`, or `~/.buzz` is not evidence.

## Manifest `handoff.manifest`

The manifest is the machine-readable part of the task. The checker reads only the manifest, the task file, and the design. This example shows the fields. Its record values and versions are not measured.

```yaml
unit: trim.widget_rows
design: docs/specs/widget-rows.md
intent: [widget_rows.proof.rows, widget_rows.proof.install_applies, widget_rows.proof.install_off_fails]
base: 8319ffe3e094d831c5ffaa37950feae806b82d4c
environment: {image: deepwidgets-cloud-1, node: "24.9", display: xvfb}
setup:
  - corepack pnpm install --frozen-lockfile
  - corepack pnpm run build:artifacts
allowed_files: [deepwidgets/trim/cordis.patch.yml, deepwidgets/trim/rows.host.txt, tools/smoke-desktop.mjs]
checks:
  - id: install
    covers: [widget_rows.proof.install_applies]
    run: DSH_SMOKE_INSTALL="$PWD/deepwidgets/trim/fixtures/widget-rows-install" node tools/smoke-desktop.mjs
    base: {exit: 1, last: "smoke-desktop: fail"}
    head: {exit: 0, last: "smoke-desktop: pass"}
    mutants:
      - id: hmr_off
        at: head
        run: git checkout "$BASE" -- deepwidgets/trim/cordis.patch.yml
```

These rules apply to each manifest:

- Each id in `intent` is an intent item in the design.

- Each intent item has at least one check that names it in `covers`.

- Each check has a `base` record and a `head` record.

- Each check has at least one mutant.

- When a check passes at the base, it has a mutant with `at: base`.

- When a check fails at the base, its `base` record gives the expected reason of the failure. A failure with another reason does not count.

A mutant is a command, not a patch. A command such as `git checkout "$BASE" -- <file>` works on a head that the sender has not seen.

## Gates `handoff.gates`

The gates run in this order. A gate starts only after the gate above it passed.

| Gate | Who runs it | Where | Passes when | Finds the classes |
|---|---|---|---|---|
| `handoff.gate.lint` | checker | sender machine and CI | each rule of `handoff.lint` passes | `unreachable_evidence`, a part of `non_discriminating`, `other` |
| `handoff.gate.base_run` | checker | cloud server, clean clone at the base | each check gives its `base` record, and each `at: base` mutant makes its check fail | `wrong_expected`, `stale_base`, environment, a part of `non_discriminating` |
| `handoff.gate.review` | reviewer | a fresh session | the review has no open blocker | `missing_fact`, `wrong_assumption`, `scope`, `non_discriminating` |
| `handoff.gate.go` | checker | GitHub | the three gates above passed on the same go commit | none, it is the gate |
| `handoff.gate.ack` | checker | GitHub | the first comment of the receiver passes `handoff.ack` | wrong version of the task |
| `handoff.gate.done` | checker | cloud server, clean clone at the PR head | each rule of `handoff.done` passes | `receiver_skipped`, a misreport, a gamed check |

After `handoff.gate.done`, the code review of the PR follows the current practice.

## Lint `handoff.lint`

The checker applies these rules to the task file, the manifest, and the design:

- Each field of `handoff.manifest` is present, and each rule of `handoff.manifest` passes.

- Each check id and each mutant id is unique in the manifest.

- Each cited path resolves in `git ls-files` at the candidate commit.

- The task file has no placeholder. Examples are `TODO`, `TBD`, and an angle-bracket word that the task does not define.

- The base is an ancestor of `origin/main`.

- Each rule in `docs/handoff/lessons.md` passes.

## Lessons `handoff.lessons`

A lesson rule is a lint rule that comes from a review finding. The first set comes from `docs/specs/handoff-evidence.md`:

| Rule | Text | Source findings |
|---|---|---|
| `lesson.exact_paths` | A check of changed files compares the exact path set, not a count. | `exact_paths` family, four units |
| `lesson.no_true_tail` | A check command does not end with `true` or `\|\| true`. | `ts.lint.emit_gate` |
| `lesson.tests_by_name` | A test check compares results by test name, not only totals. | `ts.probe.test_regression` |
| `lesson.full_suite` | A unit that changes shared code runs the full test suite at the base and at the head. | `trace_sources.startup_fetch_fixture`, `trace_sources.welcome_fetch_isolation` |
| `lesson.merge_base` | A diff check uses `git diff --merge-base`. | `trace_window.numstat_base` |
| `lesson.one_authority` | The issue and the comments of the sender hold no value that the manifest sets. | `trim.profile.settle_budget` |
| `lesson.repo_evidence` | Evidence paths are in the repository. | `unreachable_evidence` |

When a review finds a blocker, the sender adds a lesson rule. If no lint rule can find the blocker, the sender writes the reason in `docs/handoff/lessons.md`.

## Review `handoff.review`

The reviewer reads only the repository at the candidate commit and the issue. The reviewer writes one comment with these parts:

- Findings. Each finding has a name `<unit>.<name>`, a severity, the claim, and its evidence. The severities are `blocker`, `should-fix`, and `note`.

- Counterexamples. For each check that fails at the base, the reviewer gives one wrong change that passes all checks. If the reviewer finds none, the reviewer writes why.

- Scope. The reviewer states if the unit belongs to its design and its plan.

A plausible counterexample is a blocker. The sender adds a check or a mutant for it. After two review rounds with an open blocker, the sender stops and asks the operator.

## Authority `handoff.authority`

The task file and the manifest at the go commit are the only authority for the unit. The issue holds pointers, not values. A change to the task file or the manifest after go needs a new go commit. All gates then run again. When another text gives a value that is different from the manifest, the receiver stops and reports the conflict.

## Acknowledgment `handoff.ack`

The first comment of the receiver on the issue holds these lines:

```text
handoff.ack
task_blob: <git hash-object of the task file>
manifest_blob: <git hash-object of the manifest>
checks: <check ids, in manifest order>
questions: none
```

The checker compares each line with the go commit. When the receiver has questions, it writes them after `questions:` and stops. The sender answers with a change to the task file, and a new go follows. The receiver makes no branch before the checker accepts the acknowledgment.

## Done `handoff.done`

The receiver opens the PR and posts a run report as a JSON block in one PR comment. The run report gives the base, the head, and a record for each check and each mutant. The checker then does these steps in a clean clone at the PR head:

1. Run each check. Compare the result with its `head` record.

2. Run each mutant on a fresh copy. Make sure that its check fails.

3. Compare the changed files with `allowed_files`.

4. Compare its own records with the run report. A difference is a finding.

The checker posts its records as one PR comment. The gate passes when each step passes.

## Issue form `handoff.issue`

The file `.github/ISSUE_TEMPLATE/handoff.yml` holds this form. The repository is public, so GitHub enforces `required`.

```yaml
name: Handoff
description: Give one unit to a coding agent on the cloud server.
title: "handoff: "
labels: [handoff]
body:
  - type: markdown
    attributes:
      value: Read docs/specs/handoff.md first. Do not start work before the label handoff:go.
  - type: input
    id: unit
    attributes: {label: Unit, description: "The dotted unit name, for example trim.widget_rows."}
    validations: {required: true}
  - type: input
    id: task
    attributes: {label: Task file, description: "The path of the task file."}
    validations: {required: true}
  - type: input
    id: manifest
    attributes: {label: Manifest, description: "The path of the manifest."}
    validations: {required: true}
  - type: input
    id: go_commit
    attributes: {label: Go commit, description: "The full SHA of the commit on main that holds the task file and the manifest."}
    validations: {required: true}
  - type: dropdown
    id: receiver
    attributes: {label: Receiver, options: [claude-code, cursor-cli, other]}
    validations: {required: true}
```

The form has no free-text field, because free text can hold a second value for the task (`lesson.one_authority`). The checker reads the form fields as JSON with a form parser, for example `stefanbuck/github-issue-parser`. The labels are `handoff`, `handoff:go`, `handoff:blocked`, and `handoff:done`.

## Open points `handoff.open`

- `handoff.open.display`: The smoke checks open Electron windows. The cloud server needs a display server, for example Xvfb. Nobody has run the smoke checks on Linux with Xvfb.

- `handoff.open.runner`: A self-hosted GitHub runner on a public repository can run code from fork PRs. The checker design decides how the cloud server starts the checker.

- `handoff.open.trace`: OpenFastTrace can check the coverage of intent items by checks. It needs Java 17. The checker design decides between OpenFastTrace and a small own step.

- `handoff.open.reviewer_model`: The experiment decides the reviewer model and its cost.

## Proof `handoff.proof`

The experiment plan gives the proof. It replays sender defects from `docs/specs/handoff-evidence.md` in task files. Then it records which gate finds each defect.
