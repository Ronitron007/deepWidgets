import { randomUUID } from 'node:crypto'
import { z } from 'zod'

/**
 * The one CRUD descriptor (`crud.table`), used by package widgets
 * (`ctx.widgets.register({ kind: 'crud', table })`) and by agent-saved data
 * widgets (`widget_save`). It is plain JSON, so an agent can write it and the
 * runtime can store it.
 *
 *   table: { fields: { text: { type: 'string', required: true },
 *                      done: { type: 'boolean', default: false } } }
 *
 * Generated actions: list (query) -> { rows }, add, update ({ id, ...fields }),
 * remove ({ id }). State shape: { rows: [{ id, ...fields }] }.
 */
const FIELD = /^[a-z][a-zA-Z0-9_]{0,40}$/
const TYPES = {
  string: () => z.string().max(2000),
  number: () => z.number(),
  boolean: () => z.boolean(),
}
const MAX_FIELDS = 20

const fieldSchema = z.object({
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  description: z.string().max(200).optional(),
}).strict()

export const tableSchema = z.object({
  fields: z.record(z.string(), fieldSchema),
}).strict()

/** Validate a descriptor; throws a TypeError naming the bad part. */
export function parseTable(table) {
  const parsed = tableSchema.safeParse(table)
  if (!parsed.success) throw new TypeError(`crud: bad table: ${z.prettifyError(parsed.error)}`)
  const fields = parsed.data.fields
  const names = Object.keys(fields)
  if (names.length === 0 || names.length > MAX_FIELDS) throw new TypeError(`crud: a table needs 1-${MAX_FIELDS} fields`)
  for (const name of names) {
    if (!FIELD.test(name) || name === 'id') throw new TypeError(`crud: bad field name ${JSON.stringify(name)}`)
    const field = fields[name]
    if (field.default !== undefined && typeof field.default !== field.type) throw new TypeError(`crud: ${name}: default must be a ${field.type}`)
  }
  return parsed.data
}

/** Build the actions and initial state of a CRUD widget from its descriptor. */
export function crudActions(table) {
  const { fields } = parseTable(table)
  const create = {}
  const patch = {}
  for (const [name, field] of Object.entries(fields)) {
    const base = TYPES[field.type]()
    create[name] = field.required ? base : field.default !== undefined ? base.default(field.default) : base.optional()
    patch[name] = base.optional()
  }
  const rows = (state) => (Array.isArray(state?.rows) ? state.rows : [])
  const id = z.string().min(1).max(64)

  const actions = [
    {
      name: 'list',
      kind: 'query',
      description: 'All rows: { rows: [{ id, ...fields }] }.',
      handler: (_args, w) => ({ rows: rows(w.state) }),
    },
    {
      name: 'add',
      kind: 'mutation',
      description: 'Add one row. Returns the new row with its id.',
      args: z.object(create).strict(),
      handler: async (args, w) => {
        const row = { id: randomUUID().slice(0, 8), ...args }
        await w.update((state) => ({ ...state, rows: [...rows(state), row] }))
        return row
      },
    },
    {
      name: 'update',
      kind: 'mutation',
      description: 'Change fields of one row by id. Returns the row, or null when no row has that id.',
      args: z.object({ id, ...patch }).strict(),
      handler: async ({ id: key, ...changes }, w) => {
        let found = null
        await w.update((state) => ({
          ...state,
          rows: rows(state).map((row) => (row.id === key ? (found = { ...row, ...changes }) : row)),
        }))
        return found
      },
    },
    {
      name: 'remove',
      kind: 'mutation',
      description: 'Remove one row by id. Returns { id, removed }.',
      args: z.object({ id }).strict(),
      handler: async ({ id: key }, w) => {
        let removed = false
        await w.update((state) => ({ ...state, rows: rows(state).filter((row) => (row.id === key ? !(removed = true) : true)) }))
        return { id: key, removed }
      },
    },
  ]
  return { actions, initialState: { rows: [] } }
}
