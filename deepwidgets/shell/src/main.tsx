/**
 * The pinned widget shell (`widget_mvp.shell`): one page for each widget window.
 * This file keeps only the default child (`agent_library.main_split`). The core in
 * `@deepwidgets/widget-kit` loads the program, reads the stream, and shows the states.
 * The default child renders the program with the component set `shadcn-widgets@1`.
 * @module @deepwidgets/shell
 */
import { Renderer } from '@openuidev/react-lang'
import { mountWidget, type ChildProps } from '@deepwidgets/widget-kit'
import { CATALOG_ID, widgetLibrary } from './library.tsx'
import './styles.css'

/** The default child: `<Renderer.Root>` with the library of `shadcn-widgets@1`. */
function DefaultChild({ root, children }: ChildProps) {
  return <Renderer.Root {...root} library={widgetLibrary}>{children}</Renderer.Root>
}

mountWidget({ catalogs: [CATALOG_ID], child: DefaultChild })
