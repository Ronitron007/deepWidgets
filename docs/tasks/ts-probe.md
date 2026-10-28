# Task `ts.probe`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `ts.probe.goal`

Move `@deepwidgets/probe` from plain JavaScript to TypeScript, and add it to the DSH build and the DSH type check. The spec is `docs/specs/ts-move.md` (spec `ts_move`). The plan row is `ts.probe` in `docs/plans/ts-move.md`.

The move changes the source form and the build. It does not change what the app does (`ts_move.keep`). Each file in this task is final. Write it as the task gives it.

| Term | Meaning |
|---|---|
| probe test | `DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs` |
| rows check | `DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs` |
| trace test | `DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs` |
| spike | `spike.build_path`. It ran the probe files and the root build files of this task on the base `7353cbcd`. The review is `~/.buzz/RESEARCH/DEEPWIDGETS_PREP_TS_REVIEW_20261028/FINDINGS.md`. |
| exit record | One line `<name> exit=<code>` in `$L/exits.txt` for each command. The spike did not keep these lines (`review.prep.ts.exit_records`). |

## Setup `ts.probe.setup`

| Item | Value |
|---|---|
| Base | `origin/main`. It must contain `04280311cab2e49e8dd5ee61b241b6282b491b0d`. After that commit, only files under `docs/` can change. |
| Branch | `rohan/ts-probe` (new) |
| Worktree | `~/deepWidgets/.worktrees/rohan-ts-probe` |
| Temporary files | `$TMPDIR/deepwidgets-ts-probe/`, with the logs in its folder `logs/` |
| Machine | this Mac, with a display. The smoke check opens app windows. |

In each new shell, set these variables. When the worktree exists, also run `cd "$W"`.

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
R=~/deepWidgets ; W=$R/.worktrees/rohan-ts-probe ; T=$TMPDIR/deepwidgets-ts-probe ; L=$T/logs
BASE=04280311cab2e49e8dd5ee61b241b6282b491b0d
```

```bash
git -C "$R" fetch origin
git -C "$R" merge-base --is-ancestor "$BASE" origin/main ; echo "base exit=$?"                              # base exit=0
git -C "$R" diff --name-only "$BASE" origin/main | grep -cv '^docs/'                                       # 0
git -C "$R" rev-parse --verify --quiet refs/heads/rohan/ts-probe ; echo "branch exit=$?"                   # branch exit=1
git -C "$R" ls-remote --exit-code --heads origin rohan/ts-probe ; echo "remote exit=$?"                    # remote exit=2
git -C "$R" worktree add -b rohan/ts-probe .worktrees/rohan-ts-probe origin/main ; echo "worktree exit=$?" # worktree exit=0
cd "$W" && mkdir -p "$L" && touch "$L/exits.txt"
node --version                                                                                             # record it. The spike used v22.23.0.
corepack pnpm --version                                                                                    # 11.28.5
```

If a command does not give the output in its comment, stop. A count other than `0` means that code changed after the base. The `Unsupported engine` warning of pnpm is not a failure.

## Read first `ts.probe.read`

Read `ts_move.layout`, `ts_move.layout.source`, `ts_move.build_path`, `ts_move.keep`, and `ts_move.stale_text` in the spec. Read `deepwidgets/probe/index.js` and `deepwidgets/probe/client.js` at the base. The new `src/` files keep each function, branch, string, and value of these two files.

The architect checked each fact below at the base. If a fact is false, stop and report.

| Fact | Evidence |
|---|---|
| The files of `ts.probe.steps.files` and `ts.probe.steps.root` are the files of the spike. The 11 hashes in `ts.probe.steps.root` are the hashes of the staged files in the spike worktree `.worktrees/rohan-spike-prep-ts`. The spike did not change `pnpm-workspace.yaml` or `CLAUDE.md`. | verified (ran `shasum`). The spike patch has the sha256 `a4e1ca75a6db1f5217dd73abc0478e4266dcf8596305c8fecba3e1b9d5c0873e`. |
| Between `7353cbcd` and the base, only `docs/` changed. The spike patch applies to the base. | verified (ran `git diff --stat`, and `git apply --check` with exit 0) |
| With these files, `build:artifacts` gave `run-gates: 8 passed, 0 failed`. The probe test, the rows check, and the trace test passed. `typecheck` gave `run-gates: 5 passed, 0 failed`. A type error made `build:artifacts` and `typecheck` exit 1. Without `lib/index.js`, the probe test gave `smoke-desktop: fail: probe text: missing`. | verified (spike, reviewed). Some exits come from the log ends only. |
| The spike lockfile has the numstat `17 1 pnpm-lock.yaml`, one hunk, and the sha256 of `ts.probe.steps.install`. | verified (ran `git diff` and `shasum` in the spike worktree) |
| `start:desktop` prepares the runtime at each start. Thus this task has no `prepare:primary-runtime` step. | verified (read `apps/desktop/scripts/dev.ts` line 123) |
| No test file names `deepwidgets`. The seven test files of `ts.probe.steps.base` read the real root files of this task. | verified (ran `git grep`, read the `root` of each test). Inferred (read a sample) for the other matches, which write their own copies. |
| To delete `index.js` and `client.js` is not a trim, because the code moves to `src/`. The two new reference lines comment out no line, thus they need no marker (`head.trim`). | verified (read `ts_move.layout` and `CLAUDE.md`) |

## Steps `ts.probe.steps`

### Base state `ts.probe.steps.base`

Run these commands before you change a file.

```bash
corepack pnpm install --frozen-lockfile > "$L/base-install.log" 2>&1 ; echo "base install exit=$?" | tee -a "$L/exits.txt"   # base install exit=0
ls apps/desktop/node_modules/electron/dist > /dev/null ; echo "electron exit=$?" | tee -a "$L/exits.txt"                    # read the exit code
corepack pnpm run build:artifacts > "$L/base-artifacts.log" 2>&1 ; echo "base artifacts exit=$?" | tee -a "$L/exits.txt"   # base artifacts exit=0
corepack pnpm exec vitest run scripts/build.spec.ts scripts/client-tsconfig.spec.ts scripts/request-input-types.spec.ts scripts/oxlint-contract.spec.ts apps/desktop/tests/prepare-runtime-patches.spec.ts packages/subagent/subagent-claude-code/tests/subagent-claude-code.spec.ts packages/subagent/subagent-codex/tests/subagent-codex.spec.ts > "$L/base-tests.log" 2>&1 ; echo "base tests exit=$?" | tee -a "$L/exits.txt"   # record it
grep -E '^ *(Test Files|Tests) ' "$L/base-tests.log" > "$T/base-tests.txt" ; wc -l < "$T/base-tests.txt" | tr -d ' '       # 2
```

| Condition | Action |
|---|---|
| `base install exit` is not 0 | Stop. |
| `electron exit` is not 0 | Run `node apps/desktop/node_modules/electron/install.js` once, before the build. Record that you used this fallback. Then run the `ls` line again. If its exit is not 0, stop. Do not try another fix. |
| You used the fallback | Run the Git hook checks of `fork.baseline.steps.install` in `docs/tasks/fork-baseline.md` again. If a check does not give its expected output, stop. |
| `base artifacts exit` is not 0 | Stop. The base does not build. |
| `base tests exit` is not 0 | Do not stop. The head must give the same two lines (`ts.probe.check`). |
| The line count is not `2` | Stop, and report the last 40 lines of `base-tests.log`. |

### Write the probe files `ts.probe.steps.files`

Run this block from the worktree root. It deletes the two JavaScript files and writes the eight new files of `ts_move.layout`. The `node` command writes the three `tsconfig` files with `JSON.stringify(<object>, null, 2)`. The hash check proves that each file is the spike file, byte for byte.

```bash
git rm -q deepwidgets/probe/index.js deepwidgets/probe/client.js ; echo "rm exit=$?" | tee -a "$L/exits.txt"   # rm exit=0
mkdir -p deepwidgets/probe/src/client
cat > deepwidgets/probe/package.json <<'EOF'
{
  "name": "@deepwidgets/probe",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "lib/index.js",
  "types": "lib/types/index.d.ts",
  "exports": {
    ".": {
      "types": "./lib/types/index.d.ts",
      "default": "./lib/index.js"
    },
    "./client": {
      "types": "./lib/types/client/index.d.ts",
      "default": "./lib/client.js"
    },
    "./package.json": "./package.json"
  },
  "files": [
    "cordis.patch.yml",
    "lib/index.js",
    "lib/client.js",
    "lib/types/**/*.d.ts"
  ],
  "peerDependencies": {
    "@deepseek-ai/cordis": "workspace:~"
  },
  "devDependencies": {
    "@deepseek-ai/cordis": "workspace:~",
    "@deepseek-ai/dsh-client-ui-layout": "workspace:*",
    "@deepseek-ai/dsh-client-ui-renderer": "workspace:*",
    "@deepseek-ai/dsh-host-webserver": "workspace:*",
    "react": "^18.2.0"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": {
      "platform": "web",
      "immediately": true,
      "inject": ["@deepseek-ai/dsh-client-ui-layout"]
    }
  },
  "scripts": {
    "bundle": "tsdown",
    "watch": "tsdown --watch"
  }
}
EOF
cat > deepwidgets/probe/src/index.ts <<'EOF'
/** Host half of the probe: one route that answers with the host process id. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

/** Services the route needs. */
export const inject = ['webServer']

/**
 * Register `GET /api/probe` for the lifetime of the plugin.
 * @param ctx - host plugin context carrying the web server.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/api/probe',
    resource: async () => Response.json({ ok: true, pid: process.pid }),
  }), 'deepwidgets-probe: GET /api/probe')
}
EOF
cat > deepwidgets/probe/src/client/index.ts <<'EOF'
/** Client half of the probe: one overlay entry that shows the host process id. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { Probe } from './Probe.tsx'

/** Services the overlay entry needs. */
export const inject = ['slots']

/**
 * Put the probe text in the shell overlay.
 * @param ctx - client plugin context carrying the slot registry.
 */
export function apply(ctx: Context): void {
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'deepwidgets-probe',
  }, Probe))
}
EOF
cat > deepwidgets/probe/src/client/Probe.tsx <<'EOF'
/** Overlay text that shows the host process id from `GET /api/probe`. */
import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'

/** @returns the probe text element. */
export function Probe(): ReactElement {
  const [text, setText] = useState('probe pending')
  useEffect(() => {
    fetch('api/probe')
      .then(async (response) => {
        if (!response.ok) return `probe error ${String(response.status)}`
        const body: { pid: number } = await response.json()
        return `probe pid ${String(body.pid)}`
      })
      .catch((error: unknown) => `probe error ${error instanceof Error ? error.message : 'fetch failed'}`)
      .then(setText)
  }, [])
  return <div data-deepwidgets-probe="">{text}</div>
}
EOF
cat > deepwidgets/probe/tsdown.config.ts <<'EOF'
import { clientBundle } from '../../packages/client/tsdown.client.ts'

export default clientBundle(import.meta.dirname, ['lib/types/index.js'])
EOF
node -e 'const fs = require("node:fs"); for (const [f, o] of Object.entries(JSON.parse(fs.readFileSync(0, "utf8")))) fs.writeFileSync(`deepwidgets/probe/${f}`, JSON.stringify(o, null, 2) + "\n")' <<'EOF'
{
  "tsconfig.json": { "files": [], "references": [{ "path": "./tsconfig.host.json" }, { "path": "./tsconfig.client.json" }] },
  "tsconfig.host.json": { "extends": "../../tsconfig.base.json", "compilerOptions": { "rootDir": "src", "outDir": "lib/types", "tsBuildInfoFile": "lib/tsconfig.host.tsbuildinfo" },
    "files": ["src/index.ts"], "references": [{ "path": "../../vendor/cordis" }, { "path": "../../packages/host/webserver" }] },
  "tsconfig.client.json": { "extends": "../../tsconfig.base.client.json", "compilerOptions": { "rootDir": "src", "outDir": "lib/types", "tsBuildInfoFile": "lib/tsconfig.client.tsbuildinfo" },
    "include": ["src"], "exclude": ["src/index.ts"], "references": [{ "path": "../../vendor/cordis" }, { "path": "../../packages/client/ui-renderer" }, { "path": "../../packages/client/ui-layout" }] }
}
EOF
```

### Change the root files `ts.probe.steps.root`

Run this block. Each `edit` replaces one exact text. The `assert` stops the script when the text does not occur exactly once. The `pnpm-workspace.yaml` line is deepWidgets text from `probe.round_trip`, thus it gets no marker (`ts_move.stale_text`). A comment line does not change the lockfile (inferred). The frozen install of `ts.probe.steps.install` proves it. Then the block stages the files and checks each hash.

```bash
python3 - <<'EOF'
import pathlib
def edit(path, old, new):
    p = pathlib.Path(path); s = p.read_text(); assert s.count(old) == 1, path; p.write_text(s.replace(old, new))
line = "  const packages = workspacePackageGlobs(globSync(['vendor/*/package.json', 'packages/*/*/package.json'], { cwd: import.meta.dirname }))\n"
edit('tsdown.config.ts', line, "  // deepwidgets-trim: ts_move builds each deepwidgets package that has its own tsdown config.\n"
     "  // const packages = workspacePackageGlobs(globSync(['vendor/*/package.json', 'packages/*/*/package.json'], { cwd: import.meta.dirname }))\n"
     "  const packages = workspacePackageGlobs(globSync(['vendor/*/package.json', 'packages/*/*/package.json', 'deepwidgets/*/tsdown.config.ts'], { cwd: import.meta.dirname }))\n")
old = '    { "path": "./packages/host/plugin-inventory" },\n'
edit('tsconfig.host.json', old, old + '    { "path": "./deepwidgets/probe/tsconfig.host.json" },\n')
old = '    { "path": "./packages/session/message-quotes" },\n'
edit('tsconfig.client.json', old, old + '    { "path": "./deepwidgets/probe/tsconfig.client.json" },\n')
edit('pnpm-workspace.yaml', '  # deepWidgets-owned plain-JS packages, outside the DSH TypeScript build globs.\n',
     '  # deepWidgets-owned packages. A package with its own tsdown.config.ts joins the DSH TypeScript build (spec ts_move).\n')
EOF
echo "root exit=$?" | tee -a "$L/exits.txt"   # root exit=0
git add deepwidgets/probe tsdown.config.ts tsconfig.host.json tsconfig.client.json pnpm-workspace.yaml
cat > "$T/probe.sha256" <<'EOF'
f95d752cad407259d930257427e031cac62a53e0bcbcfdbae660ea6a4196c059  deepwidgets/probe/package.json
6d3333d64bd175b7d1444129df1fb5cd76e7e5fdded1caa1f86dc55a0c8af223  deepwidgets/probe/src/index.ts
eb5b8123c7a677662275c7f131663e8c16c22562714bfac41249684196859d91  deepwidgets/probe/src/client/index.ts
ad291cc902228db22cb0a35cb928121f1f281b54bbb6691a24d25acc064bc2ed  deepwidgets/probe/src/client/Probe.tsx
fff436c5e4aeb7fe12d1cecd9542ad8639d7833e644b8bb1b04d844925850fd1  deepwidgets/probe/tsdown.config.ts
ad1b25d36ea100440140e543e2a2af188178934da74eadce1b27ef14e91b335e  deepwidgets/probe/tsconfig.json
ad6221b16f1c048cf37e3422d5f58a5f6f3646fd37eab0e4581d13440e95e949  deepwidgets/probe/tsconfig.host.json
dce6c2d15838c062dbd8748efdb982488555333a3627c893ed459b7d8fbef3fb  deepwidgets/probe/tsconfig.client.json
57771f8b2999ce20e232bcc042bba000083bfab97f1eebdd6e5846e801f1e529  tsdown.config.ts
c87ecd3d969d70c9f0bb2e98e5c8055e9a6287dfd1e47ee3f245473f727594cc  tsconfig.host.json
6fd19e27261df0baae6cc114633354610f99cfe9734dbca2361b210125c25095  tsconfig.client.json
EOF
shasum -a 256 -c "$T/probe.sha256" > "$L/hash.log" 2>&1 ; echo "hash exit=$?" | tee -a "$L/exits.txt"   # hash exit=0
git diff --cached --name-status | wc -l | tr -d ' '                                                      # 14
git diff --cached --numstat -- pnpm-workspace.yaml | tr '\t' ' '                                         # 1 1 pnpm-workspace.yaml
```

If `root exit` is not 0, stop and report the `AssertionError` line. If `hash exit` is not 0, `hash.log` names each bad file with `FAILED`. Write each such file again from its block, and run the check again. If it fails again, stop.

### Install `ts.probe.steps.install`

```bash
corepack pnpm install --offline > "$L/install.log" 2>&1 ; echo "install exit=$?" | tee -a "$L/exits.txt"          # install exit=0
git diff --numstat -- pnpm-lock.yaml | tr '\t' ' '                                                               # 17 1 pnpm-lock.yaml
git diff -U0 -- pnpm-lock.yaml | grep -c '^@@'                                                                   # 1
shasum -a 256 pnpm-lock.yaml | cut -d' ' -f1                                                                     # 0308b6d2433faf9f36be5202c454de03106e8f5a8afb0772081bcc17bbc62bb0
corepack pnpm install --frozen-lockfile > "$L/frozen.log" 2>&1 ; echo "frozen exit=$?" | tee -a "$L/exits.txt"    # frozen exit=0
git add pnpm-lock.yaml
```

If `install exit` is not 0 and `install.log` contains `ERR_PNPM_NO_OFFLINE`, run the install once with `--prefer-offline` instead of `--offline`. If that exit is not 0, stop. If the numstat, the hunk count, or the hash is different, stop and report `git diff -- pnpm-lock.yaml`.

The hunk replaces the line `  deepwidgets/probe: {}` with a `devDependencies` block of five entries. These are `@deepseek-ai/cordis` (`workspace:~`), `@deepseek-ai/dsh-client-ui-layout`, `@deepseek-ai/dsh-client-ui-renderer`, `@deepseek-ai/dsh-host-webserver` (each `workspace:*`), and `react` (`18.3.1`).

### Build `ts.probe.steps.build`

```bash
corepack pnpm run build:artifacts > "$L/artifacts.log" 2>&1 ; echo "artifacts exit=$?" | tee -a "$L/exits.txt"   # artifacts exit=0
grep -c 'run-gates: 8 passed, 0 failed' "$L/artifacts.log"                                                      # 1
ls deepwidgets/probe/lib/index.js deepwidgets/probe/lib/client.js deepwidgets/probe/lib/types/index.js deepwidgets/probe/lib/types/index.d.ts deepwidgets/probe/lib/types/client/index.js deepwidgets/probe/lib/types/client/Probe.js > /dev/null ; echo "lib exit=$?" | tee -a "$L/exits.txt"   # lib exit=0
grep -cE "[\"']/api/probe[\"']" deepwidgets/probe/lib/index.js                                                   # 1
grep -c '^import ' deepwidgets/probe/lib/index.js                                                               # 0
head -1 deepwidgets/probe/lib/client.js                                                                         # window.__ModuleLoader__.load({
grep -c 'id: "@deepwidgets/probe",' deepwidgets/probe/lib/client.js                                             # 1
corepack pnpm --filter @deepseek-ai/dsh-desktop run build > "$L/desktop.log" 2>&1 ; echo "desktop exit=$?" | tee -a "$L/exits.txt"   # desktop exit=0
git status --short --untracked-files=all | grep -c '^??'                                                        # 0
```

If `artifacts exit` is not 0, stop and report `grep -n 'error TS' "$L/artifacts.log" | head -40`. If another output is different, stop and report it. The last line proves that Git ignores the build output. Do not add a path to `.gitignore`.

### Fill in `CLAUDE.md` `ts.probe.steps.head`

The move makes three rows of `CLAUDE.md` wrong (`ts_move.stale_text`). The block changes these rows, and the date in the `head.status` header. It changes nothing else.

```bash
python3 - <<'EOF'
import datetime, pathlib
p = pathlib.Path('CLAUDE.md'); s = p.read_text()
for old, new in (
    ('| `docs/specs/` | `fork-trim.md` (spec `fork_trim`), `floating-widget.md` (spec `floating_widget`) |', '| `docs/specs/` | `fork-trim.md` (spec `fork_trim`), `floating-widget.md` (spec `floating_widget`), `ts-move.md` (spec `ts_move`) |'),
    ('| `deepwidgets/` | The `@deepwidgets/*` packages, in plain JavaScript. A widget bundle, such as `probe`, has a host half and a client half. |', '| `deepwidgets/` | The `@deepwidgets/*` packages. `probe` is in TypeScript. `build:artifacts` compiles it into `lib/`, and the app loads `lib/` (spec `ts_move`). `trace` is in plain JavaScript. A widget bundle, such as `probe`, has a host half and a client half. |'),
    ('| Our packages | `deepwidgets/probe` (merged). `deepwidgets/trace` (host half, client half, and trace window merged). `deepwidgets/trim` (merged). |', '| Our packages | `deepwidgets/probe` (merged, TypeScript). `deepwidgets/trace` (host half, client half, and trace window merged, plain JavaScript). `deepwidgets/trim` (merged, no code). |'),
    ('| Item | State on 2026-10-28 |', '| Item | State on ' + datetime.date.today().isoformat() + ' |'),
):
    assert s.count(old) == 1, old
    s = s.replace(old, new)
p.write_text(s)
EOF
echo "head exit=$?" | tee -a "$L/exits.txt"     # head exit=0
git diff --numstat -- CLAUDE.md | tr '\t' ' '   # 3 3 CLAUDE.md, or 4 4 CLAUDE.md when the date changed
git add CLAUDE.md
```

If `head exit` is not 0 or the numstat is different, stop and report it.

## Run the checks `ts.probe.check`

Run each command from the worktree root, one at a time. Each comment gives the expected output. The first block holds the checks that must fail on purpose. They prove that the checks can fail. Each smoke run that must fail takes about five minutes, because the test tries again until its deadline.

```bash
printf '%s\n' "export const spikeTypeError: number = 'not a number'" >> deepwidgets/probe/src/index.ts
corepack pnpm run build:artifacts > "$L/type-artifacts.log" 2>&1 ; echo "type artifacts exit=$?" | tee -a "$L/exits.txt"   # type artifacts exit=1
grep -c 'deepwidgets/probe/src/index.ts.*error TS2322' "$L/type-artifacts.log"                                             # 1
corepack pnpm run typecheck > "$L/type-typecheck.log" 2>&1 ; echo "type typecheck exit=$?" | tee -a "$L/exits.txt"          # type typecheck exit=1
grep -c 'FAILED host compiler' "$L/type-typecheck.log"                                                                     # 2
git checkout -- deepwidgets/probe/src/index.ts && shasum -a 256 -c "$T/probe.sha256" > "$L/hash2.log" 2>&1 ; echo "restore exit=$?" | tee -a "$L/exits.txt"   # restore exit=0
corepack pnpm run build:artifacts > "$L/artifacts2.log" 2>&1 ; echo "artifacts again exit=$?" | tee -a "$L/exits.txt"       # artifacts again exit=0
mv deepwidgets/probe/lib/index.js "$T/index.js.saved"
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs > "$L/lib-missing.log" 2>&1 ; echo "lib missing exit=$?" | tee -a "$L/exits.txt"   # lib missing exit=1
mv "$T/index.js.saved" deepwidgets/probe/lib/index.js ; echo "lib restore exit=$?" | tee -a "$L/exits.txt"                  # lib restore exit=0
DSH_SMOKE_PROBE=1 DEEPWIDGETS_PROBE=off node tools/smoke-desktop.mjs > "$L/probe-off.log" 2>&1 ; echo "probe off exit=$?" | tee -a "$L/exits.txt"   # probe off exit=1
DSH_SMOKE_TRACE=1 DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs > "$L/trace-off.log" 2>&1 ; echo "trace off exit=$?" | tee -a "$L/exits.txt"   # trace off exit=1
grep -h '^smoke-desktop: ' "$L/lib-missing.log" "$L/probe-off.log" "$L/trace-off.log"
```

The last line must print three lines, in this order: `smoke-desktop: fail: probe text: missing` two times, then `smoke-desktop: fail: trace: status 404`. If a restore exit is not 0, stop. If a command that must fail exits 0, stop and report it, because that check cannot fail.

Then run the checks that must pass.

```bash
node tools/smoke-desktop.mjs > "$L/smoke.log" 2>&1 ; echo "smoke exit=$?" | tee -a "$L/exits.txt"                                        # smoke exit=0
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs > "$L/probe.log" 2>&1 ; echo "probe exit=$?" | tee -a "$L/exits.txt"                      # probe exit=0
DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs > "$L/rows.log" 2>&1 ; echo "rows exit=$?" | tee -a "$L/exits.txt"   # rows exit=0
DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs > "$L/trace.log" 2>&1 ; echo "trace exit=$?" | tee -a "$L/exits.txt"                      # trace exit=0
DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs > "$L/hello.log" 2>&1 ; echo "hello exit=$?" | tee -a "$L/exits.txt"                      # hello exit=0
node tools/trace-late-row.mjs > "$L/late-row.log" 2>&1 ; echo "late row exit=$?" | tee -a "$L/exits.txt"                                 # late row exit=0
node tools/trace-client-rows.mjs > "$L/client-rows.log" 2>&1 ; echo "client rows exit=$?" | tee -a "$L/exits.txt"                        # client rows exit=0
grep -h -E '^(smoke-desktop|trace-late-row|trace-client-rows): ' "$L"/smoke.log "$L"/probe.log "$L"/rows.log "$L"/trace.log "$L"/hello.log "$L"/late-row.log "$L"/client-rows.log
corepack pnpm run typecheck > "$L/typecheck.log" 2>&1 ; echo "typecheck exit=$?" | tee -a "$L/exits.txt"                                  # typecheck exit=0
grep -c 'run-gates: 5 passed, 0 failed' "$L/typecheck.log"                                                                              # 1
corepack pnpm run constraints > "$L/constraints.log" 2>&1 ; echo "constraints exit=$?" | tee -a "$L/exits.txt"                            # constraints exit=0
corepack pnpm run verify-tsconfig-paths > "$L/paths.log" 2>&1 ; echo "paths exit=$?" | tee -a "$L/exits.txt"                              # paths exit=0
corepack pnpm exec vitest run scripts/build.spec.ts scripts/client-tsconfig.spec.ts scripts/request-input-types.spec.ts scripts/oxlint-contract.spec.ts apps/desktop/tests/prepare-runtime-patches.spec.ts packages/subagent/subagent-claude-code/tests/subagent-claude-code.spec.ts packages/subagent/subagent-codex/tests/subagent-codex.spec.ts > "$L/tests.log" 2>&1 ; echo "tests exit=$?" | tee -a "$L/exits.txt"   # the same exit as base tests exit
grep -E '^ *(Test Files|Tests) ' "$L/tests.log" | diff "$T/base-tests.txt" - ; echo "tests diff exit=$?" | tee -a "$L/exits.txt"          # tests diff exit=0
git diff --exit-code "$BASE" -- deepwidgets/probe/cordis.patch.yml deepwidgets/trace deepwidgets/trim ; echo "keep exit=$?" | tee -a "$L/exits.txt"   # keep exit=0
git grep -c deepwidgets-trim -- tsdown.config.ts                                                                                       # tsdown.config.ts:1
```

The `grep -h` line must print seven lines, in this order: `smoke-desktop: pass` five times, then `trace-late-row: pass` and `trace-client-rows: pass`. The install and build lines of `head.commands` ran in `ts.probe.steps`. The line `corepack pnpm run start:desktop` is not a check, because it runs the app until you quit it. The `keep` line covers each file that `ts_move.keep` names. If a check does not give its expected output, use `tasks.protocol.stop`.

## Findings to record `ts.probe.findings`

Put these items in the `Findings` section of the PR body. Write "unknown" when you did not find out.

| Item | Source |
|---|---|
| Node version, and the use of the Electron fallback | `node --version`, `ts.probe.steps.base` |
| The time of the install and of each build command | your shell |
| The base test lines and `base tests exit` | `$T/base-tests.txt`, `$L/exits.txt` |
| The smoke log folder of the probe test | `ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* \| head -1`, directly after that run |
| Each case of `handoff2.reviewer.failure_cases` in `handoff-ts-trim.md` that the change can cause | your review of the diff |
| One line for `tasks.protocol.look_before_you_build` | This task uses the reviewed spike files and the DSH build. It adds no package. |

## Files you may change `ts.probe.files`

| File | Part |
|---|---|
| `deepwidgets/probe/index.js`, `deepwidgets/probe/client.js` | delete |
| `deepwidgets/probe/package.json` | the full text of `ts.probe.steps.files` |
| `deepwidgets/probe/src/index.ts`, `src/client/index.ts`, `src/client/Probe.tsx`, `tsconfig.json`, `tsconfig.host.json`, `tsconfig.client.json`, `tsdown.config.ts` | new, the text of `ts.probe.steps.files` |
| root `tsdown.config.ts` | only the `packages` line, which becomes three lines (`ts.probe.steps.root`) |
| root `tsconfig.host.json`, root `tsconfig.client.json` | only one new reference line in each |
| `pnpm-workspace.yaml` | only the comment line above `- deepwidgets/*` |
| `pnpm-lock.yaml` | only the hunk of `ts.probe.steps.install` |
| `CLAUDE.md` | only the `head.map` row `docs/specs/`, the `head.map` row `deepwidgets/`, the `head.status` row `Our packages`, and the date in the `head.status` header |

Do not change another file. This includes `deepwidgets/probe/cordis.patch.yml`, each file in `deepwidgets/trace/` and `deepwidgets/trim/`, and `tools/`. Write each other change to `CLAUDE.md` under `Findings` (`head.rules`).

## Done when `ts.probe.done`

Each check gives its expected output, and `$L/exits.txt` has each exit record. `git status --short` shows only the paths in `ts.probe.files`. Commit only after the checks. If `git commit` exits 128 because it cannot find `git-sign-nostr`, use the form in `handoff2.rules`. Open the PR against `main` with the title `ts.probe: move the probe to TypeScript`. Put the full `$L/exits.txt` in its `Check` section.
