# Task `trace.host`

Read `docs/tasks/README.md` first. It holds the rules for every task.

## Goal `trace.host.goal`

Add the bundle `@deepwidgets/trace` with its host half, and add the trace test. The spec is `docs/specs/floating-widget.md` (spec `floating_widget`). The plan row is `trace.host` in `docs/plans/floating-widget.md`. The board `docs/canvas/floating-widget-processes.canvas` shows the processes and the message paths.

The host half does these things:

- It makes one snapshot message for each plugin row and each service that already exists.

- It listens to the Cordis events `internal/status` and `internal/service`, and makes one message for each change.

- It keeps all messages in memory, in order.

- It serves `GET /api/trace`, `POST /api/trace`, and `GET /trace`.

In this task, the "trace test" is the command `DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs`. It boots the app like the smoke check. Then it reads `/api/trace` from the main window page. It passes only when it finds the host service `webServer` in the state `up`.

This unit has no client half and no Electron main change. The units `trace.sources` and `trace.window` add them. Do not add them here.

## Setup `trace.host.setup`

| Item | Value |
|---|---|
| Base | `origin/main` at `b7f8f33c088f09c681161f82b76560405f9636f1` |
| Branch | `rohan/trace-host` |
| Worktree | `~/deepWidgets/.worktrees/rohan-trace-host` |
| Temporary files | `$TMPDIR/deepwidgets-trace-host/` |
| Machine | This Mac, with a display. The trace test opens app windows. |

```bash
git -C ~/deepWidgets fetch origin
git -C ~/deepWidgets merge-base --is-ancestor b7f8f33c origin/main ; echo "base exit=$?"   # must print exit=0
git -C ~/deepWidgets diff --name-only b7f8f33c origin/main                              # read the output
git -C ~/deepWidgets worktree add -b rohan/trace-host .worktrees/rohan-trace-host origin/main
```

If the second command does not print `exit=0`, stop.

The third command lists the files that changed after the base. Use these rules:

- If it prints nothing, continue.

- If each path is under `docs/` or `deepwidgets/trim/`, or is a file in `trace.host.trim`, continue. Then follow `trace.host.trim` in each step that it names.

- If it prints another path, stop and report the list.

## Read first `trace.host.read`

- `docs/specs/floating-widget.md`, all of it. The sections `floating_widget.sources`, `floating_widget.message`, `floating_widget.names`, and `floating_widget.transport` are the contract of this unit.

- `deepwidgets/probe/` is the bundle of `probe.round_trip`. The trace bundle has the same shape, but no client half.

- `packages/client/connection/src/rpc.ts`, near `ConnectionFetchRoute`. This is the type of the route for `/api/trace`.

- `packages/experimental/inspector/src/host/plugin.ts`, near `ctx.connection.fetch.register`. This is a DSH call of the same API.

- `packages/client/connection/src/http-bridge.ts`, the loop `for await (const chunk of response.body)`. After the client closes, this loop reads the body until the body ends. This is why the stream must close on abort.

- `packages/host/webserver/src/index.ts`, `register` and `serveResource`. A `resource` route answers only `GET` and `HEAD`.

- `vendor/cordis/src/events.ts`, the interface `Events`: `internal/status(fiber, oldValue)` and `internal/service(this: Context, name, value)`.

- `vendor/cordis/src/fiber.ts`, `FiberState`: `PENDING` 0, `LOADING` 1, `ACTIVE` 2, `FAILED` 3, `DISPOSED` 4, `UNLOADING` 5.

- `vendor/cordis/src/reflect.ts`: `props`, `store`, `get(name, strict)`, and `notify`. `notify` emits `internal/service`.

- `packages/host/plugin-inventory/src/index.ts`: it reads rows with `ctx.loader.entries()`.

- `docs/tasks/trim-profile.md`, `trim.profile.steps.host_rows`. The trace uses the same row key and the same `missing` expression.

- `tools/smoke-desktop.mjs`: `waitForRenderer`, `notePages`, `evaluate`, and `checkProbe`.

## Steps `trace.host.steps`

### Add the bundle files `trace.host.steps.bundle`

Make the folder `deepwidgets/trace/` with these three files.

1. `package.json`. Use the probe `package.json` as the model, with these changes:

   - `name` is `@deepwidgets/trace`.

   - `exports` has only `"."` (`./index.js`) and `"./package.json"`.

   - `dsh` has only `"bundle": { "patch": "./cordis.patch.yml" }`. Do not add `dsh.client`. The client half comes in `trace.sources`.

2. `cordis.patch.yml`. It inserts one host row:

   ```yaml
   - insert:
       - id: deepwidgets-trace
         name: '@deepwidgets/trace'
         disabled: !!js "process.env.DEEPWIDGETS_TRACE === 'off'"
   ```

3. `index.js`. This is the host half. `trace.host.steps.host_half` gives its behavior.

Run `find deepwidgets/trace -type f | wc -l`. It must print `3`.

### Write the host half `trace.host.steps.host_half`

Write `deepwidgets/trace/index.js` in plain JavaScript, like `deepwidgets/probe/index.js`. Use no package import. Export `inject` and `apply(ctx)`.

`inject` is `['webServer', 'connection', 'loader']`.

#### The message list `trace.host.steps.host_half.list`

1. Keep one array of messages for the life of the plugin.

2. To add a message, set `seq` to the array length plus 1, then push the message. Thus `seq` starts at 1 and goes up by 1.

3. Give each message the fields of `floating_widget.message`, in this order: `seq`, `time`, `process`, `window` (only for `client`), `kind`, `name`, `state`, `detail` (only when it has text), `snapshot` (only when it is `true`).

4. For a message that the host makes, `time` is `Date.now()` and `process` is `host`.

5. After you add a message, send it to each open stream (`trace.host.steps.host_half.stream`).

#### Plugin messages `trace.host.steps.host_half.plugins`

Keep this list of state words, in this order: `pending`, `loading`, `active`, `failed`, `disposed`, `unloading`. The word for state `n` is item `n` of the list. The reason is in `floating_widget.message`.

The row key of a host entry is this expression. The reason is in `floating_widget.names`. The skip test for a sub-plugin is the test in the `internal/plugin` listener of `vendor/loader/src/index.ts`.

```js
entry.id.startsWith('include:') ? entry.options.id : `name:${entry.options.name}`
```

The `detail` of a plugin message is `entry.options.name`. When the state is `pending` and services are missing, add the text ` waits for ` and the missing names. Join them with commas and no spaces, in sort order. The missing names come from the expression in `inactiveEntries` in `packages/boot/app-boot/src/index.ts`. `trim.profile.steps.host_rows` uses it too.

```js
Object.keys(fiber.inject).filter((service) => fiber.ctx.get(service) === undefined).sort()
```

Make the snapshot first:

1. Read each entry of `ctx.loader.entries()`.

2. Skip the root entry. Its `options.name` is `cordis:include`.

3. Skip each entry that has no `fiber`. This includes each disabled entry.

4. Add one message with `kind` `plugin`, the row key as `name`, the word of `entry.fiber.state` as `state`, and `snapshot: true`.

Then listen with `ctx.on('internal/status', (fiber) => { ... })`. For each event:

1. Read `fiber.entry`. Do not use `entry.fiber`. The reason is in `floating_widget.names`.

2. If `fiber.entry` is undefined, skip the event.

3. If `fiber.parent?.fiber?.entry === fiber.entry`, skip the event. This fiber is a sub-plugin of a row.

4. If `fiber.entry.options.name` is `cordis:include`, skip the event.

5. Add one message with `kind` `plugin`, the row key as `name`, and the word of `fiber.state` as `state`.

#### Service messages `trace.host.steps.host_half.services`

Keep a map from each service name to its last state, `up` or `down`.

Make the snapshot first:

1. Read each name in `ctx.reflect.props` whose value has `type === 'service'`.

2. The state is `up` when `ctx.reflect.get(name)` is not `undefined`. Else the state is `down`.

3. Put the state in the map. Add one message with `kind` `service`, the name, the state, and `snapshot: true`.

Then listen with `ctx.on('internal/service', function (name, value) { ... })`. Do not pass `{ global: true }`. The reason is in `floating_widget.sources`. For each event:

1. The state is `up` when `value` is not `undefined`. Else the state is `down`.

2. If the map already has this state for this name, skip the event. The Loader fires the event for `loader` once for each row.

3. Put the state in the map. Add one message with `kind` `service`.

#### Listener errors `trace.host.steps.host_half.errors`

Put the body of each listener in `try` and `catch`. In the `catch`, call `ctx.logger.warn('deepwidgets-trace: <listener name> failed', error)`. Do not throw. The reason: a listener that throws breaks the state change of the fiber (`floating_widget.sources`).

Make the snapshots and add both listeners in the same synchronous part of `apply`. Thus no event comes between the snapshot and the listeners.

#### The stream `trace.host.steps.host_half.stream`

Register one route with `ctx.connection.fetch.register`:

| Field | Value |
|---|---|
| `path` | `/api/trace` |
| `methods` | `['GET', 'POST']` |
| `requestBody` | `'buffered'` |
| `fetch` | For `POST`, the receive function in `trace.host.steps.host_half.post`. For `GET`, the stream function below. |

The register call disposes the route with the plugin. Do not wrap it in `ctx.effect`.

The stream function returns a `Response` with a `ReadableStream` body and these headers: `content-type: text/event-stream; charset=utf-8` and `cache-control: no-cache`. The stream does these things:

1. In `start`, send the comment line `: open` and a blank line at once. The bridge sends the headers with the first chunk.

2. Send each kept message, in order. A frame is `data: `, then `JSON.stringify(message)`, then two newline characters.

3. Add the stream to a set of open streams. Each new message goes to each open stream.

4. Every 15 seconds, send the comment line `: ping` and a blank line. The reason is in `floating_widget.transport`.

5. When `request.signal` aborts, remove the stream from the set, stop the ping timer, and close the controller. Catch the error if the controller is already closed. If the signal is already aborted in `start`, do this at once.

6. In `cancel`, remove the stream from the set and stop the ping timer.

7. Use `ctx.effect` to close each open stream when the plugin stops. Also stop each ping timer.

Look Before You Build: `better-sse` 0.16.1 can make this `Response`. Do not add it. The reason: this is one route, and each frame is one JSON line. The stream needs no channels, no retry, and no `Last-Event-ID`. Write this reason in one line in the PR body.

#### POST `trace.host.steps.host_half.post`

`POST /api/trace` takes a JSON array of messages from Electron main or from a client half. In this unit, no code sends them yet. The receive function does these things:

1. Read the body with `await request.json()`. If this throws, or the value is not an array, answer status 400 with the text `bad trace body`.

2. Check each item. An item is good when all these rules are true:

   - `process` is `main` or `client`. The host does not take `host` messages from outside.

   - For `client`, `window` is a string that is not empty. For `main`, `window` is absent.

   - `kind` is `step`, `plugin`, or `service`.

   - `name` is a string that is not empty.

   - For `step`, `state` is `done`. For `plugin`, `state` is one of the six state words. For `service`, `state` is `up` or `down`.

   - `time` is a finite number.

   - `detail` is absent or a string. `snapshot` is absent or a boolean.

3. If an item is not good, add no item. Answer status 400 with the text `bad trace message <index>`, where `<index>` is the index of the first bad item.

4. Else add each item as a new message. Copy only the fields of `floating_widget.message`, and set `seq` as in `trace.host.steps.host_half.list`.

5. Answer `Response.json({ added: <count> })` with status 200.

#### The page `trace.host.steps.host_half.page`

Register one route with `ctx.webServer.register({ kind: 'exact', path: '/trace', resource })`. Wrap it in `ctx.effect`, like the probe route. The resource returns a small HTML page with `content-type: text/html; charset=utf-8`. The page has the title `deepWidgets trace` and one element `<main data-deepwidgets-trace>trace window</main>`. The unit `trace.window` replaces this page.

### Register the package `trace.host.steps.register`

1. In `apps/cli/package.json`, add `"@deepwidgets/trace": "workspace:*",` to `dependencies`, after the `@deepwidgets/probe` entry. Change nothing else in that file.

2. In `packages/util/official-bundles/src/bundles.ts`, change the `web` entry to this text. Change nothing else in that file.

   ```ts
     web: {
       // deepwidgets-trim: probe.round_trip and trace.host add @deepwidgets/probe and @deepwidgets/trace to the web profile.
       // bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
       bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', '@deepwidgets/probe', '@deepwidgets/trace'],
     },
   ```

`pnpm-workspace.yaml` already lists `deepwidgets/*`. Do not change it.

### Install `trace.host.steps.install`

The new workspace package changes the lockfile. Thus the first install does not use `--frozen-lockfile`.

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack pnpm --version                          # must print 11.28.5
corepack pnpm install
git diff --stat pnpm-lock.yaml
corepack pnpm install --frozen-lockfile          # must exit 0
```

The lockfile diff must add only two entries. One entry is `@deepwidgets/trace` in the `apps/cli` importer. The other entry is the importer `deepwidgets/trace`. If the diff changes other lines, stop and report.

If `apps/desktop/node_modules/electron/dist` is missing, use the Electron fallback from `fork.baseline.steps.install`. Record that you used it. Then run the Git hook checks from `fork.baseline.steps.install`. Each check must give its expected output.

### Build `trace.host.steps.build`

```bash
corepack pnpm run build:artifacts
corepack pnpm --filter @deepseek-ai/dsh-desktop run build
```

Record the time of each command.

### Add the trace test to the smoke check `trace.host.steps.smoke`

Change `tools/smoke-desktop.mjs` in these ways. Use only Node built-in modules.

1. Find the main window page by an exact URL. In `waitForRenderer` and in `notePages`, replace `target.url.startsWith('dsh-app://app/')` with `target.url === 'dsh-app://app/'`. The reason: the trace window URL `dsh-app://app/trace` also starts with that text, and `/json/list` has no fixed order. The probe test then still uses the main window page.

2. Give `evaluate` a fourth parameter `awaitPromise`, with the default `false`. Pass it in the `Runtime.evaluate` params. The current calls do not change.

3. Run the trace step only when `DSH_SMOKE_TRACE` is `1`. Without this variable, the script must behave as before. Start it after the host check passes, and after the probe step when `DSH_SMOKE_PROBE` is also `1`.

4. In the trace step, until the deadline, evaluate one async expression in the main window page with `awaitPromise: true`. Wait 500 ms between two tries. Give each try at most 15 seconds. The expression returns a JSON string with the fields in `trace.host.steps.smoke.read`.

5. The trace step passes when each rule of `trace.host.steps.smoke.pass` is true in one try.

6. At the deadline, the result is `smoke-desktop: fail: trace: <reason>`, with the reason of the last try that returned a result. The reasons are in `trace.host.steps.smoke.pass`. If no try returned a result, the reason is `missing`.

7. If `evaluate` throws, write the error with `note`. Then wait and try again. This try gives no reason.

8. Write the result of each try to the log file with `note`.

9. In the comment at the top of the script, add one sentence about `DSH_SMOKE_TRACE=1`.

#### The page read `trace.host.steps.smoke.read`

The expression does these things in the page, and returns these fields:

| Field | How the expression gets it |
|---|---|
| `status`, `type` | `fetch('api/trace', { signal })` with an `AbortController` that aborts after 10 seconds. The status, and the `content-type` header. |
| `count`, `seqOk`, `found`, `processes` | Read the body with a reader and a `TextDecoder`. Split frames on a blank line. Parse each `data: ` line as JSON. Count the messages. `seqOk` is `true` when the `seq` of message `n` is `n`. `processes` is the list of the `process` values. `found` is `true` when a message has `process` `host`, `kind` `service`, `name` `webServer`, and `state` `up`. Stop when `found` is `true`, then call `abort()`. |
| `page`, `pageType` | `fetch('trace')`. The status, and the `content-type` header. |
| `postEmpty` | The status of a `POST` to `api/trace` with the body `[]` and the header `content-type: application/json`. |
| `postBad` | The status of the same `POST` with the body `[{"process":"host"}]`. |
| `error` | The text of a caught error, else absent. |

The spike function `spikeFetch` in `~/deepWidgets/.worktrees/rohan-spike-trace-sse/tools/smoke-desktop.mjs` reads a stream in the same way. You can read it. Do not edit that worktree, and do not copy its other spike code.

#### Pass rules `trace.host.steps.smoke.pass`

Check the rules in this order. The first rule that is false gives the reason.

| Rule | Reason when false |
|---|---|
| `status` is 200 | `status <status>` |
| `type` starts with `text/event-stream` | `content type <type>` |
| `seqOk` is `true` | `seq out of order` |
| `found` is `true` | `no host service webServer up in <count> messages` |
| `page` is 200 and `pageType` starts with `text/html` | `page status <page>` |
| `postEmpty` is 200 and `postBad` is 400 | `post status <postEmpty>,<postBad>` |

When `error` has text and no rule is false before `found`, the reason is `error <error>`.

### Fill in `CLAUDE.md` `trace.host.steps.head`

Change only these parts of the root `CLAUDE.md`:

1. In `head.map`, add this row after the `docs/plans/` row:

   ```markdown
   | `docs/canvas/` | JSON Canvas boards that show how a system works, such as `floating-widget-processes.canvas`. |
   ```

2. In `head.status`, change the value of the row `Our packages` to this text:

   ```markdown
   `deepwidgets/probe` (merged). `deepwidgets/trace` (host half merged). `deepwidgets/trim` (planned).
   ```

3. In `head.status`, add this sentence at the end of the value of the row `Checks`:

   ```markdown
   With `DSH_SMOKE_TRACE=1`, it also runs the trace test.
   ```

4. In `head.commands`, add `DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs` after the line `DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs`.

`head.why` gives the count of composed rows. The trace row makes it wrong. Do not change it in this unit. Write the new count under `Findings` (`trace.host.findings`).

### Merge with `trim.profile` `trace.host.trim`

The unit `trim.profile` changes some of the same files. Use this section only when `trim.profile` is in `origin/main`, before you start or while your PR is open. To get its changes, run `git merge origin/main`. Do not rebase.

| File | Rule |
|---|---|
| `apps/cli/package.json` | Keep both dependency lines. |
| `packages/util/official-bundles/src/bundles.ts` | Keep both entries. `@deepwidgets/trim` stays last in the `web` list, as its task file says. Put `@deepwidgets/trace` before it. Keep one `deepwidgets-trim` marker for the `web` entry, and name all the units that changed it. |
| `pnpm-lock.yaml` | Do not edit it by hand. Take the `origin/main` side with `git checkout --theirs pnpm-lock.yaml`. Then run `corepack pnpm install --lockfile-only` and `corepack pnpm install --frozen-lockfile`. |
| `tools/smoke-desktop.mjs` | Keep the rows check and the trace step. The rows check must use the exact main page URL of `trace.host.steps.smoke`. |
| `CLAUDE.md` | Keep both lines in `head.commands` and both changes in `head.status`. |
| `deepwidgets/trim/rows.host.txt` | Add the line `deepwidgets-trace # trace.host: the host half of the trace window`. |
| `docs/tasks/trim-profile.md` | Do not change it. Its partition count is 196. With the trace row, the count is 197. Write this under `Findings`. |

The trim patch names rows by id. Thus it does not turn off the new trace row.

### Run the checks `trace.host.check`

Run each command in the worktree. Capture each exit code.

```bash
DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "trace exit=$?"                                  # must print pass and exit=0
DSH_SMOKE_TRACE=1 DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs ; echo "trace off exit=$?"        # must print "fail: trace: status 404" and exit=1
DEEPWIDGETS_TRACE=off node tools/smoke-desktop.mjs ; echo "smoke trace off exit=$?"                    # must print pass and exit=0
DSH_SMOKE_PROBE=1 DSH_SMOKE_TRACE=1 node tools/smoke-desktop.mjs ; echo "probe trace exit=$?"          # must print pass and exit=0
DSH_SMOKE_PROBE=1 node tools/smoke-desktop.mjs ; echo "probe exit=$?"                                  # must print pass and exit=0
node tools/smoke-desktop.mjs ; echo "smoke exit=$?"                                                    # must print pass and exit=0
DSH_SMOKE_TIMEOUT_MS=1000 node tools/smoke-desktop.mjs ; echo "short exit=$?"                         # must print fail and exit=1
git grep -c deepwidgets-trim -- packages/util/official-bundles/src/bundles.ts                          # must print bundles.ts:1
```

The second command proves that the trace test can fail. `DEEPWIDGETS_TRACE=off` disables the trace host row. Thus `/api/trace` falls to the `/api` prefix of `client-connection`, which answers 404. The third command proves that the app still works without the trace row. The second command waits until the deadline, so it takes about 4 minutes.

If `trim.profile` is in your base, also run its rows check from `head.commands`. It must print pass and exit 0.

If a check gives a result that is not its expected result, use `tasks.protocol.stop`.

## Findings to record `trace.host.findings`

Put these items in the `Findings` section of the PR body. Write "unknown" when you did not find out.

- The time of the install and of each build command.

- Whether you used the Electron fallback.

- The lockfile diff stat.

- From the log of the trace test that passed: the message count, and the `seq` of the `webServer` `up` message.

- The result line of the run with `DEEPWIDGETS_TRACE=off`.

- The number of plugin messages and of service messages in the snapshot, from the log.

- The new count of composed rows for `head.why`.

- Whether you used `trace.host.trim`, and each conflict that you resolved.

## Files you may change `trace.host.files`

- `deepwidgets/trace/package.json` (new)

- `deepwidgets/trace/cordis.patch.yml` (new)

- `deepwidgets/trace/index.js` (new)

- `apps/cli/package.json` (only the new dependency)

- `packages/util/official-bundles/src/bundles.ts` (only the `web` entry)

- `pnpm-lock.yaml` (only the two trace entries)

- `tools/smoke-desktop.mjs`

- `CLAUDE.md` (only the parts in `trace.host.steps.head`)

- `deepwidgets/trim/rows.host.txt` (only when you use `trace.host.trim`)

After the build, `git status --short` must show only these paths. If build outputs show up as untracked files, stop and report them. Do not add them to `.gitignore`.

## Done when `trace.host.done`

- Each check command gives its expected output.

- `git status --short` shows only the paths in `trace.host.files`.

- The PR is open against `main`. Its title is `trace.host: add the trace host half and the trace test`.
