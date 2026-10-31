import { spawn } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import {
  linuxGroupWatcherSource,
  linuxListenPorts,
  parseProcNetTcpListeners,
} from '../../../tools/smoke-desktop-linux.mjs'

const TCP = `  sl  local_address rem_address   st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 0100007F:1F90 00000000:0000 0A 00000000:00000000 00:00000000 00000000  1000        0 11111 1 0000000000000000 100 0 0 10 0
   1: 0100007F:C350 0100007F:1F90 01 00000000:00000000 00:00000000 00000000  1000        0 22222 1 0000000000000000 100 0 0 10 0
`
const TCP6 = `  sl  local_address                         remote_address                        st tx_queue rx_queue tr tm->when retrnsmt   uid  timeout inode
   0: 00000000000000000000000001000000:0050 00000000000000000000000000000000:0000 0A 00000000:00000000 00:00000000 00000000     0        0 33333 1 0000000000000000 100 0 0 10 0
   1: 00000000000000000000000001000000:0051 00000000000000000000000001000000:9999 01 00000000:00000000 00:00000000 00000000     0        0 44444 1 0000000000000000 100 0 0 10 0
`

describe('smoke desktop linux helpers', () => {
  it('parses LISTEN rows of /proc/net/tcp and tcp6', () => {
    expect(parseProcNetTcpListeners(TCP)).toEqual(new Map([['11111', 8080]]))
    expect(parseProcNetTcpListeners(TCP6)).toEqual(new Map([['33333', 80]]))
  })

  it.runIf(process.platform === 'linux')('lists the listening ports of a process', async () => {
    const server = createServer()
    await new Promise<void>((done) => { server.listen(0, '127.0.0.1', done) })
    try {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : -1
      expect(linuxListenPorts(process.pid)).toContain(port)
    } finally {
      server.close()
    }
  })

  it.runIf(process.platform === 'linux')('records the process group of a spawned child', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'smoke-linux-'))
    const file = join(dir, 'groups')
    const watcher = spawn('/usr/bin/python3', ['-c', linuxGroupWatcherSource, file], { stdio: ['pipe', 'pipe', 'pipe'] })
    const child = spawn('sh', ['-c', 'sleep 30'], { detached: true, stdio: 'ignore' })
    try {
      await new Promise<void>((done, fail) => {
        watcher.once('error', fail)
        watcher.stdout.on('data', (chunk: Buffer) => { if (chunk.toString().includes('ready')) done() })
      })
      watcher.stdin.write(`${String(child.pid)}\n`)
      const wanted = String(child.pid)
      const deadline = Date.now() + 3000
      let groups: string[] = []
      while (Date.now() < deadline) {
        try { groups = readFileSync(file, 'utf8').split('\n') } catch { /* not written yet */ }
        if (groups.includes(wanted)) break
        await delay(50)
      }
      expect(groups).toContain(wanted)
    } finally {
      watcher.kill()
      try { process.kill(-child.pid!, 'SIGKILL') } catch { /* already gone */ }
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
