# Sources of the explainer `explainer_loop.sources`

Each claim of `narration.md` and of the visuals in `script.md` has a row here. The label is one of these:

- verified (read): the file and line at `origin/main` `68aabd9a`, or the web page and section named in the row. The web pages were read on 2026-11-04 for `research.md`.

- verified (ran): a command that ran on 2026-11-04 in this session. `sources.runs` gives each command and its output.

- verified (ran, earlier video): a command that the earlier video ran at `108d663f` (`docs/explainers/2026-11-02-deepwidgets/sources.md`). This session did not run it again. `git diff --stat 108d663f 68aabd9a` shows no change in `watchdog.ts`, `watchdog-worker.ts`, `records.ts`, `deepwidgets-supervisor.ts`, `deepwidgets-crash-policy.ts`, and `apps/cli/src/profile-boot.ts`. `isolation.ts` changed only in the quarantine lift and the agent rows. `runAs` and `claim` are the same.

- inferred: it follows from the code or the docs, but nothing ran it.

Path short names: `ISO` is `deepwidgets/widgets/src/isolation.ts`. `REC` is `deepwidgets/widgets/src/records.ts`. `WD` is `deepwidgets/widgets/src/watchdog.ts`. `WDW` is `deepwidgets/widgets/src/watchdog-worker.ts`. `WR` is `deepwidgets/widgets/src/index.ts`. `SUP` is `apps/desktop/src/deepwidgets-supervisor.ts`. `POL` is `apps/desktop/src/deepwidgets-crash-policy.ts`. `BOOT` is `packages/boot/app-boot/src/index.ts`. `PBOOT` is `apps/cli/src/profile-boot.ts`. `HP` is `apps/desktop/src/host-process.ts`. `CRE` is `deepwidgets/mcp/src/creation.ts`. `WWS` is `docs/explore/widget-system/where-we-stand.md`. `RES` is `~/kyaloon-media/explainer-event-loop-2026-11-04/research.md`. `CHAT` is `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/source-chat-btw.md`. `SN` is the snippet folder `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/script-agent/snippets/`. `LOG` is `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/script-agent/runs.log`.

## Articles `sources.articles`

The video names the article and the author on screen at each fact. The facts are paraphrased. The video has two quotes, each from a different source, each under 15 words.

| Short name | Source | Sections used | Quote in the video |
|---|---|---|---|
| `src.jake_tasks` | Jake Archibald, "Tasks, microtasks, queues and schedules", https://jakearchibald.com/2015/tasks-microtasks-queues-and-schedules/ (2015-08-17) | "Why this happens" | none |
| `src.mdn_exec_model` | MDN contributors, "JavaScript execution model", https://developer.mozilla.org/en-US/docs/Web/JavaScript/Event_loop (2026-11-02) | "The engine and the host", "Agent execution model", "Run-to-completion", "Agent clusters and memory sharing" | none |
| `src.html_spec` | WHATWG, HTML Living Standard, https://html.spec.whatwg.org/multipage/webappapis.html#event-loops | 8.1.7.1 "Definitions", 8.1.7.3 "Processing model" | none |
| `src.mdn_microtasks` | MDN contributors, "In depth: Microtasks and the JavaScript runtime environment", https://developer.mozilla.org/en-US/docs/Web/API/HTML_DOM_API/Microtask_guide/In_depth (2025-06-23) | "JavaScript execution contexts" | none |
| `src.node_event_loop` | Node.js project, "The Node.js Event Loop", https://nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick | "Phases Overview", "Phases in Detail", "timers", "process.nextTick()" | none |
| `src.libuv_design` | libuv project, "Design overview" and "Thread pool work scheduling", https://docs.libuv.org/en/v1.x/design.html, https://docs.libuv.org/en/v1.x/threadpool.html | "The I/O loop", threadpool page | none |
| `src.node_dont_block` | Node.js project, "Don't Block the Event Loop (or the Worker Pool)", https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop | "What does this mean for application design?", "REDOS", "JSON DOS", "Complex calculations without blocking the Event Loop", "What code runs on the Worker Pool?" | none |
| `src.node_process` | Node.js API, "process" and CLI, https://nodejs.org/api/process.html, https://nodejs.org/api/cli.html (v26.13.0 docs) | "Event: 'uncaughtException'", "Warning: Using 'uncaughtException' correctly", "Event: 'unhandledRejection'", "process.exit([code])", "Signal events", "Exit codes", "When to use queueMicrotask() vs. process.nextTick()", `--unhandled-rejections`, `--no-async-context-frame` | "It is not safe to resume normal operation after 'uncaughtException'." (`process_handlers`) |
| `src.node_events` | Node.js API, "Events", https://nodejs.org/api/events.html (v26.13.0 docs) | "Events", "emitter.on(eventName, listener)", "Asynchronous vs. synchronous" | none |
| `src.node_async_context` | Node.js API, "Asynchronous context tracking", https://nodejs.org/api/async_context.html (v26.13.0 docs) | "Introduction", "asyncLocalStorage.run", "asyncLocalStorage.getStore()", "Integrating AsyncResource with EventEmitter", "Troubleshooting: Context loss" | none |
| `src.node_async_hooks` | Node.js API, "Async hooks", https://nodejs.org/api/async_hooks.html (v26.13.0 docs) | "Async hooks", "Terminology", "triggerAsyncId", "after(asyncId)" | none |
| `src.tc39_async_context` | TC39 proposal "AsyncContext" (champions Andreu Botella, Chengzhong Wu, Justin Ridgewell), https://github.com/tc39/proposal-async-context (Stage 2) | "Motivation", FAQ "How does AsyncContext interact with built-in schedulers?" | none |
| `src.wintertc_als` | WinterTC common-minimum API, `asynclocalstorage.md`, https://github.com/wintercg/proposal-common-minimum-api/blob/main/asynclocalstorage.md | the frame model, EventEmitter rule | none |
| `src.node_workers` | Node.js API, "Worker threads", https://nodejs.org/api/worker_threads.html (v26.13.0 docs) | "Worker threads", "Class: Worker", "worker.workerData", "port.postMessage", "worker.unref()", "Notable differences inside a Worker environment" | none |
| `src.mdn_sab_atomics` | MDN contributors, "SharedArrayBuffer" and "Atomics", https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer, https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics (2026-10-28) | "Description", "Static methods" | none |
| `src.v8_fast_async` | Maya Armyanova and Benedikt Meurer (V8 team), "Faster async functions and promises", https://v8.dev/blog/fast-async (2018-11-12) | "Tasks vs. microtasks", "await under the hood" | none |
| `src.mdn_promise` | MDN contributors, "Promise", https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise (2026-10-26) | "Description", "Chained Promises" | "Promises in JavaScript represent processes that are already happening." (`promise_not_process`) |
| `src.sentry_native` | `@sentry/node-native-stacktrace` README, https://github.com/getsentry/sentry-javascript-node-native-stacktrace | README | none |
| Node source | `lib/internal/process/promises.js`, branch `v24.x`, https://github.com/nodejs/node/blob/v24.x/lib/internal/process/promises.js | lines 259-266, 472-477 | none |

## Runs of this session `sources.runs`

All runs on 2026-11-04 on the operator Mac. The runner is `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/script-agent/run_snippets.py`. It runs each snippet file of `SN` with three runtimes and writes `LOG`.

| Runtime short name | Command prefix | Versions |
|---|---|---|
| `electron` | `ELECTRON_RUN_AS_NODE=1 /Users/rohanmalik/deepWidgets/node_modules/.pnpm/electron@44.7.0_supports-color@9.4.0/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron` | node v24.21.0, electron 44.7.0, libuv 1.52.1, V8 15.2.124.28-electron.0 (ran: `-e "console.log(process.version, process.versions.electron, process.versions.uv, process.versions.v8)"`) |
| `node24` | `/Users/rohanmalik/.nvm/versions/node/v24.8.0/bin/node` | v24.8.0, libuv 1.51.0 |
| `node22` | `/Users/rohanmalik/.nvm/versions/node/v22.23.0/bin/node` | v22.23.0 |

The desktop host runs the same way as the `electron` runtime: `HP:213-224` spawns `this.node` with `--expose-internals`, `apps/desktop/src/node-environment.ts:15` sets `ELECTRON_RUN_AS_NODE: '1'`, and `apps/desktop/src/main.ts:229` sets `const node = process.execPath` (verified, read).

Outputs below are from `electron`. "Same on all" means that `node24` and `node22` gave the same text (verified, ran: a compare of the three outputs in `LOG`). Timing lines differ by a few milliseconds between runtimes; the row gives the other values.

| Snippet (`SN/`) | Exit | Output (`electron`) | Other runtimes |
|---|---|---|---|
| `order.cjs` | 0 | `script start` / `script end` / `next tick` / `promise 1` / `microtask` / `promise 2` / `timeout` | same on all |
| `order.mjs` (same code as an ES module) | 0 | `script start` / `script end` / `promise 1` / `microtask` / `promise 2` / `next tick` / `timeout` | same on all |
| `phases.cjs` | 0 | `poll: file read done` / `next tick` / `promise` / `check: immediate` / `timers: timeout 0` | same on all |
| `toplevel_race.cjs`, 100 runs each | 0 | `immediate then timeout` 96, `timeout then immediate` 4 | `node24` 99 / 1; `node22` 97 / 3 |
| `await_order.cjs` | 0 | `A` / `handler start` / `B` / `handler resumed` | same on all |
| `block_timer.cjs` | 0 | `loop done at 1000 ms` / `timer asked for 100 ms, ran at 1002 ms` | `node24` 1002 ms; `node22` 1003 ms |
| `microtask_starve.cjs` | 0 | `timer ran after 1000000 microtasks` | same on all |
| `emit_sync.cjs` | 0 | `before emit` / `listener 1` / `listener 2` / `after emit` | same on all |
| `als_basic.cjs` | 0 | `inside widget-b run: widget-b` / `outside any run: undefined` / `timer in widget-a chain: widget-a` | same on all |
| `als_emitter.cjs` | 0 | `listener of widget-a sees: widget-b` / `listener of widget-a sees: undefined` | same on all |
| `async_ids.cjs` | 0 | `top level  asyncId 1 trigger 0` / `timer a    asyncId 5 trigger 1` / `timer d    asyncId 7 trigger 5` | same on all |
| `late_throw.cjs` | 1 | `call returns ok` / `outside the run, store = undefined` / `process handler: error = late boom \| store = widget-a` | same on all |
| `late_reject.cjs` | 1 | `outside the run, store = undefined` / `process handler: reason = late reject \| store = widget-b` | same on all |
| `slot_await.cjs` | 0 | `before await, slot = 7` / `after await, slot = 0` | same on all |
| `race_timeout.cjs` | 0 | `race gave: handler value at 1000 ms` / `timeout promise rejected at 1001 ms` | `node24` 1000 / 1002 ms; `node22` 1000 / 1003 ms |
| `heartbeat.cjs` | 0 | `main: loop starts at 304 ms` / `worker (fd 1) at 744 ms: no beat for 509 ms` / `worker (fd 1) at 1255 ms: no beat for 1020 ms` / `main: loop ends at 1800 ms` / `worker (console.log) written at 1255 ms` / `main: done at 2104 ms` | `node24` 754 and 1265 ms; `node22` 751 and 1259 ms (stall 1017 ms); the `console.log` line comes after `main: loop ends` on all |
| `kill_signal.cjs` | 0 | `SIGKILL child: status null signal SIGKILL stdout ""` / `OOM child: status null signal SIGABRT stdout ""` / `OOM child stderr first line: "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory"` / `process.on SIGKILL threw: EINVAL` | same on all |
| `pid.cjs` | 0 | `this process pid 69039 \| child one pid 69040 \| child two pid 69041` | other pids, always three different numbers |

Other runs:

| Run | Command | Result |
|---|---|---|
| `acf_probe` | `<electron prefix> --expose-internals SN/acf_probe.cjs`, the same with `node24` and `node22` | `electron`: `enabled: true`; `node24`: `enabled: true`; `node22`: `enabled: false` |
| unhandled rejection default | `<electron prefix> -e "Promise.reject(new Error('nobody handles me'))"` | exit 1 |
| base check | `git rev-parse HEAD` in the worktree | `68aabd9afe3df694af31873150ad93c756fe06de` |
| unchanged files | `git diff --stat 108d663f 68aabd9a -- <isolation, records, watchdog, worker, supervisor, profile-boot, app-boot>`; `git diff --stat 108d663f 68aabd9a -- apps/desktop/src/deepwidgets-crash-policy.ts` | only `isolation.ts` (quarantine lift, agent rows) and `BOOT` (recompose, not `installFailLoud`) changed. The check `tools/widgets-watchdog.mjs` changed (165 lines in, 114 out), so its numbers belong to `108d663f` |
| narration lint | `python3 /Users/rohanmalik/.claude/skills/ste-writing/ste-lint.py docs/explainers/2026-11-04-event-loop/narration.md` | `total=0 per100w=0.00 em_dash=0` |

## Claims by scene `sources.claims`

| Scene | Claim | Label and evidence |
|---|---|---|
| `cold_open` | The earlier video showed blame, claimer, supervisor, safe mode, watchdog | verified (read): `docs/explainers/2026-11-02-deepwidgets/script.md`, scenes `blame_store` to `watchdog` |
| `viewer_questions` | Six questions of Rohan | verified (read): `CHAT` |
| `outline_map` | Host = Electron 44.7.0 in Node mode, Node 24.21.0; one main thread with one loop | verified (ran): version line; verified (read): `HP:213-224`, `main.ts:229`; `src.libuv_design` (one loop per thread) |
| `outline_walk` | Action handlers run on the main thread; blame store; process handlers; watchdog thread with shared memory; two record files; supervisor in Electron main | verified (read): `WR:963`, `ISO:51`, `BOOT:926-927`, `WD:93`, `WD:105`, `ISO:118-121`, `SUP:108` |
| `example_cast` | `pinger` and `spinner` are illustrative; `ctx.timeout` exists for widgets | verified (read): `CRE:228` (lint message names `ctx.timeout(callback, ms)`), `deepwidgets/widget-sample/src/index.ts:24` (`inject = ['widgets', 'timer']`) |
| `engine_and_host` | Engine vs host; agent = heap, stack, job queue | verified (read): `src.mdn_exec_model` "The engine and the host", "Agent execution model" |
| `call_stack` | Push and pop of frames | verified (read): `src.mdn_microtasks` "JavaScript execution contexts" |
| `call_stack` | An uncaught throw leaves the bottom of the stack | verified (read): `src.node_process` "Event: 'uncaughtException'" |
| `run_to_completion` | No preemption inside an agent; a long job blocks the agent | verified (read): `src.mdn_exec_model` "Run-to-completion" |
| `one_thread_many_widgets` | All widgets, routes, and timers share the host main thread | verified (read): `WWS:211` (`standing.hard.agent_code`), `WD:4-7`; mechanism inferred |
| `tasks` | Timer, I/O, and request callbacks are tasks; one at a time | verified (read): `src.jake_tasks` "Why this happens"; `src.html_spec` 8.1.7.3 |
| `tasks` | The task and microtask rules of the article also apply to Node | inferred: the article has no Node content; Node adds the next tick queue and the phases (`next_tick`, `libuv_ring`) |
| `microtasks` | Promise callbacks and `await` resumes are microtasks; drain until empty | verified (read): `src.v8_fast_async` "Tasks vs. microtasks"; `src.html_spec` 8.1.7.3 |
| `order_example`, `order_walkthrough` | The output order | verified (ran): `order.cjs`, same on all |
| `order_walkthrough` | Next tick queue drains before the promise microtasks | verified (read): `src.node_process` "When to use queueMicrotask() vs. process.nextTick()"; verified (ran): `order.cjs` |
| `microtask_starvation` | A self-queuing microtask holds the timer for 1,000,000 microtasks | verified (ran): `microtask_starve.cjs` |
| `libuv_ring` | Phase order and what each phase runs | verified (read): `src.node_event_loop` "Phases Overview", "Phases in Detail" |
| `libuv_ring` | Since Node 20 (libuv 1.45), timers run after poll in each turn | verified (read): `src.node_event_loop` version note (visual only) |
| `poll_wait` | The loop blocks in poll up to the next timer | verified (read): `src.libuv_design` "The I/O loop" |
| `poll_wait` | An idle host uses almost no processor time | inferred |
| `poll_wait` | Each call from a user or an agent starts as an HTTP request callback | verified (read): routes `/api/widgets/<slug>/call` in `WR`; the earlier video scene `routes`; poll-phase dispatch inferred from `src.node_event_loop` |
| `immediate_vs_timeout` | Inside an I/O callback, immediate first; top level not fixed (96/4) | verified (ran): `phases.cjs`, `toplevel_race.cjs`; the guide `src.node_event_loop` also covers this case, but this session did not read that section |
| `next_tick` | `process.nextTick` is Legacy; use `queueMicrotask` | verified (read): `src.node_process`. The doc chip is a paraphrase, because `process_handlers` has the one quote from this source. |
| `next_tick` | In an ES module, next tick comes after the promise callbacks | verified (ran): `order.mjs` |
| `thread_pool` | Pool of 4 by default; fs and DNS; sockets on the loop thread; C work, callback on the main thread | verified (read): `src.libuv_design` threadpool page and "The I/O loop"; `src.node_dont_block` "What code runs on the Worker Pool?" |
| `block_everything` | No preemption between clients; each callback must be short | verified (read): `src.node_dont_block` "What does this mean for application design?" |
| `timers_minimum` | A delay is a minimum; 100 ms timer ran at 1002 ms after a 1 s loop | verified (read): `src.node_event_loop` "timers"; verified (ran): `block_timer.cjs` |
| `timers_minimum` | The action timeout is a timer, default 5 s | verified (read): `WR:33`, `WR:946-959` |
| `block_examples` | REDOS, sync fs calls, large `JSON.parse`; 50 MB parse about 1.3 s | verified (read): `src.node_dont_block` "REDOS", "Node.js core modules", "JSON DOS" |
| `block_examples` | 150 MB parse in the host took 868 ms, host lives | verified (ran, earlier video): `tools/widgets-watchdog.mjs` at `108d663f`, `parseMs 868` |
| `block_widgets` | A loop stops every route, timer, heartbeat, and the action timeout | verified (read): `WD:4-7`, `WD:123`, `WR:946-959`; mechanism inferred from `src.node_dont_block` |
| `block_widgets` | Only the main thread stops; the watchdog thread keeps its own loop | verified (read): `WDW:145-200`; verified (ran): `heartbeat.cjs` |
| `block_remedies` | Partition with `setImmediate`, or offload | verified (read): `src.node_dont_block` "Complex calculations without blocking the Event Loop" |
| `block_remedies` | deepWidgets detects the block from outside and ends the host | verified (read): `WDW:4-7`, `WDW:199` |
| `promise_value` | States, settled once, lives in the heap | verified (read): `src.mdn_promise` "Description" |
| `promise_not_process` | The MDN sentence and its meaning (an operation, not an OS process) | verified (read): `src.mdn_promise` "Description"; the "operation" reading is inferred from the page context (`RES` `src.mdn_promise`) |
| `then_continuation` | `then` returns a new promise; its handler runs as a job, never at once | verified (read): `src.mdn_promise` "Chained Promises" |
| `then_continuation` | Future / map framing | inferred framing |
| `await_continuation` | `await` suspends, attaches a continuation, returns a promise, resumes in a microtask | verified (read): `src.v8_fast_async` "await under the hood"; verified (ran): `await_order.cjs` |
| `await_split` | After the first `await`, the rest runs after the caller returned | inferred from `src.v8_fast_async`; verified (ran): `await_order.cjs`, `slot_await.cjs` |
| `emitter_table` | `on` appends, stays until `off`; `emit` calls the listeners | verified (read): `src.node_events` "emitter.on(eventName, listener)" |
| `emit_sync` | `emit` is synchronous, in registration order | verified (read): `src.node_events` "Asynchronous vs. synchronous"; verified (ran): `emit_sync.cjs` |
| `handler_not_watcher` | The detector calls `emit`; the Node runtime emits `uncaughtException` | verified (read): `src.node_events` "Events"; `src.node_process` "Event: 'uncaughtException'" |
| `handler_not_watcher` | The watchdog thread polls every 50 ms | verified (read): `WD:28-29`, `WDW:145-200` |
| `process_handlers` | Both events, default exit 1, a listener replaces the default, last-resort, unsafe to resume | verified (read): `src.node_process` (events, Warning, `--unhandled-rejections`); verified (ran): unhandled rejection default gives exit 1 |
| `last_resort_sink` | A process handler stays until removed and gets only the error | verified (read): `src.node_events` "emitter.on"; `BOOT:916-921` (the listeners take only `err`) |
| `effect_vs_listener` | Cordis effect returns a disposer, run on stop or reload | verified (read): `.agents/skills/cordis/` (via the earlier video row `cordis_context`); `ISO:370-375` |
| `effect_vs_listener` | `process.on` listeners 2 to 5 over 4 reloads | verified (read): `docs/explore/widget-system/plugins-spike.md:110` |
| `effect_vs_listener` | The lint gate refuses raw `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`; not `process.on` | verified (read): `CRE:225-243`. The chat said the lint rule would refuse `process.on` (`CHAT`, the answer at 10:26); the code at `68aabd9a` has no such rule. |
| `lost_context` | Values on the stack are gone after `await` or in a timer | verified (read): `src.tc39_async_context` "Motivation" |
| `async_chain` | Definition and example | verified (read): `CHAT` (answer at 10:36); tree framing from `src.node_async_hooks` |
| `async_ids` | Async resource, `asyncId`, `triggerAsyncId`; the ids 1, 5, 7 | verified (read): `src.node_async_hooks` "Terminology", "triggerAsyncId"; verified (ran): `async_ids.cjs` |
| `als_intro` | Not browser `localStorage`; thread-local comparison | verified (read): `src.node_async_context` "Introduction" |
| `als_intro` | Thread-local storage cannot tell the chains of one thread apart | verified (read): `src.mdn_exec_model` (each worker is its own agent); verified (ran): `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/corrections-agent/runs/per_thread.cjs` on Node 22.23.0 (a global set in a worker is not seen by the main thread) |
| `als_intro` | Reader context / dynamic scope framing | inferred framing (`src.tc39_async_context` "Motivation") |
| `als_run` | `run`, `getStore`, `undefined` outside; the output | verified (read): `src.node_async_context`; verified (ran): `als_basic.cjs` |
| `als_capture` | Store captured at registration | verified (read): `src.tc39_async_context` FAQ; `src.wintertc_als` |
| `als_emitter_rule` | A listener sees the store of the emit caller; the output | verified (read): `src.node_async_context` "Integrating AsyncResource with EventEmitter"; `src.wintertc_als`; verified (ran): `als_emitter.cjs` |
| `als_frame` | Node 24 uses `AsyncContextFrame`; Node 22 uses async_hooks | verified (ran): `acf_probe` (`node24` true, `node22` false); verified (read): `src.node_process` CLI `--no-async-context-frame` |
| `als_frame` | Electron 44 in the host mode has the frame on | verified (ran): `acf_probe` on `electron` with `--expose-internals` gives `enabled: true`. This closes the gap of `RES` `research.gaps` for the runtime; the probe did not run inside a live host. |
| `worker_thread` | A worker has its own thread, heap, stack, and loop; helps CPU work | verified (read): `src.node_workers` "Class: Worker", "Worker threads"; `src.libuv_design` |
| `shared_memory` | Messages copy; a shared buffer is a new view of the same memory | verified (read): `src.node_workers` "port.postMessage", "worker.workerData"; `src.mdn_sab_atomics` "Description" |
| `shared_memory` | Two Int32 slots: heartbeat and running widget | verified (read): `REC:43-48`, `WD:93` |
| `atomics` | `add`, `load`, `store`, `exchange`; sequentially consistent | verified (read): `src.mdn_sab_atomics` "Static methods"; `src.mdn_exec_model` "Agent clusters and memory sharing" |
| `heartbeat_demo` | The model numbers; worker `console.log` waits for the main thread | verified (ran): `heartbeat.cjs` (three runtimes); verified (read): `WDW:52-55`, `src.node_workers` "Notable differences inside a Worker environment" |
| `pid_signals` | PIDs differ; the OS can reuse a PID | verified (ran): `pid.cjs`; reuse: inferred (general OS behavior), also `CHAT` (answer at 10:28) |
| `pid_signals` | `SIGKILL` cannot have a listener; a killed child shows `SIGKILL`, no code, no exit listener output | verified (read): `src.node_process` "Signal events"; verified (ran): `kill_signal.cjs` |
| `abort_exit` | OOM gives `SIGABRT`; no listener runs | verified (ran): `kill_signal.cjs` |
| `abort_exit` | Exit code 134 = 128 + 6 | verified (read): `src.node_process` "Exit codes"; `SUP:72-73` |
| `run_as` | Blame store, `runAs`, row id pattern, action handler inside `runAs` | verified (read): `ISO:34`, `ISO:51`, `ISO:113-115`, `WR:963`. The store keeps the Loader entry id, which can have group ids in front (`ISO:59-62`, `ISO:88-91`). The pattern tests the row id, the last part (`include:deepwidgets-widget-watchdog` in the earlier watchdog check). |
| `run_as` | Timers and promises that a handler makes carry the row | verified (ran): `als_basic.cjs`, `late_throw.cjs`, `late_reject.cjs` (model); the earlier video blame check (8 of 9 fault kinds blamed) |
| `fiber_wrap` | The wrap of `fiber._runner.execute`; Cordis has no public hook | verified (read): `ISO:283-329` |
| `claimer_path` | One fail-loud listener per event; the release calls the fatal hooks before its first `await`; the claimer is a hook | verified (read): `BOOT:880-929`, `PBOOT:311-320`, `PBOOT:370-400`, `ISO:370-375`. The "before any await" order is inferred from the JS rule that an async function runs to its first `await` at once (`BOOT:897-905`). |
| `claimer_context` | `after` hook runs after `uncaughtException`; Node 24 restores the reject-time frame | verified (read): `src.node_async_hooks` "after(asyncId)"; Node source `promises.js` v24.x lines 259-266, 472-477 |
| `claimer_context` | The model results on three runtimes | verified (ran): `late_throw.cjs`, `late_reject.cjs` |
| `claimer_steps` | Store, then stack, then null; sync write with rename; `process.exit(1)` | verified (read): `ISO:342-369`, `REC:81-87` |
| `claimer_steps` | `process.exit` does not wait for async work | verified (read): `src.node_process` "process.exit([code])" |
| `claimer_steps` | An async write could still wait in the pool | inferred from `src.libuv_design` (fs work runs in the pool) |
| `crash_record` | The fields | verified (read): `REC:14-41` |
| `crash_only` | Not safe to resume; earlier design hid host errors; about 2 s per crash | verified (read): `src.node_process` Warning; the earlier video scene `isolation_why` and its sources (project notes) |
| `watchdog_overview` | A loop runs no new callback, so no process handler runs | inferred from `run_to_completion`; verified (read): the claimer runs only from the fail-loud listener (`PBOOT:316-320`) |
| `running_slot` | `inSlot` with `Atomics.exchange` and `finally` `Atomics.store`; index 0 = none | verified (read): `WD:39-49`, `REC:45-46`, `WD:112` |
| `running_slot` | The slot reads 7 before the `await` and 0 after | verified (ran): `slot_await.cjs` (a model of `WD:40-49`) |
| `slot_names` | Three meanings of slot; the queue slot `AsyncLocalStorage` | verified (read): `REC:44`, `REC:46`, `WR:711`, `WR:823-846` |
| `heartbeat_beat` | `setInterval` 100 ms with `Atomics.add`, `unref` | verified (read): `WD:24-29`, `WD:121-124` |
| `watchdog_poll` | Poll 50 ms; a new beat resets the clock and removes the provisional record; monotonic clock; a 1 s poll gap restarts the clock | verified (read): `WDW:136-164`; verified (ran, earlier video): `widgets-watchdog.log` `suspend` case |
| `provisional_record` | At 500 ms, by slot only, only when the slot names a widget; removed when the beat returns | verified (read): `WDW:150-157`, `WDW:165-180`; verified (ran, earlier video): `stall` case |
| `provisional_record` | Not tied to the call | verified (read): `WDW:150-156`; `docs/specs/widget-fv.md:61` (the planned rule); `CHAT` (answer at 10:13) |
| `kill_path` | At 2 s: crash record and remove provisional (both in `write`), native read and a second write only when the slot is empty, fd 2 line, `SIGKILL` | verified (read): `WDW:181-199` (`write` at `WDW:183-190`) |
| `kill_path` | No Electron build of the native module; the CLI host can load it | verified (read): `WD:10-12`, `WD:56-74`; verified (PR, earlier video): #65 |
| `threshold_why` | 868 ms parse; a 500 ms threshold gave a false kill in the spike | verified (ran, earlier video); verified (read): `WWS:242`, `WD:6-8` |
| `supervisor_rules` | Exit carries pid, code, signal; record rules; abort rule; discard | verified (read): `HP:275`, `SUP:52-98`, `SUP:152-159` |
| `record_pid_match` | A host that dies at boot counts as unblamed; the abort rule reason | verified (read): `SUP:52-57`, `SUP:81-86` |
| `backoff` | 500, 2000, 8000 ms; window 60 s; safe mode after 2; give up after 4; blamed crashes do not count | verified (read): `POL:4`, `POL:10-16`, `SUP:156-168` |
| `backoff` | Safe mode runs only built-in widgets | verified (read): the earlier video scene `safe_mode` and its sources |
| `restart_windows` | Main window reloads, widget windows stay, pages connect again; fresh data about 2 s after a crash | verified (read): `SUP:116-118` (restart brings the main window back), the earlier video scene `supervisor`, `WWS:242` (about 2.1 s) |
| `next_host` | Apply crash record, then provisional with the pid rules | verified (read): `ISO:223-234` |
| `next_host` | A quarantined row loads with no code; lift on a new hash that loads with success | verified (read): `ISO:236-253`, `ISO:296-301`, `ISO:1-12` |
| `ex_throw_call` | Enqueue, timeout timer, `runAs` in a microtask; `ctx.timeout` calls raw `setTimeout` with no try | verified (read): `WR:817-846` (`enqueue` at `WR:826`), `WR:946-963`; `WWS` row `standing.checked.cordis_containment` |
| `ex_throw_return` | `inSlot` restores the slot; the call answers; `clearTimeout` | verified (read): `WD:46-48`, `WR:974-981`, `WR:990-1000` |
| `ex_throw_fire` | The throw reaches `uncaughtException` with the store of the timer | verified (ran): `late_throw.cjs` (model); verified (ran, earlier video): blame check `timer-throw store` |
| `ex_throw_claim` | The record fields, the stderr line, exit 1, no dispose; timer throw about 65 ms | verified (read): `ISO:342-369`; verified (ran, earlier video): blame check, `timer-throw` 64 ms (run of record `8b9c8672`) and 67 ms (rerun `108d663f`); all nine fault kinds 19 to 103 ms |
| `ex_throw_others` | No stall, no provisional record | inferred from `WDW:150-166` |
| `ex_throw_supervisor` | Code 1, no signal; pid match; 500 ms; not counted; quarantine; windows stay | verified (read): `SUP:58-63`, `SUP:93-94`, `POL:10`, `ISO:214-224`; verified (ran, earlier video): worked example `crash` and `quarantine` steps |
| `ex_loop_call` | `inSlot` writes the index before the handler runs | verified (read): `WR:963`, `ISO:113-115`, `WD:43` |
| `ex_loop_stuck` | The stack never empties; no timers, no routes, no handler | inferred from `run_to_completion` and `src.node_dont_block`; verified (ran): `block_timer.cjs` |
| `ex_loop_stuck` | Other calls wait at the socket | inferred (the kernel keeps the connection until the poll phase reads it) |
| `ex_loop_timeout_fails` | `Promise.race` of handler and timer; the model result | verified (read): `WR:946-974`; verified (ran): `race_timeout.cjs` |
| `ex_loop_provisional` | Provisional record by slot at 500 ms | verified (read): `WDW:165-180`; verified (ran, earlier video): `stall` case writes a provisional record that blames the widget |
| `ex_loop_kill` | Crash record, remove provisional, fd 2 line, `SIGKILL`; 2,050 ms | verified (read): `WDW:181-199`; verified (ran, earlier video): `spin` `exit SIGKILL`, `ms 2050` |
| `ex_loop_supervisor` | Crash record of the dead pid wins; 500 ms; quarantine | verified (read): `SUP:93-94`, `ISO:223-224` |
| `ex_loop_variants` | Loop after `await`: slot 0, no provisional record, unblamed crash record, safe mode after repeats | verified (read): `WDW:169-170`, `WDW:191-193`, `SUP:58-63`, `POL:14`; verified (ran): `slot_await.cjs` |
| `ex_loop_variants` | OOM: stall of at least 500 ms (the check record says at least 508 ms), abort before the 2 s kill | verified (read): `WDW:166`, `WDW:181`; verified (ran, earlier video): `oom` case, "host aborts before the watchdog kill". The time of the abort was not measured. |
| `ex_loop_variants` | OOM: provisional record decides on `SIGABRT` | verified (read): `SUP:93-97`; verified (ran, earlier video): `oom` case; verified (ran): `kill_signal.cjs` (OOM gives `SIGABRT`) |
| `limit_store` | Module top level runs outside any `run` | inferred (the wrap covers `execute`, not the module import, `ISO:290-323`); `RES` tie-in "Unblamed cases" |
| `limit_store` | Listener rule; context loss in callback APIs and custom thenables | verified (ran): `als_emitter.cjs`; verified (read): `src.node_async_context` "Troubleshooting: Context loss" |
| `limit_misblame` | A host timer first made in a widget call blames the widget | verified (read): `WWS:242` |
| `limit_slot` | `ctx.interval` and `ctx.timeout` callbacks run outside `inSlot` | verified (read): `WD:40-49` (the slot is put back when `fn` returns); verified (ran): `slot_await.cjs`. That a timer callback finds slot 0 is inferred. |
| `limit_slot` | In the app such a stall is unblamed | verified (read): `WD:10-12`, `WDW:191-196` |
| `limit_timeout` | The timeout works only for an awaiting handler | verified (read): `WR:935-981`; verified (ran): `race_timeout.cjs` |
| `limit_threshold` | The 2 s threshold comes from one spike | verified (read): `WD:6-8`; `docs/explore/widget-system/where-we-stand.md:242` (`standing.checked.crash_only`) |
| `limit_threshold` | Load can stop a healthy host; the spec keeps the threshold open | verified (read): `CLAUDE.md` `head.commands`; `docs/specs/widget-fv.md:85` `widget_fv.open` |
| `limit_provisional_window` | The heartbeat clears it at the next poll; the innocent-widget case; the planned fix not built | verified (read): `WDW:150-156`, `docs/specs/widget-fv.md:57-67`, `docs/plans/widget-fv.md:13`; `CHAT` (answer at 10:13). The spec says only "the runtime removes the record". `runAs` comes from the chat answer. The window length "about fifty milliseconds" is inferred: the overdue beat fires at the next timers phase, then the poll comes within 50 ms. |
| `limit_pid` | The formal model left PID reuse out | verified (read): `CHAT` (answer at 10:28). Not checked in the model files. |
| `limit_pid` | A reuse inside one restart is rare | inferred |
| `limit_crash_only` | Every widget stops; the quarantine key is row plus hash | verified (read): `ISO:236-245`; the earlier video `isolation_why` |
| `answers_records` | The correction: `ctx.interval` and `ctx.timeout` callbacks carry the store, not the slot | verified (read): `WD:40-49`; `CHAT` (answer at 10:13 lists them under "what sort of widget call") |
| `answers_records` | In the app, the provisional record counts only after an abort; the CLI host applies it | verified (read): `SUP:93-97`, `ISO:225-229` |
| `answers_effect` | The planned fix is a `finally` in `runAs`, not a Cordis effect | verified (read): `docs/specs/widget-fv.md:61`; `CHAT` (answer at 10:13). The spec names no function. `runAs` and the `finally` come from the chat proposal, not from the spec, the plan, or a merged change. |
| `answers_rest` | The five short answers | see the scenes `promise_not_process`, `pid_signals`, `handler_not_watcher`, `als_intro`, `async_chain` |

## Claims left inferred `sources.inferred`

- The task and microtask rules of the browser article also apply to Node (`tasks`).

- An idle host uses almost no processor time (`poll_wait`).

- A call to another widget waits at the socket while the main thread is stuck (`ex_loop_stuck`).

- The provisional window lasts about 50 ms after the call returns (`limit_provisional_window`).

- A PID reuse inside one restart is rare (`limit_pid`). The OS reuse of PIDs is general OS behavior, not run here.

- Module top-level code of a bundle runs outside any `run` (`limit_store`).

- A `ctx.timeout` or `ctx.interval` callback finds the running-widget slot at 0 (`limit_slot`). The `await` case ran; the timer case did not.

- The claimer runs before the first `await` of the release (`claimer_path`), from the JS rule, not from a run of the host.

- The functional framings: promise as a future, `then` as map, `AsyncLocalStorage` as a reader context (`then_continuation`, `als_intro`).

## Reused from the earlier video `sources.reuse`

The earlier video `docs/explainers/2026-11-02-deepwidgets/` (part `part_isolation`) is the source of these facts. Each still holds at `68aabd9a`, because the files did not change (`sources.runs`, row unchanged files):

- The numbers of the watchdog check at `108d663f`: 150 MB parse 868 ms, `spin` killed 2,050 ms after the call, `oom` blamed by the provisional record.

- The blame check: 8 of 9 fault kinds blamed, fault to exit about 20 to 100 ms. The timer throw took 64 ms (run of record) and 67 ms (rerun).

- The crash-only cost of about 2 s per crash, the earlier design that hid host errors, safe mode with built-in widgets only, and the restart of the main window.

The scratch record `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/script-agent/look-before-you-build.md` lists what this script reused in form and in facts.
