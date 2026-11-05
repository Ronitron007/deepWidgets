# Glossary `explainer_loop.glossary`

Each term that the video teaches, in the order of the video. The scene name in brackets is the scene that teaches it. `terms.md` lists the spoken forms and the terms that the video assumes.

| Term | Meaning |
|---|---|
| call stack | The list of the function calls that run now, newest on top. A call puts an entry on top, a return takes it off. It also holds the local values of each call. Picture: a pile of pancakes. [`call_stack`] |
| heap | The area of memory where objects live. The call stack holds only arrows (references) to them. Each Node thread has its own heap. [`heap_vs_stack`] |
| PID | Process ID: the number that the operating system gives one running process. JavaScript reads it as `process.pid`. The OS can reuse a PID after the process ends. [`process_pid`] |
| app process | The first process of deepWidgets: Electron main. It owns the windows and starts the host. [`process_pid`] |
| child process | A process that another process (its parent) started. It has its own PID and memory, and it knows its parent's PID (`process.ppid`). [`child_process`] |
| host | The child process of the app process that runs the code of every widget (Electron 44.7.0 in Node mode, Node 24.21.0). [`child_process`] |
| signal | A short numbered message that the operating system delivers to a process by its PID. A process can catch most signals with its own function. [`signals`] |
| SIGKILL | The signal that ends a process at once. No code of the target runs, and Node does not let a program listen for it. [`signals`] |
| SIGABRT | The abort signal. V8 ends a process with it, for example when the heap is full. No JavaScript runs at the end. [`exit_info`] |
| main thread | The one thread of the host that runs all widget JavaScript. One thread, one call stack. [`one_thread`] |
| task, task queue | A task is one callback that is ready to run: a call from a window, a finished file read, a passed delay. The task queue is the first-in, first-out line where tasks wait. [`task_queue`] |
| event loop | The loop inside Node that waits for an empty call stack, then takes the next task and runs it. It sleeps when nothing is ready. [`event_loop`] |
| timer | A request to run a callback later (`setTimeout`, `setInterval`). The delay is a minimum: the callback still waits for an empty call stack. [`timers`] |
| time limit | The timeout of one widget action call, 5 s by default (`DEFAULT_TIMEOUT_MS`, `deepwidgets/widgets/src/index.ts:33`). It is a timer. [`timers`] |
| microtask, microtask queue | A microtask is a small callback that runs right after the current code: a promise `.then` callback, or the rest of an async function after `await`. The event loop runs every microtask, until the queue is empty, before the next task. [`microtasks`] |
| blocking | One piece of code holds the call stack for a long time, so no task and no microtask can run. [`blocking`] |
| exception | A thrown error. It falls down the call stack until a `catch` takes it. [`exception_vs_rejection`] |
| rejection | The failed result of a promise. It stays on the promise until `.catch` or an `await` inside `try` takes it. [`exception_vs_rejection`] |
| emitter | An object with a table: event name to a list of functions. `on` adds a function, `emit` calls each function of a name at once, in order. [`emitter_handler`] |
| handler | One function in an emitter's list. It does nothing until the emitter calls it. It is not a watcher. [`emitter_handler`] |
| uncaught exception | A throw that fell off the bottom of the call stack with no `catch` on the way. [`uncaught_unhandled`] |
| unhandled rejection | A rejected promise that still has no handler when Node checks, after the current code and its microtasks. [`uncaught_unhandled`] |
| process handler | A handler on the Node `process` emitter, here for `uncaughtException` or `unhandledRejection`. It replaces the default exit and gets only the error. [`process_handlers`] |
| crash hook | The deepWidgets function that the host's process handlers call on a fatal error (`claim` in `isolation.ts:342-369`, added through a Cordis effect at `isolation.ts:370-375`). Version 1 called it the claimer. [`handler_vs_effect`] |
| async chain | All the work that one piece of code starts, now or later: timers, promise callbacks, and what those start. Node links each piece to the piece that created it (`asyncId`, `triggerAsyncId`). [`async_chain`] |
| async local storage | `AsyncLocalStorage` from `node:async_hooks`. `run(value, fn)` gives `fn` and every callback that it starts one value. Not the browser's `localStorage`. [`als`] |
| get store | `getStore()`: reads the value of the current async chain, or `undefined` outside any `run`. [`als`] |
| worker thread | A second JavaScript thread in the same process (`node:worker_threads`), with its own call stack, heap, and event loop. [`worker_thread`] |
| shared memory | A `SharedArrayBuffer`: memory that two threads read and write directly, with no copy and no queue. The code changes it with a shared counter (`Atomics`): each add or read is one step that no other thread can split. [`shared_memory`] |
| heartbeat | A shared counter that a healthy main thread adds one to every 100 ms. A worker thread that sees no change knows that the main thread is stuck. [`heartbeat`] |
| blame store | The one async local storage of the host (`isolation.ts:51`). Its value names the widget whose async chain runs (in the code: the Loader entry id of the widget row). [`blame_store`] |
| wrap | `runAs(row, fn)` (`isolation.ts:113-115`): it runs widget code inside the blame store and with the widget number set. It wraps the start of a widget and each action call. [`blame_store`] |
| crash record | `$DSH_HOME/deepwidgets/crash.json`: the JSON record of one fatal crash (widget, event, error, time, method, package folder, fingerprint, PID). The crash hook or the watchdog writes it before the host ends. [`crash_record`] |
| fingerprint | The `hash`: a sha256 of the paths and contents of a widget's package files (`records.ts:111-124`). [`crash_record`] |
| watchdog | The worker thread of the host that looks at the heartbeat every 50 ms. At a 2 s stall it writes a crash record and sends SIGKILL to its own process (`watchdog-worker.ts`). [`watchdog`] |
| widget number | The second cell of the shared memory: the index of the widget whose synchronous code runs, or 0 (`RUNNING_SLOT`, `records.ts:45-46`). Version 1 called it the running-widget slot. [`watchdog`] |
| provisional record | `$DSH_HOME/deepwidgets/provisional.json`: the early note of the watchdog at a 500 ms stall, blamed by the widget number only. It has the crash record fields, with the event `provisional-stall`. The watchdog deletes it when the heartbeat returns. [`provisional_record`] |
| supervisor | `DesktopHostSupervisor` in the app process. After a host exit it reads the records, matches the PID, and starts a new host after a wait. [`supervisor`] |
| quarantine | The list in `$DSH_HOME/deepwidgets/quarantine.json`. The host does not run a widget in it while the widget's files keep the blamed fingerprint. New files that load with success lift it. [`quarantine`] |
