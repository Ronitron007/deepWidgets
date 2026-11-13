import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { isCheckBuild, pageFile } from '../src/deepwidgets-page-path.ts'

/**
 * A widget folder with a build, a build that the gates still run on, the link `page`, a file outside the folder of
 * the slug, and links in the builds that point outside it.
 */
function fixture() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'dw-page-path-')))
  const slugDir = join(base, 'deepwidgets-widgets', 'demo')
  const build = join(slugDir, 'page-0123456789abcdef')
  const tmp = join(slugDir, 'page-fedcba9876543210.tmp')
  mkdirSync(build, { recursive: true })
  mkdirSync(tmp, { recursive: true })
  writeFileSync(join(build, 'index.html'), 'build')
  writeFileSync(join(tmp, 'index.html'), 'tmp')
  writeFileSync(join(base, 'secret.txt'), 'outside')
  symlinkSync(join(base, 'secret.txt'), join(tmp, 'leak.txt'))
  symlinkSync(join(base, 'secret.txt'), join(build, 'leak.txt'))
  symlinkSync(tmp, join(build, 'into-tmp'))
  symlinkSync('page-0123456789abcdef', join(slugDir, 'page'))
  return { base, slugDir, build, tmp }
}

describe('pageFile (agent_library.build_gate)', () => {
  const { base, slugDir, build, tmp } = fixture()
  afterAll(() => { rmSync(base, { recursive: true, force: true }) })

  it('serves index.html of a check build, and a file through the link page', async () => {
    expect(await pageFile(tmp, '', true)).toEqual({ file: join(tmp, 'index.html') })
    expect(await pageFile(join(slugDir, 'page'), 'index.html', false)).toEqual({ file: join(build, 'index.html') })
  })

  it('refuses a path with .. that leaves the page folder', async () => {
    expect(await pageFile(tmp, '../page-0123456789abcdef/index.html', true)).toEqual({ status: 403 })
  })

  it('refuses a link that resolves outside the folder of the slug', async () => {
    expect(await pageFile(tmp, 'leak.txt', true)).toEqual({ status: 403 })
    expect(await pageFile(join(slugDir, 'page'), 'leak.txt', false)).toEqual({ status: 403 })
  })

  it('refuses a .tmp build outside the render check', async () => {
    expect(await pageFile(tmp, 'index.html', false)).toEqual({ status: 403 })
    expect(await pageFile(join(slugDir, 'page'), 'into-tmp/index.html', false)).toEqual({ status: 403 })
  })

  it('answers 404 for a missing file', async () => {
    expect(await pageFile(tmp, 'none.js', true)).toEqual({ status: 404 })
  })

  it('takes only a .tmp build of the slug for a check', () => {
    expect(isCheckBuild(tmp, 'demo')).toBe(true)
    expect(isCheckBuild(tmp, 'other')).toBe(false)
    expect(isCheckBuild(build, 'demo')).toBe(false)
  })
})
