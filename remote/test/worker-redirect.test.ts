import { describe, expect, it } from 'vitest'
import { redirectProblem } from '../worker/src/core.ts'

describe('loopback redirect policy (Codex hardening review)', () => {
  for (const uri of ['http://127.0.0.1:8080/cb', 'https://localhost./cb', 'https://[::ffff:127.0.0.1]/cb', 'https://[::1]/cb', 'http://app.localhost/cb']) {
    it(`${uri} needs the opt-in`, () => {
      expect(redirectProblem(uri, false)).toMatch(/loopback/)
      expect(redirectProblem(uri, true)).toBeNull()
    })
  }
  it('a public https callback passes and a public http one does not', () => {
    expect(redirectProblem('https://claude.ai/api/mcp/auth_callback', false)).toBeNull()
    expect(redirectProblem('http://example.com/cb', false)).toMatch(/https/)
  })
})
