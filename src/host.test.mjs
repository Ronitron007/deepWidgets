import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { boot, createPlugin, readRegistry } from './host.mjs'

function tempHost() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-host-'))
  fs.mkdirSync(path.join(root, 'plugins', 'alpha'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'plugins', 'alpha', 'index.mjs'),
    `export function apply(ctx) {
      ctx.widget.setStatus('alpha')
      ctx.widget.pushStat({ id: 'alpha', label: 'Alpha', value: 1 })
    }
`,
  )
  fs.mkdirSync(path.join(root, 'plugins', 'beta'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'plugins', 'beta', 'index.mjs'),
    `export function apply(ctx) {
      ctx.widget.pushStat({ id: 'beta', label: 'Beta', value: 2 })
    }
`,
  )
  fs.writeFileSync(
    path.join(root, 'registry.json'),
    JSON.stringify({
      plugins: [
        { id: 'alpha', path: 'plugins/alpha/index.mjs', enabled: true },
        { id: 'beta', path: 'plugins/beta/index.mjs', enabled: true },
      ],
    }),
  )
  return root
}

test('registry enabled flags decide which plugins apply', async () => {
  const root = tempHost()
  const first = await boot(root)
  assert.deepEqual(
    first.widget.snapshot().stats.map((stat) => stat.id),
    ['alpha', 'beta'],
  )
  assert.equal(first.widget.snapshot().status, 'alpha')
  first.dispose()

  const registry = readRegistry(root)
  registry.plugins[1].enabled = false
  fs.writeFileSync(path.join(root, 'registry.json'), JSON.stringify(registry))
  const second = await boot(root)
  assert.deepEqual(
    second.widget.snapshot().stats.map((stat) => stat.id),
    ['alpha'],
  )
  second.dispose()
})

test('a broken plugin does not drop the others', async () => {
  const root = tempHost()
  fs.writeFileSync(path.join(root, 'plugins', 'beta', 'index.mjs'), 'export const name = "beta"\n')
  const session = await boot(root)
  assert.deepEqual(
    session.widget.snapshot().stats.map((stat) => stat.id),
    ['alpha'],
  )
  assert.equal(session.errors.length, 1)
  assert.match(session.errors[0].message, /apply/)
  session.dispose()
})

test('create adds an enabled registry row and a plugin file', async () => {
  const root = tempHost()
  const rel = createPlugin(root, 'gamma')
  assert.equal(fs.existsSync(path.join(root, rel)), true)
  const registry = readRegistry(root)
  assert.deepEqual(registry.plugins.at(-1), {
    id: 'gamma',
    path: 'plugins/gamma/index.mjs',
    enabled: true,
  })
  const session = await boot(root)
  assert.ok(session.widget.snapshot().stats.some((stat) => stat.id === 'gamma'))
  session.dispose()
})
