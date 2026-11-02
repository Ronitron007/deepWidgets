# Plan for the fixes from the formal check `widget_fv.plan`

This plan implements `docs/specs/widget-fv.md`. The process is `widget_mvp.plan.process`. Each check runs the replay of the formal check on the real code. The model rule of each unit must hold on a model of the fixed code.

## Units `widget_fv.plan.units`

| Unit | Change | Check | Mutant that must fail the check | Needs |
|---|---|---|---|---|
| `fv.models_skill` | Add the skill `widget-state-models`: the three TLA+ models, their configs and views, the replay scripts, the coverage record, and the sync commit `38df710e`. | The skill runs each model with `/statechart`. The rules that this spec lists break, and each other rule holds. A scratch change that removes the pid match of the supervisor makes the `crash_lifecycle` rule "a stale record never blames a later crash" break. | The scratch change is the mutant. | none |
| `widget.action_settle` | `widget_fv.action` | The `action_contract` replays: no call that gives `timeout` writes, no lost update, and a retry after a crash gives `replayed: true`. The model rules `NoLateWrite`, `OneAtATime`, and `AtMostOnce` hold. | The slot frees at the timeout again: the lost-update replay fails. | none |
| `widget.install_records` | `widget_fv.install` | The `widget_install` replays for the seed, the quarantine, and the off entry pass. The model rules `program.new_seed`, `program.same_seed`, `quarantine.holds`, and `slug.taken_only_builtin` hold. | The seed hash in its own file again: the crash replay fails. | `widget.agent_rows`, `widget.action_settle` |
| `widget.install_replace` | `widget_fv.replace` | The `widget_install` replay of a failed reinstall keeps the old version live. The model rule `replace.keeps_old` holds. | The old version is removed before the new version registers: the replay fails. | `widget.install_records` |
| `widget.crash_records` | `widget_fv.crash` | The `crash_lifecycle` replays for the innocent widget, the abort rule, and the hash lift pass. The model rules hold. | The provisional record stays after the call returns: the innocent-widget replay fails. | the upstream sync PR |
| `widget.watchdog_check` | `widget_fv.watchdog_check` | The `oom` case passes 10 runs with `--max-old-space-size=6144`. | The old path asserts: at least one of the 10 runs fails. | none |

`widget.action_settle`, `fv.models_skill`, and `widget.watchdog_check` can run at the same time. `widget.crash_records` waits for the upstream sync, because both change `apps/desktop/src/host-process.ts`.
