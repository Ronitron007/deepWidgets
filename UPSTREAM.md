# Upstream `upstream`

This tree starts as a squashed copy of the DeepSeek Harness repository.

| Item | Value |
|---|---|
| Repository | https://github.com/deepseek-ai/deepseek-harness |
| Branch | `master` |
| Commit | `22ddee3792402c3e70ec5f86a63c3e3e895a2f60` |
| Commit date | 2026-10-23T19:48:59+08:00 |
| License | MIT, copyright 2026 DeepSeek. See `LICENSE`. |

The spec `docs/specs/fork-trim.md` tells how deepWidgets trims this copy.

To compare the import with the upstream commit, run `tools/verify-import.sh d15b5ec5`. The argument is the last commit of the import branch. Later commits change the tree, so `HEAD` does not match.

## Syncs `upstream.syncs`

Each sync merges a newer upstream commit into deepWidgets. The plan `docs/plans/upstream-sync.md` gives the method.

| Upstream commit | Merge date | PR | Vendor branch |
|---|---|---|---|
| `ce7073d51254c26cd63b22a60835b8f948deb447` | 2026-11-02 | [Ronitron007/deepWidgets#73](https://github.com/Ronitron007/deepWidgets/pull/73) | `rohan/dsh-upstream` at `721f22bb` |

When upstream has a new release, run `tools/dsh-upstream-check.sh` before the next sync. The script lists the upstream changes in the parts that deepWidgets uses, and the merge conflicts.
