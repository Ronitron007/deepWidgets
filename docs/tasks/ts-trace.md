# Task `ts.trace`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `ts.trace.goal`

Move `@deepwidgets/trace` from plain JavaScript to TypeScript, and add it to the DSH build and the DSH type check. The spec is `docs/specs/ts-move.md` (spec `ts_move`). The plan row is `ts.trace` in `docs/plans/ts-move.md`. The move changes the source form and the build, but not what the app does (`ts_move.keep`). Each file in this task is final. A hash check proves each byte.

| Term | Meaning |
|---|---|
| trace test, probe test, rows check | `DSH_SMOKE_TRACE=1`, `DSH_SMOKE_PROBE=1`, and `DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim`, each with `node tools/smoke-desktop.mjs` |
| off run | The trace test with `DEEPWIDGETS_TRACE=off`, or the probe test with `DEEPWIDGETS_PROBE=off`. It must fail. |
| spike | `spike.ts_trace`. It ran the files of this task on `aba2f918`. Its review is `~/.buzz/RESEARCH/DEEPWIDGETS_TS_TRACE_SPIKE_REVIEW_20261028/REVIEW.md`. |
| record | One line `<name> exit=<code> <last log line>` in `$L/exits.txt`. The shell function `rec` writes it. |

## Setup `ts.trace.setup`

| Item | Value |
|---|---|
| Base | `origin/main`. It must contain `aba2f9186fdd11b4186b2b605f2757a1c28da971`. After that commit, only files under `docs/` can change. |
| Branch | `rohan/ts-trace` (new) |
| Worktree | `~/deepWidgets/.worktrees/rohan-ts-trace` |
| Temporary files | `$TMPDIR/deepwidgets-ts-trace/`, with the logs in its folder `logs/` |
| Machine | this Mac, with a display. The smoke runs open app windows. |

At the start of `ts.trace.part.base`, run this block once. It writes the file `env.sh`. The function `rec <name> <command>` runs the command and writes its output to `$L/<name>.log`. It also adds the command to `$L/commands.txt` and the record to `$L/exits.txt`.

```bash
mkdir -p "$TMPDIR/deepwidgets-ts-trace/logs" && cat > "$TMPDIR/deepwidgets-ts-trace/env.sh" <<'EOF'
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 BASE=aba2f9186fdd11b4186b2b605f2757a1c28da971 R="$HOME/deepWidgets"
export W="$R/.worktrees/rohan-ts-trace" T="$TMPDIR/deepwidgets-ts-trace" L="$TMPDIR/deepwidgets-ts-trace/logs"
rec() { n=$1; shift; printf '%s: %s\n' "$n" "$*" >> "$L/commands.txt"; "$@" > "$L/$n.log" 2>&1; c=$?; echo "$n exit=$c $(tail -n 1 "$L/$n.log")" | tee -a "$L/exits.txt"; }
if [ -d "$W" ]; then cd "$W"; fi
EOF
```

Start each new shell with `. "$TMPDIR/deepwidgets-ts-trace/env.sh"`. Run each command from the worktree root, one at a time. If a record is different and the task gives no other action, use `tasks.protocol.stop`.

The comment after a command gives its expected record. When the comment has no text after `exit=<code>`, each last log line is correct. A word in angle brackets stands for the value that it names, and `<empty>` is an empty log. A comment that starts with `if` gives a condition. Run that command only when the condition is true.

## Read first `ts.trace.read`

Read `ts_move.layout`, `ts_move.layout.source`, `ts_move.page`, `ts_move.tools`, `ts_move.keep`, and `ts_move.stale_text` in the spec. Read `deepwidgets/trace/index.js` and `deepwidgets/trace/client.js` at the base. The architect checked each fact below. If a fact is false, stop and report.

| Fact | Evidence |
|---|---|
| The `files` script of `ts.trace.steps.files` writes the 11 spike files, byte for byte, from the base trace and probe files. The 11 hashes in that step are the hashes of the staged spike files. The two `src/` files have 462 lines. Thus the script gives each new text as an exact edit, and the hash check proves the result. | verified (ran the blocks of `ts.trace.steps.files` and `ts.trace.steps.head` on a Git copy of the base, in zsh and in bash. Each record was as expected. Ran `wc -l`.) |
| The new source keeps each function, branch, string, and value. The string literals differ only in the page path `../page.html`, the four type-only import names, and the client id. The helper `clientBundle` stamps the client id from `package.json` (`packages/client/tsdown.client.ts` line 931). | verified (ran a script that compares the string literals) |
| In the spike, 100 of 101 records were ok. The bad record counted the staged paths without `--no-renames`. Then Git shows `index.js` to `src/index.ts` as one rename, and the count is 12, not 13. The spike did not run `probe_off` or the `CLAUDE.md` step. In the PR 35 review, `probe_off` gave `smoke-desktop: fail: probe text: missing` and exit 1 in 241 seconds on this Mac. | verified (`review.ts_trace.verdict`, `review.ts_trace.staged_count`). Verified (read `~/.buzz/RESEARCH/DEEPWIDGETS_PR35_REVIEW_20261028/EXITS.jsonl` and `probe-off.log`). |
| The base and the head of the spike have the same three failed tests, in `scripts/build.spec.ts`, `scripts/oxlint-contract.spec.ts`, and `apps/desktop/tests/desktop-publish-local-preflight.spec.ts`. No passed test was lost. | verified (spike, reviewed) |
| No test file imports a trace file or a trace tool. Two desktop tests name `deepwidgets`, but they mock `apps/desktop/src/deepwidgets-trace.ts`, which this task does not change. The test paths are the paths of the spike. | verified (ran `git grep`, read both tests) |
| The root `tsdown.config.ts` and `pnpm-workspace.yaml` need no change. The glob `deepwidgets/*/tsdown.config.ts` of `ts.probe` also builds the trace. | verified (read, and spike `build.artifacts`) |
| A fresh worktree has no Electron binary. The spike used the fallback of `ts.trace.steps.base`. | verified (spike `base.electron` exit 1, reviewed) |
| A worktree with changes adds the public value `DSH_CLIENT_GIT_DIRTY` to the build. Thus `build:artifacts` gives 2 public values on the base and 3 on the head. | verified (read `scripts/client-build-environment.ts` lines 119-133, and the spike logs) |
| To delete `index.js` and `client.js` is not a trim, because the code moves to `src/`. The two new reference lines comment out no line. Thus they need no marker (`head.trim`). | verified (read `ts_move.layout` and `CLAUDE.md`) |

## Parts `ts.trace.parts`

The worker session stops about 15 minutes after each wake. Thus run one part in one wake, and start it at the start of the wake. The times come from the spike records and the PR 35 review records on this Mac. Each part takes less than 12 minutes.

| Part | Blocks | Measured time |
|---|---|---|
| `ts.trace.part.base` | `ts.trace.setup`, `ts.trace.steps.base` | 3.5 min (build 101 s, tests 32 s) |
| `ts.trace.part.change` | `ts.trace.steps.files` to `ts.trace.steps.head`, then `ts.trace.check.gates` | 3.3 min (build 32 s, `typecheck` 68 s, tests 29 s) |
| `ts.trace.part.checks` | `ts.trace.check.fail`, then `ts.trace.check.pass` | 6.8 min (three builds and one `typecheck` 75 s, five smoke runs 268 s). A smoke run that fails adds about 3 min. |
| `ts.trace.part.off` | `ts.trace.check.off` | 8.0 min (two off runs, 241 s each) |
| `ts.trace.part.pr` | `ts.trace.done` | 2 min (a guess) |

The first and the last record of each part are `<part>_start` and `<part>_end`. If a wake stops in a part, run that part again in the next wake. First run its `_idle` command again, when it has one. Then run each command that has no record. Skip a command when its `if` condition is false.

## Steps `ts.trace.steps`

### Base state `ts.trace.steps.base`

```bash
rec base_start date -u +%T
rec fetch git -C "$R" fetch origin                                                       # fetch exit=0
rec base git -C "$R" merge-base --is-ancestor "$BASE" origin/main                        # base exit=0
rec docs_only sh -c 'git -C "$R" diff --name-only "$BASE" origin/main | grep -cv "^docs/"'   # docs_only exit=1 0
rec branch git -C "$R" rev-parse --verify --quiet refs/heads/rohan/ts-trace              # branch exit=1
rec remote git -C "$R" ls-remote --exit-code --heads origin rohan/ts-trace               # remote exit=2
rec worktree git -C "$R" worktree add -b rohan/ts-trace .worktrees/rohan-ts-trace origin/main   # worktree exit=0 HEAD is now at <sha> <subject>
cd "$W"
rec node node --version                                                                  # node exit=0 v22.23.0
rec pnpm corepack pnpm --version                                                         # pnpm exit=0 11.28.5
rec base_install corepack pnpm install --frozen-lockfile                                 # base_install exit=0 Done in <time> using pnpm v11.28.5
rec electron ls apps/desktop/node_modules/electron/dist                                  # electron exit=<any>
rec electron_install node apps/desktop/node_modules/electron/install.js                  # if electron exit is not 0: electron_install exit=0
rec electron_again ls apps/desktop/node_modules/electron/dist                            # if electron exit is not 0: electron_again exit=0
rec hooks_path git config --get core.hooksPath                                           # hooks_path exit=1
rec hooks_common sh -c 'test ! -e "$(git rev-parse --git-common-dir)/dsh-hooks"'         # hooks_common exit=0
rec hooks_worktree sh -c 'test ! -e "$(git rev-parse --git-dir)/dsh-hooks"'              # hooks_worktree exit=0
rec hooks_files sh -c 'find "$(git rev-parse --git-common-dir)/hooks" -type f ! -name "*.sample"'   # hooks_files exit=0 <empty>
rec hooks_prepare sh -c 'test ! -e "$(git rev-parse --git-common-dir)/hooks/prepare-commit-msg"'   # hooks_prepare exit=0
rec hooks_lefthook test ! -e lefthook.yml                                                # hooks_lefthook exit=0
rec base_artifacts corepack pnpm run build:artifacts                                     # base_artifacts exit=0 build: recorded 358 client artifact(s) with 2 public value(s)
rec base_gates grep -c 'run-gates: 8 passed, 0 failed' "$L/base_artifacts.log"           # base_gates exit=0 1
rec base_tests corepack pnpm exec vitest run scripts/build.spec.ts scripts/client-tsconfig.spec.ts scripts/request-input-types.spec.ts scripts/oxlint-contract.spec.ts apps/desktop/tests packages/subagent/subagent-claude-code/tests/subagent-claude-code.spec.ts packages/subagent/subagent-codex/tests/subagent-codex.spec.ts --reporter=default --reporter=json --outputFile.json="$T/base-tests.json"   # base_tests exit=<any>
rec base_names python3 -I -c 'import json, sys; r = json.load(open(sys.argv[1])); open(sys.argv[2], "w").write("".join(line + "\n" for line in sorted(a["status"] + " " + f["name"] + " > " + a["fullName"] for f in r["testResults"] for a in f["assertionResults"])))' "$T/base-tests.json" "$T/base-tests.txt"   # base_names exit=0
rec base_passed grep -c '^passed ' "$T/base-tests.txt"                                   # base_passed exit=0 1988
rec base_end date -u +%T
```

The spike gave `electron exit=1`. The lines `electron_install` and `electron_again` are the Electron fallback of `ts.probe.steps.base`. If a fallback record is different, stop. Do not try another fix. The hook records prove that no Git hook is on (`fork.baseline.steps.install`).

Two records do not stop the part when they are different. For `node`, write the version under `Findings`. For `base_passed`, write the count under `Findings`. If the count is `0`, stop and report the last 40 lines of `$L/base_tests.log`. The spike gave `base_tests exit=1`, with three failed tests. `ts.trace.check.gates` compares each test by its name.

### Write the trace files `ts.trace.steps.files`

Start `ts.trace.part.change` here. The `files` script reads the base `index.js`, the base `client.js`, and the merged probe files. Then it writes the 11 files. Each `edit` replaces one text that occurs exactly once, and each new text is literal. The client body is lines 4 to 134 of `client.js`, without the 4 spaces of the factory indent.

```bash
rec change_start date -u +%T
rec files python3 -I - <<'EOF'                                                           # files exit=0
import json, pathlib, re, shutil
d, p = pathlib.Path('deepwidgets/trace'), pathlib.Path('deepwidgets/probe')
def edit(s, pairs):
    for old, new in pairs:
        assert s.count(old) == 1, old
        s = s.replace(old, new)
    return s
def iface(name, doc, fields):  # one TypeScript interface: one field on each line, then one blank line
    return f'/** {doc} */\ninterface {name} {{\n' + ''.join(f'  {field}\n' for field in fields.split('; ')) + '}\n\n'
TYPED = [  # (base signature, typed signature), the same in both halves
    ('function rowKey(entry) {', 'function rowKey(entry: Entry): string {'),
    ('function pluginDetail(entry, fiber) {', 'function pluginDetail(entry: Entry, fiber: Fiber): string {'),
    ('function addPlugin(entry, fiber, snapshot) {', 'function addPlugin(entry: Entry, fiber: Fiber, snapshot: boolean): void {'),
    ('function addService(name, state, snapshot) {', 'function addService(name: string, state: string, snapshot: boolean): void {'),
    ('function rescan() {', 'function rescan(): void {'),
    ('  const seen = new WeakSet()\n  const serviceState = new Map()\n', '  const seen = new WeakSet<Fiber>()\n  const serviceState = new Map<string, string>()\n'),
]
HOST = ('''/** Host half of the trace: it keeps the trace messages and serves them on `/api/trace` and `/trace`. */
import { readFileSync } from 'node:fs'
import type { Context, Fiber } from '@deepseek-ai/cordis'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-host-webserver'

''' + iface('MessageFields', 'Fields of one new trace message, before the host gives it a `seq`.', 'time: number; process: string; '
            'window?: string | undefined; kind: string; name: string; state: string | undefined; detail?: string | undefined; snapshot?: boolean | undefined')
    + iface('TraceMessage', 'One trace message. `addMessage` writes the fields in the order of this type.', 'seq: number; time: number; process: string; '
            'window?: string | undefined; kind?: string; name?: string; state?: string | undefined; detail?: string; snapshot?: true')
    + iface('PostedMessage', 'One item of a `POST /api/trace` body that `goodMessage` accepts.',
            'time: number; process: string; window?: string; kind: string; name: string; state: string; detail?: string; snapshot?: boolean')
    + iface('OpenStream', 'One open `GET /api/trace` stream.', 'timer: NodeJS.Timeout | undefined; '
            'controller: ReadableStreamDefaultController<Uint8Array> | undefined; send(frame: Uint8Array): void; close(): void'))
host = edit((d / 'index.js').read_text(), TYPED + [
    ("import { readFileSync } from 'node:fs'\n\n", HOST),
    ("'./page.html'", "'../page.html'"),
    ('export const inject', '/** Services the trace needs. */\nexport const inject'),
    ('export function apply(ctx) {\n  const messages = []\n  const streams = new Set()\n',
     '/**\n * Trace the host rows and services, and serve the trace routes for the lifetime of the plugin.\n'
     ' * @param ctx - host plugin context carrying the web server, the connection, and the loader.\n */\n'
     'export function apply(ctx: Context): void {\n  const messages: TraceMessage[] = []\n  const streams = new Set<OpenStream>()\n'),
    ('function broadcast(message) {', 'function broadcast(message: TraceMessage): void {'),
    ('function addMessage(fields) {\n    const message = {', 'function addMessage(fields: MessageFields): TraceMessage {\n    const message: TraceMessage = {'),
    ('function goodMessage(item) {\n    if (item === null || typeof item !== \'object\' || Array.isArray(item)) return false\n',
     'function goodMessage(value: unknown): boolean {\n    if (value === null || typeof value !== \'object\' || Array.isArray(value)) return false\n'
     '    const item = value as Record<string, unknown>\n'),
    ('STATES.includes(item.state)', 'STATES.includes(item.state as string)'),
    ('async function receive(request) {\n    let body\n', 'async function receive(request: Request): Promise<Response> {\n    let body: unknown\n'),
    ('for (const item of body) {', 'for (const item of body as PostedMessage[]) {'),
    ('function openStream(request) {', 'function openStream(request: Request): Response {'),
    ('const open = {', 'const open: OpenStream = {'),
    ('new ReadableStream({', 'new ReadableStream<Uint8Array>({'),
    ('const sendText = (text) => {', 'const sendText = (text: string): void => {'),
])
CLIENT = ('''/** Client half of the trace: it sends the rows and services of one window to `POST api/trace`. */
import type { Context, Fiber } from '@deepseek-ai/cordis'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'

''' + iface('MessageFields', 'Fields of one new client message.', 'kind: string; name: string; state: string | undefined; detail?: string; snapshot?: boolean')
      + iface('ClientMessage', 'One client message. `addMessage` writes the fields in the order of this type.',
              'time: number; process: string; window: string; kind: string; name: string; state: string | undefined; detail?: string; snapshot?: true'))
lines = (d / 'client.js').read_text().split('\n')[3:134]  # STATES to the end of apply
body = '\n'.join(re.sub(r'^    ', '', line) for line in lines) + '\n'
client = edit(body, TYPED + [
    ('function apply(ctx) {\n', '/** Services the trace needs. */\nexport const inject = [\'loader\']\n\n/**\n'
     ' * Trace the client rows and services of this window, and send them to the host.\n'
     ' * @param ctx - client plugin context carrying the loader.\n */\nexport function apply(ctx: Context): void {\n'),
    ('  const queue = []\n', '  const queue: ClientMessage[] = []\n'),
    ('function flush() {', 'function flush(): void {'),
    ('function sendLater() {', 'function sendLater(): void {'),
    ('function addMessage(fields) {\n    const message = {', 'function addMessage(fields: MessageFields): void {\n    const message: ClientMessage = {'),
])
(d / 'src/client').mkdir(parents=True)
(d / 'src/index.ts').write_text(host)
(d / 'src/client/index.ts').write_text(CLIENT + client)
(d / 'package.json').write_text(edit((p / 'package.json').read_text(), [
    ('"@deepwidgets/probe"', '"@deepwidgets/trace"'),
    ('"lib/types/**/*.d.ts"\n', '"lib/types/**/*.d.ts",\n    "page.html"\n'),
    ('    "@deepseek-ai/dsh-client-ui-layout": "workspace:*",\n    "@deepseek-ai/dsh-client-ui-renderer": "workspace:*",\n',
     '    "@deepseek-ai/cordis-plugin-loader": "workspace:~",\n    "@deepseek-ai/dsh-client-connection": "workspace:*",\n'),
    ('"workspace:*",\n    "react": "^18.2.0"\n', '"workspace:*"\n'),
    ('"immediately": true,\n      "inject": ["@deepseek-ai/dsh-client-ui-layout"]\n', '"immediately": true\n'),
]))
for name in ('tsconfig.json', 'tsdown.config.ts'):
    shutil.copy(p / name, d / name)
for face, refs in (('host', ['vendor/cordis', 'vendor/loader', 'packages/host/webserver', 'packages/client/connection/tsconfig.host.json']),
                   ('client', ['vendor/cordis', 'vendor/loader'])):
    config = json.loads((p / f'tsconfig.{face}.json').read_text())
    config['references'] = [{'path': '../../' + ref} for ref in refs]
    (d / f'tsconfig.{face}.json').write_text(json.dumps(config, indent=2) + '\n')
    old, root = f'    {{ "path": "./deepwidgets/probe/tsconfig.{face}.json" }},\n', pathlib.Path(f'tsconfig.{face}.json')
    root.write_text(edit(root.read_text(), [(old, old + old.replace('probe', 'trace'))]))
for tool, names in (('tools/trace-late-row.mjs', ['index']), ('tools/trace-client-rows.mjs', ['index', 'client'])):
    path = pathlib.Path(tool)
    path.write_text(edit(path.read_text(), [(f"'../deepwidgets/trace/{n}.js'", f"'../deepwidgets/trace/lib/{n}.js'") for n in names]))
EOF
rec rm git rm -q deepwidgets/trace/index.js deepwidgets/trace/client.js                  # rm exit=0
rec add git add deepwidgets/trace tsconfig.host.json tsconfig.client.json tools/trace-late-row.mjs tools/trace-client-rows.mjs   # add exit=0
rec sums tee "$T/trace.sha256" <<'EOF'                                                   # sums exit=0 18dfebdcd609a7de1def32199d13aec16e4dd8326f8ea0474f446af6ebc111f3  tsconfig.host.json
45d0b11cf9ba3bf917d4def21afffabe6694aba22579ddac8c0ec0dd687f08f9  deepwidgets/trace/package.json
2911ac4d54cb215d20726d461b4ea25f1141f2b35e8e01ff1cf547574400983f  deepwidgets/trace/src/client/index.ts
59b91749cf6d982da6d2f67654994b89735b414da3d04a29fa6553fb33432a63  deepwidgets/trace/src/index.ts
f665c83a0a6d7ea37b8af2a061b55b13aa6eee05f0c07db19e7d53277e4f07f7  deepwidgets/trace/tsconfig.client.json
6d2c59b11150e8677b23cf33f1b094624272875403536500c55d57d8f6168005  deepwidgets/trace/tsconfig.host.json
ad1b25d36ea100440140e543e2a2af188178934da74eadce1b27ef14e91b335e  deepwidgets/trace/tsconfig.json
fff436c5e4aeb7fe12d1cecd9542ad8639d7833e644b8bb1b04d844925850fd1  deepwidgets/trace/tsdown.config.ts
8c06b7192d213b5dafbbbafe91935ad9eec304cc99239683a8ce220fb061a3ba  tools/trace-client-rows.mjs
617a547300e4d6128454198b2ae02beb04bcfc626825d3ab32d3eaef3f5dbc5e  tools/trace-late-row.mjs
3e834a3d88f3785592afd5d0d005a4cdd9d076e1caaa49c05993a04a05190e36  tsconfig.client.json
18dfebdcd609a7de1def32199d13aec16e4dd8326f8ea0474f446af6ebc111f3  tsconfig.host.json
EOF
rec hash shasum -a 256 -c "$T/trace.sha256"                                              # hash exit=0 tsconfig.host.json: OK
rec paths sh -c 'git diff --cached --no-renames --name-status | wc -l | tr -d " "'       # paths exit=0 13
```

If `files` exit is not 0, the last line of `$L/files.log` names the edit that did not match. If `hash` exit is not 0, `$L/hash.log` names each bad file with `FAILED`. In each case, stop and report.

### Install and build `ts.trace.steps.build`

```bash
rec install corepack pnpm install --offline                                              # install exit=0 Done in <time> using pnpm v11.28.5
rec install_online corepack pnpm install --prefer-offline                                # if install.log has ERR_PNPM_NO_OFFLINE: install_online exit=0
rec lock_numstat sh -c 'git diff --numstat -- pnpm-lock.yaml | tr "\t" " "'              # lock_numstat exit=0 14 1 pnpm-lock.yaml
rec lock_hunks sh -c 'git diff -U0 -- pnpm-lock.yaml | grep -c "^@@"'                    # lock_hunks exit=0 1
rec lock_hash shasum -a 256 pnpm-lock.yaml                                               # lock_hash exit=0 9257e2e417c743ef5baa95424958aa1b53ecce4a91992a415912bd0c342ab136  pnpm-lock.yaml
rec frozen corepack pnpm install --frozen-lockfile                                       # frozen exit=0 Done in <time> using pnpm v11.28.5
rec lock_add git add pnpm-lock.yaml                                                      # lock_add exit=0
rec artifacts corepack pnpm run build:artifacts                                          # artifacts exit=0 build: recorded 358 client artifact(s) with 3 public value(s)
rec gates grep -c 'run-gates: 8 passed, 0 failed' "$L/artifacts.log"                     # gates exit=0 1
rec lib ls deepwidgets/trace/lib/index.js deepwidgets/trace/lib/client.js deepwidgets/trace/lib/types/index.js deepwidgets/trace/lib/types/index.d.ts deepwidgets/trace/lib/types/client/index.js deepwidgets/trace/lib/types/client/index.d.ts   # lib exit=0
rec host_import grep -c '^import ' deepwidgets/trace/lib/index.js                        # host_import exit=0 1
rec host_fs grep -c '^import { readFileSync } from "node:fs";$' deepwidgets/trace/lib/index.js   # host_fs exit=0 1
rec host_page grep -cE "new URL\(['\"]\.\./page\.html['\"], import\.meta\.url\)" deepwidgets/trace/lib/index.js   # host_page exit=0 1
rec host_routes grep -cE "[\"'](/api/trace|/trace)[\"']" deepwidgets/trace/lib/index.js   # host_routes exit=0 2
rec host_labels grep -c 'deepwidgets-trace: ' deepwidgets/trace/lib/index.js             # host_labels exit=0 5
rec client_head head -1 deepwidgets/trace/lib/client.js                                  # client_head exit=0 window.__ModuleLoader__.load({
rec client_id grep -c 'id: "@deepwidgets/trace",' deepwidgets/trace/lib/client.js        # client_id exit=0 1
rec client_require grep -c 'require(' deepwidgets/trace/lib/client.js                    # client_require exit=1 0
rec client_labels grep -c 'deepwidgets-trace: ' deepwidgets/trace/lib/client.js          # client_labels exit=0 6
rec desktop corepack pnpm --filter @deepseek-ai/dsh-desktop run build                    # desktop exit=0 ✓ built in <time>
rec untracked sh -c 'git status --short --untracked-files=all | grep -c "^??"'           # untracked exit=1 0
```

If a `lock_` record is different, stop and report `git diff -- pnpm-lock.yaml`. The hunk replaces `  deepwidgets/trace: {}` with a `devDependencies` block of the four entries of `ts_move.layout`. If `artifacts` exit is not 0, stop and report the lines of `$L/artifacts.log` that contain `error TS`.

The host bundle must read `../page.html` and import only `node:fs`. The client bundle must have the module loader form and no `require(` call (`ts_move.layout.source`). The base files have the same counts of routes (2) and labels (5 and 6). The `untracked` record proves that Git ignores the build output. Do not add a path to `.gitignore`.

### Fill in `CLAUDE.md` `ts.trace.steps.head`

The move makes two rows of `CLAUDE.md` wrong (`ts_move.stale_text`). The `head` script changes these two rows and the date in the `head.status` header. It changes nothing else. After 2026-10-28, the date also changes, and the numstat is `3 3 CLAUDE.md`.

```bash
rec head python3 -I - <<'EOF'                                                            # head exit=0
import datetime, pathlib
p = pathlib.Path('CLAUDE.md'); s = p.read_text()
for old, new in (
    ('`probe` is in TypeScript. `build:artifacts` compiles it into `lib/`, and the app loads `lib/` (spec `ts_move`). `trace` is in plain JavaScript.',
     '`probe` and `trace` are in TypeScript. `build:artifacts` compiles them into `lib/`. The app and the trace tools load `lib/` (spec `ts_move`).'),
    ('and trace window merged, plain JavaScript)', 'and trace window merged, TypeScript)'),
    ('| Item | State on 2026-10-28 |', '| Item | State on ' + datetime.date.today().isoformat() + ' |'),
):
    assert s.count(old) == 1, old
    s = s.replace(old, new)
p.write_text(s)
EOF
rec head_numstat sh -c 'git diff --numstat -- CLAUDE.md | tr "\t" " "'                  # head_numstat exit=0 2 2 CLAUDE.md
rec head_add git add CLAUDE.md                                                           # head_add exit=0
```

## Run the checks `ts.trace.check`

### Gates and tests `ts.trace.check.gates`

```bash
rec typecheck corepack pnpm run typecheck                                                # typecheck exit=0 run-gates: 5 passed, 0 failed, 0 skipped in <time>.
rec constraints corepack pnpm run constraints                                            # constraints exit=0
rec tsconfig_paths corepack pnpm run verify-tsconfig-paths                               # tsconfig_paths exit=0 gen-tsconfig-paths: tsconfig.base.json package aliases are current.
rec tests corepack pnpm exec vitest run scripts/build.spec.ts scripts/client-tsconfig.spec.ts scripts/request-input-types.spec.ts scripts/oxlint-contract.spec.ts apps/desktop/tests packages/subagent/subagent-claude-code/tests/subagent-claude-code.spec.ts packages/subagent/subagent-codex/tests/subagent-codex.spec.ts --reporter=default --reporter=json --outputFile.json="$T/tests.json"   # tests exit=<the exit of base_tests>
rec names python3 -I -c 'import json, sys; r = json.load(open(sys.argv[1])); open(sys.argv[2], "w").write("".join(line + "\n" for line in sorted(a["status"] + " " + f["name"] + " > " + a["fullName"] for f in r["testResults"] for a in f["assertionResults"])))' "$T/tests.json" "$T/tests.txt"   # names exit=0
rec lost sh -c 'grep "^passed " "$T/base-tests.txt" | LC_ALL=C sort > "$T/base-passed.txt"; grep "^passed " "$T/tests.txt" | LC_ALL=C sort > "$T/passed.txt"; LC_ALL=C comm -23 "$T/base-passed.txt" "$T/passed.txt" > "$T/lost-tests.txt"; wc -l < "$T/lost-tests.txt" | tr -d " "'   # lost exit=0 0
rec keep git diff --exit-code "$BASE" -- deepwidgets/probe deepwidgets/trace/cordis.patch.yml deepwidgets/trace/page.html deepwidgets/trim   # keep exit=0
rec change_end date -u +%T
```

`lost-tests.txt` lists each test that passed on the base and did not pass on the head. The command `comm -23` keeps the count of each test name. If `lost` is not `0`, stop, and report each test in that file with its failure text. The `keep` record covers each file that `ts_move.keep` names, and the merged probe.

### Checks that must fail `ts.trace.check.fail`

Start `ts.trace.part.checks` here. These checks prove that the checks can fail. If a command that must fail exits 0, stop and report it, because that check cannot fail. If a restore record is different, stop.

```bash
rec checks_start date -u +%T
rec checks_idle pgrep -fl 'rohan-ts-trac[e]/.*Electron'                                  # checks_idle exit=1
rec type_line tee "$T/type-error.ts" <<'EOF'                                             # type_line exit=0 export const spikeTypeError: number = 'not a number'
export const spikeTypeError: number = 'not a number'
EOF
rec host_edit sh -c 'cat "$T/type-error.ts" >> deepwidgets/trace/src/index.ts'           # host_edit exit=0
rec type_artifacts corepack pnpm run build:artifacts                                     # type_artifacts exit=1 [ELIFECYCLE] Command failed with exit code 1.
rec type_error grep -c 'deepwidgets/trace/src/index.ts(300,14): error TS2322' "$L/type_artifacts.log"   # type_error exit=0 1
rec type_typecheck corepack pnpm run typecheck                                           # type_typecheck exit=1 [ELIFECYCLE] Command failed with exit code 1.
rec type_host grep -c 'FAILED host compiler' "$L/type_typecheck.log"                    # type_host exit=0 2
rec host_restore git checkout -- deepwidgets/trace/src/index.ts                          # host_restore exit=0
rec client_edit sh -c 'cat "$T/type-error.ts" >> deepwidgets/trace/src/client/index.ts'  # client_edit exit=0
rec client_artifacts corepack pnpm run build:artifacts                                   # client_artifacts exit=1 [ELIFECYCLE] Command failed with exit code 1.
rec client_error grep -c 'deepwidgets/trace/src/client/index.ts(164,14): error TS2322' "$L/client_artifacts.log"   # client_error exit=0 1
rec client_restore git checkout -- deepwidgets/trace/src/client/index.ts                 # client_restore exit=0
rec restore_hash shasum -a 256 -c "$T/trace.sha256"                                      # restore_hash exit=0 tsconfig.host.json: OK
rec artifacts_again corepack pnpm run build:artifacts                                    # artifacts_again exit=0 build: recorded 358 client artifact(s) with 3 public value(s)
rec page_ok node --input-type=module -e 'import { relative, resolve } from "node:path"; import { pathToFileURL } from "node:url"; try { await import(pathToFileURL(resolve("deepwidgets/trace/lib/index.js")).href); console.log("import ok") } catch (error) { console.log("import failed: " + error.code + " " + relative(process.cwd(), String(error.path))); process.exit(1) }'   # page_ok exit=0 import ok
rec page_hide mv deepwidgets/trace/page.html "$T/page.html.saved"                        # page_hide exit=0
rec page_missing node --input-type=module -e 'import { relative, resolve } from "node:path"; import { pathToFileURL } from "node:url"; try { await import(pathToFileURL(resolve("deepwidgets/trace/lib/index.js")).href); console.log("import ok") } catch (error) { console.log("import failed: " + error.code + " " + relative(process.cwd(), String(error.path))); process.exit(1) }'   # page_missing exit=1 import failed: ENOENT deepwidgets/trace/page.html
rec page_restore mv "$T/page.html.saved" deepwidgets/trace/page.html                     # page_restore exit=0
rec page_same git diff --exit-code "$BASE" -- deepwidgets/trace/page.html                # page_same exit=0
```

`checks_idle` exits 1 when no app of this worktree runs. If it exits 0, stop and report. Do not stop a process. The added line is line 300 of `src/index.ts` and line 164 of `src/client/index.ts`. The spike logs gave these error lines, and two `FAILED host compiler` lines in the `typecheck` log.

### Checks that must pass `ts.trace.check.pass`

```bash
rec late_row node tools/trace-late-row.mjs                                               # late_row exit=0 trace-late-row: pass
rec client_rows node tools/trace-client-rows.mjs                                         # client_rows exit=0 trace-client-rows: pass
rec trace env DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs                             # trace exit=0 smoke-desktop: pass
rec trace_folder sh -c 'ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* | head -1'          # trace_folder exit=0
rec probe env DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs                             # probe exit=0 smoke-desktop: pass
rec rows env DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs   # rows exit=0 smoke-desktop: pass
rec smoke node tools/smoke-desktop.mjs                                                   # smoke exit=0 smoke-desktop: pass
rec hello env DSH_SMOKE_HELLO=1 node tools/smoke-desktop.mjs                             # hello exit=0 smoke-desktop: pass
rec checks_end date -u +%T
```

The task deletes `index.js` and `client.js`, and the tools import `lib/`. Thus each pass proves that the app and the tools load the built files. Stop at the first smoke run that fails, because a failed smoke run takes about 241 seconds. Report the last 40 lines of its log and the newest smoke folder. The install and build lines of `head.commands` ran in `ts.trace.steps`. The line `corepack pnpm run start:desktop` is not a check, because it runs the app until you quit it.

### Off runs `ts.trace.check.off`

```bash
rec off_start date -u +%T
rec off_idle pgrep -fl 'rohan-ts-trac[e]/.*Electron'                                     # off_idle exit=1
rec trace_off env DSH_SMOKE_TRACE=1 DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs   # trace_off exit=1 smoke-desktop: fail: trace: status 404
rec probe_off env DSH_SMOKE_PROBE=1 DEEPWIDGETS_PROBE=off node tools/smoke-desktop.mjs   # probe_off exit=1 smoke-desktop: fail: probe text: missing
rec off_end date -u +%T
```

If `off_idle` exits 0, stop and report. If an off run exits 0, stop and report it, because that check cannot fail.

## Findings to record `ts.trace.findings`

Put these items in the `Findings` section of the PR body. Write "unknown" when you did not find out.

| Item | Source |
|---|---|
| Node version, and the use of the Electron fallback | the records `node` and `electron` |
| The time of each part | the `<part>_start` and `<part>_end` records |
| Each base test that did not pass, and the `base_tests` exit | `grep -v '^passed ' "$T/base-tests.txt"`, `$L/exits.txt` |
| The smoke folder of the trace test | the record `trace_folder` |
| Each case of `handoff2.reviewer.failure_cases` in `handoff-ts-trim.md` that the change can cause | your review of the diff |
| One line for `tasks.protocol.look_before_you_build` | This task uses the reviewed spike files and the DSH build. It adds no package. |

## Files you may change `ts.trace.files`

| File | Part |
|---|---|
| `deepwidgets/trace/index.js`, `deepwidgets/trace/client.js` | delete |
| `deepwidgets/trace/package.json` | the full file from the `files` script |
| `deepwidgets/trace/src/index.ts`, `src/client/index.ts`, `tsconfig.json`, `tsconfig.host.json`, `tsconfig.client.json`, `tsdown.config.ts` | new, from the `files` script |
| root `tsconfig.host.json`, root `tsconfig.client.json` | only one new reference line in each, after the probe line |
| `tools/trace-late-row.mjs`, `tools/trace-client-rows.mjs` | only the import paths of `ts_move.tools`: line 3 of each, and line 112 of `trace-client-rows.mjs` |
| `pnpm-lock.yaml` | only the hunk of `ts.trace.steps.build` |
| `CLAUDE.md` | only the `head.map` row `deepwidgets/`, the `head.status` row `Our packages`, and the date in the `head.status` header |

Do not change another file. This includes `deepwidgets/trace/cordis.patch.yml`, `deepwidgets/trace/page.html`, each file in `deepwidgets/probe/` and `deepwidgets/trim/`, the root `tsdown.config.ts`, and `pnpm-workspace.yaml`. Write each other change to `CLAUDE.md` under `Findings` (`head.rules`).

## Done when `ts.trace.done`

Run `ts.trace.part.pr` in a new wake, after the other four parts.

```bash
rec pr_start date -u +%T
rec base_sha git rev-parse HEAD                                                          # base_sha exit=0 <full SHA of the worktree base>
rec staged sh -c 'git diff --cached --no-renames --name-status | wc -l | tr -d " "'      # staged exit=0 15
rec unstaged git diff --exit-code --stat                                                 # unstaged exit=0 <empty>
rec untracked_end sh -c 'git status --short --untracked-files=all | grep -c "^??"'       # untracked_end exit=1 0
rec pr_end date -u +%T
```

Commit only when each record in `$L/exits.txt` agrees with its comment. Use the commit message `ts.trace: move the trace to TypeScript`. If `git commit` exits 128 because it cannot find `git-sign-nostr`, use the form in `handoff2.rules`. Then push, and open the PR as `tasks.protocol.pull_request` says, with the same title. In its `Check` section, put the full `$L/commands.txt` and `$L/exits.txt`. In its `Base` section, put the SHA of the record `base_sha`.
