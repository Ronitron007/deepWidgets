# Widget system exploration `explore`

This folder holds the overnight exploration of 2026-10-27. It answers the open questions of the widget system with options, spikes, and a recommendation for each. It is not a spec. The operator decides, and then a spec goes into `docs/specs/`.

## Files `explore.files`

| File | Content |
|---|---|
| `architecture.md` | The proposed system: the four packages, the seam, the widget definition, the flows, settings, and what the agent sees |
| `options.md` | The options for each open question, with evidence and a recommendation |
| `dsh-mirror.md` | How each part copies the DSH architecture, and where it differs |
| `challenges.md` | The hard problems that are still open, the largest first |
| `spikes.md` | Each spike, its result, and the command that runs it again |

## Decisions for the operator `explore.decisions`

These choices change what gets built. Each line names the section with the evidence.

| Name | Question | Recommendation |
|---|---|---|
| `explore.decisions.data_widgets` | Do agents make CRUD widgets as data (`widget_save`, no code, no approval), next to logic widgets as bundles? | Decided no by the operator on 2026-10-27 (`widget.code_always`). Each widget has agent code in one bundle. |
| `explore.decisions.isolation` | May the deepWidgets host change the DSH uncaught-error handler, so that it quarantines the widget that failed and keeps the host up? | Yes, under the trim marker (`options.isolation`, option F) |
| `explore.decisions.agent_code` | Default policy for agent-written host code | `ask`, with a lint of each bundle (`options.creation`) |
| `explore.decisions.renderer` | One process for each widget (about 20.6 MB each, crashes stay apart) or a shared renderer (about 1.8 MB each, one crash closes all)? | Separate by default. Shared as a user setting (`options.windows.memory`). |
| `explore.decisions.main_desktop_only` | A panel window cannot stay on one desktop. Drop the setting "main desktop only", or use a normal window for it? | Operator call (`options.edges`) |
| `explore.decisions.tailwind` | The shell uses Tailwind v4 to map shadcn onto `--dsw-alias-*`. `docs/web-styling.md` forbids Tailwind for DSH client packages. Allow it in the shell? | Yes, only in the shell (`options.shell`) |
| `explore.decisions.identity` | v1 tokens carry no identity that holds across sessions. Drop per-agent rules, and add a `locked` flag and a trash? | Yes (`options.security`) |
| `explore.decisions.create_tools` | Six create tools, or one tool with an `op` field? | Measure both, then choose (`options.mcp_tools`) |

## Where the work is `explore.where`

- Spike folders: `/private/tmp/claude-501/-Users-rohanmalik-deepWidgets/eb10eeb1-4988-4412-b535-dd45a936ce19/scratchpad/overnight/`.

- Local branches, not pushed: `rohan/playground-runtime` (runtime, then integration), `rohan/playground-creation` (templates), and `rohan/widget-playground` (these documents).
