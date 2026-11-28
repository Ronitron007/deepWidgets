# Ephemeral agent surfaces and uniform UI operations

29 November 2026

This verdict supersedes the remote-connector-first product framing in [architecture.md](architecture.md) and [decision-history.md](decision-history.md), and supplies the architectural basis for [docs/specs/product-direction.md](../../specs/product-direction.md).

## 1. Executive verdict

**deepWidgets has a high-integrity 16,029-line runtime spine trapped inside microservice deployment ceremony, a deaf human-to-agent loop, a restrictive 19-component DSL, and a misplaced remote-connector thesis.**

Optimizing first for a phone chatbot mutating a persistent Grocery widget on a home PC over OAuth 2.1 relays solves a problem that native cloud apps (Apple Reminders, Notion, Linear) already solve with zero desktop footprint, while turning dynamic code and UI creation into an immediate remote-execution hazard. That framing forces months of relay, device-broker, and sandbox plumbing before proving that an agent-driven desktop UI is better than a normal app or a chat window.

The real breakthrough is **local-first, post-app, ephemeral agentic UI**: letting any agent on the machine (Cursor, Claude Code, Codex, CLI harnesses) break out of scrolling Markdown chat to materialize live interactive surfaces in under 200 ms, collaborate synchronously with the human, compose surfaces and bounded sub-agents, and dispose them automatically when the task finishes — while letting the person pin the surfaces worth keeping. Remote access from phones and hosted connectors belongs as an optional later transport on top of that proven local loop, not as the Day-1 premise.

To give every widget a **uniform operational and visual contract**, deepWidgets should incorporate Vercel's **UI SDK** ([vercel-labs/ui](https://github.com/vercel-labs/ui), `@ui-sdk/core` and `@ui-sdk/react`, [ui-sdk.dev](https://ui-sdk.dev/docs)) — **not** as an optional npm extra in `kit`, and **not** as a replacement for host `ctx.widgets` state mutations, but as part of the **locked `kit` Core (`@deepwidgets/kit`), pre-styled in `@deepwidgets/shell`, and wired once into `@deepwidgets/widget-kit`'s runtime bridge**.

---

## 2. Quantitative footprint and what carries real value today

| Layer | Files | Lines | Verdict |
| --- | --- | --- | --- |
| `deepwidgets/*` active runtime, MCP, kit, shell, built-in widgets | 82 | 13,410 | Keep and evolve — compact, high-leverage core |
| `apps/desktop/src/deepwidgets-*` + `preload-widget-bar.ts` | 16 | 2,619 | Keep and evolve — clean Electron window, origin, and bar separation |
| `tools/` smoke, replay, and TLA+-aligned verification scripts | 27 | 11,329 | Strong reliability discipline (`0.71:1` test-to-runtime ratio) |
| `docs/specs`, `docs/plans`, `docs/explore` | 41 | 4,637 | Clear engineering records |
| Inherited dormant DSH `packages/` + `apps/` | 6,403 | 1,387,268 | **97.7% dormant weight** — complicates packaging, upgrades, and mental model |

Five architectural assets in the `16,029`-line active codebase carry genuine, defensible value and must be preserved:

1. **One action, two doors (`ctx.widgets`).** [deepwidgets/widgets/src/index.ts](../../../deepwidgets/widgets/src/index.ts) routes human UI clicks (`POST /api/widgets/<slug>/call`) and agent MCP calls (`widget_call`) through the exact same Zod input schema, per-slug FIFO mutation queue, idempotent request marks, monotonic state revision, and SSE invalidation stream. Unlike disposable HTML iframe artifacts, both human and agent operate on one live state machine.
2. **Crash-only isolation and zero-drop replacement.** [deepwidgets/widgets/src/watchdog.ts](../../../deepwidgets/widgets/src/watchdog.ts) catches synchronous CPU hangs in 2 s via a worker thread, [deepwidgets/widgets/src/isolation.ts](../../../deepwidgets/widgets/src/isolation.ts) attributes uncaught async crashes to the offending plugin row via `AsyncLocalStorage` and quarantines that slug on restart, and [deepwidgets/mcp/src/creation.ts](../../../deepwidgets/mcp/src/creation.ts) hot-swaps `.a`/`.b` standby slots without dropping existing widget state.
3. **Per-slug origin isolation and trusted window chrome.** [apps/desktop/src/deepwidgets-origin.ts](../../../apps/desktop/src/deepwidgets-origin.ts) isolates each widget on `dsh-app://w-<slug>.widget` with `frame-ancestors 'none'` CSP and 403 rejection on cross-slug `/api/widgets/` paths, while [apps/desktop/src/deepwidgets-window-bar.ts](../../../apps/desktop/src/deepwidgets-window-bar.ts) renders drag, layer, and lock controls in a separate `WebContentsView` that untrusted widget DOM cannot spoof.
4. **Constant `O(1)` MCP tool discovery.** [deepwidgets/mcp/src/index.ts](../../../deepwidgets/mcp/src/index.ts) exposes a fixed ~11-tool schema (`widget_list`, `widget_describe`, `widget_call`, `widget_changes`, `widget_install`, `widget_reload`, `widget_remove`, plus guide/template tools) regardless of whether 2 or 50 widgets exist, returning structured `{ code, message, nextStep }` errors that agents self-correct against.
5. **Offline deterministic package linking (`@deepwidgets/kit`).** [deepwidgets/kit/src/folder.ts](../../../deepwidgets/kit/src/folder.ts) maintains a single profile-wide pnpm store with symlinked `CORE` overrides so widget page builds run offline and share one React instance.

---

## 3. Five usability and pliability chokepoints blocking the vision

### 3.1 Zero plug-and-play MCP usability for real agents

Today a developer cannot install deepWidgets and connect Cursor, Claude Code, or Codex in 30 seconds. [deepwidgets/mcp/src/index.ts](../../../deepwidgets/mcp/src/index.ts) requires a bespoke local challenge exchange (`POST /mcp/token` + `HMAC-SHA256(nonce, challenge)` using `$DSH_HOME/deepwidgets/mcp.json`) and issues bearer tokens tied to an in-memory `epoch` that invalidates on every host restart. Standard MCP clients speak `stdio` or standard HTTP/OAuth, `mcp_consent` is parked, `@deepwidgets/mcp` ships no `stdio` bridge `bin` in [deepwidgets/mcp/package.json](../../../deepwidgets/mcp/package.json), and standalone `.app` packaging remains blocked by missing `@deepwidgets/*` release wiring and ASAR `.d.ts` stripping ([docs/specs/kit.md](../../specs/kit.md)).

### 3.2 Microservice deployment ceremony kills ephemerality

Every widget creation in [deepwidgets/mcp/src/creation.ts](../../../deepwidgets/mcp/src/creation.ts) executes a heavyweight deployment pipeline: staging files to disk, bundling with `esbuild`, type-linting via `oxlint`, spawning a child Node harness with a hardcoded `1,500 ms` timer soak (`TEST_WINDOW_MS = 1_500`), writing `cordis.patch.yml`, and running `pnpm` through `pluginManager` (`~3.5–6 s` minimum; `5–15 s+` when `page/` triggers a Vite build and hidden `BrowserWindow` render check in [deepwidgets/mcp/src/page-gate.ts](../../../deepwidgets/mcp/src/page-gate.ts)). There is no sub-200 ms in-memory tier, no TTL or session-bound auto-disposal, and `widget_remove` leaves orphaned state and window rows in SQLite. When spawning a surface costs as much latency and ceremony as deploying a microservice, agents default back to printing Markdown in chat.

### 3.3 The OpenUI Lang ceiling and double ceremony

The default `shadcn-widgets@1` catalog ([deepwidgets/shell/src/library.tsx](../../../deepwidgets/shell/src/library.tsx)) provides only 19 basic components — lacking `Select`, `Combobox`, `Slider`, `Switch`, `Tabs`, `Textarea`, `Date Picker`, `Dialog`, `Popover`, `Tree`, `CodeBlock`/diff views, and drag-and-drop. Even deepWidgets' own built-in `main` widget ([deepwidgets/widget-main/src/index.ts](../../../deepwidgets/widget-main/src/index.ts)) bypassed OpenUI Lang for real UI, reducing `PROGRAM` to a 5-line wrapper around custom React components (`WidgetTable`, `ModeSwitches`, `WidgetKit` in [deepwidgets/shell/src/main-widget/library.tsx](../../../deepwidgets/shell/src/main-widget/library.tsx)). Yet when an agent authors custom React in `page/`, [deepwidgets/mcp/src/page-gate.ts](../../../deepwidgets/mcp/src/page-gate.ts) still enforces exact SHA-256 hashes on `index.html` and `main.tsx` and forces the page through `<Renderer.Root>` and `CATALOG_ID` synchronization.

### 3.4 The deaf human-to-agent loop and passive CRUD islands

When a user clicks a button, toggles a switch, or edits a field in a widget, [deepwidgets/widgets/src/index.ts](../../../deepwidgets/widgets/src/index.ts) appends `{ by: 'user' }` to an in-memory 1,000-entry ring buffer (`widget_changes`) and emits nothing that wakes or unblocks an external MCP session. An agent cannot materialize an interactive diff chooser, schema mapper, or parameter tuner, wait for the user's click, and immediately continue its turn; the human must manually alt-tab back to chat and tell the agent to poll `widget_changes`. Furthermore, `WidgetContext` ([deepwidgets/mcp/widget/widget.d.ts](../../../deepwidgets/mcp/widget/widget.d.ts)) exposes only `widgets.register`, `widgets.update`, `logger`, `timeout`, `interval`, and `effect` — giving widgets no inter-widget event bus, no opt-in desktop context (clipboard, active window, selected file), and no way to spawn or dispose bounded sub-agent loops.

### 3.5 Rigid `320×300` window physics

`newWindowData()` in [apps/desktop/src/deepwidgets-window-place.ts](../../../apps/desktop/src/deepwidgets-window-place.ts) hardcodes every widget window to `320×300` with `resizable: false` in fixed screen-edge columns. That geometry fits a sticky note, not an ambient status pill (`220×44`), an auto-height confirmation card, a `720×520` interactive diff/trace inspector, or a multi-widget workspace group.

---

## 4. Vercel UI SDK (`@ui-sdk/*`) and `json-render` evaluation

To give all widgets **uniform operational and visual behavior**, we evaluated Vercel's late-2026 agent-UI releases across three distinct projects:

| Project | Role | Fit for deepWidgets |
| --- | --- | --- |
| **Vercel UI SDK** ([vercel-labs/ui](https://github.com/vercel-labs/ui), `@ui-sdk/core` + `@ui-sdk/react`, launched Oct 2026, beta) | 50+ headless accessible behavior primitives (`Select`, `Combobox`, `Command`, `Date Picker`, `Calendar`, `Slider`, `Switch`, `Tabs`, `Tree`, `Timeline`, `Waterfall`, `Token Input`, `Trigger Menu`, `Dialog`, `Drawer`, `Popover`, `Resizable`, `Toast`) **plus** `@ui-sdk/react/agent` (`createAgent()` -> `snapshot()`, `query()`, `act({ steps })`, `subscribe()`) | **Strong adopt — in Core Kit + Shell + Widget-Kit.** Solves both the missing 40+ interactive controls and uniform agent-driven UI introspection/operation across every widget. |
| **Vercel `json-render`** ([vercel-labs/json-render](https://github.com/vercel-labs/json-render), `@json-render/core` + `@json-render/react`) | Constrained JSON schema catalog + progressive `SpecStream` generative UI renderer | **Candidate replacement for `@openuidev/react-lang`** on the `<200 ms` zero-build declarative path (standard JSON instead of bespoke DSL, progressive streaming, React 19 native, no `OPENUI_TELEMETRY_DISABLED=1` workaround), backed by the same `@deepwidgets/shell` components. |
| **`shadcn/ui` AI Elements** ([ui.shadcn.com/docs/ai-elements](https://ui.shadcn.com/docs/ai-elements), Oct 2026, replacing deprecated `vercel/ai-elements`) | Copy-in patterns (`Trace`, `CodeBlock`, `Confirmation`, `Questionnaire`) for agent steps, code diffs, and tool approvals | **Adopt `Trace`, `CodeBlock`, and `Confirmation` patterns inside `@deepwidgets/shell`** so every agent-spawned widget renders reasoning steps, diffs, logs, and approvals identically. |

### 4.1 Why UI SDK solves the widget uniformity problem

Right now in deepWidgets, if an agent builds a custom React `page/`, its transient UI state (which tab is open, what filter text is typed, which combobox options exist, whether a modal covers the screen, which button needs human confirmation) is invisible to MCP unless the widget author hand-wrote host RPCs for every UI detail.

In `@ui-sdk/react`, every primitive built on `@ui-sdk/core` automatically registers with a page-level `createAgent()` bridge ([UI SDK Agent Reference](https://ui-sdk.dev/docs/agents/connect-an-agent/reference)):

- **Uniform semantic introspection (`agent.snapshot()` and `agent.query()`):** Returns a compact, deterministic `AgentComponent[]` list (`ref: "c1"`, `component: "select"`, `label: "Region"`, `value`, `items`, `min`/`max`/`step`, `actions: ["setValue"]`) with zero screenshots or vision tokens. Fields marked `password`, `otp`, or `data-agent-secret` automatically redact their values as `"[redacted]"`, and `data-agent-hidden` subtrees stay excluded.
- **Uniform deterministic UI actions (`agent.act({ steps })`):** Agents operate controls by `ref` or accessible label (`setValue`, `setChecked`, `press`, `open`, `expect`) through component APIs rather than brittle coordinate clicks. The bridge automatically searches behind closed `Tabs`, `Accordion`, `Collapsible`, and `Pagination` sections, validates numeric bounds and option labels with self-correcting error messages, and reports blocking modals.
- **Uniform human-confirmation gates (`data-agent-confirm` + `allow`):** Any control carrying `data-agent-confirm="Deploy to production?"` cannot be pressed autonomously without `allow`; paired with `deepWidgets`' `widget_await`, an agent can pre-stage a complex form via `act`, halt cleanly at the confirm gate, and resume the instant the person clicks confirm.
- **Uniform keyboard, focus, and ARIA physics:** Roving focus, typeahead, popup positioning, Escape dismissal, focus restoration, and entry/exit animations (`data-starting-style` / `data-ending-style`) work identically across all 50+ primitives without portals or provider trees.
- **Offline agent documentation bundled in the package:** `@ui-sdk/react` ships `docs/llms.txt` inside `node_modules/@ui-sdk/react/docs/llms.txt`, letting `deepWidgets` serve exact component contracts offline through MCP without network lookups.

### 4.2 Where it belongs: Core of `kit` + `@deepwidgets/shell` + `@deepwidgets/widget-kit` (NOT an optional extra)

Putting `@ui-sdk/react` in `$DSH_HOME/deepwidgets/kit` as an optional user/agent "extra" would **fail** both technically and architecturally:

1. **React 19 requirement vs single-React invariant:** `@ui-sdk/react` requires `react >= 19`, `react-dom >= 19`, and `@types/react >= 19.2.10` ([UI SDK Installation](https://ui-sdk.dev/docs/react/installation.md)), whereas [deepwidgets/shell/package.json](../../../deepwidgets/shell/package.json) and [deepwidgets/widget-kit/package.json](../../../deepwidgets/widget-kit/package.json) currently pin `react@18.3.1`. Because [deepwidgets/kit/src/folder.ts](../../../deepwidgets/kit/src/folder.ts) enforces a single linked React via `pnpm-workspace.yaml` `overrides`, upgrading `CORE` to React 19 and placing `@ui-sdk/core` and `@ui-sdk/react` inside `CORE` is mandatory.
2. **pnpm `minimumReleaseAge: 1440` and beta churn:** `@ui-sdk/*` is in active `0.1.0-beta.*` iteration. Shipping pinned versions inside `CORE` links them offline in `0 ms` and avoids 24-hour release-age rejections (`ERR_PNPM_NO_MATURE_MATCHING_VERSION`) on ad-hoc installs.
3. **Visual uniformity and CSP compliance belong in `@deepwidgets/shell`:** Raw `@ui-sdk/react/*` components are unstyled and inject behavioral CSS into `@layer ui-sdk`, requiring either `'unsafe-inline'` styles or `<meta property="csp-nonce" />` (which switches `@ui-sdk` to `document.adoptedStyleSheets`, compatible with strict CSP). [deepwidgets/shell/page.css](../../../deepwidgets/shell/page.css) should declare `@layer dw-core, ui-sdk, theme, base, components, utilities;` and `@import "@ui-sdk/core/web.css" layer(components);` mapped onto `--dsw-*` tokens, and `@deepwidgets/shell/ui/*` should export pre-styled wrappers around `@ui-sdk/react/*` (plus `Trace` and `CodeBlock`). Widgets import `@deepwidgets/shell/ui/*`, guaranteeing identical look-and-feel and insulating widget code from upstream `0.1.0-beta` API changes.
4. **Operational uniformity belongs in `@deepwidgets/widget-kit` (not browser `WebMCP`):** `@ui-sdk`'s `registerTools()` targets `document.modelContext` (WebMCP for in-browser chatbots) and is irrelevant inside Electron floating windows. Instead, [deepwidgets/widget-kit/src/index.tsx](../../../deepwidgets/widget-kit/src/index.tsx) should instantiate `createAgent()` once inside `mountWidget`, bridging `snapshot`, `query`, and `act` over the existing same-slug host channel while keeping durable business state in `ctx.widgets` actions:

```tsx
// Architectural seam across @deepwidgets/widget-kit and @deepwidgets/shell:
// 1. Domain mutations & durable state stay in ctx.widgets (useWidget -> POST /api/widgets/<slug>/call).
// 2. Live UI inspection, multi-step form/tab driving, redaction, and human-confirm gates run uniformly
//    through one @ui-sdk/react/agent instance mounted by @deepwidgets/widget-kit in every widget window.
import { Button } from '@deepwidgets/shell/ui/button'
import { Select, SelectContent, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@deepwidgets/shell/ui/select'
import { Trace } from '@deepwidgets/shell/components/trace'
import { mountWidget, useWidget } from '@deepwidgets/widget-kit'

export function DeployReviewSurface() {
  const { data, call, pending } = useWidget<DeployState, DeployActions>()
  return (
    <div className="flex flex-col gap-3 p-3">
      <Trace steps={data.checks} />
      <Select value={data.region} onValueChange={(region) => void call('setRegion', { region })}>
        <SelectLabel>Target region</SelectLabel>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="us-east">US East</SelectItem>
          <SelectItem value="eu-central">EU Central</SelectItem>
        </SelectContent>
      </Select>
      <Button
        data-agent-confirm="Approve production rollout?"
        disabled={pending}
        onClick={() => void call('approveRollout', { approved: true })}
      >
        Approve rollout
      </Button>
    </div>
  )
}

mountWidget({ render: DeployReviewSurface })
```

Under this split, **two clean tiers of control** coexist without confusion:

- **Domain actions (`widget_call` -> `ctx.widgets`):** Durable, schema-validated mutations and queries owned by the host (`approveRollout`, `saveMapping`, `runQuery`), persisted in SQLite with idempotency keys and revisions.
- **Surface operations (`widget_ui_snapshot` / `widget_ui_act` -> `@ui-sdk/react/agent` in `widget-kit`):** Uniform live inspection and interaction with any rendered widget's tabs, comboboxes, sliders, dialogs, and `[data-agent-confirm]` gates, automatically inherited by every widget with zero extra code from the widget author.

---

## 5. Prioritized roadmap to deliver real value

### P0 · Make the local agent-to-human UI loop effortless and bidirectional

1. **Zero-config `stdio` MCP bridge (`@deepwidgets/mcp` bin).** Ship a lightweight CLI entry in `@deepwidgets/mcp` (`deepwidgets-mcp`) that reads `$DSH_HOME/deepwidgets/mcp.json`, performs the loopback HMAC token exchange, and transparently re-authenticates across host restarts (`epoch` rotation) so Cursor, Claude Code, and Codex connect with a single standard `stdio` MCP entry.
2. **Close the deaf loop (`widget_await` / `widget_await_any`).** Add blocking/long-poll MCP primitives (`widget_await({ slug, actions?, confirmOnly?, timeoutMs })`) backed by `ctx.widgets` mutation settlement and `[data-agent-confirm]` events so an agent can spawn a surface, wait directly on the human's decision or edits without polling or chat nudges, and receive the structured payload immediately on click.
3. **Sub-200 ms ephemeral surface tier (`widget_spawn` + leases/TTL + Pin).** Add an in-memory registration path on `ctx.widgets` that skips `esbuild`, the `1,500 ms` child soak, `cordis.patch.yml`, and `pnpm` installation for ephemeral surfaces. Attach explicit lifecycle leases (`ttlMs`, `disposeOnAction`, or MCP session disconnect) that garbage-collect the window and all state cleanly, and add a **Pin** button on the trusted hover bar ([apps/desktop/src/deepwidgets-window-bar.ts](../../../apps/desktop/src/deepwidgets-window-bar.ts)) to promote valuable ephemeral surfaces into durable installed widgets.

### P1 · Uniform UI SDK spine, Direct React authoring, and multi-surface agency

4. **Upgrade `kit` Core to React 19 + `@ui-sdk` + Direct React `mountWidget({ render })`.**
   - Upgrade `react` and `react-dom` in `CORE` ([deepwidgets/kit/src/folder.ts](../../../deepwidgets/kit/src/folder.ts)) to React 19 and add `@ui-sdk/core` and `@ui-sdk/react` to `CORE`.
   - Layer `@ui-sdk/core/web.css`, `@layer ui-sdk`, `<meta property="csp-nonce" />` constructed stylesheets, the 50+ `@deepwidgets/shell/ui/*` wrappers, and `Trace` / `CodeBlock` / `Confirmation` components into `@deepwidgets/shell`.
   - Mount `@ui-sdk/react/agent` (`createAgent()`) inside `@deepwidgets/widget-kit` to power uniform `widget_ui_snapshot` and `widget_ui_act` tools, and add Direct React mode (`mountWidget({ render })` + `useWidget<State, Actions>()`) so custom `page/` TSX needs zero OpenUI `<Renderer.Root>` or `CATALOG_ID` ceremony.
   - Render the `<200 ms` zero-build declarative catalog onto those same `@deepwidgets/shell/ui/*` components (evaluating `@json-render/core` + `@json-render/react` against `@openuidev/react-lang` so declarative specs use standard JSON and progressive streaming on React 19).
5. **True composable agency (`ctx.bus`, `ctx.agent`, context sensors, adaptive window modes).**
   - Expose a typed inter-widget pub/sub bus (`ctx.bus`) so one surface (a file/PR selector or log watcher) drives sibling surfaces reactively.
   - Expose `ctx.effect()`-scoped sub-agent leases (`ctx.agent`) with strict turn/budget caps so a live widget can run background synthesis or monitoring that automatically disposes when the widget closes or unloads.
   - Add operator-gated desktop context feeds (clipboard, frontmost app/window metadata, selected file) and adaptive window presentation modes (`pill`, auto-height `card`, resizable `panel`, click-through `hud`) beyond fixed `320×300` tiles.

### P2 · Standalone packaging and optional remote connector transport

6. **Standalone desktop packaging and DSH decoupling.** Fix `@deepwidgets/*` packaging and unpack `kit` Core `.d.ts` assets outside `app.asar` so deepWidgets installs as a fast, self-contained macOS menu bar app without dragging `1.39M` lines of unused DSH machinery into the developer workflow.
7. **Optional remote connector layer.** Once the local ephemeral + durable widget loop is indispensable, apply the capability-grant, device-approval, and OAuth/relay designs from [architecture.md](architecture.md) so mobile and hosted agents can safely reach operator-shared durable widgets.
