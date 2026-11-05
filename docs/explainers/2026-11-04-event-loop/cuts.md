# Cut list `explainer_loop.cuts`

The facts that left the voice under `rules.keep_test`, grouped by the scene where they would sit. Each fact keeps its source. Read this list before any recording. A fact can come back into the voice when you ask for it.

Labels: verified (read), verified (ran), inferred. Path short names: `ISO` `deepwidgets/widgets/src/isolation.ts`, `REC` `records.ts`, `WD` `watchdog.ts`, `WDW` `watchdog-worker.ts`, `WR` `deepwidgets/widgets/src/index.ts`, `SUP` `apps/desktop/src/deepwidgets-supervisor.ts`, `POL` `apps/desktop/src/deepwidgets-crash-policy.ts`, `BOOT` `packages/boot/app-boot/src/index.ts`, `PBOOT` `apps/cli/src/profile-boot.ts`, `HP` `apps/desktop/src/host-process.ts`, `WWS` `docs/explore/widget-system/where-we-stand.md`, `RES` `~/kyaloon-media/explainer-event-loop-2026-11-04/research.md`, `PA` `~/kyaloon-media/explainer-event-loop-2026-11-04/notes/prior-art/`, `V1` the version 1 `sources.md` at `7e1c1c35` (its runs, `notes/script-agent/runs.log`).

## `cold_open`, `outline_map`

| Fact | Source |
|---|---|
| The video of 2026-11-02 (`docs/explainers/2026-11-02-deepwidgets/`) explains the same isolation at the product level. | verified (read): that folder |
| The host is Electron 44.7.0 in Node mode, Node 24.21.0, libuv 1.52.1. The app starts it with `ELECTRON_RUN_AS_NODE=1` and `--expose-internals`. | verified (ran): version line in `V1` `sources.runs`; verified (read): `HP:213-224`, `apps/desktop/src/node-environment.ts:15`, `apps/desktop/src/main.ts:229` |
| The word "slot" has three meanings in the code: the heartbeat cell, the running-widget cell, and the queue slot `AsyncLocalStorage` of a call. The voice avoids the word. | verified (read): `REC:43-48`, `WR:711`, `WR:823-846` |

## `call_stack`, `heap_vs_stack`

| Fact | Source |
|---|---|
| The engine calls a stack entry an execution context (a frame). | verified (read): `src.mdn_microtasks` in `RES` |
| The garbage collector frees heap objects that nothing can reach. | verified (read): MDN "Memory management" (`PA/memory_threads.md`) |
| Memory as a row of numbered boxes (Lin Clark, "A crash course in memory management"). | verified (read): `PA/memory_threads.md` |
| Real engines are looser than "objects on the heap, values on the stack". | inferred (`PA/memory_threads.md`, `ladder.heap`) |

## `process_pid`, `child_process`

| Fact | Source |
|---|---|
| A process is its memory, its registers, and its open files. | verified (read): OSTEP ch. 4 (`PA/os_basics.md`) |
| Every process has one parent; the chain ends at PID 1. | verified (read): Julia Evans, "what's in a process?" |
| A file descriptor is a small number for an open thing. stdin, stdout, stderr are 0, 1, 2, and a child inherits them. | verified (read): Julia Evans, "file descriptors"; Wikipedia "Standard streams" |
| A new process is a clone of its parent that then loads another program (fork, then exec). | verified (read): Julia Evans, "exec will eat your brain" |
| A finished child stays a zombie until its parent reads the exit code. | verified (read): `PA/os_basics.md` |
| The OS can give the PID of a dead process to a new one later. | inferred (general OS behavior); side chat answer at 10:28 |

## `signals`, `exit_info`

| Fact | Source |
|---|---|
| Signal numbers on Linux: SIGHUP 1, SIGINT 2, SIGKILL 9, SIGTERM 15. | verified (read): `signal(7)` |
| SIGSTOP can also not be caught, blocked, or ignored. | verified (read): `signal(7)` |
| A process in uninterruptible sleep (state D) dies from SIGKILL only when it wakes. | verified (read, one source): Naz Quadri, "Signals" |
| systemd sends SIGTERM first, then SIGKILL after a timeout. | verified (read): Naz Quadri, "Signals" |
| `process.on('SIGKILL', fn)` throws `EINVAL`. | verified (ran): `signals.cjs` |
| `child.kill()` and `process.kill(pid)` send SIGTERM by default. `process.kill` only sends a signal. | verified (read): Node docs `child_process`, `process` |
| A shell shows a signal death as 128 plus the signal number: 137 for SIGKILL, 134 for SIGABRT, 143 for SIGTERM. 126 and 127 mean "not executable" and "not found". | verified (read): Wikipedia "Exit status"; 137 and 143 from Docker pages (search snippets) |
| Node's `'exit'` event gives `code = null` and the signal name for a killed child. | verified (ran): `signals.cjs` |
| The out-of-memory child prints `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory` on stderr. | verified (ran): `V1` `kill_signal.cjs` |

## `one_thread`, `task_queue`, `event_loop`

| Fact | Source |
|---|---|
| The engine (V8) runs code. The host runtime (Node) gives timers, I/O, and the loop. | verified (read): `src.mdn_exec_model` |
| MDN calls one JavaScript thread an agent: one heap, one call stack, one job queue. A worker is its own V8 isolate. | verified (read): `src.mdn_exec_model`; V8 embedder guide (`PA/memory_threads.md`) |
| The HTML spec has several task queues, and they are sets: the loop takes the first runnable task. A browser can render between tasks. | verified (read): `src.html_spec` 8.1.7 |
| libuv phase names: timers, pending callbacks, idle and prepare, poll, check, close callbacks. Each phase has a FIFO queue. | verified (read): `src.node_event_loop` |
| Since Node 20 (libuv 1.45), timers run after poll in each turn. | verified (read): `src.node_event_loop` version note |
| The loop sleeps in poll up to the next timer. An idle host uses almost no processor time. | verified (read): `src.libuv_design`; the CPU claim is inferred |
| Network I/O runs on the loop thread (epoll, kqueue). File system work and DNS lookups run in the libuv thread pool: 4 threads by default, `UV_THREADPOOL_SIZE`, at most 1024. The pool runs C work, and the callback comes back to the loop. | verified (read): `src.libuv_design`, `src.node_dont_block` |
| One libuv loop belongs to one thread. | verified (read): `src.libuv_design` |
| The real `queue.cjs` times: node 2 ms, host runtime 1 ms. | verified (ran): `queue.cjs` |

## `timers`

| Fact | Source |
|---|---|
| `setImmediate` against `setTimeout(…, 0)`: at the top level the order is not fixed (96 of 100 runs `immediate` first on the host runtime). Inside an I/O callback, `setImmediate` always runs first. | verified (ran): `V1` `toplevel_race.cjs`, `phases.cjs` |
| An action can set its own `timeoutMs`, and a widget can set one for all its actions. | verified (read): `WR:223-224`, `WR:817-818` |
| A call also waits in a per-widget queue for at most its timeout. A committed write gives `timeout-after-write` with the new revision. | verified (read): `WR:823-846`, `WR:930-960` |
| The exact run times: node 1003 ms, host runtime 1001 ms. | verified (ran): `block_timer.cjs` |

## `microtasks`

| Fact | Source |
|---|---|
| `process.nextTick` has its own queue. In CommonJS it runs before promise callbacks; in an ES module it runs after them. | verified (ran): `V1` `order.cjs`, `order.mjs` |
| The Node docs call `process.nextTick` legacy and point to `queueMicrotask()`. | verified (read): `src.node_process` |
| A microtask that adds a microtask keeps the loop from the next task: a timer waited for 1,000,000 microtasks. | verified (ran): `V1` `microtask_starve.cjs` |
| At `await`, V8 wraps the value in a promise, suspends the function, and resumes it with a `PromiseReactionJob`. An `await` on a native promise costs one microtask tick. | verified (read): `src.v8_fast_async` |
| `ping starts`, `caller goes on`, `ping resumes`: after the first `await`, the rest of an async function runs after the caller went on. | verified (ran): `await_order.cjs` |

## `blocking`, `block_widgets`

| Fact | Source |
|---|---|
| Other blockers: a regular expression with nested quantifiers, sync file APIs, `JSON.parse` of a large text (50 MB in about 1.3 s in the Node guide). | verified (read): `src.node_dont_block` |
| The Node guide's fix: partition with `setImmediate`, or move the work to another thread. | verified (read): `src.node_dont_block` |
| Each call reaches the host as an HTTP request to `/api/widgets/<slug>/call`. While the main thread is stuck, the kernel keeps the connection. | verified (read): routes in `WR`; the wait is inferred |

## `try_stack`, `exception_vs_rejection`

| Fact | Source |
|---|---|
| Node has four channels for an error: a sync throw, a promise rejection, an error-first callback, an emitter `'error'` event. | verified (read): Node docs, Errors |
| `then`, `catch`, and `finally` each return a new promise. A handler never runs at once, even on a settled promise. | verified (read): `src.mdn_promise` |
| An "invisible try and catch" wraps the executor and each `.then` callback, so a throw there becomes a rejection. | verified (read): javascript.info, "Error handling with promises" |
| Operational errors (expected) against programmer errors (bugs): restart on the second kind. | verified (read): goldbergyoni Node best practices |

## `emitter_handler`

| Fact | Source |
|---|---|
| An `'error'` event with no handler throws. | verified (read): `src.node_events` |
| More than 10 handlers on one event name gives a "possible memory leak" warning, not a limit. | verified (read): `src.node_events` |
| `off` removes a handler. The DOM `addEventListener` and `removeEventListener` follow the same pattern. MDN uses "listener" and "handler" for slightly different things. | verified (read): `src.node_events`, MDN "Introduction to events" |
| The name of the pattern is the observer pattern. | verified (read): Refactoring.Guru "Observer" |

## `uncaught_unhandled`, `process_handlers`

| Fact | Source |
|---|---|
| The spec hook `HostPromiseRejectionTracker` tells the host when a promise rejects with no handler, and when a handler comes later. | verified (read): uhyo, Zenn (2020) |
| A `.catch` added after `await null` is in time. A `.catch` added in a timer is too late. | verified (ran): `PA/errors_events.md` (Node 22.23) |
| Node 15 changed the default from a warning to a throw. The flag is `--unhandled-rejections=mode`. | verified (read): Node CLI docs |
| The handler gets a second argument `origin`: `'uncaughtException'` or `'unhandledRejection'`. | verified (ran): `process_handlers.cjs` |
| With a handler, the exit code is 0 unless `process.exitCode` is set. | verified (ran): `PA/errors_events.md` |
| In the host, DSH `installFailLoud` adds the two process handlers. Its async release calls the deepWidgets fatal hooks under `Symbol.for('deepwidgets.fatal.hooks')` before its first `await`. | verified (read): `BOOT:926-927`, `PBOOT:313-320`, `PBOOT:365-400`; the order is inferred from the JS rule |

## `promise_not_process`, `handler_vs_effect`

| Fact | Source |
|---|---|
| Functional framing: a promise is close to an eager, memoized future. `.then` is close to `map` or `flatMap`. A process handler is a global sink. | inferred framing (side chat at 10:28) |
| A Cordis effect is the acquire and release pattern (bracket, RAII, `Effect.acquireRelease` in Effect-TS). Cordis runs the cleanups in reverse order. | inferred framing (side chat at 10:26); `.agents/skills/cordis/` |
| The same reload experiment: raw timers went from 19 to 76 ticks per second, the heap from 75 MB to 119 MB. | verified (read): `docs/explore/widget-system/plugins-spike.md:110` |
| The lint gate of widget creation refuses raw `setTimeout`, `setInterval`, `setImmediate`, `queueMicrotask`. It does not refuse `process.on` (the side chat said it would). | verified (read): `deepwidgets/mcp/src/creation.ts:225-243` (`V1` row `effect_vs_listener`) |

## `async_chain`, `als`, `handler_reads_store`

| Fact | Source |
|---|---|
| An async resource is an object with a callback for later: once, many times, or never. `executionAsyncId()` says when code runs, `triggerAsyncId()` says why. | verified (read): `src.node_async_hooks` |
| `async_hooks.createHook` is experimental, and the docs discourage it. `destroy` may never run. Each worker thread has its own async ids. | verified (read): `src.node_async_hooks` |
| A stack trace shows only `await` sites of the async chain (zero-cost async stack traces, V8 7.3). | verified (read): `src.v8_fast_async` |
| The store travels when a callback is registered (timer set, `then` called), not when it runs. | verified (read): `src.tc39_async_context` FAQ, `src.wintertc_als` |
| Context can get lost through callback APIs and custom thenables. `AsyncResource` and `util.promisify` repair it. | verified (read): `src.node_async_context` |
| Node 24 backs `AsyncLocalStorage` with `AsyncContextFrame`. Node 22 uses async_hooks. The host runtime (Electron 44) has the frame on. | verified (ran): `V1` `acf_probe` |
| `enterWith` exists and is experimental. | verified (read): `PA/async_context.md` |
| `uncaughtException` handlers run before the `after` hook, so the failed callback's context is current. For `unhandledRejection`, Node 24 restores the context from the moment the promise rejected. | verified (read): `src.node_async_hooks` "after(asyncId)"; Node `lib/internal/process/promises.js` v24.x lines 259-266, 472-477 |
| Other languages: thread-local storage, Java `ScopedValue`, Python `ContextVar`, Go `context.Context` (passed by hand), dynamic scope, the TC39 `AsyncContext` proposal (Stage 2). | verified (read): `PA/async_context.md` (cut by the agreed scope) |
| Functional framing: async local storage is a Reader context, or dynamic scope, for async code. | inferred framing |

## `worker_thread`, `shared_memory`, `heartbeat`

| Fact | Source |
|---|---|
| A worker thread is a separate V8 isolate with its own libuv loop. | verified (read): V8 embedder guide; `src.libuv_design` |
| `workerData` and `postMessage` copy with the structured clone algorithm. Functions and prototypes do not survive. A transfer moves a buffer, and the sender loses it. | verified (read): `src.node_workers`, MDN structured clone, Lin Clark |
| The shared counter is `Atomics`: `add`, `load`, `store`, `exchange`. The operations are sequentially consistent. `Atomics.wait` sleeps a thread. | verified (read): `src.mdn_sab_atomics`, `src.mdn_exec_model` |
| Browsers need cross-origin isolation for `SharedArrayBuffer`. Node does not. | verified (read): `src.mdn_sab_atomics`; the Node part inferred |
| Worker stdout and stderr go through the main thread, so a stuck main thread holds them. The watchdog writes to file descriptor 2 directly. | verified (read): `src.node_workers`, `WDW:52-55`; verified (ran): `V1` `heartbeat.cjs` |
| `worker.unref()` lets the host exit while the watchdog runs. | verified (read): `WD:106` |
| The Sentry event loop block detection uses the same design (heartbeat 50 ms, 5 s threshold), and it reports instead of killing. | verified (read): Sentry docs (`PA/crash_only.md`) |
| A watchdog that healthy code feeds blindly proves nothing. | verified (read): Memfault watchdog guide |
| The exact heartbeat run on the host runtime: 743 ms / 520 ms and 1260 ms / 1037 ms. | verified (ran): `heartbeat.cjs` |

## `blame_store`

| Fact | Source |
|---|---|
| The value is the Loader entry id of the widget row, which can have group ids in front. The row id starts with `deepwidgets-widget-`, or `deepwidgets-agent-` for an agent bundle. | verified (read): `ISO:34`, `ISO:59-62`, `ISO:88-91` |
| Cordis has no hook around a plugin body, so the runtime wraps the fiber runner `execute`. A child fiber that shares its parent's entry is not a widget row. The dispose step puts each original `execute` back. | verified (read): `ISO:283-329` |
| An action handler runs in a microtask, inside `runAs` (`Promise.resolve().then(() => runAs(…))`). | verified (read): `WR:963` |
| Timers, intervals, and effects that the widget start creates inherit the store. | verified (read): side chat at 10:13; `ISO:1-12` |

## `crash_record`

| Fact | Source |
|---|---|
| With no store, the hook matches the error stack against each widget's package folder (`method: 'stack'`). | verified (read): `ISO:332-347` |
| The write goes to a temp file, then a rename, so a reader never sees half a file. | verified (read): `REC:81-87` |
| The hook writes one stderr line and then calls `process.exit(1)` with no cleanup. | verified (read): `ISO:363-368` |
| Record fields `method`, `root`, `slugs`, `applied`. The hash covers at most 2,000 files, without `node_modules` and dot folders. | verified (read): `REC:12`, `REC:25-41`, `REC:89-124` |
| Erlang's "let it crash" (Joe Armstrong), supervision trees (Fred Hebert), Valerie Aurora's LWN article on crash-only software. | verified (read): `PA/crash_only.md` |

## `watchdog`

| Fact | Source |
|---|---|
| The beat period is `max(20, min(100, threshold / 5))` = 100 ms. The poll period is half of it, 50 ms. | verified (read): `WD:25-29` |
| The stall clock is monotonic (`performance.now()`). A poll gap of half the threshold means the whole process was stopped or asleep, so the clock starts again. | verified (read): `WDW:132-164` |
| `@sentry/node-native-stacktrace` can read the stack and the store of the stuck thread. Under Electron it has no build, so the app blames by the widget number only. The read waits for the main thread up to 5 s, so it runs only on the kill path after the number found no widget, and then the record is written again. | verified (read): `WD:10-12`, `WD:56-74`, `WDW:74-106`, `WDW:191-197` |
| The watchdog runs inside a Cordis effect. Its cleanup stops the beat and the thread, and deletes a provisional record of this process. | verified (read): `WD:121-135` |
| The 150 MB parse took 868 ms, and the host lived. | verified (ran, earlier video): `tools/widgets-watchdog.mjs` at `108d663f` |

## `provisional_record`

| Fact | Source |
|---|---|
| The record has `method: 'slot'` and the message "the event loop stalled for at least … ms". | verified (read): `WDW:166-180` |
| The watchdog removes the record only when its `pid` and `at` still match. | verified (read): `WDW:124-130` |
| A host ignores a provisional record of its own PID. A crash record of the same PID wins, and the host marks the provisional record applied. | verified (read): `ISO:225-234` |
| A host with no supervisor, such as the CLI host, applies a provisional record after any end. | verified (read): `ISO:225-229` |
| The planned rule is `widget_fv.crash` (`docs/specs/widget-fv.md:61`), in the plan unit `widget.crash_records`. The side chat proposed a `finally` in `runAs`; the spec names no function. | verified (read): `docs/specs/widget-fv.md:61`, `docs/plans/widget-fv.md:13` |

## `supervisor`

| Fact | Source |
|---|---|
| The numbers: waits of 500, 2,000, and 8,000 ms; a window of 60 s; built-in widgets only (safe mode, `DEEPWIDGETS_SAFE_MODE`) from 2 unblamed crashes; the give-up and the DSH fatal dialog at 4. A blamed crash waits 500 ms. | verified (read): `POL:10-16`, `POL:38-50`, `SUP:13-14`, `SUP:160-168` |
| SIGTRAP, SIGILL, and exit code 134 also count as an abort. | verified (read): `SUP:70-79` |
| The supervisor owns failures only after the first host was ready. A second failure while a restart waits is the same outage. | verified (read): `SUP:141-155` |
| Each event logs one line `deepwidgets-supervisor {json}`. The restart reloads the main window; widget windows show fresh data about 2.1 s after a crash. | verified (read): `SUP:16-18`, `SUP:116-118`; `WWS:242` |
| A host that dies at boot before it applies an older record counts as unblamed. | verified (read): `SUP:52-57` |

## `quarantine`

| Fact | Source |
|---|---|
| During a `widget_install`, the lift waits until the whole install succeeds. Agent rows have a second id with `.b`. | verified (read): `ISO:255-281`, `ISO:389-401` |
| The key is the Loader row, not the exported plugin name, so one bundle cannot get another widget quarantined. | verified (read): `ISO:17-18` |
| The reason text has at most 500 characters. The host marks each record `applied: true`. | verified (read): `ISO:214-222` |
| Prior art for "keep it off": Fowler's breaker states (closed, open, half-open), Kubernetes CrashLoopBackOff (10 s doubling to 300 s), Android Rescue Party, systemd's start limit, poison-pill messages. | verified (read): `PA/crash_only.md` |

## `ex_throw_path`, `ex_throw_record`

| Fact | Source |
|---|---|
| `ctx.timeout` calls the raw `setTimeout` with no try and catch. | verified (read): `WWS` `standing.checked.cordis_containment` |
| The blame check blamed 8 of 9 fault kinds. All kinds took 19 to 103 ms from fault to exit; the timer throw 64 ms (run of record `8b9c8672`) and 67 ms (rerun `108d663f`). | verified (ran, earlier video): `V1` `sources.reuse` |

## `ex_loop_stall`, `ex_loop_restart`, `ex_loop_oom`

| Fact | Source |
|---|---|
| In the check, the out-of-memory record came at 508 ms. The time of the abort was not measured. | verified (ran, earlier video): `V1` row `ex_loop_variants` |

## `limit_blame_gaps`, `limit_provisional`, `limit_threshold`

| Fact | Source |
|---|---|
| A host timer that a widget call first creates carries the widget's store, so a later host error blames that widget. | verified (read): `WWS:242` |
| In the CLI host, the native module can blame a loop after an `await` or in a timer. | verified (read): `WD:10-12` |
| The stall of 2026-11-02 at 17:15 lasted 2,061 ms with no widget call, while the machine was busy. | verified (read): `docs/specs/widget-fv.md:85` |
| A PID reuse inside one restart is rare. | inferred |
