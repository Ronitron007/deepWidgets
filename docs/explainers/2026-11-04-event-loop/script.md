# Explainer script v2: the event loop under deepWidgets `explainer_loop.script`

Version 2, written from scratch on 2026-11-05 under the creation rules of the `explainer-video` skill (`rules.term_gate`, `rules.term_budget`, `rules.floor_first`, `rules.general_then_ours`, `rules.keep_test`, `rules.scene_shape`). Version 1 (95 scenes, 65 min) stays in git at `7e1c1c35`.

Code base: branch `rohan/explainer-event-loop-2026-11-04` at `3bc10af2`. The deepWidgets code that the video names (`isolation.ts`, `records.ts`, `watchdog.ts`, `watchdog-worker.ts`, `index.ts`, `deepwidgets-supervisor.ts`, `deepwidgets-crash-policy.ts`) is the same as at `68aabd9a`, the base of version 1 (`sources.md`, `sources.runs`).

Files: `narration.md` (the voice only), `terms.md` (every term the voice says, for `term_gate.py`), `glossary.md`, `sources.md` (each claim, its evidence, the runs), `cuts.md` (the facts that left the voice, by scene). The widgets `pinger` and `spinner` are illustrative. Every code output on screen is real (`sources.runs`).

Scenes: 45. Narration words: 5004. Total target: 35.7 min at 140 words per minute.

## Parts `explainer_loop.parts`

| Part | Content | Scenes | Words | Target |
|---|---|---|---|---|
| `part_intro` | the whole path, in plain words | 3 | 294 | 2.1 min |
| `part_memory` | call stack and heap | 2 | 195 | 1.4 min |
| `part_processes` | processes, PIDs, signals | 4 | 441 | 3.1 min |
| `part_loop` | task queue, event loop, timers, microtasks, blocking | 7 | 707 | 5.0 min |
| `part_errors` | errors, emitters, process handlers | 7 | 800 | 5.7 min |
| `part_context` | async chain and AsyncLocalStorage | 3 | 343 | 2.5 min |
| `part_threads` | worker thread, shared memory, heartbeat | 3 | 356 | 2.5 min |
| `part_boxes` | the deepWidgets boxes | 6 | 801 | 5.7 min |
| `part_example_throw` | worked example: the late throw | 2 | 220 | 1.6 min |
| `part_example_loop` | worked example: the endless loop | 3 | 284 | 2.0 min |
| `part_limits` | the limits | 3 | 326 | 2.3 min |
| `part_close` | answers and close | 2 | 237 | 1.7 min |

## `cold_open`

- Part: `part_intro`
- Target length: 32 s (75 words)

**Narration**

This video explains how deepWidgets survives a widget that crashes or freezes. It also explains the JavaScript and Node rules underneath.

In a side chat, you asked eight questions about this code. Each question gets a plain answer, at the moment the video has the words for it. Each new word gets a picture and a tiny example before we use it. Details that the picture does not need go to a separate cut list.

**Visuals**

Dark screen. Title `How deepWidgets survives a bad widget`. Subtitle `branch rohan/explainer-event-loop-2026-11-04, code at 3bc10af2`. The eight question cards from the side chat of 2026-11-04 (`notes/source-chat-btw.md`) appear one by one, in Rohan's words, each with a small tag naming the scene that answers it: `what does the provisional record contain? which calls? how does it work with blame?` (`provisional_record`, `ex_loop_oom`), `is it like a Cordis effect with its own cleanup?` (`provisional_record`), `what is a process handler, and how is it different from a Cordis effect?` (`process_handlers`, `handler_vs_effect`), `is a promise a process? is .then the handler?` (`promise_not_process`), `what is a PID?` (`process_pid`), `is a handler a watcher?` (`emitter_handler`), `is AsyncLocalStorage like browser localStorage?` (`als`), `what is an async chain?` (`async_chain`). The cards shrink into a checklist at the right edge; each gets a tick when its scene plays. Legend at the bottom for the whole video: white tag `ran` (we ran it), grey tag `read` (code or docs), amber tag `inferred`.

## `outline_map`

- Part: `part_intro`
- Target length: 52 s (121 words)

**Narration**

Here is the whole path on one picture. We follow it from left to right.

A widget runs its code inside one process, together with all the other widgets. Two things can go wrong. The code can throw an error later, after its call returned. Or the code can loop forever and freeze everything.

Then four jobs follow. Something must notice the problem. Something must find which widget caused it, and write that down on disk. Something must start the widget process again. And the next start must keep the bad widget off, so that the other widgets run.

Each box on this picture gets its real name later in the video. We come back to this picture between the parts.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. Under each box a grey placeholder `?` for its code name. The placeholders fill in during `part_boxes`: `notice` gets `process handlers` and `watchdog + heartbeat`, `find who` gets `blame store`, `write it down` gets `crash.json` and `provisional.json`, `start again` gets `supervisor (app process)`, `keep it off` gets `quarantine`. Each box lights as the voice names its job.

## `two_failures`

- Part: `part_intro`
- Target length: 42 s (98 words)

**Narration**

Two failures run through the whole video. Both use small widgets that we made up. Their code is illustrative, but each step uses a real code path of deepWidgets.

The first widget is pinger. Its action ping waits three seconds and then throws an error. The call itself returns at once, with the answer ok. So the error comes three seconds after the call ended.

The second widget is spinner. Its action spin runs a loop that never ends. It never gives control back. By the end of the video, you can follow both failures through every box.

**Visuals**

Two code cards, tagged `illustrative`:

```ts
// pinger
ctx.widgets.register({ slug: 'pinger', actions: [
  { name: 'ping', kind: 'query', handler: () => {
    ctx.timeout(() => { throw new Error('late boom') }, 3000)
    return 'ok'
  } },
] })
```

```ts
// spinner
{ name: 'spin', kind: 'query', handler: () => { for (;;) {} } }
```

A red arrow from pinger to the `late error` arrow of the outline, and from spinner to `endless loop`. The words `ctx.timeout` stay grey: the voice does not name timers yet.

## `call_stack`

- Part: `part_memory`
- Target length: 43 s (100 words)

**Narration**

We start at the floor, with the call stack. The call stack is the list of the function calls that run now. Picture a pile of pancakes. Each call puts one pancake on top. Each return takes the top pancake off.

Look at this tiny example. Function a calls b, and b calls c. The pile grows to three. Then c returns, then b, then a. When the pile is empty, this piece of code has finished.

The call stack also holds the local values of each call. When a call returns, its local values go away with its pancake.

**Visuals**

Left: code `stack.cjs` (functions a, b, c that log on entry and on return). Right: a vertical pile that grows a, b, c and shrinks c, b, a, in step with the real output, line by line:

```
a calls b
 b calls c
  c runs, then returns
 back in b
back in a
stack empty
```

Tag `ran` (node v22.23.0 and the host runtime, same output). Credit chip: `pancake pile: Lydia Hallie, "JavaScript Visualized: Event Loop" (dev.to, 2019)`.

## `heap_vs_stack`

- Part: `part_memory`
- Target length: 41 s (95 words)

**Narration**

Objects need a place that lives longer than one call. That place is the heap. The heap is a big area of memory for objects. The call stack holds only an arrow that points to the object in the heap.

In this example, make user creates an object and returns it. The call ends, and its pancake goes away. The object stays in the heap, because the caller still holds an arrow to it.

You asked if each thread has its own heap. Hold that question. We answer it when we meet a second thread.

**Visuals**

Two regions side by side: a narrow `call stack` column and a wide `heap` area. Code `heap.cjs`: `makeUser()` creates `{ name: 'pinger' }`. The object appears in the heap, an arrow from the `user` value in the `makeUser` pancake points to it. The pancake leaves; the arrow moves to `u` in the caller. Real output: `object still alive: pinger` (tag `ran`). A small card `asked: does each thread have its own heap?` parks at the right edge until `worker_thread`.

## `process_pid`

- Part: `part_processes`
- Target length: 40 s (94 words)

**Narration**

Next, the process. You know the idea: a process is a running program with its own memory. The operating system keeps each process apart, so one process cannot touch the memory of another.

The operating system gives each process a number, the P I D. P I D means process I D. Other programs use this number to point at one process. For example, they use it to stop that process.

When you start deepWidgets, you start one process first. We call it the app process. It is Electron, and it owns the windows.

**Visuals**

Box `app process (Electron main)` with a name tag `PID 68721` (tag `illustrative number`; real PIDs change each run). Inside it, small window icons. A second, unrelated process box to the right with its own memory; a red X on an arrow that tries to reach into the other box's memory. Caption `PID = process ID, the number the OS gives one running process`. Credit chip: `process as a bundle of state: Julia Evans, "what's in a process?" (wizardzines)`.

## `child_process`

- Part: `part_processes`
- Target length: 49 s (114 words)

**Narration**

A process can start another process. The new one is a child process, and the first one is its parent. The child gets its own P I D and its own memory. It also remembers the P I D of its parent.

In this example, one Node process starts two children. Each child prints its own P I D and the P I D of its parent. Each number is different, and both children name the same parent.

In deepWidgets, the app process starts one child process that runs every widget. We call this child the host. When the host dies, the app process stays alive. So the app can start a new host.

**Visuals**

Code `pid.cjs` (two `spawnSync` children that print `process.pid, process.ppid`). Real output (tag `ran`, node v22.23.0):

```
parent pid 68721
child one pid, parent 68722 68721
child two pid, parent 68723 68721
```

Then a tree: `app process (Electron main)` at the top, one child box `host` below it, labeled `runs every widget`. Widget chips `sample`, `pinger`, `spinner` inside the host. The host box flashes red and empties; the app process box stays lit.

## `signals`

- Part: `part_processes`
- Target length: 49 s (114 words)

**Narration**

How does one process stop another? It sends a signal. A signal is a short message that the operating system delivers to a process, by its P I D. Think of it as a text message to a process. Many signals ask politely, and the process can catch such a signal with its own function.

One signal is different: sig kill. No code of the target runs. The operating system ends the process at once, with no cleanup. We infer the reason. A stuck process cannot refuse sig kill, so sig kill always works.

Our run confirms the rule. Node does not let a program listen for sig kill. It throws an error instead.

**Visuals**

A message envelope flies from one process box to another, labeled with a PID. Two envelopes: `SIGTERM` (the target opens it, a small `cleanup()` runs) and `SIGKILL` (the target box goes dark at once, no code runs). Caption: `SIGKILL cannot be caught, blocked, or ignored (signal(7))`. Amber tag on the reason line: `inferred: a stuck process cannot refuse`. Real output line (tag `ran`): `process.on SIGKILL threw EINVAL`. Credit chip: `"the kernel's text messages": Naz Quadri, The Layer Below`.

## `exit_info`

- Part: `part_processes`
- Target length: 51 s (119 words)

**Narration**

When a child process ends, its parent learns how it ended. There are two kinds of answer. A child that exits by itself leaves an exit code. Zero means fine, and any other number means trouble.

A child that a signal ended leaves the name of that signal, and no exit code. Our run shows three children. The killed child shows sig kill, and its cleanup code never printed. The second child catches a polite signal with its own function, and then exits with code zero.

The third child ran out of memory. Its heap was full, and V eight ended it with another signal, sig abort. No JavaScript ran at the end. Keep that in mind for later.

**Visuals**

Code card `signals.cjs` (three children). Real output (tag `ran`, same on node v22.23.0 and the host runtime v24.21.0):

```
killed child: code null signal SIGKILL printed ""
SIGTERM child: code 0 signal null printed "SIGTERM handled"
out-of-memory child: code null signal SIGABRT printed ""
```

Highlight `printed ""` on the out-of-memory line: its `uncaughtException` handler never ran. Small table: `ends by itself` > `exit code` / `ends by a signal` > `signal name, code null`.

## `one_thread`

- Part: `part_loop`
- Target length: 48 s (113 words)

**Narration**

Back to the host. All widget code in the host runs on one thread, the main thread. One thread means one call stack. So only one piece of JavaScript runs at any moment.

This gives a strict rule. Once code starts, it runs until the call stack is empty again. Nothing can stop it in the middle. Another widget cannot cut in, and a clock cannot cut in either.

Jake Archibald stresses one rule: code runs to its end before other code starts. The rule has a good side: two pieces of code never change one object at the same time. But it has a price, and we meet it soon.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. The `widget code runs` box zooms open: inside, the `host` with one lane `main thread` and one pancake column `call stack`. Widget chips `sample`, `pinger`, `spinner` queue at the lane entrance; only one chip at a time enters the column. Credit chip: `to-do list that cannot be paused: Jake Archibald, "In The Loop" (JSConf.Asia 2018)`.

## `task_queue`

- Part: `part_loop`
- Target length: 39 s (92 words)

**Narration**

If only one piece of code runs at a time, where does the next piece wait? It waits in the task queue. A task is one callback that is ready to run. A call from a window, a finished file read, and a delay that has passed each make a task.

The task queue is a line, first in, first out. In this example, two callbacks become ready after the script ends. They wait. The script ends at zero milliseconds, and only then do both callbacks run, one after the other.

**Visuals**

Next to the `call stack` column, a horizontal box `task queue` (first in, first out). Code `queue.cjs` (two `setTimeout(…, 0)` calls, then a log). Real output (tag `ran`, node v22.23.0):

```
sync code ends at 0 ms
timer 1 at 2 ms
timer 2 at 2 ms
```

The two callbacks sit in the queue as balls until the column is empty. Fixed shapes for the rest of the video: white cube = sync code, big ball = task, small ball = microtask (idea from HRomium, "The best visual explanation (probably) of the event loop", dev.to 2025).

## `event_loop`

- Part: `part_loop`
- Target length: 39 s (92 words)

**Narration**

Who moves a task from the line onto the call stack? The event loop. The event loop is a loop inside Node that runs while work is left. It waits until the call stack is empty. Then it takes the next task from the queue and runs it. Then it waits again.

We borrow the picture of Lydia Hallie. One box holds the call stack, one box holds the queue, and the loop sits between them.

When the queue is empty, the loop sleeps. It wakes when the operating system reports that something is ready.

**Visuals**

A circular arrow `event loop` between `task queue` and `call stack`. Animation: the column empties, the arrow turns once, the next ball drops in, runs, leaves. When the queue is empty the arrow dims (`sleeps`) and lights when a ball arrives from outside the host (`OS: ready`). Credit chip: `stack, queue, loop boxes: Lydia Hallie, "JavaScript Visualized: Event Loop"`.

## `timers`

- Part: `part_loop`
- Target length: 44 s (103 words)

**Narration**

A timer asks the event loop to run a callback later. Set timeout with one hundred milliseconds means this: make the callback a task after one hundred milliseconds.

But the task still waits for an empty call stack. So the delay is a minimum, not an exact time. In this example, the timer asks for one hundred milliseconds. Then a loop holds the call stack for one second. The callback runs a little after one thousand milliseconds.

This rule matters for deepWidgets. Every action call has a time limit, five seconds by default. That limit is a timer too. Keep that in mind.

**Visuals**

Code `block_timer.cjs`:

```js
setTimeout(() => log('timer asked for 100 ms, ran at', ms()), 100)
while (ms() < 1000) {}
log('loop done at', ms())
```

Real output (tag `ran`): node v22.23.0 `loop done at 1000 ms` then `timer asked for 100 ms, ran at 1003 ms`; host runtime `… ran at 1001 ms`. A clock face: the 100 ms mark passes while a white cube fills the column; the ball waits until 1000 ms. Bottom chip: `action time limit: DEFAULT_TIMEOUT_MS = 5_000 (deepwidgets/widgets/src/index.ts:33), a setTimeout (index.ts:946-959)`.

## `microtasks`

- Part: `part_loop`
- Target length: 42 s (99 words)

**Narration**

Promises add a second line. When a promise settles, its dot then callback goes to the microtask queue. The code after an await also resumes from the microtask queue.

The rule: after each task, the event loop runs every microtask, until that queue is empty. Only then does it take the next task. So the microtask queue jumps ahead of the task queue.

Look at this puzzle. We log A, set a timer, add a promise callback, and log B. The output is A, B, promise, timer. The promise callback ran first, although we added it after the timer.

**Visuals**

A second, shorter box `microtask queue` appears between the column and the `task queue`, small balls. Code `order.cjs`:

```js
console.log('A')
setTimeout(() => console.log('timer'), 0)
Promise.resolve().then(() => console.log('promise'))
console.log('B')
```

Real output (tag `ran`, same on both runtimes): `A`, `B`, `promise`, `timer`. The small ball overtakes the big ball. Credit chip: `Jake Archibald, "Tasks, microtasks, queues and schedules" (2015)`.

## `blocking`

- Part: `part_loop`
- Target length: 44 s (103 words)

**Narration**

Now the price of the one thread rule. Blocking means that one piece of code holds the call stack for a long time. While it runs, the event loop cannot take any task or any microtask.

The javascript dot info site shows it with a loop that counts to one billion. The page freezes until the count ends. The fix there is to cut the work into small slices, with a timer between the slices.

The Node guide says the same for servers. Node runs all callbacks on one thread, so each callback must stay short. A loop that never ends blocks forever.

**Visuals**

A long white cube fills the column; both queues fill up with balls that cannot move; the loop arrow is frozen. Then the same work cut into slices with balls between them: the loop turns between slices. Credit chips: `count to 1e9, then slices: Ilya Kantor, javascript.info "Event loop: microtasks and macrotasks"`, `Node.js, "Don't Block the Event Loop (or the Worker Pool)"`.

## `block_widgets`

- Part: `part_loop`
- Target length: 45 s (105 words)

**Narration**

In deepWidgets, every widget in the host shares that one thread. So spinner blocks more than itself. Its loop stops pinger, the sample counter, and every other widget. We infer that calls from windows wait outside. No timer fires.

The five second time limit of the call cannot help either. It is a timer, and no timer runs while the loop holds the call stack. Our run shows it. A one second loop wins a race against a one hundred millisecond time limit.

The host process stays alive, but its main thread does no work for anyone. So something outside the main thread must notice.

**Visuals**

The host lane: a spinner cube fills the column forever. `sample` and `pinger` balls pile up in the task queue. Amber tag on the calls that wait: `inferred`. Code card `race_timeout.cjs` (`Promise.race` of a 1 s sync loop and a 100 ms timeout, the shape of `index.ts:946-974`). Real output (tag `ran`): `race gave: action value at 1000 ms`, then `timeout fired at 1003 ms` (host runtime 1001 ms). Then the outline: the `notice` box pulses.

## `try_stack`

- Part: `part_errors`
- Target length: 45 s (106 words)

**Narration**

Now errors. You know try and catch. Here is a rule that surprises many people. A try covers only the code that runs while the try is on the call stack.

In this example, we set a timer inside a try. The timer callback throws ten milliseconds later. By then the try has ended, and its pancake is gone. The callback runs on a fresh, empty call stack, so no catch is there. The process prints the error and exits with code one.

The javascript dot info site gives the same rule. Try and catch only see synchronous code. The pinger widget has exactly this shape.

**Visuals**

Code `try_timer.cjs`:

```js
try {
  setTimeout(() => { throw new Error('late boom') }, 10)
  console.log('try block ends')
} catch (error) { console.log('caught:', error.message) }
console.log('script ends')
```

Real output (tag `ran`): `try block ends`, `script ends`, then the error on stderr, exit code 1. `caught:` never prints. Animation: the `try` pancake leaves the column; 10 ms later the callback ball lands on an empty column and the error falls through the bottom. Credit chip: `javascript.info, "Error handling, try...catch"`.

## `exception_vs_rejection`

- Part: `part_errors`
- Target length: 44 s (103 words)

**Narration**

An error travels in two forms. An exception is a thrown error that falls down the call stack until a catch takes it. A rejection is the failed result of a promise. It waits on the promise until some code asks for the result.

Domenic Denicola shows that a rejection works like an exception. The bridge is await. Await turns a rejection back into an exception, so a normal try works again. A dot catch on the promise also takes the rejection.

In this example, both ways catch the late error. One uses await inside a try. The other uses dot catch.

**Visuals**

Side-by-side table:

| | exception | rejection |
|---|---|---|
| made by | `throw` | a promise that fails |
| travels | down the call stack | stays on the promise |
| taken by | `catch` | `.catch`, or `await` inside `try` |

Code `try_await.cjs`. Real output (tag `ran`): `caught after await: late boom`, `caught by .catch: late boom`. Credit chip: `Domenic Denicola, "You're Missing the Point of Promises" (2012)`.

## `emitter_handler`

- Part: `part_errors`
- Target length: 54 s (126 words)

**Narration**

Next, events. An emitter is an object that keeps a table. Each line of the table has an event name and a list of functions. The method on adds a function to a list. The method emit takes a name and calls each function on its list, at once, in order.

A handler is one of those functions. You asked if a handler is a watcher. It is not. A handler does nothing until the emitter calls it. The code that sees the event calls emit, and only that code notices anything.

Refactoring Guru uses a magazine. The publisher keeps a list of subscribers and sends each new issue to them. Our run shows that emit is synchronous: before emit, handler one, handler two, after emit.

**Visuals**

An emitter box with a table `event name > [functions]`. `on('ping', fn)` appends a function card; `emit('ping')` lights each card in order. Code `emit_sync.cjs` (Node `EventEmitter`). Real output (tag `ran`): `before emit`, `handler 1`, `handler 2`, `after emit`. A crossed-out eye icon on the handler card: `not a watcher`. Credit chip: `subscriber list: Refactoring.Guru, "Observer"`; fact chip `Node.js docs, Events: emit calls listeners synchronously, in registration order`.

## `uncaught_unhandled`

- Part: `part_errors`
- Target length: 45 s (106 words)

**Narration**

Now we can name the two ways an error escapes. An uncaught exception is a throw that falls off the bottom of the call stack. No catch took it on the way. The pinger widget makes exactly this.

An unhandled rejection is a rejected promise that still has no handler when Node checks. Node checks after the current code and its microtasks finish. A dot catch that comes later than that comes too late.

So uncaught is about the call stack, and unhandled is about one promise. In current Node, both end the same way by default. Node prints the error and exits with code one.

**Visuals**

Two doors into one exit sign `exit code 1`. Left door `uncaught exception`: a throw falls out of the bottom of an empty column. Right door `unhandled rejection`: a promise with a red flag and an empty handler list, checked by a clock icon after the microtask queue drains. Code `reject_none.cjs` (`Promise.reject(...)`, no catch): real output `script ends`, then the error, exit 1 (tag `ran`). Fact chip: `Node 15 and later: --unhandled-rejections=throw is the default (Node CLI docs)`.

## `process_handlers`

- Part: `part_errors`
- Target length: 50 s (117 words)

**Narration**

Who decides what happens at the end? Node gives one emitter for the whole process. Its name is process. It emits uncaught exception for an escaped throw, and unhandled rejection for an escaped rejection.

A process handler is a handler on that emitter. When you add one, it replaces the default exit. It gets the error, but no widget. It does not know which widget caused it.

Our run adds one process handler for uncaught exception. Both the timer throw and the lone rejection reach it. By default, Node raises an unhandled rejection as an uncaught exception. The process stays alive afterwards. The Node docs warn against that: it is not safe to resume normal operation after uncaught exception.

**Visuals**

The `process` emitter at the edge of the host, table with two names: `uncaughtException`, `unhandledRejection`. Code `process_handlers.cjs`. Real output (tag `ran`, same on both runtimes):

```
process handler: unhandledRejection - nobody waits
process handler: uncaughtException - timer throw
process still alive at the end
```

(the second argument `origin` names the door). Quote card, the one quote from this source: "It is not safe to resume normal operation after 'uncaughtException'." (Node.js docs, process). The handler card shows only `(error, origin)`: no widget.

## `promise_not_process`

- Part: `part_errors`
- Target length: 51 s (118 words)

**Narration**

You asked if a promise is a process, and if dot then is a process handler. The answer is no to both.

A promise is a small object in the heap. It holds one result that comes later. Thousands of promises can live inside one process. Dot then adds a callback to that one promise. It runs once, as a microtask, when the promise settles.

A process handler sits on the one process emitter, and it serves every promise in the process. It is the last stop for a rejection that no dot then and no dot catch took. When MDN says that a promise stands for a process, MDN means an operation, not an operating system process.

**Visuals**

Table:

| | promise | `.then(fn)` | process handler |
|---|---|---|---|
| what | object in the heap | callback on one promise | handler on the one `process` emitter |
| how many | thousands | one per call | one per event name, for the whole process |
| runs | settles once | once, as a microtask | for every escaped error |

Paraphrase chip: `MDN, Promise: promises stand for operations already in progress (here "process" = an operation)`.

## `handler_vs_effect`

- Part: `part_errors`
- Target length: 53 s (124 words)

**Narration**

You also asked how a process handler differs from a Cordis effect. The difference is ownership and cleanup.

A process handler belongs to the whole process. It stays until some code removes it by hand. A reload of a plugin does not remove it. An earlier experiment in this repository counted process handlers that grew from two to five over four reloads.

A Cordis effect belongs to one plugin. It returns a cleanup function, and Cordis runs that cleanup when the plugin stops or reloads. So a reload leaves no extra handler behind. In deepWidgets, the crash hook is the function that the process handler calls on a fatal error. It goes in through a Cordis effect, so a reload removes the old hook.

**Visuals**

Table:

| | process handler | Cordis effect |
|---|---|---|
| owner | the whole process | one plugin |
| undo | `process.off(name, fn)`, by hand | the returned cleanup, run by Cordis |
| after 4 reloads | 2 grew to 5 (plugins-spike.md:110) | no extra |

Code chip `isolation.ts:370-375`: `ctx.effect(() => { hooks.add(claim); return () => { hooks.delete(claim) } })`.

## `async_chain`

- Part: `part_context`
- Target length: 53 s (124 words)

**Narration**

Here is the gap. A process handler gets the error, but no widget. The call stack of the widget is long gone. So how can the handler know which widget started the work?

The answer starts with the async chain. An async chain is all the work that one piece of code starts, now or later. A timer that the code sets is in the chain. A promise callback is in the chain. A timer that such a callback sets is in the chain too.

Node tracks this tree. Each piece of async work gets an I D, and the I D of the work that created it. In our run, timer a has parent one, and timer d has parent five, which is timer a.

**Visuals**

A tree grows from one root `pinger.ping` (dashed lines = scheduled, not called): `setTimeout a`, `.then b`, and under `a` another `setTimeout d`. Table: `call stack: f called g; a line; ends at return` / `async chain: f scheduled g; a tree; ends when the last callback ends`. Code `async_ids.cjs`; real output (tag `ran`), the one time these names appear on screen:

```
top level  asyncId 1 trigger 0
timer a    asyncId 5 trigger 1
timer d    asyncId 7 trigger 5
```

Caption: `asyncId = this work, triggerAsyncId = the work that created it (Node.js docs, async_hooks)`.

## `als`

- Part: `part_context`
- Target length: 56 s (131 words)

**Narration**

Async local storage carries one value along an async chain. You call run with a value and a function. The function, and every callback that it starts, can read that value later with get store.

You asked if it is like the local storage of a browser. It is not. Browser local storage keeps text on disk. Async local storage keeps one value in memory, for one async chain, and only while that chain lives.

React context is the closest idea that you use every day. A provider sets a value once, and every component below it can read the value. Async local storage does the same along an async chain, not along a component tree. Our run prints sample, then undefined outside any run, then pinger from a later timer.

**Visuals**

Code `als_basic.cjs`:

```js
const blame = new AsyncLocalStorage()
blame.run('pinger', async () => { await null; setTimeout(() => log(blame.getStore()), 5) })
blame.run('sample', () => log(blame.getStore()))
log(blame.getStore())
```

Real output (tag `ran`, same on both runtimes): `inside the sample run: sample`, `outside any run: undefined`, `timer in the pinger chain: pinger`. A colored ribbon follows the pinger chain. Table: `localStorage (browser): text, on disk, per site, survives restarts` / `AsyncLocalStorage (Node): one value, in memory, per async chain, while the chain lives`. Credit chip: `React context as inherited value: react.dev, "Passing Data Deeply with Context"`.

## `handler_reads_store`

- Part: `part_context`
- Target length: 38 s (88 words)

**Narration**

Now put the two together. Node runs a process handler inside the async chain of the callback that failed. So the handler can call get store, and it gets the value of that chain.

In this run, we call ping inside run with the value pinger. The call returns ok. Outside the run, get store gives undefined. Fifty milliseconds later the timer throws. The process handler reads get store and gets pinger.

The same works for an unhandled rejection. That is the whole trick behind blame in deepWidgets.

**Visuals**

Code `late_throw.cjs`. Real output (tag `ran`, same on both runtimes, exit 1):

```
call returns ok
outside the run, store = undefined
process handler: error = late boom | store = pinger
```

Second chip `late_reject.cjs` (the same for `unhandledRejection`): `process handler: reason = late reject | store = pinger`. The pinger ribbon runs from the call into the timer and up to the process handler card.

## `worker_thread`

- Part: `part_threads`
- Target length: 48 s (113 words)

**Narration**

Back to the frozen host. Its main thread cannot notice its own freeze, because it runs no code but the loop. We need a second thread.

A worker thread is a second JavaScript thread in the same process. It has its own call stack, its own heap, and its own event loop. So it keeps running while the main thread is stuck.

Now your heap question. In most languages, the threads of one process share one heap. A Node worker thread does not. Our run sets one global value in each thread, and each thread sees only its own value. Lin Clark draws such threads as two people, each at a private desk.

**Visuals**

The host box now has two lanes: `main thread` (stack, heap, loop) and `worker thread` (its own stack, heap, loop). Code `worker_heap.cjs`; real output (tag `ran`): `worker sees: worker | main sees: main`. The parked card `does each thread have its own heap?` returns with the answer: `OS threads: shared heap / Node worker thread: own heap`. Credit chips: `two people, private desks: Lin Clark, "A cartoon intro to ArrayBuffers and SharedArrayBuffers" (Mozilla Hacks, 2017)`, `threads share the heap, processes do not: Coding Shuttle, "Threads vs Processes"`.

## `shared_memory`

- Part: `part_threads`
- Target length: 54 s (127 words)

**Narration**

How do two threads talk? The normal way is a message. A message is a copy, and it waits in the queue of the other thread. If that thread is stuck, the message waits too. In our run, the main thread loops for one second, and the message arrives only at the end.

Shared memory is the other way. It is one small piece of memory that both threads read and write directly. There is no copy and no queue. The worker thread can read it while the main thread is stuck.

Two threads that write one number at once give a race condition. So the code uses a shared counter. Each add or read of the counter is one step that the other thread cannot split.

**Visuals**

Left: a mailbox at the main thread, the letter sits unopened while a cube fills the column. Code `message_waits.cjs`; real output (tag `ran`): `main loop starts at 4 ms`, `main loop ends at 1000 ms`, `main got "hello from the worker" at 1000 ms`. Right: one strip of two cells `SharedArrayBuffer` between both lanes, both lanes read it. Lost-update picture: two threads do read, add, write and one add is lost; then the same with one indivisible step. Small grey code chip, on screen only: `Atomics.add`, `Atomics.load`. Credit chip: `lost update and the indivisible step: Lin Clark, "Avoiding race conditions in SharedArrayBuffers with Atomics" (2017)`.

## `heartbeat`

- Part: `part_threads`
- Target length: 50 s (116 words)

**Narration**

Now the trick that notices a freeze. The main thread adds one to a shared counter every one hundred milliseconds. That counter is the heartbeat. The worker thread looks at it every fifty milliseconds. If the number stops changing, the main thread is stuck.

Embedded systems use the same idea. Wikipedia describes a timer that healthy code must keep resetting. When the resets stop, recovery starts. A stuck program cannot report its own failure, so a missing beat is the report.

Our run blocks the main thread for one and a half seconds. The worker reports about five hundred milliseconds with no beat, then about one thousand. The main thread logs only after its loop ends.

**Visuals**

A pulse line from the main lane into the shared strip (`+1 every 100 ms`); the worker lane samples it (`look every 50 ms`). Code `heartbeat.cjs`; real output (tag `ran`, node v22.23.0):

```
main: loop starts at 305 ms
worker at 742 ms: no beat for 516 ms
worker at 1257 ms: no beat for 1031 ms
main: loop ends at 1800 ms
main: done at 2105 ms
```

(host runtime: 743 ms / 520 ms and 1260 ms / 1037 ms). The pulse flatlines while the cube fills the main column. Credit chip: `Wikipedia, "Watchdog timer"`.

## `blame_store`

- Part: `part_boxes`
- Target length: 33 s (77 words)

**Narration**

Now the deepWidgets boxes, one by one. We start with the blame store. The blame store is one async local storage in the host. Its value is the name of a widget.

In deepWidgets, a wrap goes around two kinds of widget code. One is the start of a widget. The other is each action call. Each wrap calls run with the widget name. So every timer and promise that the widget code creates carries that name.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. `find who` lights and gets its name `blame store`. Zoom: code card `isolation.ts:51` `const blameStore = new AsyncLocalStorage<string>()` and `isolation.ts:113-115`:

```ts
export function runAs(row, fn) {
  return row === undefined ? fn() : blameStore.run(row, () => inSlot(row, fn))
}
```

Two arrows into `runAs`: `widget start (the wrapped Cordis runner, isolation.ts:296-304)` and `action call (index.ts:963)`. Value chip `deepwidgets-widget-pinger` (illustrative row id).

## `crash_record`

- Part: `part_boxes`
- Target length: 59 s (137 words)

**Narration**

Next box: what happens when an error escapes. The host has one process handler for each of the two events. That handler calls the crash hook of deepWidgets.

The hook reads get store and finds the widget. Then it writes the crash record. The crash record is a small JSON file on disk, crash dot json. It names the widget, the event, the error, the time, and the P I D of the host. It also holds a fingerprint of the widget files.

The hook writes with a synchronous call, and then it exits the host with code one. An async write might not finish before the exit. The hook does not wait, and it does not resume. Candea and Fox call this crash only software: to stop is to crash, and to start is to recover.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. `notice` gets `process handlers`, `write it down` gets `crash.json`. Code card `isolation.ts:342-368` (store, record, `writeJsonSync`, `process.exit(1)`). The record, field by field (`records.ts:25-41`), values illustrative:

```json
{ "row": "deepwidgets-widget-pinger", "slugs": ["pinger"],
  "error": { "name": "Error", "message": "late boom", "stack": "…" },
  "at": 1762300000000, "event": "uncaughtException", "method": "store",
  "root": "…/pinger", "hash": "9f2c…", "pid": 68722, "applied": false }
```

Chip `writeJsonSync: write a temp file, then rename (records.ts:81-87)`. Credit chip: `George Candea and Armando Fox, "Crash-Only Software" (HotOS 2003)`.

## `watchdog`

- Part: `part_boxes`
- Target length: 65 s (151 words)

**Narration**

Next box: the freeze. The watchdog is the worker thread of the host that watches the heartbeat. It looks every fifty milliseconds. The wrap helps it too. While widget code runs, the wrap writes a widget number into shared memory, next to the heartbeat. When the synchronous part of the call returns, the wrap puts the old number back.

When the heartbeat stops for two seconds, the watchdog acts. It reads the widget number from shared memory. It writes a crash record with the event stall. Then it sends sig kill to its own process. The host cannot refuse, even inside an endless loop.

Why two seconds, and not less? Healthy host code can hold the thread too. An earlier check parsed one hundred fifty megabytes of JSON in eight hundred sixty-eight milliseconds. In an earlier experiment, a limit of five hundred milliseconds killed a healthy host. Two seconds leaves room.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. `notice` adds `watchdog + heartbeat`. Shared strip: cell 0 `heartbeat`, cell 1 `running widget` (records.ts:43-48, illustrative index of pinger: 1); `inSlot` writes the index with `Atomics.exchange` and restores it in `finally` (watchdog.ts:40-49). Code card `watchdog.ts:24-29`: `WATCHDOG_THRESHOLD_MS = 2_000`, beat 100 ms, poll 50 ms. Code card `watchdog-worker.ts:181-199`: crash record with `event: 'stall'`, then `process.kill(process.pid, 'SIGKILL')`. Chips: `150 MB JSON.parse: 868 ms, host lived (watchdog check at 108d663f)`, `500 ms threshold: false kill (where-we-stand.md:242)`.

## `provisional_record`

- Part: `part_boxes`
- Target length: 74 s (172 words)

**Narration**

Next box: the provisional record. It answers your first question. One kind of death leaves no time for any note. When the heap is full, V eight ends the host with sig abort, and no JavaScript runs.

So the watchdog writes a note early, just in case. After five hundred milliseconds without a heartbeat, it writes the provisional record, provisional dot json. It has the same fields as a crash record, with the event provisional stall. It names the widget only from the shared widget number. With no widget number, it writes no note. That number covers only synchronous code inside the wrap: a widget start, or an action call before its first await.

When the heartbeat comes back, the watchdog deletes the note at its next look. So the note follows the heartbeat, not the call. It is not a Cordis effect with its own cleanup. A planned fix ties the note to the call, with a cleanup step at the end of the call. Nobody has built that fix yet.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. `write it down` adds `provisional.json`. Timeline of a stall: `0 ms` beat stops, `500 ms` provisional record (`watchdog-worker.ts:166-180`, slot only, written only when the slot names a widget), `2000 ms` crash record and SIGKILL. A second track: beat returns before 2000 ms, the record disappears at the next poll (`watchdog-worker.ts:150-156`). Field card: same as `crash.json`, `event: 'provisional-stall'`, `method: 'slot'`. Bottom bar: `planned: the runtime removes the record when the call returns (docs/specs/widget-fv.md:61), not built`.

## `supervisor`

- Part: `part_boxes`
- Target length: 67 s (156 words)

**Narration**

Next box: who starts the host again. The supervisor is code in the app process. It watches the host child. When the host exits, the supervisor gets three facts: the P I D, the exit code, and the signal.

Then it reads the records. A crash record counts only when its P I D matches the dead host. So an old record does not blame a new crash, except in one rare case that the limits part shows. A provisional record counts only when the host ended with an abort, such as sig abort. Any other end discards the provisional record. A crash record of the dead host always wins over a provisional record.

Then the supervisor starts a new host after a short wait. A crash with a blamed widget does not count against the app. A crash with no blame does count. Repeated crashes with no blame make the wait longer. Then the host starts with only built in widgets. At last the restarts stop.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. `start again` gets `supervisor`. Box `DesktopHostSupervisor (apps/desktop/src/deepwidgets-supervisor.ts)` in the app process. Inputs: `hostPid`, `hostCode`, `hostSignal`. Rule cards: `crash.json counts if pid === dead pid (SUP:58-63, 93-94)`, `provisional.json counts only on SIGABRT, SIGTRAP, SIGILL, or code 134 (SUP:70-79, 95-96)`, `else discard (SUP:159)`. Policy table (`apps/desktop/src/deepwidgets-crash-policy.ts:10-16`): waits `500 ms, 2000 ms, 8000 ms`; window `60 s`; built-in widgets only from `2` unblamed crashes; stop at `4`; a blamed crash waits `500 ms` and is not counted.

## `quarantine`

- Part: `part_boxes`
- Target length: 46 s (108 words)

**Narration**

The final box keeps the bad widget off. The next host reads the record at its start. It puts the blamed widget into quarantine. Quarantine means that the host does not run that widget while its files keep the same fingerprint. The window of the widget shows it as failed, with the reason.

The quarantine ends when new files of that widget load with success. So a fix lifts it, and a reload of the same broken files does not.

The word quarantine is ours. Martin Fowler describes a close cousin for network calls: after repeated failures, stop calling the failing part. Every other widget runs as before.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. `keep it off` gets `quarantine`. Code card `isolation.ts:223-234` (apply `crash.json`, then `provisional.json`) and `isolation.ts:240-245` (held while `packageHash(root) === hash`). File chip `$DSH_HOME/deepwidgets/quarantine.json`. The pinger window shows `failed: quarantined after a crash (…)`. Credit chip: `Martin Fowler, "CircuitBreaker" (2014)`. Now every box of the outline has its name.

## `ex_throw_path`

- Part: `part_example_throw`
- Target length: 45 s (104 words)

**Narration**

Now the first failure, through every box. You call pinger dot ping. The action runs inside the wrap, so the blame store holds pinger. The widget number in shared memory names pinger too.

Ping sets a timer for three seconds and returns ok. The wrap puts the widget number back to zero. The call answers ok, and its time limit timer stops. Everything looks fine.

Three seconds later, the timer fires. Its callback runs on an empty call stack, and it throws. No catch is there, so this is an uncaught exception. Node emits it to the process handler, inside the pinger async chain.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. A pinger token walks the boxes. Frames: `call pinger.ping` > ribbon `blame store: pinger`, shared cell 1 = pinger index > `return 'ok'`, cell 1 = 0, `clearTimeout` of the time limit (`index.ts:974-981`) > clock `+3000 ms` > ball lands on an empty column > throw falls out > `uncaughtException` door > process handler card. Chip: `ctx.timeout calls the raw setTimeout with no try (where-we-stand.md, standing.checked.cordis_containment)`.

## `ex_throw_record`

- Part: `part_example_throw`
- Target length: 50 s (116 words)

**Narration**

The crash hook calls get store and gets pinger. It writes crash dot json with pinger, the event uncaught exception, and the P I D of the host. Then it exits the host with code one. An earlier check measured about sixty-five milliseconds from the throw to the exit.

The supervisor sees exit code one and no signal. The crash record has the same P I D, so it counts, and it blames pinger. A blamed crash does not count against the app. The new host starts after half a second.

The new host reads the record and puts pinger into quarantine. The pinger window shows failed. The sample counter and every other widget run again.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. Token continues: `crash.json` card fills (`row: pinger`, `event: uncaughtException`, `method: store`, `pid` of the host) > host box goes dark, `code 1, signal null` > supervisor reads `pid` match > `wait 500 ms, not counted` > new host > `quarantine.json` gets pinger > pinger window `failed`, sample window live. Chip: `timer throw, fault to exit 64 ms (run of record 8b9c8672) and 67 ms (rerun 108d663f)`.

## `ex_loop_stall`

- Part: `part_example_loop`
- Target length: 42 s (97 words)

**Narration**

Now the second failure. You call spinner dot spin. The wrap sets the blame store and writes the spinner number into shared memory. Then the loop starts, and it never returns.

The call stack never empties. No task and no microtask runs. The heartbeat timer cannot fire, so the counter stops. The five second time limit cannot fire either. Every other widget waits.

The watchdog thread still runs. After five hundred milliseconds with no beat, it writes the provisional record for spinner. After two seconds, it writes the crash record for spinner, and it sends sig kill.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. A spinner token: `call spinner.spin` > cell 1 = spinner index > a cube fills the column and stays > the heartbeat line flattens, the 5 s time limit ball waits > worker lane: `500 ms provisional.json (spinner, slot)` > `2000 ms crash.json (spinner, stall, slot)` > `SIGKILL`.

## `ex_loop_restart`

- Part: `part_example_loop`
- Target length: 33 s (78 words)

**Narration**

The host dies at once. An earlier check measured the kill at about two thousand fifty milliseconds after the call. The watchdog already deleted its provisional record when it wrote the crash record.

The supervisor sees the signal sig kill and no exit code. The crash record has the same P I D, so it counts, and it blames spinner. The new host starts after half a second and puts spinner into quarantine. Every other widget runs again.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. `code null, signal SIGKILL` > supervisor > `crash.json pid match` > `wait 500 ms` > `quarantine.json` gets spinner. Chips: `spin killed 2050 ms after the call (watchdog check at 108d663f)`, `write() removes the provisional record (watchdog-worker.ts:183-190)`.

## `ex_loop_oom`

- Part: `part_example_loop`
- Target length: 47 s (109 words)

**Narration**

One variant shows why the provisional record exists. Suppose spin fills the heap in a loop instead. The heartbeat stops, because the loop holds the call stack. After five hundred milliseconds, the watchdog writes the provisional record for spinner.

Before two seconds pass, the heap is full. V eight ends the host with sig abort. No JavaScript runs, so no crash record exists.

The supervisor sees sig abort, so it accepts the provisional record of that P I D. The new host puts spinner into quarantine. That completes the answer to your first question. The provisional record is the blame for a death that leaves no time to write.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. Same timeline as `ex_loop_stall`, but at about 1 s the host box shows `heap full` and goes dark before the 2000 ms mark: `code null, signal SIGABRT`. No `crash.json`. Supervisor rule card `abort exit + provisional.json of this pid > blame` lights (`SUP:95-97`). Chip: `oom case: stall of at least 500 ms (record at 508 ms), host aborts before the 2 s kill (watchdog check at 108d663f)`.

## `limit_blame_gaps`

- Part: `part_limits`
- Target length: 55 s (128 words)

**Narration**

Now the limits, stated plainly. The blame store misses some code. Code at the top level of a widget module runs before any wrap, so the store has no value there. A handler runs inside the chain of the code that calls emit. So when sample emits an event, a pinger handler sees sample, as our run shows.

The widget number misses more. It covers only synchronous code inside the wrap. In our run, it reads seven before an await and zero after it.

So a loop after an await stalls the host with no widget number. We infer the same for a loop inside a widget timer. In the app, the watchdog then kills the host with no blame. The supervisor counts that crash against the app.

**Visuals**

Two code cards. `emit_store.cjs`: real output (tag `ran`) `pinger handler sees: sample`. `number_await.cjs` (a model of `inSlot`, `watchdog.ts:40-49`): real output (tag `ran`) `before await, running widget = 7`, `after await, running widget = 0`. Amber tag `inferred` on `module top level runs outside any wrap` and on `a ctx.timeout callback finds 0`. Chip: `in the app the native stack read does not load (watchdog.ts:10-12), so the slot is the only watchdog blame`.

## `limit_provisional`

- Part: `part_limits`
- Target length: 49 s (114 words)

**Narration**

The provisional record has a short gap. Suppose a call stalls for six hundred milliseconds, so the note names its widget. Then the call returns, and the heartbeat comes back. The watchdog deletes the note only at its next look. We infer that this takes up to fifty milliseconds.

If an abort comes inside that gap, the note blames a widget that already finished. The planned fix closes the gap, because it removes the note when the call returns. That fix does not exist yet.

The P I D check has a gap too. The operating system can reuse a P I D later. The model check of this code left that case out.

**Visuals**

Timeline: `600 ms stall` > `provisional.json (widget A)` > `call returns, beat returns` > window `≤ 50 ms (inferred)` > red flash `abort here blames A`. Bar: `planned: widget_fv.crash, unit widget.crash_records (docs/plans/widget-fv.md)`. Chip: `PID reuse: not in the TLA+ model (side chat, 2026-11-04)`.

## `limit_threshold`

- Part: `part_limits`
- Target length: 36 s (84 words)

**Narration**

The last limit is the two second threshold itself. It comes from one experiment. Under heavy machine load, the watchdog can kill a healthy host. The project rules say so, and the spec keeps the threshold as an open point.

And the whole design is crash only. One escaped error stops every widget for about two seconds, not only the bad one. The Node docs say that resuming after an uncaught exception is not safe. The host follows that advice and pays this cost.

**Visuals**

Chips: `2 s from the crash_only spike (where-we-stand.md:242, watchdog.ts:6-8)`, `2026-11-02 17:15: healthy host stopped, stall 2061 ms under load (docs/specs/widget-fv.md:85, open point "Watchdog threshold")`, `CLAUDE.md head.commands: under machine load, the watchdog can stop a healthy host`. Outline with every widget chip grey for `~2.1 s` after one crash (`where-we-stand.md:242`).

## `answers`

- Part: `part_close`
- Target length: 62 s (144 words)

**Narration**

Here are your eight answers in one place.

The provisional record is an early note from the watchdog, with the same fields as a crash record. It names the widget whose synchronous code runs, and it counts only after an abort. It follows the heartbeat, not the call, so it is not a Cordis effect. A process handler belongs to the whole process. A Cordis effect belongs to one plugin and cleans up on reload.

A promise is an object in the heap, and dot then is a callback on that one promise. A P I D is the number of a process. A handler is a function that an emitter calls, not a watcher. Async local storage is a value along an async chain, not browser storage. An async chain is all the work that one piece of code starts, now or later.

**Visuals**

The eight question cards from `cold_open` return, each with a one-line answer and the scene name that taught it. All eight ticks are lit.

## `closing`

- Part: `part_close`
- Target length: 40 s (93 words)

**Narration**

Back to the picture from the start. Each box now has a name. The process handlers and the watchdog notice. The blame store finds the widget. The crash record and the provisional record write it down. The supervisor starts a new host, and the quarantine keeps the bad widget off.

Under each box sit the rules that we built from the floor. One thread has one call stack, one event loop, and two queues. A second thread watches it through shared memory. The cut list has the details that this video left out.

**Visuals**

OUTLINE (the anchor of the video): six boxes from left to right, `widget code runs` > `notice` > `find who` > `write it down` > `start again` > `keep it off`. Two red arrows enter `notice` from the left: `late error` and `endless loop`. All names filled in. Under the outline, a strip of the foundations: `call stack`, `heap`, `task queue`, `microtask queue`, `event loop`, `worker thread`, `shared memory`. Last frame: `cuts.md: the details this video left out`.
