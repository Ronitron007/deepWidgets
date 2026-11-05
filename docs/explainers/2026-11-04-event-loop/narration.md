## cold_open

This video explains how deepWidgets survives a widget that crashes or freezes. It also explains the JavaScript and Node rules underneath.

In a side chat, you asked eight questions about this code. Each question gets a plain answer, at the moment the video has the words for it. Each new word gets a picture and a tiny example before we use it. Details that the picture does not need go to a separate cut list.

## outline_map

Here is the whole path on one picture. We follow it from left to right.

A widget runs its code inside one process, together with all the other widgets. Two things can go wrong. The code can throw an error later, after its call returned. Or the code can loop forever and freeze everything.

Then four jobs follow. Something must notice the problem. Something must find which widget caused it, and write that down on disk. Something must start the widget process again. And the next start must keep the bad widget off, so that the other widgets run.

Each box on this picture gets its real name later in the video. We come back to this picture between the parts.

## two_failures

Two failures run through the whole video. Both use small widgets that we made up. Their code is illustrative, but each step uses a real code path of deepWidgets.

The first widget is pinger. Its action ping waits three seconds and then throws an error. The call itself returns at once, with the answer ok. So the error comes three seconds after the call ended.

The second widget is spinner. Its action spin runs a loop that never ends. It never gives control back. By the end of the video, you can follow both failures through every box.

## call_stack

We start at the floor, with the call stack. The call stack is the list of the function calls that run now. Picture a pile of pancakes. Each call puts one pancake on top. Each return takes the top pancake off.

Look at this tiny example. Function a calls b, and b calls c. The pile grows to three. Then c returns, then b, then a. When the pile is empty, this piece of code has finished.

The call stack also holds the local values of each call. When a call returns, its local values go away with its pancake.

## heap_vs_stack

Objects need a place that lives longer than one call. That place is the heap. The heap is a big area of memory for objects. The call stack holds only an arrow that points to the object in the heap.

In this example, make user creates an object and returns it. The call ends, and its pancake goes away. The object stays in the heap, because the caller still holds an arrow to it.

You asked if each thread has its own heap. Hold that question. We answer it when we meet a second thread.

## process_pid

Next, the process. You know the idea: a process is a running program with its own memory. The operating system keeps each process apart, so one process cannot touch the memory of another.

The operating system gives each process a number, the P I D. P I D means process I D. Other programs use this number to point at one process. For example, they use it to stop that process.

When you start deepWidgets, you start one process first. We call it the app process. It is Electron, and it owns the windows.

## child_process

A process can start another process. The new one is a child process, and the first one is its parent. The child gets its own P I D and its own memory. It also remembers the P I D of its parent.

In this example, one Node process starts two children. Each child prints its own P I D and the P I D of its parent. Each number is different, and both children name the same parent.

In deepWidgets, the app process starts one child process that runs every widget. We call this child the host. When the host dies, the app process stays alive. So the app can start a new host.

## signals

How does one process stop another? It sends a signal. A signal is a short message that the operating system delivers to a process, by its P I D. Think of it as a text message to a process. Many signals ask politely, and the process can catch such a signal with its own function.

One signal is different: sig kill. No code of the target runs. The operating system ends the process at once, with no cleanup. We infer the reason. A stuck process cannot refuse sig kill, so sig kill always works.

Our run confirms the rule. Node does not let a program listen for sig kill. It throws an error instead.

## exit_info

When a child process ends, its parent learns how it ended. There are two kinds of answer. A child that exits by itself leaves an exit code. Zero means fine, and any other number means trouble.

A child that a signal ended leaves the name of that signal, and no exit code. Our run shows three children. The killed child shows sig kill, and its cleanup code never printed. The second child catches a polite signal with its own function, and then exits with code zero.

The third child ran out of memory. Its heap was full, and V eight ended it with another signal, sig abort. No JavaScript ran at the end. Keep that in mind for later.

## one_thread

Back to the host. All widget code in the host runs on one thread, the main thread. One thread means one call stack. So only one piece of JavaScript runs at any moment.

This gives a strict rule. Once code starts, it runs until the call stack is empty again. Nothing can stop it in the middle. Another widget cannot cut in, and a clock cannot cut in either.

Jake Archibald stresses one rule: code runs to its end before other code starts. The rule has a good side: two pieces of code never change one object at the same time. But it has a price, and we meet it soon.

## task_queue

If only one piece of code runs at a time, where does the next piece wait? It waits in the task queue. A task is one callback that is ready to run. A call from a window, a finished file read, and a delay that has passed each make a task.

The task queue is a line, first in, first out. In this example, two callbacks become ready after the script ends. They wait. The script ends at zero milliseconds, and only then do both callbacks run, one after the other.

## event_loop

Who moves a task from the line onto the call stack? The event loop. The event loop is a loop inside Node that runs while work is left. It waits until the call stack is empty. Then it takes the next task from the queue and runs it. Then it waits again.

We borrow the picture of Lydia Hallie. One box holds the call stack, one box holds the queue, and the loop sits between them.

When the queue is empty, the loop sleeps. It wakes when the operating system reports that something is ready.

## timers

A timer asks the event loop to run a callback later. Set timeout with one hundred milliseconds means this: make the callback a task after one hundred milliseconds.

But the task still waits for an empty call stack. So the delay is a minimum, not an exact time. In this example, the timer asks for one hundred milliseconds. Then a loop holds the call stack for one second. The callback runs a little after one thousand milliseconds.

This rule matters for deepWidgets. Every action call has a time limit, five seconds by default. That limit is a timer too. Keep that in mind.

## microtasks

Promises add a second line. When a promise settles, its dot then callback goes to the microtask queue. The code after an await also resumes from the microtask queue.

The rule: after each task, the event loop runs every microtask, until that queue is empty. Only then does it take the next task. So the microtask queue jumps ahead of the task queue.

Look at this puzzle. We log A, set a timer, add a promise callback, and log B. The output is A, B, promise, timer. The promise callback ran first, although we added it after the timer.

## blocking

Now the price of the one thread rule. Blocking means that one piece of code holds the call stack for a long time. While it runs, the event loop cannot take any task or any microtask.

The javascript dot info site shows it with a loop that counts to one billion. The page freezes until the count ends. The fix there is to cut the work into small slices, with a timer between the slices.

The Node guide says the same for servers. Node runs all callbacks on one thread, so each callback must stay short. A loop that never ends blocks forever.

## block_widgets

In deepWidgets, every widget in the host shares that one thread. So spinner blocks more than itself. Its loop stops pinger, the sample counter, and every other widget. We infer that calls from windows wait outside. No timer fires.

The five second time limit of the call cannot help either. It is a timer, and no timer runs while the loop holds the call stack. Our run shows it. A one second loop wins a race against a one hundred millisecond time limit.

The host process stays alive, but its main thread does no work for anyone. So something outside the main thread must notice.

## try_stack

Now errors. You know try and catch. Here is a rule that surprises many people. A try covers only the code that runs while the try is on the call stack.

In this example, we set a timer inside a try. The timer callback throws ten milliseconds later. By then the try has ended, and its pancake is gone. The callback runs on a fresh, empty call stack, so no catch is there. The process prints the error and exits with code one.

The javascript dot info site gives the same rule. Try and catch only see synchronous code. The pinger widget has exactly this shape.

## exception_vs_rejection

An error travels in two forms. An exception is a thrown error that falls down the call stack until a catch takes it. A rejection is the failed result of a promise. It waits on the promise until some code asks for the result.

Domenic Denicola shows that a rejection works like an exception. The bridge is await. Await turns a rejection back into an exception, so a normal try works again. A dot catch on the promise also takes the rejection.

In this example, both ways catch the late error. One uses await inside a try. The other uses dot catch.

## emitter_handler

Next, events. An emitter is an object that keeps a table. Each line of the table has an event name and a list of functions. The method on adds a function to a list. The method emit takes a name and calls each function on its list, at once, in order.

A handler is one of those functions. You asked if a handler is a watcher. It is not. A handler does nothing until the emitter calls it. The code that sees the event calls emit, and only that code notices anything.

Refactoring Guru uses a magazine. The publisher keeps a list of subscribers and sends each new issue to them. Our run shows that emit is synchronous: before emit, handler one, handler two, after emit.

## uncaught_unhandled

Now we can name the two ways an error escapes. An uncaught exception is a throw that falls off the bottom of the call stack. No catch took it on the way. The pinger widget makes exactly this.

An unhandled rejection is a rejected promise that still has no handler when Node checks. Node checks after the current code and its microtasks finish. A dot catch that comes later than that comes too late.

So uncaught is about the call stack, and unhandled is about one promise. In current Node, both end the same way by default. Node prints the error and exits with code one.

## process_handlers

Who decides what happens at the end? Node gives one emitter for the whole process. Its name is process. It emits uncaught exception for an escaped throw, and unhandled rejection for an escaped rejection.

A process handler is a handler on that emitter. When you add one, it replaces the default exit. It gets the error, but no widget. It does not know which widget caused it.

Our run adds one process handler for uncaught exception. Both the timer throw and the lone rejection reach it. By default, Node raises an unhandled rejection as an uncaught exception. The process stays alive afterwards. The Node docs warn against that: it is not safe to resume normal operation after uncaught exception.

## promise_not_process

You asked if a promise is a process, and if dot then is a process handler. The answer is no to both.

A promise is a small object in the heap. It holds one result that comes later. Thousands of promises can live inside one process. Dot then adds a callback to that one promise. It runs once, as a microtask, when the promise settles.

A process handler sits on the one process emitter, and it serves every promise in the process. It is the last stop for a rejection that no dot then and no dot catch took. When MDN says that a promise stands for a process, MDN means an operation, not an operating system process.

## handler_vs_effect

You also asked how a process handler differs from a Cordis effect. The difference is ownership and cleanup.

A process handler belongs to the whole process. It stays until some code removes it by hand. A reload of a plugin does not remove it. An earlier experiment in this repository counted process handlers that grew from two to five over four reloads.

A Cordis effect belongs to one plugin. It returns a cleanup function, and Cordis runs that cleanup when the plugin stops or reloads. So a reload leaves no extra handler behind. In deepWidgets, the crash hook is the function that the process handler calls on a fatal error. It goes in through a Cordis effect, so a reload removes the old hook.

## async_chain

Here is the gap. A process handler gets the error, but no widget. The call stack of the widget is long gone. So how can the handler know which widget started the work?

The answer starts with the async chain. An async chain is all the work that one piece of code starts, now or later. A timer that the code sets is in the chain. A promise callback is in the chain. A timer that such a callback sets is in the chain too.

Node tracks this tree. Each piece of async work gets an I D, and the I D of the work that created it. In our run, timer a has parent one, and timer d has parent five, which is timer a.

## als

Async local storage carries one value along an async chain. You call run with a value and a function. The function, and every callback that it starts, can read that value later with get store.

You asked if it is like the local storage of a browser. It is not. Browser local storage keeps text on disk. Async local storage keeps one value in memory, for one async chain, and only while that chain lives.

React context is the closest idea that you use every day. A provider sets a value once, and every component below it can read the value. Async local storage does the same along an async chain, not along a component tree. Our run prints sample, then undefined outside any run, then pinger from a later timer.

## handler_reads_store

Now put the two together. Node runs a process handler inside the async chain of the callback that failed. So the handler can call get store, and it gets the value of that chain.

In this run, we call ping inside run with the value pinger. The call returns ok. Outside the run, get store gives undefined. Fifty milliseconds later the timer throws. The process handler reads get store and gets pinger.

The same works for an unhandled rejection. That is the whole trick behind blame in deepWidgets.

## worker_thread

Back to the frozen host. Its main thread cannot notice its own freeze, because it runs no code but the loop. We need a second thread.

A worker thread is a second JavaScript thread in the same process. It has its own call stack, its own heap, and its own event loop. So it keeps running while the main thread is stuck.

Now your heap question. In most languages, the threads of one process share one heap. A Node worker thread does not. Our run sets one global value in each thread, and each thread sees only its own value. Lin Clark draws such threads as two people, each at a private desk.

## shared_memory

How do two threads talk? The normal way is a message. A message is a copy, and it waits in the queue of the other thread. If that thread is stuck, the message waits too. In our run, the main thread loops for one second, and the message arrives only at the end.

Shared memory is the other way. It is one small piece of memory that both threads read and write directly. There is no copy and no queue. The worker thread can read it while the main thread is stuck.

Two threads that write one number at once give a race condition. So the code uses a shared counter. Each add or read of the counter is one step that the other thread cannot split.

## heartbeat

Now the trick that notices a freeze. The main thread adds one to a shared counter every one hundred milliseconds. That counter is the heartbeat. The worker thread looks at it every fifty milliseconds. If the number stops changing, the main thread is stuck.

Embedded systems use the same idea. Wikipedia describes a timer that healthy code must keep resetting. When the resets stop, recovery starts. A stuck program cannot report its own failure, so a missing beat is the report.

Our run blocks the main thread for one and a half seconds. The worker reports about five hundred milliseconds with no beat, then about one thousand. The main thread logs only after its loop ends.

## blame_store

Now the deepWidgets boxes, one by one. We start with the blame store. The blame store is one async local storage in the host. Its value is the name of a widget.

In deepWidgets, a wrap goes around two kinds of widget code. One is the start of a widget. The other is each action call. Each wrap calls run with the widget name. So every timer and promise that the widget code creates carries that name.

## crash_record

Next box: what happens when an error escapes. The host has one process handler for each of the two events. That handler calls the crash hook of deepWidgets.

The hook reads get store and finds the widget. Then it writes the crash record. The crash record is a small JSON file on disk, crash dot json. It names the widget, the event, the error, the time, and the P I D of the host. It also holds a fingerprint of the widget files.

The hook writes with a synchronous call, and then it exits the host with code one. An async write might not finish before the exit. The hook does not wait, and it does not resume. Candea and Fox call this crash only software: to stop is to crash, and to start is to recover.

## watchdog

Next box: the freeze. The watchdog is the worker thread of the host that watches the heartbeat. It looks every fifty milliseconds. The wrap helps it too. While widget code runs, the wrap writes a widget number into shared memory, next to the heartbeat. When the synchronous part of the call returns, the wrap puts the old number back.

When the heartbeat stops for two seconds, the watchdog acts. It reads the widget number from shared memory. It writes a crash record with the event stall. Then it sends sig kill to its own process. The host cannot refuse, even inside an endless loop.

Why two seconds, and not less? Healthy host code can hold the thread too. An earlier check parsed one hundred fifty megabytes of JSON in eight hundred sixty-eight milliseconds. In an earlier experiment, a limit of five hundred milliseconds killed a healthy host. Two seconds leaves room.

## provisional_record

Next box: the provisional record. It answers your first question. One kind of death leaves no time for any note. When the heap is full, V eight ends the host with sig abort, and no JavaScript runs.

So the watchdog writes a note early, just in case. After five hundred milliseconds without a heartbeat, it writes the provisional record, provisional dot json. It has the same fields as a crash record, with the event provisional stall. It names the widget only from the shared widget number. With no widget number, it writes no note. That number covers only synchronous code inside the wrap: a widget start, or an action call before its first await.

When the heartbeat comes back, the watchdog deletes the note at its next look. So the note follows the heartbeat, not the call. It is not a Cordis effect with its own cleanup. A planned fix ties the note to the call, with a cleanup step at the end of the call. Nobody has built that fix yet.

## supervisor

Next box: who starts the host again. The supervisor is code in the app process. It watches the host child. When the host exits, the supervisor gets three facts: the P I D, the exit code, and the signal.

Then it reads the records. A crash record counts only when its P I D matches the dead host. So an old record does not blame a new crash, except in one rare case that the limits part shows. A provisional record counts only when the host ended with an abort, such as sig abort. Any other end discards the provisional record. A crash record of the dead host always wins over a provisional record.

Then the supervisor starts a new host after a short wait. A crash with a blamed widget does not count against the app. A crash with no blame does count. Repeated crashes with no blame make the wait longer. Then the host starts with only built in widgets. At last the restarts stop.

## quarantine

The final box keeps the bad widget off. The next host reads the record at its start. It puts the blamed widget into quarantine. Quarantine means that the host does not run that widget while its files keep the same fingerprint. The window of the widget shows it as failed, with the reason.

The quarantine ends when new files of that widget load with success. So a fix lifts it, and a reload of the same broken files does not.

The word quarantine is ours. Martin Fowler describes a close cousin for network calls: after repeated failures, stop calling the failing part. Every other widget runs as before.

## ex_throw_path

Now the first failure, through every box. You call pinger dot ping. The action runs inside the wrap, so the blame store holds pinger. The widget number in shared memory names pinger too.

Ping sets a timer for three seconds and returns ok. The wrap puts the widget number back to zero. The call answers ok, and its time limit timer stops. Everything looks fine.

Three seconds later, the timer fires. Its callback runs on an empty call stack, and it throws. No catch is there, so this is an uncaught exception. Node emits it to the process handler, inside the pinger async chain.

## ex_throw_record

The crash hook calls get store and gets pinger. It writes crash dot json with pinger, the event uncaught exception, and the P I D of the host. Then it exits the host with code one. An earlier check measured about sixty-five milliseconds from the throw to the exit.

The supervisor sees exit code one and no signal. The crash record has the same P I D, so it counts, and it blames pinger. A blamed crash does not count against the app. The new host starts after half a second.

The new host reads the record and puts pinger into quarantine. The pinger window shows failed. The sample counter and every other widget run again.

## ex_loop_stall

Now the second failure. You call spinner dot spin. The wrap sets the blame store and writes the spinner number into shared memory. Then the loop starts, and it never returns.

The call stack never empties. No task and no microtask runs. The heartbeat timer cannot fire, so the counter stops. The five second time limit cannot fire either. Every other widget waits.

The watchdog thread still runs. After five hundred milliseconds with no beat, it writes the provisional record for spinner. After two seconds, it writes the crash record for spinner, and it sends sig kill.

## ex_loop_restart

The host dies at once. An earlier check measured the kill at about two thousand fifty milliseconds after the call. The watchdog already deleted its provisional record when it wrote the crash record.

The supervisor sees the signal sig kill and no exit code. The crash record has the same P I D, so it counts, and it blames spinner. The new host starts after half a second and puts spinner into quarantine. Every other widget runs again.

## ex_loop_oom

One variant shows why the provisional record exists. Suppose spin fills the heap in a loop instead. The heartbeat stops, because the loop holds the call stack. After five hundred milliseconds, the watchdog writes the provisional record for spinner.

Before two seconds pass, the heap is full. V eight ends the host with sig abort. No JavaScript runs, so no crash record exists.

The supervisor sees sig abort, so it accepts the provisional record of that P I D. The new host puts spinner into quarantine. That completes the answer to your first question. The provisional record is the blame for a death that leaves no time to write.

## limit_blame_gaps

Now the limits, stated plainly. The blame store misses some code. Code at the top level of a widget module runs before any wrap, so the store has no value there. A handler runs inside the chain of the code that calls emit. So when sample emits an event, a pinger handler sees sample, as our run shows.

The widget number misses more. It covers only synchronous code inside the wrap. In our run, it reads seven before an await and zero after it.

So a loop after an await stalls the host with no widget number. We infer the same for a loop inside a widget timer. In the app, the watchdog then kills the host with no blame. The supervisor counts that crash against the app.

## limit_provisional

The provisional record has a short gap. Suppose a call stalls for six hundred milliseconds, so the note names its widget. Then the call returns, and the heartbeat comes back. The watchdog deletes the note only at its next look. We infer that this takes up to fifty milliseconds.

If an abort comes inside that gap, the note blames a widget that already finished. The planned fix closes the gap, because it removes the note when the call returns. That fix does not exist yet.

The P I D check has a gap too. The operating system can reuse a P I D later. The model check of this code left that case out.

## limit_threshold

The last limit is the two second threshold itself. It comes from one experiment. Under heavy machine load, the watchdog can kill a healthy host. The project rules say so, and the spec keeps the threshold as an open point.

And the whole design is crash only. One escaped error stops every widget for about two seconds, not only the bad one. The Node docs say that resuming after an uncaught exception is not safe. The host follows that advice and pays this cost.

## answers

Here are your eight answers in one place.

The provisional record is an early note from the watchdog, with the same fields as a crash record. It names the widget whose synchronous code runs, and it counts only after an abort. It follows the heartbeat, not the call, so it is not a Cordis effect. A process handler belongs to the whole process. A Cordis effect belongs to one plugin and cleans up on reload.

A promise is an object in the heap, and dot then is a callback on that one promise. A P I D is the number of a process. A handler is a function that an emitter calls, not a watcher. Async local storage is a value along an async chain, not browser storage. An async chain is all the work that one piece of code starts, now or later.

## closing

Back to the picture from the start. Each box now has a name. The process handlers and the watchdog notice. The blame store finds the widget. The crash record and the provisional record write it down. The supervisor starts a new host, and the quarantine keeps the bad widget off.

Under each box sit the rules that we built from the floor. One thread has one call stack, one event loop, and two queues. A second thread watches it through shared memory. The cut list has the details that this video left out.
