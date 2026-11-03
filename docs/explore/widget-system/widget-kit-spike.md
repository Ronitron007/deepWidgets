# Widget kit spike `kit_spike`

This file records the spike for the widget kit, run on 2026-11-03 at `origin/main` `1ca2967d`. It is not a spec. A spec follows only after the operator gives the whole direction. Each number is a measurement unless a row says "inferred".

## Operator direction so far `kit_spike.direction`

- An agent writes its own OpenUI component library and a child component that holds `<Renderer>`.

- Each widget gets its own Vite build at install time (layout A).

- The package `@deepwidgets/widget-kit` has a locked core and user extras. The core is what `main.tsx` needs. The user adds extras in a settings pane.

- Widget code can import extras on the renderer side and on the host side.

- When a setting allows it, an agent can add packages to the kit through MCP.

- The kit's packages are described to agents dynamically.

- Pin or rebuild after a kit change: decide from data.

## Packaging strategies `kit_spike.strategies`

All runs used the bundled runtime: pnpm 11.28.5 and Node 24.21.0.

| | S1: fresh install for each widget | S2: kit lockfile and a store filled by `pnpm fetch` | S3: S2 and prebuilt shared chunks |
|---|---|---|---|
| Add a package | 3.3 s for each widget, 817 KB of network | A new kit version: 1.0 s to resolve, 3.2 s to fetch, 0.5 s to install. Network for the change only. | S2, then 3.5 s to 3.8 s to build the runtime again |
| Install step for each widget | 14.0 s and 74 MB cold, 3.0 s warm | 2.6 s to 3.3 s offline, or 0 s with a link to the kit's `node_modules` | 0 s with a link |
| Build for each widget | 0.9 s to 3.7 s | 0.9 s to 3.7 s | 0.3 s to 0.9 s |
| Size of each widget | 352 KB to 796 KB | 352 KB to 796 KB | 44 KB to 96 KB, and 2.1 MB of runtime for each kit version |
| Determinism | Each build resolves the transitive versions again | The lockfile is frozen | Frozen |
| Failure | The registry is down: fails after 70.5 s | A missing store fails in 0.8 s with `NO_OFFLINE_TARBALL` | A kit change in place broke an old widget |

S2 works outside a workspace only with `--config.trust-lockfile=true`. Without it, the pnpm 11 check `minimumReleaseAge` (1440 minutes) needs a metadata cache of 113 MB, and the install fails with `NO_OFFLINE_META`. The strict default for build scripts also fails, on the scripts of esbuild and of the `@openuidev/lang-core` telemetry. `allowBuilds` or `strict-dep-builds=false` fixes that.

## Vite build for each widget `kit_spike.vite`

- The test page was our `main.tsx` with a child that holds `<Renderer.Root>`.

- A copy of our shadcn library built in 4.3 s cold and 2.8 s warm, to 796 KB. Two small widgets built in 0.9 s to 1.06 s, to about 360 KB each.

- All 3 widgets rendered in Electron.

- Vite has no build cache that persists. A warm build saves only about 1.4 s.

- Tailwind finds no classes in a package in `node_modules` unless the package has its own `@source`.

## Extras on the host side `kit_spike.host`

| Way | Result |
|---|---|
| esbuild puts `date-fns` in the host half | 594 KB, built in 377 ms. `zod` alone is 545 KB in each host half today. |
| `date-fns` stays external | 350 bytes. The import fails with `ERR_MODULE_NOT_FOUND` unless the bundle folder links to the kit's `node_modules`. That link pins the widget to its kit. |
| A native addon | Fails. esbuild has no loader for `.node` files, and the ABIs differ: Electron 44 is ABI 149, the bundled Node is ABI 137. |

## Pin or rebuild `kit_spike.pin`

The spike built 3 widgets on kit v1, then built them again on kit v2.

| Kit v2 | Type gate | Build | Render |
|---|---|---|---|
| v2a: `date-fns` 4.0 to 4.1 | 0 of 3 broke | 0 of 3 broke | 0 of 3 broke |
| v2b: the component library changed, with renamed props | 1 of 3 broke (TS2322) | passed | 1 of 3 broke (`render-error`) |

A rebuild of all 3 took 8.3 s to 9.0 s, and the render check took about 1.6 s for each widget.

The policy that the data supports (inferred):

- Pin each widget to its kit version by default. A built page holds its own copy of each package, so a kit change does not affect it.

- Rebuild a widget only on request. The rebuild runs the type gate, the build, and a render check. If a gate fails, the old page and the old lockfile stay.

- Rebuild by force only for a security fix in a patch or a minor version, with the same gates. If a gate fails, keep the old page and flag the widget.

- Never rebuild automatically across a major version or a changed library.

## Type gate `kit_spike.types`

`tsc` took 0.53 s to 1.9 s for each widget. oxlint with tsgolint took 0.11 s to 0.55 s and found the same v2b error.

## Dynamic description `kit_spike.mcp`

Measured with Claude Code 2.1.317 against a local fake model API, so no paid run occurred.

| Way | Does Claude Code see a change during a session? |
|---|---|
| Tool output and resources | Yes, on each call |
| `notifications/tools/list_changed` | Yes. It reads the tool and resource lists again within milliseconds. A new tool shows on the next turn. |
| The description of a tool that is already loaded | No. The old text stays for the session. |
| The server `instructions` | No. It never reads them again. |

Thus the kit's facts go in tool output and in a resource, not in a description or in `instructions`.

The cost of the package list, for 20 packages: about 500 characters as one line for each package, and about 5,900 characters as a card for each package. The types of the packages are about 770,000 characters. Thus the guide gives one line for each package, and a tool gives a card on request.

## Configuration of the kit `kit_spike.config`

This is a design from the spike, not a decision.

- The kit is a pnpm project at `$DSH_HOME/deepwidgets/kit/`, with `package.json`, a lockfile, `node_modules`, and `kit.json`. The setting `agentsMayAddPackages` is in the host settings.

- The MCP tools are `kit_read`, `kit_describe`, `kit_add`, and `kit_remove`. The errors are `kit-locked`, `in-core`, `in-use`, `not-found`, and `install-failed`.

- The settings pane uses `GET /api/kit`, `PUT /api/kit/settings`, `POST /api/kit/extras`, `DELETE /api/kit/extras/<name>`, and `GET /api/kit/stream`.

- One addition does these steps: a check, `pnpm add --save-exact` in a copy of the folder, a swap of the folders, a new card, a new `kitVersion`, and a signal to the change feed and the stream. The guide shows the change at the next call.

## Prior art `kit_spike.prior_art`

| Project | What it does |
|---|---|
| Context7 | Two tools: one finds a library, one gives its documents on request (verified) |
| `llms.txt` | An index and a full file (from memory) |
| Raycast, VS Code | Each extension build includes its own packages (from memory) |
| Val Town | Each import names `npm:pkg@ver` (from memory) |
| Observable, Deno import maps | The build resolves and pins each import (from memory) |

## Work map `kit_spike.work`

| Part | Size (inferred) |
|---|---|
| MCP kit tools and the index in the guide | M |
| The kit service with pnpm | L |
| The settings pane | M |
| `/api/kit` routes | S |
| The Vite build gate | L |
| The gate for host extras (today the paths map has only `zod`) | M |
| Kit versions and pins | M |
| The guide and the template | S |
| The split of `main.tsx` | M |
| Electron main serves each slug | M |
| Checks | M |
| TLA+: a change to `WidgetInstall.tla` and a small new kit model | M |

## Risks `kit_spike.risks`

- The render check finds only errors that throw. A wrong prop of an untyped extra passes.

- `minimumReleaseAge` holds a security fix for 24 hours unless the package is excluded.

- The lockfile records a `file:` extra as a path relative to the project, so the kit folder layout must stay fixed.

- An external host import that the kit does not provide can resolve from `<profile>/node_modules` (inferred).

- Shared chunks of S3 can not drop unused code: lucide is 903 KB and recharts 578 KB.

- About 85 MB of the kit is build tooling. lucide is 46 MB and date-fns is 39 MB.

## Files `kit_spike.files`

The spike files are in `~/.deepwidgets/kit-spike/build/` and `~/.deepwidgets/kit-spike/mcp/` on the operator's Mac. They are not in git.
