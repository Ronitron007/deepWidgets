# Evidence of `ts.lint` `blockers.ts_lint_evidence`

This file holds copies of the spike files of `ts.lint`, word for word. The source is `RESEARCH/DEEPWIDGETS_TS_LINT_SPIKE_20261028/` in the Buzz workspace. These files are a draft. The design gate did not accept them.

## `ts-lint.md`

sha256 `416d5a7605d10d7627c489de9c0fe7de2b59559979b85842b528f3e45aeb3472`

`````markdown
---
title: "Task draft ts.lint (not in repo)"
tags: [deepwidgets, ts-lint, draft]
status: draft
created: 2026-10-28
---

# Task `ts.lint` (draft)

Read `docs/tasks/README.md` first. Follow `flow.lean` in `~/.buzz/PLANS/DEEPWIDGETS_FLOW_LEAN.md`. Spike evidence and the executable command file: `~/.buzz/RESEARCH/DEEPWIDGETS_TS_LINT_SPIKE_20261028/` (`COMMANDS.md`, `DIFF.patch`, `emit.expected.diff`, `emit_diff.sh`, `COMPONENT.mjs`).

## Goal `ts.lint.goal`

Add the deepWidgets source glob to both source override blocks of `.oxlintrc.json`. Fix each oxlint error in `deepwidgets/probe/src` and `deepwidgets/trace/src` under `brief.ts_lint.change.erased`. Prove the lint gate, the golden `emit_diff`, and the `ts_move.plan.checks` still hold.

## Setup `ts.lint.setup`

| Item | Value |
|---|---|
| Base | `origin/main` at `96c770678abd0072b1fe147440a6fd9f6a8961e4` |
| Branch | `rohan/ts-lint` (new) |
| Worktree | `~/deepWidgets/.worktrees/rohan-ts-lint` |
| Temporary files | `$TMPDIR/deepwidgets-ts-lint/`, logs in `logs/` |
| Machine | this Mac, with a display (smoke parts) |

At the start of the first part, write `env.sh` with the same `rec` helper as `ts.trace.setup` (see `COMMANDS.md`). Start each shell with `. "$TMPDIR/deepwidgets-ts-lint/env.sh"`.

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

Build base `$BASE` and the head. Compare only `*.js` under both packages’ `lib/` folders. Exclude every `*.map`, `*.d.ts`, `*.d.ts.map`, and `tsconfig.*.tsbuildinfo` file. The named excluded list is in `COMMANDS.md`. First compare the `.js` name lists (missing folder or file → exit 1). Run `diff` on each `.js` pair (`diff` exit 2 → check exit 2). Write the normalized actual diff and `cmp` it to `$S/emit.expected.diff` (sha256 `3a1a333db8318d1ac2df89cc270aab2e8e519d4f785c2e29172656feb0ad655c`). The golden holds the `void` words, the two `Promise.resolve` lines, and the Probe assertion parentheses. Keep raw diffs in `$L`. Exact command: `rec emit_diff sh "$S/emit_diff.sh"`.

### Gates `ts.lint.check.gates`

```bash
rec artifacts corepack pnpm run build:artifacts
# artifacts exit=0 build: recorded 358 client artifact(s) with 3 public value(s)
rec typecheck corepack pnpm run typecheck
# typecheck exit=0 run-gates: 5 passed, 0 failed, 0 skipped in <time>.
rec constraints corepack pnpm run constraints
# constraints exit=0
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
# component exit=0
```

`$S/COMPONENT.mjs` sha256: `f2f21579a0acb6491e3af56179063eb49c85a1a2cc99899f689bdeca5bb87925`. Bodies `null`, `{}`, `{ "pid": 123 }` must match the base.

### Smoke and off `ts.lint.check.smoke`

Import `ts.trace.check.pass` and `ts.trace.check.off` from `docs/tasks/ts-trace.md` by name. Only one smoke on the machine at a time.

## Parts `ts.lint.parts`

| Part | Blocks | Spike / prior time |
|---|---|---|
| `ts.lint.part.change` | setup, install, patch, lint, var, emit_diff | ~4 min (+ build) |
| `ts.lint.part.gates` | artifacts, typecheck, constraints, paths, desktop, keep, component | ~3.5 min (+ smoke wait) |
| `ts.lint.part.smoke` | tools + five pass smokes | ~5–8 min |
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

`ts.lint` still waits for the yes of the operator. Do not start the build until Otter and the operator say so.
`````

## `COMMANDS.md`

sha256 `206f008a25689703ca75080e3f9d52a09b6256498af4e7e1d97ab02d978d46d6`

`````markdown
---
title: "ts.lint build command file from spike (design round 2)"
tags: [deepwidgets, ts-lint, spike]
status: active
created: 2026-10-28
---

# Command file `ts.lint.commands`

Reuse the `rec` helper from `docs/tasks/ts-trace.md` (`ts.trace.setup`). Put logs in `$TMPDIR/deepwidgets-ts-lint/logs/`.

Base: `origin/main` at `96c770678abd0072b1fe147440a6fd9f6a8961e4` (merge of PR #37). Branch `rohan/ts-lint`. Worktree `~/deepWidgets/.worktrees/rohan-ts-lint`.

Spike evidence and this file: `~/.buzz/RESEARCH/DEEPWIDGETS_TS_LINT_SPIKE_20261028/`. Follow `brief.ts_lint.change.erased` in `~/.buzz/PLANS/DEEPWIDGETS_FLOW_LEAN.md`.

## Setup `ts.lint.setup`

```bash
mkdir -p "$TMPDIR/deepwidgets-ts-lint/logs" && cat > "$TMPDIR/deepwidgets-ts-lint/env.sh" <<'EOF'
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 BASE=96c770678abd0072b1fe147440a6fd9f6a8961e4 R="$HOME/deepWidgets"
export W="$R/.worktrees/rohan-ts-lint" T="$TMPDIR/deepwidgets-ts-lint" L="$TMPDIR/deepwidgets-ts-lint/logs"
export S="$HOME/.buzz/RESEARCH/DEEPWIDGETS_TS_LINT_SPIKE_20261028"
rec() { n=$1; shift; printf '%s: %s\n' "$n" "$*" >> "$L/commands.txt"; "$@" > "$L/$n.log" 2>&1; c=$?; echo "$n exit=$c $(tail -n 1 "$L/$n.log")" | tee -a "$L/exits.txt"; }
if [ -d "$W" ]; then cd "$W"; fi
EOF
```

Start each shell with `. "$TMPDIR/deepwidgets-ts-lint/env.sh"`.

## Part times (spike / prior)

| Part | Blocks | Time |
|---|---|---|
| `ts.lint.part.change` | setup, install, patch, lint, var, emit_diff | ~4 min (+ build for emit_diff) |
| `ts.lint.part.gates` | artifacts, typecheck, constraints, paths, desktop, keep, component | ~200 s |
| `ts.lint.part.smoke` | five pass smokes + two tools | ~5–8 min |
| `ts.lint.part.off` | two off runs | ~8 min |
| `ts.lint.part.pr` | commit, push, PR | ~2 min |

No smoke in the spike or in design dry runs. Before each smoke or build, wait until no other `tools/smoke-desktop.mjs` runs (30 s poll, max 4 min).

## Worktree and install `ts.lint.steps.base`

Same Electron fallback shape as `ts.trace.steps.base`.

```bash
rec change_start date -u +%T
# change_start exit=0 <time>
rec fetch git -C "$R" fetch origin
# fetch exit=0
rec base git -C "$R" merge-base --is-ancestor "$BASE" origin/main
# base exit=0
rec worktree git -C "$R" worktree add -b rohan/ts-lint .worktrees/rohan-ts-lint "$BASE"
# worktree exit=0 HEAD is now at 96c77067 Merge #37: ts.trace: move the trace to TypeScript
cd "$W"
rec node node --version
# node exit=0 v22.23.0
rec pnpm corepack pnpm --version
# pnpm exit=0 11.28.5
rec install corepack pnpm install --frozen-lockfile
# install exit=0 Done in <time> using pnpm v11.28.5
rec electron ls apps/desktop/node_modules/electron/dist
# electron exit=<any>
rec electron_install node apps/desktop/node_modules/electron/install.js
# if electron exit is not 0: electron_install exit=0
rec electron_again ls apps/desktop/node_modules/electron/dist
# if electron exit is not 0: electron_again exit=0
```

## Source patch `ts.lint.steps.patch`

One patch file. sha256 `7eba8271e81a0f8a8e088d9eed1989770a9f9b85a07eac782a1fae637e8980fa` of `$S/DIFF.patch`.

```bash
rec patch_sum shasum -a 256 "$S/DIFF.patch"
# patch_sum exit=0 7eba8271e81a0f8a8e088d9eed1989770a9f9b85a07eac782a1fae637e8980fa  .../DIFF.patch
rec apply_check git apply --check "$S/DIFF.patch"
# apply_check exit=0
rec apply git apply "$S/DIFF.patch"
# apply exit=0
rec sums tee "$T/changed.sha256" <<'EOF'
878c075d3c6a5af7684899d06c06b64cfe0b84065e79d63844eeb160275413b1  .oxlintrc.json
9d7b28ec1af6a06da44cd5a89b8c13615b379d84a8bb39437926de09f5dcf852  deepwidgets/probe/src/index.ts
9cbc1307fce4101c28d829de2369c0d7d11034ff19e76fa7474ee5aa28304969  deepwidgets/probe/src/client/Probe.tsx
d05f09aab7a0598ec8ffc7c6da4c5f0ce60ec4e6ea9b397283908107bc132533  deepwidgets/trace/src/index.ts
8178cc45a4b488293e75b2057e9fb7be429ba0a6be529348e51d0c976f0a4a08  deepwidgets/trace/src/client/index.ts
EOF
# sums exit=0
rec hash shasum -a 256 -c "$T/changed.sha256"
# hash exit=0 deepwidgets/trace/src/client/index.ts: OK
```

If `apply` or `hash` fails, stop and mention Otter.

### Fix shape under `brief.ts_lint.change.erased`

- Floating promises: prefix with `void` (emit adds `void`).
- `Probe.tsx` JSON: `const body = (await response.json()) as { pid: number }`, keep `return \`probe pid ${String(body.pid)}\``.
- Keep `?? ''`, `=== true`, and `?.`. Widen with annotations or `as`. Keep `import type`. Compare state with `fiber.state !== (0 as FiberState.PENDING)`.
- Catch callback: `(error: unknown)`.
- `require-await` exceptions: probe and host `/trace` use `() => Promise.resolve(...)`.

## Checks `ts.lint.check`

### Lint gate `ts.lint.check.lint`

```bash
rec lint corepack pnpm exec tsx scripts/run-oxlint.ts deepwidgets/probe/src deepwidgets/trace/src
# lint exit=0
```

### Must-fail `var` `ts.lint.check.var`

```bash
rec var_save sh -c 'cp deepwidgets/probe/src/index.ts "$T/probe-index.ts.clean" && shasum -a 256 deepwidgets/probe/src/index.ts > "$T/probe-index.before.sha256"'
# var_save exit=0
rec var_add sh -c 'printf "%s\n" "var __spikeLintVar = 1" >> deepwidgets/probe/src/index.ts'
# var_add exit=0
rec var_lint corepack pnpm exec tsx scripts/run-oxlint.ts deepwidgets/probe/src deepwidgets/trace/src
# var_lint exit=1 ... eslint(no-var): Unexpected var, use let or const instead. ...
rec var_count grep -c 'no-var' "$L/var_lint.log"
# var_count exit=0 1
rec var_restore sh -c 'cp "$T/probe-index.ts.clean" deepwidgets/probe/src/index.ts && shasum -a 256 deepwidgets/probe/src/index.ts > "$T/probe-index.after.sha256" && cmp "$T/probe-index.before.sha256" "$T/probe-index.after.sha256"'
# var_restore exit=0
rec var_hash_ok shasum -a 256 -c "$T/changed.sha256"
# var_hash_ok exit=0 deepwidgets/trace/src/client/index.ts: OK
```

### Emit golden diff `ts.lint.check.emit_diff`

Compare only `*.js` under `deepwidgets/probe/lib` and `deepwidgets/trace/lib`. Do not compare maps, declaration emit, or TypeScript build info. Named excluded files (present under those `lib/` trees, not part of the golden):

```
deepwidgets/probe/lib/client.js.map
deepwidgets/probe/lib/tsconfig.client.tsbuildinfo
deepwidgets/probe/lib/tsconfig.host.tsbuildinfo
deepwidgets/probe/lib/types/client/Probe.d.ts
deepwidgets/probe/lib/types/client/Probe.d.ts.map
deepwidgets/probe/lib/types/client/Probe.js.map
deepwidgets/probe/lib/types/client/index.d.ts
deepwidgets/probe/lib/types/client/index.d.ts.map
deepwidgets/probe/lib/types/client/index.js.map
deepwidgets/probe/lib/types/index.d.ts
deepwidgets/probe/lib/types/index.d.ts.map
deepwidgets/probe/lib/types/index.js.map
deepwidgets/trace/lib/client.js.map
deepwidgets/trace/lib/tsconfig.client.tsbuildinfo
deepwidgets/trace/lib/tsconfig.host.tsbuildinfo
deepwidgets/trace/lib/types/client/index.d.ts
deepwidgets/trace/lib/types/client/index.d.ts.map
deepwidgets/trace/lib/types/client/index.js.map
deepwidgets/trace/lib/types/index.d.ts
deepwidgets/trace/lib/types/index.d.ts.map
deepwidgets/trace/lib/types/index.js.map
```

Golden file `$S/emit.expected.diff` (sha256 `3a1a333db8318d1ac2df89cc270aab2e8e519d4f785c2e29172656feb0ad655c`) holds the `void` words, the two `Promise.resolve` resource lines, and the Probe assertion parentheses. Helper `$S/emit_diff.sh` (sha256 `a111993cf8705f5eff09a507c005dc3289c6332ba2c6c7700c53e32a2e4055a4`) lists `.js` names first (missing folder or name → exit 1), runs `diff -u` per file (diff exit 2 → check exit 2), writes `$L/emit_actual.diff` plus per-package raw diffs, then `cmp` against the golden (mismatch → exit 1). No trailing `true`.

```bash
rec base_wt git -C "$R" worktree add --detach "$T/base-wt" "$BASE"
# base_wt exit=0 HEAD is now at 96c77067 Merge #37: ts.trace: move the trace to TypeScript
rec base_install corepack pnpm --dir "$T/base-wt" install --frozen-lockfile
# base_install exit=0 Done in <time> using pnpm v11.28.5
rec base_artifacts corepack pnpm --dir "$T/base-wt" run build:artifacts
# base_artifacts exit=0 build: recorded 358 client artifact(s) with 2 public value(s)
rec head_artifacts corepack pnpm run build:artifacts
# head_artifacts exit=0 build: recorded 358 client artifact(s) with 3 public value(s)
rec emit_expected_sum shasum -a 256 "$S/emit.expected.diff"
# emit_expected_sum exit=0 3a1a333db8318d1ac2df89cc270aab2e8e519d4f785c2e29172656feb0ad655c  .../emit.expected.diff
rec emit_diff sh "$S/emit_diff.sh"
# emit_diff exit=0 emit_diff: matches emit.expected.diff
```

### Gates `ts.lint.check.gates`

```bash
rec artifacts corepack pnpm run build:artifacts
# artifacts exit=0 build: recorded 358 client artifact(s) with 3 public value(s)
rec typecheck corepack pnpm run typecheck
# typecheck exit=0 run-gates: 5 passed, 0 failed, 0 skipped in <time>.
rec constraints corepack pnpm run constraints
# constraints exit=0
rec tsconfig_paths corepack pnpm run verify-tsconfig-paths
# tsconfig_paths exit=0 gen-tsconfig-paths: tsconfig.base.json package aliases are current.
rec desktop corepack pnpm --filter @deepseek-ai/dsh-desktop run build
# desktop exit=0 ✓ built in <time>
rec keep git diff --exit-code "$BASE" -- deepwidgets/probe/cordis.patch.yml deepwidgets/trace/cordis.patch.yml deepwidgets/trace/page.html deepwidgets/trim pnpm-lock.yaml
# keep exit=0
```

### Component JSON `ts.lint.check.component`

Script `$S/COMPONENT.mjs` (sha256 `f2f21579a0acb6491e3af56179063eb49c85a1a2cc99899f689bdeca5bb87925`). Run from the head worktree after install. Bodies `null`, `{}`, and `{ "pid": 123 }` must match the base at `$BASE`.

```bash
rec component_sum shasum -a 256 "$S/COMPONENT.mjs"
# component_sum exit=0 f2f21579a0acb6491e3af56179063eb49c85a1a2cc99899f689bdeca5bb87925  .../COMPONENT.mjs
rec component sh -c 'COMPONENT_OUT="$L/component.json" BASE="$BASE" node "$S/COMPONENT.mjs"'
# component exit=0 ... "match": true ...
```

### Smoke and off

Import `ts.trace.check.pass` and `ts.trace.check.off` from `docs/tasks/ts-trace.md` by those block names. No new smoke recipe. Not part of the design dry run.

## Hashes (`CHANGED.sha256`)

```
878c075d3c6a5af7684899d06c06b64cfe0b84065e79d63844eeb160275413b1  .oxlintrc.json
9d7b28ec1af6a06da44cd5a89b8c13615b379d84a8bb39437926de09f5dcf852  deepwidgets/probe/src/index.ts
9cbc1307fce4101c28d829de2369c0d7d11034ff19e76fa7474ee5aa28304969  deepwidgets/probe/src/client/Probe.tsx
d05f09aab7a0598ec8ffc7c6da4c5f0ce60ec4e6ea9b397283908107bc132533  deepwidgets/trace/src/index.ts
8178cc45a4b488293e75b2057e9fb7be429ba0a6be529348e51d0c976f0a4a08  deepwidgets/trace/src/client/index.ts
```

Patch sha256: `7eba8271e81a0f8a8e088d9eed1989770a9f9b85a07eac782a1fae637e8980fa`.
`````

## `DIFF.patch`

sha256 `7eba8271e81a0f8a8e088d9eed1989770a9f9b85a07eac782a1fae637e8980fa`

`````diff
diff --git a/.oxlintrc.json b/.oxlintrc.json
index f52fdb1e..483ad755 100644
--- a/.oxlintrc.json
+++ b/.oxlintrc.json
@@ -35,6 +35,7 @@
       // Shared strict type-aware rules. Source/test differences stay in the short overrides below.
       "files": [
         "packages/*/*/src/**/*.{ts,tsx}",
+        "deepwidgets/*/src/**/*.{ts,tsx}",
         "packages/*/*/tests/**/*.{ts,tsx}",
         "apps/*/src/**/*.{ts,tsx}",
         "apps/*/tests/**/*.{ts,tsx}",
@@ -152,6 +153,7 @@
     {
       "files": [
         "packages/*/*/src/**/*.{ts,tsx}",
+        "deepwidgets/*/src/**/*.{ts,tsx}",
         "apps/*/src/**/*.{ts,tsx}",
         "examples/**/*.{ts,tsx}",
         "scripts/**/*.{ts,tsx}",
diff --git a/deepwidgets/probe/src/client/Probe.tsx b/deepwidgets/probe/src/client/Probe.tsx
index fd4c0503..0dd0531c 100644
--- a/deepwidgets/probe/src/client/Probe.tsx
+++ b/deepwidgets/probe/src/client/Probe.tsx
@@ -6,10 +6,10 @@ import type { ReactElement } from 'react'
 export function Probe(): ReactElement {
   const [text, setText] = useState('probe pending')
   useEffect(() => {
-    fetch('api/probe')
+    void fetch('api/probe')
       .then(async (response) => {
         if (!response.ok) return `probe error ${String(response.status)}`
-        const body: { pid: number } = await response.json()
+        const body = (await response.json()) as { pid: number }
         return `probe pid ${String(body.pid)}`
       })
       .catch((error: unknown) => `probe error ${error instanceof Error ? error.message : 'fetch failed'}`)
diff --git a/deepwidgets/probe/src/index.ts b/deepwidgets/probe/src/index.ts
index 326fb054..7faf44ea 100644
--- a/deepwidgets/probe/src/index.ts
+++ b/deepwidgets/probe/src/index.ts
@@ -13,6 +13,6 @@ export function apply(ctx: Context): void {
   ctx.effect(() => ctx.webServer.register({
     kind: 'exact',
     path: '/api/probe',
-    resource: async () => Response.json({ ok: true, pid: process.pid }),
+    resource: () => Promise.resolve(Response.json({ ok: true, pid: process.pid })),
   }), 'deepwidgets-probe: GET /api/probe')
 }
diff --git a/deepwidgets/trace/src/client/index.ts b/deepwidgets/trace/src/client/index.ts
index 0a07cc27..8e2394c7 100644
--- a/deepwidgets/trace/src/client/index.ts
+++ b/deepwidgets/trace/src/client/index.ts
@@ -1,5 +1,5 @@
 /** Client half of the trace: it sends the rows and services of one window to `POST api/trace`. */
-import type { Context, Fiber } from '@deepseek-ai/cordis'
+import type { Context, Fiber, FiberState } from '@deepseek-ai/cordis'
 import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
 
 /** Fields of one new client message. */
@@ -46,8 +46,8 @@ export function apply(ctx: Context): void {
   }
 
   function pluginDetail(entry: Entry, fiber: Fiber): string {
-    const name = entry.options.name ?? ''
-    if (fiber.state !== 0) return name
+    const name = (entry.options.name as unknown as string | undefined) ?? ''
+    if (fiber.state !== (0 as FiberState.PENDING)) return name
     const missing = Object.keys(fiber.inject).filter((service) => fiber.ctx.get(service) === undefined).sort()
     if (missing.length === 0) return name
     return `${name} waits for ${missing.join(',')}`
@@ -63,7 +63,7 @@ export function apply(ctx: Context): void {
       body: JSON.stringify(batch),
     }).then((response) => {
       if (!stopped && !response.ok) ctx.logger.warn(`deepwidgets-trace: POST api/trace answered ${response.status}`)
-    }, (error) => {
+    }, (error: unknown) => {
       if (!stopped) ctx.logger.warn('deepwidgets-trace: POST api/trace failed', error)
     }).finally(() => {
       sending = false
@@ -86,7 +86,7 @@ export function apply(ctx: Context): void {
     queueMicrotask(sendLater)
   }
 
-  function addPlugin(entry: Entry, fiber: Fiber, snapshot: boolean): void {
+  function addPlugin(entry: Entry, fiber: Fiber, snapshot: boolean | undefined): void {
     const name = rowKey(entry)
     if (typeof name !== 'string' || name === '') return
     addMessage({
@@ -99,7 +99,7 @@ export function apply(ctx: Context): void {
     seen.add(fiber)
   }
 
-  function addService(name: string, state: string, snapshot: boolean): void {
+  function addService(name: string, state: string, snapshot: boolean | undefined): void {
     addMessage({ kind: 'service', name, state, snapshot: snapshot === true })
   }
 
@@ -132,7 +132,7 @@ export function apply(ctx: Context): void {
   ctx.on('internal/status', (fiber) => {
     try {
       if (fiber.entry === undefined) return
-      if (fiber.parent?.fiber?.entry === fiber.entry) return
+      if ((fiber as { parent?: { fiber?: { entry?: Entry } } }).parent?.fiber?.entry === fiber.entry) return
       if (fiber.entry.options.name === 'cordis:include') return
       addPlugin(fiber.entry, fiber, false)
     } catch (error) {
@@ -152,7 +152,7 @@ export function apply(ctx: Context): void {
     }
   })
 
-  ctx.loader.await().then(() => {
+  void ctx.loader.await().then(() => {
     try {
       if (stopped) return
       rescan()
diff --git a/deepwidgets/trace/src/index.ts b/deepwidgets/trace/src/index.ts
index 20b95a94..5d9b2c46 100644
--- a/deepwidgets/trace/src/index.ts
+++ b/deepwidgets/trace/src/index.ts
@@ -1,6 +1,6 @@
 /** Host half of the trace: it keeps the trace messages and serves them on `/api/trace` and `/trace`. */
 import { readFileSync } from 'node:fs'
-import type { Context, Fiber } from '@deepseek-ai/cordis'
+import type { Context, Fiber, FiberState } from '@deepseek-ai/cordis'
 import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
 import type {} from '@deepseek-ai/dsh-client-connection'
 import type {} from '@deepseek-ai/dsh-host-webserver'
@@ -73,8 +73,8 @@ export function apply(ctx: Context): void {
   }
 
   function pluginDetail(entry: Entry, fiber: Fiber): string {
-    const name = entry.options.name ?? ''
-    if (fiber.state !== 0) return name
+    const name = (entry.options.name as unknown as string | undefined) ?? ''
+    if (fiber.state !== (0 as FiberState.PENDING)) return name
     const missing = Object.keys(fiber.inject).filter((service) => fiber.ctx.get(service) === undefined).sort()
     if (missing.length === 0) return name
     return `${name} waits for ${missing.join(',')}`
@@ -98,7 +98,7 @@ export function apply(ctx: Context): void {
     return message
   }
 
-  function addPlugin(entry: Entry, fiber: Fiber, snapshot: boolean): void {
+  function addPlugin(entry: Entry, fiber: Fiber, snapshot: boolean | undefined): void {
     addMessage({
       time: Date.now(),
       process: 'host',
@@ -111,7 +111,7 @@ export function apply(ctx: Context): void {
     seen.add(fiber)
   }
 
-  function addService(name: string, state: string, snapshot: boolean): void {
+  function addService(name: string, state: string, snapshot: boolean | undefined): void {
     addMessage({
       time: Date.now(),
       process: 'host',
@@ -147,7 +147,7 @@ export function apply(ctx: Context): void {
   ctx.on('internal/status', (fiber) => {
     try {
       if (fiber.entry === undefined) return
-      if (fiber.parent?.fiber?.entry === fiber.entry) return
+      if ((fiber as { parent?: { fiber?: { entry?: Entry } } }).parent?.fiber?.entry === fiber.entry) return
       if (fiber.entry.options.name === 'cordis:include') return
       addPlugin(fiber.entry, fiber, false)
     } catch (error) {
@@ -167,7 +167,7 @@ export function apply(ctx: Context): void {
     }
   })
 
-  ctx.loader.await().then(() => {
+  void ctx.loader.await().then(() => {
     try {
       if (stopped) return
       rescan()
@@ -289,7 +289,7 @@ export function apply(ctx: Context): void {
   ctx.effect(() => ctx.webServer.register({
     kind: 'exact',
     path: '/trace',
-    resource: async () => new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
+    resource: () => Promise.resolve(new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } })),
   }), 'deepwidgets-trace: GET /trace')
 
   ctx.effect(() => () => {
`````

## `emit.expected.diff`

sha256 `3a1a333db8318d1ac2df89cc270aab2e8e519d4f785c2e29172656feb0ad655c`

`````diff
--- a/deepwidgets/probe/lib/index.js
+++ b/deepwidgets/probe/lib/index.js
@@ -9,10 +9,10 @@
 	ctx.effect(() => ctx.webServer.register({
 		kind: "exact",
 		path: "/api/probe",
-		resource: async () => Response.json({
+		resource: () => Promise.resolve(Response.json({
 			ok: true,
 			pid: process.pid
-		})
+		}))
 	}), "deepwidgets-probe: GET /api/probe");
 }
 //#endregion
--- a/deepwidgets/probe/lib/types/client/Probe.js
+++ b/deepwidgets/probe/lib/types/client/Probe.js
@@ -5,11 +5,11 @@
 export function Probe() {
     const [text, setText] = useState('probe pending');
     useEffect(() => {
-        fetch('api/probe')
+        void fetch('api/probe')
             .then(async (response) => {
             if (!response.ok)
                 return `probe error ${String(response.status)}`;
-            const body = await response.json();
+            const body = (await response.json());
             return `probe pid ${String(body.pid)}`;
         })
             .catch((error) => `probe error ${error instanceof Error ? error.message : 'fetch failed'}`)
--- a/deepwidgets/probe/lib/types/index.js
+++ b/deepwidgets/probe/lib/types/index.js
@@ -8,7 +8,7 @@
     ctx.effect(() => ctx.webServer.register({
         kind: 'exact',
         path: '/api/probe',
-        resource: async () => Response.json({ ok: true, pid: process.pid }),
+        resource: () => Promise.resolve(Response.json({ ok: true, pid: process.pid })),
     }), 'deepwidgets-probe: GET /api/probe');
 }
 //# sourceMappingURL=index.js.map
\ No newline at end of file
--- a/deepwidgets/trace/lib/index.js
+++ b/deepwidgets/trace/lib/index.js
@@ -228,7 +228,7 @@
 	ctx.effect(() => ctx.webServer.register({
 		kind: "exact",
 		path: "/trace",
-		resource: async () => new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } })
+		resource: () => Promise.resolve(new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8" } }))
 	}), "deepwidgets-trace: GET /trace");
 	ctx.effect(() => () => {
 		stopped = true;
--- a/deepwidgets/trace/lib/types/client/index.js
+++ b/deepwidgets/trace/lib/types/client/index.js
@@ -133,7 +133,7 @@
             ctx.logger.warn('deepwidgets-trace: internal/service failed', error);
         }
     });
-    ctx.loader.await().then(() => {
+    void ctx.loader.await().then(() => {
         try {
             if (stopped)
                 return;
--- a/deepwidgets/trace/lib/types/index.js
+++ b/deepwidgets/trace/lib/types/index.js
@@ -122,7 +122,7 @@
             ctx.logger.warn('deepwidgets-trace: internal/service failed', error);
         }
     });
-    ctx.loader.await().then(() => {
+    void ctx.loader.await().then(() => {
         try {
             if (stopped)
                 return;
@@ -263,7 +263,7 @@
     ctx.effect(() => ctx.webServer.register({
         kind: 'exact',
         path: '/trace',
-        resource: async () => new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
+        resource: () => Promise.resolve(new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } })),
     }), 'deepwidgets-trace: GET /trace');
     ctx.effect(() => () => {
         stopped = true;
`````

## `emit.excluded.txt`

sha256 `0826a40412fa45658b957423ab8589a584d1c4985717bc001b8b16ff9fc902b7`

`````text
deepwidgets/probe/lib/client.js.map
deepwidgets/probe/lib/tsconfig.client.tsbuildinfo
deepwidgets/probe/lib/tsconfig.host.tsbuildinfo
deepwidgets/probe/lib/types/client/Probe.d.ts
deepwidgets/probe/lib/types/client/Probe.d.ts.map
deepwidgets/probe/lib/types/client/Probe.js.map
deepwidgets/probe/lib/types/client/index.d.ts
deepwidgets/probe/lib/types/client/index.d.ts.map
deepwidgets/probe/lib/types/client/index.js.map
deepwidgets/probe/lib/types/index.d.ts
deepwidgets/probe/lib/types/index.d.ts.map
deepwidgets/probe/lib/types/index.js.map
deepwidgets/trace/lib/client.js.map
deepwidgets/trace/lib/tsconfig.client.tsbuildinfo
deepwidgets/trace/lib/tsconfig.host.tsbuildinfo
deepwidgets/trace/lib/types/client/index.d.ts
deepwidgets/trace/lib/types/client/index.d.ts.map
deepwidgets/trace/lib/types/client/index.js.map
deepwidgets/trace/lib/types/index.d.ts
deepwidgets/trace/lib/types/index.d.ts.map
deepwidgets/trace/lib/types/index.js.map
`````

## `emit_diff.sh`

sha256 `a111993cf8705f5eff09a507c005dc3289c6332ba2c6c7700c53e32a2e4055a4`

`````bash
#!/bin/sh
# Golden .js emit check for ts.lint. Requires: W cwd = head worktree, T, L, S, BASE set.
# Compares only *.js under deepwidgets/{probe,trace}/lib.
# Excludes every non-.js file under those lib trees (listed in $S/emit.excluded.txt).
set -eu
BASE_ROOT="${T}/base-wt"
OUT="${L}/emit_actual.diff"
RAW_PROBE="${L}/emit-probe.js.diff"
RAW_TRACE="${L}/emit-trace.js.diff"
: >"$OUT"
: >"$RAW_PROBE"
: >"$RAW_TRACE"

list_js() {
  find "$1" -type f -name '*.js' | sed "s|^$1/||" | LC_ALL=C sort
}

for pkg in probe trace; do
  base_lib="${BASE_ROOT}/deepwidgets/${pkg}/lib"
  head_lib="deepwidgets/${pkg}/lib"
  if [ ! -d "$base_lib" ] || [ ! -d "$head_lib" ]; then
    echo "emit_diff: missing lib folder for ${pkg}" >&2
    exit 1
  fi
  base_list=$(mktemp)
  head_list=$(mktemp)
  list_js "$base_lib" >"$base_list"
  list_js "$head_lib" >"$head_list"
  if ! cmp -s "$base_list" "$head_list"; then
    echo "emit_diff: .js file list differs for ${pkg}" >&2
    diff -u "$base_list" "$head_list" >&2 || true
    rm -f "$base_list" "$head_list"
    exit 1
  fi
  raw="${L}/emit-${pkg}.js.diff"
  : >"$raw"
  while IFS= read -r rel; do
    [ -n "$rel" ] || continue
    set +e
    diff -u "${base_lib}/${rel}" "${head_lib}/${rel}" >"${L}/emit-one.diff"
    d=$?
    set -e
    if [ "$d" -eq 2 ]; then
      echo "emit_diff: diff failed for ${pkg}/${rel}" >&2
      rm -f "$base_list" "$head_list" "${L}/emit-one.diff"
      exit 2
    fi
    if [ "$d" -eq 1 ]; then
      # stable headers, no timestamps
      awk -v pkg="$pkg" -v rel="$rel" '
        BEGIN { }
        /^\-\-\- / { print "--- a/deepwidgets/" pkg "/lib/" rel; next }
        /^\+\+\+ / { print "+++ b/deepwidgets/" pkg "/lib/" rel; next }
        { print }
      ' "${L}/emit-one.diff" | tee -a "$raw" >>"$OUT"
    fi
  done <"$base_list"
  rm -f "$base_list" "$head_list" "${L}/emit-one.diff"
done

if ! cmp -s "$OUT" "${S}/emit.expected.diff"; then
  echo "emit_diff: actual differs from emit.expected.diff" >&2
  diff -u "${S}/emit.expected.diff" "$OUT" | head -n 80 >&2 || true
  exit 1
fi
echo "emit_diff: matches emit.expected.diff"
exit 0
`````

## `COMPONENT.mjs`

sha256 `f2f21579a0acb6491e3af56179063eb49c85a1a2cc99899f689bdeca5bb87925`

`````js
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'

const require = createRequire(import.meta.url)
const root = process.cwd()
const ts = require(path.join(root, 'node_modules/typescript/lib/typescript.js'))
const file = 'deepwidgets/probe/src/client/Probe.tsx'
const baseSha = process.env.BASE || '96c770678abd0072b1fe147440a6fd9f6a8961e4'
const base = execFileSync('git', ['show', `${baseSha}:${file}`], { encoding: 'utf8' })
const spike = fs.readFileSync(path.join(root, file), 'utf8')

async function evaluate(source, body) {
  const effects = []
  const states = []
  const react = {
    useEffect: (f) => effects.push(f),
    useState: () => ['probe pending', (t) => states.push(t)],
  }
  const module = { exports: {} }
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText
  vm.runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => (name === 'react' ? react : { jsx: () => null }),
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve(body) }),
  })
  module.exports.Probe()
  for (const effect of effects) effect()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(states.length, 1)
  return states[0]
}

const results = []
for (const body of [null, {}, { pid: 123 }]) {
  const b = await evaluate(base, body)
  const s = await evaluate(spike, body)
  results.push({ body, base: b, spike: s, match: b === s })
}
assert.ok(results.every((r) => r.match), JSON.stringify(results, null, 2))
const out = process.env.COMPONENT_OUT || 'component.json'
fs.writeFileSync(out, JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results, null, 2))
`````
