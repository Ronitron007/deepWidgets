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

3. **The build.** Vite builds the page into the profile folder of the bundle, at `<profile>/deepwidgets-widgets/<slug>/page/`. One Vite config serves each page. Its `base` is the URL path of the slug. A Vite plugin refuses each import that is not on the allowed list.

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

## Later `agent_library.later`

These units follow, in this order. Each one waits for the operator's direction.

1. `library.serving`: Electron main serves the built page of a slug.

2. `library.guide`: the template and the create guide for `page/library.tsx` and `page/child.tsx`.

3. The kit units: `kit.service`, `kit.host_extras`, `kit.tools`, `kit.pins`, `kit.pane`, and `kit.model`.
