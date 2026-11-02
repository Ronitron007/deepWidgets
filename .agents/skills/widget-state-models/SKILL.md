---
name: widget-state-models
description: Check a deepWidgets change against the TLA+ models crash_lifecycle, action_contract, and widget_install. Use for each change to a file that these models cover. These files are the crash supervisor and policy, the isolation, the watchdog, the widget call queue, the storage-domain write chain, and the install tools. Use it also when you fix a finding of spec widget_fv.
---

# Widget state models `widget_state_models`

This skill keeps three TLA+ models of the widget runtime. A model is a small description of the code as states and steps. The TLC model checker tries every order of steps in the model, up to set bounds. A rule is a sentence that must be true in each state. When TLC finds a state that breaks a rule, it gives the shortest path of steps to that state.

You do not need to read TLA+ to use this skill. The tables below give each rule in plain words. The `/statechart` skill runs TLC and tells each bug path in plain words.

## When to use this skill `widget_state_models.when`

Use this skill when your change touches a file in `widget_state_models.coverage`. Use it also when you fix a finding of the spec `widget_fv` (`docs/specs/widget-fv.md`).

To see if the covered code changed after the sync commit, run this command:

```bash
git diff --stat 38df710e HEAD -- apps/desktop/src/deepwidgets-supervisor.ts apps/desktop/src/deepwidgets-crash-policy.ts apps/desktop/src/host-process.ts apps/desktop/src/main.ts apps/desktop-host/src/index.ts deepwidgets/widgets/src/isolation.ts deepwidgets/widgets/src/watchdog.ts deepwidgets/widgets/src/watchdog-worker.ts deepwidgets/widgets/src/index.ts deepwidgets/mcp/src/creation.ts packages/storage/storage-domain/src/domain.ts packages/boot/plugin-manager/src/index.ts
```

## Sync commit `widget_state_models.sync`

The sync commit is `38df710e`. At this commit, each model describes the covered code. Each line number in this skill and in the models is a line at this commit.

Move the sync commit only after you confirm that each model still describes the code at the new commit. To confirm it, do these steps:

1. Read the diff of each covered file from the sync commit to the new commit.

2. For each changed line, find the model step that cites that line or its function.

3. Change the model step when the code behavior changed. Change the line numbers in the comments when only the lines moved.

4. Run each model (`widget_state_models.rerun`). Get the baseline result, or a result that you can explain by the change.

5. Change the commit in this section, in `widget_state_models.when`, and in `widget_state_models.coverage`.

## Coverage `widget_state_models.coverage`

Each model covers these files and functions. The line ranges are at the sync commit.

### `crash_lifecycle`

| File | Functions and lines |
|---|---|
| `apps/desktop/src/deepwidgets-supervisor.ts` | `discardProvisionalRecord` 36-44, `hostPidOf` 47-50, `blamedRow` 58-63, `abortedExit` 76-79, `blamedByRecords` 87-98, `DesktopHostSupervisor` 108-193 (`ready` 142-145, `failed` 152-184, `dispose` 187-192) |
| `apps/desktop/src/deepwidgets-crash-policy.ts` | `HostCrashPolicy` 27-52 (`crash` 38-51), and the constants 8-16 |
| `deepwidgets/widgets/src/isolation.ts` | the quarantine contract 1-12, `runAs` 81-83, `createIsolation` 167-299 (the record apply at boot 176-197, `held` 199-209, `wrap` 218-232, `claim` 251-278, `track` 290-296) |
| `deepwidgets/widgets/src/watchdog.ts` | `inSlot` 40-49, `startWatchdog` 92-146 (the heartbeat 123, `track` 139-144) |
| `deepwidgets/widgets/src/watchdog-worker.ts` | `recordOf` 108-122, `removeProvisional` 125-130, the poll loop 145-200 |
| `deepwidgets/widgets/src/index.ts` | `SAFE_MODE_ENV` and `BUILT_IN_WIDGET_FOLDERS` 37-45, safe mode in `apply` 504, `add` 874-913 |
| `apps/desktop/src/host-process.ts` | `DesktopHostProcess.start` 199-257 (229, 251-252), `fail` 356-367 |
| `apps/desktop/src/main.ts` | the safe-mode environment 499, `supervisor.ready` and `supervisor.failed` 575-576 |
| `apps/desktop-host/src/index.ts` | the IPC `fatal` message of a failed boot 150-160 |

### `action_contract`

| File | Functions and lines |
|---|---|
| `deepwidgets/widgets/src/index.ts` | in `apply` 501-992: `admit` 525-532, `guarded` 539-541, the drain effect 543-558, `opened` 607-610, `enqueue` 621-642, `write` 645-660, `update` 667-677, `execute` 681-708, `runAction` 710-727, `call` 729-760, `runOnce` 763-784, `remember` 787-792, the service methods 984-987 |
| `packages/storage/storage-domain/src/domain.ts` | `DomainImpl.close` 251-254, `runClose` 256-264, the write chain `enqueue` 283-300, `KvTableImpl.put` 340-346, `update` 387-400 |

### `widget_install`

| File | Functions and lines |
|---|---|
| `deepwidgets/mcp/src/creation.ts` | `runGates` 363-382, `WidgetInstaller` 425-575 (`serial` 433-437, `seedFile` 448-450, `lastSeed` 453-460, `waitLive` 471-478, `install` 481-483, `reload` 486-492, `remove` 494-504, `installNow` 506-574) |
| `deepwidgets/widgets/src/index.ts` | `WidgetsService` 302-396 (313), safe mode in `apply` 504-505, `call` 729-760, `setProgram` 795-804, `seed` 863-871, `add` 874-913, `list` 933-936 |
| `deepwidgets/widgets/src/isolation.ts` | the quarantine contract 1-12, `held` 199-209 |
| `packages/boot/plugin-manager/src/index.ts` | `installBundle` 836-965, `removeBundle` 1000-1032 |

## Rules and findings `widget_state_models.rules`

"Breaks" means that TLC finds a path to a state where the rule is false. The breaks below are the findings of the spec `widget_fv`. A replay on the real code showed each break. When a fix of `widget_fv` lands, its rule must hold.

### `crash_lifecycle` rules

| Rule | Plain sentence | Today | Spec section |
|---|---|---|---|
| `BlamedCrashNeverCounts` | A crash that blames a widget never counts toward safe mode or the give-up. | holds | |
| `SafeModeAfterTwo` | Two unblamed crashes in the window start safe mode, and the next Host starts in safe mode. | holds | |
| `GiveUpAtFour` | Four unblamed crashes in the window make the supervisor give up. | holds | |
| `NoRestartAfterGiveUp` | After the give-up, the supervisor never starts the Host again. | holds | |
| `QuarantinedNeverRuns` | A quarantined agent widget does not run until the hash of its files changes. | holds | |
| `RecordOnlyBlamesItsHost` | A stale record never blames a later crash. | holds | |
| `ProvisionalGoneAfterBeat` | The provisional record is gone when the heartbeat comes back. | holds | |
| `HashChangeLifts` | After the hash of its files changes, a quarantined widget can run again. | breaks | `widget_fv.crash` |
| `ProvisionalOnlyOnAbort` | A provisional record blames a widget only after an abort. | breaks | `widget_fv.crash` |
| `InnocentNeverQuarantined` | A widget whose code did not run when its Host died is never quarantined. | breaks | `widget_fv.crash` |
| `SampleNeverQuarantined` | The built-in `sample` is never quarantined. | breaks | `widget_fv.open`, built-in widgets |
| `SampleLiveInSafeMode` | The built-in `sample` is live in safe mode. | breaks | `widget_fv.open`, built-in widgets |

### `action_contract` rules

| Rule | Plain sentence | Today | Spec section |
|---|---|---|---|
| `ReplaySameResult` | Each replay of a request gives the recorded result. | holds | |
| `ReplayFlag` | A replay gives `replayed: true`, and a fresh run does not. | holds | |
| `ConflictOnOtherArgs` | Other arguments under one request ID give `idempotency-conflict`. | holds | |
| `FIFO` | Mutations and updates of one slug start in the order that they arrive. | holds | |
| `QueryNoQueue` | A query does not wait in the queue. | holds | |
| `BusyNeverRuns` | A call that gives `busy` does not run. | holds | |
| `NoAdmitAfterStop` | The runtime admits no call after the stop starts. | holds | |
| `DrainBeforeClose` | Each admitted call ends before the storage domain closes. | holds | |
| `RevCountsWrites` | The state revision counts the state writes. | holds | |
| `NoLateWrite` | A call that gives `timeout` writes nothing. | breaks | `widget_fv.action` |
| `OneAtATime` | Two writes of one slug never overlap. | breaks | `widget_fv.action` |
| `AtMostOnce` | A retried call with one request ID writes once, also after a host restart. | breaks | `widget_fv.action` |

### `widget_install` rules

| Rule | Plain sentence | Today | Spec section |
|---|---|---|---|
| `GatesGuardHost` | Code that fails a gate never reaches the host. | holds | |
| `StateKept` | The state of a slug stays after install, replace, reload, and remove. | holds | |
| `BuiltInUntouched` | An agent tool never replaces or removes a built-in widget. | holds | |
| `OneBundlePerSlug` | At most one live bundle registers a slug. | holds | |
| `NewSeedSetsProgram` | After an install with a new seed program, the stored program is the new seed. | breaks | `widget_fv.install` |
| `SameSeedKeepsProgram` | After an install with the same seed, an edited stored program stays. | breaks | `widget_fv.install` |
| `SlugTakenOnlyForBuiltIn` | `widget_install` gives `slug-taken` only when a live widget that is not an agent bundle has the slug. | breaks | `widget_fv.install` |
| `QuarantineHolds` | A quarantined widget comes back only when the hash of its files changes. | breaks | `widget_fv.install` |
| `FailedReplaceKeepsOld` | A failed reinstall keeps the old version live. | breaks | `widget_fv.replace` |

Each model also has `TypeOK` and `NoDeadlock`. These rules check the model itself, and they hold.

## Files `widget_state_models.files`

Each model folder has these files:

- The spec: `crash_lifecycle/crash_lifecycle.tla`, `action_contract/ActionContract.tla`, or `widget_install/WidgetInstall.tla`. Each step cites the code lines that it describes.

- The configs (`.cfg`). Each config sets the bounds and the rules of one run.

- The view, `view.mjs`. It gives the words of the chart and the bug paths for `/statechart`.

- The replays. A replay runs a bug path on the real code.

The file `check.mjs` lists the runs of each model. It also compares the reports of `/statechart` with the baseline.

## Run the models `widget_state_models.rerun`

TLC checks the rules that break and the rules that hold in different runs. After the first break, `/statechart` stops each run at 100,000 states. Thus each model has more than one run.

To run one model, do these steps:

1. List the runs of the model:

   ```bash
   node .agents/skills/widget-state-models/check.mjs crash_lifecycle
   ```

2. Make a new out folder outside the repository, for example `$TMPDIR/widget-state-models/<date>/crash_lifecycle`. Do not reuse an out folder.

3. For each listed run, run `/statechart` on the spec of the model, with the listed config and the model's `view.mjs`. Put the result in `<out folder>/<run name>`.

4. Compare the reports with the baseline:

   ```bash
   node .agents/skills/widget-state-models/check.mjs crash_lifecycle <out folder>
   ```

Use `action_contract` or `widget_install` in place of `crash_lifecycle` for the other models. Exit code 0 means that each run gives the baseline. Exit code 1 means that a rule result changed. The output names the run and the rule. Exit code 2 means that a report is missing.

On an idle Mac, the runs take about 2 minutes for `crash_lifecycle`, 4 minutes for `action_contract`, and 7 minutes for `widget_install`. The runs `idem-hold` and `two-slugs` take the most time. When other jobs load the machine, the runs can take three times as long.

Each model also has mutant runs. A mutant run uses a broken variant of the model, and its rule must break. Thus the mutant runs show that the rules can fail. To add the mutant runs, add `--mutants` to both commands. Only `action_contract` and `widget_install` have mutant runs.

## Read a result `widget_state_models.read`

Read each report with `/statechart`. The report gives each bug path as numbered steps in plain words.

A rule can break for two reasons:

- The code has a bug. The real code does the same steps and gets the same bad state.

- The model is wrong. The model does a step that the code cannot do, or it leaves out a step that the code does.

To find the reason, replay the path on the real code (`widget_state_models.replay`). Do one replay step for each model step. If the bug does not occur, think that the model is wrong until you show that it is not. Do not weaken a rule to make it hold. Do not change product code to make a rule hold unless your task tells you to.

## Replay a path on the real code `widget_state_models.replay`

The replays use the code of the checkout that holds this skill. Each replay makes its own work folder in the system temporary folder. The replays do not use port 47615.

Before a replay, install and build:

```bash
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0 OPENUI_TELEMETRY_DISABLED=1
corepack pnpm install --frozen-lockfile
corepack pnpm run build:artifacts
```

| Model | Command | Paths that it replays |
|---|---|---|
| `crash_lifecycle` | `node_modules/.bin/vitest run --root .agents/skills/widget-state-models/crash_lifecycle/replay` | `InnocentNeverQuarantined`, `ProvisionalOnlyOnAbort` (two paths), `HashChangeLifts` and its control, `SampleNeverQuarantined` with `SampleLiveInSafeMode` |
| `action_contract` | `node .agents/skills/widget-state-models/action_contract/replay.mjs <crash\|late\|overlap\|natural>` | `crash`: `AtMostOnce` after a restart. `late`: `NoLateWrite`, and `AtMostOnce` with no restart. `overlap`: `OneAtATime`. `natural`: `NoLateWrite` with no patched disk, in 400 calls near the timeout. |
| `widget_install` | `node .agents/skills/widget-state-models/widget_install/replay/replay-<name>.mjs` | `newseed`: `NewSeedSetsProgram`. `sameseed`: `SameSeedKeepsProgram`. `quarantine`: `QuarantineHolds`. `replace`: `FailedReplaceKeepsOld`. `builtin`: `BuiltInUntouched` and `OneBundlePerSlug`. `safe`: `SlugTakenOnlyForBuiltIn`, in a safe-mode host start. |

The `crash_lifecycle` replays assert the bad behavior that the code has at the sync commit. Thus a fix of `widget_fv.crash` makes them fail. The `action_contract` replays print `CONFIRMED` when the bug occurs. The `widget_install` replays print the facts of each step.

When a fix lands, change the replay of its rule so that it asserts the correct behavior.

## Change a model `widget_state_models.change`

When your change to covered code is intended, change the model in the same pull request. Do these steps:

1. Find each step in the spec that cites a changed line or function.

2. Change that step so that it does what the new code does. Keep one model step for each indivisible step of the code. An await is the end of a step.

3. Do not change a rule to make it hold. Change a rule only when the spec of the product changes, and cite the spec section.

4. Run the model (`widget_state_models.rerun`).

5. If a rule result changed, replay the path on the real code (`widget_state_models.replay`).

6. If the change is correct, change the baseline in `check.mjs` and the rule tables in this file.

For example, assume that you remove the pid match from `blamedRow` and `blamedByRecords` in `apps/desktop/src/deepwidgets-supervisor.ts`. Then change the model step `HostFails` in `crash_lifecycle.tla`. The value `own` loses the test `crash.pid = pid`, and the value `prow` loses the test `prov.pid = pid`. The `holds` run of `crash_lifecycle` then shows that `RecordOnlyBlamesItsHost` breaks.

## Scope `widget_state_models.scope`

A pass covers the model and its bounds only. It does not cover the full system. Read the bounds in each config, for example `MaxHosts = 4` or `Jobs = {"A1", "A2", "U1"}`.

The models leave out these items:

- `crash_lifecycle`: real time. A tick is a quarter of the watchdog threshold. The model has one agent widget and the built-in `sample`.

- `action_contract`: one slug and one request key. The storage write is one step for each await of the domain chain.

- `widget_install`: one agent slug in most runs, and two slugs in the run `two-slugs`. The plugin manager is one step for each await of `installBundle` and `removeBundle`.
