# Fixes from the formal check `widget_fv`

On 2026-11-03, three TLA+ models checked the widget code at commit `38df710e`. The models are `crash_lifecycle`, `action_contract`, and `widget_install`. The skill `widget-state-models` keeps them and tells an agent how to run them again. Each rule in this spec broke in a model. A replay on the real code showed each break.

This spec adds rules to `widget_mvp.runtime.contract` and `widget_phase2`. When this spec and those specs do not agree, this spec wins.

## Action contract `widget_fv.action`

These rules add to `widget_mvp.runtime.contract`.

- A call that gives `timeout` wrote nothing. After the write of a call starts, the timeout does not stop the call. The call gives its real result when the write settles.

- The queue slot of a call frees only after its write settles. Thus two writes of one slug never overlap.

- The state record and the request record of a mutation land in one storage write. A crash between two writes can not occur. One way to do this is to keep the request records of a slug in its state record.

- A call that wrote gives a request record. A retry of that call gives `replayed: true` and does not write again.

The replay found these breaks at `deepwidgets/widgets/src/index.ts`, lines 635, 648 to 696, 718, and 774 to 791.

## Install records `widget_fv.install`

These rules add to `widget_phase2.creation`.

- The seed hash is in the program record of the slug. Thus the program and its seed hash land in one write. The file `.seeds/<slug>` is not used.

- A rolled-back install leaves the stored program and its seed hash as they were before the install.

- A quarantine ends only when files with a different hash register with success. Files with the blamed hash never run. A failed install and its rollback do not end a quarantine.

- Safe mode turns an agent widget off for one host start. `widget_install` and `widget_remove` of an agent slug clear its off entry. Only a live widget that is not an agent bundle makes `widget_install` give `slug-taken`.

The replay found these breaks at these lines:

- `deepwidgets/mcp/src/creation.ts`: 520, and 545 to 573

- `deepwidgets/widgets/src/index.ts`: 863 to 891, and 933

- `deepwidgets/widgets/src/isolation.ts`: 199 to 203

## Replace `widget_fv.replace`

This section closes the open point `standing.hard.replace` of `widget_phase2.open`.

- A failed reinstall keeps the old version live. The installer installs the new version under a second package name. It removes the old version only after the new version registers with success.

The replay found this break at `deepwidgets/mcp/src/creation.ts` lines 566 to 573.

## Crash records `widget_fv.crash`

These rules add to `widget_phase2.isolation`.

- A provisional record exists only while the widget call that it names runs. When the call returns, the runtime removes the record.

- Each host exit that is not an abort discards the provisional record. This rule also applies before the host is ready, and when the exit has no process ID.

- A crash record of an agent widget always has the root and the hash of its files. This rule also applies when the widget throws before it registers.

The replay found these breaks at these lines:

- `deepwidgets/widgets/src/watchdog-worker.ts`: 150 to 156

- `apps/desktop/src/deepwidgets-supervisor.ts`: 95 to 97, 153, and 159

- `apps/desktop/src/host-process.ts`: 229 and 361

- `deepwidgets/widgets/src/isolation.ts`: 202, 257, and 290

## Watchdog check `widget_fv.watchdog_check`

- The `oom` case of `tools/widgets-watchdog.mjs` checks the result, not the path. Both paths blame the widget and quarantine it. The stall kill and the out-of-memory abort are both correct paths.

## Open points `widget_fv.open`

- Built-in widgets. A built-in widget, such as `sample`, can be quarantined today. No spec says if that is correct. The operator decides.

- Watchdog threshold. On 2026-11-02 at 17:15, the watchdog stopped a healthy host. The event loop stalled for 2061 ms with no widget call, while the machine was busy. The crash counted as unblamed. A different threshold or a different stall test needs a spike before a decision.
