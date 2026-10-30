# Plan for the fork and trim `fork_trim.plan`

This plan implements the spec `docs/specs/fork-trim.md`. Each unit is one branch and one PR. Each unit has a check that can fail. The task file for a unit is `docs/tasks/<unit>.md`.

## Units `fork_trim.plan.units`

| Unit | Change | Check | Needs |
|---|---|---|---|
| `fork.import` | One squashed commit of DSH at the pinned SHA. Add `UPSTREAM.md`. Remove `plugins/`, `registry.json`, and `src/`. | A script compares the tree with a clean upstream checkout. It exits 0 only when the sole differences are `UPSTREAM.md` and the removed files. | the spec |
| `fork.baseline` | Remove the lefthook `postinstall` entry and `lefthook.yml`. Replace the root `CLAUDE.md`. Install and build. | The boot smoke check `tools/smoke-desktop.mjs` exits 0. It sees a renderer page at `dsh-app://app/` and an HTTP answer from the host. A run with a short timeout must exit 1. | `fork.import` |
| `skill.cordis_move` | Add the Cordis skill at `.agents/skills/cordis/`. | The skill files equal local commit `4d34ec5`, except for one deleted line. | `fork.import` |
| `probe.round_trip` | Add the `probe` bundle and its test. The probe test is `DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs`. | The probe test reads the text `probe pid <n>`, and `<n>` must equal the host process id. A second run with the probe host row disabled must fail. | `fork.baseline` |
| `trim.startup` | Open the main window at once, with no welcome window and no RPC to `llm`. The main window shows only `hello` and the probe text. Comment out the old DSH lines with the marker. | The hello test `DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs` reads `hello` and finds no welcome window. It must fail before the `ui-layout` change. The probe test and the trace test pass. | `probe.round_trip` |
| `trim.profile` | Add the deepWidgets patch file. It disables every row that is not on the keep list. Each disabled row keeps a `# deepwidgets-trim: <reason>` comment. | The smoke check and the probe test pass. The loaded row ids of both Contexts equal a committed list. | `trim.startup` |
| `trim.packages` | Deferred until the operator asks for deletion. Delete packages that no row loads, in batches. Start with packages that no other package imports. | After each batch, the install, the build, the smoke check, and the probe test pass. | `trim.profile` |
| `trim.tooling` | Deferred until the operator asks for deletion. Delete the DSH tooling that the trimmed app does not use, such as `.gitlab-ci.yml`, `website/`, `python/`, and `benchmarks/`. The commit `ccd7e505` already removed `.github/`. | The install, the build, the smoke check, and the probe test pass. | `trim.packages` |

## Prior art for the checks `fork_trim.plan.prior_art`

Read these DSH files before you write a check. Use them when they fit.

- `apps/desktop/scripts/smoke-runtime.ts` starts the host with an empty home directory.

- `apps/desktop/scripts/smoke-prepared-runtime.ts`.

- `apps/cli/tests/desktop-host.e2e.ts`.

- `apps/desktop/scripts/dev.ts` is the `dev:desktop` entry.

## Process `fork_trim.plan.process`

- The remote is https://github.com/Ronitron007/deepWidgets. A unit is a branch in `.worktrees/<branch>` and a PR against `main`. The PR merges with a merge commit.

- A Sonnet agent implements each unit from its task file. The planning session reviews the PR. The reviewer is never the implementer.

- A unit merges only when its check passes and its review has no open finding.

- Each agent brief carries the base SHA, the branch, the files to read, the check, and a report word cap.
