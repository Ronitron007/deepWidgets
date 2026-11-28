# E2E results

Run: 28 Nov 2026, 22:40 IST, `npx vitest run --config vitest.e2e.config.ts --reporter=verbose` (the same suite as `npm run e2e`).
Setup: Node 24, wrangler 4.169.0 (`wrangler dev --ip 127.0.0.1 --port <free> --persist-to <tmp>`), stub on a free loopback port, bridge in process, MCP SDK 1.32.2 client with a pre-registered public client and the owner passcode consent flow. Fresh Ed25519 key pair, 128-bit passcode and device credential for each run, written only to a temp copy of `worker/`.

```text
✓ e2e/run.test.ts > first pilot (product direction) > client B (read only) and client A (read and call) have different rights on the same widget 182ms
 ✓ e2e/run.test.ts > first pilot (product direction) > a retry of the same requestId and args after a lost response is applied once 34ms
 ✓ e2e/run.test.ts > first pilot (product direction) > the same requestId with different args is refused and applies nothing 10ms
 ✓ e2e/run.test.ts > first pilot (product direction) > a retry after a host restart is still applied once (the bridge holds the operation id, not the local caller) 29ms
 ✓ e2e/run.test.ts > first pilot (product direction) > revoking client B during a host restart refuses B at once and leaves client A working 72ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > OAuth gave tokens to the pre-registered client and tools/list is exactly the four interact tools 7ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > widget_call groceries add succeeds and reaches the stub as a remote agent 21ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > reads are limited to the granted widgets 38ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > never-remote tools are absent, a direct tools/call fails, and the stub never sees them 59ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > /mcp/token on the Worker is 401 without a token and 404 with one 8ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > no other /mcp/* path is forwarded: /mcp/anything and /mcp/ are 404 with a valid token 12ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > /admin/clients refuses a loopback redirect URI unless allowLoopback is true 9ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > discovery has no registration_endpoint and POST /register is not 2xx 5ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > a request with a foreign Origin is refused by the MCP handler 3ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > a wrong passcode issues no code 14ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > a call still works after 15 s idle (hibernation keeps the bridge authenticated) 15033ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > cloud kill gives remote-disabled; turning it off restores calls 1138ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > the local kill file gives killed-locally; settings.json flips change neither kill state nor allowlist 49ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > the audit log has call rows without args 5ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > stopping the bridge gives device-offline in under 2 s 314ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > revoking the grant refuses the next call at once and refresh fails 47ms
 ✓ e2e/run.test.ts > relay end to end (wrangler dev) > five wrong passcodes on /admin lock out the next correct one with 429 26ms
 Test Files  1 passed (1)
      Tests  22 passed (22)
   Duration  19.07s (transform 106ms, setup 0ms, collect 252ms, tests 18.65s, environment 0ms, prepare 52ms)
```

## Notes

- Revoke: the admin endpoint writes the DO revoked set first, then calls the provider's `revokeGrant`. Local KV drops the access token at once, so in `wrangler dev` the provider refuses the next call (401, then the refresh fails with `invalid_grant`) before the DO answers `grant-revoked`. The test accepts either refusal and checks that the call never reached the stub and that the DO recorded `grant-revoked` for the grant. The DO path matters in production, where KV deletes take time to reach every location.
- Hibernation: the test idles 15 s and calls again. It shows that auth survives an idle period; it does not prove that `wrangler dev` evicted the object.
- Not covered end to end: the 409 for a second bridge while the first one is live (needs a 20 s ping first), `device-timeout` (30 s), and `/__stub/fault` 502/503 (part 1 has no fault hook, so those tests are skipped as the brief allows).
- Post-deploy proof is `e2e/remote-smoke.ts`; it was not run here (no deployment).

## Hardening round (MUST-FIX 2-5 from CRITIQUE-code-sonnet.md), 2026-11-28 21:07 IST

- `npm run typecheck`: clean (root + worker).
- `npx vitest run`: 8 files, 91 tests passed (adds worker-hardening and bridge-hardening acceptance specs written by mr's Opus planner, task t-0dc25530).
- `npm run e2e`: 17 passed, including the new "no other /mcp/* path is forwarded" and "/admin/clients refuses a loopback redirect URI unless allowLoopback is true".
- Pilot tests (`first pilot`): two clients with different rights, a retry applied once, same id with other args refused, a retry after a host restart applied once, and revoking a client during a restart.
- Cloud kill now also closes the bridge socket and the relay refuses reconnects until it is turned off; the kill test waits for the bridge to come back.
- Live smoke on workers.dev (28 Nov 2026, after the Codex fixes): OAuth, four tools, one write, kill dropped the bridge and it reconnected within 5 s of turning kill off. Output in `mr-logs/remote-smoke-2.out`.
