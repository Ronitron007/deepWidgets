/**
 * The page of the main widget (`main_widget.widget`): the second entry of the shell build, `main.html`.
 * The panel loads it at dsh-app://w-main.widget/widget/main.html?slug=main. It mounts the core of
 * `@deepwidgets/widget-kit` with the child of main and the component set `deepwidgets-main@1` (`main_widget.catalog`),
 * so it refuses the program of each other widget. The core is the same as on the shell page.
 * @module @deepwidgets/shell/main-widget
 */
import { Renderer } from '@openuidev/react-lang'
import { mountWidget, type ChildProps } from '@deepwidgets/widget-kit'
import { CallProvider } from './call.tsx'
import { MAIN_CATALOG, mainLibrary } from './library.tsx'
import '../styles.css'
import './main.css'

/** The child of main: `<Renderer.Root>` with the library of `deepwidgets-main@1`. The row controls get the tool provider. */
function MainChild({ root, children }: ChildProps) {
  return (
    <CallProvider tools={root.toolProvider}>
      <Renderer.Root {...root} library={mainLibrary}>{children}</Renderer.Root>
    </CallProvider>
  )
}

mountWidget({ catalog: MAIN_CATALOG, child: MainChild })
