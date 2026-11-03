## cold_open

This video explains the widget kit. The widget kit is a direction for how agents build widgets in deepWidgets. It is a direction in progress, not a decided spec. Some parts come from the operator direction so far. Other parts come from a spike on the third of November.

A spike is a short test that measures one question. When a number comes from a measurement, we say so. When we infer a number, we say that too.

Today, each widget window shows the same page. That page has one fixed set of components. The widget kit changes that. Each widget gets its own page, with components that an agent writes. The video walks through every front of that work. It ends with the points that the operator must still decide.

## outline_today

Here is the whole path on one diagram. The top row is the path of today. An agent writes a widget bundle. A widget bundle is a package with the code of one widget. The agent calls the MCP tool widget install. MCP is a protocol that lets an agent call tools.

Then three gates check the code: compile, lint, and test run. The host loads the bundle that passes. The host is the process that runs all widget code. Last, one shared page draws each widget. We call that page the shell. It has one fixed set of components.

## outline_kit

The bottom row is the kit path. It starts at the kit project. The kit project is a folder with the packages that widgets can use. An agent writes its own component library and a child component. The child holds the OpenUI renderer. OpenUI is the library that turns a program text into React components.

Then a Vite build makes one page for each widget. The same kind of gates and a render check test that page. Electron main then serves the page of each slug. A slug is the id of a widget. On the host side, a widget can also use extra packages.

In the spike design, two doors lead into the kit: MCP tools for agents and a settings pane for the user. We return to this diagram between the parts.

## direction_list

Here is the operator direction so far. It has seven points. An agent writes its own OpenUI component library and a child component that holds the renderer. Each widget gets its own Vite build at install time.

The package widget kit has a locked core and user extras. The core is what the shell entry file, main dot t s x, needs. The user adds extras in a settings pane. Widget code can import extras on the renderer side and on the host side.

When a setting allows it, an agent can add packages to the kit through MCP. The kit packages reach agents through a dynamic description. Pin or rebuild after a kit change is a choice to make from data.

## example_cast

One worked example runs through the whole video. The spike built three widgets with real code. Shad c n is a copy of our current component set. Clock shows a date with the package date f n s. Meter shows a labeled bar from a small test package, d w mini u i.

Each widget builds on three kit versions. Kit vee one is the start. Kit vee two A moves date f n s from four point zero to four point one. Kit vee two B changes the test package to a new major version with renamed props. A prop is one input of a component.

## today_shell

Before the change, look at the code of today. On the diagram, this is the shell box. The shell is the package deepwidgets shell. Its entry file is main dot t s x. It opens a channel to the host, loads the program, and draws it.

A program is the text that tells the shell what to show. It is in OpenUI Lang. Main dot t s x holds the OpenUI renderer root directly. It also holds the stream, the refresh logic, and the diagnostics. Every widget window loads this same page. Vite builds it once into one folder, with the base path slash widget.

## today_component_set

The shell compiles in one component set, shad c n widgets at one. A component set is a list of components with names, props, and descriptions. The set lives in the file library dot t s x. A program names its set. The shell refuses a program that names another set, with the error unsupported component set.

Thus an agent today can use only these components. It cannot add a component of its own. The standing decision widget runtime pin says this on purpose: all widgets share one shell, pinned to one version. The kit direction conflicts with that decision. The operator has not decided if the kit replaces it.

## today_creation

An agent creates a widget with the tool widget install. The tool copies the source folder into a throwaway staging folder. Three gates then run there. The compile gate bundles the code with e s build. E s build is a fast JavaScript bundler.

The lint gate runs ox lint with a type check. Ox lint is a fast linter. Its type check uses t s go lint, which runs on the Go port of the TypeScript compiler. The test run gate starts the widget in a throwaway process. Code that fails a gate never reaches the host. The plugin manager then installs the bundle while the app runs.

## today_paths_map

One detail of the compile gate matters for the kit. The gate writes a tsconfig file with a paths map. A paths map tells the compiler where a bare import name resolves. Today that map has one entry, zod. Zod is a library that checks data shapes.

Thus the guide has a rule. A widget can import only zod and the widget types. E s build puts a copy of zod into each host half. The host half is the part of a widget that runs in the host. The spike measured zod alone at five hundred forty-five kilobytes in each host half.

## today_serving

How does a widget window get its page? Electron main answers each request on the custom scheme d s h app. For a path under slash widget, it serves files from the shell build folder on disk. Every slug gets the same index page. The slug travels in the query string.

A few other paths, such as the root index page, come from the D S H web folder on disk. Every other path, such as an A P I path, goes to the host with the host cookie. The page talks to the host only through these routes, and the host checks the cookie.

## today_agent_text

What does an agent read today? The MCP server sends one fixed text of server instructions. It also registers nine tools, each with a fixed description. The tool widget guide returns the guide as tool output.

The guide holds the widget types, the gate rules, and the OpenUI guide of the component set. The OpenUI part alone is about sixteen kilobytes. None of this text changes while a session runs. With a kit that changes, that becomes a problem. A later part shows the test.

## library_why

On the diagram, we now move to the agent library box. We start with the agent library and the split of main dot t s x. Why split the file? Today the renderer root and the component set sit inside the shell. An agent cannot reach them.

In the kit direction, the agent owns the components. Our code keeps the parts that each widget needs, such as the channel and the stream. Thus the file splits into a part that we lock and a part that the agent writes.

## library_split

The split has two halves. The locked core holds the channel, the refresh bridge, the boot code, and the diagnostics. The refresh bridge runs the queries again when the stream reports new data.

The agent half is a child component. The child holds the renderer root and the library of the agent. In the spike, main dot t s x imports the child from the alias at agent. It reads the catalog id from the same file. The core then puts the child where the renderer root was.

## library_contract

The two halves meet at a small contract. The contract is a TypeScript type with the name child props. It has two fields, root and children. Root is every prop of the renderer root except library and children. The core fills root with the program, the tool provider, and the error handlers.

The tool provider is the object that sends each query and mutation to the call route. The child adds its own library and passes the rest through. But the contract is a type, not a guard. The child itself writes the renderer root, so agent code can change the tool provider. We infer that agent code can also call the host routes itself. The page policy allows requests to the same origin.

## library_agent_code

Here is the real library of meter. It imports zod, the OpenUI functions, and the component meter from d w mini u i. It defines two components with define component. Gauge has the props value, max, and label. Stack is a vertical list of children.

Create library joins them, with stack as the root. The catalog id is meter at one. Clock has the same shape. Its date line component formats a date with date f n s. Each child file has seven lines. It wraps the renderer root around the library.

## library_catalog

The catalog check stays. Each page now compiles in one catalog, the id that the child exports. The page still refuses a program that names another id.

This changes one thing. Today every widget shares the catalog shad c n widgets at one. With the kit, each widget can have its own catalog. The guide must then describe the catalog of each widget, not one shared set. We infer that from the code. The spike did not test the guide.

## library_work

What does this front read and write? It reads the current main dot t s x. It writes the locked core into the package widget kit. It also writes a child template for agents. The template tool must then give the library folder and the child file.

On failure, a missing child or a bad export stops the type gate or the build. We infer that from the spike setup. The work map sizes the split of main dot t s x as medium. It sizes the guide and the template as small. Both sizes are estimates.

## vite_gate

On the diagram, we now move to the Vite build box. Vite is a build tool for web pages. In the kit direction, each widget gets its own Vite build at install time. The spike calls this layout A. One build makes one folder of static files for one slug.

## vite_inputs_outputs

What does the build read? It reads the core source, the agent folder, an index page, a Vite config, and a tsconfig file. It resolves packages from the node modules folder of the kit. The Vite config sets the base path to slash widget, then the slug. It uses the React plugin and the Tailwind plugin.

What does it write? It writes a dist folder with an index page, scripts, and one style sheet. The dist folder is the output folder. A Vite chunk is one script file of that output. Vite can split code into chunks that load later. The charts of shad c n load from a lazy chunk of three hundred eighty-eight kilobytes.

## vite_numbers

Here are the numbers on kit vee one. Shad c n built in two point eight seconds, to seven hundred ninety-six kilobytes. Clock built in one point zero five seconds, to three hundred seventy-two kilobytes. Meter built in zero point nine seconds, to three hundred fifty-two kilobytes.

The build of shad c n with cold caches took four point three seconds. All three pages rendered in Electron.

## vite_cache

Vite has no build cache that stays between builds. A warm build saves only about one point four seconds. Thus each install pays the full build time. For a small widget, that is about one second. For a large library, it is about two point eight to four point three seconds.

## tailwind_source

Tailwind is the style tool of the shell. It writes only the classes that it finds in the source. The at source line tells Tailwind which folders to scan. Today the shell scans only its own folder.

The spike found a trap. Tailwind finds no classes in a package in node modules. The style sheet must name that package with its own at source line. Without that line, the classes of the extra were absent from the output.

The spike style sheet names the core, the agent folder, and d w mini u i. Thus each extra with its own classes needs a line in the style sheet. We infer that the build gate must write those lines.

## render_check

After the build, a render check loads the page in a hidden Electron window. It waits one and a half seconds. Then it reads the state, the errors, and the text of the page. It costs about one point six seconds for each widget.

The render check has a limit. It finds only errors that throw. The spike record says that a wrong prop of an untyped extra passes. We could not check this.

## vite_failures

What happens on failure? A failed build stops the install, and the old page stays. That rule comes from the pin policy, which we infer from the data.

Vite does not check types. In the spike, the meter on kit vee two B built with no error, though its types were wrong. Thus the build gate needs a type gate in front of it.

## vite_work

This front reads the node modules of the kit and the agent folder. It writes a build folder for each slug. The spike work map also says that the gate refuses an import outside the core and the renderer extras. The work map gives the Vite build gate a size of large. That size is an estimate.

## types_why

On the diagram, the type gate sits in front of the Vite build. The type gate checks the TypeScript types before the build. It catches a prop that a component does not have. Vite and e s build only strip the types. Thus without this gate, a type error reaches the render check or the user.

## types_tsc

The spike ran t s c, the TypeScript compiler, in check mode. The tsconfig file is strict, with exact optional property types. Shad c n took one point four to one point nine seconds. Clock took about zero point six seconds. Meter took about zero point five five seconds.


## types_config

The spike tsconfig file has two path aliases. At agent points to the agent folder. At core points to the core source, where the contract lives. The compiler resolves every other import from the node modules of the kit. Thus the type gate sees the real types of each extra.

Skip lib check is on, so the gate does not check the type files of the packages themselves. That keeps the gate fast. The type gate refuses an extra with no type file, with the error T S seven zero one six. The agent must then declare the module itself. After that, the gate accepts any prop of that extra, so the render check is the only guard.
## types_tsgolint

The spike also ran ox lint with t s go lint. Today the lint gate already uses this pair. On shad c n and meter, it took zero point one one to zero point five five seconds. The spike did not run it on clock. We compute that it is about three to five times faster than t s c.

It found the same error on meter in kit vee two B. Thus either tool can run the gate. Which tool to use is not decided.


## types_error_path

How does a type error reach the agent? Today a failed gate gives the error code gate failed. The answer names the gate and lists each diagnostic with file, line, and column. The next step says: fix the code at each diagnostic, then install again. Nothing installs.

We infer that the type gate of the kit uses the same answer.
## types_work

The type gate reads the agent folder, the core contract, and the types of the kit packages. It writes diagnostics with file, line, and column, as the lint gate does today. On failure, nothing installs, and the agent gets the error text.

The work map has no row of its own for the type gate. We infer that it belongs to the Vite build gate.

## pnpm_terms

On the diagram, we now move to the kit project box. The kit is a p n p m project. P n p m is a package manager for Node. The p n p m store is a folder that holds each package file once, by its content hash.

A lockfile records the exact version of each package, also of the packages that others pull in. The command p n p m fetch fills the store from the lockfile alone. An install can then link packages from the store with no network.

On macOS, p n p m copies files with an A P F S clone. An A P F S clone shares the disk blocks until a file changes. The registry is the online server of n p m packages.

## kit_project

The spike kit has twenty-four packages in its package file. It holds React, OpenUI, zod, Vite, Tailwind, TypeScript, and e s build. It also holds the extras: date f n s, the test package, Radix parts, lucide icons, and recharts. All versions are exact.

The first resolve of kit vee one took six point nine seconds and thirty-five megabytes of network. The fetch took five seconds and thirty-eight megabytes. The store grew to two hundred nineteen megabytes. The metadata cache took one hundred thirteen megabytes.

All runs used the p n p m and the Node that ship in the app. These are p n p m eleven point two eight point five and Node twenty-four point two one.

## strategy_fresh_install

The spike tested three packaging strategies. We name them fresh install, kit lockfile, and shared chunks. In the fresh install strategy, each widget gets its own install from the registry.

A cold install took fourteen seconds and seventy-four megabytes of network. A warm install took three seconds. To add a package took three point three seconds for each widget and eight hundred seventeen kilobytes.

Each build resolves the versions of the indirect packages again. Thus two widgets can get different versions. When the registry was down, the install failed after seventy point five seconds.

## pnpm_strict_builds

The fresh install strategy also exited with an error. P n p m eleven blocks the build scripts of packages by default. A build script runs code at install time. The install refused the scripts of e s build and of the telemetry in OpenUI lang core.

The p n p m error code says ignored builds. The setting strict dep builds, with the value false, fixed it. The spike record also names the setting allow builds. We could not check that second fix. The kit lockfile installs skipped the same scripts, but they gave only a warning and finished.

## strategy_kit_lockfile

In the kit lockfile strategy, the kit has one lockfile, and p n p m fetch fills the store. A widget install then runs offline from that store. It took two point six to three point three seconds, with no network. Real disk use was about ten megabytes, because of A P F S clones. A link to the node modules of the kit takes zero seconds and zero disk.

A kit change makes a new kit version. It took about one second to resolve, three seconds to fetch, and half a second to install. Only the change uses the network. The lockfile does not move, so every widget of one kit version gets the same versions.

## pnpm_trust_lockfile

The kit lockfile strategy needs one flag outside a workspace, trust lockfile, with the value true. Without it, p n p m eleven runs the check minimum release age. That check holds back a version that is younger than one day.

The check needs a metadata cache of one hundred thirteen megabytes. Offline, it fails with the error no offline meta. The same check has a cost for security. It holds a security fix for twenty-four hours, unless the kit excludes that package from the check.

## kit_lockfile_failures

Each failure of the kit lockfile strategy is fast and clear. A store with a missing package fails in zero point eight seconds with the error no offline tarball. A package file that does not match the lockfile fails with the error outdated lockfile. The missing package case ran offline, against a dead registry address. We infer that the drift case also used no network, because the lockfile check fails first.

## strategy_shared_chunks

The shared chunks strategy builds on the kit lockfile strategy. It builds the shared packages once for each kit version, as a runtime of script files. A widget build then marks those packages as external. Vite rewrites each import to the address of the runtime file.

The runtime took three point five to three point eight seconds to build, to two point one megabytes. Each widget build then took zero point three to zero point nine seconds. Each widget page shrank to forty-four to ninety-six kilobytes.

The runtime files cannot drop unused code. Lucide is nine hundred three kilobytes of the runtime, and recharts is five hundred seventy-eight. A kit change in place also broke an old widget. The part on pin or rebuild shows that case.

## strategy_compare

Here are the three strategies side by side. The fresh install strategy needs the network for each widget, and its versions can drift. The kit lockfile strategy works offline, with frozen versions and pages of three hundred fifty to eight hundred kilobytes.

The shared chunks strategy gives the smallest pages and the fastest builds. It ties each page to the runtime of one kit version. Which strategy to use is not decided.

## packaging_work

This front is the kit service with p n p m. It reads the kit folder and the lockfile. It writes the store, the node modules folder, and a new kit version on each change. The work map gives it a size of large. That size is an estimate.

## host_today

On the diagram, we now move to the host extras box. Widget code can also import extras on the host side. Today the host half can import only zod. The spike tested three ways to give it more, with date f n s as the extra. We call the ways bundle, external, and native addon.

## host_bundle

The bundle way puts the extra into the host half. E s build made a file of five hundred ninety-four kilobytes in three hundred seventy-seven milliseconds. It works with no change to the host. The cost is size. Each host half carries its own copy, as with zod today.

## host_external

The external way leaves the import in the output. The file was three hundred fifty bytes. But Node must then find date f n s at run time. The import failed with the error module not found. Only a link from the bundle folder to the node modules of the kit fixed it.

That link ties the widget to its kit. We infer that a kit change under the link changes the code that the widget runs. An external import that the kit does not have can also resolve from the node modules of the profile. We infer that risk. The spike did not test it.

## host_native

A native addon is a package with compiled machine code, in a file that ends in dot node. E s build has no loader for such files, and the spike got that error.

An A B I is the binary interface that a native addon must match. Electron forty-four has the A B I one hundred forty-nine. The Node that ships in the app has the A B I one hundred thirty-seven. Thus one addon cannot load in both. Native addons failed in the spike.


## host_rules

Each way has a rule and a reason. The bundle way keeps each widget whole, so a kit change cannot break a built host half. The external way keeps files small, but it ties the widget to the kit folder. A native addon must match one A B I. Thus one file cannot run in both the app Node and Electron.

The gate reads the host source and the node modules of the kit. It writes one host half for each widget. On failure, the compile gate refuses the bundle, and nothing installs. The test run also loads the host half, so an import that fails at run time stops there.

We infer that last point from the code. The spike did not run it.
## host_work

This front is the gate for host extras. Today the paths map has only zod. The work adds host extras to that map and to the guide rule. The work map sizes it as medium, an estimate. Which way to allow is not decided.

## pin_question

On the diagram, we now look at the line from the kit to the pages. A kit change can break a built widget. To pin a widget means to keep its page on the kit version that it built with. To rebuild means to build it again on the new kit.

The operator direction says to decide from data. The spike built the three widgets on kit vee one, then again on two new kits. A rebuild of all three took eight point three to nine seconds.

## example_v2a

Kit vee two A moves date f n s from four point zero to four point one. That is a minor version. The type gate passed on all three widgets. The build passed on all three. The render check passed on all three.

## example_v2b_types

Kit vee two B changes the test package to version two. Its meter component renamed its props. Value, max, and label became percent and caption. Shad c n does not use the test package. Clock uses only the pill component, which did not change. Both passed.

Meter failed the type gate. The error is T S two three two two, in library dot t s x, at line eight, column thirty-six. The props value, max, and label do not fit the type meter props. The message says that the property value does not exist on that type.

## example_v2b_render

The build of meter still passed, because Vite does not check types. Then the render check loaded the page. The new meter throws an error when percent is absent. OpenUI caught the error and gave the code render error.

So the data says this. A minor version broke nothing. A changed library broke one widget of three. The type gate and the render check both caught it.

## shared_chunks_swap

The shared chunks strategy adds one more case. Its pages load the runtime of a kit version by address. The spike changed that runtime in place, from kit vee one to kit vee two B. The old meter page then broke with render error. Thus that strategy needs one runtime folder for each kit version. Each such folder is about two point one megabytes.

## pin_policy

Here is the policy that the data supports. We infer it, and it is not a decision. Pin each widget to its kit version by default. With fresh install or kit lockfile, a built page holds its own copy of each package. A kit change then does not affect it. With shared chunks, a page needs the runtime of its own kit version.

Rebuild a widget only on request. The rebuild runs the type gate, the build, and a render check. If a gate fails, the old page and the old lockfile stay.

Rebuild by force only for a security fix in a patch or a minor version, with the same gates. If a gate fails, keep the old page and flag the widget. Never rebuild automatically across a major version or a changed library.

## pin_work

This front records the kit version and the lockfile hash of each build. It checks if a widget uses a package before a remove. It also gives a rebuild path. The work map sizes kit versions and pins as medium, an estimate.

## describe_problem

On the diagram, we now move to the agent door. The kit changes while an agent works. An agent must learn the new package list. But which parts of the MCP text does the agent read again?

An MCP resource is a named piece of data that a client reads on request. Server instructions are a fixed text that the server sends at connect time. A tool description is the text that tells the agent what one tool does.

## describe_test

The spike tested this with Claude Code version two point one point three one seven. A small MCP server had two tools, one resource, and instructions, each with a version marker. A third tool came only after the change. A fake model A P I on the same machine recorded what the model would get. Thus no paid run took place.

Between two turns, the server raised the kit version. It sent list changed for tools and for resources. List changed is an MCP signal that says a list of tools or resources changed.

## describe_results

Here are the results. Tool output and resources: yes. Claude Code read live data on each call, with kit version two after the change. List changed: yes. In all three runs, Claude Code read the tool and resource lists again within sixty-three milliseconds. A new tool showed on the next turn, as a deferred tool.

A tool that the client already loaded, with a new description: no. The old text stayed for the whole session. The server instructions: no. Claude Code never read them again. The model also gets no push of a change. It learns of a change only from a new tool name or from a call.

## describe_rule

Thus the kit facts go in tool output and in a resource. They do not go in a tool description or in the instructions. The instructions can stay fixed and say: call kit read for the packages. List changed only refreshes the resource list and announces a new tool name.

For the same reason, the spike design keeps kit add and kit remove on the tool list at all times. In that design, the call checks the setting. A description that said off would lie after the user turns the setting on.

## describe_cost

How much text does a package list cost? The spike measured twenty real packages. One index line for each package came to one thousand six hundred sixty-seven characters in all. We estimate that at about five hundred tokens. A card for each package came to about nineteen thousand characters, about five thousand nine hundred tokens.

A card holds the index line, the types entry, an import line, the top exports, and a short readme part. The raw type files came to about two point five five million characters, about seven hundred seventy thousand tokens. Lucide alone was two point one seven million characters. The token numbers are estimates, the characters divided by three point three.

Thus the spike design gives one index line for each package in the guide. A tool gives a card on request. In that design, the types never go inline. The agent gets the path of the type file and reads it with its own tools.

## describe_work

This front adds the kit index to the output of widget guide and of kit read. It adds one resource for each package. It sends resources changed on each kit change. The work map sizes the MCP kit tools and the index as medium, an estimate.

## config_place

Now the kit config. This is a design from the spike, not a decision. The kit is a p n p m project in the D S H home folder, under deepwidgets slash kit. It holds the package file, the lockfile, node modules, and kit dot json.

Kit dot json holds the kit version. For each extra, it holds its side, who added it, when, and its stored card. Why not the package file of the profile? The plugin manager owns that file, and it treats each package there as a plugin. Why not host storage? Vite and e s build need a real node modules folder to resolve from.

## config_setting

The setting agents may add packages lives in the host settings. The settings pane shows it like other settings. When it is off, an agent can read the kit but cannot change it. The user can always change the kit from the pane.

## kit_read_describe

One kit service, with the name context dot widget kit, has two doors. MCP is the door for agents, and H T T P is the door for the pane.

Kit read takes no input. It returns the kit version, the setting, the core list, the extras list, and the index text. Each package entry has a name, a version, a side, and its types. The side is renderer, host, or both.

Kit describe takes a package name. It returns the card: name, version, side, import line, and exports. The card also gives the absolute path of the types and a usage example.

## kit_add_remove

Kit add takes a name, an optional version, a side, and a request id. It returns the new kit version and the card. Kit remove takes a name and a request id. It returns the new kit version. The request id makes a retry safe, as with widget call today.

## kit_errors

Each error has a code and a next step. Kit locked means that the setting is off. The next step says: ask the user to turn the setting on. In core means that the package belongs to the locked core, so no tool can change it.

In use means that a widget build still imports the package. The error lists those slugs. Not found means that the registry has no such package or version. Install failed means that p n p m failed, and the kit stays as it was. The design also lists bad name and idempotency conflict.

## add_steps

One addition does these steps, in order. The service checks the name, the setting, and that the package is not in the core. It copies the kit folder and runs p n p m add with save exact in the copy. If that fails, the old folder stays. Then it swaps the folders.

It reads the installed version, the types entry, and the exports, and writes the card. It raises the kit version and records the lockfile hash. It sends a signal to the change feed and to the kit stream. The guide shows the change at the next call.

Built widgets do not change. A rebuild uses the new kit.

## add_example

Here is one addition from the spike, with real times. The package nanoid went into the kit. The resolve took one point two seconds. The fetch took three point three seconds. The kit install took half a second. The network moved forty-seven kilobytes.

The answer that kit add would give is illustrative only. It would hold kit version two and the card of nanoid. No kit add tool exists yet.

## config_work

The work map sizes the MCP kit tools as medium and the kit service as large. Both are estimates. The place, the tools, and the errors are all a design from the spike, not a decision.

## kit_routes

On the diagram, we now move to the user door. In the spike design, the user door is a set of H T T P routes on the host. No route exists yet. Get slash a p i slash kit returns the same body as kit read. Put slash a p i slash kit slash settings sets agents may add packages. Post slash a p i slash kit slash extras adds an extra.

Delete slash a p i slash kit slash extras slash, then a name, removes one extra. Get slash a p i slash kit slash stream sends a signal on each kit change. The user door ignores kit locked.

These routes copy the shape of the widget routes of today. Those are program, call, and stream under slash a p i slash widgets, and one events stream. The host checks the host cookie on each of them. The work map sizes the routes as small, an estimate.


## settings_rules

In the spike design, the user door ignores kit locked. We infer the reason: the setting limits agents, not the person who owns the machine. In the design, the pane and the tools use one service. We infer that the other errors are the same at both doors.

The spike design also says what a failure does. For example, install failed leaves the kit and its old folder in place. In use lists the slugs that still import the package. We infer that the pane shows the error. The pane listens to the kit stream, so a change from an agent shows at once.
## kit_feed

The change feed is the list of recent changes that agents read with widget changes. Today each entry has a slug, a kind, and who made the change. The kinds are state, program, added, and removed. A kit change needs a new kind or a new feed. We infer that from the code. The spike design names only a change feed entry from an agent or a user.

## settings_pane

In the spike design, the settings pane is a page for the user. No pane exists yet. It shows the setting as a switch.

It lists the core packages, which the user cannot remove. It lists the extras, each with its side and who added it. A form adds or removes an extra through the routes. The work map sizes the pane as medium, an estimate.

## serving_today

On the diagram, we now move to Electron main. Today Electron main serves one shell for every slug, from one folder. The window address is slash widget, with the slug in the query string.

## serving_slug

With the kit, each slug has its own build folder. The spike Vite config sets the base path to slash widget, then the slug. Electron main must map that path to the build folder of that slug. The window code must open that address. We infer these changes from the spike config and the current code.


## serving_rebuild

A rebuild writes a new build folder for the slug. The old folder stays until every gate passes. Then the service swaps the folders, and the window loads the new page. If a gate fails, the window keeps the old page.

Old folders of removed widgets need a cleanup. We infer all of this from the pin policy and the spike config.
## serving_csp

The page keeps its content security policy. Scripts can load only from the same origin. We infer that each strategy can keep its files on that origin, so the policy holds. A fallback page must show when a slug has no build. The work map sizes this front as medium, an estimate.

## checks_list

On the diagram, the checks touch every box. Each unit of work needs a check that can fail. The spike work map names these checks. A smoke check adds an extra, builds a widget, and renders it.

An MCP test calls kit add with the setting off and expects kit locked. It also removes a package in use and expects in use. Another test sends list changed to the modern MCP client and checks that the client reads the lists again. The work map sizes the checks as medium, an estimate.


## checks_today

Some checks exist today and must change. The MCP check, widgets m c p, checks that the server lists the nine tools. It calls only the four interact tools. It must also test the four kit tools.

The creation check, widgets create, runs the three gates. It must also run the type gate, the Vite build, and the render check. The smoke check of one widget must load the page of that slug.

Each new check must fail on a broken build. A check that cannot fail proves nothing. We infer the list of changes from the work map and the current tools folder.
## tla_models

TLA plus is a language for models of systems that change state. A model checker walks every order of steps and checks the rules. The repository has three widget models. One of them is widget install. It models install, reload, and remove, with crashes between steps.

The spike work map plans a build step and a kit version in that model. It also plans a race, a kit remove during an install, which must give in use. A new small model would cover kit add and kit remove against builds. We infer that the two other models need no change. The work map sizes this as medium, an estimate.

## prior_art

Other projects solve parts of this. Context seven gives agents two tools. One finds a library, and one returns its documents on request. That matches the index and the card. The llms dot t x t format also has an index file and a full file.

Raycast and VS Code put the packages of each extension into its own build. Val Town names the version inside each import. Observable and Deno import maps resolve and pin each import at build time. All of these, except Context seven, come from memory, not from a test. No project does the whole path, so the work builds from the parts.

## risks_build

Now the risks, stated plainly. The render check finds only errors that throw. The type gate refuses an untyped extra until the agent declares the module. After that, the spike record says that a wrong prop passes. We could not check that.

The shared chunks strategy cannot drop unused code. Lucide adds nine hundred three kilobytes and recharts five hundred seventy-eight.

The node modules folder of kit vee one is about two hundred twenty-eight megabytes. Lucide alone is about forty-five megabytes, and date f n s about thirty-eight. The spike record also says that about eighty-five megabytes is build tooling. We measured the build tools at seventy-five to ninety megabytes. The range depends on which helper packages we count.

## risks_supply

Minimum release age holds a security fix for one day, unless the kit excludes that package. The lockfile records a local file extra as a path relative to the project. Thus the layout of the kit folder must stay fixed.

An external host import that the kit does not have can resolve from the node modules of the profile. We infer that risk. Native addons fail, because Electron and the app Node have different A B I numbers.

## work_map

Here is the whole work map. Each size is an estimate. Large: the kit service with p n p m, and the Vite build gate. Medium: the MCP kit tools and the index, the settings pane, and the gate for host extras.

Also medium: kit versions and pins, the split of main dot t s x, and Electron main for each slug. Also medium: the checks and the TLA plus work. Small: the kit routes, and the guide and the template. Two fronts are large, eight are medium, and two are small.

## open_items

Here is what is still open for the operator to decide. Which packaging strategy: fresh install, kit lockfile, or shared chunks? Pin or rebuild: does the inferred policy become the rule? Which host extras to allow: bundle, external, or none? Do native addons stay out?

Which tool runs the type gate: t s c or t s go lint? Where does the kit live, and which tools and errors does it have? What goes in a package card: a readme part, or a curated usage field? How does the kit handle minimum release age for a security fix?

The standing decision widget runtime pin still says one shared shell. Does the kit direction replace it? This video recommends none of these choices.

## closing

To close. The widget kit is a direction in progress, not a decided spec. Each widget would get its own page, with a library that an agent writes. The spike measured the build, the packaging, the host extras, pin or rebuild, and the agent text. Twelve fronts of work follow from it. The operator decides the open points before any spec.
