/** Python 3 source of the Linux process-group watcher. Same contract as the macOS watcher in tools/smoke-desktop.mjs: argv[1] is an output file; it prints "ready", reads one root pid from stdin, then appends each new process group id of the root and its descendants, one per line. */
export const linuxGroupWatcherSource: string

/**
 * Parse the text of /proc/net/tcp or /proc/net/tcp6 into listening sockets.
 * @param text - File contents.
 * @returns Map from socket inode to listening port.
 */
export function parseProcNetTcpListeners(text: string): Map<string, number>

/**
 * List the TCP ports a Linux process listens on.
 * @param pid - Process id.
 * @returns Listening ports.
 */
export function linuxListenPorts(pid: number): number[]
