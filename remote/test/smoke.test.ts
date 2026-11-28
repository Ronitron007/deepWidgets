import { expect, it } from 'vitest'

it('runs on node 24 or newer', () => {
  expect(Number(process.versions.node.split('.')[0])).toBeGreaterThanOrEqual(24)
})
