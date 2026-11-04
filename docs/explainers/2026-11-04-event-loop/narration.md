## cold_open

This video explains the event loop under the crash handling of deepWidgets. The earlier video showed blame, the claimer, the supervisor, safe mode, and the watchdog. It showed what each part does. This video goes one level lower. It shows the JavaScript and Node rules that make each part work.

We start from zero. We build up the call stack, the queues, the Node phases, promises, listeners, async context, and threads. Then we put each rule back into the deepWidgets code. Two real failure paths run through the video. At the end, we list the limits plainly.

## viewer_questions

This video also answers six questions that Rohan asked. What does the provisional record contain, and how does it work with blame? Is a promise a process? What is a P I D?

Is a handler a watcher? Is async local storage like the local storage of a browser? And what is an async chain?

Each question gets its answer when the video has the words for it. The last part collects the six answers in one place. When a claim comes from a run on this machine, we say so. When we infer a claim, we say that too.

## outline_map

Here is the whole system on one diagram. The big box is the host. The host is the Node process that runs the code of every widget. It has one main thread. On that thread runs one event loop. The event loop is the part of Node that picks the next piece of code to run.

Inside the loop we show three things. The call stack holds the functions that run now. The microtask queue holds small callbacks that run next. The ring of phases shows how Node visits timers, input and output, and other work in a fixed order. We come back to this diagram between the parts.

## outline_walk

Now walk the rest of the diagram. The small chips are the action handlers of the widgets. An action handler is a widget function that runs when a user or an agent calls an action. All action handlers run on the same main thread.

A colored ribbon follows the work that each action handler starts. That ribbon is the blame store. It remembers which widget started the work. At the edge of the host sit the process handlers. They get each error that no other code caught.

On the right is the watchdog thread, a second thread in the host. It reads a heartbeat counter in shared memory. Below are two record files on disk, provisional dot json and crash dot json. Outside the host is Electron main. Its supervisor starts a new host after a crash.

## example_cast

Two failures run through the whole video. Both use small widgets that we made up for this video. Their code is illustrative, but each step that follows uses a real code path of deepWidgets.

The first widget is pinger. Its action ping sets a timer for three seconds and returns at once. When the timer fires, its callback throws an error. The second widget is spinner. Its action spin runs an endless loop. It never gives control back.

The first failure is an error that arrives late. The second failure is a thread that never stops. Each one takes a different path through the boxes. By the end, you can follow both paths without help.

## engine_and_host

On the diagram, we start inside the main thread. First, two words. The engine is the program that reads and runs JavaScript. In Node and in Electron, the engine is V eight. The host runtime is the program around the engine. It gives timers, files, the network, and the event loop.

The engine alone cannot wait for a timer. The host runtime does the waiting. The M D N page on the JavaScript execution model draws this same line. It also uses the word agent. An agent is like one thread, with one heap for its objects, one call stack, and one queue of work. The main thread of the deepWidgets host is one agent.

## call_stack

The call stack is a list of the functions that run now. When a function calls another function, the engine pushes a new frame on top. A frame holds the local values of one call. When a function returns, the engine pops its frame.

Look at the example. Main calls handle, and handle calls parse. The stack now has three frames. Then parse returns, handle returns, and main returns. The stack is empty again. Only then can the event loop pick new work.

A thrown error moves down the stack. It looks for a frame with a try and catch block. If no frame catches it, the error leaves the bottom of the stack. Keep that picture in mind. It matters for the process handlers.

## run_to_completion

Now the most important rule. JavaScript runs each piece of work to completion. When a callback starts, it runs until the stack is empty again. Nothing interrupts it. No other callback can run in the middle, and the loop cannot take the thread away.

This rule makes code simple. Two callbacks never change the same object at the same time. But the rule has a cost. A callback that runs for a long time holds the thread for that whole time. The M D N page says this directly. A long job blocks all other work of that agent.

## one_thread_many_widgets

Now apply the rule to deepWidgets. The host runs every widget on its main thread. The action handlers of pinger and spinner share that thread. The sample counter and the H T T P routes of the host share it too. They take turns.

Each turn ends only when the current code gives control back. Code gives control back when it returns, or when it waits with await. If one widget never gives control back, no other widget gets a turn. Keep this in mind. It is the reason for the watchdog.

## tasks

Where does new work come from when the stack is empty? It comes from queues. A task is one callback that the loop starts from a queue. A timer callback is a task. The callback of a finished file read is a task. The callback for an incoming network request is a task too.

The loop runs one task at a time. It takes a task, runs it to completion, and then looks at the queues again. Jake Archibald shows this model step by step in his article Tasks, microtasks, queues and schedules. His article is about the browser, but the same rules apply to Node.

## microtasks

There is a second kind of queue. A microtask is a small callback that runs right after the current code, before the next task. Promise callbacks are microtasks. The code after an await also runs as a microtask. You can add one yourself with queue microtask.

The loop drains the microtask queue after each task. Drain means that it runs microtasks until the queue is empty. If a microtask adds a new microtask, that new one also runs in the same drain. The HTML standard states this rule in its processing model. Thus all waiting microtasks run before the next timer gets a turn.

## order_example

Here is a small program. It logs script start and sets a timer with a delay of zero. It makes a promise with two then callbacks. It queues one microtask and calls process dot next tick. Last, it logs script end.

Before you look at the output, guess the order. Then compare. We ran this file with Electron forty-four in Node mode. That is the same runtime that runs the desktop host. Node twenty-four and Node twenty-two gave the same order.

## order_walkthrough

Here is why. The whole file is one task. It runs to completion first, so script start and script end come first. During that task, the code only scheduled the other callbacks.

When the stack is empty, Node first drains its next tick queue. That gives next tick. Then Node drains the microtask queue in order. Promise one and microtask were in the queue already. Promise one then added promise two, so promise two runs in the same drain.

Only now does the loop go on to a new task. The timer callback runs last, even with a delay of zero. A delay is a minimum, not an exact time.

## microtask_starvation

Microtasks can also block. This program sets a timer with a delay of zero. Then a microtask queues itself again and again, one million times. The timer cannot run until the microtask queue is empty.

The output shows it. The timer ran only after one million microtasks. A chain of microtasks that never ends blocks the loop as hard as an endless while loop. The timers never get a turn. We ran this file, and the output is on screen.

## libuv_ring

On the diagram, now look at the ring. Node splits the loop into phases. The library lib u v runs this loop. Each phase has its own queue of callbacks. The official guide, The Node J S Event Loop, lists them in this order.

The timers phase runs callbacks of set timeout and set interval. The pending phase runs some input and output callbacks that the system held back. The poll phase waits for new input and output, and runs their callbacks. The check phase runs callbacks of set immediate. The close phase runs close callbacks, for example of a closed socket. Then the ring starts again.

## poll_wait

The poll phase is where the loop sleeps. When no callback is ready, the loop waits there for input and output. It computes how long it may wait. The limit is the time until the next timer is due. The lib u v design page describes this step.

Thus an idle host uses almost no processor time. The thread sleeps in poll until a request arrives or a timer is due. When a request arrives, the poll phase runs its callback. In deepWidgets, each call from a user or an agent starts as such a callback. The H T T P request of the call arrives, and its callback starts the action.

## immediate_vs_timeout

Set immediate puts a callback in the check phase. Set timeout with zero puts one in the timers phase. Which runs first? It depends on where you call them.

Inside an input and output callback, set immediate always runs first. The loop is in poll, and check comes next. We ran that case, and immediate came before timeout. At the top level of a file, the order is not fixed. We ran such a file one hundred times on Electron. Immediate came first ninety-six times, and timeout came first four times.

## next_tick

Process dot next tick is not part of any phase. Node drains the next tick queue after the current operation, before the loop goes on. Then it drains the promise microtasks. That is why next tick came before promise one in our example.

The Node docs now mark process dot next tick as legacy. They tell new code to use queue microtask. One more detail matters. We ran the same example as an E S module. There, next tick came after promise two. So code must not depend on the order of these two queues.

## thread_pool

Node runs JavaScript on one thread only. Under the loop, lib u v keeps a thread pool. By default it has four threads. File system work and D N S lookups run there. Network sockets do not use the pool. The loop thread watches them with the system calls of the operating system.

The pool runs C code, not JavaScript. When the pool finishes the work, its callback goes back to the main loop. So a slow disk read does not block the loop. But the callback still runs on the main thread, like every other callback.

## block_everything

On the diagram, the whole ring now matters. We can say exactly what blocking means. A callback blocks the loop when it holds the call stack for a long time. While it runs, the loop cannot reach any phase. No timer runs. No request callback runs, and no other microtask runs.

A second Node guide is about blocking the event loop. It states the result for servers. Node has no preemption between clients. Preemption means that a scheduler stops a running job to give time to another job. So fairness is the job of the code, and each callback must be short.

## timers_minimum

The timers phase runs each timer whose time has come. A timer delay is a lower limit. Set timeout with five thousand milliseconds means not before five seconds. It does not mean at five seconds.

If the thread is busy, the timer waits. We ran a program that sets a timer of one hundred milliseconds. Then it runs a loop for one second. The loop ended at one thousand milliseconds. The timer ran at one thousand and two milliseconds, not at one hundred. Remember this result, because the action timeout of deepWidgets is such a timer.

## block_examples

What blocks in practice? The guide names a few kinds. A regular expression with nested repeats can take a very long time on a bad input. Synchronous file calls, such as read file sync, hold the thread until the disk answers. A JSON parse of a large text also holds it.

The guide measured a fifty megabyte JSON text. Its parse took about one point three seconds. deepWidgets measured a one hundred fifty megabyte parse in the host. It took eight hundred sixty-eight milliseconds in the check of the earlier video. That parse is healthy host code, and the watchdog must let it live.

## block_widgets

Apply this to the host. Every widget, every H T T P route, and every timer of the host share one loop. Suppose spinner runs its while loop. From that moment, the loop never reaches the timers phase or the poll phase again.

Pinger cannot get a call. The sample counter cannot get a click. The heartbeat timer of the watchdog cannot run. Even the action timeout of spinner cannot run, because it is a timer too. The process still exists for the operating system, but it does no work for anyone.

## block_remedies

The guide gives two remedies. You can partition the work. That means that you split it into small steps, with set immediate between them, so other callbacks get turns. Or you can offload the work to another thread.

deepWidgets cannot make agent code do either. An agent can write an endless loop by mistake. So deepWidgets does not try to prevent the block. It detects the block from outside the loop, and it ends the host. The part on threads shows how.

## promise_value

On the diagram, promises feed the microtask queue. A promise is an object that stands for a value that is not known yet. It has three states. Pending means no result yet. Fulfilled means it has a value. Rejected means it has an error.

Settled means fulfilled or rejected. A promise settles once and never changes after that. The M D N reference page on Promise uses these words. A promise lives in the heap, like any other object. One host can hold thousands of promises at the same time.

## promise_not_process

Is a promise a process? No. The M D N page says that promises represent processes that are already in progress. There, the word process means an operation, such as a file read that has started. It does not mean an operating system process.

The word process has three meanings in this video. An operating system process is a running program with its own memory. The host is one. The Node process object is one global object inside that program. It stands for the program inside JavaScript. A promise stands for one operation in progress, and thousands of promises live inside one operating system process.

## then_continuation

Then adds a continuation to one promise. A continuation is the code that runs after a value is ready. The callback of then runs once, when that promise settles. It runs as a microtask, never at once, even for a promise that already settled. Then returns a new promise, so you can make a chain.

In functional terms, a promise is close to a future value. Then is the map step on that one value. The callback belongs to one promise only. It is not a listener for the whole process. Remember this difference for the part on process handlers.

## await_continuation

Await is a short way to write then. The V eight team explains it in the post Faster async functions and promises. At an await, the engine suspends the async function. It attaches a continuation to the awaited promise. Then it returns a promise to the caller at once. Later, a microtask resumes the function after the await.

Look at the example. The program logs A. It calls handler, which logs handler start and reaches the await. The handler returns to the caller at that point. The program logs B. Only then does a microtask resume the handler, and it logs handler resumed.

## await_split

This result is important for deepWidgets. An async handler runs in pieces. The first piece runs at once, up to the first await. Each later piece runs in a later microtask or task, after the caller already returned.

Code that wraps the call can only see the first piece. When the wrap returns, the later pieces did not run yet. The running-widget slot of the watchdog works like such a wrap. We come back to this in the part on the watchdog.

## emitter_table

On the diagram, look at the edge of the host, at the process handlers. To explain them, we need listeners. An event emitter is an object with a table. The table maps each event name to a list of functions. Each function in a list is a listener.

Handler is a common second word for listener. In this video, a process handler means a listener on the process object. The method on adds a listener to the end of the list for one name. The listener stays there until the method off removes it. The method emit takes a name and calls each listener for that name.

## emit_sync

Emit is synchronous. It calls the listeners in the order in which code added them, and it waits for each one to return. The Node events docs say this. We ran a small program to show it.

The program adds two listeners for the event ping. It logs before emit, calls emit, and logs after emit. The output shows listener one and listener two between the two logs. So the listeners ran inside the emit call, on the same stack. This is the observer pattern. The emitter is the subject, and the listeners are the observers.

## handler_not_watcher

So is a handler a watcher? No. A listener does nothing by itself. It does not poll, and it does not wait. It is a plain function in a table. It runs only when some code calls emit.

The code that detects the event calls emit. For a network socket, Node calls emit when data arrives in the poll phase. For an uncaught exception, the Node runtime calls emit when an error leaves the stack. In deepWidgets, only one part really watches. That part is the watchdog thread. It checks the heartbeat every fifty milliseconds.

## process_handlers

The process object is one event emitter for the whole program. Two of its events matter here. Node emits uncaught exception when a throw leaves the bottom of the stack and no code caught it. Node emits unhandled rejection when a promise rejects and no code handles the rejection within a turn of the loop.

With no listener, each event ends the process with exit code one. We ran a rejection that nobody handled, and Electron exited with code one. A listener replaces that default. The Node docs call uncaught exception a last-resort mechanism. They also warn that it is not safe to go on after it.

## last_resort_sink

Compare a process handler with a then callback. A then callback belongs to one promise. It runs once, and then it is gone. A process handler belongs to the whole process. It stays until code removes it, and it sees every error that escapes all local code.

In functional terms, each then or catch is a local handler for one value. The process handler is a global sink. It gets the errors that no local handler took. But a sink gets only the error. It does not know which code started the failed work. That is the problem that the blame store solves.

## effect_vs_listener

One more difference matters for widget code. A Cordis effect is a function that does a side effect and returns a disposer. A disposer is a function that undoes the side effect. Cordis runs each disposer when the plugin stops or reloads.

A process listener has no owner. If a widget calls process dot on at each reload, the number of listeners grows. The plugins spike counted the process listeners. They went from two to five over four reloads.

The lint gate for agent code refuses raw timers, such as set timeout. Agent code uses context dot timeout and context dot interval, which have owners. The claimer of deepWidgets is itself a Cordis effect, so a reload removes it.

## lost_context

On the diagram, look at the colored ribbon. To explain it, we start with a problem. Sync code can keep a value in a variable while it runs. But an await or a timer replaces the stack. When the callback runs later, the stack of the code that started it is gone. Any value that only lived on that stack is gone too.

The T C thirty-nine proposal for async context describes this problem. T C thirty-nine is the committee that changes the JavaScript language. The proposal asks for a value that follows the code across await and timers. Node already has such a tool. Before we look at it, we need a name for the path that work follows.

## async_chain

An async chain is the tree of async work that one piece of code starts. It holds each callback that runs later because that code scheduled it. To schedule means to make a timer, to call then, or to start some input and output.

Look at the example. The root code sets a timer for a, adds b to a fetch with then, and queues the microtask c. Later, a sets a timer for d. All four belong to the chain of the root.

They run in later turns of the loop, after the root returned. So they share no call stack with the root. They share a cause. A call stack is a line of direct calls. An async chain is a tree of causes.

## async_ids

Node tracks this tree with async hooks. An async resource is an object with a callback that runs later, such as a timer or a promise. Each async resource gets a number, its async I D. Each one also keeps a trigger async I D. That is the async I D of the code that was current when code made the resource.

We ran a small program. The top level had async I D one. Timer a ran with async I D five, and its trigger was one. Timer d ran with async I D seven, and its trigger was five. Each trigger points to a parent, and the parent pointers form the tree of the chain.

## als_intro

Async local storage is the Node tool that carries one value along an async chain. Despite the name, it has nothing in common with the local storage of a browser. Browser local storage keeps string pairs on disk for each web site, across reloads. Async local storage keeps one value in memory for each async chain. It lives only while that chain has work.

The Node docs compare it with thread-local storage in other languages. JavaScript has no thread-local values, because one thread runs many chains in turns. So the store follows the chain, not the thread. In functional terms, it is a reader context, or a dynamic scope, for async code.

## als_run

Two methods do most of the work. Run takes a value and a function. It runs the function at once with that value as the store. Get store returns the value of the current chain. Outside any run, get store gives undefined.

We ran the program on screen. It starts a chain with the value widget a. That chain awaits, then sets a timer. It also runs a short chain with widget b.

The output shows widget b inside its run, then undefined outside any run. Last, the timer of the widget a chain logs widget a. The value followed the chain across the await and the timer.

## als_capture

When does a callback get its store? At registration time, not at run time. Registration is the moment when code makes the timer or calls then. The callback keeps the store of the code that registered it. The T C thirty-nine proposal and the Winter T C page on async local storage describe this frame model.

This rule decides blame in deepWidgets. A timer that widget code makes carries the store of that widget, for its whole life. It does not matter when the timer fires or what runs around it.

## als_emitter_rule

Listeners follow a different rule. A listener runs inside the emit call. So it runs with the store of the code that called emit. It does not get the store of the code that added it. The Node docs and the Winter T C page say this.

We ran a test. Widget a adds a listener inside its run. Then widget b calls emit inside its run. The listener of widget a sees widget b. A second emit outside any run gives undefined.

So a listener can get the wrong name, or no name. This is one of the blind spots of the blame store.

## als_frame

How does Node keep the store? Node twenty-two used async hooks for it. Node twenty-four uses a newer design, the async context frame. Each run makes a new frame. Each new async resource keeps the frame that is current when code makes it.

Does Electron forty-four use the newer design? The research had this as an open point, so we checked it. The desktop host runs as Electron in Node mode, with the flag expose internals. We ran Electron forty-four in that same mode and read the internal flag of the frame module. It said true. Node twenty-four point eight also said true, and Node twenty-two said false.

## worker_thread

On the diagram, look at the right side of the host. A worker thread is a second JavaScript thread inside the same process. In Node, the worker threads module makes one. Each worker has its own heap, its own call stack, and its own event loop. The lib u v design says that each loop belongs to one thread.

So a worker keeps running when the main thread is stuck. Its timers fire on its own loop. The Node docs say that workers help with heavy processor work in JavaScript. deepWidgets uses a worker for another reason. It wants one thread that a stuck main thread cannot stop.

## shared_memory

Threads do not share objects. When the main thread posts a message to a worker, Node copies the data. A message also needs a callback on the other side to read it. A stuck main thread reads no messages.

A shared array buffer is the exception. It is a block of raw memory that both threads see at the same time. When you post it, the other side gets a new view of the same bytes. The deepWidgets host puts two thirty-two-bit integers in such a buffer. We call each integer a slot. The heartbeat slot holds a counter, and the running-widget slot holds the number of the widget whose code runs.

## atomics

Two threads that touch the same memory need rules. A write on one thread can take time to reach the other thread. Atomics are functions that read or write shared memory in one step that no other thread can split. The M D N reference lists them.

Atomics add adds a number and gives the old value. Atomics load reads a value. Atomics store writes a value. Atomics exchange writes a new value and gives the old one back. The M D N execution model page says that these operations are sequentially consistent. Every thread sees them in one agreed order.

## heartbeat_demo

We built a small model of the watchdog and ran it on Electron. The main thread adds one to a heartbeat slot every one hundred milliseconds. A worker checks the slot every fifty milliseconds. At three hundred milliseconds, the main thread starts a loop that holds it until eighteen hundred milliseconds.

The worker saw no beat for five hundred nine milliseconds, and it wrote a line at seven hundred forty-four milliseconds. It wrote again at one thousand two hundred fifty-five milliseconds, after a stall of one thousand twenty milliseconds. The main thread was still in its loop. The worker loop kept its own time.

At that same moment, the worker also logged one line with console dot log. That line appeared only after the main loop ended. Console output of a worker goes through the main thread. This is why the real watchdog writes to file descriptor two directly.

## pid_signals

Now the words that the supervisor uses. A P I D is a process I D. The operating system gives each running process a number. In JavaScript, process dot p i d gives it. We started two child processes in a row, and they got two different numbers. After a process ends, the system can give its number to a new process.

A signal is a short message from the operating system to a process. Sig kill ends a process at once, and no listener can catch it. We tried to add a listener for sig kill, and Node refused with the error E INVAL. A child that sig kill ended reported the signal sig kill and no exit code. Its exit listener never ran.

## abort_exit

An out-of-memory error is different. V eight stops the process with an abort. We ran a child with a small heap limit and a loop that fills the heap. The child printed fatal error, javascript heap out of memory. It ended with the signal sig abort.

The child had a listener for uncaught exception and a listener for exit. Neither ran. An abort runs no JavaScript at all. When the system reports an abort as an exit code, the code is one hundred thirty-four. That is one hundred twenty-eight plus six, the number of sig abort. So code that must leave a record for this case must write it before the abort.

## blame_overview

Back to the outline. We now have the words for every box. This part shows the boxes of blame: the blame store, the process handlers, the claimer, and the crash record. The next part shows the watchdog and the provisional record. The part after that shows the supervisor.

## run_as

The blame store is one async local storage in the file isolation dot t s. Its value is the I D of a Loader row. A Loader row is one line of the plugin list of the host. Each widget has its own row. The row I D starts with deepwidgets widget, or with deepwidgets agent for a bundle that an agent installed.

The function run as takes a row and a function. It calls run on the blame store with that row. Inside, it calls in slot, which puts the row into the running-widget slot. Then it calls the function. The runtime calls each action handler inside run as. So every timer and promise that an action handler makes carries the row I D.

## fiber_wrap

Action handlers are not the only widget code. The plugin body runs when the widget loads, and its effects, intervals, and timeouts start there. To cover them, the runtime wraps the fiber runner of each widget row. A fiber is the Cordis object that owns one loaded plugin. The runner is the internal part that runs the plugin body.

Cordis has no public hook around a plugin body, so this wrap uses an internal part. The wrap calls run as before the body runs. Thus the store holds the row before the widget code schedules anything. That matters, because a callback keeps the store of the moment when code registered it.

## claimer_path

Now the path of a fatal error. Node emits uncaught exception or unhandled rejection on the process object. The DSH boot code has one listener for each, from the function install fail loud. That listener prints the error and starts the exit of the host.

deepWidgets adds one step to that exit, with a trim change. Before the slow dispose of all plugins, the exit calls each fatal hook. The claimer is one fatal hook. It is not a process listener of its own.

The whole path runs at once, inside the process listener, on the same stack. The first await of the exit comes only after the fatal hooks. So the claimer runs inside the listener, before any other callback.

## claimer_context

Which store does the claimer see? First take uncaught exception. The async hooks docs say that the after hook of a callback that threw runs only after the listener. So the context of the throwing callback is still current inside the listener.

For unhandled rejection, the Node twenty-four source puts back the context frame of the moment when the promise rejected. We ran both cases on Electron forty-four. A timer in the chain of widget a threw, and the process listener read widget a from the store. A promise in the chain of widget b rejected after a timer, and the listener read widget b. Node twenty-two and Node twenty-four gave the same results.

## claimer_steps

The claimer then does five steps. It reads get store. If the store is empty, it searches the error stack for the package folder of a known widget. It builds the crash record. It writes crash dot json with a synchronous write to a temporary file and a rename. Then it calls process dot exit with code one.

Why synchronous calls? Process dot exit ends the process at once. It does not wait for pending async work. An async write could still wait in the thread pool when the process ends. The rename makes sure that a reader never sees half a file.

## crash_record

Here is the crash record. Row is the Loader row I D of the blamed widget, or null. Slugs are the I Ds of the widgets that the row registered. Error holds the name, the message, and the stack. At is the time in milliseconds. Event is uncaught exception, unhandled rejection, stall, or provisional stall.

Method tells how the host found the widget, for example store, stack, or slot. Root and hash name the package folder and a fingerprint of its files. P I D is the process I D of the host that wrote it. Applied turns true after a later host moved the blame into the quarantine. The provisional record has this same form.

## crash_only

Why exit at all? Recall the warning of the Node docs. After an uncaught exception, the state of the program is unknown. An earlier design caught the error and went on. That design could also hide an error in host code that a widget called.

So the host is crash-only. It names the widget, writes the record, and exits. By the project notes, each crash stops every widget for about two seconds. The next host keeps the blamed widget off until its files change.

## watchdog_overview

Back to the outline once more. The blame store needs a callback that runs. A thread in an endless loop runs no new callback. So no error ever reaches the process handlers, and the claimer never runs. The right side of the diagram handles that case. This part shows the running-widget slot, the heartbeat, the watchdog thread, and the two records.

## running_slot

Start with the running-widget slot. The function in slot gets the slot index of the row. It writes that index into the running-widget slot with atomics exchange, and keeps the old value. Then it calls the function. In a finally block, it writes the old value back with atomics store. Index zero means no widget.

Now recall the await example. In slot wraps only the first piece of the function, up to its first await. We ran a model of in slot around an async function. Before the await, the slot read seven. After the await, it read zero. The code comment in watchdog dot t s states the same limit.

## slot_names

A short warning about one word. The code uses the word slot for three things. The heartbeat slot and the running-widget slot live in shared memory.

The runtime also has a queue slot. It is a second async local storage that marks which call holds the queue of a widget. The queue slot plays no part in blame. In this video, slot alone always means a slot in shared memory.

## heartbeat_beat

Next, the heartbeat. When the runtime starts, the main thread makes a set interval of one hundred milliseconds. Each tick calls atomics add on the heartbeat slot. That interval runs in the timers phase. So a new beat shows that the main loop reached the timers phase again. A missing beat means that something holds the thread.

The interval also calls unref. With unref, this timer alone does not keep the process alive.

## watchdog_poll

Now the watchdog thread itself. It has its own set interval of fifty milliseconds. On each poll, it loads the heartbeat slot. If the value changed, the main thread is alive. The worker then resets its stall clock, and it removes its provisional record if it wrote one.

If the value did not change, the stall grows. The stall clock uses performance dot now, a monotonic clock, so a change of the wall clock does not matter. One more check protects a sleeping machine. If the poll itself came one second late or more, this thread did not run either. Then something stopped the process, or the machine slept. So the worker starts the stall clock again and kills nothing.

## provisional_record

Then the provisional record. When the stall reaches five hundred milliseconds, a quarter of the threshold, the worker reads the running-widget slot. If the slot names a widget, the worker writes provisional dot json. It has the same form as the crash record. Its event is provisional stall, and its method is slot.

Why write a record before anything dies? Recall the abort test. An out-of-memory abort runs no JavaScript. No process handler runs, and no claimer runs. The provisional record is then the only blame.

If the beat comes back, the worker removes the record at its next poll. So the provisional record is not a Cordis effect with its own cleanup. The heartbeat clears it, not the end of the call.

## kill_path

Last, the kill. At a stall of two seconds, the worker reads the slot again. It writes crash dot json with the event stall. If the slot names no widget and the native module loaded, it also reads the stack of the stuck thread. Then it removes its provisional record and writes one line to file descriptor two. Last, it sends sig kill to its own process.

No code in the host can catch sig kill, so a stuck host cannot refuse it. The desktop host has no Electron build of the native module. So in the app, the watchdog blames by the slot only. The command-line host can load that module.

## threshold_why

Why two seconds? A healthy host step can also hold the thread for a while. The one hundred fifty megabyte parse took eight hundred sixty-eight milliseconds in the earlier check. In the crash-only spike, a threshold of five hundred milliseconds killed a healthy host during such a parse. So the kill waits for two seconds, and only the early record uses the shorter time.

## supervisor_rules

On the diagram, look outside the host, at Electron main. When the host child exits, the supervisor gets its P I D, its exit code, and its signal. It reads both record files. A crash record counts only when its P I D matches the dead child. Also, no host can have applied it yet. A crash record of the dead host always wins, also when it blames no widget.

With no crash record of that host, the provisional record can decide. But it counts only for an abort exit. An abort exit means the signal sig abort, sig trap, or sig ill, or the exit code one hundred thirty-four. After any other exit, the supervisor deletes the provisional record.

## record_pid_match

Why match the P I D? The record files stay on disk from one host to the next. A host can die at boot, before it applies an older record. Without the P I D check, that old record could blame its old widget for a new crash. The P I D ties each record to one host process.

Why the abort rule? A widget can have a long allowed step, and the host can end for another reason during that step. Such an end is not the fault of that widget. Only an abort fits the case that the provisional record exists for.

## backoff

A blamed crash starts a new host after half a second. It does not count toward safe mode, because the quarantine handles it. An unblamed crash counts. The waits grow from half a second to two seconds to eight seconds.

After two unblamed crashes in sixty seconds, the next host starts in safe mode. Safe mode runs only the built-in widgets. After four unblamed crashes in sixty seconds, the supervisor gives up and shows the fatal dialog.

## restart_windows

What does the user see during a restart? The supervisor starts a new host child and loads the main window again. The widget windows stay open. Their pages lose the connection to the host for a short time, and then they connect again. In the earlier video, a page showed fresh data about two seconds after a kill.

## next_host

The new host reads the records at start. Suppose that crash dot json is not applied. Then the host moves its row into the quarantine file and marks the record applied.

Next, the host reads provisional dot json. It skips a record with its own P I D, because that host is still alive. If a crash record has the same P I D as the provisional record, the crash record wins. Else the host applies the provisional record the same way.

A quarantined row loads with no code. Its widget shows as failed, with the reason. It comes back only when files with a new hash load with success.

## ex_throw_call

Now the worked example of pinger, step by step. An agent calls ping on pinger. The H T T P request arrives, and its callback runs in the poll phase. The runtime queues the call and starts the action timeout, a timer of five seconds.

Then a microtask calls run as with the row of pinger. Inside the store, the action handler calls context dot timeout with three seconds. Context dot timeout calls set timeout inside. So the new timer keeps the store of pinger.

## ex_throw_return

The action handler writes the new count and returns. In slot puts the old value back, so the running-widget slot is zero again. The write settles, the call answers, and the runtime clears the action timeout.

The agent gets a good answer. For about three seconds, nothing in the host knows about the bad timer. The heartbeat keeps its beat, so the watchdog sees a healthy host.

## ex_throw_fire

Three seconds later, the loop reaches the timers phase, and the pinger timer is due. Its callback runs on an empty stack and throws late boom. No frame has a try and catch block, so the error leaves the bottom of the stack.

Node emits uncaught exception on the process object. The listener of install fail loud runs at once. The async context of the timer callback is still current, so the store holds the pinger row.

## ex_throw_claim

The listener prints the fatal diagnostic and starts the exit. The exit calls the fatal hooks before its first await. The claimer reads get store and gets the pinger row. It builds the record with the row, the slug pinger, and the error late boom. The event is uncaught exception, and the method is store. It adds the package folder, its hash, and the P I D of the host.

It writes crash dot json with a write and a rename, and it prints one line. Then it calls process dot exit with code one. The plugin dispose never runs. The blame check of the earlier video measured this path. From the fault to the exit took about twenty to one hundred milliseconds.

## ex_throw_others

What do the other boxes do? The watchdog does nothing here. The heartbeat never stopped, so the stall clock never reached five hundred milliseconds. No provisional record exists. The worker thread ends with the process.

## ex_throw_supervisor

Electron main sees the host child exit with code one and no signal. The supervisor reads crash dot json. The P I D matches the dead child, and applied is false, so the crash has a blame. The policy starts a new host after half a second and does not count the crash. The widget windows stay open, and their pages connect again.

The new host reads the record. It moves the pinger row into the quarantine and marks the record applied. Pinger shows as failed, with the reason. Every other widget runs. Pinger comes back only when its files change.

## ex_loop_call

Now the worked example of spinner. An agent calls spin on spinner. As before, the request callback runs, and the runtime starts the action timeout of five seconds. Then a microtask calls run as.

In slot writes the slot index of spinner into the running-widget slot. Then the action handler starts its while loop. It never returns, and it never awaits.

## ex_loop_stuck

Now the main thread is stuck. Look at each box. The call stack never empties, so the loop never reaches another phase. The heartbeat interval cannot run, so the heartbeat slot stops at its last value. The action timeout of spinner cannot run either.

Calls to pinger and to the sample counter wait at the socket, because the poll phase never comes. No error exists, so no process handler runs. The blame store holds spinner, but no code reads it.

## ex_loop_timeout_fails

Why does the action timeout fail? The runtime races the action handler against a timer with promise dot race. A race needs both sides to get a turn. Our model shows the problem with a loop that ends.

The timeout was one hundred milliseconds, and the handler held the thread for one second. The race gave the handler value at one thousand milliseconds. The timeout promise rejected one millisecond later, and it lost. An endless loop never lets either side settle.

## ex_loop_provisional

On the watchdog thread, the stall clock grows. At five hundred milliseconds, the worker reads the running-widget slot with atomics load. The slot holds the index of spinner. The worker writes provisional dot json with the row of spinner, the event provisional stall, and the method slot. If an abort ended the host now, this record would carry the blame.

## ex_loop_kill

At two seconds, the worker reads the slot again. It writes crash dot json with the event stall, the method slot, and a message that the event loop stalled. It removes its provisional record and writes one line to file descriptor two. Then it sends sig kill to the host. The watchdog check of the earlier video measured this path. A loop in an action died two thousand fifty milliseconds after the call.

## ex_loop_supervisor

Electron main sees the host end with the signal sig kill. The crash record has the P I D of the dead host, so it wins. The blame is spinner. The host restarts after half a second, and the new host quarantines spinner. Every other widget comes back.

## ex_loop_variants

Two variants show the edges. In the await variant, spinner awaits once and then loops. After the await, in slot already put back zero, so the slot names no widget. The desktop host has no working native module, so the crash record blames no widget. The supervisor counts an unblamed crash, and a few of them lead to safe mode.

In the heap variant, a widget fills the heap in a loop. The stall lasts five hundred milliseconds before the end. The worker writes the provisional record. Then V eight aborts the process, and no crash record exists. The supervisor sees sig abort, so the provisional record decides. The next host quarantines that widget.

## limit_store

Now the limits, plainly. The blame store sees only code that runs inside run as, or work that such code scheduled. Code at the top level of a bundle module runs at import, outside any run. A listener runs with the store of the code that called emit. So a listener of one widget can get the name of another widget, or no name. Callback libraries and custom thenables can also lose the context.

## limit_misblame

The store can also blame the wrong code. Suppose host code first makes a timer during a widget call. That host timer carries the store of the widget. If the host timer later throws, the claimer blames the widget. The crash-only spike found this case. The stack match runs only as a fallback, when the store is empty.

## limit_slot

The running-widget slot sees only the first sync piece of a call. A loop after an await, or in a timer callback, leaves the slot at zero. The callbacks of context dot interval and context dot timeout also run outside in slot. They carry the store, but not the slot. In the app, no native module fills that gap, so such a stall ends as an unblamed crash.

## limit_timeout

The action timeout cannot stop a loop on the processor. It is a timer, and a timer needs the loop. It works only for an action handler that awaits for too long. Only the watchdog can end a loop, and only when it kills the whole host.

## limit_threshold

The threshold is a guess with a margin. A healthy step longer than two seconds dies. Under heavy machine load, the watchdog can also stop a healthy host. The project rules record this as an open point. The early record at five hundred milliseconds also catches healthy long steps. The abort rule of the supervisor stops those records from blaming.

## limit_provisional_window

The provisional record has a window of error, because the heartbeat clears it, not the end of the call. Suppose a call stalls for six hundred milliseconds and then returns. The worker removes the record only at its next poll, up to about fifty milliseconds later.

If the host aborts for another reason inside that window, the record blames a widget that already returned. The spec section widget f v crash plans a fix. Run as would remove the record when the call returns. That fix is not built yet.

## limit_pid

P I D reuse is an unchecked edge. The operating system can give the number of a dead process to a new process. The P I D check assumes that a record P I D belongs to one host only. The formal model left reuse out. We infer that a reuse inside one restart is rare, but no test checks it.

## limit_crash_only

Last, the crash-only design has a cost. Each crash stops every widget, not only the bad one. The host restarts, and the pages connect again. The quarantine keeps the same widget files from a second crash. But a new bug in a new version of a widget can crash the host again.

## answers_records

Now the six answers in one place. The provisional record is a crash record that the watchdog writes ahead of time. It writes it at a stall of five hundred milliseconds. It names the widget in the running-widget slot, with the method slot. In the app, it counts for blame only after an abort, when no crash record of that host exists.

Which widget code can it name? Only the sync part of code inside run as. That is the plugin body and the first piece of an action handler. An earlier answer in the chat also named the callbacks of context dot interval and context dot timeout. That holds for the blame store, but not for the slot. We correct it here.

## answers_effect

Rohan also asked whether the provisional record works like a Cordis effect with its own cleanup. Not today. The watchdog thread writes it and removes it by the heartbeat, not by the call.

The planned fix is closer to that picture. Run as would remove the record in a finally block when the call returns. That is a try and finally around one call, not a Cordis effect. An effect lives as long as its plugin, but this record would live as long as one call.

## answers_rest

Is a promise a process? No. A promise is an object that settles once. The then method adds a continuation to that one promise. A process handler is a global listener for the errors that escape every promise and every callback.

A P I D is the number of a running process. The supervisor uses it to tie a record to the host that wrote it. A handler is not a watcher. It is a function in the table of an emitter, and the code that detects an event calls emit. The only watcher is the watchdog thread.

Async local storage is not browser local storage. It is one value in memory that follows an async chain. An async chain is the tree of callbacks that one piece of code schedules. Trigger async I Ds link it, not the call stack.

## closing

Here is the whole picture once more. One thread runs every widget, one callback at a time. The blame store rides along each async chain, so a global listener can name the widget behind a late error. A second thread watches a heartbeat in shared memory, so a stuck thread still gets a record and a kill. Electron main reads the records and starts a new host. The rules underneath are the call stack, the queues, the phases, the async context, and the threads.
