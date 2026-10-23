import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createWidget } from './widget.mjs'

const ID = /^[a-z][a-z0-9-]{0,31}$/

export function registryPath(root) {
  return path.join(root, 'registry.json')
}

export function readRegistry(root) {
  const file = registryPath(root)
  let parsed
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    throw new Error(`registry.json: ${err.message}`)
  }
  if (!parsed || !Array.isArray(parsed.plugins)) {
    throw new Error('registry.json must contain a plugins array')
  }
  const seen = new Set()
  const plugins = parsed.plugins.map((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`plugins[${index}] must be an object`)
    }
    if (typeof row.id !== 'string' || !ID.test(row.id)) {
      throw new Error(`plugins[${index}].id must match ${ID}`)
    }
    if (seen.has(row.id)) throw new Error(`duplicate plugin id ${row.id}`)
    seen.add(row.id)
    if (typeof row.path !== 'string' || row.path.length === 0) {
      throw new Error(`plugins[${index}].path is required`)
    }
    return {
      id: row.id,
      path: row.path,
      enabled: row.enabled !== false,
    }
  })
  return { plugins }
}

export function resolveInside(root, rel) {
  const abs = path.resolve(root, rel)
  const fromRoot = path.relative(root, abs)
  if (fromRoot === '' || fromRoot.startsWith('..') || path.isAbsolute(fromRoot)) {
    throw new Error(`plugin path escapes the host: ${rel}`)
  }
  return abs
}

export async function boot(root) {
  const registry = readRegistry(root)
  const widget = createWidget()
  const loaded = []
  const errors = []

  for (const row of registry.plugins) {
    if (!row.enabled) continue
    try {
      const abs = resolveInside(root, row.path)
      const href = `${pathToFileURL(abs).href}?v=${Date.now()}-${Math.random()}`
      const mod = await import(href)
      if (typeof mod.apply !== 'function') {
        throw new Error('plugin must export apply(ctx)')
      }
      const dispose = await mod.apply({ widget, plugin: row })
      loaded.push({
        id: row.id,
        name: typeof mod.name === 'string' ? mod.name : row.id,
        dispose: typeof dispose === 'function' ? dispose : () => {},
      })
    } catch (err) {
      errors.push({ id: row.id, message: err instanceof Error ? err.message : String(err) })
    }
  }

  return {
    widget,
    loaded,
    errors,
    dispose() {
      for (const plugin of loaded.reverse()) {
        try {
          plugin.dispose()
        } catch (err) {
          errors.push({
            id: plugin.id,
            message: err instanceof Error ? err.message : String(err),
          })
        }
      }
    },
  }
}

export function createPlugin(root, name) {
  if (!ID.test(name)) {
    throw new Error(`plugin name must match ${ID}`)
  }
  const rel = path.join('plugins', name, 'index.mjs')
  const abs = resolveInside(root, rel)
  if (fs.existsSync(abs)) throw new Error(`plugin already exists: ${rel}`)

  const registry = readRegistry(root)
  if (registry.plugins.some((row) => row.id === name)) {
    throw new Error(`registry already has id ${name}`)
  }

  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, pluginSource(name))
  registry.plugins.push({ id: name, path: rel.split(path.sep).join('/'), enabled: true })
  fs.writeFileSync(registryPath(root), `${JSON.stringify({ plugins: registry.plugins }, null, 2)}\n`)
  return rel
}

function pluginSource(name) {
  return `export const name = '${name}'

// ctx.widget methods: setStatus(text), setMood(mood),
// pushStat({ id, label, value, unit }), clearStat(id), showToast(message).
// Return a function to clear timers when dev mode reloads this plugin.
export function apply(ctx) {
  ctx.widget.pushStat({ id: '${name}', label: '${name}', value: 1 })
}
`
}

export function formatSession(session) {
  const snap = session.widget.snapshot()
  const lines = [
    `plugins: ${session.loaded.map((plugin) => plugin.id).join(', ') || '(none)'}`,
    `status: ${snap.status || '(empty)'}`,
    `mood: ${snap.mood}`,
  ]
  if (snap.stats.length === 0) {
    lines.push('stats: (none)')
  } else {
    lines.push('stats:')
    for (const stat of snap.stats) {
      const unit = stat.unit ? ` ${stat.unit}` : ''
      lines.push(`  ${stat.label}: ${stat.value}${unit}`)
    }
  }
  if (snap.toasts.length > 0) {
    lines.push(`toasts: ${snap.toasts.join(' | ')}`)
  }
  if (session.errors.length > 0) {
    lines.push('failed:')
    for (const error of session.errors) {
      lines.push(`  ${error.id}: ${error.message}`)
    }
  }
  return lines.join('\n')
}
