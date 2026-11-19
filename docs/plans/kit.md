# Plan for the widget kit `kit.plan`

This plan implements `docs/specs/kit.md`. The process is `widget_mvp.plan.process`.

## Units `kit.plan.units`

| Unit | Change | Check | Mutant that must fail the check | Needs |
|---|---|---|---|---|
| `kit.service` | `kit.folder`, `kit.settings`, `kit.service`, `kit.gates` | The typecheck and the lint pass. A new script `tools/kit-service.mjs` runs with a host and checks these steps. The first start makes kit version 1 with the 8 core links, and `read()` lists no extra. `add('date-fns@^4')` makes version 2 with an exact version, and a page bundle that imports `date-fns` installs. `add` of a core package gives `in-core`. With `{ "kit": { "refuseBuilds": ["core-js"] } }`, `add('core-js')` gives `install-failed` and names `core-js`. With an empty list, the install script of `core-js` runs. Exactly one `react` is in the kit, and it is the folder of the app. After the check points `core/react` at another real folder, an offline frozen install still passes. With the registry set to an address that does not answer, a page install still passes. With no store and no `node_modules`, the host starts, a page install gives `kit-unavailable` in at most 5 s, and a bundle with no `page/` installs. `widgets-create`, `widgets-mcp`, `widgets-install-replay`, `widgets-action-replay`, and `widgets-crash-replay` pass. | Remove the `overrides` of the core links: the kit gets a second `react` from npm after `add('recharts')`, and the check fails. | `library.guide` |
