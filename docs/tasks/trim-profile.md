# Task `trim.profile`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `trim.profile.goal`

Add the deepWidgets trim layer. This layer turns off each Cordis row that the app does not need. The spec sections are `fork_trim.method` and `fork_trim.keep_list` in `docs/specs/fork-trim.md`. The plan row is `trim.profile` in `docs/plans/fork-trim.md`. This file replaces the version for the base `ab547c27`, before the trace units merged.

| Term | Meaning |
|---|---|
| row | One top-level entry in the composed Cordis config of the `host` Context. Each row has an `id`. |
| trim layer | The new bundle `@deepwidgets/trim`. Its `cordis.patch.yml` sets `disabled: true` on each row to turn off. |
| keep set | The rows that stay enabled. The boot test settles it. The spec keep list is only the first guess. |
| row lists | The committed files `deepwidgets/trim/rows.host.txt` and `deepwidgets/trim/rows.client.txt`. |
| rows check | A new step in the smoke check. It compares the rows that loaded in each Context with the row lists. |
| boot test | `DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs`. One app boot runs the probe test and then the trace test. |
| off run | The trace test with `DEEPWIDGETS_TRACE=off`. |

The trim turns rows off. It does not delete code, and it does not comment out code in DSH packages. A row that must stay enabled stays enabled, even when it pulls in code that deepWidgets does not use.

## Setup `trim.profile.setup`

| Item | Value |
|---|---|
| Base | `origin/main` at `367fa63044856717b7781c05be1c512f6fc1b051` |
| Branch | `rohan/trim-profile-v2` |
| Worktree | `~/deepWidgets/.worktrees/rohan-trim-profile-v2` |
| Temporary files | `$TMPDIR/deepwidgets-trim-profile-v2/` |
| Machine | this Mac, with a display. The smoke check opens app windows. |

```bash
git -C ~/deepWidgets fetch origin
git -C ~/deepWidgets merge-base --is-ancestor 367fa630 origin/main ; echo "base exit=$?"                     # base exit=0
git -C ~/deepWidgets diff --name-only 367fa630 origin/main                                                # read the output
git -C ~/deepWidgets rev-parse --verify --quiet refs/heads/rohan/trim-profile-v2 ; echo "branch exit=$?"   # branch exit=1
git -C ~/deepWidgets ls-remote --exit-code --heads origin rohan/trim-profile-v2 ; echo "remote exit=$?"     # remote exit=2
git -C ~/deepWidgets worktree add -b rohan/trim-profile-v2 .worktrees/rohan-trim-profile-v2 origin/main
mkdir -p "$TMPDIR/deepwidgets-trim-profile-v2"
```

- If a command does not give the output in its comment, stop.
- If the `diff` command prints a path that is not under `docs/`, stop and report the list.
- Do not use, read, or change the worktree `.worktrees/rohan-trim-profile` or the branch `rohan/trim-profile`.
- Do not use the folder `$TMPDIR/deepwidgets-trim-profile/`. An older session wrote it.

## Read first `trim.profile.read`

Read `packages/bundle/web-app/cordis.patch.yml`, `packages/util/official-bundles/src/bundles.ts`, `tools/smoke-desktop.mjs`, and `deepwidgets/trace/index.js`. The architect checked each fact below at the base, by code reading or by a spike. If a fact is false, stop and report.

| Fact | Evidence |
|---|---|
| The layer order of the host rows is `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, `@deepwidgets/probe`, `@deepwidgets/trace`, the profile layer, the home layer, and the `--patch` overlays. | `bundles.ts` lines 14-18. The `# ==` headings in the dump of `trim.profile.steps.partition`. |
| The dump composes 197 rows. The old count 196 did not have `deepwidgets-trace`. | The architect ran `trim.profile.steps.partition` at the base. |
| A patch entry `- id: <row id>` with only `disabled: true` keeps the `name` and the config of the row. Do not put `name:` in a patch entry. It is a check, not a rename. | DSH uses this form in `packages/bundle/web-app/cordis.patch.yml`. Spike: the dump showed `plugin-inventory` with its `name` and `disabled: true`. |
| A patch entry with an unknown id does not stop the boot. The dump exits 0 and writes `dsh: [@deepwidgets/trim] patch: entry "<id>" not found`. | Spike. |
| The dump reads the `web` template from the built `@deepseek-ai/dsh-official-bundles`. Thus a change to `bundles.ts` needs `build:artifacts`. The app reads `cordis.patch.yml` from the workspace at each boot. | Spike: the dump did not show the trim layer before `build:artifacts`. A patch change with no new build showed in the next app boot. |
| The host inspector listens on `hostInspectPort`. The procedure of `trim.profile.steps.host_rows` works on the Electron host. | `apps/desktop/src/host-process.ts` line 203. Spike: 200 entries in 826 ms, with all rows on. |
| The row `directory-picker` makes two rows at run time, with random ids. Their names are `@deepseek-ai/dsh-host-directory-picker-native` and `@deepseek-ai/dsh-client-ui-directory-picker-native`. | Spike. With `directory-picker` off, the two rows did not show. |
| The host row `modules` gives the client Context its rows, in `window.__DSH_BOOT__.entries`. Each entry id is a package name. A disabled host row gives no client row. | `packages/client/modules/src/index.ts` (`processOne` at line 1035, and line 633). Spike: 76 entries, with `@deepwidgets/probe` and `@deepwidgets/trace`. |
| The renderer shows the UI only after each entry of `window.__DSH_BOOT__` is active. Thus a probe test that passes proves that each client row is active. | The research for the base `ab547c27`. Since then, no file under `packages/` changed, except `bundles.ts`. |
| The required row ids of the web profile are `webserver`, `web-runtime`, `modules`, `connection`, `agent-loop`, `tool-executor-native`, and `tool-executor-ptc`. A patch can disable a required row. An enabled required row that does not become active stops the boot. | `packages/boot/app-boot/src/index.ts`, near line 949. |
| The trace host row `deepwidgets-trace` injects `webServer`, `connection`, and `loader`. The rows `webserver` and `connection` and the Loader give them. The trace client row `@deepwidgets/trace` injects only `loader`. | `deepwidgets/trace/index.js` line 7 and `client.js` line 136. `packages/client/connection/src/rpc-host.ts` line 92. |
| With `DEEPWIDGETS_TRACE=off`, the trace host row is off, and its client row drops out. `GET /api/trace` answers 404. The trace window closes. | `trace.window.check` in `docs/tasks/trace-window.md`. |
| `waitForRenderer` takes only the page `dsh-app://app/`, by its exact URL. The renderer also has the pages `dsh-app://app/trace` and `welcome.html`. The trace page has no client Context. | `tools/smoke-desktop.mjs` line 379. Spike page list. `deepwidgets/trace/page.html`. |
| The tests `apps/cli/tests/profile-mcp.spec.ts` and `apps/desktop/tests/profile-mcp.spec.ts` need the row `mcp-resources` with no `disabled` field. They also need a composition with no warning. | Spike: with `mcp-resources` off, both tests failed. With it on, both passed. |
| With the start keep set, `session-controller`, `file-upload`, and `mcp-resources` stay pending. `mcp-resources` waits only for `tools`. The other kept host rows become active. | Spike with the start keep set (host rows only). With the same set minus `mcp-resources`, the probe test failed in a spike. `trim.profile.steps.settle` covers this. |
| Seven tests in four files fail at the base. The causes are outside this unit. The files are `official-bundles.spec.ts`, `optional-bundles.spec.ts`, `workspace-prefetch.host.spec.ts`, and `desktop-publish-local-preflight.spec.ts`. | The architect ran the `bundle tests` line of `trim.profile.check` at the base. |
| In a new worktree, the first app start downloads a runtime of about 110 MB. Before that download was complete, the spike smoke check failed with `renderer timeout`. | Spike. `trim.profile.steps.build` runs the download once. |

Look Before You Build: the architect searched the repository and npm. The route `GET /api/trace` keeps the missing services of the last state change of a row (`vendor/cordis/src/fiber.ts` lines 579-586). The route also answers 404 in the off run. The DSH row `plugin-inventory` gives no missing services. The npm package `chrome-remote-interface` adds a dependency to a script that uses only Node built-in modules. Thus the rows check uses the host inspector, and the PR body must say so in one line.

## Steps `trim.profile.steps`

### Start keep set `trim.profile.steps.start`

Start with these 25 rows enabled. Turn off every other row.

| Row id | Why it is in the start set | Ablate |
|---|---|---|
| `deepwidgets-probe` | keep list: the probe | no |
| `deepwidgets-trace` | the trace (`trace.host`) | no |
| `timer` | keep list: `vendor/timer` | no |
| `hmr` | keep list: `packages/boot/hmr` | no |
| `webserver` | keep list: the host web server | no |
| `client-hmr` | keep list: `packages/client/hmr` | no |
| `modules` | keep list: `packages/client/modules` | no |
| `connection` | keep list: `packages/client/connection` | no |
| `ui-layout` | keep list: `packages/client/ui-layout`. It renders the slot `shell.overlay`. | no |
| `mcp-resources` | the two `profile-mcp.spec.ts` tests. It stays pending, because `tools` is off. | no |
| `web-startup` | `webserver` and `connection` inject `webStartup` | yes |
| `credentials` | the `connection` host half injects `credentials` | yes |
| `web-runtime` | required id. The desktop app serves the frontend itself. | yes |
| `typert` | the `typert-gateway` row injects it | yes |
| `typert-gateway` | the client half of `api-remotes` injects it | yes |
| `remote-access` | the client half of `ui-session` injects it | yes |
| `api-remotes` | the client halves of `locale` and `ui-settings` inject it | yes |
| `ui-renderer` | `ui-layout` injects it. It gives the `slots` service. | yes |
| `ui-theme` | `ui-layout` injects it | yes |
| `locale` | `ui-layout` injects it | yes |
| `shortcuts` | `ui-layout` and `ui-theme` inject it | yes |
| `ui-session` | `ui-layout` injects it | yes |
| `ui-settings` | `locale` and `ui-theme` inject it | yes |
| `session-controller` | the client half of `ui-session` injects it | yes |
| `file-upload` | the client half of `session-controller` injects it | yes |

To ablate a row means to run the boot test with the row turned off. Do not ablate a row with `no` in the column `Ablate`. The host halves of `session-controller` and `file-upload` inject agent services, and the trim turns off the agent rows. Thus these host halves stay enabled and pending, as `mcp-resources` does. The rows check allows a pending row only on a pending line of `rows.host.txt` (`trim.profile.steps.host_state`).

### Add the trim bundle `trim.profile.steps.bundle`

Make the folder `deepwidgets/trim/`. Write `deepwidgets/trim/package.json` with this text:

```json
{
  "name": "@deepwidgets/trim",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./cordis.patch.yml": "./cordis.patch.yml",
    "./package.json": "./package.json"
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" }
  }
}
```

The trim bundle has no plugin row and no code. DSH reads only the `dsh.bundle` field of a bundle package.

### Write the patch file `trim.profile.steps.patch_file`

Write `deepwidgets/trim/cordis.patch.yml`. Start it with these comment lines:

```yaml
# deepWidgets trim layer. It applies after dsh-base, dsh-web-app, @deepwidgets/probe, and @deepwidgets/trace.
# Each entry turns off one DSH row. The row and its package stay in the tree.
# Spec: fork_trim.method in docs/specs/fork-trim.md.
```

Then add one entry for each row that is not in the keep set. This includes rows that DSH already disables. Write each entry as exactly these three lines, with a blank line between entries:

```yaml
# deepwidgets-trim: <reason>
- id: <row id>
  disabled: true
```

- Group the entries by area, with one comment heading per area.
- The areas are `cordis-boot`, `host-web-transport`, `client-ui`, `api-controllers`, `session-storage-workspace`, `sandbox-shell-fs`, `telemetry-account-credentials`, and `agent-llm-tools`.
- Give each entry a short reason, for example `agent plane, out of scope (fork_trim.out_of_scope)`.
- You can write a script in the temporary folder to make the first draft. Do not commit the script.

### Register the package `trim.profile.steps.register`

1. In `apps/cli/package.json`, add `"@deepwidgets/trim": "workspace:*",` to `dependencies`. Put it directly after the line `"@deepwidgets/trace": "workspace:*",`. Change nothing else in that file.

2. In `packages/util/official-bundles/src/bundles.ts`, change the `web` entry to this text. Keep the commented DSH line. Keep one marker in the file.

   ```ts
     web: {
       // deepwidgets-trim: probe.round_trip, trace.host, and trim.profile add the @deepwidgets bundles to the web profile.
       // bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
       bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepwidgets/probe', '@deepwidgets/trace', '@deepwidgets/trim'],
     },
   ```

3. Do not change `pnpm-workspace.yaml`. Its `deepwidgets/*` line already includes the new folder.

### Install `trim.profile.steps.install`

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version                                                # 11.28.5
corepack pnpm install ; echo "install exit=$?"                         # install exit=0
git diff --numstat pnpm-lock.yaml | tr '\t' ' '                        # 5 0 pnpm-lock.yaml
corepack pnpm install --frozen-lockfile ; echo "frozen exit=$?"        # frozen exit=0
ls apps/desktop/node_modules/electron/dist > /dev/null ; echo "electron exit=$?"   # read the exit code
```

- If the `numstat` line is not `5 0 pnpm-lock.yaml`, stop and report the lockfile diff.
- If `electron exit` is not 0, run `node apps/desktop/node_modules/electron/install.js` once. Record that you used this fallback.
- Then run the Git hook checks of `fork.baseline.steps.install` again. Each check must give its expected output.

### Build `trim.profile.steps.build`

```bash
corepack pnpm run build:artifacts ; echo "artifacts exit=$?"                                           # artifacts exit=0
corepack pnpm --filter @deepseek-ai/dsh-desktop run build ; echo "desktop exit=$?"                      # desktop exit=0
corepack pnpm --filter @deepseek-ai/dsh-desktop run prepare:primary-runtime ; echo "runtime exit=$?"   # runtime exit=0
```

Record the time of each command. The third command downloads the runtime of the app once. A later change to the patch file needs no new build.

### Add the rows check to the smoke check `trim.profile.steps.rows_check`

Change `tools/smoke-desktop.mjs`. Use only Node built-in modules. Do not add a dependency. Without `DSH_SMOKE_ROWS`, the script must behave as before. Add this line directly after the line that calls `checkTrace`:

```js
      if (failed === undefined && (process.env.DSH_SMOKE_ROWS ?? '') !== '') failed = await checkRows(page, deadline)
```

Thus the rows check runs last, after each earlier step that runs has passed. Write `checkRows` and its helpers to these rules:

| Part | Rule |
|---|---|
| Row lists | `DSH_SMOKE_ROWS` is the path of a folder with `rows.host.txt` and `rows.client.txt`. In each line, ignore the text after `#`, and ignore blank lines. |
| Host rows | Read them over the host inspector on `hostInspectPort` (`trim.profile.steps.host_rows`). The `evaluate` helper sends only one message. Add one small helper on the built-in `WebSocket` that sends several messages on one socket, with the deadline behavior of `evaluate`. |
| Client rows | Use `evaluate` on `page`, the main window, not the trace window. Evaluate `JSON.stringify((window.__DSH_BOOT__?.entries ?? []).map((entry) => entry.id))`. If the list has no entry, read it again after 250 ms, until the deadline. |
| Compare | Compare the client keys with `rows.client.txt` as sets. Compare the host items with the expected host items of `rows.host.txt` as sets (`trim.profile.steps.host_state`). |
| Result | When a pair of sets is not equal, the result is `smoke-desktop: fail: host rows: extra <items>, missing <items>`. Use `client rows` for the client list, and `none` for an empty part. A host row in the wrong state shows in both parts. |
| Log | Write both live lists to the log file with `note`. |
| `DSH_SMOKE_ROWS_SAVE` | When it has a value, write the host snapshot to that file as JSON. The host snapshot is the array that the last CDP call of `trim.profile.steps.host_rows` returns. |
| `DSH_SMOKE_ROWS_SNAPSHOT` | When it has a value, do not start the app. Put this branch before the line that makes `temp` with `mkdtemp`. Make the host items from the snapshot in that file, and compare them with `rows.host.txt`. Print the result line with `console.log`. Exit 0 on pass and 1 on fail. Do not check the client rows. |
| Header comment | Add one sentence about each of `DSH_SMOKE_ROWS`, `DSH_SMOKE_ROWS_SAVE`, and `DSH_SMOKE_ROWS_SNAPSHOT`. |

### Read the host rows `trim.profile.steps.host_rows`

The host has no route that lists its rows. Do not add one. Send these Chrome DevTools Protocol (CDP) calls in this order on one socket. If a call fails, stop and report the call and its error.

| Call | What to do |
|---|---|
| `GET http://127.0.0.1:<hostInspectPort>/json/list` | Open the `webSocketDebuggerUrl` of the first target. |
| `Runtime.evaluate` | Use the expression `Function.prototype`. Keep the `objectId` of the result. |
| `Runtime.queryObjects` | Use that `objectId` as `prototypeObjectId`. |
| `Runtime.callFunctionOn` | On the result, keep only the functions with the name `Loader` that have the prototype methods `showLog` and `locate`. Exactly one function must stay. |
| `Runtime.queryObjects` | Use the prototype of that function. Exactly one Loader instance must come back. |
| `Runtime.callFunctionOn` | Use `returnByValue: true`. Return an array with one object for each entry `e` of `loader.entries()`, with the fields below. |

| Field | Value |
|---|---|
| `id` | `e.id` |
| `optionsId` | `e.options.id` |
| `name` | `e.options.name` |
| `disabled` | `e.disabled` |
| `state` | `e.fiber?.state ?? null` |
| `missing` | When `state` is `0`: `Object.keys(e.fiber.inject).filter((service) => e.fiber.ctx.get(service) === undefined).sort()`. Else `[]`. This is the expression of `inactiveEntries` in `packages/boot/app-boot/src/index.ts`. |

Then make the host items from that array:

- Skip the root entry, with the `id` `include` and the `name` `cordis:include`.
- Skip each entry where `disabled` is `true`.
- When `id` starts with `include:`, the key is `optionsId`. Else the key is `name:<name>`, for a row that a plugin makes at run time.
- Make the host item from the key and the state, in the form of `trim.profile.steps.host_state`.

If an enabled entry has the state `1` or `5`, read the host rows again after 500 ms. Stop at the smoke deadline. If an entry still has one of these states at the deadline, the result is `smoke-desktop: fail: host rows: not settled <items>`.

### Host states `trim.profile.steps.host_state`

Cordis gives each fiber one state (`vendor/cordis/src/fiber.ts`). The host item is `<key>=<word>`, with the word from this table. The host only writes a warning when an optional row fails. Thus the rows check must fail on each state with `No`, even when the probe test passes.

| `state` | Word | Allowed for a kept row |
|---|---|---|
| `0` | `pending(<services>)` | Only on a pending line in `rows.host.txt` |
| `1` | `loading` | No. The rows check reads the host rows again. |
| `2` | `active` | Yes |
| `3` | `failed` | No |
| `4` | `disposed` | No |
| `5` | `unloading` | No. The rows check reads the host rows again. |
| `null` | `nofiber` | No. The import of the row failed. |

In `pending(<services>)`, `<services>` is the `missing` array, joined with commas and no spaces. Each line of `rows.host.txt` has one of these two forms. Another form gives the result `smoke-desktop: fail: rows list: bad line <line>`.

- `<key>`. The expected host item is `<key>=active`.
- `<key> pending <services>`, with the services in sort order, joined with commas and no spaces. The expected host item is `<key>=pending(<services>)`.

### Settle the keep set `trim.profile.steps.settle`

Start with the keep set of `trim.profile.steps.start`. Use the boot test to find the smallest keep set. Each round is one run:

```bash
DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "exit=$?"
```

1. If the boot test fails, find the row that the boot needs. Use the smoke log, and read the renderer console over the renderer inspector. Turn that row on again, record the evidence, and run the boot test again. If the boot test still fails after 8 rounds, stop and report.

2. The agent, LLM providers, MCP, and the plugin manager are out of scope (`fork_trim.out_of_scope`). If the boot test needs one of their rows, stop and report. The row `mcp-resources` is the only exception, for the tests.

3. When the boot test passes, ablate each row that has `yes` in the column `Ablate`, one row at a time. If the boot test passes with the row off, keep the row off, with the reason `not needed: the boot test passes without it`. Else turn the row on again.

### Write the row lists `trim.profile.steps.lists`

1. Write `deepwidgets/trim/rows.host.txt`. Put one host key from the final keep set on each line, with a reason after `#`. The file must have the lines `deepwidgets-probe`, `deepwidgets-trace`, and `mcp-resources pending tools`.

   Write a pending line only when each of these is true. Else find the cause of the state and fix it.

   - The rows check reads the row in the state `0`.
   - A row that the trim turns off gives each missing service.
   - The reason names the row that is off for each missing service.

2. Write `deepwidgets/trim/rows.client.txt`. Put one package name on each line. List each kept row that has a web client half. The file must have the lines `@deepwidgets/probe` and `@deepwidgets/trace`.

Start each file with a comment line that tells what the file holds. Write the lists from the keep set that you settled. Do not copy them from the log without a check. If the rows check shows a difference, find the cause. Then fix the list or the patch file, and record the reason.

### Check the partition `trim.profile.steps.partition`

Each composed row must be in exactly one place: the patch file or `rows.host.txt`. Run these commands:

```bash
W=$(git rev-parse --show-toplevel) ; T=$TMPDIR/deepwidgets-trim-profile-v2 ; mkdir -p "$T/home"
( cd "$T/home" && DSH_HOME="$T/home" node "$W/apps/cli/lib/bin.js" --profile web --dump-default-config ) > "$T/composed.yml" ; echo "dump exit=$?"   # dump exit=0
grep -E '^- id: ' "$T/composed.yml" | sed 's/^- id: //' | sort > "$T/all.txt"
grep -E '^- id: ' deepwidgets/trim/cordis.patch.yml | sed 's/^- id: //' | sort > "$T/off.txt"
sed 's/#.*//' deepwidgets/trim/rows.host.txt | awk 'NF { print $1 }' | grep -v '^name:' | sort > "$T/on.txt"
wc -l < "$T/all.txt" | tr -d ' '                                                   # 197
comm -12 "$T/off.txt" "$T/on.txt" | wc -l | tr -d ' '                              # 0
sort "$T/off.txt" "$T/on.txt" | diff - "$T/all.txt" ; echo "partition exit=$?"     # partition exit=0
awk '/^- id: /{ if (prev !~ /^# deepwidgets-trim: /) bad++ } { prev = $0 } END { print bad + 0 }' deepwidgets/trim/cordis.patch.yml   # 0
```

The dump must write no line with `not found`. Such a line names a patch entry with a wrong id. The last command proves that each patch entry has its marker comment on the line above it.

### Fill in `CLAUDE.md` `trim.profile.steps.head`

Change only these parts of the root `CLAUDE.md`. `$T` is the folder of `trim.profile.steps.partition`.

| Part | Change |
|---|---|
| `head.commands` | Add `DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs` directly after the line `DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs`. |
| `head.status`, header | Change `State on 2026-10-24` to `State on <date>`. `<date>` is the output of `date +%F`. |
| `head.status`, row `Rows that deepWidgets turns off` | Make the second cell `` `deepwidgets/trim/cordis.patch.yml` turns off <n> of the 197 rows. ``. `<n>` is the output of `wc -l < "$T/off.txt" \| tr -d ' '`. |
| `head.status`, row `Our packages` | Change `` `deepwidgets/trim` (planned) `` to `` `deepwidgets/trim` (merged) ``. |
| `head.status`, row `Checks` | After the sentence about `DSH_SMOKE_TRACE=1`, add `` With `DSH_SMOKE_ROWS=<folder>`, it also compares the loaded rows with the row lists in that folder. `` |

Then `git diff --numstat -- CLAUDE.md | tr '\t' ' '` must print `5 4 CLAUDE.md`. If it prints another line, stop and report it.

## Run the checks `trim.profile.check`

Run each command from the worktree root, one at a time. Each comment gives the expected output and exit code. Each off run takes about five minutes, because the test tries again until its deadline.

```bash
T=$TMPDIR/deepwidgets-trim-profile-v2
DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 DSH_SMOKE_ROWS=deepwidgets/trim DSH_SMOKE_ROWS_SAVE="$T/host-rows.json" node tools/smoke-desktop.mjs ; echo "rows exit=$?"   # smoke-desktop: pass, rows exit=0
mkdir -p "$T/minus-one" && cp deepwidgets/trim/rows.client.txt "$T/minus-one/"
grep -vE '^[[:space:]]*(#|$)' deepwidgets/trim/rows.host.txt | sed '$d' > "$T/minus-one/rows.host.txt"
DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS="$T/minus-one" node tools/smoke-desktop.mjs ; echo "rows minus one exit=$?"   # smoke-desktop: fail: host rows: ..., rows minus one exit=1
DSH_SMOKE_ROWS=deepwidgets/trim DSH_SMOKE_ROWS_SNAPSHOT="$T/host-rows.json" node tools/smoke-desktop.mjs ; echo "snapshot exit=$?"   # smoke-desktop: pass, snapshot exit=0
node -e 'const fs = require("node:fs"); const rows = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); const kept = rows.filter((r) => r.name !== "cordis:include" && r.disabled !== true); const row = kept.find((r) => r.state === 0) ?? kept.find((r) => r.state === 2); row.state = 3; row.missing = []; console.log(JSON.stringify(rows))' "$T/host-rows.json" > "$T/host-rows.failed.json"
DSH_SMOKE_ROWS=deepwidgets/trim DSH_SMOKE_ROWS_SNAPSHOT="$T/host-rows.failed.json" node tools/smoke-desktop.mjs ; echo "failed snapshot exit=$?"   # smoke-desktop: fail: host rows: ..., failed snapshot exit=1
DSH_SMOKE_TRACE=1 DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs ; echo "trace off exit=$?"   # smoke-desktop: fail: trace: status 404, trace off exit=1
grep -c "deepwidgets-trace: GET /trace answered 404" "$(ls -td "$TMPDIR"/deepwidgets-smoke-desktop-* | head -1)/desktop.log"   # 1
DSH_SMOKE_PROBE=1 DEEPWIDGETS_PROBE=off node tools/smoke-desktop.mjs ; echo "probe off exit=$?"   # smoke-desktop: fail: probe text: missing, probe off exit=1
node tools/smoke-desktop.mjs ; echo "smoke exit=$?"                                     # smoke-desktop: pass, smoke exit=0
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs ; echo "probe exit=$?"                   # smoke-desktop: pass, probe exit=0
DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "trace exit=$?"                   # smoke-desktop: pass, trace exit=0
DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs ; echo "head rows exit=$?"   # smoke-desktop: pass, head rows exit=0
DSH_SMOKE_TIMEOUT_MS=1000 node tools/smoke-desktop.mjs ; echo "short exit=$?"           # smoke-desktop: fail: ..., short exit=1
node tools/trace-late-row.mjs ; echo "late row exit=$?"                                 # trace-late-row: pass, late row exit=0
node tools/trace-client-rows.mjs ; echo "client rows exit=$?"                           # trace-client-rows: pass, client rows exit=0
corepack pnpm exec vitest run apps/cli/tests apps/desktop/tests packages/util/official-bundles/tests packages/boot/app-boot/tests scripts/optional-bundles.spec.ts scripts/local-bundle-registry.spec.ts scripts/release/families.spec.ts packages/boot/plugin-manager/tests/bundle-detail.spec.ts packages/boot/plugin-manager/tests/manager.spec.ts packages/experimental/webworker-packer/tests/profile-image.spec.ts packages/experimental/inspector/tests/workspace-prefetch.host.spec.ts ; echo "bundle tests exit=$?"   # see the table below
git grep -c deepwidgets-trim -- packages/util/official-bundles/src/bundles.ts            # packages/util/official-bundles/src/bundles.ts:1
```

The `bundle tests` line runs each test file that imports `bundles.ts`, `apps/cli/package.json`, or the `web` template. It must give the same result as at the base. If another test fails, stop and report the test name and its error. Do not fix the four files that fail at the base.

| Output | Expected |
|---|---|
| `Test Files` line | `Test Files  4 failed \| 197 passed \| 5 skipped (206)` |
| `Tests` line | `Tests  7 failed \| 7913 passed \| 58 skipped (7978)` |
| exit code | `bundle tests exit=1` |
| Files that fail | `official-bundles.spec.ts`, `optional-bundles.spec.ts`, `workspace-prefetch.host.spec.ts`, `desktop-publish-local-preflight.spec.ts` |

| Run | What it proves |
|---|---|
| `rows minus one` | The rows check can fail. Its host list has one line fewer than the live host rows. |
| `snapshot` and `failed snapshot` | The state is part of the comparison. The `node -e` command changes the first pending row to failed, or the first active row when no row has the state `0`. |
| `trace off` and `probe off` | The trace test and the probe test can fail. The `grep -c` count `1`, directly after the off run, proves that the trace window closed. |

Also run the commands in `trim.profile.steps.partition`. The install and build lines of `head.commands` ran in `trim.profile.steps.install` and `trim.profile.steps.build`. The line `corepack pnpm run start:desktop` is not a check, because it runs the app until you quit it. If a check does not give its expected result, use `tasks.protocol.stop`.

## Findings to record `trim.profile.findings`

Put these items in the `Findings` section of the PR body. Write "unknown" when you did not find out.

- The time of the install and of each build command, and whether you used the Electron fallback.
- Each settle round: the row, the result line, and the action.
- The final counts: rows off, host rows kept, host rows kept but pending, and client rows.
- Each pending host row, with its missing services and the row that is off for each service.
- Each kept row that is not in `fork_trim.keep_list`, with the evidence that the boot test or a test needs it.
- The host rows read time, and the limit that the `web` template reaches only new profiles.

## Files you may change `trim.profile.files`

Change only these files, and only the parts that the steps name:

- `deepwidgets/trim/package.json`, `cordis.patch.yml`, `rows.host.txt`, and `rows.client.txt` (all new)
- `apps/cli/package.json` and `packages/util/official-bundles/src/bundles.ts` (`trim.profile.steps.register`)
- `pnpm-lock.yaml` (only the five lines of `trim.profile.steps.install`)
- `tools/smoke-desktop.mjs` (`trim.profile.steps.rows_check` and `trim.profile.steps.host_rows`)
- `CLAUDE.md` (only the lines of `trim.profile.steps.head`)
- No file in `deepwidgets/probe/` or `deepwidgets/trace/`

After the build, `git status --short` must show only these paths. If build outputs show up as untracked files, stop and report them. Do not add them to `.gitignore`.

## Done when `trim.profile.done`

- Each check command gives its expected output.
- `git status --short` shows only the paths in `trim.profile.files`.
- The PR is open against `main`. Its title is `trim.profile: turn off the rows the probe does not need`.
