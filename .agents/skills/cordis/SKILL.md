---
name: cordis
description: Cordis plugin-runtime API guide and reference for deepWidgets. Use when writing, reviewing, or loading Cordis plugins, fibers, effects, services, events, or the Cordis loader in deepWidgets. Covers fibers and effect disposers, ctx.plugin / ctx.inject / ctx.effect / ctx.provide, service and injection keys, event dispatch modes, and the mount/dispose lifecycle order.
---

# Cordis

> API text in `references/` is copied from the **deepseek-ai/deepseek-harness** docs, `docs/cordis-api` (MIT):
> https://github.com/deepseek-ai/deepseek-harness/tree/master/docs/cordis-api

Use this skill when working on anything that loads, unloads, or depends on Cordis plugins in deepWidgets.

## Mental model

- A **fiber** is one loaded plugin instance: its lifecycle state, validated config, and registered effects. `ctx.fiber` is the current fiber; `ctx.effect()` delegates to it.
- A **context** (`ctx`) is a proxy: property reads resolve through the service store. `ctx.extend(meta)`, `ctx.isolate(name, label?)`, and `ctx.intercept(name, config)` derive scoped child contexts without mutating the parent.
- Plugin entrypoints come in three shapes: function `(ctx, config)`, class `new (ctx, config)`, or object with `apply(ctx, config)`. Shared metadata keys (`Plugin.Base`): `name`, `Config` (standard-schema validator), `inject`, `provide`, `intercept`.

## Effects and their inverses (disposers)

- `ctx.effect(execute, label?)` runs `execute` immediately. The disposers it produces are collected and run **in reverse order** when the returned disposer is called or the fiber unloads, whichever comes first. Calling the disposer twice is a no-op.
- Accepted effect shapes: a single disposer, a promise of one, or a (possibly async) iterable yielding several — generator effects register each yielded disposer as it is produced. A disposer is `() => T` and may be async (unload awaits it).
- `ctx.effect` throws `CordisError('INACTIVE_EFFECT')` once the fiber is disposed, and `TypeError` on an invalid return shape.
- The same inverse discipline applies to plugin-owned APIs: `ctx.on`/`ctx.once` and `ctx.provide` return disposers; `ctx.accessor`/`ctx.mixin` registrations are removed when the owning fiber unloads.

## What `inject` does

- `ctx.inject(deps, callback)` is shorthand for `ctx.plugin({ inject, apply: callback })`: the callback runs once the requested services are available, and is **unloaded and re-run whenever a required service changes**.
- `deps` is an array of service names, or a name → intercept-config map. A plugin only loads while all of its `inject` services are available.
- `Inject.resolve(inject, result?)` normalizes array/object/class-inherited declarations into a plain map.

## Service keys that matter

Ambient handles on every `ctx`:

- `ctx.events` — event bus; methods are mixed onto `ctx` (`on`, `once`, `emit`, `parallel`, `serial`, `bail`, `waterfall`).
- `ctx.registry` — plugin registry; mixed onto `ctx` (`plugin`, `inject`).
- `ctx.reflect` — service-store layer behind the proxy (`get`, `set`, `provide`, `accessor`, `mixin`).
- `ctx.logger` — logging service; call `ctx.logger(name)` for a named logger.
- `ctx.fiber` — current fiber; `ctx.root` — root context (@experimental); `ctx.baseUrl` — base for plugin specifiers.
- From the loader tier (see `references/inherited.md`): `ctx.timer` with `interval`/`timeout`/`throttle`/`debounce`, and `ctx.loader`.

Class-side symbol keys: `Service.init`, `Service.check`, `Service.config`, `Service.invoke`, `Service.extend`, `Service.tracker`, `Service.resolveConfig`; context statics `Context.effect`, `Context.filter`, `Context.isolate`, `Context.intercept`, and the brand check `Context.is(value)`. A `Service` subclass calls `super(ctx, name)`, registers as `ctx.<name>` immediately, and is removed with its fiber.

## Mount order — `ctx.plugin(plugin, ...args)`

1. Resolve the plugin shape (function / class / `{ apply }` object) and its metadata.
2. Validate `args` config against the plugin's `Config` standard-schema; failure raises `ValidationError` before anything starts.
3. Create the fiber (`internal/plugin` fires; state transitions emit `internal/status`).
4. Wait until every `inject` service is available in the fiber's scope, then load.
5. Run the plugin body in the fiber's child context; all effects, listeners, and provided services are owned by the fiber.
6. Return `Fiber & PromiseLike<Fiber>` — awaiting settles once loading finished (rejecting on config/startup errors); `fiber.await()` rethrows startup errors.

## Dispose order

1. Trigger: `fiber.dispose()`, or a parent unload (the parent runs the child's dispose as one of its effects). Loss of a required service is not a dispose: the fiber only unloads, keeps its `uid`, and reloads when the service returns.
2. `fiber.uid` becomes `null` **first**, before any cleanup; from here `ctx.effect` throws `INACTIVE_EFFECT`. So `uid === null` means "disposed or being disposed" (the "`null` once disposed" of `references/fiber.md` includes the teardown below).
3. `internal/plugin` fires again with the fiber, now with `uid === null`; observer errors are logged, not thrown. The fiber leaves `runtime.fibers`, and a runtime with no fibers left leaves the registry.
4. State goes to `UNLOADING` (`internal/status`). Leaving `ACTIVE` re-checks the dependents of the fiber's provided services: they now see those services as unavailable and start to unload. A `PENDING` or `FAILED` fiber gets the same `UNLOADING` step from dispose directly; a `LOADING` fiber first lets its running load settle.
5. Unload waits until no dependent still holds a provided service, then runs the collected disposers. They start in **reverse registration order** but are not chained (an async disposer does not hold back the next); unload awaits all of them and logs their errors. A `ctx.provide` disposer unregisters its service here.
6. The fiber releases the services it required, state goes to `DISPOSED` (`internal/status`), and `fiber.dispose()` settles.

Related: `fiber.restart()` is not a dispose: it unloads and reloads with current config, and keeps `uid` (on a disposed fiber it throws `INACTIVE_EFFECT`); `fiber.update(config, noSave?)` validates new config, runs the `internal/update` waterfall (update hooks / HMR can veto), then restarts.

## Event dispatch cheat sheet

| Method | Semantics |
| --- | --- |
| `ctx.emit` | Synchronous; listener return values ignored. |
| `ctx.parallel` | Awaits all listeners together. |
| `ctx.serial` | Awaits in order until one bails; returns first bail value. |
| `ctx.bail` | Sync; stops at first bail value (non-null, non-false, non-undefined). |
| `ctx.waterfall` | Composes listeners around a final `next`; not calling `next` vetoes. |

`ctx.on(name, listener, options?)` / `ctx.once(...)` take `{ prepend, global }`; a boolean option is shorthand for `prepend`. Both return a disposer.

## References

- [references/context.md](references/context.md) — context proxy, `extend`/`isolate`/`intercept`, service store (`get`/`set`/`provide`/`accessor`/`mixin`), statics.
- [references/fiber.md](references/fiber.md) — the `Fiber` class, `Effect`/`Disposable`/`EffectMeta`, `CordisError`, `ValidationError`.
- [references/registry.md](references/registry.md) — `ctx.plugin`/`ctx.inject`, `Plugin` shapes and metadata, `Inject`.
- [references/events.md](references/events.md) — dispatch methods, `EventOptions`, `DispatchMode`.
- [references/service.md](references/service.md) — `Service` base class and its symbol keys.
- [references/inherited.md](references/inherited.md) — inherited `ctx` members (timer, loader) and the `internal/*` + `loader/*` event list.
- `references/zh/*.zh.md` — Chinese twins of the above pages (upstream has no `inherited.zh.md`).
- `references/i18n/*.i18n.yaml` — bilingual-pair consistency hashes for each page.

## Guardrails

- Only use APIs documented in the reference files above. If a method or key is not there, say it is undocumented instead of inventing it.
