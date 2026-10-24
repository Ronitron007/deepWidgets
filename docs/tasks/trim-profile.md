# Task `trim.profile`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `trim.profile.goal`

Add the deepWidgets trim layer. This layer turns off each Cordis row that the app does not need. The spec sections are `fork_trim.method` and `fork_trim.keep_list` in `docs/specs/fork-trim.md`. The plan row is `trim.profile` in `docs/plans/fork-trim.md`.

In this task, these terms have these meanings:

- A "row" is one top-level entry in the composed Cordis config of the `host` Context. Each row has an `id`.

- The "trim layer" is the new bundle `@deepwidgets/trim`. Its `cordis.patch.yml` sets `disabled: true` on each row to turn off.

- The "keep set" is the set of rows that stay enabled. The boot check settles it. The spec keep list is only the first guess.

- The "row lists" are the two committed files `deepwidgets/trim/rows.host.txt` and `deepwidgets/trim/rows.client.txt`.

- The "rows check" is a new step in the smoke check. It compares the rows that loaded in each Context with the row lists.

The trim turns rows off. It does not delete code, and it does not comment out code in DSH packages. A row that must stay enabled stays enabled, even when it pulls in code that deepWidgets does not use. A later unit can cut deeper.

## Setup `trim.profile.setup`

| Item | Value |
|---|---|
| Base | `origin/main`. It must contain commit `ab547c27`. |
| Branch | `rohan/trim-profile` |
| Worktree | `~/deepWidgets/.worktrees/rohan-trim-profile` |
| Temporary files | `$TMPDIR/deepwidgets-trim-profile/` |
| Machine | this Mac, with a display. The smoke check opens app windows. |

```bash
git -C ~/deepWidgets fetch origin
git -C ~/deepWidgets merge-base --is-ancestor ab547c27 origin/main
git -C ~/deepWidgets worktree add -b rohan/trim-profile .worktrees/rohan-trim-profile origin/main
```

If the second command exits with a code other than 0, stop.

## Facts from research `trim.profile.facts`

The planning session found these facts by code reading and by a headless run of `dsh --profile web`. Do not research them again. If a fact turns out to be false, stop and report.

- The desktop app composes the host rows from layers. The order is `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, `@deepwidgets/probe`, the profile layer, the home layer, and the `--patch` overlays. The `dsh-web-app` layer has its patch file and four preset patch files. The bundle order comes from the `web` entry of `PROFILE_TEMPLATES`.

- A patch entry `- id: <row id>` with only `disabled: true` keeps the config of the row. DSH uses this form in `packages/bundle/web-app/cordis.patch.yml`. Do not put `name:` in a patch entry, because `name:` is a check and not a rename.

- A patch entry with an unknown id only writes a warning. Thus a wrong id does not stop the boot.

- Today the composed config has 196 rows. The command in `trim.profile.steps.partition` prints them.

- The client Context gets its rows from the host row `modules`. This row lists each enabled host row that has a web client half. The renderer reads that list from `window.__DSH_BOOT__`. Each entry id in that list is a package name. When a host row is disabled, its client half drops out of the list.

- The renderer shows the UI only after every entry in `window.__DSH_BOOT__` is active. Thus a probe test that passes proves that every client row is active.

- The row `directory-picker` makes two rows at run time. Their ids are random.

- The required row ids for the web profile are `webserver`, `web-runtime`, `modules`, `connection`, `agent-loop`, `tool-executor-native`, and `tool-executor-ptc`. A patch can disable a required row. If a required row is enabled and does not become active, the boot fails.

- The smoke check already starts the host with a Node inspector on `hostInspectPort`. It passes the port in `DSH_DESKTOP_HOST_INSPECT_PORT`. The headless run read the host rows over that kind of inspector. This was not yet tried on the Electron host.

## Start keep set `trim.profile.start`

Start with these 23 rows enabled. Turn off every other row.

| Row id | Why it is in the start set | Ablate |
|---|---|---|
| `deepwidgets-probe` | keep list: the probe | no |
| `timer` | keep list: `vendor/timer` | no |
| `hmr` | keep list: `packages/boot/hmr` | no |
| `webserver` | keep list: the host web server | no |
| `client-hmr` | keep list: `packages/client/hmr` | no |
| `modules` | keep list: `packages/client/modules` | no |
| `connection` | keep list: `packages/client/connection` | no |
| `ui-layout` | keep list: `packages/client/ui-layout`. It renders the slot `shell.overlay`. | no |
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

The rows that the keep list names stay enabled. Do not ablate them. Ablate means to try the boot check with the row turned off.

The host halves of `session-controller` and `file-upload` inject services of the agent. The trim turns off the agent rows. Thus these host halves can stay enabled but not become active. The task allows this. The rows check records it.

## Steps `trim.profile.steps`

### Add the trim bundle `trim.profile.steps.bundle`

1. Make the folder `deepwidgets/trim/`.

2. Write `deepwidgets/trim/package.json` with this text:

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

3. Write `deepwidgets/trim/cordis.patch.yml` as `trim.profile.steps.patch_file` tells you.

The trim bundle has no plugin row and no code. DSH reads only the `dsh.bundle` field of a bundle package.

### Write the patch file `trim.profile.steps.patch_file`

1. Start the file with these comment lines:

   ```yaml
   # deepWidgets trim layer. It applies after dsh-base, dsh-web-app, and @deepwidgets/probe.
   # Each entry turns off one DSH row. The row and its package stay in the tree.
   # Spec: fork_trim.method in docs/specs/fork-trim.md.
   ```

2. Add one entry for each row that is not in the keep set. This includes rows that DSH already disables.

3. Write each entry as exactly three lines, in this form:

   ```yaml
   # deepwidgets-trim: <reason>
   - id: <row id>
     disabled: true
   ```

4. Put a blank line between entries.

5. Group the entries by area, with one comment heading per area. The areas are `cordis-boot`, `host-web-transport`, `client-ui`, `api-controllers`, `session-storage-workspace`, `sandbox-shell-fs`, `telemetry-account-credentials`, and `agent-llm-tools`.

6. Give each entry a short reason. For example: `agent plane, out of scope (fork_trim.out_of_scope)`, or `client UI that the probe does not use`.

You can write a script in the temporary folder to make the first draft. Do not commit the script.

### Register the package `trim.profile.steps.register`

1. In `apps/cli/package.json`, add `"@deepwidgets/trim": "workspace:*",` to `dependencies`. Put it after the `@deepwidgets/probe` entry. Change nothing else in that file.

2. In `packages/util/official-bundles/src/bundles.ts`, change the `web` entry to this text. Keep the commented DSH line. Keep one marker in the file.

   ```ts
     web: {
       // deepwidgets-trim: probe.round_trip adds @deepwidgets/probe. trim.profile adds @deepwidgets/trim last.
       // bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
       bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepwidgets/probe', '@deepwidgets/trim'],
     },
   ```

3. Do not change `pnpm-workspace.yaml`. Its `deepwidgets/*` line already includes the new folder.

### Install `trim.profile.steps.install`

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version                          # must print 11.28.5
corepack pnpm install
git diff --stat pnpm-lock.yaml
corepack pnpm install --frozen-lockfile          # must exit 0
```

The lockfile diff must add only two entries. One entry is `@deepwidgets/trim` in the `apps/cli` importer. The other entry is the importer `deepwidgets/trim`. If the diff changes other lines, stop and report.

If `apps/desktop/node_modules/electron/dist` is missing, use the Electron fallback from `fork.baseline.steps.install`. Record that you used it.

Then run the Git hook checks from `fork.baseline.steps.install` again. Each check must give its expected output.

### Build `trim.profile.steps.build`

```bash
corepack pnpm run build:artifacts
corepack pnpm --filter @deepseek-ai/dsh-desktop run build
```

Record the time of each command.

### Add the rows check to the smoke check `trim.profile.steps.rows_check`

Change `tools/smoke-desktop.mjs`. Use only Node built-in modules. Do not add a dependency.

1. Run the rows check only when `DSH_SMOKE_ROWS` is set. Its value is the path of a folder that holds `rows.host.txt` and `rows.client.txt`. Without this variable, the script must behave as before.

2. Start the rows check after the probe step passes. When `DSH_SMOKE_PROBE` is not `1`, start it after the host check passes.

3. Read the host rows over the host inspector on `hostInspectPort`. Use the procedure in `trim.profile.steps.host_rows`.

4. Read the client rows with the current `evaluate` helper on the renderer page. Evaluate `JSON.stringify(window.__DSH_BOOT__.entries.map((entry) => entry.id))`.

5. Read both row lists. In each line, ignore the text after `#`, and ignore blank lines. Each other line is a key, then an optional word `inactive`.

6. Compare each live list with its row list as sets. When they are not equal, the result is `smoke-desktop: fail: host rows: extra <keys>, missing <keys>`. Use `client rows` for the client list. Use the word `none` for an empty part.

7. Write both live lists to the log file with `note`.

8. In the comment at the top of the script, add one sentence about `DSH_SMOKE_ROWS`.

The current `evaluate` helper sends one message and closes the socket. The host procedure needs several messages on one socket. Add one small helper for this on the built-in `WebSocket`. Give it the same deadline behavior as `evaluate`.

### Read the host rows `trim.profile.steps.host_rows`

The host has no route that lists its rows. Do not add one. Use these Chrome DevTools Protocol (CDP) calls on one socket:

1. Get `http://127.0.0.1:<hostInspectPort>/json/list`. Open the `webSocketDebuggerUrl` of the first target.

2. Send `Runtime.evaluate` with the expression `Function.prototype`. Keep the `objectId` of the result.

3. Send `Runtime.queryObjects` with that `objectId` as `prototypeObjectId`.

4. Send `Runtime.callFunctionOn` on the result. Keep only the functions with the name `Loader` that have the prototype methods `showLog` and `locate`. Exactly one function must stay.

5. Send `Runtime.queryObjects` on the prototype of that function. Exactly one Loader instance must come back.

6. Send `Runtime.callFunctionOn` with `returnByValue: true`. Map each entry `e` of `loader.entries()` to `e.id`, `e.options.id`, `e.options.name`, `e.disabled`, and `e.fiber?.state`.

Then make the host keys from that result:

1. Skip the root entry. Its `options.name` is `cordis:include`.

2. Skip each entry where `disabled` is `true`.

3. When `e.id` starts with `include:`, the key is `options.id`. Else the key is the text `name:` and then `options.name`. The second form covers rows that a plugin makes at run time with a random id.

4. When the fiber state is not `2`, add the word `inactive` after the key. The value `2` means active.

If one of these calls fails on the Electron host, stop and report the call and its error.

### Settle the keep set `trim.profile.steps.settle`

Use the boot check to find the smallest keep set. Each round is one run of the probe test:

```bash
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs ; echo "exit=$?"
```

The app reads the patch file from the workspace at boot. The planning session inferred this and did not test it. If a change does not show in the next run, run both build commands again. Record that you did this.

1. Start with the start keep set in `trim.profile.start`. Run the probe test.

2. If the probe test fails, find the row that is missing. Use the smoke log, and read the renderer console over the renderer inspector. Turn that row on again, and record the evidence. Then run the probe test again.

3. Do this for at most 8 rounds. If the probe test still fails after 8 rounds, stop and report.

4. The agent, LLM providers, MCP, and the plugin manager are out of scope in `fork_trim.out_of_scope`. If the probe test needs one of their rows, stop and report.

5. When the probe test passes, ablate each row that has `yes` in the column `Ablate`. Do one row at a time. Turn the row off and run the probe test.

6. If the probe test passes with the row off, keep the row off. Give its patch entry the reason `not needed: the probe test passes without it`.

7. If the probe test fails with the row off, turn it on again.

Record each round in the PR body: the row, the result line, and what you did.

### Write the row lists `trim.profile.steps.lists`

1. Write `deepwidgets/trim/rows.host.txt`. Put one host key from the final keep set on each line. Add `inactive` when the row stays enabled but is not active. Give each line a reason after `#`.

2. Write `deepwidgets/trim/rows.client.txt`. Put one package name on each line. List each kept row that has a web client half.

3. Start each file with a comment line that tells what the file holds.

Write the lists from the keep set that you settled. Do not copy them from the log without a check. If the rows check shows a difference, find out why. Then fix the list or the patch file, and record the reason.

### Check the partition `trim.profile.steps.partition`

Each composed row must be in exactly one place: the patch file or `rows.host.txt`. Run these commands:

```bash
W=$(git rev-parse --show-toplevel) ; T=$TMPDIR/deepwidgets-trim-profile ; mkdir -p "$T/home"
( cd "$T/home" && DSH_HOME="$T/home" node "$W/apps/cli/lib/bin.js" --profile web --dump-default-config ) > "$T/composed.yml"
grep -E '^- id: ' "$T/composed.yml" | sed 's/^- id: //' | sort > "$T/all.txt"
grep -E '^- id: ' deepwidgets/trim/cordis.patch.yml | sed 's/^- id: //' | sort > "$T/off.txt"
sed 's/#.*//' deepwidgets/trim/rows.host.txt | awk 'NF { print $1 }' | grep -v '^name:' | sort > "$T/on.txt"
wc -l < "$T/all.txt"                                     # must print 196
comm -12 "$T/off.txt" "$T/on.txt" | wc -l                # must print 0
sort "$T/off.txt" "$T/on.txt" | diff - "$T/all.txt" ; echo "partition exit=$?"   # must print exit=0
awk '/^- id: /{ if (prev !~ /^# deepwidgets-trim: /) bad++ } { prev = $0 } END { print bad + 0 }' deepwidgets/trim/cordis.patch.yml   # must print 0
```

The last command proves that each patch entry has its marker comment on the line above it.

### Fill in the commands `trim.profile.steps.commands`

In the `Commands` block of the root `CLAUDE.md`, add `DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs` after the probe test line. Change nothing else in that file.

## Run the checks `trim.profile.check`

```bash
T=$TMPDIR/deepwidgets-trim-profile
DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS=deepwidgets/trim node tools/smoke-desktop.mjs ; echo "rows exit=$?"   # must print pass and exit=0
mkdir -p "$T/minus-one" && cp deepwidgets/trim/rows.client.txt "$T/minus-one/"
grep -vE '^[[:space:]]*(#|$)' deepwidgets/trim/rows.host.txt | sed '$d' > "$T/minus-one/rows.host.txt"
DSH_SMOKE_PROBE=1 DSH_SMOKE_ROWS="$T/minus-one" node tools/smoke-desktop.mjs ; echo "rows minus one exit=$?"   # must print "fail: host rows:" and exit=1
DSH_SMOKE_PROBE=1 DEEPWIDGETS_PROBE=off node tools/smoke-desktop.mjs ; echo "probe off exit=$?"            # must print "fail: probe text:" and exit=1
node tools/smoke-desktop.mjs ; echo "smoke exit=$?"                                                        # must print pass and exit=0
DSH_SMOKE_TIMEOUT_MS=1000 node tools/smoke-desktop.mjs ; echo "short exit=$?"                             # must print fail and exit=1
git grep -c deepwidgets-trim -- packages/util/official-bundles/src/bundles.ts                              # must print bundles.ts:1
```

Also run the commands in `trim.profile.steps.partition`. Each must give its expected output.

The second run proves that the rows check can fail. Its host list has one line fewer than the live host rows.

## Findings to record `trim.profile.findings`

Put these in the `Findings` section of the PR body. Write "unknown" when you did not find out.

- The time of the install and of each build command.

- Whether you used the Electron fallback.

- Each settle round: the row, the result line, and the action.

- The final counts: rows turned off, host rows kept, host rows kept but inactive, and client rows.

- Each kept row that is not on the spec keep list, with the evidence that the probe test needs it.

- The time that the host rows read took in the passing run.

- One known limit: the `web` template reaches only new profiles. An old desktop profile keeps its old bundle list.

## Files you may change `trim.profile.files`

- `deepwidgets/trim/package.json` (new)

- `deepwidgets/trim/cordis.patch.yml` (new)

- `deepwidgets/trim/rows.host.txt` (new)

- `deepwidgets/trim/rows.client.txt` (new)

- `apps/cli/package.json` (only the new dependency)

- `packages/util/official-bundles/src/bundles.ts` (only the `web` entry)

- `pnpm-lock.yaml` (only the two trim entries)

- `tools/smoke-desktop.mjs`

- `CLAUDE.md` (only the `Commands` block)

Do not change the four files in `deepwidgets/probe/`.

After the build, `git status --short` must show only these paths. If build outputs show up as untracked files, stop and report them. Do not add them to `.gitignore`.

## Done when `trim.profile.done`

- Each check command gives its expected output.

- `git status --short` shows only the paths in `trim.profile.files`.

- The PR is open against `main`. Its title is `trim.profile: turn off the rows the probe does not need`.
