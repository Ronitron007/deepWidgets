#!/usr/bin/env node
/**
 * The import boundary of the widget page (`agent_library.main_split`, `agent_library.rules`).
 * Exit 0 only when:
 * - each import of the core (deepwidgets/widget-kit/src) is a file inside the core, or one of CORE_PACKAGES.
 *   Thus the core imports no component library, no shell file, and no `library.tsx`.
 * - the shell (deepwidgets/shell/src and scripts) reaches the core only through the bare name `@deepwidgets/widget-kit`.
 * - the shell entry imports `@deepwidgets/widget-kit`.
 * Before it reads the files, the check runs itself on two bad files and exits 1 if it does not find them.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import ts from 'typescript'

const ROOT = resolve(import.meta.dirname, '..')
const CORE = join(ROOT, 'deepwidgets', 'widget-kit', 'src')
const SHELL = [join(ROOT, 'deepwidgets', 'shell', 'src'), join(ROOT, 'deepwidgets', 'shell', 'scripts')]
const SHELL_ENTRY = join(ROOT, 'deepwidgets', 'shell', 'src', 'main.tsx')
const KIT = '@deepwidgets/widget-kit'

/** The packages that the core may import. None of them is a component library. */
const CORE_PACKAGES = new Set(['react', 'react/jsx-runtime', 'react-dom/client', '@openuidev/react-lang'])

const inside = (dir, file) => file === dir || file.startsWith(dir + sep)

/** The import specifiers of one source text: static, dynamic, `export ... from`, and side-effect imports. */
function specifiers(text) {
  return ts.preProcessFile(text, true, true).importedFiles.map((file) => file.fileName)
}

/** The problems of one core file. */
function coreProblems(file, text) {
  return specifiers(text).flatMap((spec) => {
    if (spec.startsWith('.')) {
      const target = resolve(dirname(file), spec)
      return inside(CORE, target) ? [] : [`core imports a file outside the core: ${spec}`]
    }
    return CORE_PACKAGES.has(spec) ? [] : [`core imports a package outside CORE_PACKAGES: ${spec}`]
  })
}

/** The problems of one shell file. */
function shellProblems(file, text) {
  return specifiers(text).flatMap((spec) => {
    if (spec.startsWith('.')) {
      const target = resolve(dirname(file), spec)
      return inside(CORE, target) || inside(join(ROOT, 'deepwidgets', 'widget-kit'), target)
        ? [`shell imports a core file by path: ${spec}`] : []
    }
    return spec.startsWith(`${KIT}/`) ? [`shell imports a core subpath: ${spec}`] : []
  })
}

function files(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:ts|tsx|mts|js|mjs|jsx)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name))
}

// The self-test: a core file that imports the default library, and a shell file that imports the core by path.
const selfTest = [
  coreProblems(join(CORE, 'index.tsx'), "import { widgetLibrary } from '../../shell/src/library.tsx'"),
  coreProblems(join(CORE, 'index.tsx'), "import { Button } from '@radix-ui/react-slot'"),
  shellProblems(SHELL_ENTRY, "import { openChannel } from '../../widget-kit/src/channel.ts'"),
]
if (selfTest.some((problems) => problems.length === 0)) {
  console.error('widget-kit-imports: the self-test did not find a bad import')
  process.exit(1)
}

const problems = []
for (const file of files(CORE)) {
  for (const problem of coreProblems(file, readFileSync(file, 'utf8'))) problems.push(`${relative(ROOT, file)}: ${problem}`)
}
for (const dir of SHELL) {
  for (const file of files(dir)) {
    for (const problem of shellProblems(file, readFileSync(file, 'utf8'))) problems.push(`${relative(ROOT, file)}: ${problem}`)
  }
}
if (!specifiers(readFileSync(SHELL_ENTRY, 'utf8')).includes(KIT)) problems.push(`${relative(ROOT, SHELL_ENTRY)}: does not import ${KIT}`)

if (problems.length > 0) {
  for (const problem of problems) console.error(`widget-kit-imports: ${problem}`)
  process.exit(1)
}
console.log(`widget-kit-imports: ok (${String(files(CORE).length)} core files, ${String(SHELL.flatMap(files).length)} shell files)`)
