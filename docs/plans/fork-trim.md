# Plan for the fork and trim `fork_trim.plan`

This plan implements the spec `docs/specs/fork-trim.md`. Each unit is one branch and one merge. Each unit has a check that can fail.

## Units `fork_trim.plan.units`

| Unit | Change | Check | Needs |
|---|---|---|---|
| `fork.import` | One squashed commit of DSH at the pinned SHA. Add `UPSTREAM.md`. Remove `plugins/`, `registry.json`, and `src/`. | A script compares the tree with a clean upstream checkout. It exits 0 only when the sole differences are `UPSTREAM.md` and the removed files. | the spec |
| `fork.baseline` | Remove the lefthook `postinstall` entry and `lefthook.yml`. Replace the root `CLAUDE.md`. Move the Cordis skill. Install and build. | A boot smoke check exits 0. It sees the host `ready` message and the renderer load of `dsh-app://app`. | `fork.import` |
| `probe.round_trip` | Add the `probe` bundle and its test. | A Playwright `_electron` test reads the text `probe pid <n>`. A second run with the probe host row disabled must fail. | `fork.baseline` |
| `trim.profile` | Add the deepWidgets patch file. It disables every row that is not on the keep list. | The smoke check and the probe test pass. The loaded row ids of both Contexts equal a committed list. | `probe.round_trip` |
| `trim.packages` | Delete packages that no row loads, in batches. Start with packages that no other package imports. | After each batch, the install, the build, the smoke check, and the probe test pass. | `trim.profile` |
| `trim.tooling` | Delete the DSH tooling that the trimmed app does not use, such as `.github/`, `.gitlab-ci.yml`, `website/`, `python/`, and `benchmarks/`. | The install, the build, the smoke check, and the probe test pass. | `trim.packages` |

## Prior art for the checks `fork_trim.plan.prior_art`

Read these DSH files before you write a check. Use them when they fit.

- `apps/desktop/scripts/smoke-runtime.ts` starts the host with an empty home directory.

- `apps/desktop/scripts/smoke-prepared-runtime.ts`.

- `apps/cli/tests/desktop-host.e2e.ts`.

- `apps/desktop/scripts/dev.ts` is the `dev:desktop` entry.

## Process `fork_trim.plan.process`

- This repository has no Git remote. A unit is a local branch in `.worktrees/<branch>`. The branch merges into `main` with a merge commit.

- An Opus agent implements each unit. A fresh Opus agent reviews it. The reviewer is never the implementer.

- A unit merges only when its check passes and its review has no open finding.

- Each agent brief carries the base SHA, the branch, the files to read, the check, and a report word cap.
