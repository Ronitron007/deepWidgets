# Widget phase 2 `widget_phase2`

This spec builds the items of `widget_mvp.later` on top of the MVP (`docs/specs/widget-mvp.md`). The decisions are `widget.isolation`, `widget.dev_gates`, `widget.typed`, and `widget.mcp_v1` in `docs/explore/widget-system/where-we-stand.md`. Two spikes proved each part. Their code is on local branches of the planning machine:

| Spike | Branch and commit | Notes |
|---|---|---|
| crash-only host | `rohan/spike-crash-only` at `19039136` | the scratchpad folder `crash-only/` (`standing.checked.crash_only`) |
| gates under hot reload | `rohan/spike-dev-gates` at `a7c6a12d` | the scratchpad folder `dev-gates/` (`standing.checked.dev_gates`) |

The spike code is plain JavaScript and goes in behind flags. Port it to TypeScript in the MVP packages, with no flags.

## Isolation `widget_phase2.isolation`

### Blame at exit `widget_phase2.isolation.blame`

- The runtime runs each widget call, timer callback, and listener that it owns inside an AsyncLocalStorage store that names the widget.

- On `uncaughtException` or `unhandledRejection`, a claimer reads the store. If the store is empty, it matches the stack against the files of each widget bundle.

- The claimer writes the crash record `$DSH_HOME/deepwidgets/crash.json` with a synchronous write: the slug, the error, the time, the blame method, and the hash of the widget files.

- Then the host exits at once. It does not resume, and it does not wait for the DSH fail-loud cleanup. That cleanup takes about 2.9 s on the desktop host (`standing.checked.crash_only`).

### Watchdog `widget_phase2.isolation.watchdog`

- A worker thread shares a `SharedArrayBuffer` with the main thread. The main thread bumps a heartbeat slot on a timer. The runtime writes the id of the running widget into a second slot before it calls widget code, and it clears the slot after.

- When the heartbeat stalls past the threshold (default 2 s), the watchdog writes the crash record and kills the host. At a quarter of the threshold, it writes a provisional record, so an out-of-memory abort is blamed too (`standing.checked.dev_gates`). It removes the provisional record when the heartbeat comes back.

- When `@sentry/node-native-stacktrace` loads, the watchdog uses it to read the stuck thread's stack and store. When it does not load, the watchdog uses the slot only. Without it, a loop in a raw timer or after an `await` is not blamed.

### Supervisor `widget_phase2.isolation.supervisor`

- Electron main restarts a host that exits unexpectedly, with a backoff of 0.5 s, 2 s, and 8 s.

- The restarted host reads the crash record. It does not load the blamed widget, and it shows that widget as failed with the reason. A blamed crash does not count toward safe mode or the give-up.

- A quarantined widget comes back when the hash of its files changes.

- After 2 unblamed crashes in 60 s, the host starts in safe mode: each agent widget is off. After 4 crashes in 60 s, Electron main shows the DSH fatal dialog.

## Creation `widget_phase2.creation`

### Gates `widget_phase2.creation.gates`

`widget_install` runs these gates in order. Code that fails a gate never reaches the host.

1. Compile the bundle with esbuild into a staging folder.

2. Lint and type-check it with oxlint (type-aware) and the widget type file. The rules refuse a raw `setTimeout`, `setInterval`, or `setImmediate`, a floating promise, and `while (true)` with no exit.

3. Run the bundle in a throwaway process with a 256 MB heap limit: run `apply`, call each action once, and let timers run for 1.5 s.

Then copy the staged build into a folder that the profile owns, and install it with the plugin manager (`hmr` applies it at once).

### Tools `widget_phase2.creation.tools`

| Tool | Job |
|---|---|
| `widget_template` | Gives the files of the TypeScript widget template |
| `widget_guide` | Gives the OpenUI guide for the component set and the widget API |
| `widget_install(dir)` | Runs the gates and installs. A second install of one slug replaces the bundle, and the state stays. |
| `widget_reload(slug)` | Runs the gates on the changed files and recomposes |
| `widget_remove(slug)` | Removes the bundle. The state stays. |

Each failure gives `code`, `message`, the gate, the diagnostics, and `nextStep`.

## Fixed port `widget_phase2.mcp_port`

- The host web server binds a fixed port from the settings. If the port is taken, the app fails loudly at start (`widget.mcp_v1`).

- The host writes the port and a random server nonce to `$DSH_HOME/deepwidgets/mcp.json`. An agent checks the nonce in the `/mcp/token` answer before it sends a token (`standing.hard.port_squat`).

## Open points `widget_phase2.open`

- `standing.waiting.create_tools`: five tools or one tool with `op`. This spec uses five tools.

- The native stack addon has no Electron prebuild. A packaged app is not checked.

- The second-package-name replace of `standing.hard.replace` is not built. A failed reinstall can leave no version.
