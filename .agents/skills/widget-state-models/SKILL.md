---
name: widget-state-models
description: Check a deepWidgets change against the TLA+ models crash_lifecycle, action_contract, and widget_install. Use for each change to a file that these models cover. Some of these files are in apps/desktop (the crash supervisor and policy, host-process.ts, main.ts) and apps/desktop-host. The others are in deepwidgets/widgets, deepwidgets/mcp (the install tools), the storage domain, and the plugin manager. Use it also when you fix a finding of spec widget_fv.
---

# Widget state models `widget_state_models`

This skill keeps three TLA+ models of the widget runtime. A model is a small description of the code as states and steps. The TLC model checker tries every order of steps in the model, up to set bounds. A rule is a sentence that must be true in each state. When TLC finds a state that breaks a rule, it gives the shortest path of steps to that state.

You do not need to read TLA+ to use this skill. The tables below give each rule in plain words. The `/statechart` skill runs TLC and tells each bug path in plain words.

## When to use this skill `widget_state_models.when`

Use this skill when your change touches a file in `widget_state_models.coverage`. Use it also when you fix a finding of the spec `widget_fv` (`docs/specs/widget-fv.md`).

To see if the covered code changed after the sync commit of a model, run this command. Use the sync commit of the model (`widget_state_models.sync`) in place of `<sync>`:

```bash
git diff --stat <sync> HEAD -- apps/cli/src/profile-boot.ts apps/desktop/src/deepwidgets-supervisor.ts apps/desktop/src/deepwidgets-crash-policy.ts apps/desktop/src/host-process.ts apps/desktop/src/main.ts apps/desktop-host/src/index.ts deepwidgets/widgets/src/isolation.ts deepwidgets/widgets/src/watchdog.ts deepwidgets/widgets/src/watchdog-worker.ts deepwidgets/widgets/src/index.ts deepwidgets/mcp/src/creation.ts packages/storage/storage-domain/src/domain.ts packages/boot/plugin-manager/src/index.ts
```

## Sync commit `widget_state_models.sync`

Each model has its own sync commit. At its sync commit, a model describes the covered code. Each line number of a model, and of its coverage table in this skill, is a line at the sync commit of that model.

| Model | Sync commit | Note |
|---|---|---|
| `crash_lifecycle` | `widget.crash_records` (see the note) | The unit `widget.crash_records` fixed `widget_fv.crash` and added `safe_host.watchdog` and `safe_host.cleanup`. The root of a record comes from the Loader row (`noteRow`), so `Record` always has the hash. A call that returns removes its provisional record (`FinishWidget`). The supervisor discards the provisional record before its other checks, also when it is not armed, and each failure has the pid (`HostFails`, `BootFail`). The stall limit is `T` with a widget in the slot and `TIdle` with slot 0 (`PollStall`, `WatchdogKill`). An uncaught error ends with exit 1 or with the SIGKILL of the dispose deadline (`Throw`). Before that unit, the sync commit was `c254b9df`: the unit `widget.install_records` changed `held`, and added `lift`, `holdLift`, and `settleLift` in `isolation.ts`. The model has no install, so a load with success lifts the quarantine. The unit `widget.install_replace` added the second package name, `host.failed`, and the fallback in `isolation.ts` and `index.ts`. The model has no install and one package name, so these changes do not change its steps. The other covered lines only moved. |
| `widget_install` | `c254b9df` | The unit `widget.crash_records` moved the covered lines of `index.ts` after line 1373 by 4 lines. It also changed `entry.end` in `start`: during the dispose at a crash, an entry ends with no `removed` event and no standby takes the slug. The model ends a host in one step at a crash, so its steps do not change. The fix of `widget_fv.replace` (unit `widget.install_replace`), on top of the fix of `widget_fv.install` and `widget.builtin_slugs`. Each agent slug has two package names. A replace installs the new version under the free name, the new registration waits as the standby of the old entry, the new name is committed, and the old bundle goes last. At a Host start, the row of the committed name owns the slug. Review round 1 added the committed name and the bundle with the older row id. Review round 2 added the fallback and the rule that an install never removes the last good version. The `BuiltIn` branch of `Step` is the behavior at `aa7cd518`. The code does not reach it, because the slug of a built-in widget is reserved. Only the mutants `offAllowed` and `builtinRow` reach it. The last commit of #82 (`afa46cca`) added only a `nextStep` text to an error in `creation.ts`. The covered lines moved by 3 to 5 lines. |
| `action_contract` | `c254b9df` | The unit `widget.crash_records` moved the service methods of `index.ts` by 4 lines. The fix of `widget_fv.action` ([Ronitron007/deepWidgets#75](https://github.com/Ronitron007/deepWidgets/pull/75), unit `widget.action_settle`). The model comes from the model of the fixed code that the #75 implementer wrote. A write commits when it passes the abort check at its storage slot. The run timer reads that flag: a call that was committed gives `timeout-after-write` with the rev after its started writes settle, and else `timeout`. The slot frees only after the started writes settle. A write after the timeout is refused. The state record holds the write mark of a keyed call, in the same write. A retry that finds only the mark gives `replayed: true` and `resultLost: true`. The mutant `slot_at_timeout` is the timeout of the code before #75. |

The first check ran at `38df710e`. The sync commit of `crash_lifecycle` is the commit of the unit `widget.crash_records` on its pull request branch. The line ranges below for `crash_lifecycle` are at that commit.

Move the sync commit only after you confirm that each model still describes the code at the new commit. To confirm it, do these steps:

1. Read the diff of each covered file from the sync commit to the new commit.

2. For each changed line, find the model step that cites that line or its function.

3. Change the model step when the code behavior changed. Change the line numbers in the comments when only the lines moved.

4. Run each model (`widget_state_models.rerun`). Get the baseline result, or a result that you can explain by the change.

5. Change the sync commit of the model in this section, and the line ranges of the model in `widget_state_models.coverage`.

## Coverage `widget_state_models.coverage`

Each model covers these files and functions. The line ranges are at the sync commit of the model.

### `crash_lifecycle`

| File | Functions and lines |
|---|---|
| `apps/desktop/src/deepwidgets-supervisor.ts` | `discardProvisionalRecord` 36-44, `hostPidOf` 47-50, `blamedRow` 58-63, `abortedExit` 76-79, `blamedByRecords` 87-98, `DesktopHostSupervisor` 108-195 (`ready` 142-145, `failed` 152-187, `dispose` 189-194) |
| `apps/desktop/src/deepwidgets-crash-policy.ts` | `HostCrashPolicy` 27-52 (`crash` 38-51), and the constants 8-16 |
| `deepwidgets/widgets/src/isolation.ts` | the quarantine contract 1-25, `hostCrashing` 61-63, `slugOfRow` 123-125, `rowRoot` 137-147, `runAs` 153-155, `createIsolation` 248-505 (the record apply at boot 252-277, `held` 283-289, `lift` 291-297, the install hold and `loaded` 298-325, the watchdog start, `slugsOf`, and `noteRow` 327-347, `endFailed` and `showFailed` 351-375, `wrap` 383-424, `claim` 447-473, `track` 482-490, `holdLift` and `settleLift` 491-504) |
| `deepwidgets/widgets/src/watchdog.ts` | the limits 29-36, `removeOwnProvisional` 51-56, `inSlot` 62-75, `startWatchdog` 95-153 (the heartbeat 128, the dispose of the effect 130-137, `track` 142-147, `crashing` 149-151) |
| `deepwidgets/widgets/src/watchdog-worker.ts` | `recordOf` 50-64, `removeProvisional` 67-72, `writeProvisional` 88-106, the poll loop 108-165 |
| `deepwidgets/widgets/src/index.ts` | `SAFE_MODE_ENV` and `BUILT_IN_WIDGET_FOLDERS` 41-49, safe mode in `apply` 707, `add` 1214-1239 (the safe-mode check 1216-1221) |
| `apps/desktop/src/host-process.ts` | `DesktopHostProcess.start` 210-280 (the `fatal` event 254, the exit failure 274-275), `fail` 379-395 (the pid on each failure 381-384) |
| `apps/cli/src/profile-boot.ts` | the fail-loud release in `runProfile` and `withFatalHooks` (safe_host.cleanup) |
| `apps/desktop/src/main.ts` | the safe-mode environment 549, `supervisor.ready` and `supervisor.failed` 630-631 |
| `apps/desktop-host/src/index.ts` | the IPC `fatal` message of a failed boot 154-166 |

### `action_contract`

| File | Functions and lines |
|---|---|
| `deepwidgets/widgets/src/index.ts` | the write mark in the state record `writeMarkSchema` and `stateSchema` 276-285, `Run` 610-629, in `apply` 704-1491: the requests prune at open 715-721, `admit` 728-735, `guarded` 742-744, the drain effect 746-763, `opened` 812-815, `enqueue` 826-847, `liveMarks` and `markOf` 850-861, `settleWrites` 864-869, `write` and `writeNow` 875-906, `update` 916-926, `execute` 935-982, `runAction` 984-1014, `call` 1016-1047, `runOnce` 1050-1079, `remember` 1082-1087, the mark prune at a slug start 1204-1210, the service methods 1473-1474 |
| `packages/storage/storage-domain/src/domain.ts` | `DomainImpl.close` 251-254, `runClose` 256-264, the write chain `enqueue` 283-300, `KvTableImpl.put` 340-346, `update` 375-389 |

### `widget_install`

| File | Functions and lines |
|---|---|
| `deepwidgets/mcp/src/creation.ts` | `bundleName` and `secondBundleName` 169-176, `runGates` 385-404, `writeBundle` 415-431, `WidgetInstaller` 445-730 (`serial` 453-457, `folderOfName` 465-467, `installedNames` 474-480, `registeredName` 495-505, `migrateSeed` 509-522, `meta` 525-535, `waitFor` and `waitLive` 538-549, `install` 552-554, `reload` 557-565, `remove` 567-590, `removeFirst` 592-599, `installNow` 601-661, `loadNew` 667-729) |
| `deepwidgets/widgets/src/index.ts` | `builtInSlugs` 115-138, `programSchema` 286-291, `RegisteredRows` 345-354, `buildRegistration`, `WidgetsService` (`register`), `WidgetRecordsService` 513-579 and `guard` 582-586, safe mode in `apply`, `call`, `setProgram` 1090-1102, `programRecord` 1104-1109, `restoreProgram` 1111-1119, `adoptSeed` 1121-1125, `seed` 1190-1211, `add` 1214-1242, the committed name and the fallback (`readCommits`, `rebuildCommits`, `ownerName`, `fallBack`, `release`, `rowFailed`, `commit`) 1243-1316, the standby `wait` and `promote` 1318-1345, `start` 1349-1384, `rowsOf` 1386-1399, `list` 1418-1421, `hold` and `failed` 1453-1460, the runtime of `widgetRecords` |
| `deepwidgets/widgets/src/isolation.ts` | the quarantine contract 1-20, `rowId` and `isAgentRow` 89-96, `agentRow` 99-102, `runningRow` 105-107, `held` 240-246, `lift` 248-254, the install hold and `loaded` 256-287, `wrap` 290-322, `holdLift` and `settleLift` 389-401 |
| `deepwidgets/widget-sample/src/index.ts` | `widgetSlugs` |
| `packages/boot/plugin-manager/src/index.ts` | `installBundle` 873-1012, `waitForInstall` 1020-1029, `removeBundle` 1047-1079 |

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
| `HashChangeLifts` | After the hash of its files changes, a quarantined widget can run again. | holds (fixed by `widget.crash_records`) | `widget_fv.crash` |
| `ProvisionalOnlyOnAbort` | A provisional record blames a widget only after an abort. | holds (fixed by `widget.crash_records`) | `widget_fv.crash` |
| `InnocentNeverQuarantined` | A widget whose code did not run when its Host died is never quarantined. | holds (fixed by `widget.crash_records`) | `widget_fv.crash` |
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
| `NoLateWrite` | A call that gives `timeout` writes nothing, and no write of a call lands after the call gave its answer. | holds | `widget_fv.action` |
| `OneAtATime` | Two writes of one slug never overlap. | holds | `widget_fv.action` |
| `AtMostOnce` | A retried call with one request ID writes once, also after a host restart. | holds | `widget_fv.action` |

### `widget_install` rules

| Rule | Plain sentence | Today | Spec section |
|---|---|---|---|
| `GatesGuardHost` | Code that fails a gate never reaches the host. | holds | |
| `StateKept` | The state of a slug stays after install, replace, reload, and remove. | holds | |
| `BuiltInUntouched` | An agent tool never replaces or removes a built-in widget. | holds | |
| `OneBundlePerSlug` | At most one live bundle registers a slug. | holds | |
| `NewSeedSetsProgram` | After an install with a new seed program, the stored program is the new seed. | holds | `widget_fv.install` |
| `SameSeedKeepsProgram` | After an install with the same seed, an edited stored program stays. | holds | `widget_fv.install` |
| `SlugTakenOnlyForBuiltIn` | `widget_install` gives `slug-taken` only for the slug of a built-in widget, or when a live widget that is not an agent bundle has the slug. | holds | `widget_fv.install` |
| `QuarantineHolds` | A quarantined widget comes back only when the hash of its files changes. | holds | `widget_fv.install` |
| `RollbackKeepsRecord` | A rolled-back install puts back the stored program and its seed hash. | holds | `widget_fv.install` |
| `BuiltInSlugReserved` | No agent bundle of the slug of a built-in widget is installed, also while the built-in is off. | holds | `widget_fv.install` (`widget.builtin_slugs`) |
| `FailedReplaceKeepsOld` | A failed reinstall keeps the old version live. | holds | `widget_fv.replace` |
| `NeverRemoveLastGood` | An install removes a bundle only when the version that replaces it registered with success in this Host start. It never ends the live version and leaves none live. | holds | `widget_fv.replace` |
| `CommittedNotStandby` | At a Host start, the committed version owns the slug. A row of another version waits as its standby, also when it loads first. | holds | `widget_fv.replace` |

Each model also has `TypeOK` and `NoDeadlock`. These rules check the model itself, and they hold.

In `widget_install`, "new seed" and "same seed" compare with the seed of the code that last went live for the slug (the ghost `lastInst`). A load that throws, that safe mode refuses, or that the quarantine holds applies no seed. Thus it does not count. The restore of a rollback also puts back `lastInst`. This follows `widget_fv.install`: a rolled-back install leaves the stored program and its seed hash as they were before the install.

`RollbackKeepsRecord` compares with the ghost `beforeP` and `beforeS`, which the job keeps when it reads the record. It applies at each failed end of an install after that read. It does not apply after a user edit in the job, or when the failed bundle could not be removed and still runs. A failed replace does not write the record, because the standby of the new version writes no seed.

`FailedReplaceKeepsOld` compares with the ghosts `oldCode`, `oldOn`, and `oldLive`, which the job keeps when it picks the old name and the new name (`Decide`). After a failed reinstall, the old bundle is installed with the same files. When it was selected, it is still selected. When it was live, it is still the live entry of the slug.

The installer commits the new name (the file `$DSH_HOME/deepwidgets/committed.json`) when the new version registered, before it removes the old name. A failed install puts back the committed name from before. A host crash during a replace can leave both names installed. At the next start, both rows load in either order. The row of the committed name owns the slug, and the other row waits as its standby. When the committed row fails at the start (its body throws, or it is held), the fallback starts: the other row takes the slug, and `rowsOf` names the committed name as `fallback`. The file keeps the committed name. The next install keeps the name of the live entry, which registered with success in this Host start, and it removes the other name first. Then it commits the kept name. With no live entry, for example in safe mode, it stops with `install-failed` and removes nothing. A write of the file merges with the file, and a file that can not be read is rebuilt from the Loader config, so no slug loses its name.

The model has no bundle with the older row id `deepwidgets-widget-<slug>`. The replay `legacy` covers it: the new version goes under the second name, and the older bundle goes last.

The `widget_install` model can time out the live wait of an install, also when the widget is live. A replay showed this path: a widget that registers after 5 s.

### Rule names `widget_state_models.names`

The plan `docs/plans/widget-fv.md` and the comments in the models use other names for some rules. This table gives the TLA+ rule for each of these names. Use the TLA+ name in configs and in `check.mjs`.

| Name in the plan or in a model comment | TLA+ rule |
|---|---|
| `crash_lifecycle` rule "a stale record never blames a later crash" | `RecordOnlyBlamesItsHost` |
| `program.new_seed` | `NewSeedSetsProgram` |
| `program.same_seed` | `SameSeedKeepsProgram` |
| `quarantine.holds` | `QuarantineHolds` |
| `slug.taken_only_builtin` | `SlugTakenOnlyForBuiltIn` |
| `rollback.keeps_record` | `RollbackKeepsRecord` |
| `builtin.reserved` | `BuiltInSlugReserved` |
| `replace.keeps_old` | `FailedReplaceKeepsOld` |
| `replace.never_remove_last_good` | `NeverRemoveLastGood` |
| `replace.committed_owns` | `CommittedNotStandby` |
| `gates.never_host` | `GatesGuardHost` |
| `state.kept` | `StateKept` |
| `builtin.untouched` | `BuiltInUntouched` |
| `slug.one_bundle` | `OneBundlePerSlug` |
| `rules.at_most_once` | `AtMostOnce` |
| `rules.no_late_write` | `NoLateWrite` |
| `rules.one_at_a_time` | `OneAtATime`, `FIFO`, and `QueryNoQueue` |
| `rules.replay_recorded` | `ReplaySameResult` and `ReplayFlag` |
| `rules.replay_conflict` | `ConflictOnOtherArgs` |
| `rules.busy_never_runs` | `BusyNeverRuns` |
| `rules.dispose_drain` | `NoAdmitAfterStop` and `DrainBeforeClose` |
| `rules.rev_counts_writes` | `RevCountsWrites` |

The plan uses the TLA+ names `NoLateWrite`, `OneAtATime`, and `AtMostOnce` directly.

## Files `widget_state_models.files`

Each model folder has these files:

- The spec: `crash_lifecycle/crash_lifecycle.tla`, `action_contract/ActionContract.tla`, or `widget_install/WidgetInstall.tla`. Each step cites the code lines that it describes.

- The configs (`.cfg`). Each config sets the bounds and the rules of one run.

- The view, `view.mjs`. It gives the words of the chart and the bug paths for `/statechart`.

- The replays. A replay runs a bug path on the real code.

The file `check.mjs` lists the runs of each model. It also compares the reports of `/statechart` with the baseline.

## Run the models `widget_state_models.rerun`

TLC checks the rules that break and the rules that hold in different runs. After the first break, `/statechart` stops each run at 100,000 states. Thus each model has more than one run.

The first `/statechart` run needs the network. It installs TLC and Java itself. Read the "Run" section of `/statechart` for its command line. This skill does not copy that command line, because it changes between releases and machines.

To run one model, do these steps:

1. Set `STATECHART_RUN` to the `/statechart` command line of one run. Write the placeholders `{spec}`, `{config}`, `{view}`, and `{out}` where the command line takes the spec, the config, the view, and the out folder.

2. Make a new out folder name outside the repository, for example `$TMPDIR/widget-state-models/<date>/crash_lifecycle`. Do not reuse an out folder.

3. Run each run of the model and compare the reports with the baseline:

   ```bash
   node .agents/skills/widget-state-models/check.mjs run crash_lifecycle <out folder>
   ```

Use `action_contract` or `widget_install` in place of `crash_lifecycle` for the other models. Exit code 0 means that each run gives the baseline. Exit code 1 means that a rule result changed. The output names the run and the rule. Exit code 2 means that a report is missing, the out folder exists, or the usage is wrong.

To see the runs of a model, run `node .agents/skills/widget-state-models/check.mjs crash_lifecycle`. Each config path is relative to the model folder, for example `crash_lifecycle/cfg/mut/keep_prov.cfg`. To run one config by hand, give `/statechart` the spec, the config, and the `view.mjs` of the model folder. Put the result in `<out folder>/<run name>`. Then run `check.mjs` with the model and the out folder, without `run`, to compare.

On an idle Mac, the main runs take about 2 minutes for `crash_lifecycle` and 5 minutes for `action_contract`. The run `idem-hold` takes the most time (281 seconds on 2026-11-04). With `--mutants`, `action_contract` took 475 seconds on 2026-11-04. When other jobs load the machine, the runs can take three times as long.

`widget_install` has a default set and a full set of runs:

- The default set has one crash and one agent slug, and the run `all` has no `DeselectFails`. It checks each `widget_install` rule. With `--mutants`, it took 489 seconds on 2026-11-04.

- The full set adds the runs `holds`, `quarantine`, and `same-seed` with two crashes and `DeselectFails`, and `two-slugs` with two agent slugs and two calls. It takes more than 30 minutes. In TLC alone, `holds` takes about 5 minutes and `two-slugs` about 1 minute.

To use the full set, add `--full` to a `check.mjs` command. Run the full set when you change the model.

### Mutant runs `widget_state_models.mutants`

A mutant run uses a broken variant of the model, and its rule must break. Thus the mutant runs show that the rules can fail. Each model has a constant `Mutant`. The value `none` is the code. Each other value is one code mistake, and its config in `cfg/mut/` names the one rule that must break.

To use the mutant runs too, add `--mutants` to a `check.mjs` command. The mutant runs take about 2 minutes for each model.

| Model | Mutant | Rule that must break |
|---|---|---|
| `crash_lifecycle` | `no_blame_skip`, `safe_off_by_one`, `give_up_late`, `no_dispose`, `no_quarantine`, `no_pid_check`, `keep_prov`, `no_row_root`, `prov_outlives_call`, `keep_prov_unarmed` | `BlamedCrashNeverCounts`, `SafeModeAfterTwo`, `GiveUpAtFour`, `NoRestartAfterGiveUp`, `QuarantinedNeverRuns`, `RecordOnlyBlamesItsHost`, `ProvisionalGoneAfterBeat`, `HashChangeLifts`, `InnocentNeverQuarantined`, `ProvisionalOnlyOnAbort` |
| `action_contract` | `any_turn`, `dup_no_flag`, `no_cancel`, `no_drain`, `no_hash_check`, `no_stop_check`, `query_queued`, `rev_on_refuse`, `replay_live_rev`, `slot_at_timeout`, `no_slot_abort_check`, `no_mark` | `FIFO`, `ReplayFlag`, `BusyNeverRuns`, `DrainBeforeClose`, `ConflictOnOtherArgs`, `NoAdmitAfterStop`, `QueryNoQueue`, `RevCountsWrites`, `ReplaySameResult`, `OneAtATime`, `NoLateWrite`, `AtMostOnce` |
| `widget_install` | `skipGate`, `stateReset`, `builtinRow`, `seedFile`, `noRestore`, `oneName`, `offAllowed`, `removeFirst`, `noLiveCheck`, `noDefer` | `GatesGuardHost`, `StateKept`, `BuiltInUntouched` and `OneBundlePerSlug`, `SameSeedKeepsProgram`, `RollbackKeepsRecord`, `QuarantineHolds`, `BuiltInSlugReserved`, `FailedReplaceKeepsOld`, `NeverRemoveLastGood`, `CommittedNotStandby` |

In `crash_lifecycle`, the mutants `no_row_root`, `prov_outlives_call`, and `keep_prov_unarmed` are the code before `widget.crash_records`. The mutant `keep_prov` keeps the provisional record at the beat and at the return of the call. After that unit, a call always returns before the next beat, so a mutant that changes only the beat does not break a rule.

In `widget_install`, the mutant `removeFirst` removes the old bundle before the new one is written, as the code did before `widget_fv.replace`. The mutant `noLiveCheck` keeps the committed name when it is installed, without the check that it is live in this Host start (the code of review round 1). The mutant `noDefer` lets the row that loads first take the slug. The mutant `oneName` makes the quarantine know only the first package name of a slug. The mutant `liftAtLoad` of `widget.install_records` is gone: after `widget_fv.replace`, a replace never brings the blamed files back, so the rule holds with it.

In `action_contract`, each mutant also has a control run `-none` with the same bounds. The control run must hold. The mutant `slot_at_timeout` frees the slot at the timeout and gives `timeout` at once, as the code did before #75. The mutant `no_slot_abort_check` removes the abort check at the storage slot. The mutant `no_mark` writes no write mark in the state record. The mutant `rev_on_refuse` adds one to the rev when a write is refused at its slot. The mutant `stale_rev` has no run now: the slot keeps one write at a time, so a write can not read a stale rev in this model, and its rule holds with it.

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
| `crash_lifecycle` | `node_modules/.bin/vitest run --root .agents/skills/widget-state-models/crash_lifecycle/replay`. `node tools/widgets-crash-replay.mjs` runs it too, with the host cases of `widget.crash_records`. | `InnocentNeverQuarantined`, `ProvisionalOnlyOnAbort` (three paths: before the first ready, after the return, and an IPC fatal event during the call), `HashChangeLifts` and its control, the failed slug of a row that throws before it registers (`safe_host.crash`, not in the model), `SampleNeverQuarantined` with `SampleLiveInSafeMode` |
| `action_contract` | `node tools/widgets-action-replay.mjs` (set `WIDGETS_ACTION_REPLAY` to a comma list of names to run only those) | `crash`: `AtMostOnce` after a restart, with `resultLost`. `late`: `NoLateWrite`, the answer `timeout-after-write`, and `AtMostOnce` with no restart. `overlap`: `OneAtATime`. `natural`: `NoLateWrite` with no patched disk, in 400 calls near the timeout. `hang`: a write of a hung handler after its answer is refused, and the slot frees. `nested`: a nested `timeout-after-write` is `handler-error` for the outer call (not in the model). |
| `widget_install` | `node .agents/skills/widget-state-models/widget_install/replay/replay-<name>.mjs` | `newseed`: `NewSeedSetsProgram`. `sameseed`: `SameSeedKeepsProgram`. `quarantine`: `QuarantineHolds`. `replace`: `FailedReplaceKeepsOld`, and the turns of the two package names. `putback`: `FailedReplaceKeepsOld` on the path of the finding at `38df710e`, where the old code can not start again, and a new version that throws after it registers. `legacy`: `FailedReplaceKeepsOld` over a bundle with the older row id (not in the model). `committed`: `CommittedNotStandby` after an interrupted replace, and an install in a safe-mode start that removes nothing. `fallback`: `NeverRemoveLastGood`. The host dies after the commit, the committed version throws at the next start, the other version takes the slug, and a failed install keeps it live. `builtin`: `BuiltInUntouched` and `OneBundlePerSlug`. `safe`: `SlugTakenOnlyForBuiltIn`, in a safe-mode host start. `rollback`: `RollbackKeepsRecord`. `quarantine` also has the live-wait timeout. `reserved`: `BuiltInSlugReserved`. `guard`: widget code can not use the service `widgetRecords` (not in a model). `node tools/widgets-install-replay.mjs` runs `newseed`, `sameseed`, `rollback`, `quarantine`, `safe`, `reserved`, `guard`, `replace`, `putback`, `legacy`, `committed`, and `fallback`. |

The `crash_lifecycle` replays assert the fix of `widget_fv.crash`. The replay of `SampleNeverQuarantined` with `SampleLiveInSafeMode` still asserts the bad behavior, because those rules belong to `widget_fv.open`. The watchdog replays use the real watchdog thread, and the lines of `inSlot` for the main thread. The `action_contract` replay asserts the fix of `widget_fv.action`. It prints `PASS` or `FAIL` for each check, and exits with 0 only when each check passes. The `widget_install` replays `newseed`, `sameseed`, `rollback`, `quarantine`, `safe`, `reserved`, and `guard` assert the fix of `widget_fv.install`. The replays `replace`, `putback`, `legacy`, `committed`, and `fallback` assert the fix of `widget_fv.replace`. Each prints `PASS` or `FAIL` for each check, and exits with 0 only when each check passes. The replay `builtin` prints the facts of each step.

When a fix lands, change the replay of its rule so that it asserts the correct behavior.

## Change a model `widget_state_models.change`

When your change to covered code is intended, change the model in the same pull request. Do these steps:

1. Find each step in the spec that cites a changed line or function.

2. Change that step so that it does what the new code does. Keep one model step for each indivisible step of the code. An await is the end of a step.

3. Do not change a rule to make it hold. Change a rule only when the spec of the product changes, and cite the spec section.

4. Run the model (`widget_state_models.rerun`).

5. If a rule result changed, replay the path on the real code (`widget_state_models.replay`).

6. If the change is correct, change the baseline in `check.mjs` and the rule tables in this file.

For example, assume that you remove the pid match from `blamedRow` and `blamedByRecords` in `apps/desktop/src/deepwidgets-supervisor.ts`. Then change the model step `HostFails` in `crash_lifecycle.tla`. The value `own` loses the test `crash.pid = pid`, and the value `prow` loses the test `prov.pid = pid`. The `holds` run of `crash_lifecycle` then shows that `RecordOnlyBlamesItsHost` breaks. The mutant `no_pid_check` is the same change to the model.

## Scope `widget_state_models.scope`

A pass covers the model and its bounds only. It does not cover the full system. Read the bounds in each config, for example `MaxHosts = 4` or `Jobs = {"A1", "A2", "U1"}`.

The models leave out these items:

- `crash_lifecycle`: real time. A tick is a quarter of the watchdog threshold. The model has one agent widget and the built-in `sample`. `TIdle = 3` stands for the 10 s limit with slot 0: the model keeps only its order with `T`. The model has no host code that stalls with slot 0, and no dispose step: an uncaught error ends the host in one step.

- `action_contract`: one slug and one request key. The storage write is one step for each await of the domain chain. A handler has one state write. A handler that timed out can try a second write, which is refused. The handler does not throw. The drain bound of the dispose is not in the model. The model lets the run timer fire after the handler returned while its write is not settled. The code clears the timer then, so the model has more paths than the code.

- `widget_install`: one agent slug in most runs, and two slugs in the run `two-slugs`. Each agent slug has the two package names A and B. The run `two-slugs` has no `DeselectFails` and two calls: the one-slug runs check those paths. The plugin manager is one step for each await of `installBundle` and `removeBundle`. A crash blames the live row or the row of the standby. The default set has one crash. A single crash can interrupt a replace and start the Host in safe mode. At a start, the code of one row can throw before it registers, also when it went live before (`failsNow`).
