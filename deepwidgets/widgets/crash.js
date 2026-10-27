// Test-only helper: throws from a timer in a file that registers no widget.
export function crashSoon(ms) {
  setTimeout(function hostCrash() { throw new Error('crash: uncaught exception outside any widget') }, ms)
}
