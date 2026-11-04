# Glossary `explainer_loop.glossary`

Each term is defined in the narration at its first use. The scene name in brackets is the scene of that first use. The terms of the earlier videos (`docs/explainers/2026-11-02-deepwidgets/glossary.md`, `docs/explainers/2026-11-03-widget-kit/glossary.md`) keep their meaning here.

| Term | Meaning |
|---|---|
| host | The Node process that runs the code of every widget. In the app it is Electron 44.7.0 in Node mode (Node 24.21.0). [`outline_map`] |
| main thread | The one thread of the host that runs all JavaScript of the widgets and of the host. [`outline_map`] |
| event loop | The part of Node (libuv) that picks the next callback to run. One loop belongs to one thread. [`outline_map`] |
| call stack | The list of the functions that run now. A call pushes a frame, a return pops it. [`outline_map`] |
| microtask queue | The queue of small callbacks that run right after the current code, before the next task. [`outline_map`] |
| phase | One step of the Node loop ring, with its own callback queue: timers, pending callbacks, idle and prepare (internal), poll, check, close callbacks. [`outline_map`] |
| action handler | A widget function that runs when a user or an agent calls an action of the widget. [`outline_walk`] |
| blame store | The `AsyncLocalStorage<string>` in `isolation.ts` whose value is the Loader row id of the widget whose async chain runs. [`outline_walk`] |
| process handler | A listener on the Node `process` object, here for `uncaughtException` or `unhandledRejection`. [`outline_walk`] |
| watchdog thread | The worker thread of the host that polls the heartbeat slot and kills a stuck host (`watchdog-worker.ts`). [`outline_walk`] |
| provisional record | `$DSH_HOME/deepwidgets/provisional.json`: a crash record with event `provisional-stall` that the watchdog thread writes at a stall of 500 ms. [`outline_walk`] |
| crash record | `$DSH_HOME/deepwidgets/crash.json`: the `CrashRecord` that the claimer or the watchdog thread writes before the host ends. [`outline_walk`] |
| Electron main | The Electron process that makes the windows and starts the host child. [`outline_walk`] |
| supervisor | `DesktopHostSupervisor` in Electron main. It reads the records after a host exit and starts a new host. [`outline_walk`] |
| pinger, spinner | The two illustrative widgets of this video. `pinger.ping` sets a 3 s timer that throws; `spinner.spin` loops forever. [`example_cast`] |
| engine | The program that parses and runs JavaScript. In Node and Electron: V8. [`engine_and_host`] |
| host runtime | The program around the engine that gives timers, files, the network, and the event loop (Node, a browser). Not the same as the host. [`engine_and_host`] |
| agent (MDN) | MDN's word for one thread of JavaScript: one heap, one call stack, one job queue. [`engine_and_host`] |
| heap | The memory where the objects of one agent live. [`engine_and_host`] |
| frame | The entry of one call on the call stack. It holds the local values of that call. [`call_stack`] |
| run-to-completion | The rule that a callback runs until the stack is empty again, with no interruption. [`run_to_completion`] |
| task | One callback that the loop starts from a queue: a timer callback, an I/O callback, a request callback. [`tasks`] |
| microtask | A small callback that runs right after the current code: promise callbacks, the code after an `await`, `queueMicrotask`. [`microtasks`] |
| drain | To run the callbacks of a queue until it is empty, including callbacks that the drain itself adds. [`microtasks`] |
| `queueMicrotask` | The function that adds a callback to the microtask queue. [`microtasks`] |
| `process.nextTick` | A Node function that adds a callback to the next tick queue. The docs mark it Legacy. [`order_example`] |
| next tick queue | A Node queue that drains before the promise microtasks, after the current operation. Not a phase. [`order_walkthrough`] |
| libuv | The C library that runs the Node event loop and the thread pool. Spoken "lib u v". [`libuv_ring`] |
| timers phase | The phase that runs `setTimeout` and `setInterval` callbacks whose time has come. [`libuv_ring`] |
| pending phase | The phase that runs some I/O callbacks that the system held back from an earlier turn. [`libuv_ring`] |
| poll phase | The phase that waits for I/O, up to the time of the next timer, and runs I/O callbacks. [`libuv_ring`] |
| check phase | The phase that runs `setImmediate` callbacks. [`libuv_ring`] |
| close phase | The phase that runs `'close'` callbacks. [`libuv_ring`] |
| `setImmediate` | A Node function that adds a callback to the check phase. [`libuv_ring`] |
| ES module | A JavaScript module in the `import` and `export` format (`.mjs`). Its order of next tick and promise callbacks differs from CommonJS. [`next_tick`] |
| thread pool | The libuv pool of threads (default 4) for file system work and DNS lookups. It runs C work, not JavaScript. [`thread_pool`] |
| blocking | A callback holds the call stack for a long time, so the loop cannot reach any phase. [`block_everything`] |
| preemption | A scheduler stops a running job to give time to another job. Node has none between callbacks. [`block_everything`] |
| partition | To split long work into short steps with `setImmediate` between them. [`block_remedies`] |
| offload | To move long work to another thread. [`block_remedies`] |
| promise | An object that stands for a value that is not known yet. States: pending, fulfilled, rejected. Settled means fulfilled or rejected. [`promise_value`] |
| operating system process (OS process) | A running program with its own memory and a PID. The host is one. [`promise_not_process`] |
| Node `process` object | One global `EventEmitter` that stands for the OS process inside JavaScript. [`promise_not_process`] |
| continuation | The code that runs after a value is ready: the callback of `then`, or the rest of an async function after `await`. [`then_continuation`] |
| `then` | The promise method that adds a one-time continuation and returns a new promise. [`then_continuation`] |
| `await` | Suspends an async function, returns a promise to the caller, and resumes the function later in a microtask. [`await_continuation`] |
| piece (of an async function) | The code between two `await`s. The first piece runs at once; each later piece runs later. [`await_split`] |
| event emitter | An object with a table from event names to lists of listeners (`on`, `off`, `emit`). [`emitter_table`] |
| listener | A function in the table of an emitter. Handler is a common second word for it. [`emitter_table`] |
| `emit` | Calls each listener of one event name, synchronously, in the order of registration. [`emitter_table`] |
| observer pattern | The design where a subject (the emitter) calls its observers (the listeners). [`emit_sync`] |
| `uncaughtException` | The `process` event for a throw that left the stack with no catch. [`process_handlers`] |
| `unhandledRejection` | The `process` event for a rejection with no handler within a turn of the loop. [`process_handlers`] |
| global sink | A process handler: the last stop of the errors that escape every local handler. [`last_resort_sink`] |
| Cordis effect | A function given to `ctx.effect` that does a side effect and returns a disposer. [`effect_vs_listener`] |
| disposer | A function that undoes a side effect. Cordis runs it when the plugin stops or reloads. [`effect_vs_listener`] |
| lint gate | The oxlint step of widget creation. It refuses raw `setTimeout`, `setInterval`, `setImmediate`, and `queueMicrotask` in agent code. [`effect_vs_listener`] |
| TC39 | The committee that changes the JavaScript language. Spoken "T C thirty-nine". [`lost_context`] |
| async chain | The tree of async work that one piece of code starts: each callback that runs later because that code scheduled it. [`async_chain`] |
| schedule | To make a timer, call `then`, or start some I/O, so a callback runs later. [`async_chain`] |
| async hooks | The Node module `node:async_hooks` that tracks async resources. Its `createHook` API is Experimental. [`async_ids`] |
| async resource | An object with a callback that runs later, such as a timer or a promise. [`async_ids`] |
| `asyncId` | The number of one async resource. [`async_ids`] |
| `triggerAsyncId` | The `asyncId` of the code that was current when code made the resource: the parent link of the async chain. [`async_ids`] |
| `AsyncLocalStorage` | A Node class that carries one value along an async chain. Not browser `localStorage`. Spoken "async local storage". [`als_intro`] |
| browser `localStorage` | Browser string key-value storage on disk, per origin, across reloads. [`als_intro`] |
| reader context, dynamic scope | Functional names for a value in scope for a computation and everything it spawns, without an argument. [`als_intro`] |
| `run` | `AsyncLocalStorage.run(value, fn)`: runs `fn` at once with `value` as the store. [`als_run`] |
| `getStore` | `AsyncLocalStorage.getStore()`: the value of the current chain, or `undefined` outside any `run`. [`als_run`] |
| registration time | The moment when code makes a timer or calls `then`. The callback keeps the store of that moment. [`als_capture`] |
| WinterTC | The Ecma committee for server-side JavaScript runtimes. Its common-minimum API page describes `AsyncLocalStorage`. [`als_capture`] |
| async context frame | The Node 24 design behind `AsyncLocalStorage`: each `run` makes a frame, and each new async resource keeps the current frame. [`als_frame`] |
| worker thread | A second JavaScript thread in the same process, with its own heap, call stack, and event loop (`node:worker_threads`). [`worker_thread`] |
| `SharedArrayBuffer` | Raw memory that more than one thread sees at the same time. A post gives a new view, not a copy. [`shared_memory`] |
| slot | In this video: one `Int32` of the shared buffer. [`shared_memory`] |
| heartbeat slot | `Int32Array[0]`: the counter that the main thread adds 1 to every 100 ms (`BEAT_SLOT`). [`shared_memory`] |
| running-widget slot | `Int32Array[1]`: the index of the widget row whose sync code runs, or 0 (`RUNNING_SLOT`). [`shared_memory`] |
| Atomics | Functions that read or write shared memory in one indivisible step: `add`, `load`, `store`, `exchange`. [`atomics`] |
| sequentially consistent | Every thread sees the atomic operations in one agreed order. [`atomics`] |
| file descriptor two | The standard error output of the process (fd 2). [`heartbeat_demo`] |
| PID | Process ID: the number that the OS gives a running process. `process.pid`. The OS can give it to a new process later. [`pid_signals`] |
| signal | A short message from the OS to a process, such as `SIGKILL` or `SIGABRT`. [`pid_signals`] |
| `SIGKILL` | The signal that ends a process at once. No listener can catch it. Spoken "sig kill". [`pid_signals`] |
| `SIGABRT` | The abort signal (6). V8 ends the process with it on an out-of-memory error. Spoken "sig abort". [`abort_exit`] |
| abort exit | An exit by `SIGABRT`, `SIGTRAP`, or `SIGILL`, or with exit code 134 (128 + 6). [`abort_exit`] |
| Loader row | One line of the plugin list of the host. A widget row id starts with `deepwidgets-widget-` or `deepwidgets-agent-`. [`run_as`] |
| `runAs` | `runAs(row, fn)`: `blameStore.run(row, () => inSlot(row, fn))` (`ISO:113-115`). Spoken "run as". [`run_as`] |
| `inSlot` | Runs `fn` with the row index in the running-widget slot, and puts the old value back in `finally` (`WD:40-49`). Spoken "in slot". [`run_as`] |
| fiber | The Cordis object that owns one loaded plugin. [`fiber_wrap`] |
| fiber runner | The internal part of a fiber (`_runner.execute`) that runs the plugin body. The runtime wraps it. [`fiber_wrap`] |
| fail-loud listener | The DSH listeners of `installFailLoud` for `uncaughtException` and `unhandledRejection` (`BOOT:880-929`). [`claimer_path`] |
| fatal hook | A function under `Symbol.for('deepwidgets.fatal.hooks')` that the fail-loud release calls before its first `await`. [`claimer_path`] |
| claimer | The fatal hook of the widget runtime (`claim`, `ISO:342-369`). It writes the crash record and exits the host. [`claimer_path`] |
| quarantine | `$DSH_HOME/deepwidgets/quarantine.json`: the rows that load with no code until files with a new hash load with success. [`crash_record`] |
| crash-only host | A host that exits on a fatal error instead of going on. [`crash_only`] |
| queue slot | The runtime `AsyncLocalStorage<Slot>` (`WR:711`) that marks which call holds the queue of a widget. No role in blame. [`slot_names`] |
| heartbeat | The `setInterval` of 100 ms on the main thread that adds 1 to the heartbeat slot (`WD:123`). [`heartbeat_beat`] |
| `unref` | Lets the process exit when this timer or worker is the only thing left. [`heartbeat_beat`] |
| stall clock | The time since the watchdog thread last saw a new beat, on `performance.now()`. [`watchdog_poll`] |
| monotonic clock | A clock that only moves forward and ignores changes of the wall clock. [`watchdog_poll`] |
| threshold | The stall length that kills the host: 2,000 ms (`WATCHDOG_THRESHOLD_MS`). A quarter of it, 500 ms, writes the provisional record. [`provisional_record`] |
| native module | `@sentry/node-native-stacktrace`: reads the stack and store of a blocked thread from another thread. No Electron build in the desktop host. [`kill_path`] |
| safe mode | A host start that runs only the built-in widgets, after two unblamed crashes in 60 s. [`backoff`] |
| unblamed crash | A host exit whose records name no widget. It counts toward safe mode and the give-up. [`backoff`] |
| `widget_fv.crash` | The spec section with the planned rule that a provisional record lives only while its call runs (`docs/specs/widget-fv.md:57-63`). Not built at `68aabd9a`. [`limit_provisional_window`] |
