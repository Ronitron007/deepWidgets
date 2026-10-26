import { readFileSync } from 'node:fs'
import { createParser } from '@openuidev/lang-core'

/** The shell's component catalog, exported from the shell build (integration/catalog/build.mjs in the overnight scratchpad). */
const catalog = JSON.parse(readFileSync(new URL('./catalog/catalog.json', import.meta.url), 'utf8'))
export const CATALOG_ID = catalog.id
const parser = createParser(catalog.schema, catalog.root)

const toolOf = (info) => (info.toolAST?.k === 'Str' ? info.toolAST.v : null)

/**
 * Check one program against the catalog and the widget's actions.
 * Drift = a Query/Mutation names a tool the widget does not declare, or a
 * Query names a mutation (and the reverse). Parse errors (lang-core: unknown
 * component, bad args, unresolved refs) are reported, not thrown.
 * @returns {{ ok: boolean, errors: object[], drift: object[], queries: string[], mutations: string[] }}
 */
export function checkProgram(text, actions) {
  const errors = []
  const drift = []
  let result
  try {
    result = parser.parse(text)
  } catch (error) {
    return { ok: false, errors: [{ code: 'parse-failed', message: String(error?.message ?? error) }], drift, queries: [], mutations: [] }
  }
  for (const e of result.meta?.errors ?? []) errors.push({ code: e.code, statementId: e.statementId, message: e.message })
  for (const u of result.meta?.unresolved ?? []) errors.push({ code: 'unresolved', message: `unresolved reference ${u}` })
  if (result.root == null) errors.push({ code: 'no-root', message: 'program has no root statement' })
  const check = (list, kind) => list.map((info) => {
    const tool = toolOf(info)
    if (tool === null) drift.push({ statementId: info.statementId, code: 'dynamic-tool-name', message: `${kind} tool name must be a string literal` })
    else if (!actions.has(tool)) drift.push({ statementId: info.statementId, code: 'unknown-action', tool, message: `${kind}("${tool}") names no declared action` })
    else if (actions.get(tool).kind !== kind.toLowerCase()) drift.push({ statementId: info.statementId, code: 'wrong-kind', tool, message: `${kind}("${tool}") but ${tool} is a ${actions.get(tool).kind}` })
    return tool
  })
  const queries = check(result.queryStatements ?? [], 'Query')
  const mutations = check(result.mutationStatements ?? [], 'Mutation')
  return { ok: errors.length === 0 && drift.length === 0, errors, drift, queries, mutations }
}
