# b5: make the bridge's operation journal survive a bridge restart (opt-in file)

Context: `bridge/src/journal.ts` runs a `widget_call` with a `requestId` once per (grant id, requestId), in memory.
The real deepWidgets app keys its own requestId store by (caller, requestId), and the bridge gets a new caller id at
every local handshake, so after a BRIDGE restart a retry of the same requestId applies the write again (proven against
the real app: mr-logs/real-pilot/evidence-1.json step 6). Close that gap at the PC, without the cloud holding results.

## Change

1. `createJournal(opts)` gets an optional `file?: string` and `lost?: unknown`.
   - When `file` is set: at creation, read the file synchronously (missing file = empty; unreadable or bad JSON =
     start empty and do not crash; entries older than ttl are dropped). Loaded entries are finished runs: a retry with
     the same args hash gets the stored value; a different args hash gets `conflict`.
   - After a run ends with `keep(value) === true`, write all finished entries to the file atomically
     (write `<file>.tmp` with mode 0600, then rename). Store the value only if its JSON is at most 16 KiB; otherwise
     store no value, and a replay of that entry returns `opts.lost`.
   - In-flight runs are never written. A crash between the local apply and the write is still possible; say so in
     the module comment.
   - Writes must not throw into the caller: a failed write is ignored (the in-memory journal still works).
2. `bridge/src/main.ts`: new option `journalFile?: string` in `BridgeOptions`, env `DW_JOURNAL_FILE`. Default: unset
   keeps today's memory-only journal. When set, guard the path with `checkKillFile(file, dshHome)` like the deny-list
   (it must not be under `$DSH_HOME/deepwidgets`). Pass `lost` = an ok LocalResult whose `structuredContent` is
   `{ replayed: true, resultLost: true, nextStep: 'This requestId already ran; its answer was not kept. Read the state with widget_describe.' }`
   and whose `content` is the same object as JSON text.
3. README Bridge section: one bullet for `DW_JOURNAL_FILE`.

## Tests (vitest, `test/journal-durable.test.ts`)

- Two journals on the same file (simulating a bridge restart): the second replays the first's value and does not run exec.
- Same requestId with other args after restart: `conflict`, exec not run.
- A value over 16 KiB: replay after restart returns `lost`.
- The file has mode 0600; a corrupt file gives an empty journal without throwing; expired entries are not loaded.
- `startBridge` with `journalFile` under `$DSH_HOME/deepwidgets` throws.

## Gates

`npm run typecheck` and `npx vitest run` pass; do not change other behaviour; do not touch e2e/ or worker/.
