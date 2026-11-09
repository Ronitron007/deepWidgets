// Host A for the watchdog replays. The real watchdog thread (WDW, from this checkout) runs on a SharedArrayBuffer
// with the real threshold (2 s) and poll (50 ms). The main thread sets the running slot and the heartbeat, as WD
// (watchdog.ts) does, and it never returns from the a1 call. The paths where the a1 call returns run on a real host
// with the compiled inSlot: the case `innocent` of tools/widgets-crash-replay.mjs.
// argv: mode = "stall-until-killed" | "boot-fail-in-stall"
import { Worker } from 'node:worker_threads'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
const mode = process.argv[2]
const dir = join(process.env.DSH_HOME, 'deepwidgets')
const provisionalFile = join(dir, 'provisional.json')
// BEAT_SLOT 0, RUNNING_SLOT 1, CALLS_SLOT 2, PROVISIONAL_SLOT 3, CRASH_SLOT 4 (records.ts)
const slots = new Int32Array(new SharedArrayBuffer(5 * 4))
const worker = new Worker(new URL('../../../../../deepwidgets/widgets/src/watchdog-worker.ts', import.meta.url), {
  execArgv: ['--experimental-strip-types', '--disable-warning=ExperimentalWarning'],
  workerData: { buffer: slots.buffer, thresholdMs: 2000, idleThresholdMs: 10000, suspendGapMs: 1000, disposeLimitMs: 3000,
    pollMs: 50, crashFile: join(dir, 'crash.json'), provisionalFile, nativeEntry: null, mainThread: '0' },
})
worker.unref()
worker.postMessage({ type: 'row', index: 1, row: 'deepwidgets-widget-a1', root: process.env.A1_ROOT, slugs: ['a1'] })
setInterval(() => { Atomics.add(slots, 0, 1) }, 100).unref()            // WD heartbeat
const busy = (ms) => { const end = Date.now() + ms; while (Date.now() < end); }
setTimeout(() => {
  console.log('step: a1 code starts')
  Atomics.exchange(slots, 1, 1)                                           // WD inSlot: the slot holds a1
  busy(700)                                                               // legal long step: > 500 ms, < 2 s
  console.log('step: watchdog saw the stall; provisional.json exists =', existsSync(provisionalFile))
  if (mode === 'stall-until-killed') { process.send?.('stalled'); busy(1500); return }
  console.log('step: the boot fails in the call (exit 1)')
  process.exit(1)
}, 400)
setTimeout(() => {}, 5000)
