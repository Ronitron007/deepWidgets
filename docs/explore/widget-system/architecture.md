# Widget system architecture, first draft `explore.widget`

This document proposes the architecture of the deepWidgets widget system. It is an exploration, not a spec. The operator reads it and decides. Each claim has a label: "verified" (an agent ran or read it on 2026-10-27), "inferred", or "a guess".

The design copies the DeepSeek Harness (DSH) architecture where it can. The file `dsh-mirror.md` shows each copy. The file `options.md` gives the options for each open question. The file `challenges.md` gives the hard problems. The file `spikes.md` tells how to run each spike again.

## Goal `explore.widget.goal`

- A user sees small floating widgets on the desktop. Each widget shows live data.

- An agent, for example Claude Code, can read a widget, change its data, and create a new widget.

- A widget shows changes from the user, from an agent, and from a timer at once.

- One bad widget does not stop the other widgets.

- The user gets many settings. The agent gets few choices and one strict path.

## Status of the evidence `explore.widget.evidence`

Six spikes proved the parts one at a time. An independent review found that the parts were not yet joined. A seventh spike joined them in the real DSH host (verified, all checks exit 0, `spikes.integration`):

- The pinned shell runs in Electron 44.7.0. A `dsh-app://` handler forwards its requests to the real host with the host cookie.

- An agent's `widget_call` through the official MCP client updates the open window over SSE: 20 of 20 times, 18 to 19 ms at the median.

- A user click in the window shows in the agent's `widget_changes` with `by:"user"`.

- A widget whose timer throws is put in quarantine. The other widgets keep working, and the host stays up.

- After a host restart, the same cookie and the same MCP client keep working, and the window connects again in about 2.1 s.

## The parts `explore.widget.parts`

The system has four packages and one bundle for each logic widget. This is the smallest set that the spikes found. The review moved the creation kit into `@deepwidgets/mcp`, because the kit is only files.

| Package | Process | Job | Spike |
|---|---|---|---|
| `@deepwidgets/widgets` | host | The widget runtime. It gives the service `ctx.widgets`, stores state and programs, runs the action contract, serves the routes of each widget, and sends change signals. | `runtime`, verified on the real DSH host |
| `@deepwidgets/mcp` | host | The MCP server for agents: the tools `widget_*`, the token handshake, and the creation kit (skill text, templates, guide). | `mcp-server`, verified (46 checks) |
| `@deepwidgets/shell` | widget window | The pinned page. It renders the OpenUI program with the component set `shadcn-widgets@1`. | `shell`, verified in Electron (19 scenarios) |
| `@deepwidgets/windows` | host and Electron main | The window manager. The host half decides. The Electron main half obeys. | `windows`, verified (45 jobs) |
| `widget-<slug>` | host | One bundle for each logic widget. It calls `ctx.widgets.register` once. A data widget has no bundle (see `options.creation`). | `creation` and `runtime`, verified |

The Electron main half of `@deepwidgets/windows` is not a Cordis plugin, because Electron main runs no Cordis. This is the one exception to `widget.plugins_only`.

```
                         ┌──────────────────────── host process (one Cordis Context) ─────────────────────────┐
 Claude Code ── /mcp ──▶ │ @deepwidgets/mcp ──▶ ctx.widgets ◀── widget-groceries   widget-weather (timer)      │
 (MCP client)            │                        │   ▲                                                       │
                         │                        ▼   │ register / update                                     │
                         │                 storageDomain "widgets" ── domain/changed ──▶ SSE signals          │
                         │ @deepwidgets/windows (host half) ── Node IPC ──┐                                  │
                         └────────────────────────────────────────────────│──────────────────────────────────┘
                                   ▲ /api/widgets/<slug>/{program,call,stream}   (connection, cookie)
                                   │                                       ▼
 Electron main: protocol.handle (dsh-app://) ── forwardWebRequest     windows half: create, place, pin
                                   ▲
 widget window: @deepwidgets/shell (React 18 + react-lang + shadcn-widgets@1) ── one window per slug
```

## Seams `explore.widget.seams`

DSH defines a seam as three roles: a Service Definition, a Service Provider, and a Consumer (`docs/architecture.md`, "Capability seams"). The widget system has one main seam.

| Role | Package | What it does |
|---|---|---|
| Service Definition | `@deepwidgets/widgets` | Defines `ctx.widgets`: `register`, `call`, `update`, `setProgram`, `list`, `get`. |
| Service Provider | each `widget-<slug>` bundle | Registers one widget: its actions, its seed program, and its first state. |
| Consumer | the routes, `@deepwidgets/mcp`, `@deepwidgets/windows` | The routes serve the window. The MCP server serves agents. The window manager opens windows for the widgets. |

The rule "one action, two doors" comes from this seam. A user click and an agent call run the same action through `ctx.widgets.call`. DSH has the same rule in `references/user-actions.md` of its plugin skill (verified, read).

## The widget definition `explore.widget.definition`

The runtime spike landed on this shape (verified, ran on the DSH host):

```js
ctx.widgets.register({
  slug: 'groceries', title: 'Groceries',
  program,                      // seed OpenUI Lang text; a stored program wins over it
  initialState: { items: [] },
  timeoutMs: 5000,              // optional, per widget
  actions: [
    { name: 'list', kind: 'query', handler: (args, w) => w.state.items },
    { name: 'add', kind: 'mutation', args: z.object({ text: z.string() }),
      handler: (args, w) => w.update((s) => ({ items: [...s.items, { text: args.text, done: false }] })) },
  ],
})
```

- `w` gives `slug`, `signal` (an `AbortSignal`), `state`, and `update(fn)`. A query cannot call `update`. A write after a timeout is refused (verified).

- For a CRUD widget, one descriptor, `crud.table`, makes four actions: `list`, `add`, `update`, and `remove`. The state is `{rows: [...]}`. The integration spike chose this shape and uses it in bundles and in data widgets that agents save (verified):

  ```js
  { kind: 'crud', table: { fields: {
      text: { type: 'string', required: true },
      done: { type: 'boolean', default: false } } } }
  ```

- The full service after the integration spike: `register` (returns a disposer with a `check` of the program against the actions), `list`, `inspect`, `get`, `update(slug, fn, {by})`, `call(slug, action, args, {caller, requestId})`, `setProgram`, `save`, `removeData`, `changes(since)`, `cursor`, and `guide`.

- The registration belongs to the plugin that calls `register`. When that plugin stops, Cordis removes the widget and its routes. Open streams get `{type:"removed"}` (verified).

## The flows `explore.widget.flows`

### A window opens `explore.widget.flows.open`

1. The window manager tells Electron main to open a window for the slug.

2. Electron main loads the shell from disk: `dsh-app://app/<shell path>?slug=groceries`. This needs no host.

3. The shell gets `GET /api/widgets/groceries/program`. Electron main sends the request to the host with the cookie.

4. The shell checks the catalog version of the program. Then it renders the program. Each `Query` calls `POST /api/widgets/groceries/call`.

5. The shell opens `GET /api/widgets/groceries/stream`. The first frame is `hello` with the current revisions.

The shell spike measured 114 to 126 ms from navigation to first content, against a fake host (verified). On the real host, a query call takes 2.5 ms and a mutation 12.3 ms at the median (verified, runtime bench).

### Someone changes the data `explore.widget.flows.change`

1. A user click, an agent call, or a timer runs an action, or a plugin calls `ctx.widgets.update`.

2. The runtime writes the new state in one atomic `domain.update`.

3. The storage emits `domain/changed`. The runtime sends `{type:"data", rev}` on each open stream of that slug.

4. Each window runs its queries again with the public `useTriggerAction` hook. Text that the user typed stays (verified, spike `spike-query-refresh` and the shell spike).

### An agent works with a widget `explore.widget.flows.agent`

1. The agent gets a token: `POST /mcp/token {agent}`. Claude Code can send it as a static header or get it with a header helper script (inferred from the Claude Code docs).

2. The agent calls `widget_list`, then `widget_describe(slug)` for the actions and their argument schemas.

3. The agent calls `widget_call({slug, action, args, requestId})`. The MCP server calls `ctx.widgets.call` in the same process. It does not use HTTP, because the `/call` routes admit only the owner principal (verified).

4. To learn what the user changed, the agent calls `widget_changes({since})`. MCP clients do not show push notifications to the model today (inferred from client docs, not tested).

### An agent creates a widget `explore.widget.flows.create`

There are two paths. `options.md` (`options.creation`) compares them.

- Data widget: the agent calls `widget_save` with a program and simple CRUD actions. No agent code runs. The runtime stores it at once.

- Logic widget: the agent copies the template `api-widget`, writes the actions, and installs the bundle. The install uses the DSH plugin manager. It applies live in about 0.8 s with no restart (verified).

## The window manager `explore.widget.windows`

The window manager has a host half and an Electron main half. They talk over the Node IPC channel that DSH already uses between the host and Electron main (verified in the window spike).

| Part | Job |
|---|---|
| Host half | Owns the list of windows and their saved positions (user config). Sends `sync`, `open`, `close`, `move`, and `set`. After a host restart, it sends `sync` again. |
| Electron main half | Creates one panel window for each widget, keeps each window's size to its content between the user's limits, reloads a crashed window with backoff, and reports moves by the user. |

Costs and times (verified, window spike):

- One window for each widget costs about 20.6 MB. 20 widgets use about 583 MB. A shared renderer uses about 1.8 MB for each widget, but one crash closes all of them. Thus separate windows are the default, and the shared renderer is a user setting.

- A warm hidden window shows a widget in 6 to 21 ms. A new window at N=20 takes 570 to 669 ms.

- A crashed window renders again in about 620 ms. The others stay.

## Settings `explore.widget.settings`

The user configures much. The agent configures little. The settings use DSH settings mechanisms (inferred from `docs/settings.md` and the config-editor README).

| Scope | Settings | Where they live |
|---|---|---|
| Global | MCP port, policy for agent code (`ask`, `data-only`, `deny`), action timeout, state quota, crash policy, start at login, theme, default window behavior | Config fields of the deepWidgets host plugins, saved by the DSH config editor in the profile patch |
| One widget | pinned, all Spaces, size limits, opacity, refresh interval, enabled, locked (agents cannot replace or remove it) | A `settings` field in the widget record in the `widgets` storage domain, written only through `ctx.widgets` |
| Window positions | x and y of each window, on which display | The window manager's own storage, not the `widgets` domain. Thus position writes do not wait behind state writes. |
| Options that a widget declares | A schemastery `Config`, as a DSH plugin has. The settings window renders it from its JSON Schema. | The agent may declare an option. Only the user sets its value. There is no second way to set a tunable. |

MCP tools cannot write settings. When an agent removes a widget, the widget goes to a trash that the user can restore from.

## What the agent sees `explore.widget.agent_surface`

The count of tools does not grow with the number of widgets. With seven tools, `tools/list` costs 769 tokens for 1, 10, or 50 widgets (verified).

| Mode | Tools |
|---|---|
| interact | `widget_list`, `widget_describe`, `widget_call`, `widget_changes` |
| create, data widget | `widget_guide`, `widget_save`, `widget_inspect` |
| create, logic widget | `widget_install`, `widget_reload`, `widget_remove` |

The six create tools can also be one tool with an `op` field. Ten separate tools cost more than 769 tokens (not measured). `options.mcp_tools` gives the choice.

## Open items `explore.widget.open`

`challenges.md` ranks them. The three largest:

- The DSH host exits on any uncaught error (`installFailLoud`). Thus one bad timer in one widget stops all widgets (verified). Only a change to the host's error handler fixes this in one process (`options.isolation`, option F).

- Code that an agent writes runs in the host process with full Node rights. Only an approval gate guards it in v1.

- One window for each widget costs about 20 MB. A shared renderer costs much less, but one crash then closes every widget.
