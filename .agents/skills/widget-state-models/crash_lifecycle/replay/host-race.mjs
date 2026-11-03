// Host A for the watchdog replays. The real watchdog thread (WDW, from this checkout) runs on
// a SharedArrayBuffer with the real threshold (2 s) and poll (50 ms). The main-thread half is
// the three lines of WD:43,47,123: set the running slot, put it back, bump the heartbeat.
// argv: mode = "abort-after-return" | "stall-until-killed" | "boot-fail-after-return"
import { Worker, threadId } from 'node:worker_threads'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
const mode = process.argv[2]
const dir = join(process.env.DSH_HOME, 'deepwidgets')
const slots = new Int32Array(new SharedArrayBuffer(8)) // BEAT_SLOT 0, RUNNING_SLOT 1 (records.ts:44-48)
const worker = new Worker(new URL('../../../../../deepwidgets/widgets/src/watchdog-worker.ts', import.meta.url), {
  execArgv: ['--experimental-strip-types', '--disable-warning=ExperimentalWarning'],
  workerData: { buffer: slots.buffer, thresholdMs: 2000, pollMs: 50, crashFile: join(dir, 'crash.json'),
    provisionalFile: join(dir, 'provisional.json'), nativeEntry: null, mainThread: String(threadId) },
})
worker.unref()
worker.postMessage({ type: 'row', index: 1, row: 'deepwidgets-widget-a1', root: process.env.A1_ROOT, slugs: ['a1'] })
setInterval(() => { Atomics.add(slots, 0, 1) }, 100).unref()            // WD:123 heartbeat
const busy = (ms) => { const end = Date.now() + ms; while (Date.now() < end); }
setTimeout(() => {
  console.log('step: a1 code starts')
  const previous = Atomics.exchange(slots, 1, 1)                          // WD:43
  busy(700)                                                               // legal long step: > 500 ms, < 2 s
  console.log('step: watchdog saw the stall; provisional.json exists =', existsSync(join(dir, 'provisional.json')))
  if (mode === 'stall-until-killed') { process.send?.('stalled'); busy(1500); return }
  Atomics.store(slots, 1, previous)                                       // WD:47 a1 code returns
  console.log('step: a1 code returns; slot =', Atomics.load(slots, 1))
  if (mode === 'boot-fail-after-return') { console.log('step: the boot fails (exit 1)'); process.exit(1) }
  console.log('step: the Host aborts (out of memory) in host code')
  process.abort()                                                         // SIGABRT, no JS cleanup
}, 400)
setTimeout(() => {}, 5000)
