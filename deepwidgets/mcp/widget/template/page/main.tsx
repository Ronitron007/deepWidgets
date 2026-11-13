/**
 * A fixed file of the widget page (`agent_library.build_gate.folder`). Do not change it: the install compares it
 * with the template. It mounts the core with the child of `child.tsx` and imports `styles.css`.
 * `child.tsx` exports `CATALOG_ID`, the id of its component set, and `Child`, which renders
 * `<Renderer.Root {...root} library={...}>` and puts `children` inside it.
 */
import { mountWidget } from '@deepwidgets/widget-kit'
import { CATALOG_ID, Child } from './child.tsx'
import './styles.css'

mountWidget({ catalog: CATALOG_ID, child: Child })
