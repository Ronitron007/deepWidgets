import { crudActions } from './crud.js'

export const name = 'deepwidgets-widget-groceries'
export const inject = ['widgets']

const PROGRAM = `root = Card([title, list, form])
title = TextContent("Groceries")
items = Query("list", {}, [])
list = Table(items, ["text", "done"])
form = Form("add", [Input("text")])
`

export function apply(ctx) {
  const { actions, initialState } = crudActions({ items: { text: 'string', done: 'boolean' } })
  ctx.widgets.register({ slug: 'groceries', title: 'Groceries', program: PROGRAM, actions, initialState })
}
