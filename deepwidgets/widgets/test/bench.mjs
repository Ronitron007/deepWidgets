// Measurements on the real CLI host. Usage: node bench.mjs <port> <homeBase>
import { startHost, openStream } from './harness.mjs'

const port = Number(process.argv[2] ?? 47923)
const homeBase = process.argv[3]
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const pct = (values, p) => { const s = [...values].sort((a, b) => a - b); return +s[Math.min(s.length - 1, Math.floor(p * s.length))].toFixed(2) }
const summary = (values) => ({ n: values.length, p50: pct(values, 0.5), p95: pct(values, 0.95), max: pct(values, 1) })
const MB = (bytes) => +(bytes / 1048576).toFixed(1)

async function mem(host) {
  const samples = []
  for (let i = 0; i < 3; i += 1) { samples.push((await host.getJson('/api/widgets-dev/mem')).body); await sleep(300) }
  const last = samples.at(-1)
  return { widgets: last.widgets, gc: last.gc, rssMB: MB(last.rss), heapUsedMB: MB(last.heapUsed), heapSpread: samples.map((s) => MB(s.heapUsed)) }
}

const out = {}
for (const bulk of [0, 20]) {
  const host = await startHost({ port, home: `${homeBase}-${bulk}`, env: { DEEPWIDGETS_BULK: String(bulk) }, nodeArgs: ['--expose-gc'], log: `bench-${bulk}.log` })
  try {
    await sleep(3_000)
    out[`mem_bulk_${bulk}`] = await mem(host)
    if (bulk !== 20) continue

    const timed = async (fn) => { const t = performance.now(); await fn(); return performance.now() - t }
    for (let i = 0; i < 20; i += 1) await host.postJson('/api/widgets/bulk-1/call', { action: 'list' })
    const query = []
    for (let i = 0; i < 300; i += 1) query.push(await timed(() => host.postJson('/api/widgets/bulk-1/call', { action: 'list' })))
    out.call_query_seq = summary(query)
    const mutation = []
    for (let i = 0; i < 200; i += 1) mutation.push(await timed(() => host.postJson('/api/widgets/bulk-2/call', { action: 'add', args: { text: `item ${i}` } })))
    out.call_mutation_seq = summary(mutation)
    const t0 = performance.now()
    const parallel = await Promise.all(Array.from({ length: 100 }, (_, i) => timed(() => host.postJson(`/api/widgets/bulk-${(i % 20) + 1}/call`, { action: 'add', args: { text: `p${i}` } }))))
    out.call_mutation_parallel100 = { ...summary(parallel), wallMs: +(performance.now() - t0).toFixed(1) }
    const ping = []
    for (let i = 0; i < 100; i += 1) ping.push(await timed(() => host.api('/api/widgets')))
    out.baseline_get_list = summary(ping)

    // Fan-out A: 20 streams on one slug, one write.
    const same = Array.from({ length: 20 }, () => openStream(host, 'bulk-3'))
    await Promise.all(same.map((s) => s.next((f) => f.type === 'hello')))
    const fanSame = []
    for (let round = 0; round < 20; round += 1) {
      const marks = same.map((s) => s.frames.length)
      const t = performance.now()
      await host.postJson('/api/widgets/bulk-3/call', { action: 'add', args: { text: `fan ${round}` } })
      const arrivals = await Promise.all(same.map((s, i) => s.next((f) => f.type === 'data' && s.frames.indexOf(f) >= marks[i])))
      fanSame.push(Math.max(...arrivals.map((f) => f.at)) - t)
    }
    out.fanout_20_streams_one_slug_lastArrivalMs = summary(fanSame)
    out.mem_with_20_streams = await mem(host)
    for (const s of same) s.close()

    // Fan-out B: one stream per slug (20 windows), one write each, all at once.
    const per = Array.from({ length: 20 }, (_, i) => openStream(host, `bulk-${i + 1}`))
    await Promise.all(per.map((s) => s.next((f) => f.type === 'hello')))
    const fanPer = []
    for (let round = 0; round < 10; round += 1) {
      const marks = per.map((s) => s.frames.length)
      const t = performance.now()
      await Promise.all(per.map((_, i) => host.postJson('/api/widgets-dev/poke', { slug: `bulk-${i + 1}` })))
      const arrivals = await Promise.all(per.map((s, i) => s.next((f) => f.type === 'data' && s.frames.indexOf(f) >= marks[i])))
      fanPer.push(Math.max(...arrivals.map((f) => f.at)) - t)
    }
    out.fanout_20_slugs_20_writes_lastArrivalMs = summary(fanPer)
    for (const s of per) s.close()
  } finally {
    await host.stop()
  }
}
console.log(JSON.stringify(out, null, 2))
