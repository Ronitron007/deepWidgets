# Glossary `explainer.glossary`

Each term is defined in the narration at its first use. The scene name in brackets is the scene of that first use.

| Term | Meaning |
|---|---|
| deepWidgets | This repository. It makes floating desktop widgets that a user and an AI agent can both use and change. [`cold_open`] |
| widget | A small floating window that shows one view, for example a counter or a list, and the code behind it. [`cold_open`] |
| agent | An outside AI program that talks to deepWidgets over MCP, for example Claude Code. [`cold_open`] |
| operator | Rohan, the person who makes each project decision. [`trim_method`] |
| DSH | DeepSeek Harness. An open-source desktop app (MIT license). deepWidgets is a fork of DSH commit `22ddee3`. [`dsh_fork`] |
| fork | A copy of another project that then changes on its own. Here, one squashed commit of DSH. [`dsh_fork`] |
| workspace package | One package folder in the repository. The repository has 387. [`dsh_fork`] |
| Cordis | The plugin runtime that DSH uses. It loads plugins, gives them services, and stops them in order. [`cordis_context`] |
| plugin | A module with an `apply(ctx)` function. Cordis runs `apply` when the plugin loads. [`cordis_context`] |
| context (`ctx`) | The object that a plugin gets in `apply`. Through it, the plugin reads services and registers things it owns. [`cordis_context`] |
| fiber | The live record of one loaded plugin. When the fiber ends, everything that the plugin registered ends with it. [`cordis_context`] |
| service | A named object on the context, for example `ctx.widgets`. One plugin provides it, and other plugins use it. [`cordis_context`] |
| inject | The list of services that a plugin needs. A plugin does not start until each injected service exists. [`cordis_context`] |
| effect (`ctx.effect`) | A Cordis call that runs setup code and keeps its cleanup. The cleanup runs when the fiber ends. [`cordis_context`] |
| plugin row (row) | One entry in a config file that tells the Cordis loader to load one plugin, with an id, a package name, and a config. [`plugin_rows`] |
| loader | The Cordis plugin that reads the rows and loads each plugin. [`plugin_rows`] |
| profile | A named set of rows that the app composes at boot, for example `desktop` or `web`. [`plugin_rows`] |
| patch file (`cordis.patch.yml`) | A file that adds rows or changes rows of a profile. [`plugin_rows`] |
| pending row | A row whose plugin waits for a service that never comes. It does not run. [`trim_method`] |
| trim | The deepWidgets method that turns DSH code off without a delete: `disabled: true` on rows, and commented-out lines with the marker `deepwidgets-trim`. [`trim_method`] |
| `!!js` condition | A row field whose JavaScript expression decides at boot if the row is off. [`trim_method`] |
| hmr | Hot module replacement. The Cordis service that loads changed plugin code into a running process. [`widget_rows_on`] |
| plugin manager | The DSH plugin that installs and removes plugin bundles in a running host. [`widget_rows_on`] |
| bundle | A package that the plugin manager installs. It holds code and a patch file with its rows. [`widget_rows_on`] |
| timer service | The Cordis service that gives `ctx.timeout` and `ctx.interval`. Its timers stop when the fiber ends. [`widget_rows_on`] |
| Electron | The framework that runs a desktop app with Chromium windows and Node. [`three_processes`] |
| Electron main | The Electron process that makes windows and starts the host. It runs no Cordis. [`outline`] |
| host | The Node child process that runs the host Cordis context, the loader, the web server, and all widget code. [`outline`] |
| renderer | A Chromium process that shows one web page in a window. [`outline`] |
| `dsh-app://` | The custom URL scheme of the app windows. Electron main answers each request on it. [`three_processes`] |
| host cookie | The secret cookie that Electron main adds when it forwards a request to the host. [`three_processes`] |
| `connection` | The DSH service of cookie-checked `/api` routes on the host web server. [`three_processes`] |
| slug | The id of a widget, for example `sample` or `groceries`. Lower-case letters, digits, and hyphens, 63 characters at most. [`widget_definition`] |
| program | The text that tells the shell what to show. It is OpenUI Lang. It is data, not code. [`widget_definition`] |
| seed program | The program text in the widget code. The host stores it at the first start. [`widget_definition`] |
| state | The JSON data of one widget, with a revision number. [`widget_definition`] |
| action | A named operation of a widget, with a handler function. [`widget_definition`] |
| Query | An action kind that reads the state. It cannot write. Also the OpenUI Lang statement that calls such an action. [`widget_definition`] |
| Mutation | An action kind that can write the state. Also the OpenUI Lang statement that calls such an action. [`widget_definition`] |
| handler | The function of an action. It gets the arguments and `w`. [`widget_definition`] |
| `w` (scope) | The second handler argument: `w.state`, `w.update(fn)`, and `w.signal`. [`widget_definition`] |
| zod | A TypeScript library that checks the shape of data against a schema. [`widget_definition`] |
| runtime | The package `@deepwidgets/widgets`. It provides the service `ctx.widgets`. [`runtime_overview`] |
| `ctx.widgets` | The widget service: `register`, `list`, `describe`, `get`, `call`, `update`, `setProgram`, `changes`, `cursor`. [`runtime_overview`] |
| storage domain | A DSH service that keeps named tables of records on disk. The runtime opens the domain `widgets`. [`storage_tables`] |
| revision (rev) | A number that goes up by one on each write of a state or a program. [`storage_tables`] |
| FIFO queue | First in, first out. Jobs run one at a time, in the order that they came. [`queue_rule`] |
| `busy` | The error of a job that waited in the queue longer than its timeout. It did not run. [`queue_rule`] |
| timeout | The time limit of one action call. The default is 5 seconds. [`timeout_rule`] |
| abort signal (`w.signal`) | A flag that the runtime sets at the timeout, so the handler can stop. [`timeout_rule`] |
| `requestId` | A caller-chosen id that makes a retried mutation run once. [`idempotency`] |
| idempotent | A call that gives the same result when it runs again, with no second effect. [`idempotency`] |
| TTL | Time to live. A `requests` record older than 10 minutes is void. [`idempotency`] |
| change feed | The list of the last 1,000 changes, read with a cursor. [`change_feed`] |
| cursor | A text `epoch:seq` that marks a point in the change feed. [`change_feed`] |
| epoch | A random id of one host process. A cursor of another epoch gives `reset`. [`change_feed`] |
| route | A URL path that the host answers. [`routes`] |
| SSE (server-sent events) | A one-way HTTP stream of text frames from server to page. [`routes`] |
| frame | One message on an SSE stream, for example `{ type: 'data', rev: 1 }`. [`routes`] |
| OpenUI Lang | The small UI language of `@openuidev/react-lang` 1.0.1. A program is a list of statements. [`openui_lang`] |
| statement | One line of a program: a name, `=`, and an expression. [`openui_lang`] |
| component set (catalog) | The components that a program can use. deepWidgets ships `shadcn-widgets@1`. [`openui_lang`] |
| shadcn | A popular set of React UI components. The component set ports a subset. [`openui_lang`] |
| shell | The pinned page `@deepwidgets/shell` that renders one widget program in one window. [`shell_page`] |
| Vite | The build tool that builds the shell page. [`shell_page`] |
| toolProvider | The OpenUI hook point that runs each Query and Mutation. The shell sends each one to `POST /call`. [`shell_page`] |
| `useTriggerAction` | The public OpenUI hook that the shell uses to run its queries again. [`shell_refresh`] |
| `EventSource` | The browser object that reads an SSE stream. [`shell_reconnect`] |
| backoff | A wait before a retry that grows after each failure. [`shell_reconnect`] |
| `Response.error()` | A network-error answer. Electron main gives it for an `/api` request while the host is down. [`shell_reconnect`] |
| panel window | Here: a window with no frame, always on top, on all Spaces, shown without focus. [`windows_manager`] |
| Spaces | The macOS virtual desktops. [`windows_manager`] |
| MCP | Model Context Protocol. A standard protocol that lets an AI agent call tools of a server. [`outline`] |
| tool | One named MCP operation with an input schema, for example `widget_call`. [`mcp_server`] |
| stateless mode | An MCP server mode that keeps no session between requests. [`mcp_server`] |
| port | The number of a network listener on a computer. The fixed port is 47615. [`mcp_port`] |
| loopback | The network address of the same computer: `127.0.0.1`, `::1`, or `localhost`. [`mcp_fence`] |
| port file (`mcp.json`) | The file `$DSH_HOME/deepwidgets/mcp.json` with the port, the nonce, the pid, and the start time. [`mcp_port`] |
| `$DSH_HOME` | The folder of the app data, by default `~/.dsh`. [`mcp_port`] |
| nonce | A random secret made new at each host start. It stays in the port file. [`mcp_port`] |
| challenge | Random text that an agent sends to prove the server. [`mcp_handshake`] |
| HMAC | A keyed hash. The proof is HMAC-SHA256 of the challenge, with the nonce as key. [`mcp_handshake`] |
| bearer token | A secret that an agent sends in the `Authorization` header on each MCP request. [`mcp_handshake`] |
| `agentId` | The name that a token gives its agent, for example `claude-code-c1e6b7`. The change feed records it in `by`. [`mcp_handshake`] |
| fence | The checks on each `/mcp` request: loopback peer, no browser headers, loopback `Host`. [`mcp_fence`] |
| `nextStep` | The text in each tool error that tells the agent what to do next. [`mcp_interact`] |
| gate | One check that new widget code must pass before it reaches the host: compile, lint, or test run. [`creation_overview`] |
| template | The starter widget files that `widget_template` gives. [`creation_overview`] |
| guide | The text that `widget_guide` gives: the widget API, the gate rules, and the OpenUI Lang guide. [`creation_overview`] |
| esbuild | A fast JavaScript bundler. It runs the compile gate. [`gate_compile`] |
| oxlint | A fast JavaScript and TypeScript linter. It runs the lint gate. [`gate_lint`] |
| type-aware lint | A lint that also reads the TypeScript types. [`gate_lint`] |
| floating promise | A promise that no code awaits or catches. A rejection then ends the host. [`gate_lint`] |
| heap | The memory of a JavaScript process for objects. The test run limits it to 256 MB. [`gate_test_run`] |
| stall | A time when a process prints nothing, because code blocks it. [`gate_test_run`] |
| crash-only host | The design rule that a host with an uncaught error exits at once and starts again, and does not try to continue. [`isolation_why`] |
| uncaught exception | An error that no code catches. [`isolation_why`] |
| unhandled rejection | A failed promise that no code handles. [`isolation_why`] |
| fail-loud | The DSH handler that reports a fatal error and stops the process. [`isolation_why`] |
| AsyncLocalStorage | A Node feature that keeps a value across timers, promises, and callbacks that one piece of code starts. [`blame_store`] |
| blame | The name of the widget row that caused a crash. [`blame_store`] |
| claimer | The runtime function that finds the blame, writes the crash record, and exits. [`claimer`] |
| crash record (`crash.json`) | The file `$DSH_HOME/deepwidgets/crash.json` that names the blamed row, the error, and the hash. [`claimer`] |
| hash (SHA-256) | A short fingerprint of data. A change to any byte changes it. [`claimer`] |
| quarantine | The list of widget rows that the host does not run, in `quarantine.json`. [`quarantine`] |
| supervisor | The Electron main class that starts the host again after a crash. [`supervisor`] |
| safe mode | A host start in which only built-in widgets run. [`safe_mode`] |
| give-up | The point, 4 unblamed crashes in 60 seconds, at which Electron main stops and shows the fatal dialog. [`safe_mode`] |
| built-in widget | A widget whose module file is in a listed repository folder. Today only `widget-sample`. [`safe_mode`] |
| watchdog | A worker thread that kills a host that a loop holds. It is in PR #65, not merged. [`watchdog_open`] |
| heartbeat | A counter that the main thread adds to on a timer. The watchdog reads it. [`watchdog_open`] |
| worker thread | A second JavaScript thread in the same process. [`watchdog_open`] |
| provisional record (`provisional.json`) | A crash record that the watchdog writes early in a stall, so an out-of-memory abort is blamed too. [`watchdog_open`] |
| smoke check | `tools/smoke-desktop.mjs`. It boots the real desktop app and checks it. [`checks_and_mutants`] |
| mutant | A wrong change to the code that a check must catch. [`checks_and_mutants`] |
| spike | A short experiment that proves a part before the real build. [`creation_overview`] |
| unit | One planned change, one branch, and one PR, with a check that can fail. [`checks_and_mutants`] |
| squashed commit | One commit that holds a whole history as one change. [`dsh_fork`] |
| React | The UI library of the shell, pinned to 18.3.1. [`shell_page`] |
| SQLite | A database in one file. A storage backend that is not on. [`limits_measured`] |
| Tailwind | A CSS style tool. The shell uses version 4. [`open_items`] |
| flake | A check that fails once and then passes on a rerun. [`open_items`] |
