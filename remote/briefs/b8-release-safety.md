# b8: two small safety fixes to the durable journal (Codex review mr-logs/codex-review-real-b7.md)

1. `bridge/src/main.ts:45`: remove `'timeout'` from `PRE_WRITE_CODES`. The real host's `timeout` covers only the current run's
   writes; a cross-widget update may already have committed, so a `timeout` keeps the reservation (retry -> outcome-unknown).
2. `bridge/src/journal.ts` (~line 150): in file mode, when `run` is called WITHOUT a `release` callback, keep the pending row
   after a not-kept or rejected end (retry -> `unknown`), i.e. release only on an affirmative `release(...) === true`.
   Memory-only mode keeps today's behaviour (drop). Update the module comment.

Tests (`journal-release.mr.spec.ts`): file mode without release keeps the row after a not-kept end (same-process retry and
restart retry both get `unknown`, exec called once); memory mode without release still drops; a tool error with code
`timeout` no longer releases (unit-test the exported predicate, export `PRE_WRITE_CODES` or a `releasesReservation(result)`
helper from main.ts). Update existing specs only where they assumed the old default. Gates: typecheck, vitest. Do not touch worker/, e2e/, real/.
