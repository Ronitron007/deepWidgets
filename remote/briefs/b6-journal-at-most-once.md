# b6: make the durable bridge journal at-most-once (Codex review mr-logs/codex-review-real-journal.md)

Code: `bridge/src/journal.ts` (opt-in `file`), `bridge/src/main.ts` (wiring). Keep the memory-only default unchanged.

## Changes (file mode only unless noted)

1. **Reserve before dispatch.** When `file` is set, before calling `exec`, persist a pending row `{ key, ah, at, pending: true }`
   synchronously. When the run ends: kept value -> finished row (as today); not kept or rejected -> remove the row and persist.
2. **Pending rows after a restart.** On load, a pending row is an operation whose outcome is unknown. A retry with the same
   args hash must NOT run `exec`; it returns `opts.unknown` (new option). A different args hash -> `conflict`. Pending rows
   expire with the ttl like the others.
3. **Never evict in-flight or pending entries in `prune` (both modes).** Capacity pruning drops only the oldest finished
   entries; if only in-flight/pending entries remain over `max`, keep them (size may exceed max) .
4. **Safer file I/O.** Refuse to load a file over 8 MiB (start empty and keep working, never throw). Write the temp file with a
   unique name in the same directory (`<file>.<pid>.<random>.tmp`), flag `wx`, mode 0600, `fsyncSync` it before rename. Keep
   all write errors swallowed. Validate row fields on load (strings up to 512 chars for key/ah; finite `at`).
5. `main.ts`: pass `unknown` = an ok LocalResult whose structuredContent is
   `{ error: { code: 'outcome-unknown', message: 'This requestId was sent before the bridge restarted and its outcome is unknown.', nextStep: 'Read the state with widget_describe before deciding; do not resend this requestId for a new operation.' } }`
   with `isError: true` and the same object as JSON text in `content`.
6. Module comment: describe at-most-once in file mode and the remaining window (a crash after the pending write and before the
   local call still blocks a retry as unknown, which is the safe side).

## Tests (`journal-atmostonce.mr.spec.ts`)

- Pending row survives a "restart" (second journal on the same file): retry gets `unknown`, exec not called; other args -> conflict.
- A run that ends not-kept removes its pending row (second journal runs exec again).
- prune never drops an in-flight entry even past `max` (memory mode too).
- An oversized file (> 8 MiB) loads as empty without throwing; malformed rows are skipped.
- Existing journal and journal-durable specs still pass.

Gates: `npm run typecheck`, `npx vitest run`. Do not touch worker/, e2e/ or real/.
