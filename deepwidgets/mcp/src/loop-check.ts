/**
 * The endless-loop rule of the lint gate (`widget_phase2.creation.gates`). It refuses a loop with
 * no test or a constant true test whose body has no `break` of that loop, `return`, or `throw`. Such a loop
 * blocks the host. A loop with a real condition passes; the test run catches one that does not end.
 *
 * The rule walks the TypeScript syntax tree in this process. An oxlint JS plugin is not used: the
 * desktop host runs Node through Electron, and oxlint JS plugins crash there (exit 133).
 * @module @deepwidgets/mcp/loop-check
 */
import ts from 'typescript'

/**
 * True when `node` holds a statement that leaves the loop whose body it is. A nested function does
 * not count. An unlabeled `break` counts only when no `switch` or loop sits between it and the loop.
 * A labeled `break` counts only when its label is not declared inside the loop.
 * @param depth - the number of `switch` statements and loops between `node` and the loop.
 * @param inner - the labels declared inside the loop.
 */
function hasExit(node: ts.Node, depth = 0, inner: ReadonlySet<string> = new Set()): boolean {
  if (ts.isBreakStatement(node)) return node.label === undefined ? depth === 0 : !inner.has(node.label.text)
  if (ts.isReturnStatement(node) || ts.isThrowStatement(node)) return true
  if (ts.isFunctionLike(node) || ts.isClassLike(node)) return false
  const nextDepth = ts.isIterationStatement(node, false) || ts.isSwitchStatement(node) ? depth + 1 : depth
  const nextInner = ts.isLabeledStatement(node) ? new Set([...inner, node.label.text]) : inner
  return ts.forEachChild(node, (child) => hasExit(child, nextDepth, nextInner) ? true : undefined) === true
}

function endless(test: ts.Expression | undefined): boolean {
  if (test === undefined) return true
  const inner = ts.isParenthesizedExpression(test) ? test.expression : test
  if (inner.kind === ts.SyntaxKind.TrueKeyword) return true
  return ts.isNumericLiteral(inner) && Number(inner.text) !== 0
}

/**
 * Find the endless loops of one file.
 * @param fileName - the path that the diagnostics name. Its extension sets the script kind.
 * @param text - the TypeScript or JavaScript source.
 * @returns one `file:line:column: text` line for each endless loop.
 */
export function endlessLoops(fileName: string, text: string): string[] {
  // The script kind comes from the extension: `.ts`, `.mts`, `.cts`, `.tsx`, `.js`, and the rest.
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true)
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
