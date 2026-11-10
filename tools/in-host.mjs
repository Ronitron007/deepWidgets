/**
 * Source wrappers for inspector calls that use `awaitPromise`.
 *
 * The inspector holds the awaited promise only weakly. When V8 collects it before it settles, the call fails with
 * "Promise was collected". The wrappers keep each awaited promise in a Set on `globalThis` until `PIN_MS` after it
 * settles. Put any `hmr.executing.exit` wrapping inside the wrapped source, as before.
 */

/** How long a settled promise stays pinned, in milliseconds. */
export const PIN_MS = 5000

/** Source of a function that pins the promise of its value and gives that promise. */
const pin = `((value) => {
  const pins = (globalThis.__dwInHostPins ??= new Set());
  const promise = Promise.resolve(value);
  pins.add(promise);
  const drop = () => { const timer = setTimeout(() => pins.delete(promise), ${String(PIN_MS)}); timer?.unref?.() };
  promise.then(drop, drop);
  return promise;
})`

/**
 * Wrap a `functionDeclaration` for `Runtime.callFunctionOn` with `awaitPromise`.
 * @param declaration - Function source; it keeps its `this` and its arguments.
 * @returns Function source whose value is pinned.
 */
export function pinnedFunction(declaration) {
  return `function (...args) { return ${pin}((${declaration}).apply(this, args)) }`
}

/**
 * Wrap an `expression` for `Runtime.evaluate` with `awaitPromise`.
 * @param expression - Expression source.
 * @returns Expression source whose value is pinned.
 */
export function pinnedExpression(expression) {
  return `${pin}((${expression}))`
}
