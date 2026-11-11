# Plan for the agent library `agent_library.plan`

This plan implements `docs/specs/agent-library.md`. The process is `widget_mvp.plan.process`.

## Units `agent_library.plan.units`

| Unit | Change | Check | Mutant that must fail the check | Needs |
|---|---|---|---|---|
| `library.main_split` | `agent_library.main_split` | The typecheck and the lint pass. The shell page builds. `DSH_SMOKE_WIDGET=sample` passes, with its live refresh. `DSH_SMOKE_WINDOWS=1` passes. The shell source imports the core only through `@deepwidgets/widget-kit`, and the core imports no component library. | The core does not put the refresh bridge in `children`: the live refresh of `DSH_SMOKE_WIDGET=sample` fails. | none |
| `library.build_gate` | `agent_library.build_gate` | The typecheck and the lint pass. `widgets-create` installs a bundle with a good page, and the built page is in the profile folder. The install refuses a page with a type error, a page that imports a package that is not on the list, a page with a changed fixed file or `dw-core` block, and a page whose component throws in the render check. In a CLI host, a good page installs with the warning that the render check was skipped. A bundle with no `page/` installs as before. | Remove the render check: the page whose component throws installs, and the check fails. | `library.main_split` |
