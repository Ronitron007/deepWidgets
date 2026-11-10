# Plan for the agent library `agent_library.plan`

This plan implements `docs/specs/agent-library.md`. The process is `widget_mvp.plan.process`.

## Units `agent_library.plan.units`

| Unit | Change | Check | Mutant that must fail the check | Needs |
|---|---|---|---|---|
| `library.main_split` | `agent_library.main_split` | The typecheck and the lint pass. The shell page builds. `DSH_SMOKE_WIDGET=sample` passes, with its live refresh. `DSH_SMOKE_WINDOWS=1` passes. The shell source imports the core only through `@deepwidgets/widget-kit`, and the core imports no component library. | The core does not put the refresh bridge in `children`: the live refresh of `DSH_SMOKE_WIDGET=sample` fails. | none |
