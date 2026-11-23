> **deepWidgets is an unofficial fork of DeepSeek Harness (DSH).** It is not affiliated with DeepSeek and is not endorsed by DeepSeek. The upstream source, the imported commits, and the license are in [UPSTREAM.md](UPSTREAM.md).

# deepWidgets

deepWidgets is a desktop app that shows small floating widget windows. Each widget is a plugin that runs on [Cordis](https://github.com/cordiverse/cordis), the plugin framework that DSH is built on.

The project is in early development. There are no published installers, and the interfaces change without notice.

## What it is

deepWidgets starts from the DSH Electron desktop app. DSH already has three parts that the widgets need: a Node host process that runs a Cordis Context, a Cordis client in the renderer, and an Electron shell. deepWidgets keeps those parts and turns off most of the other DSH plugins.

What the app does today:

- **Widgets.** A widget is a Cordis plugin that calls `ctx.widgets.register`. It has a slug, a state, and named actions (queries and mutations). The runtime is `deepwidgets/widgets`. There are two built-in widgets: `sample`, a counter (`deepwidgets/widget-sample`), and `main`, the main widget (`deepwidgets/widget-main`).

- **Floating windows.** Electron main opens one frameless, always-on-top window for each widget, except `main`. The window shows on all workspaces. A widget draws its UI in one of two ways: the shared shell (`deepwidgets/shell`) renders an OpenUI Lang program, or an agent-written React page replaces the shell for that widget.

- **MCP server for agents.** The host runs an MCP server (`deepwidgets/mcp`). In the desktop app, Electron main binds a fixed local port, 47615 by default. It forwards each request to the host. An agent can list widgets, read their state, and call their actions. The server does not show `main` to agents. See [deepwidgets/mcp/README.md](deepwidgets/mcp/README.md) for the port, the port file, and the token handshake.

- **MCP modes.** The server groups its tools in three modes. The mode `interact` is always on. In the mode `create`, an agent can also install, reload, and remove widgets. In the mode `library`, an agent can write the page of a widget with components of the agent. The settings file `$DSH_HOME/deepwidgets/settings.json`, or the Settings tab of `main`, can turn `create` and `library` off. The tools are `deepwidgets_modes`, `widget_list`, `widget_describe`, `widget_call`, `widget_changes`, `widget_guide`, `widget_template`, `widget_install`, `widget_reload`, `widget_remove`, and `library_template`.

- **Crash handling.** The host restarts after a crash. A crash watchdog stops a widget that loops, and a widget that crashes the host is quarantined until its files change.

- **Menu bar app.** On macOS, deepWidgets is a menu bar app with no Dock icon. A click on the menu bar icon opens a panel with the page of `main`. The Widgets tab lists the other widgets, with Turn off, Turn on, and Remove for each one. The Settings tab has the switches of the modes `create` and `library`, the MCP port, and the launch-at-login switch. A second click on the icon, or a loss of focus, closes the panel. The spec is [docs/specs/main-widget.md](docs/specs/main-widget.md).

- **DSH window.** The app also opens the DSH window, which shows only a `hello` text and the `probe` text. On macOS, the app keeps this window hidden. On Windows and Linux, the app shows it.

Most of the DSH code stays in the tree and does not run. It is turned off with `disabled: true` rows in [deepwidgets/trim/cordis.patch.yml](deepwidgets/trim/cordis.patch.yml), and the code is kept on purpose as a reference for writing Cordis plugins. `git grep deepwidgets-trim` lists the DSH files that were edited. The method is in [docs/specs/fork-trim.md](docs/specs/fork-trim.md).

## Run

There is no installer to download. Run the app from a checkout of this repository.

### Prerequisites

- Node.js 24.9 or newer (`engines.node` in `package.json`).
- pnpm 11.28.5, through Corepack: `corepack enable`. The version is pinned in `package.json`.
- Git.

### Run from source

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm run build:artifacts
pnpm run build:desktop
pnpm run start:desktop
```

`pnpm run build:artifacts` builds the native addon, the host, the client bundles, the Web frontend, and the widget shell. `pnpm run build:desktop` builds the Electron shell. `pnpm run start:desktop` launches the built artifacts. `pnpm run dev:desktop` runs both build steps and then launches. The root `Makefile` has short names: `make build`, `make desktop`, and `make dev-desktop`.

Before an install that pulls `@openuidev` packages, set `OPENUI_TELEMETRY_DISABLED=1`.

The launcher uses its own state folder, `apps/desktop/.desktop-build/development/home`, so it does not touch your normal DSH home. Set `DSH_HOME` to use a different folder. The launcher listens for debuggers on ports 9229, 9222, and 9230. On Windows and Linux, it also opens DevTools. On macOS, it does not, because the DSH window stays hidden. The file [apps/desktop/README.md](apps/desktop/README.md#develop) lists the environment variables that change these.

### macOS

Run from source as above. This is the main platform of the project: the smoke checks in `tools/` and the widget window code (`apps/desktop/src/deepwidgets-windows.ts`) were written and run on macOS.

To build a local app instead of running from source, the DSH packaging scripts are still in the tree, for example `pnpm run package:desktop:mac:arm64:unsigned` and `pnpm run package:desktop:mac:x64:unsigned`. They are described in [apps/desktop/packaging/README.md](apps/desktop/packaging/README.md). They come from DSH, and deepWidgets has no signed or published build.

### Windows

Run from source as above, with native Windows tools or with WSL 2. [docs/development.md](docs/development.md) explains the two setups. The DSH packaging scripts are in the tree (`pnpm run package:desktop:win:x64:unsigned`; see [apps/desktop/packaging/README.md](apps/desktop/packaging/README.md)). They are not tested for deepWidgets, and there is no published installer.

### Linux

Linux support is incomplete. The repository has a `linux-x64` development target for the desktop scripts, and `tools/smoke-desktop-linux.mjs` has the Linux helpers of the smoke check, so the app can be started from source. But Linux is not a release target: the desktop packaging guide says so, and there is no packaged runtime for it (`apps/desktop/scripts/prepare-runtime.ts` refuses `linux-x64`). The build steps and the widget windows were not checked on Linux for this README.

## Development

Prerequisites are the same as in [Run from source](#run-from-source). The full setup tutorial is [docs/development.md](docs/development.md).

```sh
pnpm install --frozen-lockfile   # install
pnpm run build:artifacts         # build every artifact, no type check of tests and scripts
pnpm run build                   # build:artifacts and build:check (type check of tests and scripts)
pnpm run dev:desktop             # build, then launch the desktop app
pnpm run start:desktop           # launch the built app without building
pnpm run clean                   # remove build outputs
pnpm run typecheck
pnpm run lint
pnpm run test                    # unit tests with vitest
```

The root `Makefile` wraps `build`, `clean`, `desktop`, and `dev-desktop`. `make help` lists them.

The widget system has its own checks in `tools/`. They boot the app or a host and test widgets, the MCP server, crash recovery, and the page build gates. For example:

```sh
node tools/smoke-desktop.mjs                         # boot check
DSH_SMOKE_WIDGET=sample node tools/smoke-desktop.mjs  # widget page and live refresh
node tools/widgets-runtime.mjs                       # runtime, with a host
node tools/widgets-mcp.mjs                           # MCP server, with a host
```

[CLAUDE.md](CLAUDE.md) lists every script and every `DSH_SMOKE_*` flag. Most of them start the Electron app.

## Project structure

| Path | Content |
|---|---|
| `deepwidgets/` | The `@deepwidgets/*` packages: `widgets` (runtime), `widget-sample`, `widget-main` (main widget), `shell` (widget page, built with Vite), `widget-kit` (core of the widget page), `mcp` (MCP server), `trim` (the row patch that turns DSH plugins off), `probe` and `trace` (diagnostic plugins) |
| `apps/desktop` | Electron main: windows, widget windows, the menu bar app, the spawn of the host |
| `apps/desktop-host` | The Node host process that runs the Cordis plugins |
| `apps/cli`, `apps/web` | DSH CLI and Web app, inherited |
| `packages/` | DSH packages, inherited. Most of them are turned off |
| `vendor/` | Vendored Cordis and its foundation libraries |
| `tools/` | deepWidgets check scripts and their fixtures |
| `docs/specs/`, `docs/plans/` | Specs and plans of the widget work |
| `docs/explore/widget-system/` | Widget design decisions and open points. Start with [where-we-stand.md](docs/explore/widget-system/where-we-stand.md) |
| `docs/canvas/` | JSON Canvas diagrams of how the processes work |

More documents:

- [docs/architecture.md](docs/architecture.md) and [docs/cordis-primer.md](docs/cordis-primer.md): the DSH architecture and Cordis, inherited. Both apply to the code that runs.
- [CLAUDE.md](CLAUDE.md): the entry file for agents. It says which code runs, how the trim works, and which checks exist.
- [AGENTS.md](AGENTS.md): the DSH code conventions, with a deepWidgets header. Use it for the style of DSH code. The process rules in it come from upstream.
- [docs/tasks/README.md](docs/tasks/README.md): the protocol for task files.
- [SAFETY.md](SAFETY.md): the DSH safety notice. It applies here too: the app runs plugins, and an MCP agent can install code that runs in the host.

## Upstream

This section is about DeepSeek Harness, not deepWidgets. The `npx @deepseek-ai/dsh web` command, the DeepSeek Discord, the GitHub Discussions, the `dsh-plugin` topic, and the DSH citation belong to the upstream project, which has its own README: <https://github.com/deepseek-ai/deepseek-harness>. Its documentation is at <https://deepseek-harness.github.io/deepseek-harness/>. Do not use those channels for deepWidgets problems.

[README.zh.md](README.zh.md) is the unchanged Chinese README of DSH. It does not describe deepWidgets.

## Credits and license

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) by DeepSeek AI is the base of this project. The source is MIT-licensed, and the imported commits are in [UPSTREAM.md](UPSTREAM.md).
- [Cordis](https://github.com/cordiverse/cordis) by Shigma and the Cordis contributors is the plugin framework. Cordis and its foundation libraries are vendored in `vendor/` with their MIT `LICENSE` files. [vendor/README.md](vendor/README.md) records the upstream commits and the local changes.

The license is [MIT](LICENSE), copyright 2026 DeepSeek. Third-party dependencies and their licenses are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). That file is generated and still says "DeepSeek Harness".
