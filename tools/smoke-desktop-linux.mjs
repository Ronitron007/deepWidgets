/** Linux helpers for tools/smoke-desktop.mjs: process-group watching and listening-port lookup through /proc. */

import { readdirSync, readFileSync, readlinkSync } from 'node:fs'

/**
 * Python 3 program with the contract of the macOS group watcher: argv[1] is an output file,
 * it prints "ready", reads one root pid from stdin, then records every new process group
 * among the root and its descendants, one id per line.
 */
export const linuxGroupWatcherSource = `
import os, sys, time, traceback

def children_of(pid):
    found = []
    try:
        tids = os.listdir('/proc/%d/task' % pid)
    except OSError:
        return found
    for tid in tids:
        try:
            with open('/proc/%d/task/%s/children' % (pid, tid)) as handle:
                found.extend(int(item) for item in handle.read().split())
        except (OSError, ValueError):
            pass
    return found

def main():
    output = sys.argv[1]
    print('ready', flush=True)
    root = int(sys.stdin.readline().strip())
    own = os.getpgrp()
    watched = {root}
    written = set()
    while True:
        for pid in list(watched):
            for child in children_of(pid):
                watched.add(child)
        for pid in list(watched):
            try:
                group = os.getpgid(pid)
            except OSError:
                continue
            if group == 0 or group == own or group in written:
                continue
            written.add(group)
            with open(output, 'a') as handle:
                handle.write('%d\\n' % group)
        time.sleep(0.05)

try:
    main()
except Exception:
    traceback.print_exc()
    sys.stdout.flush()
`

/**
 * Parse /proc/net/tcp or /proc/net/tcp6 text.
 * @param {string} text - File contents.
 * @returns {Map<string, number>} Socket inode to local port for rows in LISTEN state.
 */
export function parseProcNetTcpListeners(text) {
  const listeners = new Map()
  for (const line of text.split('\n').slice(1)) {
    const fields = line.trim().split(/\s+/u)
    if (fields.length < 10 || fields[3] !== '0A') continue
    const port = Number.parseInt(fields[1].slice(fields[1].lastIndexOf(':') + 1), 16)
    if (Number.isNaN(port)) continue
    listeners.set(fields[9], port)
  }
  return listeners
}

/**
 * List the TCP ports one process listens on.
 * @param {number} pid - Process id.
 * @returns {number[]} Sorted unique listening ports; empty when /proc is unreadable.
 */
export function linuxListenPorts(pid) {
  try {
    const inodes = new Set()
    for (const fd of readdirSync(`/proc/${String(pid)}/fd`)) {
      try {
        const match = /^socket:\[(\d+)\]$/u.exec(readlinkSync(`/proc/${String(pid)}/fd/${fd}`))
        if (match !== null) inodes.add(match[1])
      } catch {
        /* the descriptor closed while reading */
      }
    }
    const ports = new Set()
    for (const table of ['/proc/net/tcp', '/proc/net/tcp6']) {
      let text
      try {
        text = readFileSync(table, 'utf8')
      } catch {
        continue
      }
      for (const [inode, port] of parseProcNetTcpListeners(text)) {
        if (inodes.has(inode)) ports.add(port)
      }
    }
    return [...ports].sort((a, b) => a - b)
  } catch {
    return []
  }
}
