# Glossary: the page build gate

Each term that the video teaches, with the scene that teaches it.

| Term | Meaning |
|---|---|
| symbolic link (`symlink_teach`) | A file whose content is a path. A program that opens it opens the target instead. The target can sit anywhere on the disk. |
| atomic rename (`rename_teach`) | A rename of a file or a folder either happened or did not. A reader never sees half of one. A copy gives no such promise. |
| shadow root (`shadow_dom_teach`) | A second, separate document inside one element. Page styles do not reach inside it. Inherited properties and custom properties still pass in from the host element. |
| plugin hook (`plugin_hook_teach`) | One named function of a bundler plugin. The bundler calls it at a fixed point of the build. `resolveId` runs for every import. `generateBundle` runs once at the end. |
| module graph (`module_graph_teach`) | The record that a bundler keeps of every module that went into a build, with the path of each one. |
| watch file (`module_graph_teach`) | A file that the bundler read but did not turn into a module, such as a stylesheet that it followed. |
| data URL (`data_url_teach`) | A file embedded as text inside a script or a stylesheet, instead of an emitted file. A bundler does this below a size limit. |
| monkey patching (`monkey_patch_teach`) | Replacing a function of a module while the program runs. The page build does it to the file module of Node, to record every file read. |
| PostCSS (`postcss_teach`) | The tool that a bundler runs over a stylesheet. It hands the sheet to a list of plugins. Tailwind is one such plugin. |
| inter process communication, IPC (`ipc_teach`) | A channel between two processes. The host and Electron main each send an object and each listen for one. A number on each message matches an answer to its question. |
| page folder (`page_folder`) | The folder `page/` next to `src/` in a widget bundle. It holds five files, three of them fixed. |
| fixed file (`page_folder`) | A file of the page that the agent may not change. The gate compares it with the template by hash. |
| dw-core block (`dw_core_block`) | The block of the page stylesheet, between two marker comments, that holds the styles of the four page states. |
| staging copy (`staging_copy`) | The copy of `page/` that the gates work in, under `.page-staging` in the profile folder. |
| import fence (`import_fence`) | The plugin on `resolveId` that refuses an import of a page file which names neither an allowed package nor a file in the page folder. |
| output fence (`output_fence`) | The plugin on `generateBundle` that collects every file which went into the page and refuses a real path outside the page folder and the allowed packages. |
| read recorder (`monkey_patch_teach`) | The set of paths that the monkey patched file functions record while the build runs. |
| build folder (`tmp_build`) | One built page in the folder of its slug: `page-<hash>`, or `page-<hash>.tmp` while the gates run. |
| page link (`page_link`) | The symbolic link `page` in the folder of a slug. It points at the current build. |
| render check (`ipc_teach`) | The last page gate. Electron main loads the built page in a hidden window and reports back to the host. |

## Already taught, with its source

| Term | Where |
|---|---|
| gate; compile, lint, test run | deepWidgets video, 24:42, then 25:37, 25:51, 26:55 |
| Electron main, renderer, host as a child process, `dsh-app://` | deepWidgets video, 05:42 |
| hash as a fingerprint | deepWidgets video, 12:14 |
| profile folder | deepWidgets video, 24:42 |
| rename of the crash record | deepWidgets video, 30:48 |
| core and child, `ChildProps` | widget kit video, 07:29 and 08:00 |
| Vite inputs, outputs, base path | widget kit video, 10:40 |
| Tailwind `@source` | widget kit video, 12:03 |
| content security policy of the page | widget kit video, 38:05 |
| bare import, paths map | widget kit video, 05:21 |

Files: `~/kyaloon-media/explainer-deepwidgets-2026-11-02/explainer-deepwidgets-2026-11-02-v1.mp4` and `~/kyaloon-media/explainer-widget-kit-2026-11-03/explainer-widget-kit-2026-11-03-v1.mp4`.
