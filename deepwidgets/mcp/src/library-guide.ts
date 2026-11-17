/**
 * The guide of the mode `library` (`agent_library.guide.text`): how an agent writes the page of a widget with its own
 * components. It does not repeat the guide of the program language: it sends the agent to the guide of the mode
 * `create` for that. It has at most 8,000 characters.
 * @module @deepwidgets/mcp/library-guide
 */
import { ALLOWED_TEXT } from './page-gate.ts'

/** The page guide. */
export const LIBRARY_GUIDE = `# Writing the page of a widget

A widget can have its own page: React components that render its program. A widget with no page uses the shared page and its component set shadcn-widgets@1. This guide covers the page only. For the program language (OpenUI Lang), the widget API, and the components of the shell, call widget_guide with mode "create".

Steps:
1. Call widget_template and library_template with the same slug. Write the files into one folder: src/index.ts, and the five files under page/.
2. In src/index.ts, set catalog in the widget definition to the CATALOG_ID of page/child.tsx.
3. Add your components in page/library.tsx, and use them in the program.
4. Call widget_install with the absolute folder path.

## The page folder

| File | Rule |
|---|---|
| page/index.html | Fixed. Do not change it. |
| page/main.tsx | Fixed. It mounts the core with Child and CATALOG_ID of child.tsx, and imports styles.css. |
| page/styles.css | The block from dw-core:begin to dw-core:end is fixed. Write your styles below it. |
| page/child.tsx | Yours: the child and its catalog id. |
| page/library.tsx | Yours: the component library. |

The install compares the fixed files with the template. You can add more files in page/. Do not add a symbolic link, a PostCSS or Tailwind config file, @plugin, or @config. Tailwind classes work in each file of page/, with the DSH tokens of the shell, for example bg-card, text-muted-foreground, text-destructive, and border-border.

## The child and its catalog

child.tsx exports two names:
- Child: a React component with the props ChildProps of @deepwidgets/widget-kit, { root: RootProps; children?: ReactNode }. Render <Renderer.Root {...root} library={library}>{children}</Renderer.Root>. root holds the props that the core makes: the response, the tool provider, the query loader, and the handlers. children holds the content, the refresh bridge, and the program errors. Keep both.
- CATALOG_ID: the id of the component set of your library. The template gives <slug>@1.

Set the same id as catalog in the widget definition:

    ctx.widgets.register({ slug: SLUG, title: 'My widget', catalog: 'my-widget@1', program: PROGRAM, initialState, actions })

The page refuses a program with another catalog. A definition with no catalog has shadcn-widgets@1. In the app, the render check then fails the install with wrong-catalog. A CLI host has no render check: the install passes with only the warning that the check was skipped, and the page refuses the program later, in the window of the app. When you remove a component, or change its props so that an old program breaks, give a new id, for example my-widget@2, in both places.

## Allowed imports

A file in page/ may import only: ${ALLOWED_TEXT}, and files in page/.
- @deepwidgets/shell/library gives widgetLibrary, the set shadcn-widgets@1. Its root is Card. The create guide lists its components.
- @deepwidgets/shell/ui/<file> gives a shadcn piece, for example @deepwidgets/shell/ui/button.tsx. @deepwidgets/shell/components/<file> gives an OpenUI component of the shell, for example @deepwidgets/shell/components/card-header.tsx.
An import of a package that does not resolve fails the type gate. Another import that is not on the list installs with a warning.

## Define a component

    import { defineComponent } from '@openuidev/react-lang'
    import { z } from 'zod'
    import { widgetLibrary } from '@deepwidgets/shell/library'

    const Note = defineComponent({
      name: 'Note',
      description: 'One short line of text. tone: "info" | "warn".',
      props: z.object({ text: z.string(), tone: z.enum(['info', 'warn']).optional() }),
      component: ({ props }) => <p className="text-xs">{props.text}</p>,
    })

    export const library = widgetLibrary.extend({
      components: { add: [{ component: Note, slots: ['Card.children', 'List.children'] }] },
    })

In the program: Card([CardHeader("Title"), Note("Saved", "info")]).
- props is a zod object. The order of its keys is the order of the arguments in the program. Put the optional props last.
- description goes into the guide of the program. Keep it short, and name the values of each enum.
- slots puts the component in the children of a parent, as "Parent.prop". Give each slot where the program uses it.
- A component with children has a prop such as children: z.array(z.union([A.ref, B.ref])), and renders them with renderNode(props.children).
- extend can also override a component of the shell (override: [component]) or remove one by name (remove: ['Name']).
- For an action prop, use action() of @openuidev/react-lang and call useTriggerAction(). For an input bound to a $variable, use reactive() and useStateField(). The Button and Input of @deepwidgets/shell/library do this.
- Data comes from the program, not from fetch. Read the state in the program with Query, and change it with Mutation.

## The page gates

When the folder has page/, widget_install and widget_reload run the page gates after the host gates (compile, lint, test). The first gate that fails stops the install. The answer has the code gate-failed, the gate, diagnostics, and nextStep. Nothing is installed, and the old bundle and its page stay.

| Gate | Refuses | Warns |
|---|---|---|
| page-files | a fixed file that is missing or changed, a changed dw-core block, a symbolic link | |
| page-types | a type error in page/, an import that does not resolve | |
| page-build | a build error, a PostCSS or Tailwind config file, @plugin, @config | an import that is not on the list, a file outside page/ that the page reads |
| page-render | the codes below | the codes below |

The render check loads the built page in a hidden window of 320 by 300 px, with the program, the catalog, and the query answers of the test run. Each diagnostic starts with its code:
- render-error: a component threw.
- not-ready: the page did not reach ready in time, for example because of a loop at the top level.
- lost-core-styles: a style overrides a dw-core style of a page state.
- wrong-catalog: CATALOG_ID of page/child.tsx is not the catalog of the widget.
- load-failed: the check did not run.
Its warnings: the body has no height, the content is wider than the window, and the page reported program errors. A CLI host has no render check: the install answer warns that it was skipped.

## See the page

- The install answer gives the gates, the warnings, and page, the folder of the built page.
- widget_describe gives the state, and source, the folder of the files. widget_call changes the state, and the page shows the new state.
- The app shows one window for each widget. A widget with a page loads it at dsh-app://w-<slug>.widget/widget/<slug>/. Ask the user to look at the window.
- When the page fails two times in 60 s, its window shows the shared page with a notice. The shared page refuses the program of your catalog. Fix the page and install again.

## The mode library

The setting modes.library turns this mode off. Then library_template returns mode-off, and widget_install and widget_reload of a folder with page/ return mode-off. A bundle with no page/ installs as before, and a page that is installed keeps its window.
`
