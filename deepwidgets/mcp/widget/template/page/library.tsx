/**
 * The components of the widget page (`agent_library.guide.template`): the component set of the shell, with the
 * components of this widget added. A component has a name, a description for the program, its props as a zod
 * schema, and a React component. `slots` puts it in the children of a parent, such as "Card.children".
 */
import { defineComponent } from '@openuidev/react-lang'
import { z } from 'zod'
import { widgetLibrary } from '@deepwidgets/shell/library'

/** An example component: one short line of text. Use it in the program as Note("text") or Note("text", "warn"). */
const Note = defineComponent({
  name: 'Note',
  description: 'One short line of text. tone: "info" | "warn".',
  props: z.object({ text: z.string(), tone: z.enum(['info', 'warn']).optional() }),
  component: ({ props }) => (
    <p className={props.tone === 'warn' ? 'text-xs font-medium text-destructive' : 'text-xs text-muted-foreground'} data-dw="note">
      {props.text}
    </p>
  ),
})

/** The library of the child: the shell set, and Note in the body of Card and in List. */
export const library = widgetLibrary.extend({
  components: { add: [{ component: Note, slots: ['Card.children', 'List.children'] }] },
})
