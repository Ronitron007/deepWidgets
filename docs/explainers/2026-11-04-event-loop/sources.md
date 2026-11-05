# Sources of the explainer, version 2 `explainer_loop.sources`

Each claim of `narration.md` and of the visuals in `script.md` has a row here. Labels:

- verified (read): the file and line on branch `rohan/explainer-event-loop-2026-11-04` at `3bc10af2`, or the web page and section in the row. The web pages were read on 2026-11-04 for `research.md` and the prior-art ladders.

- verified (ran): a command of `sources.runs`. This session ran it on 2026-11-05.

- verified (ran, earlier video): a check that the video of 2026-11-02 ran at `108d663f`. Version 1 (`7e1c1c35`, `sources.reuse`) confirmed that the watchdog, records, supervisor, and crash policy files did not change from `108d663f` to `68aabd9a`.

- inferred: it follows from the code or the docs, but nothing ran it.

The code base did not change since version 1: `git diff --stat 68aabd9a 3bc10af2` lists only the explainer files (15 files, all under `docs/explainers/`). Thus the code line numbers of version 1 still hold.

Path short names: `ISO` `deepwidgets/widgets/src/isolation.ts`, `REC` `deepwidgets/widgets/src/records.ts`, `WD` `deepwidgets/widgets/src/watchdog.ts`, `WDW` `deepwidgets/widgets/src/watchdog-worker.ts`, `WR` `deepwidgets/widgets/src/index.ts`, `SUP` `apps/desktop/src/deepwidgets-supervisor.ts`, `POL` `apps/desktop/src/deepwidgets-crash-policy.ts`, `BOOT` `packages/boot/app-boot/src/index.ts`, `PBOOT` `apps/cli/src/profile-boot.ts`, `WWS` `docs/explore/widget-system/where-we-stand.md`, `CHAT` `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/source-chat-btw.md`, `RES` `~/kyaloon-media/explainer-event-loop-2026-11-04/research.md`, `PA` `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/prior-art/`, `SN` `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/script-v2/snippets/`, `V1` the version 1 `sources.md` at `7e1c1c35`.

## Articles and credits `sources.articles`

The video names each article and its author on screen. The facts are paraphrased. The voice has one quote (`process_handlers`), under 15 words, from `src.node_process`. No other article is quoted.

| Short name | Source | Used in | Use |
|---|---|---|---|
| `pa.lydia_dev` | Lydia Hallie, "JavaScript Visualized: Event Loop", https://dev.to/lydiahallie/javascript-visualized-event-loop-3dif (2019, edited 2024) | `call_stack`, `event_loop` | the pancake pile; the stack, queue, and loop boxes |
| `pa.jvns_process` | Julia Evans, "what's in a process?", https://wizardzines.com/comics/processes/ | `process_pid` | process as a bundle of state |
| `pa.naz_signals` | Naz Quadri, "Signals: The Kernel's Text Messages", https://nazquadri.com/blog/the-layer-below/signals | `signals` | signal as a text message; SIGKILL runs no code of the target |
| `pa.man_signal` | Linux man-pages `signal(7)` | `signals` | SIGKILL cannot be caught, blocked, or ignored |
| `pa.jake_loop` | Jake Archibald, "In The Loop" (JSConf.Asia 2018), transcript https://andreaverlicchi.eu/blog/jake-archibald-in-the-loop-jsconf-asia-talk-transposed | `one_thread` | the main thread as a to-do list that cannot be paused |
| `src.jake_tasks` | Jake Archibald, "Tasks, microtasks, queues and schedules", https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/ | `microtasks` | microtasks run after the current code, before the next task |
| `pa.hromium` | HRomium, "The best visual explanation (probably) of the event loop in JavaScript", https://dev.to/hromium/the-best-visual-explanation-probably-of-the-event-loop-in-javascript-10pa (2025) | `task_queue` (visual) | one fixed shape for each kind of work |
| `pa.js_info` | Ilya Kantor, javascript.info "Event loop: microtasks and macrotasks", https://javascript.info/event-loop | `blocking` | count to one billion, then slices |
| `src.node_dont_block` | Node.js, "Don't Block the Event Loop (or the Worker Pool)", https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop | `blocking` | one thread for all callbacks; keep each callback short |
| `pa.jsinfo_try` | javascript.info, "Error handling, try...catch", https://javascript.info/try-catch | `try_stack` | try and catch work only for synchronous code |
| `pa.domenic` | Domenic Denicola, "You're Missing the Point of Promises", https://domenic.me/youre-missing-the-point-of-promises/ (2012) | `exception_vs_rejection` | rejection as the async twin of an exception |
| `pa.mdn_events` | Refactoring.Guru, "Observer", https://refactoring.guru/design-patterns/observer | `emitter_handler` | the publisher and its subscriber list |
| `src.node_events` | Node.js docs, Events, https://nodejs.org/api/events.html | `emitter_handler` | `emit` calls the listeners synchronously, in order |
| `src.node_process` | Node.js docs, process and CLI, https://nodejs.org/api/process.html, https://nodejs.org/api/cli.html | `uncaught_unhandled`, `process_handlers`, `limit_threshold` | the two events, the default exit, the default `throw` mode; the quote "It is not safe to resume normal operation after 'uncaughtException'." |
| `src.mdn_promise` | MDN, Promise, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise | `promise_not_process` | paraphrase only: promises stand for operations already in progress |
| `src.node_async_hooks` | Node.js docs, Async hooks, https://nodejs.org/api/async_hooks.html | `async_chain`, `handler_reads_store` | `asyncId`, `triggerAsyncId`; the `after` hook runs after `uncaughtException` |
| `src.node_async_context` | Node.js docs, Asynchronous context tracking, https://nodejs.org/api/async_context.html | `als` | `run`, `getStore`, `undefined` outside a run |
| `pa.react_context` | React team, "Passing Data Deeply with Context", https://react.dev/learn/passing-data-deeply-with-context | `als` | a provider value that every component below can read |
| `pa.clark_sab` | Lin Clark, "A cartoon intro to ArrayBuffers and SharedArrayBuffers", https://hacks.mozilla.org/2017/06/a-cartoon-intro-to-arraybuffers-and-sharedarraybuffers/ | `worker_thread` | threads as people at private desks |
| `pa.codingshuttle_threads` | Coding Shuttle, "Introduction to Concurrency: Threads vs Processes" | `worker_thread` | threads of one process share the heap |
| `pa.clark_atomics` | Lin Clark, "Avoiding race conditions in SharedArrayBuffers with Atomics", https://hacks.mozilla.org/2017/06/avoiding-race-conditions-in-sharedarraybuffers-with-atomics/ | `shared_memory` (visual) | the lost update and the indivisible step |
| `pa.wiki_watchdog` | Wikipedia, "Watchdog timer", https://en.wikipedia.org/wiki/Watchdog_timer | `heartbeat` | a timer that healthy code keeps resetting; a missing reset starts recovery |
| `src.candea_fox_2003` | George Candea and Armando Fox, "Crash-Only Software" (HotOS IX, 2003) | `crash_record` | stop equals crash, start equals recover |
| Fowler | Martin Fowler, "CircuitBreaker", https://martinfowler.com/bliki/CircuitBreaker.html (2014) | `quarantine` | stop calling a part that keeps failing |

## Runs `sources.runs`

All runs on 2026-11-05 on the operator Mac. The runner `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/script-v2/make_snippets.py` writes each snippet into `SN` and runs it with two runtimes. It writes `notes/script-v2/runs.log`.

| Runtime | Command | Version |
|---|---|---|
| `node` | `node SN/<file>` | v22.23.0 |
| `host` | `ELECTRON_RUN_AS_NODE=1 /Users/rohanmalik/deepWidgets/node_modules/.pnpm/electron@44.7.0_supports-color@9.4.0/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron SN/<file>` | Node v24.21.0, Electron 44.7.0 (the host runs this way, `V1` `sources.runs`) |

"Same" means that both runtimes printed the same text.

| Snippet | Scene | Exit | Output (`node`) | `host` |
|---|---|---|---|---|
| `stack.cjs` | `call_stack` | 0 | `a calls b` / ` b calls c` / `  c runs, then returns` / ` back in b` / `back in a` / `stack empty` | same |
| `heap.cjs` | `heap_vs_stack` | 0 | `object still alive: pinger` | same |
| `pid.cjs` | `child_process` | 0 | `parent pid 68721` / `child one pid, parent 68722 68721` / `child two pid, parent 68723 68721` | other PIDs (68724, 68725, 68726), same shape |
| `signals.cjs` | `signals`, `exit_info` | 0 | `killed child: code null signal SIGKILL printed ""` / `SIGTERM child: code 0 signal null printed "SIGTERM handled"` / `out-of-memory child: code null signal SIGABRT printed ""` / `process.on SIGKILL threw EINVAL` | same |
| `queue.cjs` | `task_queue` | 0 | `sync code ends at 0 ms` / `timer 1 at 2 ms` / `timer 2 at 2 ms` | 1 ms, 1 ms |
| `block_timer.cjs` | `timers` | 0 | `loop done at 1000 ms` / `timer asked for 100 ms, ran at 1003 ms` | 1001 ms |
| `order.cjs` | `microtasks` | 0 | `A` / `B` / `promise` / `timer` | same |
| `await_order.cjs` | cut (`cuts.md`, `microtasks`) | 0 | `ping starts` / `caller goes on` / `ping resumes` | same |
| `race_timeout.cjs` | `block_widgets` | 0 | `race gave: action value at 1000 ms` / `timeout fired at 1003 ms` | 1000 ms / 1001 ms |
| `try_timer.cjs` | `try_stack` | 1 | `try block ends` / `script ends`; stderr `Error: late boom` | same |
| `try_await.cjs` | `exception_vs_rejection` | 0 | `caught after await: late boom` / `caught by .catch: late boom` | same |
| `reject_none.cjs` | `uncaught_unhandled` | 1 | `script ends`; stderr `Error: nobody waits for me` | same |
| `emit_sync.cjs` | `emitter_handler` | 0 | `before emit` / `handler 1` / `handler 2` / `after emit` | same |
| `process_handlers.cjs` | `process_handlers` | 0 | `process handler: unhandledRejection - nobody waits` / `process handler: uncaughtException - timer throw` / `process still alive at the end` | same |
| `async_ids.cjs` | `async_chain` | 0 | `top level  asyncId 1 trigger 0` / `timer a    asyncId 5 trigger 1` / `timer d    asyncId 7 trigger 5` | same |
| `als_basic.cjs` | `als` | 0 | `inside the sample run: sample` / `outside any run: undefined` / `timer in the pinger chain: pinger` | same |
| `late_throw.cjs` | `handler_reads_store` | 1 | `call returns ok` / `outside the run, store = undefined` / `process handler: error = late boom \| store = pinger` | same |
| `late_reject.cjs` | `handler_reads_store` | 1 | `outside the run, store = undefined` / `process handler: reason = late reject \| store = pinger` | same |
| `worker_heap.cjs` | `worker_thread` | 0 | `worker sees: worker \| main sees: main` | same |
| `message_waits.cjs` | `shared_memory` | 0 | `main loop starts at 4 ms` / `main loop ends at 1000 ms` / `main got "hello from the worker" at 1000 ms` | starts at 2 ms, rest same |
| `heartbeat.cjs` | `heartbeat` | 0 | `main: loop starts at 305 ms` / `worker at 742 ms: no beat for 516 ms` / `worker at 1257 ms: no beat for 1031 ms` / `main: loop ends at 1800 ms` / `main: done at 2105 ms` | 304; 743 / 520; 1260 / 1037; 1800; 2104 |
| `emit_store.cjs` | `limit_blame_gaps` | 0 | `pinger handler sees: sample` | same |
| `number_await.cjs` (a model of `inSlot`, `WD:40-49`) | `limit_blame_gaps` | 0 | `before await, running widget = 7` / `after await, running widget = 0` | same |

Other runs:

| Run | Command | Result |
|---|---|---|
| base check | `git rev-parse HEAD` in the worktree | `3bc10af2bb04efd002f19978002877af9f0fbac5` |
| code unchanged | `git diff --stat 68aabd9a HEAD -- deepwidgets/widgets/src apps/desktop/src packages/boot/app-boot/src apps/cli/src` | no output (no change) |
| term gate | `python3 ~/kyaloon-media/skill-drafts/explainer-video/scripts/term_gate.py docs/explainers/2026-11-04-event-loop/narration.md docs/explainers/2026-11-04-event-loop/terms.md` | `62 terms, 39 taught, 0 failures`, exit 0 |
| narration lint | `python3 ~/.claude/skills/ste-writing/ste-lint.py docs/explainers/2026-11-04-event-loop/narration.md` | `total=0 per100w=0.00 em_dash=0` |

## Claims by scene `sources.claims`

| Scene | Claim | Label and evidence |
|---|---|---|
| `cold_open` | Eight questions in the side chat | verified (read): `CHAT` (10:12 provisional record and which calls; 10:12 Cordis effect cleanup; 10:26 process handler against effect; 10:27 promise and `.then`; 10:28 PID; 10:31 handler as watcher; 10:35 AsyncLocalStorage; 10:35 async chain) |
| `outline_map` | All widgets run in one process; two failure kinds; notice, find, write, restart, keep off | verified (read): `ISO:1-19`, `WD:1-13`, `SUP:1-6`; the boxes are named in `part_boxes` |
| `two_failures` | `pinger` and `spinner` are illustrative; `ctx.timeout` exists for widgets | verified (read): `deepwidgets/widget-sample/src/index.ts:24` (`inject = ['widgets', 'timer']`), `WWS` `standing.checked.cordis_containment` |
| `call_stack` | A call pushes, a return pops; local values go with the entry | verified (read): `src.mdn_microtasks` "JavaScript execution contexts"; verified (ran): `stack.cjs` |
| `heap_vs_stack` | Objects live in the heap; the stack holds references | verified (read): `PA/memory_threads.md` `ladder.heap` (the rule of thumb; engines are looser, `cuts.md`); verified (ran): `heap.cjs` |
| `process_pid` | Process = running program with its own memory; the OS keeps processes apart; PID | verified (read): OSTEP ch. 4, `pa.jvns_process`, Chromium and Electron process model (`PA/os_basics.md`) |
| `process_pid` | The app process is Electron main and owns the windows | verified (read): `apps/desktop/src/main.ts`, `apps/desktop/src/deepwidgets-windows.ts` (`CLAUDE.md` `head.status`) |
| `child_process` | A child has its own PID and knows its parent's | verified (ran): `pid.cjs` |
| `child_process` | The app process starts one host child that runs every widget; the app survives a host death and starts a new host | verified (read): `HP:213-224`, `SUP:108-184` |
| `signals` | A signal goes to a process by PID; most can be caught; SIGKILL runs no code of the target | verified (read): `pa.man_signal`, `pa.naz_signals` |
| `signals` | Why SIGKILL cannot be refused | inferred (`PA/os_basics.md`: no source states the design reason) |
| `signals` | Node does not allow a SIGKILL listener | verified (ran): `signals.cjs` (`EINVAL`); verified (read): `src.node_process` "Signal events" |
| `exit_info` | Exit code or signal name; the three children | verified (ran): `signals.cjs` |
| `exit_info` | V8 ends an out-of-memory process with SIGABRT, and no JavaScript runs | verified (ran): `signals.cjs` (`printed ""`, its `uncaughtException` handler did not print) |
| `one_thread` | All widget code of the host runs on one main thread; run to completion | verified (read): `src.mdn_exec_model` "Run-to-completion"; `WD:4-7`; `WWS` `standing.hard.agent_code` |
| `one_thread` | To-do list analogy | verified (read via summary): `pa.jake_loop` |
| `task_queue` | Tasks wait first in, first out until the stack is empty | verified (read): `src.jake_tasks`, `src.html_spec` 8.1.7.3; verified (ran): `queue.cjs` |
| `event_loop` | The loop takes the next task when the stack is empty; it sleeps until the OS reports something ready | verified (read): `src.libuv_design` "The I/O loop", `src.node_event_loop` |
| `timers` | A delay is a minimum | verified (read): `src.node_event_loop` "timers"; verified (ran): `block_timer.cjs` |
| `timers` | The action time limit is a timer, 5 s by default | verified (read): `WR:33`, `WR:223-224`, `WR:946-959` |
| `microtasks` | `.then` callbacks and `await` resumes are microtasks; the queue empties after each task | verified (read): `src.v8_fast_async` "Tasks vs. microtasks", `src.html_spec` 8.1.7.3; verified (ran): `order.cjs` |
| `blocking` | A long sync piece of code stops every task and microtask; the count demo; keep callbacks short | verified (read): `pa.js_info`, `src.node_dont_block` |
| `block_widgets` | Every widget shares the main thread; a loop stops every other widget and every timer | verified (read): `WD:4-7`, `WD:123`; mechanism from `src.node_dont_block` |
| `block_widgets` | Calls from windows wait outside | inferred (`cuts.md`) |
| `block_widgets` | The time limit cannot end a sync loop | verified (read): `WR:946-974`; verified (ran): `race_timeout.cjs` |
| `try_stack` | A try covers only code on the stack; the timer throw escapes; exit 1 | verified (read): `pa.jsinfo_try`; verified (ran): `try_timer.cjs` |
| `exception_vs_rejection` | Exception and rejection; `await` turns a rejection into a throw; `.catch` takes it | verified (read): `pa.domenic`, `pa.mdn_using_promises` (`PA/errors_events.md`); verified (ran): `try_await.cjs` |
| `emitter_handler` | Table of names to functions; `on` appends; `emit` calls each at once, in order; a handler does not watch | verified (read): `src.node_events` "emitter.on", "Asynchronous vs. synchronous"; verified (ran): `emit_sync.cjs` |
| `uncaught_unhandled` | Uncaught = no catch on the stack; unhandled = no handler when Node checks, after the current code and microtasks; both exit 1 by default | verified (read): `src.node_process`, `pa.uhyo` (`PA/errors_events.md`); verified (ran): `reject_none.cjs`, `try_timer.cjs` |
| `process_handlers` | `process` is one emitter; a handler replaces the default exit and gets only the error; default `throw` mode; the quote | verified (read): `src.node_process`; verified (ran): `process_handlers.cjs` |
| `promise_not_process` | A promise is a heap object; `.then` runs once as a microtask; the process handler is the last stop for every promise; MDN's "process" means an operation | verified (read): `src.mdn_promise`; `CHAT` (10:28); the MDN reading is from `RES` `src.mdn_promise` |
| `handler_vs_effect` | A process handler stays until removed; 2 to 5 handlers over 4 reloads | verified (read): `src.node_events` "emitter.on"; `docs/explore/widget-system/plugins-spike.md:110` |
| `handler_vs_effect` | A Cordis effect returns a cleanup that Cordis runs on stop or reload | verified (read): `.agents/skills/cordis/`; `WD:121-135` (an effect with a cleanup) |
| `handler_vs_effect` | The crash hook is what the process handler calls; it goes in through a Cordis effect | verified (read): `ISO:370-375`, `PBOOT:365-400`, `BOOT:926-927` |
| `async_chain` | Definition; Node links each piece to its creator | verified (read): `CHAT` (10:36), `src.node_async_hooks` "triggerAsyncId"; verified (ran): `async_ids.cjs` |
| `als` | `run`, `getStore`, `undefined` outside; not browser `localStorage` | verified (read): `src.node_async_context`; verified (ran): `als_basic.cjs` |
| `als` | React context analogy | verified (read): `pa.react_context`; the link to async local storage is inferred framing |
| `handler_reads_store` | The process handler runs inside the failed callback's chain and reads its value | verified (read): `src.node_async_hooks` "after(asyncId)", Node `promises.js` v24.x 259-266, 472-477; verified (ran): `late_throw.cjs`, `late_reject.cjs` |
| `worker_thread` | A worker thread has its own stack, heap, and loop; it keeps running when the main thread is stuck | verified (read): `src.node_workers` "Class: Worker", `src.libuv_design`; verified (ran): `worker_heap.cjs`, `heartbeat.cjs` |
| `worker_thread` | In most languages, threads of one process share one heap | verified (read): `pa.codingshuttle_threads`; other course pages are search snippets only (`PA/os_basics.md`) |
| `shared_memory` | A message is a copy that waits for the stuck thread; shared memory needs no copy; one step that no thread can split | verified (read): `src.node_workers`, `src.mdn_sab_atomics`; verified (ran): `message_waits.cjs` |
| `heartbeat` | Main thread adds 1 every 100 ms; the worker looks every 50 ms | verified (read): `WD:25-29`, `WD:123`, `WDW:145-158` |
| `heartbeat` | The watchdog timer idea | verified (read): `pa.wiki_watchdog` |
| `heartbeat` | The run numbers | verified (ran): `heartbeat.cjs` |
| `blame_store` | One `AsyncLocalStorage`; its value names the widget; the wrap goes around the widget start and each action call; timers and promises carry the value | verified (read): `ISO:51`, `ISO:113-115`, `ISO:290-323`, `WR:963`; verified (ran): `als_basic.cjs` (model) |
| `crash_record` | One process handler per event calls the crash hook | verified (read): `BOOT:926-927`, `PBOOT:316-320`, `ISO:370-375` |
| `crash_record` | The hook reads the store, writes `crash.json` with sync calls, exits with code 1 | verified (read): `ISO:342-368`, `REC:81-87` |
| `crash_record` | The fields | verified (read): `REC:25-41`, `REC:111-124` |
| `crash_record` | An async write might not finish before the exit | verified (read): `src.node_process` "process.exit()" (it does not wait for async work); the write case is inferred |
| `crash_record` | Crash-only software | verified (read): `src.candea_fox_2003` (`PA/crash_only.md`) |
| `watchdog` | The watchdog is a worker thread that looks every 50 ms; the wrap sets and restores the widget number | verified (read): `WD:28-29`, `WD:105`, `WD:40-49`, `REC:43-48` |
| `watchdog` | At 2 s: crash record with `stall`, then SIGKILL to its own process | verified (read): `WD:25`, `WDW:181-199` |
| `watchdog` | 150 MB parse in 868 ms; a 500 ms threshold gave a false kill | verified (ran, earlier video): `tools/widgets-watchdog.mjs` at `108d663f`; verified (read): `WWS:242`, `WD:6-8` |
| `provisional_record` | An out-of-memory death runs no JavaScript | verified (read): `WDW:4-6`; verified (ran): `signals.cjs` |
| `provisional_record` | At 500 ms, the record, same fields, `provisional-stall`, widget number only, none with no number | verified (read): `WDW:165-180`, `REC:20-24` |
| `provisional_record` | The number covers only sync code of the wrap | verified (read): `WD:40-49`; verified (ran): `number_await.cjs` |
| `provisional_record` | Deleted at the next look when the beat returns; not tied to the call | verified (read): `WDW:150-157`; `CHAT` (10:13) |
| `provisional_record` | The planned fix is not built | verified (read): `docs/specs/widget-fv.md:61`, `docs/plans/widget-fv.md:13` |
| `supervisor` | The supervisor gets PID, code, and signal; PID match; abort rule; discard; crash record wins | verified (read): `SUP:46-98`, `SUP:152-159` |
| `supervisor` | Blamed crashes not counted; growing waits; built-in widgets only; restarts stop | verified (read): `POL:10-16`, `POL:38-50`, `SUP:160-168`; built-in widgets only from the earlier video scene `safe_mode` |
| `quarantine` | The next host applies the record; held while the hash matches; failed window with reason; lift on new files that load | verified (read): `ISO:209-253`, `ISO:296-301`, `ISO:1-12` |
| `quarantine` | The word is ours; Fowler's breaker is the nearest named cousin | verified (read): `PA/crash_only.md` `crash_only.gaps`, Fowler |
| `ex_throw_path` | The steps of the late throw | verified (read): `WR:946-981`, `WD:40-49`; verified (ran): `late_throw.cjs` (model) |
| `ex_throw_record` | Record, exit 1, about 65 ms; supervisor PID match, 500 ms, not counted; quarantine | verified (read): `ISO:342-368`, `SUP:93-94`, `POL:47`; verified (ran, earlier video): blame check 64 ms and 67 ms |
| `ex_loop_stall` | The steps of the endless loop | verified (read): `WR:963`, `WD:43`, `WD:123`, `WDW:165-199`; verified (ran): `block_timer.cjs`, `race_timeout.cjs` |
| `ex_loop_restart` | Kill at about 2,050 ms; the watchdog deleted the provisional record; PID match; quarantine | verified (ran, earlier video): `spin` case; verified (read): `WDW:183-190`, `SUP:93-94` |
| `ex_loop_oom` | Provisional record at 500 ms; abort before 2 s; no crash record; SIGABRT accepts the provisional record | verified (read): `WDW:166`, `SUP:95-97`; verified (ran, earlier video): `oom` case |
| `limit_blame_gaps` | Module top level runs outside any wrap | inferred (the wrap covers `execute`, not the module import, `ISO:290-323`) |
| `limit_blame_gaps` | A handler sees the store of the `emit` caller | verified (read): `src.node_async_context`; verified (ran): `emit_store.cjs` |
| `limit_blame_gaps` | The widget number is 0 after an `await` | verified (ran): `number_await.cjs` |
| `limit_blame_gaps` | The same for a loop in a widget timer | inferred |
| `limit_blame_gaps` | In the app, such a stall has no blame and counts against the app | verified (read): `WD:10-12`, `WDW:191-197`, `SUP:58-63`, `POL:41` |
| `limit_provisional` | The gap; up to 50 ms | verified (read): `WDW:150-156`; the length is inferred |
| `limit_provisional` | PID reuse left out of the model | verified (read): `CHAT` (10:28); not checked in the model files |
| `limit_threshold` | One experiment; load can kill a healthy host; open point | verified (read): `WWS:242`, `CLAUDE.md` `head.commands`, `docs/specs/widget-fv.md:85` |
| `limit_threshold` | Every widget stops for about 2 s; resuming is not safe | verified (read): `WWS:242` (about 2.1 s), `src.node_process` |
| `answers`, `closing` | Summaries of the scenes above | see each scene |
