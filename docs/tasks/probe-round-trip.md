# Task `probe.round_trip`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `probe.round_trip.goal`

Add the `probe` bundle and the probe test. The probe test proves one round trip from the `client` Context to the `host` Context. The spec section is `fork_trim.probe` in `docs/specs/fork-trim.md`. The plan row is `probe.round_trip` in `docs/plans/fork-trim.md`.

In this task, the "probe test" is the command `DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs`. It boots the app like the smoke check. Then it reads the probe text in the renderer.

The local commit `cf3e02b7` is a spike of this unit. It passed on an older base. Use its probe files as the source. Do not merge it, and do not cherry-pick it.

## Setup `probe.round_trip.setup`

| Item | Value |
|---|---|
| Base | `origin/main`. It must contain commit `54b51fa2`. |
| Branch | `rohan/probe-round-trip` |
| Worktree | `~/deepWidgets/.worktrees/rohan-probe-round-trip` |
| Temporary files | `$TMPDIR/deepwidgets-probe-round-trip/` |
| Reference | the local commit `cf3e02b7` on the branch `rohan/spike-probe` |
| Machine | this Mac, with a display. The probe test opens app windows. |

```bash
git -C ~/deepWidgets fetch origin
git -C ~/deepWidgets merge-base --is-ancestor 54b51fa2 origin/main
git -C ~/deepWidgets cat-file -e cf3e02b7
git -C ~/deepWidgets worktree add -b rohan/probe-round-trip .worktrees/rohan-probe-round-trip origin/main
```

If the second or third command exits with a code other than 0, stop.

## Read first `probe.round_trip.read`

- `packages/preset/agent-preset/skills/cordis-plugin-development/templates/decoration/` is the DSH template for a bundle with a host half and a client half. The probe has the same shape.

- `packages/client/ui-chat/src/client/apply.ts`, near the text `shell.overlay`. This code puts a component in the slot `shell.overlay`.

- `packages/util/official-bundles/src/bundles.ts` holds `PROFILE_TEMPLATES`. The desktop app uses the `web` entry. See `apps/desktop/src/project-manager.ts`.

- `tools/smoke-desktop.mjs` is the boot smoke check from `fork.baseline`.

- `git -C ~/deepWidgets show cf3e02b7` shows the spike diff.

## Steps `probe.round_trip.steps`

### Add the probe bundle `probe.round_trip.steps.bundle`

1. Copy the probe files from the spike:

   ```bash
   cd ~/deepWidgets/.worktrees/rohan-probe-round-trip
   git -C ~/deepWidgets archive cf3e02b7 deepwidgets/probe | tar -x -C .
   ```

2. Run `find deepwidgets/probe -type f | wc -l`. It must print `4`.

3. Do not change the four files.

The four files do these things:

- `index.js` is the host half. It registers the route `GET /api/probe` on `webServer`. The route returns `{ "ok": true, "pid": <host process id> }`.

- `client.js` is the client half. It puts a component in the slot `shell.overlay`. The component calls `fetch('api/probe')`. Then it shows `probe pid <n>` in an element with the attribute `data-deepwidgets-probe`.

- `cordis.patch.yml` inserts the host row `deepwidgets-probe`. When the environment variable `DEEPWIDGETS_PROBE` is `off`, the row has `disabled: true`.

- `package.json` names the package `@deepwidgets/probe`. It also names the patch file and the client entry.

### Register the package `probe.round_trip.steps.register`

1. In `pnpm-workspace.yaml`, add these two lines under `packages:`, after the line `  - packages/*/*`. Change nothing else in that file.

   ```yaml
     # deepWidgets-owned plain-JS packages, outside the DSH TypeScript build globs.
     - deepwidgets/*
   ```

2. In `apps/cli/package.json`, add `"@deepwidgets/probe": "workspace:*",` to `dependencies`. Put it after the `@deepseek-ai/schemastery` entry. The `@deepseek-ai/dsh-web-app` bundle has an entry in the same list. Change nothing else in that file.

3. In `packages/util/official-bundles/src/bundles.ts`, change the `web` entry to this text. The old line stays as a comment, with the marker on the first commented line.

   ```ts
     web: {
       // deepwidgets-trim: probe.round_trip adds @deepwidgets/probe to the web profile.
       // bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
       bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepwidgets/probe'],
     },
   ```

### Install `probe.round_trip.steps.install`

The new workspace package changes the lockfile. Thus the first install does not use `--frozen-lockfile`.

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version                          # must print 11.28.5
corepack pnpm install
git diff --stat pnpm-lock.yaml
corepack pnpm install --frozen-lockfile          # must exit 0
```

The lockfile diff must add only two entries. One entry is `@deepwidgets/probe` in the `apps/cli` importer. The other entry is the importer `deepwidgets/probe`. If the diff changes other lines, stop and report.

If `apps/desktop/node_modules/electron/dist` is missing, use the Electron fallback from `fork.baseline.steps.install`. Record that you used it.

Then run the Git hook checks from `fork.baseline.steps.install` again. Each check must give its expected output.

### Build `probe.round_trip.steps.build`

```bash
corepack pnpm run build:artifacts
corepack pnpm --filter @deepseek-ai/dsh-desktop run build
```

Record the time of each command.

### Add the probe test to the smoke check `probe.round_trip.steps.smoke`

Change `tools/smoke-desktop.mjs`. The spike function `checkProbe` in `cf3e02b7` does these things. Copy it, and make it fit the current script.

1. Run the probe step only when `DSH_SMOKE_PROBE` is `1`. Without this variable, the script must behave as before.

2. Start the probe step after the host check passes.

3. Until the deadline, send `Runtime.evaluate` to the renderer page every 250 ms. Evaluate `document.querySelector('[data-deepwidgets-probe]')?.textContent ?? ''`.

4. When the text matches `^probe pid (\d+)$`, compare the number with the host process id that the script found. If they are equal, the probe step passes. Else the result is `smoke-desktop: fail: probe pid <n> is not host pid <pid>`.

5. At the deadline, the result is `smoke-desktop: fail: probe text: <text>`. Use the word `missing` when the text is empty.

6. Write the last probe text and the host process id to the log file with `note`.

7. Use the current helpers `evaluate`, `note`, and `delay`. Do not add a dependency.

8. In the comment at the top of the script, add one sentence about `DSH_SMOKE_PROBE=1`.

### Run the checks `probe.round_trip.check`

```bash
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs ; echo "probe exit=$?"                            # must print pass and exit=0
DSH_SMOKE_PROBE=1 DEEPWIDGETS_PROBE=off node tools/smoke-desktop.mjs ; echo "probe off exit=$?"  # must print "fail: probe text:" and exit=1
node tools/smoke-desktop.mjs ; echo "smoke exit=$?"                                              # must print pass and exit=0
DSH_SMOKE_TIMEOUT_MS=1000 node tools/smoke-desktop.mjs ; echo "short exit=$?"                   # must print fail and exit=1
git grep -c deepwidgets-trim -- packages/util/official-bundles/src/bundles.ts                    # must print bundles.ts:1
```

The second command proves that the probe test can fail. The variable `DEEPWIDGETS_PROBE=off` disables the probe host row. Thus the round trip cannot complete.

### Fill in the commands `probe.round_trip.steps.commands`

In the `Commands` block of the root `CLAUDE.md`, add `DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs` after the line `node tools/smoke-desktop.mjs`. Change nothing else in that file.

## Findings to record `probe.round_trip.findings`

Put these in the `Findings` section of the PR body. Write "unknown" when you did not find out.

- The time of the install and of each build command.

- Whether you used the Electron fallback.

- The probe text and the host process id from the log of the probe test that passed.

- The result line of the run with `DEEPWIDGETS_PROBE=off`.

- The lockfile diff stat.

## Files you may change `probe.round_trip.files`

- `deepwidgets/probe/client.js` (new)

- `deepwidgets/probe/cordis.patch.yml` (new)

- `deepwidgets/probe/index.js` (new)

- `deepwidgets/probe/package.json` (new)

- `pnpm-workspace.yaml` (only the `packages` list)

- `apps/cli/package.json` (only the new dependency)

- `packages/util/official-bundles/src/bundles.ts` (only the `web` entry)

- `pnpm-lock.yaml` (only the two probe entries)

- `tools/smoke-desktop.mjs`

- `CLAUDE.md` (only the `Commands` block)

After the build, `git status --short` must show only these paths. If build outputs show up as untracked files, stop and report them. Do not add them to `.gitignore`.

## Done when `probe.round_trip.done`

- Each check command gives its expected output.

- `git status --short` shows only the paths in `probe.round_trip.files`.

- The PR is open against `main`. Its title is `probe.round_trip: add the probe bundle and the probe test`.
