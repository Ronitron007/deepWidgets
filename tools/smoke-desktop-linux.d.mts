/** Shell source of the watcher that reports the listening ports of a Linux process group. */
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
