# Agent library `agent_library`

This spec is the first part of stage 3 of the build order. The agent library lets an agent write its own React components for a widget. The operator set the direction in `kit_spike.direction` and set the build order on 2026-11-10. The agent library comes first. The kit comes after it.

This spec builds only `agent_library.main_split`. The other parts of the stage wait for the operator's direction. `agent_library.later` lists them.

## Terms `agent_library.terms`

- **Core:** the part of the widget page that no agent changes. It loads the program, sends the queries and the mutations, reads the stream, and shows the states of the page.

- **Child:** one React component that holds `<Renderer.Root>` and a component library. Later units let an agent write its own child.

- **Contract:** the type `ChildProps`, where the core and the child meet.

## Split the shell `agent_library.main_split`

Today `deepwidgets/shell/src/main.tsx` holds all code of the widget page. This part splits it into the core and a child.

- A new package, `@deepwidgets/widget-kit`, in `deepwidgets/widget-kit/`, holds the core and the contract.

- The core exports one function. It takes one catalog id and the child, and it mounts the page in `#root`. A child has exactly one component set, so the program must name that id.

- The core does each job that `main.tsx` does today: the slug, the channel, the program load, the catalog check, the stream, the refresh of the queries, the late-answer rule, the states, and the diagnostics in `window.__dw`.

- `channel.ts` moves into the core.

- The contract is `ChildProps`: `{ root: RootProps; children?: ReactNode }`. `root` holds the props of `<Renderer.Root>` that the core makes. `children` holds the elements that the core puts inside the root: the content, the refresh bridge, and the program errors.

- The child renders `<Renderer.Root {...root}>` with its own library, and puts `children` inside it.

- `deepwidgets/shell/src/main.tsx` keeps only the default child. The default child uses `library.tsx` and the component set `shadcn-widgets@1`.

- The page that the shell builds keeps its URL, its behavior, and its diagnostics. The smoke checks see no change.

## Rules `agent_library.rules`

- The contract is a type, not a guard. A child can change the tool provider. Later units add the gates that check a child.

- The core does not import a component library. Thus a later child can bring its own library with no change to the core.

- This part changes no MCP tool, no host code, and no Electron code.

## Build a page at install `agent_library.build_gate`

The operator gave the direction on 2026-11-11. A bundle can hold a folder `page/` next to `src/`. When the folder is there, `widget_install` and `widget_reload` run the page gates after the host gates. If a gate fails, the install stops, and the old bundle and its page stay.

### The page folder `agent_library.build_gate.folder`

The template gives these files:

| File | Owner | Rule |
|---|---|---|
| `page/index.html` | template | fixed |
| `page/main.tsx` | template | fixed. It mounts the core with the child and imports `styles.css`. |
| `page/styles.css` | template and agent | The block between the `dw-core` markers is fixed. The agent writes its styles below the block. |
| `page/child.tsx` | agent | It renders `<Renderer.Root {...root}>` with its library and puts `children` inside it. |
| `page/library.tsx` | agent | The OpenUI components of the widget |

- The fixed block of `styles.css` holds the styles of the page states: the `dw-*` rules that `deepwidgets/shell/src/styles.css` holds today. The block puts them in `@layer dw-core`, and each rule has `!important`. Thus a style of the agent can not override them.

- The shell keeps the same rules, so the shell page does not change.

- This unit adds the fixed files to the template folder `deepwidgets/mcp/widget/template/`. `library.guide` adds the example child, the example library, and the guide text.

### The gates `agent_library.build_gate.gates`

The page gates run in this order:

1. **The fixed files.** The gate compares `index.html`, `main.tsx`, and the `dw-core` block of `styles.css` with the template, by hash. A plain step does this before the build.

2. **The type gate.** `tsc` checks `page/` against the types of `@deepwidgets/widget-kit` and of the allowed packages.

3. **The build.** Vite builds the page into the profile folder of the bundle, at `<profile>/deepwidgets-widgets/<slug>/page/`. One Vite config serves each page. Its `base` is the URL path of the slug. A Vite plugin refuses each import that is not on the allowed list. `agent_library.fence_warn` changes that refusal to a warning.

4. **The render check.** A hidden Electron window loads the built page.

The allowed imports are `react`, `react-dom`, `@openuidev/react-lang`, `zod`, `@deepwidgets/widget-kit`, and the shadcn pieces that the shell has today. `zod` is on the list because `defineComponent` of OpenUI needs it. This unit makes those pieces importable from outside the shell.

### The render check `agent_library.build_gate.render`

- The host asks Electron main to run the check. Electron main loads the built page in a hidden window of the default widget size, 320 by 300.

- The page renders the program from the test run of the host gates, with the query answers from that test run. It does not use the live host.

- The check fails when a component throws, when the page does not reach `ready` in time, or when a page state lost the `dw-core` styles.

- A body with no height and content wider than the window are warnings. The install answer lists them, and the install goes on.

- A CLI host has no Electron. There, the render check does not run, and the install answer gives the warning that the render check was skipped. Only checks and dev runs use a CLI host.

### What this unit does not do `agent_library.build_gate.not`

- Electron main does not show the built page in the widget window. `library.serving` does that.

- The kit does not exist yet. The allowed packages come from the workspace.

## Accepted findings of the build gate `agent_library.build_gate.accepted`

The verify of `library.build_gate` left findings open. The operator merged the unit on 2026-11-13 with this decision: recovery, not a defensive block. The host half of a widget runs as full Node. Thus a page that reads a file gets nothing that the bundle did not have.

| Finding | State |
|---|---|
| A page can embed a `package.json` or a `tsconfig*.json` of a folder above it, with `new URL` or in a worker | Accepted by the operator |
| The build of a worker of a page runs with no import fence | Accepted by the operator |
| A page can open `@layer dw-core` again below the fixed block and override a protected style. The gate `page-files` compares only the text of the block. | Accepted in the free hour of 2026-11-16. The render check finds the override (`lost-core-styles`). A CLI host skips the render check, and only checks and dev runs use a CLI host. The operator can change this decision. |

## Fences that report `agent_library.fence_warn`

This part follows the decision of the operator at the merge of `library.build_gate`.

- The import fence and the output fence do not refuse the build. Each finding becomes a warning of the gate `page-build`, and the install answer lists it.

- A warning of the import fence names the page file and the import. A warning of the output fence names each file outside the page folder.

- The host writes one log line for each install that has such a warning.

- `allowedFolders` follows the development dependencies of `@deepwidgets/shell` and `@deepwidgets/widget-kit` only. Before, it followed them for each workspace package that it reached, and the set had 1,152 folders.

These parts do not change:

- The gate `page-files` and the render check refuse as before.

- The type gate refuses an import of a package that has no link in the staging `node_modules`. Such an import does not resolve.

- The stylesheet rules refuse a PostCSS or Tailwind config file, `@plugin`, and `@config`. These change how the build itself runs. This was a decision of the free hour of 2026-11-16, and the operator can change it.

## Serve the page of each widget `agent_library.serving`

The operator gave the direction on 2026-11-16: each widget page gets its own origin. The free hour of that day gave more decisions, and `agent_library.serving.decisions` lists them.

### Terms `agent_library.serving.terms`

- **Origin:** the scheme, the host name, and the port of a URL. The browser keeps the pages of two origins apart.

- **Widget origin:** the origin of one slug, `dsh-app://w-<slug>.widget`.

### Origins `agent_library.serving.origins`

- Each widget window loads its page from the widget origin of its slug.

- Built-in widgets, such as `sample`, move to their widget origin too. Thus one rule covers each widget.

- No slug maps to a host name that the app uses for another job: `app`, `shell`, or `widget-check`. Two slugs never map to one host name. The mapping holds for each valid slug.

A spike found two traps, and the host name `w-<slug>.widget` has neither:

- The name `widget-<slug>` gives the slug `check` the host name of the render check.

- The name `<slug>.widget` fails for a slug that starts with `xn--`. The URL parser reads that label as Punycode and refuses it.

### Routes of a widget origin `agent_library.serving.routes`

On the widget origin of the slug S, Electron main answers only these paths:

| Path | Answer |
|---|---|
| `/widget/<S>/` and the files below it | The built page of S, from the folder behind the link `<S>/page`. Only when the link is there. |
| `/widget/` and the files below it | The shared shell |
| `/api/widgets/<S>/` and the paths below it | The host, as today |
| `/api/widgets/<other slug>/` | Status 403 |
| Each other path | Status 404 |

- A page build has the base path `/widget/<slug>/` (`agent_library.build_gate.gates`). Thus the page keeps that path on its widget origin. A build from before this unit needs no new build.

- The window of a slug with a page link loads `/widget/<S>/?slug=<S>`. The window of a slug with no page link loads `/widget/?slug=<S>`.

- `pageFile` of `apps/desktop/src/deepwidgets-page-path.ts` finds each page file. It resolves each link, refuses a path outside the folder of the slug, and refuses a `.tmp` build.

- A page of the slug A can not call an action of the slug B. The fixed `index.html` allows connections to its own origin only. Electron main refuses the path of another slug on that origin.

- Electron main sends a content security policy as a response header on each response of a widget origin, and on the route `/widget/` of the origin `app`. The header has the rules of the fixed `index.html`, and also `frame-ancestors 'none'`.

- The reason: a page can emit a second HTML file, and that file has no `<meta>` policy. With the header, such a file can not frame the page of another widget, and no page of a widget can be in a frame.

### Page changes `agent_library.serving.changes`

- Electron main does not know the profile folder. The host uses its IPC channel to Electron main. When the host is ready, it sends the widget root folder and the slugs that have a page link. It sends a message again after each change of a page link.

- When the page link of a slug changes, Electron main loads the window of that slug again. It uses the URL for the new state. Thus an install with new page sources shows the new page. An install with no `page/` shows the shared shell.

### Failures at run time `agent_library.serving.failures`

- A component that throws stays inside the page. The core shows its error state, as today.

- The renderer of an agent page can end, and a page can fail to load. In each case, Electron main loads the page one more time.

- When that occurs again in 60 s, Electron main loads the shared shell in that window. The shell shows a notice that the page of the widget failed. The window keeps the shared shell until the page link changes or the app starts again.

- Electron main writes a log line for each of these steps.

This follows the host: a crash gets a restart first, and safe mode comes only after a repeat (`safe_host`).

### Decisions of the free hour `agent_library.serving.decisions`

The operator gave one hour of free decisions on 2026-11-16. Each row is a decision of that hour, and the operator can change it.

| Decision | Data |
|---|---|
| The host name is `w-<slug>.widget` | The spike of `agent_library.serving.origins` |
| Built-in widgets get a widget origin too | One rule, and the shared shell needs no second route |
| An agent page keeps the path `/widget/<slug>/` | The base path is in each build. A relative base needs a new build of each page. |
| The host tells Electron main each page change over IPC | Electron main has no profile path, and the IPC channel carries the render check already |
| Reload one time, then the shared shell with a notice | The host supervisor does the same: restart, then safe mode |
| The routes of the origin `app` stay | No agent page loads there. The smallest change. |

## Teach the agent `agent_library.guide`

Each rule of this part is a decision of the free hour of 2026-11-16. The data for each one is in `agent_library.guide.decisions`. The operator can change each one.

### The mode `agent_library.guide.mode`

- The mode `library` joins the answer of `deepwidgets_modes` (`modes.list`). Its goal is to write the page of a widget with components of the agent.

- The setting of the mode is `modes.library` in the settings file. A missing key means that the mode is on.

- The mode has one tool, `library_template`, and one guide, `widget_guide` with the mode `library`.

When the mode is off:

- `library_template` returns `mode-off`.

- `widget_install` and `widget_reload` return `mode-off` for a bundle that has `page/`. The error names the mode `library` and its setting. A bundle with no `page/` installs as before.

- A page that is installed keeps its window. The setting stops an install, not a page.

### The tool `library_template` `agent_library.guide.template`

- `library_template` gives the files of the page folder for one slug: the three fixed files, an example `child.tsx`, and an example `library.tsx`.

- `widget_template` does not change. Thus an agent that writes a widget with no page does not pay for the page files.

- The example library extends the component set of the shell with one component of its own. Thus the program of the widget template renders with the example page, and the agent sees how to add a component.

- For this, the shell exports its library as `@deepwidgets/shell/library`, and that import joins the allowed imports of a page.

### The guide `agent_library.guide.text`

`widget_guide` with the mode `library` gives the page guide. It holds these parts:

- the page folder, and the files that the agent must not change

- the contract `ChildProps`, and the catalog id of the child

- the allowed imports

- how to define a component, with its props as a zod schema

- each page gate, with its error codes and its warnings

- how to see the page: `widget_describe`, and the window of the widget

The page guide does not repeat the guide of the program language. It tells the agent to read the guide of the mode `create` for that. The page guide has at most 8,000 characters.

### Decisions of the free hour `agent_library.guide.decisions`

| Decision | Data |
|---|---|
| The page work is the mode `library` | `modes.list` names `library` as a later mode, and each stage adds its own mode |
| The mode has a setting, and the default is on | Page code runs in a window with no review, so the operator gets a switch. `modes.settings` makes a missing key mean on. |
| A new tool `library_template`, not a change to `widget_template` | `modes.names`: a tool name starts with the area of its mode. The page files are about 2,100 characters with no example, and an agent with no page does not need them. |
| The example library extends the shell library | The operator chose the shell pieces as a base for agent pages (2026-11-11). `standing.checked.component_extend` verified `library.extend`. With it, the template program renders with no change. |
| The page guide is short and points at the create guide | The create guide is about 21,000 characters. A second copy doubles the cost. |

## Later `agent_library.later`

These units follow, in this order. Each one waits for the operator's direction.

1. The kit units: `kit.service`, `kit.host_extras`, `kit.tools`, `kit.pins`, `kit.pane`, and `kit.model`.
