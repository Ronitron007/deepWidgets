# Cuts: the page build gate

What the script leaves out, by scene. Each item is true. None of it changes the mental model, so the voice does not say it. Several items belong on a visual.

## gate_files

- `MAX_DIAGNOSTICS` is twenty for every page gate.
- The marker text is exactly `/* dw-core:begin` and `/* dw-core:end */`. A stylesheet with two begin markers fails, because `coreBlock` refuses more than one.
- `templateCore` throws when the template itself has no block. That is a bug in our own package, not in a page.

## staging_copy

- The staging folder name comes from `mkdtemp`, with the prefix `stage-`.
- `realpath` runs on the staging path, because on macOS the temporary folder sits behind a link, and `/var` is really `/private/var`.
- The written `tsconfig.json` sets target es2024, module esnext, moduleResolution bundler, jsx react-jsx, strict, noEmit, skipLibCheck, allowImportingTsExtensions, `types: []`, and lib es2024 plus dom and dom.iterable.
- The written `oxlintrc.json` turns the correctness category off and keeps one rule, `typescript/no-floating-promises`, only so that tsgolint keeps running.

## linked_modules

- The eight links include `@types/react` and `@types/react-dom`, which the type gate needs and the build does not.
- `packageFolders` finds a folder through `resolve.paths`, not through `require.resolve`, because a package can leave `package.json` out of its exports.

## gate_types

- The limit is sixty seconds, `LINT_LIMIT_MS`.
- The child runs with `ELECTRON_RUN_AS_NODE=1` and `OXLINT_TSGOLINT_PATH`.
- `maxBuffer` is sixteen mebibytes.
- The diagnostic filter keeps only lines that match a file, line and column pattern. When none match, the gate reports the exit code and the last six hundred characters.

## import_fence

- The fence returns null for an import whose source starts with a null byte, which is how Rollup marks a virtual module.
- It calls `this.resolve` with `skipSelf`, so it does not call itself.
- `vite/modulepreload-polyfill` is on the allowed list because Vite adds that import to the entry itself, not because a page needs it.

## output_fence

- The staging folder is allowed as well as the page folder, because Vite reads the written `tsconfig.json` for the page files.
- The error names a count and the first five paths.
- `allowedFolders` follows `dependencies`, `peerDependencies` and `optionalDependencies` always, and `devDependencies` only for a package outside a `node_modules` folder.

## monkey_patch_teach

- The wrapped functions are `readFile`, `readFileSync`, `createReadStream`, `open` and `openSync` on `node:fs`, plus `readFile` and `open` on `node:fs/promises`.
- `syncBuiltinESMExports` makes the wrapped versions visible to code that imported them by name.
- The recorder accepts a string, a `file:` URL, or a Buffer.

## build_child

- The job travels as a JSON file, not as arguments.
- The child runs with only PATH, `ELECTRON_RUN_AS_NODE` and `NODE_ENV` in its environment.
- The gate also fails when the child writes no `index.html`.
- `envDir` points at an empty folder, so Vite reads no `.env` file of the page.
- `publicDir` is false, `reportCompressedSize` is false, and `resolve.dedupe` lists react and react-dom.

## hidden_window

- `useContentSize` is true and `frame` is false.
- `backgroundThrottling` is false, so a hidden window keeps running at full speed.
- The window title carries the slug, which helps when a check leaks one.

## deadline

- `READY_LIMIT_MS` is ten seconds and lives inside the fifteen second `CHECK_LIMIT_MS`.
- `POLL_MS` is one hundred milliseconds, and `SETTLE_MS` is four hundred.
- The host waits forty-five seconds for the answer of Electron main.
- The judge stops early when the renderer ends, or when a console line starts with `Uncaught`.

## style_probe

- The six probed boxes are `dw-surface`, `dw-state`, `dw-state strong`, `dw-state--error`, `dw-state--error strong` and `dw-skeleton`.
- Each hidden box is `position: fixed`, `visibility: hidden`, `pointer-events: none`, three hundred twenty pixels wide.
- The probe returns its result as a JSON string, because `executeJavaScript` must give a value that serializes.
- The compared properties avoid layout, so a style of the agent that only moves a box does not fail the check.

## page_link

- The temporary link name is `.page-link-` plus six random bytes as hex.
- A page folder from an older install is not a link, and a rename can not replace a folder with a link, so that case removes the folder first.
- `dropBuild` removes a build of an install that did not apply, unless the link names it.

## keep_three

- `PAGE_BUILDS_KEPT` is three, the current build with them.
- A reused build gets a new modification time, so the prune counts it as the newest.
- The prune sorts by modification time and removes from the oldest.

## example_pass

- The check asserts the whole gate chain as one string, `compile,lint,test,page-files,page-types,page-build,page-render`.
- The CLI part of the check asserts sixty-six cases.
- The build median of one and a quarter seconds came from twelve runs, with and without the read recorder.

## limits_open

- The exemption is the pattern `^(?:package|tsconfig[^/]*|jsconfig[^/]*)\.json$` together with a test that the file is not already a module or an emitted asset.
- The proposed fix is `build.assetsInlineLimit` as a function that refuses to inline those names, and `worker: { plugins: () => [importFence(job)] }`.
- A reviewer tested that two line fix in a scratch build. All thirty-seven of its probes were refused, and a normal page still built. It did not run the full suite.

## Not in the video at all

- The `widget_install` model of the `widget-state-models` skill still describes the code. It ran with its mutants, thirteen of thirteen, in five hundred forty-six seconds. The model has no page steps, because the page gates fail before any write.
- The first review round of this PR had four findings and the second had one. The video tells the outcomes, not the round numbers.
- The PR is nineteen hundred lines across twenty-three files.
