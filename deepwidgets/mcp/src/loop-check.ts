/**
 * The endless-loop rule of the lint gate (`widget_phase2.creation.gates`). It refuses a loop with
 * no test or a constant true test whose body has no `break`, `return`, or `throw`. Such a loop
 * blocks the host. A loop with a real condition passes; the test run catches one that does not end.
 *
 * The rule walks the TypeScript syntax tree in this process. An oxlint JS plugin is not used: the
 * desktop host runs Node through Electron, and oxlint JS plugins crash there (exit 133).
 * @module @deepwidgets/mcp/loop-check
 */
import ts from 'typescript'

/** True when `node` holds a statement that leaves the loop. A nested function does not count. */
function hasExit(node: ts.Node): boolean {
  if (ts.isBreakStatement(node) || ts.isReturnStatement(node) || ts.isThrowStatement(node)) return true
  if (ts.isFunctionLike(node) || ts.isClassLike(node)) return false
  return ts.forEachChild(node, (child) => hasExit(child) ? true : undefined) === true
}

function endless(test: ts.Expression | undefined): boolean {
  if (test === undefined) return true
  const inner = ts.isParenthesizedExpression(test) ? test.expression : test
  if (inner.kind === ts.SyntaxKind.TrueKeyword) return true
  return ts.isNumericLiteral(inner) && Number(inner.text) !== 0
}

/**
 * Find the endless loops of one file.
 * @param fileName - the path that the diagnostics name.
 * @param text - the TypeScript source.
 * @returns one `file:line:column: text` line for each endless loop.
 */
export function endlessLoops(fileName: string, text: string): string[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if ((ts.isWhileStatement(node) || ts.isDoStatement(node) || ts.isForStatement(node)) && endless(ts.isForStatement(node) ? node.condition : node.expression) && !hasExit(node.statement)) {
      const { line, character } = source.getLineAndCharacterOfPosition(node.getStart(source))
      found.push(`${fileName}:${String(line + 1)}:${String(character + 1)}: endless loop: this loop has no exit and blocks the host. Use ctx.interval for repeated work. [Error/deepwidgets(no-endless-loop)]`)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}
