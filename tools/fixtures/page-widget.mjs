/**
 * Fixtures of a widget bundle with a page (`agent_library.build_gate`), for tools/widgets-create.mjs and
 * tools/smoke-desktop.mjs. `writePageWidget` writes a bundle folder: `src/index.ts`, the fixed page files of the
 * template, and a child and a library that use only allowed imports. A variant changes one file.
 * The library defines two components with zod schemas (`Stack` and `Note`) and uses the CardHeader of the shell.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))
const TEMPLATE = join(ROOT, 'deepwidgets/mcp/widget/template/page')

/** The text that the render check shows: the answer of the query `get` in the test run. */
export const PAGE_NOTE = 'ready from the test run'

/** The widget source: a counter whose program shows the note of the query `get`. */
export function pageSource(slug) {
  return `import type { WidgetContext } from 'deepwidgets:widget'
import { z } from 'zod'

const PROGRAM = \`root = Stack([CardHeader("Page check", s.note), Note(s.note)])
s = Query("get", {}, {count: 0, note: "loading"})
\`

export const name = 'widget-${slug}'
export const inject = ['widgets', 'timer']

export function apply(ctx: WidgetContext): void {
  ctx.widgets.register({
    slug: '${slug}',
    title: 'Page check',
    program: PROGRAM,
    initialState: { count: 0, note: '${PAGE_NOTE}' },
    actions: [
      { name: 'get', kind: 'query', handler: (_args, w) => w.state },
      {
        name: 'add',
        kind: 'mutation',
        args: z.object({ by: z.number().int().default(1) }),
        handler: ({ by }, w) => w.update((state) => ({ ...state, count: state.count + by })),
      },
    ],
  })
}
`
}

export const CHILD = `import { Renderer } from '@openuidev/react-lang'
import type { ChildProps } from '@deepwidgets/widget-kit'
import { pageLibrary } from './library.tsx'

export const CATALOG_ID = 'page-check@1'

export function Child({ root, children }: ChildProps) {
  return <Renderer.Root {...root} library={pageLibrary}>{children}</Renderer.Root>
}
`

/** The library text. `note` is the body of the Note component. */
const library = (note) => `import { createLibrary, defineComponent } from '@openuidev/react-lang'
import { z } from 'zod'
import { CardHeader } from '@deepwidgets/shell/components/card-header.tsx'

const Note = defineComponent({
  name: 'Note',
  description: 'One line of text.',
  props: z.object({ text: z.string() }),
  component: ({ props }) => ${note},
})

const Stack = defineComponent({
  name: 'Stack',
  description: 'Children from top to bottom.',
  props: z.object({ children: z.array(z.union([CardHeader.ref, Note.ref])) }),
  component: ({ props, renderNode }) => <div className="flex flex-col gap-2">{renderNode(props.children)}</div>,
})

export const pageLibrary = createLibrary({ root: 'Stack', components: [Stack, CardHeader, Note] })
`

/** The good library: its components have zod schemas. */
export const LIBRARY = library('<p className="text-xs" data-dw="note">{props.text}</p>')

/** A library whose Note throws when it renders. The host gates and the build pass. */
export const THROWING_LIBRARY = library("{ throw new Error('the page component broke on purpose: ' + props.text) }")

/**
 * A child that never yields: its top level loops, so the page never loads. The loop writes the document title, so the
 * build keeps it (a loop with no effect is removed).
 */
export const LOOPING_CHILD = `${CHILD}\nwhile (Date.now() > 0) document.title = 'spin'\n`

/** Styles below the block that override a dw-core style in the dw-core layer: the render check finds the lost style. */
export const LOST_STYLES = '@layer dw-core {\n  .dw-surface { padding: 0 !important; }\n}\n'

/** Styles that give the body no height and make the content wider than the window: two warnings, no failure. */
export const WARNING_STYLES = 'body { height: 0; }\n#root { width: 640px; }\n'

/** The template text of a fixed page file. */
export const templateText = (name) => readFileSync(join(TEMPLATE, name), 'utf8')

/**
 * Write a bundle with a page into `dir`. `files` replaces or adds files by their path in the bundle,
 * for example `{ 'page/child.tsx': text }`.
 */
export function writePageWidget(dir, slug, files = {}) {
  const all = {
    'src/index.ts': pageSource(slug),
    'page/index.html': templateText('index.html'),
    'page/main.tsx': templateText('main.tsx'),
    'page/styles.css': templateText('styles.css'),
    'page/child.tsx': CHILD,
    'page/library.tsx': LIBRARY,
    ...files,
  }
  for (const [path, text] of Object.entries(all)) {
    const file = join(dir, path)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)
  }
  return dir
}
