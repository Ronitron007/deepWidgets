# Terms of the narration `explainer_loop.terms`

Every technical term that the voice says. `known`: in the viewer model (`viewer-rohan.md`, `viewer.knows`), in the agreed "assume" list of 2026-11-04, or a word of Rohan's own product and questions (the evidence column says which). `teach`: the scene in "Taught in" teaches it with an analogy and a tiny example, and later scenes use it again. "Spoken forms" are the words that `term_gate.py` matches in `narration.md`.

Check: `python3 ~/kyaloon-media/skill-drafts/explainer-video/scripts/term_gate.py docs/explainers/2026-11-04-event-loop/narration.md docs/explainers/2026-11-04-event-loop/terms.md`

| Term | Status | Taught in | Spoken forms | Evidence or note |
|---|---|---|---|---|
| callback | known | | callback, callbacks | assume list |
| promise | known | | promise, promises, dot then | assume list |
| await | known | | await | assume list |
| try, catch | known | | try, catch, dot catch | assume list |
| throw | known | | throw, throws | assume list |
| thread | known | | thread, threads | assume list (the idea) |
| exit code | known | | exit code | assume list |
| queue | known | | queue | assume list |
| JSON | known | | json | assume list (serialization, JSON) |
| race condition | known | | race condition | assume list |
| process | known | | process, processes | assume list (the idea) |
| synchronous | known | | synchronous | he writes async and sync code (`viewer.knows`: async function syntax) |
| V8 | known | | v eight | `viewer.knows` |
| Electron | known | | electron | `viewer.knows` |
| Node | known | | node | his projects; the host is a Node process. A guess: not in `viewer.knows` by name |
| React context, provider, component | known | | react context, provider, component | `viewer.knows`: React |
| widget | known | | widget, widgets | his product |
| action | known | | action, actions | his product (`ctx.widgets.register` actions) |
| plugin | known | | plugin | his product (Cordis plugins) |
| Cordis effect | known | | cordis effect | his own words in the side chat, 2026-11-04 10:13 |
| set timeout | known | | set timeout | the function, from app-level JS; when timers really fire is taught in `timers` |
| global value, module, undefined | known | | global, module, undefined | app-level JS and bundlers (`viewer.knows`) |
| operating system | known | | operating system | implied by "process (as an idea)"; a guess, general computer word. Kernel and system call stay out of the voice. |
| call stack | teach | call_stack | call stack, stack | |
| heap | teach | heap_vs_stack | heap | |
| PID | teach | process_pid | p i d | |
| app process | teach | process_pid | app process | Electron main, named by its job |
| child process | teach | child_process | child process, child, children | |
| host | teach | child_process | host | the child process that runs every widget |
| signal | teach | signals | signal, signals | |
| SIGKILL | teach | signals | sig kill | |
| SIGABRT | teach | exit_info | sig abort, abort | |
| main thread | teach | one_thread | main thread | |
| task queue | teach | task_queue | task queue, task, tasks | |
| event loop | teach | event_loop | event loop | |
| timer | teach | timers | timer, timers | when timers really fire |
| time limit | teach | timers | time limit | the action timeout of deepWidgets |
| microtask queue | teach | microtasks | microtask queue, microtask, microtasks | |
| blocking | teach | blocking | blocking, blocks, block, blocked | |
| exception | teach | exception_vs_rejection | exception, exceptions | |
| rejection | teach | exception_vs_rejection | rejection, rejections, rejected | |
| emitter | teach | emitter_handler | emitter, emit, emits | |
| handler | teach | emitter_handler | handler, handlers | his word for the function that an emitter calls |
| uncaught | teach | uncaught_unhandled | uncaught | |
| unhandled | teach | uncaught_unhandled | unhandled | |
| process handler | teach | process_handlers | process handler, process handlers | |
| crash hook | teach | handler_vs_effect | crash hook | the claimer of version 1, named by its job |
| async chain | teach | async_chain | async chain | |
| async local storage | teach | als | async local storage | |
| get store | teach | als | get store | code name `getStore` |
| worker thread | teach | worker_thread | worker thread, worker | |
| shared memory | teach | shared_memory | shared memory | |
| heartbeat | teach | heartbeat | heartbeat, beat | |
| blame store | teach | blame_store | blame store | |
| wrap | teach | blame_store | wrap | `runAs` |
| crash record | teach | crash_record | crash record, crash records | |
| fingerprint | teach | crash_record | fingerprint | the `hash` of the package files |
| watchdog | teach | watchdog | watchdog | |
| widget number | teach | watchdog | widget number | the running-widget slot, named by its job |
| provisional record | teach | provisional_record | provisional record | |
| supervisor | teach | supervisor | supervisor | |
| quarantine | teach | quarantine | quarantine | |
