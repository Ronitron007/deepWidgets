export const name = 'deepwidgets-widget-groceries'
export const inject = ['widgets']

/** Seed program for the shell catalog (shadcn-widgets@1); actions come from the crud descriptor. */
export const PROGRAM = `root = Card([CardHeader("Groceries", "Shared list"), form, body])
$text = ""
items = Query("list", {}, {rows: []})
add = Mutation("add", {text: $text})
toggle = Mutation("update", {id: $id, done: $done})
form = Row([Input("text", "Add item", $text), Button("Add", Action([@Run(add), @Run(items), @Reset($text)]))])
rows = @Each(items.rows, "t", Checkbox(t.text, t.done, Action([@Set($id, t.id), @Set($done, !t.done), @Run(toggle), @Run(items)])))
body = @Count(items.rows) == 0 ? Empty("Nothing yet", "Add an item above") : List(rows)
`

export const TABLE = {
  fields: {
    text: { type: 'string', required: true },
    done: { type: 'boolean', default: false },
  },
}

export function apply(ctx) {
  ctx.widgets.register({ slug: 'groceries', title: 'Groceries', kind: 'crud', table: TABLE, program: PROGRAM })
}
