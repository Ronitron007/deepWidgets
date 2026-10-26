import { randomUUID } from 'node:crypto'
import { z } from 'zod'

const FIELD = {
  string: () => z.string().max(1000),
  number: () => z.number(),
  boolean: () => z.boolean(),
}

/**
 * Turn a tiny schema into CRUD actions over one collection.
 * crudActions({ items: { text: 'string', done: 'boolean' } })
 *   -> list (query), add, toggle (first boolean field), remove (mutations).
 * State shape: { items: [{ id, ...fields }] }.
 */
export function crudActions(schema) {
  const names = Object.keys(schema)
  if (names.length !== 1) throw new TypeError('crud: schema needs exactly one collection')
  const collection = names[0]
  const fields = schema[collection]
  const shape = {}
  for (const [field, type] of Object.entries(fields)) {
    if (!(type in FIELD)) throw new TypeError(`crud: ${collection}.${field}: unknown type ${type}`)
    // Booleans default to false on add; other fields are required.
    shape[field] = type === 'boolean' ? FIELD[type]().default(false) : FIELD[type]()
  }
  const flag = Object.keys(fields).find((field) => fields[field] === 'boolean')
  const rows = (state) => state?.[collection] ?? []
  const id = z.object({ id: z.string().min(1) }).strict()

  const actions = [
    { name: 'list', kind: 'query', handler: (_args, w) => rows(w.state) },
    {
      name: 'add',
      kind: 'mutation',
      args: z.object(shape).strict(),
      handler: (args, w) => {
        const row = { id: randomUUID().slice(0, 8), ...args }
        return w.update((state) => ({ ...state, [collection]: [...rows(state), row] })).then(() => row)
      },
    },
    {
      name: 'remove',
      kind: 'mutation',
      args: id,
      handler: ({ id }, w) => w.update((state) => ({ ...state, [collection]: rows(state).filter((row) => row.id !== id) })).then(() => ({ id })),
    },
  ]
  if (flag !== undefined) {
    actions.splice(2, 0, {
      name: 'toggle',
      kind: 'mutation',
      args: id,
      handler: ({ id }, w) => w.update((state) => ({
        ...state,
        [collection]: rows(state).map((row) => row.id === id ? { ...row, [flag]: !row[flag] } : row),
      })).then((state) => state[collection].find((row) => row.id === id) ?? null),
    })
  }
  return { actions, initialState: { [collection]: [] } }
}
