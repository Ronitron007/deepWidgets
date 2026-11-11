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

## Later `agent_library.later`

These units follow, in this order. Each one waits for the operator's direction.

1. `library.build_gate`: a type gate, a Vite build, and a render check for the folder `page/` of a bundle.

2. `library.serving`: Electron main serves the built page of a slug.

3. `library.guide`: the template and the create guide for `page/library.tsx` and `page/child.tsx`.

4. The kit units: `kit.service`, `kit.host_extras`, `kit.tools`, `kit.pins`, `kit.pane`, and `kit.model`.
