# Explainer script: deepWidgets `explainer.script`

Source of truth: `8b9c8672` (origin/main) and the open PR #65. Narration is in `narration.md` (STE, lint 0.00). Target length uses 140 spoken words per minute. Visuals give the written forms. Anything a model would produce is labeled illustrative.

Scenes: 57. Narration words: 7377. Total target: 52.7 min.

## `cold_open`

- Target length: 47 s (109 words)

**Narration**

This video explains deepWidgets, from the top down. deepWidgets puts small floating windows on your desktop. We call each window a widget. A widget shows one thing, for example a counter or a grocery list.

Two kinds of users can change a widget. You can click a button in the window. An agent can also change it. An agent is an outside AI program, for example Claude Code. An agent can even write a new widget and install it while the app runs.

The video covers what works today, what does not, and the numbers that show both. It ends with one real example that goes through every part.

**Visuals**

Dark screen. Two small floating cards fade in at the left edge: `sample` (Count 0, button Add 1) and `groceries` (milk, eggs). A cursor clicks Add 1. A second arrow labeled `agent (Claude Code)` reaches the same card from the right. Title: deepWidgets.

## `outline`

- Target length: 78 s (183 words)

**Narration**

Here is the whole path on one diagram. On the left is the desktop app. It has three kinds of processes: Electron main, the host, and one renderer for each window. The host is the process that runs all widget code.

In the middle is the host. It runs the Cordis plugin runtime. Inside the host, the widget runtime gives a service with the name context dot widgets. Each widget plugin registers with that service.

Two doors lead into context dot widgets. The first door is the page in each widget window, which we call the shell. The second door is the MCP server, on a fixed port, for agents. MCP is a standard protocol that lets an agent call tools. A user click and an agent call go through the same action code.

At the bottom are two more boxes. Creation puts new widget code through three gates before it reaches the host. Isolation keeps one bad widget from taking down the others. It has four parts: blame, quarantine, the supervisor, and the watchdog. We now walk this diagram box by box.

**Visuals**

OUTLINE DIAGRAM (the anchor, reused in every part). Left column `desktop app`: boxes `Electron main`, `host (Node)`, `renderer x N`. Middle: `host` box holds `Cordis runtime` > `ctx.widgets` (@deepwidgets/widgets) with `widget bundles` (sample, groceries) plugged in. Two arrows into ctx.widgets: top `shell page /api/widgets/<slug>/{program,call,stream}` from each widget window, right `MCP server /mcp :47615` from `agent`. Bottom boxes: `creation: compile > lint > test run > plugin manager + hmr` and `isolation: blame | quarantine | supervisor | watchdog (PR #65, open)`. Each box lights up as named.

## `dsh_fork`

- Target length: 57 s (133 words)

**Narration**

deepWidgets did not start from zero. It is a fork of DeepSeek Harness, which we call DSH. DSH is an open-source desktop app from DeepSeek, with an MIT license. A fork is a copy of a project that then changes on its own.

The fork is one squashed commit of the DSH commit two two d d e e three. A squashed commit holds a whole history as one change. The repository holds three hundred eighty-seven workspace packages. Most of them are DSH code that deepWidgets does not need.

Why start from DSH? DSH already has the three parts that a widget app needs. It has a plugin host process, a plugin client in the browser page, and an Electron desktop app. Thus the project takes those parts and turns off the rest.

**Visuals**

Outline: `host` dims; a side panel. Left: DSH logo text `deepseek-ai/deepseek-harness @ 22ddee3` (MIT). Arrow `one squashed commit` to `deepWidgets`. Counter: `387 workspace packages`. Three tiles light: `Cordis host process`, `Cordis client in the page`, `Electron app`.

## `cordis_context`

- Target length: 72 s (168 words)

**Narration**

DSH builds everything from Cordis plugins. Cordis is a plugin runtime. A plugin is a module with a function that has the name apply. Cordis calls apply when the plugin loads.

Apply gets one argument, the context. Programmers write it as c t x. Through the context, a plugin reads services and registers the things that it owns. A service is a named object on the context, for example context dot widgets. One plugin gives a service, and other plugins use it.

A plugin names the services that it needs in a list with the name inject. Cordis does not start the plugin until each of those services exists. Each loaded plugin has a fiber. The fiber is the live record of that plugin.

When the fiber ends, Cordis removes everything that the plugin registered. A call with the name context dot effect runs setup code and keeps its cleanup for that moment. This ownership rule matters later. A widget registration belongs to the fiber of its plugin.

**Visuals**

Code card: `export const name = 'deepwidgets-widget-sample'`, `export const inject = ['widgets', 'timer']`, `export function apply(ctx) { ... }`. Animated tree: root Context > fibers (one per plugin). Label `ctx.effect(setup) -> cleanup`. When a fiber node is cut, its child items (route, timer, widget) vanish together.

## `plugin_rows`

- Target length: 37 s (86 words)

**Narration**

How does Cordis know which plugins to load? It reads plugin rows. A plugin row is one entry in a config file. It gives an id, a package name, and a config. The Cordis loader is the plugin that reads the rows and loads each plugin.

A profile is a named set of rows, for example desktop or web. Packages add rows with a patch file. The patch file has the name cordis dot patch dot yml. At boot, the desktop host composes two hundred rows.

**Visuals**

YAML card `deepwidgets/widgets/cordis.patch.yml`: `- insert: - id: deepwidgets-widgets  name: '@deepwidgets/widgets'`. Then a stack of 200 small row bars labeled `desktop profile: 200 rows`. The Loader icon reads them top to bottom.

## `trim_method`

- Target length: 55 s (128 words)

**Narration**

deepWidgets turns most of those rows off. We call this the trim. The trim patch file sets disabled true on one hundred sixty of the two hundred rows. Each row stays in the file, with a comment that gives the reason.

The trim deletes no code. When a kept DSH file must change, the old lines become comments with the marker deepwidgets trim. Why keep dead code? The operator reads it to learn how DSH writes Cordis plugins.

Forty rows stay on. Eight of the forty never run. We call them pending rows. Each one waits for a service that the trim turned off. Thus a search for comments does not tell you which code runs. A row can also turn itself off with a condition in JavaScript.

**Visuals**

The 200 row bars: 160 turn grey with a tag `disabled: true  # deepwidgets-trim: <reason>`. 40 stay lit; 8 of the 40 pulse amber with `pending: waiting for service tools`. Side note: `git grep deepwidgets-trim` and `!!js "process.env.DEEPWIDGETS_PROBE === 'off'"`.

## `widget_rows_on`

- Target length: 54 s (126 words)

**Narration**

Two rows came back on for the widget system: hmr and timer. Hmr is hot module replacement. It loads changed plugin code into a running process. The plugin manager needs it. The plugin manager is the DSH plugin that installs a bundle while the app runs. A bundle is a package with code and its rows.

With hmr off, an install answers restart required, with the reason no hmr. With hmr on, the install applies at once. The check in pull request fifty measured an install in one thousand six hundred seventy-three milliseconds.

The timer row gives context dot timeout and context dot interval. Widgets use these timers to refresh their data. A Cordis timer stops when its plugin stops. A raw JavaScript timer does not.

**Visuals**

Two grey rows `hmr` and `timer` turn lit. Split panel. Left `hmr off`: `installBundle -> { application: 'restart-required', restartReason: 'no-hmr' }`. Right `hmr on`: `{ application: 'applied' }  install ms=1673` (PR #50). Under it: `ctx.timeout / ctx.interval` stop with the fiber; `setTimeout` keeps running (red).

## `three_processes`

- Target length: 61 s (143 words)

**Narration**

The desktop app runs three kinds of processes. Electron main is the first. It makes the windows and starts the host. It runs no Cordis.

The host is the second. It is a Node child process. It runs the host Cordis context, the loader, the web server, and all widget code. Electron main starts it with the flag expose internals, because the loader and hmr read private Node internals.

A renderer is the third. It is a Chromium process that shows one web page. The main window and each widget window load from the custom scheme d s h app colon slash slash. Electron main answers each request on that scheme. For a path under slash a p i, it forwards the request to the host and adds the host cookie. The host checks that cookie on each route of the connection service.

**Visuals**

Outline zooms on `desktop app`. Three boxes: `Electron main` (windows, spawn host, no Cordis), `host` (`ELECTRON_RUN_AS_NODE=1 --expose-internals`; Cordis, loader, web server, widgets), `renderer` (one per window). Arrow `dsh-app://app/api/...` from renderer to Electron main, then `+ host cookie` to host `127.0.0.1:<port>`.

## `probe_and_trace`

- Target length: 42 s (98 words)

**Narration**

Two small deepWidgets packages came first: probe and trace. The probe adds the route slash a p i slash probe. That route answers with the process id of the host. The main window shows that id. Thus the probe proves that a page can reach the host.

The trace records each row of the host as it loads, and the boot steps of the app. It serves them on slash a p i slash trace, and it shows them in a small trace window. These two packages are check tools. The widget system does not depend on them.

**Visuals**

Two small cards. `@deepwidgets/probe`: `GET /api/probe -> { ok: true, pid: 85765 }`; main window text `probe pid 85765`. `@deepwidgets/trace`: a small window list of rows with states (`active`, `pending`), routes `/api/trace` and `/trace`. Caption: check tools, not part of the widget system.

## `runtime_overview`

- Target length: 46 s (108 words)

**Narration**

Now the center of the diagram: the widget runtime. It is the package deepwidgets slash widgets, in TypeScript. Its row gives the service context dot widgets. It needs two services: connection, for routes, and storage domain, for data on disk.

The service has nine methods. Register adds a widget. List and describe tell what is live. Get reads the state.

Call runs one action. Update writes the state from a timer. Set program stores new screen text. Changes and cursor give the change feed. The methods report each failure as a widget error with a code. A malformed definition is the one exception: it throws a type error.

**Visuals**

Outline zooms on `ctx.widgets`. Card: `@deepwidgets/widgets`, row `deepwidgets-widgets`, `inject = ['connection', 'storageDomain']`. Nine method chips: register, list, describe, get, call, update, setProgram, changes, cursor. Error chip: `WidgetError { code, status }`; `TypeError` only for a malformed definition.

## `widget_definition`

- Target length: 83 s (193 words)

**Narration**

A widget definition has five parts. The slug is the id of the widget, for example groceries. It uses lower-case letters, digits, and hyphens, up to sixty-three characters. The title is the name for people.

The program is the text that tells the window what to show. It is data, not code. The text in the widget code is the seed program. The initial state is the first JSON data of the widget.

The last part is the list of actions. An action is a named operation with a handler function. Each action has one of two kinds.

A query only reads the state. A mutation can write it. An action can also have its own timeout and an argument schema in zod. Zod is a TypeScript library that checks data shapes.

A handler gets the arguments and an object w. W dot state is the current state. W dot update takes a function that makes the new state. W dot signal tells the handler when its time is over. The runtime checks the whole definition at register. A bad slug, a bad action name, or a repeated action throws a type error.

**Visuals**

Code card (sample): `slug: 'sample'`, `title: 'Sample'`, `program: PROGRAM`, `initialState: { count: 0 }`, `actions: [ { name: 'get', kind: 'query', handler: (_a, w) => w.state }, { name: 'add', kind: 'mutation', args: z.object({ by: z.number() }), handler: ({ by }, w) => w.update(s => ({ count: s.count + by })) } ]`. Side: slug regex `^[a-z0-9][a-z0-9-]{0,62}$`; `w = { state, update(fn), signal }`.

## `register_ownership`

- Target length: 27 s (64 words)

**Narration**

Register is a Cordis effect. The fiber that calls register owns the registration. When that plugin stops, the widget goes away. Its routes go, its streams get a removed message, and its window closes.

The stored state stays on disk. Thus a widget that comes back gets its data back. A second live register call of the same slug fails with the code conflict.

**Visuals**

Fiber node `deepwidgets-widget-sample` owns a widget chip `sample` with three route chips and a stream. The fiber is cut: routes fade, the stream shows `{ type: 'removed' }`, the window closes. A disk icon `state: { rev: 10, data: { count: 10 } }` stays. Second register attempt: red `409 conflict`.

## `storage_tables`

- Target length: 61 s (143 words)

**Narration**

The runtime keeps its data in a storage domain. A storage domain is a DSH service with named tables of records on disk. The domain has the name widgets, at version one. In this profile, it uses the JSON backend.

The domain has three tables. The state table holds one record for each slug: a revision number and the data. A revision is a number that goes up by one on each write. The program table holds the program text of each slug, with its own revision.

The requests table makes retries safe. We come back to it soon. On the first register, the runtime writes the seed program and the initial state. After that, the stored records win over the seed. Each write to the domain sends a change event. The runtime turns that event into a message for each open window.

**Visuals**

Disk icon `storage domain 'widgets' v1 (json)`. Three tables. `state`: `sample -> { rev: 0, data: { count: 0 } }`. `program`: `sample -> { rev: 1, text: 'root = Card(...)', updatedAt }`. `requests`: `sha256([caller, requestId]) -> { hash, at, outcome }`. Arrow `domain/changed` -> `{ type: 'data', rev }` frame.

## `queue_rule`

- Target length: 56 s (130 words)

**Narration**

Now the rules of a call, which we call the action contract. The first rule is the queue. Each slug has one queue for mutations and updates. It is first in, first out. One job runs at a time, in the order that the jobs came.

Why? A handler can read the state, wait, and then write. Without the queue, two parallel calls read the same old value, and one change gets lost. The runtime check proves this. Ten parallel calls of such a handler give plus ten with the queue. With the queue removed, they gave plus one.

A query does not wait in the queue, because it does not write. A job that waits longer than its timeout fails with the code busy, and it does not run.

**Visuals**

Animation: queue lane for slug `check`; ten `add` jobs enter and run one at a time; counter goes 0 -> 10. Mutant lane (no queue): all ten read n=0 and the counter ends at 1. Caption from PR #54: `FAIL queue: ... +10: n=1`. A `get` (query) passes beside the lane. A job with a clock over its timeout drops out: `503 busy`.

## `timeout_rule`

- Target length: 57 s (132 words)

**Narration**

The second rule is the timeout. Each action has a time limit. The action can set it. Else the widget value applies. Else the limit is five seconds.

At the limit, the call answers with the code timeout. The runtime also sets w dot signal, so the handler can stop. It then refuses each later write of that call. This includes a write through context dot widgets dot update from inside the call. Why? A call that the caller saw fail must not change the data later.

One limit is important here. The timeout is a JavaScript timer. A handler that never gives back control, for example an endless loop, also stops that timer. The timeout cannot end such a loop. Only the watchdog can, and the watchdog is not merged yet.

**Visuals**

Timeline: call `late` (timeoutMs 300) starts; at 300 ms a red line: `504 timeout`, `w.signal.aborted = true`. At 600 ms the handler tries `w.update(...)` and `ctx.widgets.update(...)`: both bounce `timeout: a write after the timeout was refused`; count stays 10. Order: action timeoutMs > widget timeoutMs > 5000. Footnote: a `while (true)` freezes the timer too.

## `args_and_errors`

- Target length: 48 s (112 words)

**Narration**

The third rule is the argument check. The runtime checks the arguments against the zod schema before the call goes into the queue. Bad arguments thus never use a queue slot.

Each failure has a code and an HTTP status. Unknown widget and unknown action give four hundred four. Invalid arguments give four hundred twenty-two.

A handler that throws gives five hundred, and a timeout gives five hundred four. Busy gives five hundred three.

Idempotency conflict and conflict give four hundred nine. A bad request gives four hundred. Two codes came with isolation: safe mode and widget failed. Both give five hundred three. A query that tries to write gets handler error.

**Visuals**

Table, row by row: unknown-widget 404, unknown-action 404, invalid-args 422, handler-error 500, timeout 504, busy 503, idempotency-conflict 409, conflict 409, bad-request 400, safe-mode 503, widget-failed 503. A zod check sits before the queue lane.

## `idempotency`

- Target length: 73 s (171 words)

**Narration**

The fourth rule makes a retry safe. A mutation can carry a request id. The runtime then runs the call once for each pair of caller and request id. A call that runs again with no second effect is idempotent.

The runtime keeps a hash of the call: the slug, the action, and the arguments. A retry with the same hash gets the stored answer and the flag replayed. A retry with other arguments gets idempotency conflict. Three parallel retries share one run.

The answers live in the requests table, on disk. Why on disk? A host can crash and restart.

The check proves that a replay after a host restart still runs once. A record older than ten minutes is void. The runtime stores a failed call only when it already wrote. Thus a retry of a busy call can run.

One gap stays. The state write and the request record are two writes. A crash between them can make a retry run twice. We infer this from the code.

**Visuals**

Three calls `add {by:1} requestId 'same'` merge into one run; two come back `replayed: true`. Disk row `requests`. Host restart icon; replay of `restart-1` after restart: `replayed: true`, count unchanged. Same id with `by: 6`: `409 idempotency-conflict`. Caption: TTL 10 min. Small red note: state write and request record are two writes (inferred gap).

## `change_feed`

- Target length: 45 s (105 words)

**Narration**

An agent cannot see your clicks. So the runtime keeps a change feed. Each change has a sequence number, the time, the slug, the kind, and who made it. The field by holds that name, for example user, an agent id, host, or timer.

The feed keeps the last one thousand changes in memory. A cursor marks a point in it. A cursor is text with two parts: an epoch and a sequence number. The epoch is a random id of the host process. A cursor from an older process, or one that is too old, gives reset. The agent then reads the list again.

**Visuals**

Ribbon of entries: `{ seq, at, slug, kind: 'state' | 'program' | 'added' | 'removed', by, action?, rev? }`. Cursor chip `f6967379:1` (epoch:seq). Log window bracket `last 1000`. A cursor from another epoch -> `reset: true`.

## `routes`

- Target length: 53 s (123 words)

**Narration**

The runtime serves five routes through the connection service. Each route thus has the cookie check. Slash a p i slash widgets gives the list. Slash a p i slash widgets slash events is a stream of added and removed messages.

Each slug gets three routes. Program gives the text and its revision. Call takes an action, its arguments, and an optional request id. Stream is the live channel of that widget.

Both streams use server-sent events. That is a one-way HTTP stream of text frames. The first message is hello. After it come data, program, and removed. The server sends a ping every fifteen seconds. A slug that is not live has no routes, so it gets a plain four hundred four.

**Visuals**

Route table: `GET /api/widgets`, `GET /api/widgets/events` (SSE: hello {slugs}, added, removed), `GET /api/widgets/<slug>/program` ({ rev, text }), `POST /api/widgets/<slug>/call` ({ action, args, requestId? }), `GET /api/widgets/<slug>/stream` (SSE: hello {rev, programRev}, data, program, removed; `: ping` every 15 s). Cookie lock icon on each. `/api/widgets/ghost/call -> plain 404`.

## `drain_on_stop`

- Target length: 32 s (74 words)

**Narration**

What happens when the runtime itself stops, for example on a reload? It first refuses new work with busy. Then it closes the event streams. It waits for each running call to finish. Only then does it close the domain.

Why? A call that started must not lose its write in the middle. The wait has an upper bound: two times the longest timeout, plus one second. The bound only guards against a defect.

**Visuals**

Sequence: stopping = true -> new call `503 busy`; event streams close; running `slow` call finishes with its write (rev +1); then domain closes. Bound label: `2 x longest timeout + 1 s`.

## `sample_widget`

- Target length: 37 s (87 words)

**Narration**

The repository has one built-in widget, sample. It is a counter. Its query get returns the count. Its mutation add takes a number and adds it.

Its program shows a card with the title, the count, and a button. The button runs add with one, and then runs get again. With the config tick milliseconds above zero, an interval adds one at that rate. The default is zero, so the timer is off. The interval catches its own errors, because a Cordis timer does not catch them.

**Visuals**

Rendered sample card: header `Sample / A counter`, stat `Count 0`, button `Add 1`. Program text below (3 lines). Config `tickMs: 0` (default); with `tickMs: 100` the counter climbs (runtime check: +3 or more in 700 ms).

## `openui_lang`

- Target length: 65 s (151 words)

**Narration**

Now the shell box, starting with the program language. You write a program in OpenUI Lang, version one point zero point one. A program is a list of statements. Each statement has a name, an equals sign, and an expression.

The statement root is the screen. Look at the sample program. Root is a card with a header, a stat, and a button. The statement s is a query: it runs the action get. The statement add is a mutation: it runs the action add with by one. The button runs an action plan: run add, then run s.

A program can use only the components of one component set. deepWidgets ships the set shadcn widgets at one. It has nineteen components. Examples are card, row, list, stat, button, input, checkbox, table, and two charts. Shadcn is a popular set of React components. The set ports a small part of it.

**Visuals**

Program text of sample, each statement highlighted in turn: `root = Card([CardHeader("Sample", "A counter"), Stat("Count", s.count), Button("Add 1", Action([@Run(add), @Run(s)]))])`, `s = Query("get", {}, {count: 0})`, `add = Mutation("add", {by: 1})`. Side grid of the 19 components of `shadcn-widgets@1`: Card, Row, List, CardHeader, TextContent, Stat, Button, Input, Checkbox, Badge, Progress, Alert, Separator, Table, Col, Empty, BarChart, LineChart, Series.

## `shell_page`

- Target length: 69 s (160 words)

**Narration**

The shell is the page in each widget window. It is a React page that Vite builds. React is a UI library, and Vite is a build tool. The shell pins React at eighteen point three point one. All widgets share this one shell at one version. This is a decision: no widget shows HTML that a server makes.

The page reads the slug from its address. It gets the program from the program route. It checks the component set name. A program that names another set gets an error screen. An empty program shows the text: this widget is empty.

Then the OpenUI renderer draws the program. Each query and each mutation goes through a tool provider. The shell tool provider sends each one to the call route. The page never retries a call, because a mutation must not run twice. All requests go through one small module, the channel. A faster transport can later replace only that module.

**Visuals**

Outline zooms on `shell page`. Flow: `dsh-app://app/widget/?slug=sample` -> `GET program` -> catalog check (`shadcn-widgets@1`) -> `Renderer.Root` -> toolProvider -> `POST /call`. Pins: React 18.3.1, @openuidev/react-lang 1.0.1, lang-core 1.0.1, Vite 6.4.3. Box `channel.ts` around all requests. States: loading, error, empty (`This widget is empty`), removed.

## `shell_refresh`

- Target length: 48 s (111 words)

**Narration**

How does a window learn that the data changed? It reads its stream. On a data frame, it runs all of its queries again. It does this with the public OpenUI hook use trigger action. Text that you typed in an input stays.

On a program frame, it loads the program again. On removed, it shows the text: this widget is gone. On each new hello, it compares the revisions with the last ones that it saw. If it missed a change while the stream was down, it catches up.

The refresh depends on an action plan shape that OpenUI does not export. That is why the shell pins the version.

**Visuals**

Stream frames arrive: `data {rev: 1}` -> `useTriggerAction` runs each query statement -> the stat changes 0 -> 1. `program {rev: 2}` -> loads program again. `hello` after a reconnect -> compare revs, catch up. Small warning: action plan shape not exported, pin 1.0.1.

## `shell_reconnect`

- Target length: 42 s (99 words)

**Narration**

A browser event source has one trap. When it gets an answer that is not two hundred, it stops for good. So the shell watches for that close. It opens a new stream after a wait. The wait starts at two hundred fifty milliseconds and doubles up to eight seconds.

Electron main does its part too. While the host is down, it answers each forwarded request with a network error, not with five hundred three. A network error lets the event source retry by itself. The program request makes up to four tries, with five seconds for each try.

**Visuals**

EventSource lifecycle: answer 503 -> CLOSED (red, stops forever). The shell timer: 250 ms, 500, 1 s, 2 s, 4 s, 8 s cap. Electron main panel: host down -> `Response.error()` (network error) -> EventSource retries itself. Program fetch: 4 tries, 5 s each.

## `shell_serving`

- Target length: 37 s (86 words)

**Narration**

Where does the page come from? Electron main serves the built shell files from disk, at d s h app colon slash slash app slash widget. It does not ask the host for them. Thus the page loads even while the host is down.

The pull request check of the shell showed the full loop in the app. The page showed count zero. A post of add answered revision one. The page then showed count one after one refresh, with the frames open, hello, and data.

**Visuals**

Electron main box serves `/widget/*` from `@deepwidgets/shell/dist` on disk; `/api/*` forwards to host. PR #57 smoke lines: `widget first={count:"0", stream:"open", events:["open","hello"]}`, `widget add={status:200, body:{ok:true, result:{count:1}, rev:1}}`, `widget after-add={count:"1", refreshes:1, events:["open","hello","data"]}`.

## `windows_manager`

- Target length: 71 s (166 words)

**Narration**

The next box is the windows. A class in Electron main opens one window for each widget. It reads the events stream of the host with the host cookie.

On hello, it opens a window for each listed slug, and it closes the others. On added, it opens one. On removed, it closes one. When the stream ends, it opens it again. The wait starts at half a second and doubles up to ten seconds.

Each window has no frame, stays on top, shows on all Spaces, and does not take focus. Spaces are the virtual desktops of macOS. Each window is three hundred twenty by three hundred pixels. The windows stack down the left side of the main screen. Each window has its own renderer, in a sandbox.

The windows stay open while the host is down. A window that fails to load closes, and it opens again at the next hello. Saved positions, a window manager, and a tray icon are not built yet.

**Visuals**

Outline highlights `Electron main`. `DesktopWidgetWindows` reads `GET /api/widgets/events`. hello {slugs:[sample, groceries]} -> two windows at left edge (320 x 300, gap 16). removed groceries -> one window closes. Window flags: `frame: false`, `alwaysOnTop: true`, `setVisibleOnAllWorkspaces(true)`, `showInactive()`, `sandbox: true`. Reconnect: 0.5 s doubling to 10 s.

## `mcp_server`

- Target length: 60 s (140 words)

**Narration**

Now the second door: the MCP server for agents. MCP is the Model Context Protocol. It is a standard way for an AI agent to call the tools of a server. A tool is one named operation with an input schema.

The package deepwidgets slash mcp mounts one route, slash mcp, on the host web server. It uses the official MCP software kit in stateless mode. Stateless means that the server keeps no session between requests.

The server has nine tools. Four tools interact: widget list, widget describe, widget call, and widget changes. Five tools create: widget template, widget guide, widget install, widget reload, and widget remove. The tool count does not grow with the widget count. Each tool calls context dot widgets in the host. Thus an agent call gets the same queue, timeout, and checks as a click.

**Visuals**

Outline highlights `MCP server`. Route `/mcp` on the host web server. `@modelcontextprotocol/server` 2.2.0, stateless. Two columns of tools: interact (widget_list, widget_describe, widget_call, widget_changes), create (widget_template, widget_guide, widget_install, widget_reload, widget_remove). Caption: 9 tools for 1 or 100 widgets.

## `mcp_port`

- Target length: 75 s (176 words)

**Narration**

An agent must find the server. So the host binds a fixed port. The default is forty-seven thousand six hundred fifteen. The setting deepwidgets M C P port changes it. A value of zero lets the system pick a port. A value that is not a port stops the host with an error.

If another process holds the port, the app fails at start, with the error address in use. This is on purpose. A host on a surprise port would leave agents with no way to find it.

The host then writes the port file, mcp dot json, in the DSH home folder. It holds the port, a nonce, the process id, and the start time. A nonce is a random secret that the host makes new at each start. The file has mode six hundred, so only your user can read it.

The host writes the file only after the route is live. It does not take a file whose host is still alive. Electron main removes the file of a host that dies.

**Visuals**

Port number `47615` large. `DEEPWIDGETS_MCP_PORT` (in `$DSH_HOME/.env` or env); `0` = OS picks; bad value -> error. Second app on the same port: `Error: listen EADDRINUSE: address already in use 127.0.0.1:P` (PR #60). File card `$DSH_HOME/deepwidgets/mcp.json` mode 0600: `{ "port": 53312, "nonce": "mf7wks...", "pid": 85765, "started": 1793606813019 }` (from the worked example).

## `mcp_handshake`

- Target length: 67 s (156 words)

**Narration**

Before an agent sends data, it checks that the server is the real host. Another process can take the port after the host stops. The check is a handshake.

The agent reads the nonce from the port file. It makes a challenge: at least sixteen random bytes. It posts its name and the challenge to slash mcp slash token. The answer has a token, an agent id, and a proof.

The proof is an HMAC, a keyed hash, of the challenge, with the nonce as the key. The agent makes the same HMAC. If the two do not match, it stops.

The nonce never leaves the file. Thus a fake server cannot make the proof. The host stores only a hash of each token, and it keeps the sixty-four newest. Each host start has a new random id, so each old token gets four hundred one after a restart. The agent then does a new handshake.

**Visuals**

Sequence diagram. Agent reads `mcp.json` (nonce stays local). `POST /mcp/token { agent: 'Claude Code', challenge: '7vFM_pcU01mzX96pLOmRsQ' }`. Answer `{ token, agentId: 'claude-code-c1e6b7', proof: '7e69ce49...' }`. Agent computes `HMAC-SHA256(nonce, challenge)` -> match (green). Fake server path: no nonce -> mismatch -> stop (red). Token file row: `sha256(token) -> { agentId, agent, issuedAt, epoch }`, max 64.

## `mcp_fence`

- Target length: 45 s (105 words)

**Narration**

Each request on slash mcp passes a fence. The peer address must be loopback, which means this computer. A request with an origin header or a fetch site header gets four hundred three. Those headers come from browsers, and an MCP client is never a browser. Why does that matter? A web page that you visit must not drive your widgets.

The host header must be exactly a loopback name. A request with no token, or an unknown token, gets four hundred one. One limit stays. A process of your own user can read the port file. The handshake does not protect against that process.

**Visuals**

Gate graphic with four bars: `peer loopback (127.0.0.0/8, ::1)`, `no Origin / Sec-Fetch-Site -> 403`, `Host must be 127.0.0.1 | localhost | [::1]`, `Bearer token -> else 401`. A browser icon bounces off bar two. Caption limit: a process of your own user can read mcp.json.

## `mcp_interact`

- Target length: 60 s (141 words)

**Narration**

The interact tools follow one path. Widget list gives each live widget and a cursor. Widget describe gives the actions of one widget, with the JSON Schema of each argument object, and the state. Widget call runs one action. The caller is the agent id of the token. Widget changes gives the changes after a cursor.

Each tool error has three parts: a code, a message, and a next step. The next step tells the agent what to do. For example, after timeout, it says: read the state before you retry with the same request id. There are twenty codes, each with its own next step.

Agents do not get pushed news. Claude Code version two point one point three one one drops notifications that a server pushes. So an agent learns about your clicks only when it calls widget changes.

**Visuals**

Four tool cards in a path: widget_list -> widget_describe -> widget_call -> widget_changes. Error card: `{ code: 'timeout', message, nextStep: 'The action ran past its limit and was aborted. ... before you retry with the same requestId.' }`. Counter: 20 codes. Note: `Claude Code 2.1.311 drops resources/updated and custom notifications` (standing.checked.mcp_push).

## `creation_overview`

- Target length: 63 s (148 words)

**Narration**

Now the creation box. An agent creates a widget in four moves. It calls widget template and gets a starter file in TypeScript. It calls widget guide and gets the rules and the program language. It writes the files into a folder. Then it calls widget install with that folder.

Install runs three gates in order: compile, lint, and test run. A gate is a check that new code must pass before it reaches the host. The first gate that fails stops the install. The answer then names the gate and lists each problem with its file, line, and column.

Code that passes goes into a folder that the profile owns. The plugin manager installs that folder, and hmr applies it at once. Why three gates? A spike measured an agent that made forty edits. Without gates, fourteen edits crashed the host. With gates, zero edits crashed it.

**Visuals**

Outline highlights `creation`. Four steps as icons: widget_template -> widget_guide -> write files -> widget_install(dir). Gate pipeline: compile -> lint -> test run -> `<profile>/deepwidgets-widgets/<slug>` -> plugin manager `installBundle` -> hmr `applied`. Spike bar chart: 40 edits, crashes without gates 14, with gates 0 (standing.checked.dev_gates).

## `gate_compile`

- Target length: 17 s (40 words)

**Narration**

The compile gate copies the source folder into a new temporary folder. It never works in the agent folder. Then esbuild, a fast bundler, bundles the source and zod into one JavaScript file for Node. A syntax error stops here.

**Visuals**

Folder copy: agent folder `src/` -> `/tmp/deepwidgets-gates-XXXX/src`. esbuild options card: `bundle: true, platform: 'node', format: 'esm', target: 'node22'`. Output `out/index.js`.

## `gate_lint`

- Target length: 69 s (161 words)

**Narration**

The lint gate runs oxlint, a fast linter, with the types. It also runs a full type check against the widget type file. That file allows two imports only: zod and the widget types. Node modules are not in the types.

The rules refuse four raw timers: set timeout, set interval, set immediate, and queue microtask. They also refuse them as properties, for example global this dot set timeout. Why? A raw timer does not belong to the widget, so it runs on after the widget stops. A Cordis timer stops with it.

The rules also refuse a floating promise, which is a promise that nobody awaits or catches. Why? A rejection with no handler ends the host.

A last rule refuses a loop with no exit, for example while true with no break. Why? Such a loop blocks every widget. deepWidgets checks this rule with its own code on the TypeScript syntax tree. The oxlint plugin form crashes under Electron.

**Visuals**

oxlint config card: `typescript/no-floating-promises`, `typescript/no-misused-promises`, `no-restricted-globals: setTimeout, setInterval, setImmediate, queueMicrotask`, `no-restricted-properties` (same names). tsconfig `lib: ['es2024', 'dom']`, `types: []`, `paths: { zod }`. Loop rule card `deepwidgets(no-endless-loop)` from `loop-check.ts`, with `while (true) { ... }` struck out. Footnote: oxlint JS plugins exit 133 under Electron.

## `gate_test_run`

- Target length: 78 s (182 words)

**Narration**

The test run gate starts a new process with a heap limit of two hundred fifty-six megabytes. The heap is the memory for objects. The process loads the bundle into a bare Cordis context, with the real timer service and a stand-in widgets service.

It runs apply, which must finish in one second. It calls each action once with empty arguments, with one second for each call. Then it lets the timers run for one and a half seconds. The bundle must register exactly one widget. An uncaught error or an unhandled rejection fails the gate.

The process prints a heartbeat every tenth of a second. If it is silent for seven hundred fifty milliseconds, the parent kills it. That is how the gate catches a loop that the lint missed.

The gate has two known holes. A timer that fires after one and a half seconds is not tested. An action whose argument schema refuses empty arguments is not called. The answer gives a warning for that action. The example at the end of this video goes through the first hole.

**Visuals**

Process box `node --max-old-space-size=256 testrun-child.js out/index.js 1500`. Inside: `new Context()`, `TimerService`, `StandInWidgets`. Steps: `STEP apply` (1 s), `STEP action <slug>.<name>` (1 s each, args {}), `STEP timers` (1.5 s), `RESULT {...}`. Heartbeat `HB` every 100 ms; parent kill at 750 ms silence, 10 s to start, 15 s total. Two holes in red: timers after 1.5 s; actions whose schema refuses {}.

## `install_replace`

- Target length: 55 s (128 words)

**Narration**

A second install of the same slug replaces the bundle. The installer writes the new bundle beside the old one. It removes the old bundle and installs the new one. If the new one fails, it puts the old one back. One install runs at a time.

The state stays, because it lives in storage, not in the bundle. Widget remove takes the bundle away, and the state still stays. A later install of that slug gets its data back.

What about the program? A stored program wins over the seed. So when the seed in the code changes, the installer writes the new seed with set program. It keeps a hash of the last seed to know. An install cannot take the slug of a built-in widget.

**Visuals**

Folder animation: `groceries.next` written; old bundle removed; `groceries` renamed to `groceries.previous`; `.next` -> `groceries`; installBundle. Failure branch: restore `.previous`. State disk untouched. `.seeds/groceries` holds sha256 of the last seed; changed seed -> `setProgram(..., { by: 'widget_install' })`.

## `isolation_why`

- Target length: 69 s (160 words)

**Narration**

Now the hard part: isolation. Widget code that an agent writes runs inside the host, with full Node rights. It can call any server. One bad widget can stop every widget. The gates catch the usual mistakes. They are not a sandbox.

So deepWidgets uses a crash-only host. On an uncaught exception or an unhandled rejection, the host does not try to go on. It names the guilty widget, writes a record, and exits. Electron main then starts a new host. That host keeps the guilty widget off.

Why not catch the error and go on? Cordis does not contain errors in timers or listeners. They reach the process handlers. An earlier design caught them there and went on. That handler could also swallow an error in host code that a widget called.

Each crash stops every widget for about two seconds. In the merged supervisor check, a new host answered one thousand five hundred sixty milliseconds after a kill.

**Visuals**

Outline highlights `isolation`. One host box with five widget chips; one chip turns red and the whole host blinks out, then comes back with the red chip greyed. Caption: crash-only host. PR #61 number: `new host answered 1560 ms after kill`. Note: `ctx.timeout / ctx.interval / ctx.on do not contain errors` (standing.checked.cordis_containment).

## `blame_store`

- Target length: 69 s (162 words)

**Narration**

How does the host know which widget failed? It uses AsyncLocalStorage. This Node feature keeps one value across all the timers, promises, and callbacks that one piece of code starts. The value here is the id of the widget row.

The runtime wraps the plugin body of each widget row in that store. A widget row is a row whose id starts with deepwidgets widget. It also runs each action handler in the store of its row. Thus a timer that a widget makes still carries the widget name when it fires.

The blame key is the loader row, not the plugin name. Why? A bundle can export any name. A name key would let one bundle get another widget blocked.

The wrap uses a private part of Cordis, the fiber runner. Cordis has no public hook around a plugin body. The spike found one misblame. A host timer that host code first makes inside a widget call carries that widget store.

**Visuals**

A plugin body box wrapped by `blameStore.run('include:deepwidgets-widget-groceries', ...)`. Inside it a timer, a promise, a listener each carry a small tag with the row id. Handler path: `runAs(entry.registration.row, () => action.handler(args, scope))`. Side note: key = Loader row id (`WIDGET_ROW = /^deepwidgets-widget-/`), not plugin `name`. Warning chip: `fiber._runner.execute` (undocumented).

## `claimer`

- Target length: 71 s (165 words)

**Narration**

The claimer is the function that runs at the crash. DSH has a fail-loud handler for fatal errors. deepWidgets adds a hook to it, marked as a trim change. The hook runs after the DSH report, in the async context of the error.

The claimer reads the store first. If the store is empty, it looks for a widget package folder in the error stack. Else it blames no widget. It writes crash dot json with one synchronous write and a rename. The record holds the row, the slugs, the error, the time, and the method. It also holds the package folder, a hash of its files, and the process id.

Then the host exits at once. It skips the DSH cleanup, which takes about two point nine seconds on the desktop host. The blame check ran nine kinds of faults. Eight blamed the widget, and the host error blamed none. The time from the fault to the exit was eighteen to one hundred milliseconds.

**Visuals**

Flow: `uncaughtException` -> DSH installFailLoud diagnostic -> `Symbol.for('deepwidgets.fatal.hooks')` -> claim(): store? -> stack folder match? -> none. Writes `crash.json` (temp file + rename). `process.exit(1)`. Struck-out box `fiber dispose ~2.9 s`. Table from `tools/widgets-blame.mjs` (this run): timer-throw store 64 ms, interval-throw store 62, promise-reject store 63, fetch-reject store 18, listener-throw stack 100, service-throw store 61, service-reject store 62, string-throw store 62, host-throw none 61.

## `quarantine`

- Target length: 65 s (152 words)

**Narration**

The next host reads the crash record. If the record names a row and is not yet applied, the host moves that row into the quarantine file. Then it marks the record as applied.

A row in quarantine loads with no code. Each of its slugs still shows in the list, with failed and the reason. The call route and the program route answer five hundred three, widget failed. The stream hello says program revision minus one. Thus the page loads the program again when the widget comes back. The other widgets run as normal.

How does a widget leave the quarantine? The host keeps a SHA-256 hash of the package files. A hash is a short fingerprint of data. When the files change, the hash changes, and the next load runs the widget. A widget that crashes before it registers has no package folder. It cannot leave by a hash change.

**Visuals**

Next host start: `crash.json { applied: false }` -> `quarantine.json [ { row, slugs, reason, hash } ]` -> `crash.json { applied: true }`. Widget chip greyed with `failed: quarantined after a crash ...`. Routes: `/call` and `/program` -> `503 widget-failed`; stream `hello { programRev: -1 }`. Lift: `sha256(files) != stored hash` -> chip lights again.

## `supervisor`

- Target length: 61 s (143 words)

**Narration**

The supervisor lives in Electron main. It owns a host exit only after the first host was ready. A host that cannot boot still fails loudly at once. For example, a taken port still shows its error.

When an owned host exits, the supervisor reads the crash record. The record counts only when its process id matches the dead host and no host applied it yet. Then the crash has a blame. A blamed crash restarts after half a second, and it does not count toward the limits. The quarantine handles it.

An unblamed crash counts. The supervisor counts the unblamed crashes of the last sixty seconds. The wait before the restart is half a second, then two seconds, then eight seconds. The restart starts a new host and loads the main window again. The widget windows stay open, and their pages reconnect.

**Visuals**

Electron main box `DesktopHostSupervisor`. Host exit -> read crash.json -> `pid == dead child pid && !applied && row` ? blamed : unblamed. Timeline bars: blamed -> 500 ms, not counted. Unblamed in 60 s: 1st 500 ms, 2nd 2000 ms, 3rd 8000 ms. Restart: `backend.start` then `navigateMain`. Widget windows stay.

## `safe_mode`

- Target length: 51 s (120 words)

**Narration**

After two unblamed crashes in sixty seconds, the next host starts in safe mode. Electron main sets a flag in the host environment. In safe mode, the runtime refuses each widget that is not built in. The list shows such a widget as off, with the reason. It has no routes and no window.

Built in means that the module file of the row is in a listed repository folder. Today the list holds one folder: widget sample. The check uses the real file path, not the package name, because a bundle can take any name.

After four unblamed crashes in sixty seconds, the supervisor gives up. It shows the DSH fatal dialog. On macOS, that dialog blocks Electron main.

**Visuals**

Policy table from the real `HostCrashPolicy` (worked example, fake clock): t=0 blamed -> restart 500 ms, crashes 0; t=1 s -> crashes 1, 500 ms; t=5 s -> crashes 2, 2000 ms, safeMode true; t=15 s -> crashes 3, 8000 ms, safeMode true; t=30 s -> give-up, crashes 4; t=100 s -> crashes 1 (window passed). Env chip `DEEPWIDGETS_SAFE_MODE=1`. Built-in list `['widget-sample']`, checked by real module path. Fatal dialog icon.

## `watchdog_open`

- Target length: 94 s (220 words)

**Narration**

One box is not merged yet: the watchdog. It is in pull request sixty-five, which is open. Here is why it matters. A widget can loop forever without an error. Then nothing throws, so the claimer never runs. The whole host freezes, and today nothing kills it.

The watchdog is a worker thread, a second JavaScript thread in the host. The main thread adds one to a heartbeat counter every one hundred milliseconds. Before widget code runs, the runtime writes the widget into a shared slot. The worker checks the heartbeat every fifty milliseconds.

At a stall of half a second, the worker writes a provisional record that blames the widget in the slot. Why so early? An out-of-memory abort runs no JavaScript at all. The early record is then the only blame. At a stall of two seconds, the worker writes the crash record and kills the host.

The pull request reports these results. A host parse of one hundred fifty megabytes took seven hundred fifty-seven milliseconds, and the host lived. A loop in an action killed the host two thousand forty-one milliseconds after the call. The desktop host has no native stack module, so there it blames by the slot only. Thus a loop in a raw timer or after an await is not blamed in the app.

**Visuals**

Banner `PR #65 - OPEN, not merged`. Main thread lane bumps `heartbeat` every 100 ms; `runAs` writes the row slot index into `running` slot (SharedArrayBuffer, Int32 slots). Worker polls every 50 ms. Stall clock: 500 ms -> `provisional.json`; 2000 ms -> `crash.json` + SIGKILL. PR numbers: parse 150 MB 757 ms -> host lives; spin -> killed 2041 ms after call; desktop: blame by slot only (no Electron build of @sentry/node-native-stacktrace).

## `example_intro`

- Target length: 37 s (87 words)

**Narration**

Now the worked example. It goes through every box with real data. This run used the real code at commit eight b nine c eight six seven two. It ran a command-line host with no windows, so it shows no pixels. The run took about seventeen seconds.

The widget is a grocery list with the slug groceries. Its code is illustrative. It stands for what an agent would write. It has a query list and a mutation add. Add takes a text of one to eighty characters.

**Visuals**

Outline returns, every box dim. A token labeled `groceries (illustrative agent code)` sits at the agent. Header: `worked example: real run at 8b9c8672, CLI host (no windows), 16.7 s`. Code card of the source (actions `list` query, `add` mutation with `z.string().min(1).max(80)`).

## `example_handshake`

- Target length: 49 s (114 words)

**Narration**

The host booted in one thousand fifty-two milliseconds. It wrote the port file with the port, the nonce, the process id, and the start time. The agent posted its name, Claude Code, and a random challenge.

The answer gave a token, the agent id claude code c one e six b seven, and a proof. The agent made its own HMAC with the nonce from the file. The two matched. The token file then held a hash of the token, not the token.

The fence also answered as designed. A request with no token got four hundred one. A request with an origin header got four hundred three, because the fence refuses browser requests.

**Visuals**

Outline lights `MCP server`. Real values: `host_boot bootMs 1052, port 53312, pid 85765`. `mcp.json` card (nonce masked). Request `{ agent: 'Claude Code', challenge: '7vFM_pcU01mzX96pLOmRsQ' }`; answer `{ agentId: 'claude-code-c1e6b7', proof: '7e69ce4951628f60...' }`; check mark `proofMatches: true`. Token file row with `sha256OfToken`. Fence: `no token -> 401`, `Origin -> 403 { error: 'browser requests are refused' }`.

## `example_gates`

- Target length: 53 s (124 words)

**Narration**

The agent called widget list. It saw one widget, sample, and the cursor f six nine six seven three seven nine colon one.

First, the agent sent a version with a raw set timeout in apply. The lint gate refused it in three hundred forty-nine milliseconds. The diagnostic named source slash index dot ts, line fourteen, column three. It said: use context dot timeout.

Then the agent sent the fixed version. All three gates passed. Compile took thirty-four milliseconds, lint took two hundred sixty-three, and the test run took one thousand five hundred seventy-nine. The whole install took three point two seconds, and the answer said applied. The test run also gave a warning. It did not call add, because add refuses empty arguments.

**Visuals**

Outline lights `creation`. `widget_list -> { cursor: 'f6967379:1', widgets: [ sample ] }`. First install: `gate-failed`, gate `lint`, diagnostic `src/index.ts:14:3: Unexpected use of 'setTimeout'. ... Use ctx.timeout(callback, ms).` (349 ms). Second install: bars compile 34 ms, lint 263 ms, test 1579 ms; total 3233 ms; `application: 'applied'`; warning `action add: its args schema refuses {}, so the test run did not call it`.

## `example_calls`

- Target length: 51 s (120 words)

**Narration**

Widget describe showed both actions. List is a query with no arguments. Add is a mutation. Its argument schema needs a text with a minimum length of one and a maximum of eighty. Each timeout is five seconds.

The agent called add with the text milk and the request id r one. The answer was the list with milk, at revision one, in thirty-five milliseconds. The agent sent the same call again. The answer was the same, at revision one, with replayed true. Nothing ran twice.

Then it sent r one with the text bread. The answer was idempotency conflict. A call with an empty text got invalid arguments, with the message: too small. Each error had its next step.

**Visuals**

Outline lights `ctx.widgets`. describe JSON: list (query, args null, 5000), add (mutation, args `{ text: string minLength 1 maxLength 80 }`, 5000). Calls: `add {text:'milk'} r-1 -> { items:[milk], rev: 1 } 35 ms`; again -> `replayed: true, rev: 1`; `r-1 {text:'bread'} -> idempotency-conflict`; `{text:''} -> invalid-args: Too small: expected string to have >=1 characters`.

## `example_user_door`

- Target length: 42 s (97 words)

**Narration**

Next, the user door. The run posted add with the text eggs to the call route, with the host cookie. This is the request that a click in the shell sends. The answer came in twelve milliseconds: milk and eggs, at revision two.

The program route gave the program text at revision one. Without the cookie, the same route gave four hundred one. The real OpenUI parser read this program with the real component set. It found four statements, one query, one mutation, and zero errors. A program with the typo buton gave the error: unknown component.

**Visuals**

Outline lights `shell page`. `POST /api/widgets/groceries/call { action: 'add', args: { text: 'eggs' } }` with cookie -> `200 { ok: true, result: { items: [milk, eggs] }, rev: 2 }` in 12 ms. `GET program -> rev 1` (program text shown), without cookie -> 401. Parser output (lang-core createParser + shadcn-widgets@1): `root Card, statementCount 4, queries [list], mutations [add], errors []`. Typo: `Unknown component "Buton" - not found in catalog`.

## `example_streams`

- Target length: 45 s (106 words)

**Narration**

The stream of groceries sent these frames. First came retry one thousand and hello, with revision zero. Then came data with revision one, after the agent call. Then came data with revision two, after the click. Each window of groceries would run its queries again on each data frame.

The agent then called widget changes with its first cursor. It got three changes. The first had the kind added, by host. The second was a state change at revision one, by claude code c one e six b seven. The third was a state change at revision two, by user. Thus the agent saw your click.

**Visuals**

Raw SSE frames with times: `retry: 1000`, `data: {"type":"hello","rev":0,"programRev":1}`, `data: {"type":"data","rev":1}` (after agent), `data: {"type":"data","rev":2}` (after click). Change feed: seq 2 added by host; seq 3 state rev 1 by `claude-code-c1e6b7`; seq 4 state rev 2 by `user`. New cursor `f6967379:4`.

## `example_crash`

- Target length: 63 s (146 words)

**Narration**

Now a bug that the gates cannot see. The agent installed a third version. It added an interval of three seconds that parses an empty saved text. That parse throws a syntax error. The interval is a Cordis timer, so the lint gate allows it.

The test run lasts one and a half seconds, so the timer never fired there. All three gates passed, and the install answered applied.

Three thousand and four milliseconds later, the host exited with code one. The host printed: uncaught exception blamed on the groceries row, by store, the host exits now.

The crash record named the row include colon deepwidgets widget groceries, and the slug groceries. The error was a syntax error: unexpected end of JSON input. The method was store. The record also held the package folder and a hash that starts with three zero three b zero eight.

**Visuals**

Outline lights `isolation`. Diff of the third version: `let saved = ''` and `ctx.interval(() => { const list = JSON.parse(saved) as State; ... }, 3000)` (illustrative bug). Gates all green (29, 162, 1578 ms). Timer clock: test window 1.5 s ends before 3 s. Host exit `code 1`, 3004 ms after the install answer. Stderr: `deepwidgets: uncaughtException blamed on include:deepwidgets-widget-groceries (store); the host exits now`. crash.json card: row, slugs [groceries], error SyntaxError `Unexpected end of JSON input`, method store, hash `303b082b...`, pid 85765, applied false.

## `example_quarantine`

- Target length: 54 s (127 words)

**Narration**

This command-line run has no Electron main, so the script started the host again by hand. In the app, the supervisor does this. The new host booted in eight hundred sixty-two milliseconds. The old token got four hundred one, so the agent did a new handshake.

The new host marked the crash record as applied. The quarantine file held the groceries row with the reason: quarantined after a crash. Widget list showed groceries with that reason in the failed field.

Its revision was still two. A call gave widget failed, with the next step: do not retry, change its files. The program route gave five hundred three. The stream hello gave program revision minus one.

Sample stayed live. Its call answered in six milliseconds, with count zero.

**Visuals**

Label `script restarts the host (in the app: the supervisor)`. `bootMs 862`. Old token -> 401; new handshake. `crash.json applied: true`. quarantine.json row. widget_list: groceries `rev 2, failed: quarantined after a crash (uncaughtException, blamed by store): Unexpected end of JSON input`. widget_call -> `widget-failed` + nextStep. `/program -> 503`. stream `hello { rev: 2, programRev: -1 }`. sample `get -> { count: 0 }` 6 ms.

## `example_lift`

- Target length: 29 s (67 words)

**Narration**

The agent then installed the fixed version again. The three gates passed, and the install applied in three point six seconds. The new files had a new hash, so the host lifted the quarantine. The quarantine file was empty after that.

Widget list showed groceries with no failure. Its state was milk and eggs, at revision two. The crash, the quarantine, and the reinstall lost no data.

**Visuals**

Fixed version install: gates 35, 174, 1583 ms; 3555 ms total; applied. quarantine.json `[]`. widget_list: groceries `Groceries rev 2` with no failed field. `list -> { items: [milk, eggs] }, rev 2`. Outline: every box lit once in order.

## `checks_and_mutants`

- Target length: 58 s (136 words)

**Narration**

How does the team know that each box works? Each box came in one unit: one branch, one pull request, and one check that can fail. A fresh agent reviewed each unit. The implementer never reviewed its own unit.

Each check names a mutant. A mutant is a wrong change that the check must catch. For the queue, the mutant removes the queue. The check then saw plus one, not plus ten. For the fence, the mutant removes the origin rule. Three checks then failed.

On this commit, the host checks passed again for this video. The runtime check printed thirty-four pass lines. The MCP check printed twenty-three, the creation check twenty-six, and the blame check twenty-four. The supervisor unit tests passed eight of eight. The app smoke checks were not run again for this video.

**Visuals**

Process strip: plan unit -> Opus implementer -> fresh Opus reviewer -> check + mutant -> merge. Mutant cards: no queue -> `n=1`; Origin rule removed -> `3 of 13 checks failed`; 503 in gap; blame off. Table for this commit: widgets-runtime 34 PASS, widgets-mcp 23 PASS, widgets-create 26 PASS (desktop part off), widgets-blame 24 PASS, vitest supervisor + crash policy 8/8. Note: smoke checks not run again.

## `limits_measured`

- Target length: 48 s (112 words)

**Narration**

Here are the measured limits in one table. In this run, an agent call took thirty-five milliseconds, and a click took twelve. An install with the gates took about three and a half seconds.

These numbers come from the spikes and the pull requests. A host restart showed a live window again two thousand seventy-three milliseconds after a kill.

Each widget window uses about twenty megabytes, because each one has its own renderer. The JSON storage takes about ten milliseconds for each write. That gives about one hundred writes each second, for all widgets together. The SQLite backend, a database file, writes in about zero point two milliseconds. It is not on.

**Visuals**

Table: agent widget_call 35 ms (this run); user call 12 ms (this run); install with gates 3.2 to 3.6 s (this run); restart to live window 2073 ms (PR #61); window memory ~20.6 MB each (spike); json write ~10 ms, ~100 writes/s total (spike); sqlite write ~0.2 ms, not on (spike); gates per edit ~1.8 s (spike).

## `open_items`

- Target length: 79 s (185 words)

**Narration**

Here are the open items. Some choices still wait for the operator. One is a renderer for each window or a shared one. Another is Tailwind, a style tool, in the shell. Others are the main-desktop-only setting, rules for each agent, and five create tools or one. The build uses the recommended choice for each.

Some parts are not built. These are the watchdog merge, the window manager, saved positions, the tray icon, and the main window as a widget. The host does not check a program before it stores it. On the twenty-seventh of October, a packaged build failed. Nobody checked it again since, so only the development app runs.

Some facts are not checked. These are real drags and clicks in a widget window and a real sleep of the computer. Power loss with SQLite is also not checked.

Nobody measured which shape of the create tools a model calls best. The blame check also had one flake in the watchdog pull request. A flake is a check that fails once and then passes on a rerun. That flake needs its own investigation.

**Visuals**

Three columns. Waiting for the operator: renderer per window vs shared, Tailwind in shell, main-desktop-only, rules per agent, five create tools vs one. Not built: watchdog merge (PR #65), window manager, saved positions, tray, main window as widget, program check at setProgram; packaging failed on 2026-10-27, not checked since. Not checked: real hands, real sleep, sqlite power loss, tool-shape accuracy; flake `HMR transactions cannot be nested` (PR #65).

## `closing`

- Target length: 29 s (68 words)

**Narration**

Back to the full diagram. The trim keeps forty of two hundred rows. The runtime gives one contract through two doors, the shell and MCP. Creation puts code through three gates. Isolation blames, quarantines, and restarts. The watchdog waits for its merge.

A click and an agent call change the same data, through the same rules. When a widget fails, the others go on, and its data stays.

**Visuals**

Full outline diagram, all boxes lit; the watchdog box dashed (open PR). Numbers fade in on their boxes: 40 / 200 rows, 2 doors, 3 gates, blame + quarantine + restart. Final frame: the two widget cards from the cold open.
