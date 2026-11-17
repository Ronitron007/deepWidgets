/**
 * The child of the widget page (`agent_library.guide.template`). `main.tsx` mounts the core with it.
 * The core gives `root`, the props of `<Renderer.Root>`, and `children`: the content, the refresh bridge, and the
 * program errors. Render `<Renderer.Root {...root} library={...}>` and put `children` inside it.
 * `CATALOG_ID` names the component set of `library.tsx`. Set `catalog` in the widget definition in `src/index.ts` to
 * this id: the page refuses a program with another catalog. Give a new id when you remove or change a component.
 */
import { Renderer } from '@openuidev/react-lang'
import type { ChildProps } from '@deepwidgets/widget-kit'
import { library } from './library.tsx'

export const CATALOG_ID = '__SLUG__@1'

export function Child({ root, children }: ChildProps) {
  return <Renderer.Root {...root} library={library}>{children}</Renderer.Root>
}
