/**
 * Fixtures of a widget bundle with a page (`agent_library.build_gate`), for tools/widgets-create.mjs and
 * tools/smoke-desktop.mjs. `writePageWidget` writes a bundle folder: `src/index.ts`, the fixed page files of the
 * template, and a child and a library that use only allowed imports. A variant changes one file.
 * The library uses the shadcn pieces of the shell, so it needs no import that is not on the list.
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

const PROGRAM = \`root = CardHeader("Page check", s.note)
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

export const LIBRARY = `import { createLibrary } from '@openuidev/react-lang'
import { CardHeader } from '@deepwidgets/shell/components/card-header.tsx'
import { TextContent } from '@deepwidgets/shell/components/text-content.tsx'

export const pageLibrary = createLibrary({ root: 'CardHeader', components: [CardHeader, TextContent] })
`

/** A library whose CardHeader throws when it renders. The host gates and the build pass. */
export const THROWING_LIBRARY = `import { createLibrary, defineComponent } from '@openuidev/react-lang'
import { CardHeader as Base } from '@deepwidgets/shell/components/card-header.tsx'

const CardHeader = defineComponent({
  name: 'CardHeader',
  props: Base.props,
  description: Base.description,
  component: () => { throw new Error('the page component broke on purpose') },
})

export const pageLibrary = createLibrary({ root: 'CardHeader', components: [CardHeader] })
`

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
