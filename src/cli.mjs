import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { boot, createPlugin, formatSession, registryPath } from './host.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const [command, name] = process.argv.slice(2)

if (command === 'once') {
  const session = await boot(root)
  console.log(formatSession(session))
  session.dispose()
} else if (command === 'dev') {
  await dev()
} else if (command === 'create') {
  if (!name) {
    console.error('usage: npm run create -- <plugin-name>')
    process.exit(1)
  }
  const rel = createPlugin(root, name)
  console.log(`created ${rel}`)
  console.log('dev mode will load it on the next save')
} else {
  console.error('usage: npm run dev | npm run once | npm run create -- <plugin-name>')
  process.exit(1)
}

async function dev() {
  console.log('deepWidgets dev')
  console.log(`registry: ${registryPath(root)}`)
  console.log('edit registry.json to enable or disable a plugin. save a plugin file to reload.')
  let generation = 0
  let current = null
  let timer = null

  const reload = async () => {
    const mine = ++generation
    current?.dispose()
    current = null
    try {
      const next = await boot(root)
      if (mine !== generation) {
        next.dispose()
        return
      }
      current = next
      console.log(`\n--- reload ${mine} ---`)
      console.log(formatSession(next))
    } catch (err) {
      if (mine !== generation) return
      console.error(`\n--- reload ${mine} ---`)
      console.error(err instanceof Error ? err.message : String(err))
    }
  }

  const schedule = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      void reload()
    }, 40)
  }

  // Stat polling, not fs.watch. A recursive watch in this repo hits the
  // process file-descriptor cap and kills the dev process.
  let previous = fingerprint(root)
  const poll = setInterval(() => {
    const next = fingerprint(root)
    if (next === previous) return
    previous = next
    schedule()
  }, 150)

  const stop = () => {
    clearTimeout(timer)
    clearInterval(poll)
    generation += 1
    current?.dispose()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  await reload()
}

function fingerprint(dir) {
  const files = [registryPath(dir)]
  const pluginsDir = path.join(dir, 'plugins')
  if (fs.existsSync(pluginsDir)) collectFiles(pluginsDir, files)
  return files
    .map((file) => {
      try {
        return `${file}:${fs.statSync(file).mtimeMs}`
      } catch {
        return `${file}:missing`
      }
    })
    .join('\n')
}

function collectFiles(dir, into) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) collectFiles(abs, into)
    else if (entry.isFile()) into.push(abs)
  }
}
