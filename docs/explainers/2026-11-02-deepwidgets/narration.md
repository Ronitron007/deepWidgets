## cold_open

This video explains deepWidgets, from the top down. deepWidgets puts small floating windows on your desktop. We call each window a widget. A widget shows one thing, for example a counter or a grocery list.

Two kinds of users can change a widget. You can click a button in the window. An agent can also change it. An agent is an outside AI program, for example Claude Code. An agent can even write a new widget and install it while the app runs.

The video covers what works today, what does not, and the numbers that show both. It ends with one real example that goes through every part.

## outline

Here is the whole path on one diagram. On the left is the desktop app. It has three kinds of processes: Electron main, the host, and one renderer for each window. The host is the process that runs all widget code.

In the middle is the host. It runs the Cordis plugin runtime. Inside the host, the widget runtime gives a service with the name context dot widgets. Each widget plugin registers with that service.

Two doors lead into context dot widgets. The first door is the page in each widget window, which we call the shell. The second door is the MCP server, on a fixed port, for agents. MCP is a standard protocol that lets an agent call tools. A user click and an agent call go through the same action code.

At the bottom are two more boxes. Creation puts new widget code through three gates before it reaches the host. Isolation keeps one bad widget from taking down the others. It has four parts: blame, quarantine, the supervisor, and the watchdog. We now walk this diagram box by box.

## dsh_fork

deepWidgets did not start from zero. It is a fork of DeepSeek Harness, which we call DSH. DSH is an open-source desktop app from DeepSeek, with an MIT license. A fork is a copy of a project that then changes on its own.

The fork is one squashed commit of the DSH commit two two d d e e three. A squashed commit holds a whole history as one change. The repository holds three hundred eighty-seven workspace packages. Most of them are DSH code that deepWidgets does not need.

Why start from DSH? DSH already has the three parts that a widget app needs. It has a plugin host process, a plugin client in the browser page, and an Electron desktop app. Thus the project takes those parts and turns off the rest.

## cordis_context

DSH builds everything from Cordis plugins. Cordis is a plugin runtime. A plugin is a module with a function that has the name apply. Cordis calls apply when the plugin loads.

Apply gets one argument, the context. Programmers write it as c t x. Through the context, a plugin reads services and registers the things that it owns. A service is a named object on the context, for example context dot widgets. One plugin gives a service, and other plugins use it.

A plugin names the services that it needs in a list with the name inject. Cordis does not start the plugin until each of those services exists. Each loaded plugin has a fiber. The fiber is the live record of that plugin.

When the fiber ends, Cordis removes everything that the plugin registered. A call with the name context dot effect runs setup code and keeps its cleanup for that moment. This ownership rule matters later. A widget registration belongs to the fiber of its plugin.

## plugin_rows

How does Cordis know which plugins to load? It reads plugin rows. A plugin row is one entry in a config file. It gives an id, a package name, and a config. The Cordis loader is the plugin that reads the rows and loads each plugin.

A profile is a named set of rows, for example desktop or web. Packages add rows with a patch file. The patch file has the name cordis dot patch dot yml. At boot, the desktop host composes two hundred rows.

## trim_method

deepWidgets turns most of those rows off. We call this the trim. The trim patch file sets disabled true on one hundred sixty of the two hundred rows. Each row stays in the file, with a comment that gives the reason.

The trim deletes no code. When a kept DSH file must change, the old lines become comments with the marker deepwidgets trim. Why keep dead code? The operator reads it to learn how DSH writes Cordis plugins.

Forty rows stay on. Eight of the forty never run. We call them pending rows. Each one waits for a service that the trim turned off. Thus a search for comments does not tell you which code runs. A row can also turn itself off with a condition in JavaScript.

## widget_rows_on

Two rows came back on for the widget system: hmr and timer. Hmr is hot module replacement. It loads changed plugin code into a running process. The plugin manager needs it. The plugin manager is the DSH plugin that installs a bundle while the app runs. A bundle is a package with code and its rows.

With hmr off, an install answers restart required, with the reason no hmr. With hmr on, the install applies at once. The check in pull request fifty measured an install in one thousand six hundred seventy-three milliseconds.

The timer row gives context dot timeout and context dot interval. Widgets use these timers to refresh their data. A Cordis timer stops when its plugin stops. A raw JavaScript timer does not.

## three_processes

The desktop app runs three kinds of processes. Electron main is the first. It makes the windows and starts the host. It runs no Cordis.

The host is the second. It is a Node child process. It runs the host Cordis context, the loader, the web server, and all widget code. Electron main starts it with the flag expose internals, because the loader and hmr read private Node internals.

A renderer is the third. It is a Chromium process that shows one web page. The main window and each widget window load from the custom scheme d s h app colon slash slash. Electron main answers each request on that scheme. For a path under slash a p i, it forwards the request to the host and adds the host cookie. The host checks that cookie on each route of the connection service.

## probe_and_trace

Two small deepWidgets packages came first: probe and trace. The probe adds the route slash a p i slash probe. That route answers with the process id of the host. The main window shows that id. Thus the probe proves that a page can reach the host.

The trace records each row of the host as it loads, and the boot steps of the app. It serves them on slash a p i slash trace, and it shows them in a small trace window. These two packages are check tools. The widget system does not depend on them.

## runtime_overview

Now the center of the diagram: the widget runtime. It is the package deepwidgets slash widgets, in TypeScript. Its row gives the service context dot widgets. It needs two services: connection, for routes, and storage domain, for data on disk.

The service has nine methods. Register adds a widget. List and describe tell what is live. Get reads the state.

Call runs one action. Update writes the state from a timer. Set program stores new screen text. Changes and cursor give the change feed. The methods report each failure as a widget error with a code. A malformed definition is the one exception: it throws a type error.

## widget_definition

A widget definition has five parts. The slug is the id of the widget, for example groceries. It uses lower-case letters, digits, and hyphens, up to sixty-three characters. The title is the name for people.

The program is the text that tells the window what to show. It is data, not code. The text in the widget code is the seed program. The initial state is the first JSON data of the widget.

The last part is the list of actions. An action is a named operation with a handler function. Each action has one of two kinds.

A query only reads the state. A mutation can write it. An action can also have its own timeout and an argument schema in zod. Zod is a TypeScript library that checks data shapes.

A handler gets the arguments and an object w. W dot state is the current state. W dot update takes a function that makes the new state. W dot signal tells the handler when its time is over. The runtime checks the whole definition at register. A bad slug, a bad action name, or a repeated action throws a type error.

## register_ownership

Register is a Cordis effect. The fiber that calls register owns the registration. When that plugin stops, the widget goes away. Its routes go, its streams get a removed message, and its window closes.

The stored state stays on disk. Thus a widget that comes back gets its data back. A second live register call of the same slug fails with the code conflict.

## storage_tables

The runtime keeps its data in a storage domain. A storage domain is a DSH service with named tables of records on disk. The domain has the name widgets, at version one. In this profile, it uses the JSON backend.

The domain has three tables. The state table holds one record for each slug: a revision number and the data. A revision is a number that goes up by one on each write. The program table holds the program text of each slug, with its own revision.

The requests table makes retries safe. We come back to it soon. On the first register, the runtime writes the seed program and the initial state. After that, the stored records win over the seed. Each write to the domain sends a change event. The runtime turns that event into a message for each open window.

## queue_rule

Now the rules of a call, which we call the action contract. The first rule is the queue. Each slug has one queue for mutations and updates. It is first in, first out. One job runs at a time, in the order that the jobs came.

Why? A handler can read the state, wait, and then write. Without the queue, two parallel calls read the same old value, and one change gets lost. The runtime check proves this. Ten parallel calls of such a handler give plus ten with the queue. With the queue removed, they gave plus one.

A query does not wait in the queue, because it does not write. A job that waits longer than its timeout fails with the code busy, and it does not run.

## timeout_rule

The second rule is the timeout. Each action has a time limit. The action can set it. Else the widget value applies. Else the limit is five seconds.

At the limit, the call answers with the code timeout. The runtime also sets w dot signal, so the handler can stop. It then refuses each later write of that call. This includes a write through context dot widgets dot update from inside the call. Why? A call that the caller saw fail must not change the data later.

One limit is important here. The timeout is a JavaScript timer. A handler that never gives back control, for example an endless loop, also stops that timer. The timeout cannot end such a loop. Only the watchdog can, and the watchdog is not merged yet.

## args_and_errors

The third rule is the argument check. The runtime checks the arguments against the zod schema before the call goes into the queue. Bad arguments thus never use a queue slot.

Each failure has a code and an HTTP status. Unknown widget and unknown action give four hundred four. Invalid arguments give four hundred twenty-two.

A handler that throws gives five hundred, and a timeout gives five hundred four. Busy gives five hundred three.

Idempotency conflict and conflict give four hundred nine. A bad request gives four hundred. Two codes came with isolation: safe mode and widget failed. Both give five hundred three. A query that tries to write gets handler error.

## idempotency

The fourth rule makes a retry safe. A mutation can carry a request id. The runtime then runs the call once for each pair of caller and request id. A call that runs again with no second effect is idempotent.

The runtime keeps a hash of the call: the slug, the action, and the arguments. A retry with the same hash gets the stored answer and the flag replayed. A retry with other arguments gets idempotency conflict. Three parallel retries share one run.

The answers live in the requests table, on disk. Why on disk? A host can crash and restart.

The check proves that a replay after a host restart still runs once. A record older than ten minutes is void. The runtime stores a failed call only when it already wrote. Thus a retry of a busy call can run.

One gap stays. The state write and the request record are two writes. A crash between them can make a retry run twice. We infer this from the code.

## change_feed

An agent cannot see your clicks. So the runtime keeps a change feed. Each change has a sequence number, the time, the slug, the kind, and who made it. The field by holds that name, for example user, an agent id, host, or timer.

The feed keeps the last one thousand changes in memory. A cursor marks a point in it. A cursor is text with two parts: an epoch and a sequence number. The epoch is a random id of the host process. A cursor from an older process, or one that is too old, gives reset. The agent then reads the list again.

## routes

The runtime serves five routes through the connection service. Each route thus has the cookie check. Slash a p i slash widgets gives the list. Slash a p i slash widgets slash events is a stream of added and removed messages.

Each slug gets three routes. Program gives the text and its revision. Call takes an action, its arguments, and an optional request id. Stream is the live channel of that widget.

Both streams use server-sent events. That is a one-way HTTP stream of text frames. The first message is hello. After it come data, program, and removed. The server sends a ping every fifteen seconds. A slug that is not live has no routes, so it gets a plain four hundred four.

## drain_on_stop

What happens when the runtime itself stops, for example on a reload? It first refuses new work with busy. Then it closes the event streams. It waits for each running call to finish. Only then does it close the domain.

Why? A call that started must not lose its write in the middle. The wait has an upper bound: two times the longest timeout, plus one second. The bound only guards against a defect.

## sample_widget

The repository has one built-in widget, sample. It is a counter. Its query get returns the count. Its mutation add takes a number and adds it.

Its program shows a card with the title, the count, and a button. The button runs add with one, and then runs get again. With the config tick milliseconds above zero, an interval adds one at that rate. The default is zero, so the timer is off. The interval catches its own errors, because a Cordis timer does not catch them.

## openui_lang

Now the shell box, starting with the program language. You write a program in OpenUI Lang, version one point zero point one. A program is a list of statements. Each statement has a name, an equals sign, and an expression.

The statement root is the screen. Look at the sample program. Root is a card with a header, a stat, and a button. The statement s is a query: it runs the action get. The statement add is a mutation: it runs the action add with by one. The button runs an action plan: run add, then run s.

A program can use only the components of one component set. deepWidgets ships the set shadcn widgets at one. It has nineteen components. Examples are card, row, list, stat, button, input, checkbox, table, and two charts. Shadcn is a popular set of React components. The set ports a small part of it.

## shell_page

The shell is the page in each widget window. It is a React page that Vite builds. React is a UI library, and Vite is a build tool. The shell pins React at eighteen point three point one. All widgets share this one shell at one version. This is a decision: no widget shows HTML that a server makes.

The page reads the slug from its address. It gets the program from the program route. It checks the component set name. A program that names another set gets an error screen. An empty program shows the text: this widget is empty.

Then the OpenUI renderer draws the program. Each query and each mutation goes through a tool provider. The shell tool provider sends each one to the call route. The page never retries a call, because a mutation must not run twice. All requests go through one small module, the channel. A faster transport can later replace only that module.

## shell_refresh

How does a window learn that the data changed? It reads its stream. On a data frame, it runs all of its queries again. It does this with the public OpenUI hook use trigger action. Text that you typed in an input stays.

On a program frame, it loads the program again. On removed, it shows the text: this widget is gone. On each new hello, it compares the revisions with the last ones that it saw. If it missed a change while the stream was down, it catches up.

The refresh depends on an action plan shape that OpenUI does not export. That is why the shell pins the version.

## shell_reconnect

A browser event source has one trap. When it gets an answer that is not two hundred, it stops for good. So the shell watches for that close. It opens a new stream after a wait. The wait starts at two hundred fifty milliseconds and doubles up to eight seconds.

Electron main does its part too. While the host is down, it answers each forwarded request with a network error, not with five hundred three. A network error lets the event source retry by itself. The program request makes up to four tries, with five seconds for each try.

## shell_serving

Where does the page come from? Electron main serves the built shell files from disk, at d s h app colon slash slash app slash widget. It does not ask the host for them. Thus the page loads even while the host is down.

The pull request check of the shell showed the full loop in the app. The page showed count zero. A post of add answered revision one. The page then showed count one after one refresh, with the frames open, hello, and data.

## windows_manager

The next box is the windows. A class in Electron main opens one window for each widget. It reads the events stream of the host with the host cookie.

On hello, it opens a window for each listed slug, and it closes the others. On added, it opens one. On removed, it closes one. When the stream ends, it opens it again. The wait starts at half a second and doubles up to ten seconds.

Each window has no frame, stays on top, shows on all Spaces, and does not take focus. Spaces are the virtual desktops of macOS. Each window is three hundred twenty by three hundred pixels. The windows stack down the left side of the main screen. Each window has its own renderer, in a sandbox.

The windows stay open while the host is down. A window that fails to load closes, and it opens again at the next hello. Saved positions, a window manager, and a tray icon are not built yet.

## mcp_server

Now the second door: the MCP server for agents. MCP is the Model Context Protocol. It is a standard way for an AI agent to call the tools of a server. A tool is one named operation with an input schema.

The package deepwidgets slash mcp mounts one route, slash mcp, on the host web server. It uses the official MCP software kit in stateless mode. Stateless means that the server keeps no session between requests.

The server has nine tools. Four tools interact: widget list, widget describe, widget call, and widget changes. Five tools create: widget template, widget guide, widget install, widget reload, and widget remove. The tool count does not grow with the widget count. Each tool calls context dot widgets in the host. Thus an agent call gets the same queue, timeout, and checks as a click.

## mcp_port

An agent must find the server. So the host binds a fixed port. The default is forty-seven thousand six hundred fifteen. The setting deepwidgets M C P port changes it. A value of zero lets the system pick a port. A value that is not a port stops the host with an error.

If another process holds the port, the app fails at start, with the error address in use. This is on purpose. A host on a surprise port would leave agents with no way to find it.

The host then writes the port file, mcp dot json, in the DSH home folder. It holds the port, a nonce, the process id, and the start time. A nonce is a random secret that the host makes new at each start. The file has mode six hundred, so only your user can read it.

The host writes the file only after the route is live. It does not take a file whose host is still alive. Electron main removes the file of a host that dies.

## mcp_handshake

Before an agent sends data, it checks that the server is the real host. Another process can take the port after the host stops. The check is a handshake.

The agent reads the nonce from the port file. It makes a challenge: at least sixteen random bytes. It posts its name and the challenge to slash mcp slash token. The answer has a token, an agent id, and a proof.

The proof is an HMAC, a keyed hash, of the challenge, with the nonce as the key. The agent makes the same HMAC. If the two do not match, it stops.

The nonce never leaves the file. Thus a fake server cannot make the proof. The host stores only a hash of each token, and it keeps the sixty-four newest. Each host start has a new random id, so each old token gets four hundred one after a restart. The agent then does a new handshake.

## mcp_fence

Each request on slash mcp passes a fence. The peer address must be loopback, which means this computer. A request with an origin header or a fetch site header gets four hundred three. Those headers come from browsers, and an MCP client is never a browser. Why does that matter? A web page that you visit must not drive your widgets.

The host header must be exactly a loopback name. A request with no token, or an unknown token, gets four hundred one. One limit stays. A process of your own user can read the port file. The handshake does not protect against that process.

## mcp_interact

The interact tools follow one path. Widget list gives each live widget and a cursor. Widget describe gives the actions of one widget, with the JSON Schema of each argument object, and the state. Widget call runs one action. The caller is the agent id of the token. Widget changes gives the changes after a cursor.

Each tool error has three parts: a code, a message, and a next step. The next step tells the agent what to do. For example, after timeout, it says: read the state before you retry with the same request id. There are twenty codes, each with its own next step.

Agents do not get pushed news. Claude Code version two point one point three one one drops notifications that a server pushes. So an agent learns about your clicks only when it calls widget changes.

## creation_overview

Now the creation box. An agent creates a widget in four moves. It calls widget template and gets a starter file in TypeScript. It calls widget guide and gets the rules and the program language. It writes the files into a folder. Then it calls widget install with that folder.

Install runs three gates in order: compile, lint, and test run. A gate is a check that new code must pass before it reaches the host. The first gate that fails stops the install. The answer then names the gate and lists each problem with its file, line, and column.

Code that passes goes into a folder that the profile owns. The plugin manager installs that folder, and hmr applies it at once. Why three gates? A spike measured an agent that made forty edits. Without gates, fourteen edits crashed the host. With gates, zero edits crashed it.

## gate_compile

The compile gate copies the source folder into a new temporary folder. It never works in the agent folder. Then esbuild, a fast bundler, bundles the source and zod into one JavaScript file for Node. A syntax error stops here.

## gate_lint

The lint gate runs oxlint, a fast linter, with the types. It also runs a full type check against the widget type file. That file allows two imports only: zod and the widget types. Node modules are not in the types.

The rules refuse four raw timers: set timeout, set interval, set immediate, and queue microtask. They also refuse them as properties, for example global this dot set timeout. Why? A raw timer does not belong to the widget, so it runs on after the widget stops. A Cordis timer stops with it.

The rules also refuse a floating promise, which is a promise that nobody awaits or catches. Why? A rejection with no handler ends the host.

A last rule refuses a loop with no exit, for example while true with no break. Why? Such a loop blocks every widget. deepWidgets checks this rule with its own code on the TypeScript syntax tree. The oxlint plugin form crashes under Electron.

## gate_test_run

The test run gate starts a new process with a heap limit of two hundred fifty-six megabytes. The heap is the memory for objects. The process loads the bundle into a bare Cordis context, with the real timer service and a stand-in widgets service.

It runs apply, which must finish in one second. It calls each action once with empty arguments, with one second for each call. Then it lets the timers run for one and a half seconds. The bundle must register exactly one widget. An uncaught error or an unhandled rejection fails the gate.

The process prints a heartbeat every tenth of a second. If it is silent for seven hundred fifty milliseconds, the parent kills it. That is how the gate catches a loop that the lint missed.

The gate has two known holes. A timer that fires after one and a half seconds is not tested. An action whose argument schema refuses empty arguments is not called. The answer gives a warning for that action. The example at the end of this video goes through the first hole.

## install_replace

A second install of the same slug replaces the bundle. The installer writes the new bundle beside the old one. It removes the old bundle and installs the new one. If the new one fails, it puts the old one back. One install runs at a time.

The state stays, because it lives in storage, not in the bundle. Widget remove takes the bundle away, and the state still stays. A later install of that slug gets its data back.

What about the program? A stored program wins over the seed. So when the seed in the code changes, the installer writes the new seed with set program. It keeps a hash of the last seed to know. An install cannot take the slug of a built-in widget.

## isolation_why

Now the hard part: isolation. Widget code that an agent writes runs inside the host, with full Node rights. It can call any server. One bad widget can stop every widget. The gates catch the usual mistakes. They are not a sandbox.

So deepWidgets uses a crash-only host. On an uncaught exception or an unhandled rejection, the host does not try to go on. It names the guilty widget, writes a record, and exits. Electron main then starts a new host. That host keeps the guilty widget off.

Why not catch the error and go on? Cordis does not contain errors in timers or listeners. They reach the process handlers. An earlier design caught them there and went on. That handler could also swallow an error in host code that a widget called.

Each crash stops every widget for about two seconds. In the merged supervisor check, a new host answered one thousand five hundred sixty milliseconds after a kill.

## blame_store

How does the host know which widget failed? It uses AsyncLocalStorage. This Node feature keeps one value across all the timers, promises, and callbacks that one piece of code starts. The value here is the id of the widget row.

The runtime wraps the plugin body of each widget row in that store. A widget row is a row whose id starts with deepwidgets widget. It also runs each action handler in the store of its row. Thus a timer that a widget makes still carries the widget name when it fires.

The blame key is the loader row, not the plugin name. Why? A bundle can export any name. A name key would let one bundle get another widget blocked.

The wrap uses a private part of Cordis, the fiber runner. Cordis has no public hook around a plugin body. The spike found one misblame. A host timer that host code first makes inside a widget call carries that widget store.

## claimer

The claimer is the function that runs at the crash. DSH has a fail-loud handler for fatal errors. deepWidgets adds a hook to it, marked as a trim change. The hook runs after the DSH report, in the async context of the error.

The claimer reads the store first. If the store is empty, it looks for a widget package folder in the error stack. Else it blames no widget. It writes crash dot json with one synchronous write and a rename. The record holds the row, the slugs, the error, the time, and the method. It also holds the package folder, a hash of its files, and the process id.

Then the host exits at once. It skips the DSH cleanup, which takes about two point nine seconds on the desktop host. The blame check ran nine kinds of faults. Eight blamed the widget, and the host error blamed none. The time from the fault to the exit was eighteen to one hundred milliseconds.

## quarantine

The next host reads the crash record. If the record names a row and is not yet applied, the host moves that row into the quarantine file. Then it marks the record as applied.

A row in quarantine loads with no code. Each of its slugs still shows in the list, with failed and the reason. The call route and the program route answer five hundred three, widget failed. The stream hello says program revision minus one. Thus the page loads the program again when the widget comes back. The other widgets run as normal.

How does a widget leave the quarantine? The host keeps a SHA-256 hash of the package files. A hash is a short fingerprint of data. When the files change, the hash changes, and the next load runs the widget. A widget that crashes before it registers has no package folder. It cannot leave by a hash change.

## supervisor

The supervisor lives in Electron main. It owns a host exit only after the first host was ready. A host that cannot boot still fails loudly at once. For example, a taken port still shows its error.

When an owned host exits, the supervisor reads the crash record. The record counts only when its process id matches the dead host and no host applied it yet. Then the crash has a blame. A blamed crash restarts after half a second, and it does not count toward the limits. The quarantine handles it.

An unblamed crash counts. The supervisor counts the unblamed crashes of the last sixty seconds. The wait before the restart is half a second, then two seconds, then eight seconds. The restart starts a new host and loads the main window again. The widget windows stay open, and their pages reconnect.

## safe_mode

After two unblamed crashes in sixty seconds, the next host starts in safe mode. Electron main sets a flag in the host environment. In safe mode, the runtime refuses each widget that is not built in. The list shows such a widget as off, with the reason. It has no routes and no window.

Built in means that the module file of the row is in a listed repository folder. Today the list holds one folder: widget sample. The check uses the real file path, not the package name, because a bundle can take any name.

After four unblamed crashes in sixty seconds, the supervisor gives up. It shows the DSH fatal dialog. On macOS, that dialog blocks Electron main.

## watchdog_open

One box is not merged yet: the watchdog. It is in pull request sixty-five, which is open. Here is why it matters. A widget can loop forever without an error. Then nothing throws, so the claimer never runs. The whole host freezes, and today nothing kills it.

The watchdog is a worker thread, a second JavaScript thread in the host. The main thread adds one to a heartbeat counter every one hundred milliseconds. Before widget code runs, the runtime writes the widget into a shared slot. The worker checks the heartbeat every fifty milliseconds.

At a stall of half a second, the worker writes a provisional record that blames the widget in the slot. Why so early? An out-of-memory abort runs no JavaScript at all. The early record is then the only blame. At a stall of two seconds, the worker writes the crash record and kills the host.

The pull request reports these results. A host parse of one hundred fifty megabytes took seven hundred fifty-seven milliseconds, and the host lived. A loop in an action killed the host two thousand forty-one milliseconds after the call. The desktop host has no native stack module, so there it blames by the slot only. Thus a loop in a raw timer or after an await is not blamed in the app.

## example_intro

Now the worked example. It goes through every box with real data. This run used the real code at commit eight b nine c eight six seven two. It ran a command-line host with no windows, so it shows no pixels. The run took about seventeen seconds.

The widget is a grocery list with the slug groceries. Its code is illustrative. It stands for what an agent would write. It has a query list and a mutation add. Add takes a text of one to eighty characters.

## example_handshake

The host booted in one thousand fifty-two milliseconds. It wrote the port file with the port, the nonce, the process id, and the start time. The agent posted its name, Claude Code, and a random challenge.

The answer gave a token, the agent id claude code c one e six b seven, and a proof. The agent made its own HMAC with the nonce from the file. The two matched. The token file then held a hash of the token, not the token.

The fence also answered as designed. A request with no token got four hundred one. A request with an origin header got four hundred three, because the fence refuses browser requests.

## example_gates

The agent called widget list. It saw one widget, sample, and the cursor f six nine six seven three seven nine colon one.

First, the agent sent a version with a raw set timeout in apply. The lint gate refused it in three hundred forty-nine milliseconds. The diagnostic named source slash index dot ts, line fourteen, column three. It said: use context dot timeout.

Then the agent sent the fixed version. All three gates passed. Compile took thirty-four milliseconds, lint took two hundred sixty-three, and the test run took one thousand five hundred seventy-nine. The whole install took three point two seconds, and the answer said applied. The test run also gave a warning. It did not call add, because add refuses empty arguments.

## example_calls

Widget describe showed both actions. List is a query with no arguments. Add is a mutation. Its argument schema needs a text with a minimum length of one and a maximum of eighty. Each timeout is five seconds.

The agent called add with the text milk and the request id r one. The answer was the list with milk, at revision one, in thirty-five milliseconds. The agent sent the same call again. The answer was the same, at revision one, with replayed true. Nothing ran twice.

Then it sent r one with the text bread. The answer was idempotency conflict. A call with an empty text got invalid arguments, with the message: too small. Each error had its next step.

## example_user_door

Next, the user door. The run posted add with the text eggs to the call route, with the host cookie. This is the request that a click in the shell sends. The answer came in twelve milliseconds: milk and eggs, at revision two.

The program route gave the program text at revision one. Without the cookie, the same route gave four hundred one. The real OpenUI parser read this program with the real component set. It found four statements, one query, one mutation, and zero errors. A program with the typo buton gave the error: unknown component.

## example_streams

The stream of groceries sent these frames. First came retry one thousand and hello, with revision zero. Then came data with revision one, after the agent call. Then came data with revision two, after the click. Each window of groceries would run its queries again on each data frame.

The agent then called widget changes with its first cursor. It got three changes. The first had the kind added, by host. The second was a state change at revision one, by claude code c one e six b seven. The third was a state change at revision two, by user. Thus the agent saw your click.

## example_crash

Now a bug that the gates cannot see. The agent installed a third version. It added an interval of three seconds that parses an empty saved text. That parse throws a syntax error. The interval is a Cordis timer, so the lint gate allows it.

The test run lasts one and a half seconds, so the timer never fired there. All three gates passed, and the install answered applied.

Three thousand and four milliseconds later, the host exited with code one. The host printed: uncaught exception blamed on the groceries row, by store, the host exits now.

The crash record named the row include colon deepwidgets widget groceries, and the slug groceries. The error was a syntax error: unexpected end of JSON input. The method was store. The record also held the package folder and a hash that starts with three zero three b zero eight.

## example_quarantine

This command-line run has no Electron main, so the script started the host again by hand. In the app, the supervisor does this. The new host booted in eight hundred sixty-two milliseconds. The old token got four hundred one, so the agent did a new handshake.

The new host marked the crash record as applied. The quarantine file held the groceries row with the reason: quarantined after a crash. Widget list showed groceries with that reason in the failed field.

Its revision was still two. A call gave widget failed, with the next step: do not retry, change its files. The program route gave five hundred three. The stream hello gave program revision minus one.

Sample stayed live. Its call answered in six milliseconds, with count zero.

## example_lift

The agent then installed the fixed version again. The three gates passed, and the install applied in three point six seconds. The new files had a new hash, so the host lifted the quarantine. The quarantine file was empty after that.

Widget list showed groceries with no failure. Its state was milk and eggs, at revision two. The crash, the quarantine, and the reinstall lost no data.

## checks_and_mutants

How does the team know that each box works? Each box came in one unit: one branch, one pull request, and one check that can fail. A fresh agent reviewed each unit. The implementer never reviewed its own unit.

Each check names a mutant. A mutant is a wrong change that the check must catch. For the queue, the mutant removes the queue. The check then saw plus one, not plus ten. For the fence, the mutant removes the origin rule. Three checks then failed.

On this commit, the host checks passed again for this video. The runtime check printed thirty-four pass lines. The MCP check printed twenty-three, the creation check twenty-six, and the blame check twenty-four. The supervisor unit tests passed eight of eight. The app smoke checks were not run again for this video.

## limits_measured

Here are the measured limits in one table. In this run, an agent call took thirty-five milliseconds, and a click took twelve. An install with the gates took about three and a half seconds.

These numbers come from the spikes and the pull requests. A host restart showed a live window again two thousand seventy-three milliseconds after a kill.

Each widget window uses about twenty megabytes, because each one has its own renderer. The JSON storage takes about ten milliseconds for each write. That gives about one hundred writes each second, for all widgets together. The SQLite backend, a database file, writes in about zero point two milliseconds. It is not on.

## open_items

Here are the open items. Some choices still wait for the operator. One is a renderer for each window or a shared one. Another is Tailwind, a style tool, in the shell. Others are the main-desktop-only setting, rules for each agent, and five create tools or one. The build uses the recommended choice for each.

Some parts are not built. These are the watchdog merge, the window manager, saved positions, the tray icon, and the main window as a widget. The host does not check a program before it stores it. On the twenty-seventh of October, a packaged build failed. Nobody checked it again since, so only the development app runs.

Some facts are not checked. These are real drags and clicks in a widget window and a real sleep of the computer. Power loss with SQLite is also not checked.

Nobody measured which shape of the create tools a model calls best. The blame check also had one flake in the watchdog pull request. A flake is a check that fails once and then passes on a rerun. That flake needs its own investigation.

## closing

Back to the full diagram. The trim keeps forty of two hundred rows. The runtime gives one contract through two doors, the shell and MCP. Creation puts code through three gates. Isolation blames, quarantines, and restarts. The watchdog waits for its merge.

A click and an agent call change the same data, through the same rules. When a widget fails, the others go on, and its data stays.
