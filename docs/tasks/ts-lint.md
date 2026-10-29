# Task `ts.lint`

Read `docs/tasks/README.md` first. It holds the rules for every task. Follow `flow.lean` in `~/.buzz/PLANS/DEEPWIDGETS_FLOW_LEAN.md`. Spike evidence and the executable command file: `~/.buzz/RESEARCH/DEEPWIDGETS_TS_LINT_SPIKE_20261028/` (`COMMANDS.md`, `DIFF.patch`, `emit.expected.diff`, `emit_diff.sh`, `COMPONENT.mjs`).

## Goal `ts.lint.goal`

Add the deepWidgets source glob to both source override blocks of `.oxlintrc.json`. Fix each oxlint error in `deepwidgets/probe/src` and `deepwidgets/trace/src` under `brief.ts_lint.change.erased`. Prove the lint gate, the golden `emit_diff`, and the `ts_move.plan.checks` still hold.

## Setup `ts.lint.setup`

| Item | Value |
|---|---|
| Base | `origin/main`. It must contain `96c770678abd0072b1fe147440a6fd9f6a8961e4`. After that commit, only files under `docs/` can change. |
| Branch | `rohan/ts-lint` (new) |
| Worktree | `~/deepWidgets/.worktrees/rohan-ts-lint` |
| Temporary files | `$TMPDIR/deepwidgets-ts-lint/`, logs in `logs/` |
| Machine | this Mac, with a display (smoke parts) |

At the start of the first part, write `env.sh` with the same `rec` helper as `ts.trace.setup` (see `COMMANDS.md`). Start each shell with `. "$TMPDIR/deepwidgets-ts-lint/env.sh"`.

```bash
mkdir -p "$TMPDIR/deepwidgets-ts-lint/logs" && cat > "$TMPDIR/deepwidgets-ts-lint/env.sh" <<'EOF'
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 BASE=96c770678abd0072b1fe147440a6fd9f6a8961e4 R="$HOME/deepWidgets"
export W="$R/.worktrees/rohan-ts-lint" T="$TMPDIR/deepwidgets-ts-lint" L="$TMPDIR/deepwidgets-ts-lint/logs"
export S="$HOME/.buzz/RESEARCH/DEEPWIDGETS_TS_LINT_SPIKE_20261028"
rec() { n=$1; shift; printf '%s: %s\n' "$n" "$*" >> "$L/commands.txt"; "$@" > "$L/$n.log" 2>&1; c=$?; echo "$n exit=$c $(tail -n 1 "$L/$n.log")" | tee -a "$L/exits.txt"; }
if [ -d "$W" ]; then cd "$W"; fi
EOF
```

## Read first `ts.lint.read`

Read `ts_move.lint`, `brief.ts_lint.change` (including `.erased`), and `COMMANDS.md` in the spike folder. Read `.oxlintrc.json` lines 37 and 154 (the two blocks that name `packages/*/*/src/**/*.{ts,tsx}`).

## Change `ts.lint.steps.change`

1. Create the worktree at `$BASE`. Run `corepack pnpm --version`, then `corepack pnpm install --frozen-lockfile`, then the Electron fallback of `ts.trace.steps.base` (`electron` / `electron_install` / `electron_again`). Exact `rec` lines are in `COMMANDS.md` under `ts.lint.steps.base`.

2. Apply `$S/DIFF.patch` with `git apply --check`, then `git apply`. Patch sha256: `7eba8271e81a0f8a8e088d9eed1989770a9f9b85a07eac782a1fae637e8980fa`.

3. The patch adds `"deepwidgets/*/src/**/*.{ts,tsx}"` after `"packages/*/*/src/**/*.{ts,tsx}"` in **both** source override blocks of `.oxlintrc.json`, and applies erased-type (or `void` / `Promise.resolve`) fixes in the four source files. Do not add a disable comment. Do not change other lines of `.oxlintrc.json`.

4. Hash the five files with `shasum -a 256 -c` against the table in `COMMANDS.md` / `CHANGED.sha256`. Expected last line: `deepwidgets/trace/src/client/index.ts: OK`. If a hash differs and the diff is not explained, stop and mention Codeine.

## Checks `ts.lint.check`

### Lint gate `ts.lint.check.lint`

```bash
rec lint corepack pnpm exec tsx scripts/run-oxlint.ts deepwidgets/probe/src deepwidgets/trace/src
# lint exit=0
```

### Must-fail `var` `ts.lint.check.var`

Save, append `var __spikeLintVar = 1`, lint (expect exit 1 and `no-var`), restore from the clean copy, confirm sha256. Full `rec` lines in `COMMANDS.md`.

### Emit golden diff `ts.lint.check.emit_diff`

Build base `$BASE` and the head. Compare only `*.js` under both packages' `lib/` folders. Exclude every `*.map`, `*.d.ts`, `*.d.ts.map`, and `tsconfig.*.tsbuildinfo` file. The named excluded list is in `COMMANDS.md`. First compare the `.js` name lists (missing folder or file -> exit 1). Run `diff` on each `.js` pair (`diff` exit 2 -> check exit 2). Write the normalized actual diff and `cmp` it to `$S/emit.expected.diff` (sha256 `3a1a333db8318d1ac2df89cc270aab2e8e519d4f785c2e29172656feb0ad655c`). The golden holds the `void` words, the two `Promise.resolve` lines, and the Probe assertion parentheses. Keep raw diffs in `$L`. Exact command: `rec emit_diff sh "$S/emit_diff.sh"`.

### Gates `ts.lint.check.gates`

```bash
rec artifacts corepack pnpm run build:artifacts
# artifacts exit=0 build: recorded 358 client artifact(s) with 3 public value(s)
rec typecheck corepack pnpm run typecheck
# typecheck exit=0 run-gates: 5 passed, 0 failed, 0 skipped in <time>.
rec constraints corepack pnpm run constraints
# constraints exit=0 $ tsx scripts/check-workspace-constraints.ts
rec tsconfig_paths corepack pnpm run verify-tsconfig-paths
# tsconfig_paths exit=0 gen-tsconfig-paths: tsconfig.base.json package aliases are current.
rec desktop corepack pnpm --filter @deepseek-ai/dsh-desktop run build
# desktop exit=0 ✓ built in <time>
rec keep git diff --exit-code "$BASE" -- deepwidgets/probe/cordis.patch.yml deepwidgets/trace/cordis.patch.yml deepwidgets/trace/page.html deepwidgets/trim pnpm-lock.yaml
# keep exit=0
```

### Component JSON `ts.lint.check.component`

```bash
rec component sh -c 'COMPONENT_OUT="$L/component.json" BASE="$BASE" node "$S/COMPONENT.mjs"'
# component exit=0 ]
rec component_match grep -c '"match": true' "$L/component.json"
# component_match exit=0 3
```

`$S/COMPONENT.mjs` sha256: `f2f21579a0acb6491e3af56179063eb49c85a1a2cc99899f689bdeca5bb87925`. Bodies `null`, `{}`, `{ "pid": 123 }` must match the base.

### Smoke and off `ts.lint.check.smoke`

Import `ts.trace.check.pass` and `ts.trace.check.off` from `docs/tasks/ts-trace.md` by name. Only one smoke on the machine at a time.

## Parts `ts.lint.parts`

| Part | Blocks | Spike / prior time |
|---|---|---|
| `ts.lint.part.change` | setup, install, patch, lint, var, emit_diff | ~4 min (+ build) |
| `ts.lint.part.gates` | artifacts, typecheck, constraints, paths, desktop, keep, component, component_match | ~3.5 min (+ smoke wait) |
| `ts.lint.part.smoke` | tools + five pass smokes | ~5-8 min |
| `ts.lint.part.off` | two off runs | ~8 min |
| `ts.lint.part.pr` | commit, push, PR | ~2 min |

Crusoe runs parts in sequence with no lead gate (`flow.lean`). After each part, post one line: part name, good-record count, log path. No full `exits.txt` paste. Mention Codeine only on a mismatch. Mention Otter only for a `task` blocker.

## Files you may change `ts.lint.files`

| File | Change |
|---|---|
| `.oxlintrc.json` | only the two glob lines |
| `deepwidgets/probe/src/index.ts`, `deepwidgets/probe/src/client/Probe.tsx` | lint fixes only |
| `deepwidgets/trace/src/index.ts`, `deepwidgets/trace/src/client/index.ts` | lint fixes only |

Do not change `page.html`, cordis patches, trim, lockfile, or `CLAUDE.md` unless a keep check forces a report.

## Done when `ts.lint.done`

Each record matches. Commit message `ts.lint: lint the deepWidgets TypeScript sources`. Open the PR against `main`. Put the command and exit logs by path in `Check`. Put each `handoff2.reviewer.failure_cases` item the change can cause in `Findings`.
