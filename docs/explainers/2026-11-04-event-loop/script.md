# Explainer script: the event loop under deepWidgets `explainer_loop.script`

Source of truth: `origin/main` `68aabd9a` (branch `rohan/explainer-event-loop-2026-11-04`), the research file `~/kyaloon-media/explainer-event-loop-2026-11-04/research.md`, and the Node snippets that this session ran (`sources.md`, `sources.runs`). The earlier video `docs/explainers/2026-11-02-deepwidgets/` explains the same isolation code at the product level. This video goes one level lower. Narration is in `narration.md` (STE, lint 0.00). Target length uses 140 spoken words per minute. Visuals give the written forms. The widgets `pinger` and `spinner` and their row ids, pids, and hashes are illustrative. Snippet outputs are real.

Scenes: 95. Narration words: 9141. Total target: 65.3 min.

## Parts `explainer_loop.parts`

| Part | Scenes | Words | Target |
|---|---|---|---|
| `part_intro` | 5 | 558 | 4.0 min |
| `part_stack` | 4 | 431 | 3.1 min |
| `part_queues` | 5 | 486 | 3.5 min |
| `part_node_loop` | 5 | 504 | 3.6 min |
| `part_blocking` | 5 | 474 | 3.4 min |
| `part_promises` | 5 | 480 | 3.4 min |
| `part_listeners` | 6 | 627 | 4.5 min |
| `part_context` | 8 | 889 | 6.3 min |
| `part_threads` | 6 | 707 | 5.0 min |
| `part_blame` | 8 | 823 | 5.9 min |
| `part_watchdog` | 8 | 735 | 5.2 min |
| `part_supervisor` | 5 | 469 | 3.4 min |
| `part_example_throw` | 6 | 486 | 3.5 min |
| `part_example_loop` | 7 | 525 | 3.8 min |
| `part_limits` | 8 | 510 | 3.6 min |
| `part_close` | 4 | 437 | 3.1 min |

## `cold_open`

- Part: `part_intro`
- Target length: 42 s (97 words)

**Narration**

This video explains the event loop under the crash handling of deepWidgets. The earlier video showed blame, the claimer, the supervisor, safe mode, and the watchdog. It showed what each part does. This video goes one level lower. It shows the JavaScript and Node rules that make each part work.

We start from zero. We build up the call stack, the queues, the Node phases, promises, listeners, async context, and threads. Then we put each rule back into the deepWidgets code. Two real failure paths run through the video. At the end, we list the limits plainly.

**Visuals**

Dark screen. Title: `the event loop under deepWidgets`. Subtitle: `origin/main 68aabd9a, 2026-11-04`. A small card at the left: `earlier video: docs/explainers/2026-11-02-deepwidgets (part_isolation)` with five chips `blame store`, `claimer`, `supervisor`, `safe mode`, `watchdog`. An arrow points down from the card to a new layer labeled `this video: the rules underneath`. Legend at the bottom, stays for the whole video: `ran` (white tag: we ran it on this Mac), `read` (grey tag: read in code or docs), `inferred` (amber tag).

## `viewer_questions`

- Part: `part_intro`
- Target length: 43 s (100 words)

**Narration**

This video also answers six questions that Rohan asked. What does the provisional record contain, and how does it work with blame? Is a promise a process? What is a P I D?

Is a handler a watcher? Is async local storage like the local storage of a browser? And what is an async chain?

Each question gets its answer when the video has the words for it. The last part collects the six answers in one place. When a claim comes from a run on this machine, we say so. When we infer a claim, we say that too.

**Visuals**

Six question cards, one by one, in Rohan's words (from the chat of 2026-11-04): `what does the provisional record contain? how does it work with blame?`, `is a promise a process?`, `what is a PID?`, `is a handler a watcher?`, `is AsyncLocalStorage like browser localStorage?`, `what is an async chain?`. Each card gets a small tag with the scene that answers it: `answers_records`, `promise_not_process`, `pid_signals`, `handler_not_watcher`, `als_intro`, `async_chain`. The cards shrink into a column at the right edge and stay there as a checklist; each gets a tick when its scene plays.

## `outline_map`

- Part: `part_intro`
- Target length: 47 s (109 words)

**Narration**

Here is the whole system on one diagram. The big box is the host. The host is the Node process that runs the code of every widget. It has one main thread. On that thread runs one event loop. The event loop is the part of Node that picks the next piece of code to run.

Inside the loop we show three things. The call stack holds the functions that run now. The microtask queue holds small callbacks that run next. The ring of phases shows how Node visits timers, input and output, and other work in a fixed order. We come back to this diagram between the parts.

**Visuals**

OUTLINE DIAGRAM (the anchor; it opens each part with its box lit). Big box `host process (Electron 44.7.0 in Node mode, Node 24.21.0)`. Inside, a lane `main thread` with three stacked parts: `call stack` (a vertical column of frames), `microtask queue` (a short horizontal queue, with a sub-queue in front labeled `next tick queue`), and a ring of six arcs `timers > pending > idle, prepare > poll > check > close` labeled `event loop (libuv)`. Each part lights as the voice names it.

## `outline_walk`

- Part: `part_intro`
- Target length: 59 s (137 words)

**Narration**

Now walk the rest of the diagram. The small chips are the action handlers of the widgets. An action handler is a widget function that runs when a user or an agent calls an action. All action handlers run on the same main thread.

A colored ribbon follows the work that each action handler starts. That ribbon is the blame store. It remembers which widget started the work. At the edge of the host sit the process handlers. They get each error that no other code caught.

On the right is the watchdog thread, a second thread in the host. It reads a heartbeat counter in shared memory. Below are two record files on disk, provisional dot json and crash dot json. Outside the host is Electron main. Its supervisor starts a new host after a crash.

**Visuals**

Same outline. Widget chips on the main thread lane: `sample`, `pinger`, `spinner` (the last two are this video's example widgets). From each chip a thin colored ribbon trails into the microtask queue and the timers arc: label `blame store (AsyncLocalStorage<string>)`. At the host edge, two ports: `process.on('uncaughtException')` and `process.on('unhandledRejection')`, label `process handlers`. Right side, inside the host: box `watchdog thread (worker_threads)` with a line to a small two-cell strip `SharedArrayBuffer: [heartbeat, running widget]`. Below the host: disk icon with `$DSH_HOME/deepwidgets/provisional.json` and `$DSH_HOME/deepwidgets/crash.json`. Outside the host, left: box `Electron main: DesktopHostSupervisor`.

## `example_cast`

- Part: `part_intro`
- Target length: 49 s (115 words)

**Narration**

Two failures run through the whole video. Both use small widgets that we made up for this video. Their code is illustrative, but each step that follows uses a real code path of deepWidgets.

The first widget is pinger. Its action ping sets a timer for three seconds and returns at once. When the timer fires, its callback throws an error. The second widget is spinner. Its action spin runs an endless loop. It never gives control back.

The first failure is an error that arrives late. The second failure is a thread that never stops. Each one takes a different path through the boxes. By the end, you can follow both paths without help.

**Visuals**

Two code cards, tag `illustrative widget code`.

Card `pinger` (`src/index.ts`):
```ts
export const name = 'pinger'
export const inject = ['widgets', 'timer']
export function apply(ctx: Context) {
  ctx.widgets.register({
    slug: 'pinger', title: 'Pinger', program: PROGRAM, initialState: { pings: 0 },
    actions: [{
      name: 'ping', kind: 'mutation',
      handler: (_args, w) => {
        ctx.timeout(() => { throw new Error('late boom') }, 3000)
        return w.update((s) => ({ pings: s.pings + 1 }))
      },
    }],
  })
}
```
Card `spinner`, same frame, only the action differs:
```ts
actions: [{ name: 'spin', kind: 'mutation', handler: () => { while (true) {} } }]
```
Under the cards: `path A: late error (pinger)` in red, `path B: stuck thread (spinner)` in amber. Both lines end at the outline diagram, small.

## `engine_and_host`

- Part: `part_stack`
- Target length: 49 s (115 words)

**Narration**

On the diagram, we start inside the main thread. First, two words. The engine is the program that reads and runs JavaScript. In Node and in Electron, the engine is V eight. The host runtime is the program around the engine. It gives timers, files, the network, and the event loop.

The engine alone cannot wait for a timer. The host runtime does the waiting. The M D N page on the JavaScript execution model draws this same line. It also uses the word agent. An agent is like one thread, with one heap for its objects, one call stack, and one queue of work. The main thread of the deepWidgets host is one agent.

**Visuals**

Outline: the `main thread` lane lights. Two nested boxes: inner `engine: V8 15.2 (parses and runs JS)`, outer `host runtime: Node 24.21.0 inside Electron 44.7.0 (timers, files, network, event loop)`. A small `setTimeout(fn, 3000)` arrow passes from the engine to the host runtime and comes back later as `fn`. Then a card `agent = heap + call stack + job queue`, one per thread. Source card: MDN contributors, "JavaScript execution model", sections "The engine and the host" and "Agent execution model" (last modified 2026-11-02). Version line from our run: `v24.21.0 44.7.0 1.52.1 15.2.124.28-electron.0` (node, electron, libuv, V8).

## `call_stack`

- Part: `part_stack`
- Target length: 54 s (125 words)

**Narration**

The call stack is a list of the functions that run now. When a function calls another function, the engine pushes a new frame on top. A frame holds the local values of one call. When a function returns, the engine pops its frame.

Look at the example. Main calls handle, and handle calls parse. The stack now has three frames. Then parse returns, handle returns, and main returns. The stack is empty again. Only then can the event loop pick new work.

A thrown error moves down the stack. It looks for a frame with a try and catch block. If no frame catches it, the error leaves the bottom of the stack. Keep that picture in mind. It matters for the process handlers.

**Visuals**

Outline: `call stack` lit. Code card:
```js
function parse(text) { return JSON.parse(text) }
function handle(text) { return parse(text) }
function main() { return handle('{"n":1}') }
main()
```
Stack column animates: `main` > `main, handle` > `main, handle, parse` > pops back to empty. Label at each step: `push` / `pop`. Last beat: replace the text with `'{bad'`; a red `SyntaxError` drops through `parse`, `handle`, `main` and falls out of the bottom with the label `no try/catch: leaves the stack`. Source card: MDN contributors, "In depth: Microtasks and the JavaScript runtime environment", section "JavaScript execution contexts".

## `run_to_completion`

- Part: `part_stack`
- Target length: 42 s (99 words)

**Narration**

Now the most important rule. JavaScript runs each piece of work to completion. When a callback starts, it runs until the stack is empty again. Nothing interrupts it. No other callback can run in the middle, and the loop cannot take the thread away.

This rule makes code simple. Two callbacks never change the same object at the same time. But the rule has a cost. A callback that runs for a long time holds the thread for that whole time. The M D N page says this directly. A long job blocks all other work of that agent.

**Visuals**

A timeline bar `main thread`. Three callbacks `A`, `B`, `C` as blocks in a row with no overlap; between them, a thin gap labeled `loop picks next`. Then `B` grows very long; `C` slides right and waits. Caption: `run-to-completion: no preemption inside one agent`. Source card: MDN contributors, "JavaScript execution model", section "Run-to-completion".

## `one_thread_many_widgets`

- Part: `part_stack`
- Target length: 39 s (92 words)

**Narration**

Now apply the rule to deepWidgets. The host runs every widget on its main thread. The action handlers of pinger and spinner share that thread. The sample counter and the H T T P routes of the host share it too. They take turns.

Each turn ends only when the current code gives control back. Code gives control back when it returns, or when it waits with await. If one widget never gives control back, no other widget gets a turn. Keep this in mind. It is the reason for the watchdog.

**Visuals**

Outline: the widget chips on the main thread lane light. The timeline bar from the last scene now has labeled blocks: `HTTP /api/widgets/sample/call`, `pinger.ping`, `sample.add`, `heartbeat tick`, `HTTP /api/trace`. They alternate. A caption for each block edge: `return` or `await`. Last beat: a block `spinner.spin` starts and never ends; every later block stacks up at its right edge in grey. Caption: `one thread, every widget, every route`.

## `tasks`

- Part: `part_queues`
- Target length: 48 s (111 words)

**Narration**

Where does new work come from when the stack is empty? It comes from queues. A task is one callback that the loop starts from a queue. A timer callback is a task. The callback of a finished file read is a task. The callback for an incoming network request is a task too.

The loop runs one task at a time. It takes a task, runs it to completion, and then looks at the queues again. Jake Archibald shows this model step by step in his article Tasks, microtasks, queues and schedules. His article is about the browser. We infer that its task and microtask rules also apply to Node.

**Visuals**

Outline: the ring lights faintly; a box `task queue` appears beside the stack. Cards drop into it: `timer callback`, `file read done`, `HTTP request arrived`. The loop arrow takes the first card, pushes it on the stack, the stack empties, the arrow returns. Source card: Jake Archibald, "Tasks, microtasks, queues and schedules" (2015-08-17), section "Why this happens". Small note: `browser article; the 2015 browser tables are out of date, the rules are not`. Amber tag: `applies to Node: inferred (the article has no Node content)`.

## `microtasks`

- Part: `part_queues`
- Target length: 45 s (104 words)

**Narration**

There is a second kind of queue. A microtask is a small callback that runs right after the current code, before the next task. Promise callbacks are microtasks. The code after an await also runs as a microtask. You can add one yourself with queue microtask.

The loop drains the microtask queue after each task. Drain means that it runs microtasks until the queue is empty. If a microtask adds a new microtask, that new one also runs in the same drain. The HTML standard states this rule in its processing model. Thus all waiting microtasks run before the next timer gets a turn.

**Visuals**

Outline: `microtask queue` lit. Animation: a task runs, the stack empties, then the arrow goes to the microtask queue and runs `m1`, `m2`; `m2` drops a new `m3` at the back; `m3` runs too; only then does the arrow go back to the task queue. Label: `microtask checkpoint: drain until empty`. Source cards: WHATWG, HTML Living Standard, 8.1.7.3 "Processing model" (read 2026-11-04); V8 blog, Maya Armyanova and Benedikt Meurer, "Faster async functions and promises" (2018-11-12), section "Tasks vs. microtasks".

## `order_example`

- Part: `part_queues`
- Target length: 35 s (81 words)

**Narration**

Here is a small program. It logs script start and sets a timer with a delay of zero. It makes a promise with two then callbacks. It queues one microtask and calls process dot next tick. Last, it logs script end.

Before you look at the output, guess the order. Then compare. We ran this file with Electron forty-four in Node mode. That is the same runtime that runs the desktop host. Node twenty-four and Node twenty-two gave the same order.

**Visuals**

Code card `order.cjs` (left):
```js
console.log('script start')
setTimeout(() => console.log('timeout'), 0)
Promise.resolve()
  .then(() => console.log('promise 1'))
  .then(() => console.log('promise 2'))
queueMicrotask(() => console.log('microtask'))
process.nextTick(() => console.log('next tick'))
console.log('script end')
```
A pause card: `guess the order`. Then the output card (right), line by line:
```text
script start
script end
next tick
promise 1
microtask
promise 2
timeout
```
Run line under the output: `ELECTRON_RUN_AS_NODE=1 Electron order.cjs` (Electron 44.7.0, Node 24.21.0); same output on Node 24.8.0 and Node 22.23.0.

## `order_walkthrough`

- Part: `part_queues`
- Target length: 47 s (110 words)

**Narration**

Here is why. The whole file is one task. It runs to completion first, so script start and script end come first. During that task, the code only scheduled the other callbacks.

When the stack is empty, Node first drains its next tick queue. That gives next tick. Then Node drains the microtask queue in order. Promise one and microtask were in the queue already. Promise one then added promise two, so promise two runs in the same drain.

Only now does the loop go on to a new task. The timer callback runs last, even with a delay of zero. A delay is a minimum, not an exact time.

**Visuals**

Outline mini-view: stack, next tick queue, microtask queue, timers arc. Replay of `order.cjs`: during the first task, cards drop into the queues: `next tick` into the next tick queue, `promise 1` and `microtask` into the microtask queue, `timeout` into the timers arc. The stack empties. Arrow drains `next tick`, then `promise 1` (which drops `promise 2` at the back), `microtask`, `promise 2`. Then the ring turns to `timers` and runs `timeout`. The output lines from the last scene light one by one in step.

## `microtask_starvation`

- Part: `part_queues`
- Target length: 34 s (80 words)

**Narration**

Microtasks can also block. This program sets a timer with a delay of zero. Then a microtask queues itself again and again, one million times. The timer cannot run until the microtask queue is empty.

The output shows it. The timer ran only after one million microtasks. A chain of microtasks that never ends blocks the loop as hard as an endless while loop. The timers never get a turn. We ran this file, and the output is on screen.

**Visuals**

Code card `microtask_starve.cjs`:
```js
let n = 0
setTimeout(() => console.log('timer ran after', n, 'microtasks'), 0)
function again() { if (++n < 1000000) queueMicrotask(again) }
queueMicrotask(again)
```
Output:
```text
timer ran after 1000000 microtasks
```
Animation: the microtask queue refills itself; the timers arc stays grey with `timer: waiting`. Caption: `the drain runs until empty, so an endless microtask chain also blocks` (verified: ran; rule from HTML 8.1.7.3).

## `libuv_ring`

- Part: `part_node_loop`
- Target length: 46 s (107 words)

**Narration**

On the diagram, now look at the ring. Node splits the loop into phases. The library lib u v runs this loop. Each phase has its own queue of callbacks. The official guide, The Node J S Event Loop, lists them in this order.

The timers phase runs callbacks of set timeout and set interval. The pending phase runs some input and output callbacks that the system held back. The poll phase waits for new input and output, and runs their callbacks. The check phase runs callbacks of set immediate. The close phase runs close callbacks, for example of a closed socket. Then the ring starts again.

**Visuals**

Outline: the ring fills the screen. Six arcs with their queues: `timers: setTimeout, setInterval` > `pending callbacks: deferred I/O callbacks` > `idle, prepare: internal` (grey) > `poll: wait for I/O, run I/O callbacks` > `check: setImmediate` > `close callbacks: 'close' events`. Between every two callbacks a small diamond `next tick queue, then microtask queue`. Source card: Node.js project, "The Node.js Event Loop", sections "Phases Overview" and "Phases in Detail". Note card: `since Node 20 (libuv 1.45): timers run after poll in each turn (version note in the guide)`.

## `poll_wait`

- Part: `part_node_loop`
- Target length: 49 s (114 words)

**Narration**

The poll phase is where the loop sleeps. When no callback is ready, the loop waits there for input and output. It computes how long it may wait. The limit is the time until the next timer is due. The lib u v design page describes this step.

We infer that an idle host uses almost no processor time. The thread sleeps in poll until a request arrives or a timer is due. When a request arrives, the poll phase runs its callback. In deepWidgets, each call from a user or an agent starts as such a callback. The H T T P request of the call arrives, and its callback starts the action.

**Visuals**

The poll arc enlarges. A clock hand shows `poll timeout = time to the nearest timer`. A sleeping thread icon. An HTTP envelope `POST /api/widgets/pinger/call { action: 'ping' }` arrives; the poll arc wakes and pushes `request callback` on the stack. Source card: libuv project, "Design overview", section "The I/O loop" (v1.x docs). Tag on `idle host uses almost no CPU`: inferred.

## `immediate_vs_timeout`

- Part: `part_node_loop`
- Target length: 39 s (91 words)

**Narration**

Set immediate puts a callback in the check phase. Set timeout with zero puts one in the timers phase. Which runs first? It depends on where you call them.

Inside an input and output callback, set immediate always runs first. The loop is in poll, and check comes next. We ran that case, and immediate came before timeout. At the top level of a file, the order is not fixed. We ran such a file one hundred times on Electron. Immediate came first ninety-six times, and timeout came first four times.

**Visuals**

Left code card `phases.cjs`:
```js
const fs = require('node:fs')
fs.readFile(__filename, () => {
  console.log('poll: file read done')
  setTimeout(() => console.log('timers: timeout 0'), 0)
  setImmediate(() => console.log('check: immediate'))
  process.nextTick(() => console.log('next tick'))
  Promise.resolve().then(() => console.log('promise'))
})
```
Output:
```text
poll: file read done
next tick
promise
check: immediate
timers: timeout 0
```
Right code card `toplevel_race.cjs`:
```js
setTimeout(() => console.log('timeout'), 0)
setImmediate(() => console.log('immediate'))
```
Bar chart, 100 runs each: Electron 44.7.0: `immediate first 96`, `timeout first 4`; Node 24.8.0: `99 / 1`; Node 22.23.0: `97 / 3`. Caption: `top level: no fixed order. Inside an I/O callback: immediate first.`

## `next_tick`

- Part: `part_node_loop`
- Target length: 41 s (95 words)

**Narration**

Process dot next tick is not part of any phase. Node drains the next tick queue after the current operation, before the loop goes on. Then it drains the promise microtasks. That is why next tick came before promise one in our example.

The Node docs now mark process dot next tick as legacy. They tell new code to use queue microtask. One more detail matters. We ran the same example as an E S module. There, next tick came after promise two. So code must not depend on the order of these two queues.

**Visuals**

Diamond between two callbacks zooms in: `next tick queue` drains first, then `microtask queue`. Doc chip, a paraphrase, not a quote: `Node docs: process.nextTick is legacy; new code uses queueMicrotask()` (Node.js API, process, v26.13.0 docs, section "When to use queueMicrotask() vs. process.nextTick()"). Side-by-side outputs of the same code: `order.cjs` (CommonJS) and `order.mjs` (ES module):
```text
script start
script end
next tick
promise 1
microtask
promise 2
timeout
```
```text
script start
script end
promise 1
microtask
promise 2
next tick
timeout
```
The line `next tick` is highlighted in each.

## `thread_pool`

- Part: `part_node_loop`
- Target length: 42 s (97 words)

**Narration**

Node runs JavaScript on one thread only. Under the loop, lib u v keeps a thread pool. By default it has four threads. File system work and D N S lookups run there. Network sockets do not use the pool. The loop thread watches them with the system calls of the operating system.

The pool runs C code, not JavaScript. When the pool finishes the work, its callback goes back to the main loop. So a slow disk read does not block the loop. But the callback still runs on the main thread, like every other callback.

**Visuals**

Under the ring: four small worker boxes `libuv thread pool (default 4, UV_THREADPOOL_SIZE, max 1024)`. A `fs.readFile` request goes down to the pool, a gear turns, and a `done` card comes back up into the poll arc. A socket icon connects straight to the poll arc with the label `kqueue (macOS) / epoll / IOCP`. Caption: `the pool runs C work; JS callbacks come back to the main thread`. Source cards: libuv project, "Design overview" and "Thread pool work scheduling"; Node.js project, "Don't Block the Event Loop (or the Worker Pool)", section "What code runs on the Worker Pool?".

## `block_everything`

- Part: `part_blocking`
- Target length: 44 s (102 words)

**Narration**

On the diagram, the whole ring now matters. We can say exactly what blocking means. A callback blocks the loop when it holds the call stack for a long time. While it runs, the loop cannot reach any phase. No timer runs. No request callback runs, and no other microtask runs.

A second Node guide is about blocking the event loop. It states the result for servers. Node has no preemption between clients. Preemption means that a scheduler stops a running job to give time to another job. So fairness is the job of the code, and each callback must be short.

**Visuals**

Outline: the whole ring greys out while a red block sits on the call stack. Every arc gets a small `waiting` badge. Source card: Node.js project, "Don't Block the Event Loop (or the Worker Pool)", section "What does this mean for application design?". Definition chip: `preemption: the scheduler stops a running job to run another`.

## `timers_minimum`

- Part: `part_blocking`
- Target length: 41 s (96 words)

**Narration**

The timers phase runs each timer whose time has come. A timer delay is a lower limit. Set timeout with five thousand milliseconds means not before five seconds. It does not mean at five seconds.

If the thread is busy, the timer waits. We ran a program that sets a timer of one hundred milliseconds. Then it runs a loop for one second. The loop ended at one thousand milliseconds. The timer ran at one thousand and two milliseconds, not at one hundred. Remember this result, because the action timeout of deepWidgets is such a timer.

**Visuals**

Code card `block_timer.cjs`:
```js
const t0 = Date.now()
setTimeout(() => console.log('timer asked for 100 ms, ran at', Date.now() - t0, 'ms'), 100)
while (Date.now() - t0 < 1000) {}
console.log('loop done at', Date.now() - t0, 'ms')
```
Output (Electron 44.7.0):
```text
loop done at 1000 ms
timer asked for 100 ms, ran at 1002 ms
```
Timeline: a flag at 100 ms `timer due`; a solid block 0 to 1000 ms `while loop`; the timer callback runs at 1002 ms. Caption: `a delay is a minimum` (Node.js guide, section "timers"). A small chip links forward: `WR:33 DEFAULT_TIMEOUT_MS = 5_000`.

## `block_examples`

- Part: `part_blocking`
- Target length: 45 s (104 words)

**Narration**

What blocks in practice? The guide names a few kinds. A regular expression with nested repeats can take a very long time on a bad input. Synchronous file calls, such as read file sync, hold the thread until the disk answers. A JSON parse of a large text also holds it.

The guide measured a fifty megabyte JSON text. Its parse took about one point three seconds. deepWidgets measured a one hundred fifty megabyte parse in the host. It took eight hundred sixty-eight milliseconds in the check of the earlier video. That parse is healthy host code, and the watchdog must let it live.

**Visuals**

Three cards: `REDOS: /(a+)*b/ on 'aaaa...c'`, `fs.readFileSync(path)`, `JSON.parse(hugeText)`. Number card: `50 MB JSON.parse: about 1.3 s` (Node.js guide, section "Blocking the Event Loop: JSON DOS"). Number card: `150 MB JSON.parse in the host: 868 ms, host lives` (tools/widgets-watchdog.mjs at 108d663f, earlier video). Small note: `watchdog.ts and watchdog-worker.ts unchanged from 108d663f to 68aabd9a (the check tools/widgets-watchdog.mjs changed)`.

## `block_widgets`

- Part: `part_blocking`
- Target length: 39 s (90 words)

**Narration**

Apply this to the host. Every widget, every H T T P route, and every timer of the host share one loop. Suppose spinner runs its while loop. From that moment, the loop never reaches the timers phase or the poll phase again.

Pinger cannot get a call. The sample counter cannot get a click. The heartbeat timer of the watchdog cannot run. Even the action timeout of spinner cannot run, because it is a timer too. The process still exists, but its main thread does no work for anyone.

**Visuals**

Outline: `spinner` chip turns red and sits on the stack with `while (true) {}`. Greyed items, each with a lock icon: `pinger.ping (HTTP)`, `sample.add (click)`, `heartbeat setInterval 100 ms`, `spinner action timeout 5000 ms`, `GET /api/probe`. Caption: `one loop for all: one stuck callback stops all`. Small dim box at the right: `watchdog thread: own loop, still runs (part_threads)`.

## `block_remedies`

- Part: `part_blocking`
- Target length: 35 s (82 words)

**Narration**

The guide gives two remedies. You can partition the work. That means that you split it into small steps, with set immediate between them, so other callbacks get turns. Or you can offload the work to another thread.

deepWidgets cannot make agent code do either. An agent can write an endless loop by mistake. So deepWidgets does not try to prevent the block. It detects the block from outside the loop, and it ends the host. The part on threads shows how.

**Visuals**

Two small diagrams: `partition`: one long block cut into ten short blocks with `setImmediate` gaps where other callbacks slip in; `offload`: the long block moves to a second lane `another thread`. Source card: Node.js guide, section "Complex calculations without blocking the Event Loop". Then a third card in amber: `deepWidgets: detect from outside, then end the host` with an arrow to the watchdog box of the outline.

## `promise_value`

- Part: `part_promises`
- Target length: 39 s (90 words)

**Narration**

On the diagram, promises feed the microtask queue. A promise is an object that stands for a value that is not known yet. It has three states. Pending means no result yet. Fulfilled means it has a value. Rejected means it has an error.

Settled means fulfilled or rejected. A promise settles once and never changes after that. The M D N reference page on Promise uses these words. A promise lives in the heap, like any other object. One host can hold thousands of promises at the same time.

**Visuals**

Outline: `microtask queue` lit. State diagram: `pending` with two arrows `fulfilled (value)` and `rejected (error)`; a bracket over the two: `settled (once, final)`. A heap box with many small promise dots. Source card: MDN contributors, "Promise", section "Description" (last modified 2026-10-26).

## `promise_not_process`

- Part: `part_promises`
- Target length: 45 s (105 words)

**Narration**

Is a promise a process? No. The M D N page says that promises represent processes that are already in progress. There, the word process means an operation, such as a file read that has started. It does not mean an operating system process.

The word process has three meanings in this video. An operating system process is a running program with its own memory. The host is one. The Node process object is one global object inside that program. It stands for the program inside JavaScript. A promise stands for one operation in progress, and thousands of promises live inside one operating system process.

**Visuals**

On-screen quote, the only quote from this source: "Promises in JavaScript represent processes that are already happening." (MDN contributors, "Promise", section "Description"). Then a three-row table, title `three meanings of "process"`: `OS process` | a running program with its own memory and a PID; the host is one | `Node process object` | one global EventEmitter that stands for that program | `MDN sense` | an operation already in progress; a promise stands for one. A nesting picture: one big `OS process (host)` box, inside it one `process` object and a cloud of promise dots.

## `then_continuation`

- Part: `part_promises`
- Target length: 43 s (100 words)

**Narration**

Then adds a continuation to one promise. A continuation is the code that runs after a value is ready. The callback of then runs once, when that promise settles. It runs as a microtask, never at once, even for a promise that already settled. Then returns a new promise, so you can make a chain.

In functional terms, a promise is close to a future value. Then is the map step on that one value. The callback belongs to one promise only. It is not a listener for the whole process. Remember this difference for the part on process handlers.

**Visuals**

A promise dot with a small hook `then(fn)`; when the dot turns green, `fn` drops into the microtask queue once and the hook disappears. Chain: `p.then(a).then(b)` drawn as three linked dots. Functional chip: `Promise<T> ~ eager, memoized Future<T, E>; then ~ map / flatMap` (inferred framing). Source card: MDN "Promise", section "Chained Promises".

## `await_continuation`

- Part: `part_promises`
- Target length: 44 s (103 words)

**Narration**

Await is a short way to write then. The V eight team explains it in the post Faster async functions and promises. At an await, the engine suspends the async function. It attaches a continuation to the awaited promise. Then it returns a promise to the caller at once. Later, a microtask resumes the function after the await.

Look at the example. The program logs A. It calls handler, which logs handler start and reaches the await. The handler returns to the caller at that point. The program logs B. Only then does a microtask resume the handler, and it logs handler resumed.

**Visuals**

Code card `await_order.cjs`:
```js
async function handler() {
  console.log('handler start')
  await null
  console.log('handler resumed')
}
console.log('A')
handler()
console.log('B')
```
Output (Electron 44.7.0):
```text
A
handler start
B
handler resumed
```
The function body splits at `await null` into two colored pieces: `piece 1: runs at once` and `piece 2: runs later as a microtask (PromiseReactionJob)`. Source card: V8 blog, Maya Armyanova and Benedikt Meurer, "Faster async functions and promises" (2018-11-12), section "await under the hood".

## `await_split`

- Part: `part_promises`
- Target length: 35 s (82 words)

**Narration**

This result is important for deepWidgets. An async handler runs in pieces. The first piece runs at once, up to the first await. Each later piece runs in a later microtask or task, after the caller already returned.

Code that wraps the call can only see the first piece. When the wrap returns, the later pieces did not run yet. The running-widget slot of the watchdog works like such a wrap. We come back to this in the part on the watchdog.

**Visuals**

A wrapper bracket `wrap(() => handler())` drawn around piece 1 only; piece 2 and piece 3 float to the right, outside the bracket, each with `later microtask`. Caption: `a wrap sees only the synchronous first piece`. A forward chip: `running_slot`.

## `emitter_table`

- Part: `part_listeners`
- Target length: 46 s (107 words)

**Narration**

On the diagram, look at the edge of the host, at the process handlers. To explain them, we need listeners. An event emitter is an object with a table. The table maps each event name to a list of functions. Each function in a list is a listener.

Handler is a common second word for listener. In this video, a process handler means a listener on the process object. The method on adds a listener to the end of the list for one name. The listener stays there until the method off removes it. The method emit takes a name and calls each listener for that name.

**Visuals**

Outline: the two process handler ports light. A table drawing titled `EventEmitter`: rows `'ping' -> [listener 1, listener 2]`, `'exit' -> [fn]`. Code card (the shape of an emitter, illustrative):
```js
class Emitter {
  #table = new Map()                      // name -> listeners
  on(name, fn)  { (this.#table.get(name) ?? this.#table.set(name, []).get(name)).push(fn) }
  off(name, fn) { this.#table.set(name, (this.#table.get(name) ?? []).filter((h) => h !== fn)) }
  emit(name, ...args) { for (const fn of this.#table.get(name) ?? []) fn(...args) }
}
```
Source card: Node.js API, "Events", sections "Events" and "emitter.on(eventName, listener)" (v26.13.0 docs).

## `emit_sync`

- Part: `part_listeners`
- Target length: 41 s (96 words)

**Narration**

Emit is synchronous. It calls the listeners in the order in which code added them, and it waits for each one to return. The Node events docs say this. We ran a small program to show it.

The program adds two listeners for the event ping. It logs before emit, calls emit, and logs after emit. The output shows listener one and listener two between the two logs. So the listeners ran inside the emit call, on the same stack. This is the observer pattern. The emitter is the subject, and the listeners are the observers.

**Visuals**

Code card `emit_sync.cjs`:
```js
const { EventEmitter } = require('node:events')
const emitter = new EventEmitter()
emitter.on('ping', () => console.log('listener 1'))
emitter.on('ping', () => console.log('listener 2'))
console.log('before emit')
emitter.emit('ping')
console.log('after emit')
```
Output:
```text
before emit
listener 1
listener 2
after emit
```
Stack view: `emit` frame on top of the main frame; `listener 1` pushes and pops above `emit`, then `listener 2`. Source card: Node.js API, "Events", section "Asynchronous vs. synchronous". Chip: `observer pattern: subject = emitter, observers = listeners`.

## `handler_not_watcher`

- Part: `part_listeners`
- Target length: 41 s (95 words)

**Narration**

So is a handler a watcher? No. A listener does nothing by itself. It does not poll, and it does not wait. It is a plain function in a table. It runs only when some code calls emit.

The code that detects the event calls emit. For a network socket, Node calls emit when data arrives in the poll phase. For an uncaught exception, the Node runtime calls emit when an error leaves the stack. In deepWidgets, only one part really watches. That part is the watchdog thread. It checks the heartbeat every fifty milliseconds.

**Visuals**

Two columns. Left `listener`: a function card lying still in the table, label `does nothing until called`. Right `detector`: three sources with arrows into `emit(...)`: `poll phase: socket data -> socket.emit('data')`, `Node runtime: error left the stack -> process.emit('uncaughtException')`, `your code -> emitter.emit('ping')`. Bottom, amber: `the only watcher that polls in deepWidgets: the watchdog thread (setInterval 50 ms, WDW:145-200)`.

## `process_handlers`

- Part: `part_listeners`
- Target length: 46 s (107 words)

**Narration**

The process object is one event emitter for the whole program. Two of its events matter here. Node emits uncaught exception when a throw leaves the bottom of the stack and no code caught it. Node emits unhandled rejection when a promise rejects and no code handles the rejection within a turn of the loop.

With no listener, each event ends the process with exit code one. We ran a rejection that nobody handled, and Electron exited with code one. A listener replaces that default. The Node docs call uncaught exception a last-resort mechanism. They also warn that it is not safe to go on after it.

**Visuals**

Two event cards on the `process` emitter: `'uncaughtException' (err, origin)`: a throw reached the event loop; `'unhandledRejection' (reason, promise)`: a rejection with no handler within a turn. Default with no listener: `print stack, exit code 1` (`--unhandled-rejections=throw` is the default since Node 15). Run chip: `Electron -e "Promise.reject(new Error('nobody handles me'))"` gives `exit 1`. On-screen quote, the only quote from this source: "It is not safe to resume normal operation after 'uncaughtException'." (Node.js API, "process", section "Warning: Using 'uncaughtException' correctly").

## `last_resort_sink`

- Part: `part_listeners`
- Target length: 44 s (103 words)

**Narration**

Compare a process handler with a then callback. A then callback belongs to one promise. It runs once, and then it is gone. A process handler belongs to the whole process. It stays until code removes it, and it sees every error that escapes all local code.

In functional terms, each then or catch is a local handler for one value. The process handler is a global sink. It gets the errors that no local handler took. But a sink gets only the error. It does not know which code started the failed work. That is the problem that the blame store solves.

**Visuals**

Funnel picture: many promise dots and timer callbacks, each with its own small `catch` hook; a few red errors slip past every hook and fall into one wide funnel at the bottom labeled `process handler (global sink)`. The funnel output shows only `Error: late boom` with a question mark: `which widget?`. Table: `then/catch` | one promise | runs once | local | `process handler` | the whole process | stays until `off` | global.

## `effect_vs_listener`

- Part: `part_listeners`
- Target length: 51 s (119 words)

**Narration**

One more difference matters for widget code. A Cordis effect is a function that does a side effect and returns a disposer. A disposer is a function that undoes the side effect. Cordis runs each disposer when the plugin stops or reloads.

A process listener has no owner. If a widget calls process dot on at each reload, the number of listeners grows. The plugins spike counted the process listeners. They went from two to five over four reloads.

The lint gate for agent code refuses raw timers, such as set timeout. Agent code uses context dot timeout and context dot interval, which have owners. The claimer of deepWidgets is itself a Cordis effect, so a reload removes it.

**Visuals**

Two-column table: `process.on(event, fn)` | owner: the process | undo: `process.off`, by hand | reload: stays | `ctx.effect(() => { ...; return dispose })` | owner: one fiber | undo: the returned disposer, run by Cordis | reload: removed. Number chip: `process.on listeners 2 to 5 over 4 reloads` (`docs/explore/widget-system/plugins-spike.md:110`). Lint chip from `deepwidgets/mcp/src/creation.ts:225-243`: `no-restricted-globals: setTimeout, setInterval, setImmediate, queueMicrotask` with the message `a raw setTimeout is not owned by the widget ... Use ctx.timeout(callback, ms).` Note: `process.on is not in this rule today`. Code chip `ISO:370-375`: the claimer registered with `ctx.effect(...)` and removed by its disposer.

## `lost_context`

- Part: `part_context`
- Target length: 51 s (120 words)

**Narration**

On the diagram, look at the colored ribbon. To explain it, we start with a problem. Sync code can keep a value in a variable while it runs. But an await or a timer replaces the stack. When the callback runs later, the stack of the code that started it is gone. Any value that only lived on that stack is gone too.

The T C thirty-nine proposal for async context describes this problem. T C thirty-nine is the committee that changes the JavaScript language. The proposal asks for a value that follows the code across await and timers. Node already has such a tool. Before we look at it, we need a name for the path that work follows.

**Visuals**

Outline: the ribbon lights. Picture: a stack with a sticky note `current widget = pinger` on its bottom frame; the stack empties; later a timer callback runs on a fresh empty stack and looks for the note: gone. Source card: TC39 proposal "AsyncContext" (champions Andreu Botella, Chengzhong Wu, Justin Ridgewell; Stage 2, read 2026-11-04), section "Motivation".

## `async_chain`

- Part: `part_context`
- Target length: 54 s (126 words)

**Narration**

An async chain is the tree of async work that one piece of code starts. It holds each callback that runs later because that code scheduled it. To schedule means to make a timer, to call then, or to start some input and output.

Look at the example. The root code sets a timer for a, adds b to a fetch with then, and queues the microtask c. Later, a sets a timer for d. All four belong to the chain of the root.

They run in later turns of the loop, after the root returned. So they share no call stack with the root. They share a cause. A call stack is a line of direct calls. An async chain is a tree of causes.

**Visuals**

Code card (illustrative):
```js
blame.run('w', () => {     // root of the chain
  setTimeout(a, 10)        // a is in the chain
  fetch(url).then(b)       // b is in the chain
  queueMicrotask(c)        // c is in the chain
})
function a() { setTimeout(d, 5) }   // d too: a scheduled it
```
Tree drawing: `root` > `a` > `d`; `root` > `b`; `root` > `c`. Table: `call stack` | link: f called g | lives: one sync run | shape: a line | `async chain` | link: f scheduled g | lives: until the last callback it caused | shape: a tree.

## `async_ids`

- Part: `part_context`
- Target length: 50 s (117 words)

**Narration**

Node tracks this tree with async hooks. An async resource is an object with a callback that runs later, such as a timer or a promise. Each async resource gets a number, its async I D. Each one also keeps a trigger async I D. That is the async I D of the code that was current when code made the resource.

We ran a small program. The top level had async I D one. Timer a ran with async I D five, and its trigger was one. Timer d ran with async I D seven, and its trigger was five. Each trigger points to a parent, and the parent pointers form the tree of the chain.

**Visuals**

Code card `async_ids.cjs`:
```js
const ah = require('node:async_hooks')
console.log('top level  asyncId', ah.executionAsyncId(), 'trigger', ah.triggerAsyncId())
setTimeout(function a() {
  console.log('timer a    asyncId', ah.executionAsyncId(), 'trigger', ah.triggerAsyncId())
  setTimeout(function d() {
    console.log('timer d    asyncId', ah.executionAsyncId(), 'trigger', ah.triggerAsyncId())
  }, 5)
}, 10)
```
Output (same on Electron 44.7.0, Node 24.8.0, Node 22.23.0):
```text
top level  asyncId 1 trigger 0
timer a    asyncId 5 trigger 1
timer d    asyncId 7 trigger 5
```
Tree drawing from the output: `1 (top level)` > `5 (timer a)` > `7 (timer d)`, each arrow labeled `triggerAsyncId`. Source card: Node.js API, "Async hooks", sections "Terminology" and "triggerAsyncId" (v26.13.0 docs). Note: `createHook is Experimental and discouraged; the docs point to AsyncLocalStorage`.

## `als_intro`

- Part: `part_context`
- Target length: 49 s (114 words)

**Narration**

Async local storage is the Node tool that carries one value along an async chain. Despite the name, it has nothing in common with the local storage of a browser. Browser local storage keeps string pairs on disk for each web site, across reloads. Async local storage keeps one value in memory for each async chain. It lives only while that chain has work.

The Node docs compare it with thread-local storage in other languages. Thread-local storage cannot tell the chains apart, because one thread runs many chains in turns. So the store follows the chain, not the thread. In functional terms, it is a reader context, or a dynamic scope, for async code.

**Visuals**

Outline: the ribbon lit. Comparison table: `localStorage (browser)` | string key-value pairs | on disk, per origin | survives reloads | shared by every tab of the origin || `AsyncLocalStorage (Node, node:async_hooks)` | one value of any type | in memory, per async chain | lives while the chain has work | seen by code inside that run and what it schedules. Source card: Node.js API, "Asynchronous context tracking", section "Introduction" (v26.13.0 docs). Chip: `Reader context / dynamic scope` (inferred framing, from the TC39 proposal "Motivation").

## `als_run`

- Part: `part_context`
- Target length: 46 s (108 words)

**Narration**

Two methods do most of the work. Run takes a value and a function. It runs the function at once with that value as the store. Get store returns the value of the current chain. Outside any run, get store gives undefined.

We ran the program on screen. It starts a chain with the value widget a. That chain awaits, then sets a timer. It also runs a short chain with widget b.

The output shows widget b inside its run, then undefined outside any run. Last, the timer of the widget a chain logs widget a. The value followed the chain across the await and the timer.

**Visuals**

Code card `als_basic.cjs`:
```js
const { AsyncLocalStorage } = require('node:async_hooks')
const blame = new AsyncLocalStorage()
blame.run('widget-a', async () => {
  await null
  setTimeout(() => console.log('timer in widget-a chain:', blame.getStore()), 5)
})
blame.run('widget-b', () => console.log('inside widget-b run:', blame.getStore()))
console.log('outside any run:', blame.getStore())
```
Output (Electron 44.7.0):
```text
inside widget-b run: widget-b
outside any run: undefined
timer in widget-a chain: widget-a
```
Ribbon animation: a blue ribbon `widget-a` follows the `await` and the timer; a green ribbon `widget-b` lasts one line; the top-level line has no ribbon. Source card: Node.js API, "Asynchronous context tracking", sections "asyncLocalStorage.run" and "asyncLocalStorage.getStore()".

## `als_capture`

- Part: `part_context`
- Target length: 39 s (91 words)

**Narration**

When does a callback get its store? At registration time, not at run time. Registration is the moment when code makes the timer or calls then. The callback keeps the store of the code that registered it. The T C thirty-nine proposal and the Winter T C page on async local storage describe this frame model.

This rule decides blame in deepWidgets. A timer that widget code makes carries the store of that widget, for its whole life. It does not matter when the timer fires or what runs around it.

**Visuals**

Timeline: at t=0 inside `run('pinger', ...)` the call `setTimeout(cb, 3000)` takes a snapshot of the ribbon (camera flash icon `captured at registration`). At t=3000 `cb` runs in a different turn, wearing the same blue ribbon. Source cards: TC39 "AsyncContext" FAQ "How does AsyncContext interact with built-in schedulers?"; WinterTC, "AsyncLocalStorage" common-minimum subset (proposal-common-minimum-api, asynclocalstorage.md).

## `als_emitter_rule`

- Part: `part_context`
- Target length: 45 s (105 words)

**Narration**

Listeners follow a different rule. A listener runs inside the emit call. So it runs with the store of the code that called emit. It does not get the store of the code that added it. The Node docs and the Winter T C page say this.

We ran a test. Widget a adds a listener inside its run. Then widget b calls emit inside its run. The listener of widget a sees widget b. A second emit outside any run gives undefined.

So a listener can get the wrong name, or no name. This is one of the blind spots of the blame store.

**Visuals**

Code card `als_emitter.cjs`:
```js
const { AsyncLocalStorage } = require('node:async_hooks')
const { EventEmitter } = require('node:events')
const blame = new AsyncLocalStorage()
const bus = new EventEmitter()
blame.run('widget-a', () => bus.on('ping', () => console.log('listener of widget-a sees:', blame.getStore())))
blame.run('widget-b', () => bus.emit('ping'))
bus.emit('ping')
```
Output (same on all three runtimes):
```text
listener of widget-a sees: widget-b
listener of widget-a sees: undefined
```
Picture: the listener card has a blue `widget-a` border from when it was added, but when `widget-b` emits, the listener runs wearing the green ribbon. Caption: `a listener runs in the store of the emit caller`. Source card: Node.js API, "Asynchronous context tracking", section "Integrating AsyncResource with EventEmitter".

## `als_frame`

- Part: `part_context`
- Target length: 46 s (108 words)

**Narration**

How does Node keep the store? Node twenty-two used async hooks for it. Node twenty-four uses a newer design, the async context frame. Each run makes a new frame. Each new async resource keeps the frame that is current when code makes it.

Does Electron forty-four use the newer design? The research had this as an open point, so we checked it. The desktop host runs as Electron in Node mode, with the flag expose internals. We ran Electron forty-four in that same mode and read the internal flag of the frame module. It said true. Node twenty-four point eight also said true, and Node twenty-two said false.

**Visuals**

Two small diagrams: `Node 22: AsyncLocalStorage on async_hooks (a hook copies the store to each new resource)`; `Node 24: AsyncContextFrame (each run makes a frame; resources keep the current frame)`. Probe code card `acf_probe.cjs` (run with `--expose-internals`):
```js
const ACF = require('internal/async_context_frame')
console.log('enabled:', ACF.enabled)
```
Result table: `Electron 44.7.0 (Node 24.21.0), ELECTRON_RUN_AS_NODE=1 --expose-internals` | `enabled: true`; `Node 24.8.0` | `true`; `Node 22.23.0` | `false`. Code chips: host spawn `apps/desktop/src/host-process.ts:213-224` (`--expose-internals`), `apps/desktop/src/node-environment.ts:15` (`ELECTRON_RUN_AS_NODE: '1'`), `apps/desktop/src/main.ts:229` (`const node = process.execPath`). Doc chip: `--no-async-context-frame` (added v24.0.0), Node.js CLI docs.

## `worker_thread`

- Part: `part_threads`
- Target length: 46 s (108 words)

**Narration**

On the diagram, look at the right side of the host. A worker thread is a second JavaScript thread inside the same process. In Node, the worker threads module makes one. Each worker has its own heap, its own call stack, and its own event loop. The lib u v design says that each loop belongs to one thread.

So a worker keeps running when the main thread is stuck. Its timers fire on its own loop. The Node docs say that workers help with heavy processor work in JavaScript. deepWidgets uses a worker for another reason. It wants one thread that a stuck main thread cannot stop.

**Visuals**

Outline: the `watchdog thread` box lights. Two lanes side by side inside one process box: `main thread: heap, stack, loop` and `worker thread: heap, stack, loop`. The main lane turns red and freezes; the worker lane keeps ticking. Source cards: Node.js API, "Worker threads", sections "Worker threads" and "Class: Worker" (v26.13.0 docs); libuv "Design overview" (one loop per thread).

## `shared_memory`

- Part: `part_threads`
- Target length: 48 s (112 words)

**Narration**

Threads do not share objects. When the main thread posts a message to a worker, Node copies the data. A message also needs a callback on the other side to read it. A stuck main thread reads no messages.

A shared array buffer is the exception. It is a block of raw memory that both threads see at the same time. When you post it, the other side gets a new view of the same bytes. The deepWidgets host puts two thirty-two-bit integers in such a buffer. We call each integer a slot. The heartbeat slot holds a counter, and the running-widget slot holds the number of the widget whose code runs.

**Visuals**

Left: `postMessage(obj)`: a copy flies across, label `structured clone (copied)`; on the main side an inbox with `needs a callback to read`. Right: one memory strip between the two lanes, both lanes point at it: `SharedArrayBuffer (8 bytes) = Int32Array[2]`: `[0] heartbeat slot (BEAT_SLOT)`, `[1] running-widget slot (RUNNING_SLOT, 0 = none)`. Code chip `REC:43-48`, `WD:93`: `new Int32Array(new SharedArrayBuffer(SLOT_COUNT * Int32Array.BYTES_PER_ELEMENT))`. Source cards: Node.js "Worker threads", sections "worker.workerData" and "port.postMessage"; MDN "SharedArrayBuffer", section "Description" (last modified 2026-10-28).

## `atomics`

- Part: `part_threads`
- Target length: 43 s (101 words)

**Narration**

Two threads that touch the same memory need rules. A write on one thread can take time to reach the other thread. Atomics are functions that read or write shared memory in one step that no other thread can split. The M D N reference lists them.

Atomics add adds a number and gives the old value. Atomics load reads a value. Atomics store writes a value. Atomics exchange writes a new value and gives the old one back. The M D N execution model page says that these operations are sequentially consistent. Every thread sees them in one agreed order.

**Visuals**

Four cards, each with the memory strip: `Atomics.add(slots, 0, 1)` | add, return the old value; `Atomics.load(slots, 0)` | read; `Atomics.store(slots, 1, v)` | write; `Atomics.exchange(slots, 1, v)` | write, return the old value. Caption: `one indivisible step each; sequentially consistent`. Source cards: MDN "Atomics", section "Static methods"; MDN "JavaScript execution model", section "Agent clusters and memory sharing".

## `heartbeat_demo`

- Part: `part_threads`
- Target length: 64 s (149 words)

**Narration**

We built a small model of the watchdog and ran it on Electron. The main thread adds one to a heartbeat slot every one hundred milliseconds. A worker checks the slot every fifty milliseconds. At three hundred milliseconds, the main thread starts a loop that holds it until eighteen hundred milliseconds.

The worker saw no beat for five hundred nine milliseconds, and it wrote a line at seven hundred forty-four milliseconds. It wrote again at one thousand two hundred fifty-five milliseconds, after a stall of one thousand twenty milliseconds. The main thread was still in its loop. The worker loop kept its own time.

At that same moment, the worker also logged one line with console dot log. That line appeared only after the main loop ended. Console output of a worker goes through the main thread. This is why the real watchdog writes to file descriptor two directly.

**Visuals**

Code card `heartbeat.cjs` (scroll, key lines highlighted: `Atomics.add(slots, 0, 1)`, `Atomics.load(slots, 0)`, `writeSync(1, ...)`, `console.log(...)`):
```js
const { Worker } = require('node:worker_threads')
const slots = new Int32Array(new SharedArrayBuffer(8))
const t0 = Date.now()
const worker = new Worker(`
  const { workerData } = require('node:worker_threads')
  const { writeSync } = require('node:fs')
  const slots = new Int32Array(workerData.buffer)
  let last = Atomics.load(slots, 0), since = Date.now(), said = 0
  setInterval(() => {
    const now = Date.now(), beat = Atomics.load(slots, 0)
    if (beat !== last) { last = beat; since = now; return }
    const stalled = now - since
    if (stalled >= 500 && said < 500) { said = 500; writeSync(1, 'worker (fd 1) at ' + (now - workerData.t0) + ' ms: no beat for ' + stalled + ' ms\\n') }
    if (stalled >= 1000 && said < 1000) { said = 1000; writeSync(1, 'worker (fd 1) at ' + (now - workerData.t0) + ' ms: no beat for ' + stalled + ' ms\\n'); console.log('worker (console.log) written at ' + (now - workerData.t0) + ' ms') }
  }, 50)
`, { eval: true, workerData: { buffer: slots.buffer, t0 } })
worker.unref()
setInterval(() => Atomics.add(slots, 0, 1), 100).unref()
setTimeout(() => {
  console.log('main: loop starts at', Date.now() - t0, 'ms')
  while (Date.now() - t0 < 1800) {}
  console.log('main: loop ends at', Date.now() - t0, 'ms')
}, 300)
setTimeout(() => console.log('main: done at', Date.now() - t0, 'ms'), 2100)
```
Output (Electron 44.7.0, one run; times vary per run):
```text
main: loop starts at 304 ms
worker (fd 1) at 744 ms: no beat for 509 ms
worker (fd 1) at 1255 ms: no beat for 1020 ms
main: loop ends at 1800 ms
worker (console.log) written at 1255 ms
main: done at 2104 ms
```
Timeline: main lane solid red from 304 to 1800 ms; worker lane ticks every 50 ms with two marks at 744 and 1255 ms; the `console.log` line written at 1255 ms jumps to the output only after 1800 ms (arrow `relayed by the main thread`). Code chip `WDW:52-55`: `writeSync(2, ...)` with the comment `the main thread is stuck, so process.stderr would not flush`. Source: Node.js "Worker threads", section "Notable differences inside a Worker environment".

## `pid_signals`

- Part: `part_threads`
- Target length: 54 s (125 words)

**Narration**

Now the words that the supervisor uses. A P I D is a process I D. The operating system gives each running process a number. In JavaScript, process dot p i d gives it. We started two child processes in a row, and they got two different numbers. After a process ends, the system can give its number to a new process.

A signal is a short message from the operating system to a process. Sig kill ends a process at once, and no listener can catch it. We tried to add a listener for sig kill, and Node refused with the error E INVAL. A child that sig kill ended reported the signal sig kill and no exit code. Its exit listener never ran.

**Visuals**

PID card: `process.pid`, output of `pid.cjs`:
```text
this process pid 69039 | child one pid 69040 | child two pid 69041
```
Shell chip: `ps`, `kill -9 <pid>` (SIGKILL). Note: `the OS can reuse a PID after the process ends` (inferred, general OS behavior). Signal card from `kill_signal.cjs`:
```text
SIGKILL child: status null signal SIGKILL stdout ""
OOM child: status null signal SIGABRT stdout ""
OOM child stderr first line: "FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory"
process.on SIGKILL threw: EINVAL
```
Highlight lines 1 and 4. Source card: Node.js API, "process", section "Signal events" (`SIGKILL` cannot have a listener).

## `abort_exit`

- Part: `part_threads`
- Target length: 48 s (112 words)

**Narration**

An out-of-memory error is different. V eight stops the process with an abort. We ran a child with a small heap limit and a loop that fills the heap. The child printed fatal error, javascript heap out of memory. It ended with the signal sig abort.

The child had a listener for uncaught exception and a listener for exit. Neither ran. An abort runs no JavaScript at all. When the system reports an abort as an exit code, the code is one hundred thirty-four. That is one hundred twenty-eight plus six, the number of sig abort. So code that must leave a record for this case must write it before the abort.

**Visuals**

Child command card:
```text
Electron --max-old-space-size=16 -e "process.on('uncaughtException', ...); process.on('exit', ...); const a = []; for (;;) a.push({ n: a.length, s: 'x'.repeat(64) })"
```
Result from `kill_signal.cjs` lines 2 and 3: `status null signal SIGABRT stdout ""` and `FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory`. Two crossed-out listener cards: `uncaughtException: did not run`, `exit: did not run`. Number card: `exit code 134 = 128 + 6 (SIGABRT)` (Node.js API, "process", section "Exit codes"; `SUP:72-73`).

## `blame_overview`

- Part: `part_blame`
- Target length: 21 s (48 words)

**Narration**

Back to the outline. We now have the words for every box. This part shows the boxes of blame: the blame store, the process handlers, the claimer, and the crash record. The next part shows the watchdog and the provisional record. The part after that shows the supervisor.

**Visuals**

Outline: the left half lights: `blame store` ribbon, `process handlers`, a new box `claimer` at the host edge, and `crash.json` on the disk. The right half (`watchdog thread`, `provisional.json`, `Electron main`) is dim with the label `next parts`.

## `run_as`

- Part: `part_blame`
- Target length: 54 s (126 words)

**Narration**

The blame store is one async local storage in the file isolation dot t s. Its value is the I D of a Loader row. A Loader row is one line of the plugin list of the host. Each widget has its own row. The last part of the row I D starts with deepwidgets widget, or with deepwidgets agent for an agent bundle.

The function run as takes a row and a function. It calls run on the blame store with that row. Inside, it calls in slot, which puts the row into the running-widget slot. Then it calls the function. The runtime calls each action handler inside run as. So every timer and promise that an action handler makes carries the row I D.

**Visuals**

Code card `deepwidgets/widgets/src/isolation.ts`:
```ts
/** The store: the id of the widget row whose code runs. */
const blameStore = new AsyncLocalStorage<string>()          // ISO:51

export function runAs<T>(row: string | undefined, fn: () => T): T {
  return row === undefined ? fn() : blameStore.run(row, () => inSlot(row, fn))   // ISO:113-115
}
```
Row id pattern chip `ISO:34`: `/^deepwidgets-(?:widget|agent)-/`, with a note: `tested on the row id; the store keeps the entry id, which can have group ids in front (ISO:59-62, ISO:88-91)`. Code card `deepwidgets/widgets/src/index.ts:963`:
```ts
const handled = Promise.resolve().then(() => runAs(entry.registration.row, () => action.handler(args, scope)))
```
Ribbon picture: the `pinger` chip, ribbon label `include:deepwidgets-agent-pinger` (illustrative row id).

## `fiber_wrap`

- Part: `part_blame`
- Target length: 48 s (111 words)

**Narration**

Action handlers are not the only widget code. The plugin body runs when the widget loads, and its effects, intervals, and timeouts start there. To cover them, the runtime wraps the fiber runner of each widget row. A fiber is the Cordis object that owns one loaded plugin. The runner is the internal part that runs the plugin body.

Cordis has no public hook around a plugin body, so this wrap uses an internal part. The wrap calls run as before the body runs. Thus the store holds the row before the widget code schedules anything. That matters, because a callback keeps the store of the moment when code registered it.

**Visuals**

Code card `ISO:283-329` (excerpt):
```ts
// Cordis has no documented hook around a plugin body. The fiber runner `execute` runs the body on each load,
// so the runtime wraps it (vendor/cordis/src/fiber.ts).
runner.execute = function (this: Fiber) {
  ...
  effect = runAs(row, () => execute.call(this))          // ISO:304
  ...
}
ctx.on('internal/plugin', wrap)                           // ISO:329
```
Picture: a fiber box `deepwidgets-agent-pinger` with its plugin body inside a ribbon frame; `ctx.interval`, `ctx.timeout`, `ctx.effect` inside the body pick up the ribbon. Warning chip: `fiber._runner.execute is internal to Cordis`.

## `claimer_path`

- Part: `part_blame`
- Target length: 52 s (121 words)

**Narration**

Now the path of a fatal error. Node emits uncaught exception or unhandled rejection on the process object. The DSH boot code has one listener for each, from the function install fail loud. That listener prints the error and starts the exit of the host.

deepWidgets adds one step to that exit, with a trim change. Before the slow dispose of all plugins, the exit calls each fatal hook. The claimer is one fatal hook. It is not a process listener of its own.

The whole path runs at once, inside the process listener, on the same stack. The first await of the exit comes only after the fatal hooks. So the claimer runs inside the listener, before any other callback.

**Visuals**

Flow, left to right: `Node runtime: process.emit('uncaughtException', err)` > `installFailLoud listener (BOOT:880-929; proc.on at BOOT:926-927)` > `report(): stderr diagnostic, then the release` > `release (PBOOT:317-320): fatal.run() before await app.current?.fiber.dispose()` > `fatal hooks: Symbol.for('deepwidgets.fatal.hooks') (PBOOT:370-400)` > `claim(error, event) (ISO:342-369)`. A bracket over the whole flow: `one synchronous stack`. Trim chip: `deepwidgets-trim: widget_phase2.isolation.blame (PBOOT:311-315)`. Crossed-out box: `fiber dispose (about 2.9 s in the spike)`.

## `claimer_context`

- Part: `part_blame`
- Target length: 49 s (114 words)

**Narration**

Which store does the claimer see? First take uncaught exception. The async hooks docs say that the after hook of a callback that threw runs only after the listener. So the context of the throwing callback is still current inside the listener.

For unhandled rejection, the Node twenty-four source puts back the context frame of the moment when the promise rejected. We ran both cases on Electron forty-four. A timer in the chain of widget a threw, and the process listener read widget a from the store. A promise in the chain of widget b rejected after a timer, and the listener read widget b. Node twenty-two and Node twenty-four gave the same results.

**Visuals**

Code card `late_throw.cjs`:
```js
const { AsyncLocalStorage } = require('node:async_hooks')
const blame = new AsyncLocalStorage()
process.on('uncaughtException', (error) => {
  console.log('process handler: error =', error.message, '| store =', blame.getStore())
  process.exit(1)
})
function handler() {
  setTimeout(() => { throw new Error('late boom') }, 50)
  return 'ok'
}
console.log('call returns', blame.run('widget-a', handler))
console.log('outside the run, store =', blame.getStore())
```
Output, exit 1:
```text
call returns ok
outside the run, store = undefined
process handler: error = late boom | store = widget-a
```
Code card `late_reject.cjs`:
```js
const { AsyncLocalStorage } = require('node:async_hooks')
const blame = new AsyncLocalStorage()
process.on('unhandledRejection', (reason) => {
  console.log('process handler: reason =', reason.message, '| store =', blame.getStore())
  process.exit(1)
})
blame.run('widget-b', async () => {
  await new Promise((resolve) => setTimeout(resolve, 20))
  throw new Error('late reject')
})
console.log('outside the run, store =', blame.getStore())
```
Output, exit 1:
```text
outside the run, store = undefined
process handler: reason = late reject | store = widget-b
```
Source cards: Node.js API, "Async hooks", section "after(asyncId)"; Node source `lib/internal/process/promises.js` at branch `v24.x`, lines 259-266 (store the frame at reject) and 472-477 (restore it while `unhandledRejection` fires).

## `claimer_steps`

- Part: `part_blame`
- Target length: 44 s (103 words)

**Narration**

The claimer then does five steps. It reads get store. If the store is empty, it searches the error stack for the package folder of a known widget. It builds the crash record. It writes crash dot json with a synchronous write to a temporary file and a rename. Then it calls process dot exit with code one.

Why synchronous calls? Process dot exit ends the process at once. It does not wait for pending async work. An async write could still wait in the thread pool when the process ends. The rename makes sure that a reader never sees half a file.

**Visuals**

Code card `ISO:342-369` (excerpt):
```ts
const store = blameStore.getStore()
const stack = store === undefined ? stackBlame(info.stack) : undefined
const row = store ?? stack ?? null
...
writeJsonSync(crashFile(), crash)
process.stderr.write(`deepwidgets: ${event} blamed on ${row ?? 'no widget'} (${crash.method ?? 'none'}); the host exits now
`)
...
process.exit(1)
```
Code card `REC:81-87`:
```ts
/** Write with a rename, so a reader never sees half a file. Synchronous: it runs on the exit path and in the watchdog. */
export function writeJsonSync(file: string, value: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  const temp = `${file}.${String(process.pid)}.tmp`
  writeFileSync(temp, JSON.stringify(value, null, 2))
  renameSync(temp, file)
}
```
Source card: Node.js API, "process", section "process.exit([code])".

## `crash_record`

- Part: `part_blame`
- Target length: 50 s (116 words)

**Narration**

Here is the crash record. Row is the Loader row I D of the blamed widget, or null. Slugs are the I Ds of the widgets that the row registered. Error holds the name, the message, and the stack. At is the time in milliseconds. Event is uncaught exception, unhandled rejection, stall, or provisional stall.

Method tells how the host found the widget, for example store, stack, or slot. Root and hash name the package folder and a fingerprint of its files. P I D is the process I D of the host that wrote it. Applied turns true after a later host moved the blame into the quarantine. The provisional record has this same form.

**Visuals**

Code card `REC:25-41`, the `CrashRecord` interface, each field lighting with the voice:
```ts
export interface CrashRecord {
  row: string | null
  slugs: string[]
  error: { name: string, message: string, stack: string }
  at: number
  event: 'uncaughtException' | 'unhandledRejection' | 'stall' | 'provisional-stall'
  method: BlameMethod | null        // 'store' | 'stack' | 'slot' | 'native-store' | 'native-stack'
  root: string | null
  hash: string | null
  pid: number
  applied: boolean
}
```
File chips: `$DSH_HOME/deepwidgets/crash.json` and `$DSH_HOME/deepwidgets/provisional.json`, both `CrashRecord`.

## `crash_only`

- Part: `part_blame`
- Target length: 36 s (84 words)

**Narration**

Why exit at all? Recall the warning of the Node docs. After an uncaught exception, the state of the program is unknown. An earlier design caught the error and went on. That design could also hide an error in host code that a widget called.

So the host is crash-only. It names the widget, writes the record, and exits. By the project notes, each crash stops every widget for about two seconds. The next host keeps the blamed widget off until its files change.

**Visuals**

Outline: the host blinks out and comes back; one widget chip greyed. Caption: `crash-only host`. Number chip: `every widget stops about 2 s per crash (project notes, earlier video scene isolation_why)`. Chip: `blame check of the earlier video: fault to exit about 20 to 100 ms in three runs (tools/widgets-blame.mjs)`.

## `watchdog_overview`

- Part: `part_watchdog`
- Target length: 26 s (61 words)

**Narration**

Back to the outline once more. The blame store needs a callback that runs. A thread in an endless loop runs no new callback. So no error ever reaches the process handlers, and the claimer never runs. The right side of the diagram handles that case. This part shows the running-widget slot, the heartbeat, the watchdog thread, and the two records.

**Visuals**

Outline: the right half lights: `SharedArrayBuffer [heartbeat, running widget]`, `watchdog thread`, `provisional.json`, `crash.json`. The left half dims. A red `while (true) {}` block sits on the main stack; the claimer box shows `never called`.

## `running_slot`

- Part: `part_watchdog`
- Target length: 48 s (111 words)

**Narration**

Start with the running-widget slot. The function in slot gets the slot index of the row. It writes that index into the running-widget slot with atomics exchange, and keeps the old value. Then it calls the function. In a finally block, it writes the old value back with atomics store. Index zero means no widget.

Now recall the await example. In slot wraps only the first piece of the function, up to its first await. We ran a model of in slot around an async function. Before the await, the slot read seven. After the await, it read zero. The code comment in watchdog dot t s states the same limit.

**Visuals**

Code card `WD:39-49`:
```ts
export function inSlot<T>(row: string, fn: () => T): T {
  const watch = active
  if (watch === undefined) return fn()
  const previous = Atomics.exchange(watch.slots, RUNNING_SLOT, watch.index(row))
  try {
    return fn()
  } finally {
    Atomics.store(watch.slots, RUNNING_SLOT, previous)
  }
}
```
Model card `slot_await.cjs`:
```js
const slots = new Int32Array(new SharedArrayBuffer(8))
function inSlot(index, fn) {
  const previous = Atomics.exchange(slots, 1, index)
  try { return fn() } finally { Atomics.store(slots, 1, previous) }
}
inSlot(7, async () => {
  console.log('before await, slot =', Atomics.load(slots, 1))
  await null
  console.log('after await, slot =', Atomics.load(slots, 1))
})
```
Output:
```text
before await, slot = 7
after await, slot = 0
```
Code comment chip `WD:10-12`: `a loop in a raw timer or after an await is not blamed` (when the native module does not load).

## `slot_names`

- Part: `part_watchdog`
- Target length: 30 s (70 words)

**Narration**

A short warning about one word. The code uses the word slot for three things. The heartbeat slot and the running-widget slot live in shared memory.

The runtime also has a queue slot. It is a second async local storage that marks which call holds the queue of a widget. The queue slot plays no part in blame. In this video, slot alone always means a slot in shared memory.

**Visuals**

Three cards: `heartbeat slot` | `Int32Array[0]`, shared memory (`REC:44`); `running-widget slot` | `Int32Array[1]`, shared memory (`REC:46`); `queue slot` | `new AsyncLocalStorage<Slot>()` in the runtime (`WR:711`), the FIFO queue turn of a call, no role in blame. The third card fades to grey.

## `heartbeat_beat`

- Part: `part_watchdog`
- Target length: 31 s (73 words)

**Narration**

Next, the heartbeat. When the runtime starts, the main thread makes a set interval of one hundred milliseconds. Each tick calls atomics add on the heartbeat slot. That interval runs in the timers phase. So a new beat shows that the main loop reached the timers phase again. A missing beat means that something holds the thread.

The interval also calls unref. With unref, this timer alone does not keep the process alive.

**Visuals**

Code card `WD:121-124`:
```ts
ctx.effect(() => {
  active = watch
  const beat = setInterval(() => { Atomics.add(slots, BEAT_SLOT, 1) }, BEAT_MS)
  beat.unref()
  ...
```
Constants chip `WD:24-29`: `WATCHDOG_THRESHOLD_MS = 2_000`, `BEAT_MS = 100`, `POLL_MS = 50`. Ring animation: each pass through `timers` bumps the heartbeat counter `41 > 42 > 43`.

## `watchdog_poll`

- Part: `part_watchdog`
- Target length: 51 s (120 words)

**Narration**

Now the watchdog thread itself. It has its own set interval of fifty milliseconds. On each poll, it loads the heartbeat slot. If the value changed, the main thread is alive. The worker then resets its stall clock, and it removes its provisional record if it wrote one.

If the value did not change, the stall grows. The stall clock uses performance dot now, a monotonic clock, so a change of the wall clock does not matter. One more check protects a sleeping machine. If the poll itself came one second late or more, this thread did not run either. Then something stopped the process, or the machine slept. So the worker starts the stall clock again and kills nothing.

**Visuals**

Code card `WDW:145-164`:
```ts
setInterval(() => {
  const now = performance.now()
  const gap = now - polled
  polled = now
  const beat = Atomics.load(slots, BEAT_SLOT)
  if (beat !== last) {
    last = beat
    since = now
    if (provisionalAt !== undefined) { removeProvisional(provisionalAt); provisionalAt = undefined }
    return
  }
  if (gap >= SUSPEND_GAP_MS) {          // thresholdMs / 2 = 1000 ms (WDW:136)
    say(`this thread did not run for ... ms, so the process was stopped or asleep; the stall clock starts again`)
    since = now
    return
  }
  ...
}, data.pollMs)
```
Clock graphic: `stall = now - since`.

## `provisional_record`

- Part: `part_watchdog`
- Target length: 53 s (123 words)

**Narration**

Then the provisional record. When the stall reaches five hundred milliseconds, a quarter of the threshold, the worker reads the running-widget slot. If the slot names a widget, the worker writes provisional dot json. It has the same form as the crash record. Its event is provisional stall, and its method is slot.

Why write a record before anything dies? Recall the abort test. An out-of-memory abort runs no JavaScript. No process handler runs, and no claimer runs. The provisional record is then the only blame.

If the beat comes back, the worker removes the record at its next poll. So the provisional record is not a Cordis effect with its own cleanup. The heartbeat clears it, not the end of the call.

**Visuals**

Code card `WDW:165-180`:
```ts
const stalledMs = Math.round(now - since)
if (provisionalAt === undefined && stalledMs >= data.thresholdMs / 4) {
  // The slot only, as in the spike: a native read here would wait for the main thread.
  const found = slotBlame()
  // An unblamed provisional record would change nothing at the next start.
  if (found.row !== undefined) {
    ...
    writeJsonSync(data.provisionalFile, recordOf(found, 'provisional-stall', 'ProvisionalStall', message, at))
```
Record card (illustrative values): `{ row: "include:deepwidgets-agent-spinner", slugs: ["spinner"], event: "provisional-stall", method: "slot", error: { name: "ProvisionalStall", message: "the event loop stalled for at least 500 ms, and the host ended before it came back (for example an out-of-memory abort)" }, root, hash, pid, applied: false }`. Timeline: `500 ms write` ... `beat returns > removed at next poll (WDW:150-156)`.

## `kill_path`

- Part: `part_watchdog`
- Target length: 48 s (113 words)

**Narration**

Last, the kill. At a stall of two seconds, the worker reads the slot again. It writes crash dot json with the event stall, and it removes its provisional record. If the slot names no widget and the native module loaded, it reads the stack and writes the record again. Then it writes one line to file descriptor two. Last, it sends sig kill to its own process.

No code in the host can catch sig kill, so a stuck host cannot refuse it. The desktop host has no Electron build of the native module. So in the app, the watchdog blames by the slot only. The command-line host can load that module.

**Visuals**

Code card `WDW:181-199`:
```ts
if (stalledMs < data.thresholdMs) return
...
const write = (blame: Blame): void => {
  try {
    writeJsonSync(data.crashFile, recordOf(blame, 'stall', 'WatchdogStall', message, Date.now()))
    if (provisionalAt !== undefined) removeProvisional(provisionalAt)
  } catch (error) { ... }
}
let found = slotBlame()
// Write the record first, so a long wait in the native read below cannot leave no record.
write(found)
if (found.row === undefined && native !== undefined) {
  found = nativeBlame()
  write(found)
}
say(`stall of ${String(stalledMs)} ms blamed on ${found.row?.row ?? 'no widget'} (${found.method ?? 'none'}); the host is killed now`)
process.kill(process.pid, 'SIGKILL')
```
Chip `WD:56-74`: `@sentry/node-native-stacktrace: under Electron only with build/Release/stack-trace.node, else "blames by the slot only"`. Source card: Sentry, `@sentry/node-native-stacktrace` README (reads the stack of a blocked thread from another thread).

## `threshold_why`

- Part: `part_watchdog`
- Target length: 27 s (64 words)

**Narration**

Why two seconds? A healthy host step can also hold the thread for a while. The one hundred fifty megabyte parse took eight hundred sixty-eight milliseconds in the earlier check. In the crash-only spike, a threshold of five hundred milliseconds killed a healthy host during such a parse. So the kill waits for two seconds, and only the early record uses the shorter time.

**Visuals**

Scale bar 0 to 2500 ms: `500 ms: provisional record`, `868 ms: 150 MB parse (healthy, lives)`, `2000 ms: crash record + SIGKILL`. Red cross at 500 ms with the label `spike: a 500 ms kill threshold killed the host during a 150 MB parse` (`docs/explore/widget-system/where-we-stand.md:242`, `standing.checked.crash_only`). Comment chip `WD:6-8`.

## `supervisor_rules`

- Part: `part_supervisor`
- Target length: 51 s (120 words)

**Narration**

On the diagram, look outside the host, at Electron main. When the host child exits, the supervisor gets its P I D, its exit code, and its signal. It reads both record files. A crash record counts only when its P I D matches the dead child. Also, no host can have applied it yet. A crash record of the dead host always wins, also when it blames no widget.

With no crash record of that host, the provisional record can decide. But it counts only for an abort exit. An abort exit means the signal sig abort, sig trap, or sig ill, or the exit code one hundred thirty-four. After any other exit, the supervisor deletes the provisional record.

**Visuals**

Outline: `Electron main: DesktopHostSupervisor` lit. Exit card from `apps/desktop/src/host-process.ts:275`: `{ hostPid: child.pid, hostCode: code, hostSignal: signal }`. Decision flow from `SUP:87-98`: `crash.json pid == dead pid?` yes > `blame = crash.row (null allowed)`; no > `provisional.json pid == dead pid && row?` > `abort exit?` yes > `blame = provisional.row`; no > `discard provisional.json (SUP:157-159)`. Abort chip `SUP:70-79`: `SIGABRT, SIGTRAP, SIGILL, or code 134`.

## `record_pid_match`

- Part: `part_supervisor`
- Target length: 45 s (104 words)

**Narration**

Why match the P I D? The record files stay on disk from one host to the next. A host can die at boot, before it applies an older record. Without the P I D check, that old record could blame its old widget for a new crash. The P I D ties each record to one host process.

Why the abort rule? A widget can have a long allowed step, and the host can end for another reason during that step. Such an end is not the fault of that widget. Only an abort fits the case that the provisional record exists for.

**Visuals**

Timeline of hosts: `host pid 101` writes `crash.json { pid: 101, applied: false }`, dies; `host pid 202` dies at boot before it applies the record; supervisor check: `101 != 202 > unblamed` (green tick). Second strip: `provisional.json { pid: 303, row: spinner }` + `exit by SIGTERM` > discarded. Source: `SUP:52-63` comment (`A Host that dies at boot before it applies an older record thus counts as unblamed`), `SUP:81-86`.

## `backoff`

- Part: `part_supervisor`
- Target length: 33 s (77 words)

**Narration**

A blamed crash starts a new host after half a second. It does not count toward safe mode, because the quarantine handles it. An unblamed crash counts. The waits grow from half a second to two seconds to eight seconds.

After two unblamed crashes in sixty seconds, the next host starts in safe mode. Safe mode runs only the built-in widgets. After four unblamed crashes in sixty seconds, the supervisor gives up and shows the fatal dialog.

**Visuals**

Constants card `apps/desktop/src/deepwidgets-crash-policy.ts:10-16`: `BACKOFF_MS = [500, 2_000, 8_000]`, `CRASH_WINDOW_MS = 60_000`, `SAFE_MODE_AFTER = 2`, `GIVE_UP_AFTER = 4`. Bars: `blamed: 500 ms, not counted`; `unblamed 1: 500 ms`; `unblamed 2: 2000 ms, safe mode`; `unblamed 3: 8000 ms, safe mode`; `unblamed 4: give up, fatal dialog`. Env chip `DEEPWIDGETS_SAFE_MODE=1` (`SUP:14`, `SUP:137-139`).

## `restart_windows`

- Part: `part_supervisor`
- Target length: 25 s (58 words)

**Narration**

What does the user see during a restart? The supervisor starts a new host child and loads the main window again. The widget windows stay open. Their pages lose the connection to the host for a short time, and then they connect again. In the earlier video, a page showed fresh data about two seconds after a kill.

**Visuals**

Desktop picture: three floating widget windows stay on screen; each shows a small `reconnecting` dot for about 2 s, then fresh data. Main window reloads. Chips: `restart: backend.start, then navigateMain` (earlier video, scene supervisor); `new host answered about 2.1 s after a widget crash` (`where-we-stand.md:242`, `standing.checked.crash_only`).

## `next_host`

- Part: `part_supervisor`
- Target length: 47 s (110 words)

**Narration**

The new host reads the records at start. Suppose that crash dot json is not applied. Then the host moves its row into the quarantine file and marks the record applied.

Next, the host reads provisional dot json. It skips a record with its own P I D, because that host is still alive. If a crash record has the same P I D as the provisional record, the crash record wins. Else the host applies the provisional record the same way.

A quarantined row loads with no code. Its widget shows as failed, with the reason. It comes back only when files with a new hash load with success.

**Visuals**

Code card `ISO:223-234`:
```ts
const record = readJson(crashFile()) as CrashRecord | undefined
if (record !== undefined && !record.applied) apply(crashFile(), record)
const provisional = readJson(provisionalFile()) as CrashRecord | undefined
if (provisional !== undefined && !provisional.applied && provisional.pid !== process.pid) {
  if (record?.pid === provisional.pid) writeJsonSync(provisionalFile(), { ...provisional, applied: true })
  else apply(provisionalFile(), provisional)
}
```
`quarantine.json` card: `[{ row, slugs, reason: "quarantined after a crash (stall, blamed by slot): ...", at, root, hash }]`. Widget chip greyed: `failed`. Lift rule chip `ISO:236-253`: `files with another hash load with success > lift`.

## `ex_throw_call`

- Part: `part_example_throw`
- Target length: 36 s (85 words)

**Narration**

Now the worked example of pinger, step by step. An agent calls ping on pinger. The H T T P request arrives, and its callback runs in the poll phase. The runtime queues the call and starts the action timeout, a timer of five seconds.

Then a microtask calls run as with the row of pinger. Inside the store, the action handler calls context dot timeout with three seconds. Context dot timeout calls set timeout inside. So the new timer keeps the store of pinger.

**Visuals**

Outline with path A in red. Step list at the right, one line per beat:
`1 poll: POST /api/widgets/pinger/call { action: "ping" }`
`2 runtime: enqueue, setTimeout(timeout, 5000) (WR:946-959)`
`3 microtask: runAs("…deepwidgets-agent-pinger", handler) (WR:963)`
`4 handler: ctx.timeout(cb, 3000) > raw setTimeout inside (standing.checked.cordis_containment)`
`5 the timer captures the store: pinger`
The ribbon of pinger wraps the new timer card in the timers arc.

## `ex_throw_return`

- Part: `part_example_throw`
- Target length: 29 s (67 words)

**Narration**

The action handler writes the new count and returns. In slot puts the old value back, so the running-widget slot is zero again. The write settles, the call answers, and the runtime clears the action timeout.

The agent gets a good answer. For about three seconds, nothing in the host knows about the bad timer. The heartbeat keeps its beat, so the watchdog sees a healthy host.

**Visuals**

Step list continues:
`6 handler returns; inSlot finally: running-widget slot = 0 (WD:46-48)`
`7 write settles; call answers { result, rev }; clearTimeout(timer) (WR:980)`
`8 heartbeat 100 ms keeps beating; worker: stall clock resets each poll`
Clock overlay `t = 0 ... 3000 ms`, the timer card waits in the timers arc with its blue ribbon.

## `ex_throw_fire`

- Part: `part_example_throw`
- Target length: 33 s (77 words)

**Narration**

Three seconds later, the loop reaches the timers phase, and the pinger timer is due. Its callback runs on an empty stack and throws late boom. No frame has a try and catch block, so the error leaves the bottom of the stack.

Node emits uncaught exception on the process object. The listener of install fail loud runs at once. The async context of the timer callback is still current, so the store holds the pinger row.

**Visuals**

Step list:
`9 timers phase at t ≈ 3000 ms: cb() throws Error('late boom')`
`10 no try/catch: the error leaves the stack`
`11 process.emit('uncaughtException', err) > installFailLoud listener`
`12 blameStore.getStore() = pinger row (verified in model: late_throw.cjs)`
Red error card drops out of the stack into the process handler port.

## `ex_throw_claim`

- Part: `part_example_throw`
- Target length: 52 s (121 words)

**Narration**

The listener prints the fatal diagnostic and starts the exit. The exit calls the fatal hooks before its first await. The claimer reads get store and gets the pinger row. It builds the record with the row, the slug pinger, and the error late boom. The event is uncaught exception, and the method is store. It adds the package folder, its hash, and the P I D of the host.

It writes crash dot json with a write and a rename, and it prints one line. Then it calls process dot exit with code one. The plugin dispose never runs. The blame check of the earlier video measured a timer throw. From the fault to the exit took about sixty-five milliseconds.

**Visuals**

Step list:
`13 fatal.run() > claim(err, 'uncaughtException')`
`14 crash.json (temp file + rename)`
`15 stderr: deepwidgets: uncaughtException blamed on include:deepwidgets-agent-pinger (store); the host exits now`
`16 process.exit(1)`
Record card (illustrative values): `{ row: "include:deepwidgets-agent-pinger", slugs: ["pinger"], error: { name: "Error", message: "late boom", stack }, event: "uncaughtException", method: "store", root: ".../pinger", hash: "…", pid: 41210, applied: false }`. Chip: `timer throw, fault to exit 64 ms (run of record 8b9c8672) and 67 ms (rerun 108d663f); all nine fault kinds 19 to 103 ms (earlier video, tools/widgets-blame.mjs)`.

## `ex_throw_others`

- Part: `part_example_throw`
- Target length: 15 s (35 words)

**Narration**

What do the other boxes do? The watchdog does nothing here. The heartbeat never stopped, so the stall clock never reached five hundred milliseconds. No provisional record exists. The worker thread ends with the process.

**Visuals**

Outline right half: `watchdog thread: beats seen, no stall`, `provisional.json: none`. The worker box fades as the host box closes.

## `ex_throw_supervisor`

- Part: `part_example_throw`
- Target length: 43 s (101 words)

**Narration**

Electron main sees the host child exit with code one and no signal. The supervisor reads crash dot json. The P I D matches the dead child, and applied is false, so the crash has a blame. The policy starts a new host after half a second and does not count the crash. The widget windows stay open, and their pages connect again.

The new host reads the record. It moves the pinger row into the quarantine and marks the record applied. Pinger shows as failed, with the reason. Every other widget runs. Pinger comes back only when its files change.

**Visuals**

Step list:
`17 Electron main: exit { hostPid: 41210, hostCode: 1, hostSignal: null }`
`18 crash.json pid 41210 == dead pid, applied false > blamed: pinger`
`19 restart after 500 ms, crash not counted`
`20 new host: quarantine.json += pinger; crash.json applied: true`
`21 pinger: failed: quarantined after a crash (uncaughtException, blamed by store): late boom`
Outline: every box on path A lit once, in order.

## `ex_loop_call`

- Part: `part_example_loop`
- Target length: 26 s (61 words)

**Narration**

Now the worked example of spinner. An agent calls spin on spinner. As before, the request callback runs, and the runtime starts the action timeout of five seconds. Then a microtask calls run as.

In slot writes the slot index of spinner into the running-widget slot. Then the action handler starts its while loop. It never returns, and it never awaits.

**Visuals**

Outline with path B in amber. Step list:
`1 poll: POST /api/widgets/spinner/call { action: "spin" }`
`2 runtime: setTimeout(timeout, 5000)`
`3 microtask: runAs(spinner row) > inSlot: Atomics.exchange(slots, 1, 2)` (illustrative index 2)
`4 handler: while (true) {}`
Memory strip: `[heartbeat 812, running widget 2]`.

## `ex_loop_stuck`

- Part: `part_example_loop`
- Target length: 35 s (82 words)

**Narration**

Now the main thread is stuck. Look at each box. The call stack never empties, so the loop never reaches another phase. The heartbeat interval cannot run, so the heartbeat slot stops at its last value. The action timeout of spinner cannot run either.

The poll phase never comes. We infer that calls to pinger and to the sample counter wait at the socket. No error exists, so no process handler runs. The blame store holds spinner, but no code reads it.

**Visuals**

Outline: main lane red. Badges: `ring: stopped`, `heartbeat: 812 (frozen)`, `action timeout: due at 5000 ms, cannot run`, `sample.add, pinger.ping: waiting at the socket` (inferred: the kernel buffers the connection), `process handlers: idle`, `blame store: spinner (unread)`.

## `ex_loop_timeout_fails`

- Part: `part_example_loop`
- Target length: 35 s (81 words)

**Narration**

Why does the action timeout fail? The runtime races the action handler against a timer with promise dot race. A race needs both sides to get a turn. Our model shows the problem with a loop that ends.

The timeout was one hundred milliseconds, and the handler held the thread for one second. The race gave the handler value at one thousand milliseconds. The timeout promise rejected one millisecond later, and it lost. An endless loop never lets either side settle.

**Visuals**

Code card `race_timeout.cjs`:
```js
const t0 = Date.now()
const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 100))
const handled = Promise.resolve().then(() => {
  while (Date.now() - t0 < 1000) {}
  return 'handler value'
})
Promise.race([handled, timeout]).then(
  (value) => console.log('race gave:', value, 'at', Date.now() - t0, 'ms'),
  (error) => console.log('race gave:', error.message, 'at', Date.now() - t0, 'ms'),
)
timeout.catch(() => console.log('timeout promise rejected at', Date.now() - t0, 'ms'))
```
Output (Electron 44.7.0):
```text
race gave: handler value at 1000 ms
timeout promise rejected at 1001 ms
```
Code chip `WR:963-974`: `return await Promise.race([handled, timeout])` (WR:974). Caption: `a timer cannot interrupt a running callback`.

## `ex_loop_provisional`

- Part: `part_example_loop`
- Target length: 26 s (60 words)

**Narration**

On the watchdog thread, the stall clock grows. At five hundred milliseconds, the worker reads the running-widget slot with atomics load. The slot holds the index of spinner. The worker writes provisional dot json with the row of spinner, the event provisional stall, and the method slot. If an abort ended the host now, this record would carry the blame.

**Visuals**

Worker lane: poll ticks every 50 ms, stall counter `100 ... 450 ... 500 ms`. At 500 ms: `Atomics.load(slots, 1) = 2 > spinner`, then `provisional.json` appears on the disk with `event: provisional-stall, method: slot`.

## `ex_loop_kill`

- Part: `part_example_loop`
- Target length: 31 s (73 words)

**Narration**

At two seconds, the worker reads the slot again. It writes crash dot json with the event stall, the method slot, and a message that the event loop stalled. It removes its provisional record and writes one line to file descriptor two. Then it sends sig kill to the host. The watchdog check of the earlier video measured this path. A loop in an action died two thousand fifty milliseconds after the call.

**Visuals**

Worker lane at 2000 ms: `crash.json { event: "stall", method: "slot", error: { name: "WatchdogStall", message: "the event loop stalled for 2000 ms (threshold 2000 ms)" } }`, `provisional.json` removed, fd 2: `deepwidgets: watchdog: stall of 2000 ms blamed on include:deepwidgets-agent-spinner (slot); the host is killed now`, `process.kill(pid, 'SIGKILL')`. Number chip: `spin: SIGKILL 2050 ms after the call (tools/widgets-watchdog.mjs, 108d663f)`.

## `ex_loop_supervisor`

- Part: `part_example_loop`
- Target length: 21 s (48 words)

**Narration**

Electron main sees the host end with the signal sig kill. The crash record has the P I D of the dead host, so it wins. The blame is spinner. The host restarts after half a second, and the new host quarantines spinner. Every other widget comes back.

**Visuals**

Step list:
`exit { hostCode: null, hostSignal: "SIGKILL" }`
`crash.json pid == dead pid > blamed: spinner`
`restart 500 ms, not counted > quarantine spinner`
Outline: every box on path B lit once, in order.

## `ex_loop_variants`

- Part: `part_example_loop`
- Target length: 51 s (120 words)

**Narration**

Two variants show the edges. In the await variant, spinner awaits once and then loops. After the await, in slot already put back zero, so the slot names no widget. The desktop host has no working native module, so the crash record blames no widget. The supervisor counts an unblamed crash, and a few of them lead to safe mode.

In the heap variant, a widget fills the heap in a loop. The stall lasts at least five hundred milliseconds, and the abort comes before two seconds. The worker writes the provisional record. Then V eight aborts the process, and no crash record exists. The supervisor sees sig abort, so the provisional record decides. The next host quarantines that widget.

**Visuals**

Two strips. Strip 1 `spin after await`: `handler: await null; while (true) {}` > slot `0` > provisional: none (an unblamed provisional record changes nothing, `WDW:169-170`) > crash.json `row: null, method: null` > supervisor `unblamed, counted` > after 2 in 60 s: safe mode. Strip 2 `out of memory`: stall at least 500 ms (record at 508 ms in the check), abort before 2000 ms > provisional.json `row: <widget>` > V8 `FATAL ERROR ... heap out of memory`, `SIGABRT` > no crash.json of this pid > supervisor `abort exit > provisional decides` > quarantine. Chip: `oom: SIGABRT, the provisional record blames the widget (tools/widgets-watchdog.mjs, 108d663f)`.

## `limit_store`

- Part: `part_limits`
- Target length: 32 s (74 words)

**Narration**

Now the limits, plainly. The blame store sees only code that runs inside run as, or work that such code scheduled. Code at the top level of a bundle module runs at import, outside any run. A listener runs with the store of the code that called emit. So a listener of one widget can get the name of another widget, or no name. Callback libraries and custom thenables can also lose the context.

**Visuals**

Title card `limits`. Three blind-spot cards: `module top level: runs at import, no store` (stack match is the fallback, `ISO:332-339`); `listener: store of the emit caller` (ran: `als_emitter.cjs`); `custom thenables, callback APIs: context loss` (Node.js API, "Asynchronous context tracking", section "Troubleshooting: Context loss").

## `limit_misblame`

- Part: `part_limits`
- Target length: 25 s (58 words)

**Narration**

The store can also blame the wrong code. Suppose host code first makes a timer during a widget call. That host timer carries the store of the widget. If the host timer later throws, the claimer blames the widget. The crash-only spike found this case. The stack match runs only as a fallback, when the store is empty.

**Visuals**

Picture: a host service box makes a cache timer inside the blue ribbon of `pinger`; later the host timer throws; the claimer card says `blamed: pinger` in red. Source: `docs/explore/widget-system/where-we-stand.md:242` (`standing.checked.crash_only`: a host timer first made during a widget call blames that widget).

## `limit_slot`

- Part: `part_limits`
- Target length: 29 s (68 words)

**Narration**

The running-widget slot sees only the first sync piece of a call. A loop after an await, or in a timer callback, leaves the slot at zero. The callbacks of context dot interval and context dot timeout also run outside in slot. They carry the store, but not the slot. In the app, no native module fills that gap, so such a stall ends as an unblamed crash.

**Visuals**

Table: `code that loops` | store | slot | desktop blame: `action handler, sync` | yes | yes | slot; `action handler, after await` | yes | no | none; `ctx.interval / ctx.timeout callback` | yes | no | none; `plugin body, sync` | yes | yes | slot. Footnote: `store = the claimer path (errors); slot = the watchdog path (stalls)`. Source: `WD:10-12`, `WD:39-49`, ran `slot_await.cjs`.

## `limit_timeout`

- Part: `part_limits`
- Target length: 20 s (47 words)

**Narration**

The action timeout cannot stop a loop on the processor. It is a timer, and a timer needs the loop. It works only for an action handler that awaits for too long. Only the watchdog can end a loop, and only when it kills the whole host.

**Visuals**

Two rows: `handler awaits a slow fetch for 8 s` > timeout fires at 5 s > `504 timeout` (green tick); `handler loops` > timeout never fires > watchdog SIGKILL at about 2 s (red). Source: `WR:935-981`; ran `race_timeout.cjs`.

## `limit_threshold`

- Part: `part_limits`
- Target length: 26 s (60 words)

**Narration**

The two second threshold comes from one spike. A healthy step longer than two seconds dies. Under heavy machine load, the watchdog can also stop a healthy host. The spec keeps the threshold as an open point. The early record at five hundred milliseconds also catches healthy long steps. The abort rule of the supervisor stops those records from blaming.

**Visuals**

Chip: `2 s: from the crash_only spike (where-we-stand.md:242, WD:6-8)`. Chip: `CLAUDE.md head.commands: "Under machine load, the watchdog can stop a healthy host."`; open point `Watchdog threshold` in `widget_fv.open` (`docs/specs/widget-fv.md`). Scale bar from `threshold_why` with a grey zone `healthy but > 2 s: killed`.

## `limit_provisional_window`

- Part: `part_limits`
- Target length: 39 s (90 words)

**Narration**

The provisional record has a window of error, because the heartbeat clears it, not the end of the call. Suppose a call stalls for six hundred milliseconds and then returns. The worker removes the record only at its next poll, up to about fifty milliseconds later.

If the host aborts for another reason inside that window, the record blames a widget that already returned. The spec section widget f v crash plans a fix. The runtime will remove the record when the call returns. That fix is not built yet.

**Visuals**

Timeline: `call stalls 0 to 600 ms` > `500 ms: provisional.json (spinner)` > `600 ms: call returns, beat comes back` > `next poll <= 650 ms: removed`. A red window `600 to 650 ms: an abort here blames spinner`. Spec card `docs/specs/widget-fv.md:61`: `A provisional record exists only while the widget call that it names runs. When the call returns, the runtime removes the record.` Plan chip `docs/plans/widget-fv.md:13`: unit `widget.crash_records`, not merged at 68aabd9a.

## `limit_pid`

- Part: `part_limits`
- Target length: 26 s (61 words)

**Narration**

P I D reuse is an unchecked edge. The operating system can give the number of a dead process to a new process. The P I D check assumes that a record P I D belongs to one host only. The formal model left reuse out. We infer that a reuse inside one restart is rare, but no test checks it.

**Visuals**

Picture: `host pid 41210 dies` ... much later `another host gets pid 41210`. Tag amber: `inferred: rare; no test`. Note: `the TLA+ model of crash_lifecycle has no PID reuse` (from the chat of 2026-11-04).

## `limit_crash_only`

- Part: `part_limits`
- Target length: 22 s (52 words)

**Narration**

Last, the crash-only design has a cost. Each crash stops every widget, not only the bad one. The host restarts, and the pages connect again. The quarantine keeps the same widget files from a second crash. But a new bug in a new version of a widget can crash the host again.

**Visuals**

Outline: all chips blink out together, then come back except one. Chip: `about 2 s without widgets per crash (project notes)`. Chip: `quarantine key: row + package hash; new files = new chance`.

## `answers_records`

- Part: `part_close`
- Target length: 53 s (123 words)

**Narration**

Now the six answers in one place. The provisional record is a crash record that the watchdog writes ahead of time. It writes it at a stall of five hundred milliseconds. It names the widget in the running-widget slot, with the method slot. In the app, it counts for blame only after an abort, when no crash record of that host exists.

Which widget code can it name? Only the sync part of code inside run as. That is the plugin body and the first piece of an action handler. An earlier answer in the chat also named the callbacks of context dot interval and context dot timeout. That holds for the blame store, but not for the slot. We correct it here.

**Visuals**

Checklist column: the first card ticks. Summary card: `provisional.json = CrashRecord, event provisional-stall, method slot; written at 500 ms; removed when the beat returns; used by Electron main only for an abort exit`. Correction card, amber: `chat said: ctx.interval and ctx.timeout callbacks count. True for the blame store, false for the running-widget slot (WD:39-49).`

## `answers_effect`

- Part: `part_close`
- Target length: 38 s (89 words)

**Narration**

Rohan also asked whether the provisional record works like a Cordis effect with its own cleanup. Not today. The watchdog thread writes it and removes it by the heartbeat, not by the call.

The planned fix is closer to that picture. In the chat proposal, run as removes the record in a finally block when the call returns. That is a try and finally around one call, not a Cordis effect. An effect lives as long as its plugin, but this record would live as long as one call.

**Visuals**

Two bars: `ctx.effect: lives as long as the plugin fiber; disposer on stop or reload` and `planned provisional record (widget_fv.crash): lives as long as one call; removed in the finally of runAs (chat proposal; the spec names no function)`. Today bar: `provisional.json: removed by the watchdog thread when the beat returns (WDW:150-156)`. Tag: `planned, not built at 68aabd9a`.

## `answers_rest`

- Part: `part_close`
- Target length: 60 s (141 words)

**Narration**

Is a promise a process? No. A promise is an object that settles once. The then method adds a continuation to that one promise. A process handler is a global listener for the errors that escape every promise and every callback.

A P I D is the number of a running process. The supervisor uses it to tie a record to the host that wrote it. A handler is not a watcher. It is a function in the table of an emitter, and the code that detects an event calls emit. The only watcher is the watchdog thread.

Async local storage is not browser local storage. It is one value in memory that follows an async chain. An async chain is the tree of callbacks that one piece of code schedules. Trigger async I Ds link it, not the call stack.

**Visuals**

Checklist column: the other five cards tick one by one, each with a one-line answer: `promise: an object that settles once; then: a one-time continuation; process handler: a global sink`; `PID: the OS number of a running process; ties a record to one host`; `handler: a function in the emitter table; emit calls it; the watchdog is the only watcher`; `AsyncLocalStorage: one in-memory value per async chain`; `async chain: the tree of scheduled callbacks, linked by triggerAsyncId`.

## `closing`

- Part: `part_close`
- Target length: 36 s (84 words)

**Narration**

Here is the whole picture once more. One thread runs every widget, one callback at a time. The blame store rides along each async chain, so a global listener can name the widget behind a late error. A second thread watches a heartbeat in shared memory, so a stuck thread still gets a record and a kill. Electron main reads the records and starts a new host. The rules underneath are the call stack, the queues, the phases, the async context, and the threads.

**Visuals**

Outline diagram, full, every box lit. Path A (red) and path B (amber) traced once each. Final card: source list `research.md (2026-11-04)`, the articles named in the video, and `origin/main 68aabd9a`.
