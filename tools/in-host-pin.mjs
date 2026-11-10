#!/usr/bin/env node
/**
 * Host-free check of the pin wrappers in tools/in-host.mjs.
 * It starts a child `node --expose-gc --inspect`, sends a never-settling async call through
 * `pinnedExpression` and `pinnedFunction`, runs `gc()`, and fails if V8 answers "Promise was collected".
 * A raw call of the same source must get that answer, so the check proves that it can see the collection.
 * It also checks values, rejections, sync throws, `this`, arguments, and a trailing `//` comment.
 * Prints `in-host-pin: pass` and exits 0 only when every check passes.
 */
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { pinnedExpression, pinnedFunction } from './in-host.mjs'

const NEVER = '(async () => { await new Promise(() => {}) })()'
const NEVER_FUNCTION = 'async function () { await new Promise(() => {}) }'
/** How long a never-settling call must stay pending after `gc()`, in milliseconds. */
const PENDING_MS = 500

const failures = []
const check = (ok, line) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${line}`)
  if (!ok) failures.push(line)
}

const child = spawn(process.execPath, ['--expose-gc', '--inspect=127.0.0.1:0', '-e', 'setInterval(() => {}, 1000)'], { stdio: ['ignore', 'ignore', 'pipe'] })
const deadline = setTimeout(() => {
  console.log('in-host-pin: fail: time limit')
  child.kill()
  process.exit(1)
}, 30_000)

try {
  const url = await new Promise((resolve, reject) => {
    let text = ''
    child.stderr.on('data', (chunk) => {
      text += String(chunk)
      const found = text.match(/ws:\/\/\S+/u)
      if (found !== null) resolve(found[0])
    })
    child.on('exit', (code) => reject(new Error(`the child exited with ${String(code)}`)))
  })
  const socket = new WebSocket(url)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve)
    socket.addEventListener('error', () => reject(new Error('the inspector connection failed')))
  })
  let next = 0
  const waiting = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data))
    waiting.get(message.id)?.(message)
    waiting.delete(message.id)
  })
  const post = (method, params) => new Promise((resolve) => {
    next += 1
    waiting.set(next, resolve)
    socket.send(JSON.stringify({ id: next, method, params }))
  })
  /** The answer of a call as one string: the protocol error, the exception text and description, or the value. */
  const answer = (message) => {
    if (message === 'pending') return 'pending'
    if (message.error !== undefined) return `error: ${String(message.error.message)}`
    const thrown = message.result?.exceptionDetails
    if (thrown !== undefined) return `threw: ${String(thrown.exception?.description ?? thrown.text).split("\n")[0]}`
    return `value: ${JSON.stringify(message.result?.result?.value)}`
  }
  /** Send a never-settling call, run gc() twice, and give its answer within PENDING_MS. */
  const afterGc = async (send) => {
    const reply = send()
    await sleep(50)
    await post('Runtime.evaluate', { expression: 'gc(); gc(); 1' })
    return answer(await Promise.race([reply, sleep(PENDING_MS).then(() => 'pending')]))
  }
  const evaluate = async (expression) => answer(await post('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }))
  const global = (await post('Runtime.evaluate', { expression: 'globalThis' })).result.result.objectId
  const call = async (declaration, args = []) => answer(await post('Runtime.callFunctionOn', {
    objectId: global,
    functionDeclaration: declaration,
    awaitPromise: true,
    returnByValue: true,
    arguments: args.map((value) => ({ value })),
  }))

  const rawEvaluate = await afterGc(() => post('Runtime.evaluate', { expression: NEVER, awaitPromise: true, returnByValue: true }))
  check(rawEvaluate.includes('Promise was collected'), `control: a raw Runtime.evaluate is collected after gc(): ${rawEvaluate}`)
  const rawCall = await afterGc(() => post('Runtime.callFunctionOn', { objectId: global, functionDeclaration: NEVER_FUNCTION, awaitPromise: true, returnByValue: true }))
  check(rawCall.includes('Promise was collected'), `control: a raw Runtime.callFunctionOn is collected after gc(): ${rawCall}`)

  const pinnedEvaluate = await afterGc(() => post('Runtime.evaluate', { expression: pinnedExpression(NEVER), awaitPromise: true, returnByValue: true }))
  check(pinnedEvaluate === 'pending', `pinnedExpression stays pending after gc(): ${pinnedEvaluate}`)
  const pinnedCall = await afterGc(() => post('Runtime.callFunctionOn', { objectId: global, functionDeclaration: pinnedFunction(NEVER_FUNCTION), awaitPromise: true, returnByValue: true }))
  check(pinnedCall === 'pending', `pinnedFunction stays pending after gc(): ${pinnedCall}`)

  const value = await evaluate(pinnedExpression('(async () => ({ a: 1 }))()'))
  check(value === 'value: {"a":1}', `pinnedExpression gives the resolved value: ${value}`)
  const rejected = await evaluate(pinnedExpression('(async () => { throw new Error("boom") })()'))
  check(rejected.startsWith('threw: Error: boom'), `pinnedExpression gives the rejection: ${rejected}`)
  const sync = await evaluate(pinnedExpression('42'))
  check(sync === 'value: 42', `pinnedExpression gives a sync value: ${sync}`)
  const comment = await evaluate(pinnedExpression('1 // a trailing comment'))
  check(comment === 'value: 1', `pinnedExpression keeps a trailing // comment: ${comment}`)

  const thisArgs = await call(pinnedFunction('async function (x, y) { return [x, y, this === globalThis] }'), [3, 'b'])
  check(thisArgs === 'value: [3,"b",true]', `pinnedFunction keeps this and the arguments: ${thisArgs}`)
  const syncThrow = await call(pinnedFunction('function () { throw new Error("sync") }'))
  check(syncThrow.startsWith('threw: Error: sync'), `pinnedFunction gives a sync throw: ${syncThrow}`)
  const functionComment = await call(pinnedFunction('function () { return 2 } // a trailing comment'))
  check(functionComment === 'value: 2', `pinnedFunction keeps a trailing // comment: ${functionComment}`)

  socket.close()
} catch (error) {
  failures.push(error instanceof Error ? error.message : String(error))
} finally {
  clearTimeout(deadline)
  child.kill()
}

if (failures.length === 0) {
  console.log('in-host-pin: pass')
} else {
  console.log(`in-host-pin: fail: ${failures.join('; ')}`)
  process.exitCode = 1
}
