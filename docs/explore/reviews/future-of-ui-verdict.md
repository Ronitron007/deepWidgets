# Ephemeral agent surfaces, OpenUI removal, and uniform Vercel UI SDK architecture

29 November 2026

This document records the settled product and UI architecture verdict for [docs/specs/product-direction.md](../../specs/product-direction.md), superseding the remote-connector-first framing in [architecture.md](architecture.md) and [decision-history.md](decision-history.md) as well as the OpenUI-retention and React-18-deferral positions in [ephemeral-surface-design.md](ephemeral-surface-design.md) and [widget-interaction-ui-sdk.md](widget-interaction-ui-sdk.md).

## 1. Settled executive verdict

**deepWidgets has a high-integrity 16,029-line runtime spine trapped inside microservice deployment ceremony, a deaf human-to-agent loop, a dead-end 19-component OpenUI DSL, and a misplaced remote-connector thesis.**

Optimizing first for a phone chatbot mutating a persistent Grocery widget on a home PC over OAuth 2.1 relays solves a problem that native cloud apps (Apple Reminders, Notion, Linear) already solve with zero desktop footprint, while turning dynamic code and UI creation into an immediate remote-execution hazard. That framing forces months of relay, device-broker, and sandbox plumbing before proving that an agent-driven desktop UI beats a normal app or a chat window.

The real breakthrough is **local-first, post-app, ephemeral agentic UI**: letting any agent on the machine (Cursor, Claude Code, Codex, CLI harnesses) break out of scrolling Markdown chat to materialize live interactive `.tsx` surfaces in under 200 ms (warm p95), collaborate synchronously with the human, compose surfaces and bounded sub-agents, and dispose them automatically when the task finishes — while letting the person pin the surfaces worth keeping. Remote access from phones and hosted connectors belongs as an optional later transport on top of that proven local loop, not as the Day-1 premise.

### Four settled architectural conclusions

1. **Drop OpenUI (`@openuidev/react-lang` and `@openuidev/lang-core`) completely.** OpenUI existed only under the assumption that `.tsx` requires a multi-second Vite build, while doing zero work in `interact` mode and forcing LLMs to learn a custom string DSL (`Action([@Run(...)])`), `<Renderer.Root>` wrappers, `CATALOG_ID` gates, and `OPENUI_TELEMETRY_DISABLED=1` workarounds. Removing OpenUI eliminates double ceremony across the entire stack.
2. **Upgrade unconditionally to React 19.** Upgrade `react`, `react-dom`, and `@types/react` in `@deepwidgets/shell`, `@deepwidgets/widget-kit`, and `@deepwidgets/kit` `CORE` from `18.3.1` to `19.x`, maintaining a single linked React instance across the app and all widgets.
3. **Standardize on Vercel UI SDK (`@ui-sdk/core` + `@ui-sdk/react`) behind `@deepwidgets/shell/ui/*` and `@deepwidgets/widget-kit`.** Ship a themed 50+ control component library in `@deepwidgets/shell/ui/*` (plus `Trace`, `CodeBlock`, and `Confirmation` patterns) so agents import ready-made, accessible, desktop-styled components while staying insulated from `0.1.0-beta` API churn. Mount `@ui-sdk/react/agent` (`createAgent()`) once per window inside `@deepwidgets/widget-kit` so `interact` mode gains full two-way semantic UI observation and operation (`snapshot`, `query`, `act`, and automatic `[data-agent-secret]` redaction) alongside host `ctx.widgets` actions.
4. **Make every widget — ephemeral or durable — plain `.tsx`, hitting `< 200 ms` warm spawns via pre-bundled ESM importmaps + `esbuild.transform`.** Pre-bundle `react@19`, `react-dom@19`, `@ui-sdk/core`, `@ui-sdk/react`, `@deepwidgets/shell/ui/*`, and `@deepwidgets/widget-kit` once in Electron and resolve them via `<script type="importmap">`. Compile ephemeral agent `.tsx` in memory via `esbuild.transform` (~5 ms) with zero `pnpm` install or cold Vite build.

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

1. **One action, two doors (`ctx.widgets`).** [deepwidgets/widgets/src/index.ts](../../../deepwidgets/widgets/src/index.ts) routes human UI clicks (`POST /api/widgets/<slug>/call`) and agent MCP calls (`widget_call`) through the exact same Zod input schema, per-slug FIFO mutation queue, idempotent request marks, monotonic state revision, and SSE invalidation stream. Adding renderer `requestId` support in [deepwidgets/widget-kit/src/channel.ts](../../../deepwidgets/widget-kit/src/channel.ts) completes end-to-end outcome reconciliation.
2. **Crash-only isolation and zero-drop replacement.** [deepwidgets/widgets/src/watchdog.ts](../../../deepwidgets/widgets/src/watchdog.ts) catches synchronous CPU hangs in 2 s via a worker thread, [deepwidgets/widgets/src/isolation.ts](../../../deepwidgets/widgets/src/isolation.ts) attributes uncaught async crashes to the offending plugin row via `AsyncLocalStorage` and quarantines that slug on restart, and [deepwidgets/mcp/src/creation.ts](../../../deepwidgets/mcp/src/creation.ts) hot-swaps `.a`/`.b` standby slots without dropping existing widget state.
3. **Per-slug origin isolation and trusted window chrome.** [apps/desktop/src/deepwidgets-origin.ts](../../../apps/desktop/src/deepwidgets-origin.ts) isolates each widget on `dsh-app://w-<slug>.widget` with `frame-ancestors 'none'` CSP and 403 rejection on cross-slug `/api/widgets/` paths, while [apps/desktop/src/deepwidgets-window-bar.ts](../../../apps/desktop/src/deepwidgets-window-bar.ts) renders drag, layer, and lock controls in a separate `WebContentsView` that untrusted widget DOM cannot spoof.
4. **Constant `O(1)` MCP tool discovery.** [deepwidgets/mcp/src/index.ts](../../../deepwidgets/mcp/src/index.ts) exposes a compact, fixed tool schema regardless of whether 2 or 50 widgets exist, returning structured `{ code, message, nextStep }` errors that agents self-correct against.
5. **Offline deterministic package linking (`@deepwidgets/kit`).** [deepwidgets/kit/src/folder.ts](../../../deepwidgets/kit/src/folder.ts) maintains a single profile-wide pnpm store with symlinked `CORE` overrides so durable widget builds with extra npm packages run offline and share one React instance.

---

## 3. Five usability and pliability chokepoints blocking the vision

### 3.1 Zero plug-and-play MCP usability for real agents

Today a developer cannot install deepWidgets and connect Cursor, Claude Code, or Codex in 30 seconds. [deepwidgets/mcp/src/index.ts](../../../deepwidgets/mcp/src/index.ts) requires a bespoke local challenge exchange (`POST /mcp/token` + `HMAC-SHA256(nonce, challenge)` using `$DSH_HOME/deepwidgets/mcp.json`) and issues bearer tokens tied to an in-memory `epoch` that invalidates on every host restart. Standard MCP clients speak `stdio` or standard HTTP/OAuth, `mcp_consent` is parked, `@deepwidgets/mcp` ships no `stdio` bridge `bin` in [deepwidgets/mcp/package.json](../../../deepwidgets/mcp/package.json), and standalone `.app` packaging remains blocked by missing `@deepwidgets/*` release wiring and ASAR `.d.ts` stripping ([docs/specs/kit.md](../../specs/kit.md)).

### 3.2 Microservice deployment ceremony kills ephemerality

Every widget creation in [deepwidgets/mcp/src/creation.ts](../../../deepwidgets/mcp/src/creation.ts) executes a heavyweight deployment pipeline: staging files to disk, bundling with `esbuild`, type-linting via `oxlint`, spawning a child Node harness with a hardcoded `1,500 ms` timer soak (`TEST_WINDOW_MS = 1_500`), writing `cordis.patch.yml`, and running `pnpm` through `pluginManager` (`~3.5–6 s` minimum; `5–15 s+` when `page/` triggers a Vite build and hidden `BrowserWindow` render check in [deepwidgets/mcp/src/page-gate.ts](../../../deepwidgets/mcp/src/page-gate.ts)). There is no sub-200 ms in-memory tier, no TTL or session-bound auto-disposal, and durable `widget_remove` deliberately retains widget state and placement for reinstall — requiring a separate full-purge policy for ephemeral surfaces. When spawning a surface costs as much latency and ceremony as deploying a microservice, agents default back to printing Markdown in chat.

### 3.3 Why OpenUI is a dead end (and why `createAgent()` + `.tsx` replaces it completely)

The `shadcn-widgets@1` OpenUI catalog ([deepwidgets/shell/src/library.tsx](../../../deepwidgets/shell/src/library.tsx)) ships only 19 basic components over 6 Radix packages — lacking `Select`, `Combobox`, `Slider`, `Date Picker`, `Dialog`, `Popover`, `Tree`, `CodeBlock`/diff views, and drag-and-drop. Even deepWidgets' own `main` widget ([deepwidgets/widget-main/src/index.ts](../../../deepwidgets/widget-main/src/index.ts)) reduced `PROGRAM` to a 5-line pass-through into custom React components (`WidgetTable`, `ModeSwitches`, `WidgetKit` in [deepwidgets/shell/src/main-widget/library.tsx](../../../deepwidgets/shell/src/main-widget/library.tsx)), while custom `page/` authors still had to satisfy fixed `main.tsx` SHA-256 hashes, `<Renderer.Root>`, and `CATALOG_ID` checks ([deepwidgets/mcp/src/page-gate.ts](../../../deepwidgets/mcp/src/page-gate.ts)). Worse, OpenUI is strictly one-way: once painted, it gives `interact` mode zero visibility into open tabs, typed drafts, dropdown choices, or blocking modals. Replacing OpenUI with pre-bundled React 19 + `@deepwidgets/shell/ui/*` + `@ui-sdk/react/agent` (`createAgent()`) + in-memory `esbuild.transform` gives both instant `.tsx` authoring (which frontier LLMs already know natively) and rich two-way `interact` introspection.

### 3.4 The deaf human-to-agent loop and passive CRUD islands

When a user clicks a button, toggles a switch, or edits a field in a widget, [deepwidgets/widgets/src/index.ts](../../../deepwidgets/widgets/src/index.ts) appends `{ by: 'user' }` to an in-memory 1,000-entry ring buffer (`widget_changes`) and emits nothing that wakes or unblocks an external MCP session. An agent cannot materialize an interactive diff chooser, schema mapper, or parameter tuner, wait for the user's click, and immediately continue its turn. Furthermore, `WidgetContext` ([deepwidgets/mcp/widget/widget.d.ts](../../../deepwidgets/mcp/widget/widget.d.ts)) exposes only `widgets.register`, `widgets.update`, `logger`, `timeout`, `interval`, and `effect` — giving widgets no inter-widget event bus, no opt-in desktop context (clipboard, active window, selected file), and no way to spawn or dispose bounded sub-agent loops.

### 3.5 Rigid `320×300` window physics

`newWindowData()` in [apps/desktop/src/deepwidgets-window-place.ts](../../../apps/desktop/src/deepwidgets-window-place.ts) hardcodes every widget window to `320×300` with `resizable: false` in fixed screen-edge columns. That geometry fits a sticky note, not an ambient status pill (`220×44`), an auto-height confirmation card, a `720×520` interactive diff/trace inspector, or a multi-widget workspace group.

---

## 4. Unified React 19 + Vercel UI SDK (`@ui-sdk/*`) architecture

| Layer | Decision | Why |
| --- | --- | --- |
| **OpenUI (`@openuidev/*`)** | **Remove completely** | Eliminates custom DSL hallucinations, `<Renderer.Root>` / `CATALOG_ID` ceremony, and `OPENUI_TELEMETRY_DISABLED=1` workarounds; every widget uses the same `.tsx` mental model. |
| **React runtime** | **Upgrade `CORE` to React 19 (`19.x`)** | Required by `@ui-sdk/react` ([UI SDK Installation](https://ui-sdk.dev/docs/react/installation.md)); linked once through `@deepwidgets/kit` `CORE` + `pnpm-workspace.yaml` `overrides` so no second React copy can enter a widget. |
| **Vercel UI SDK** ([vercel-labs/ui](https://github.com/vercel-labs/ui), public beta launched Nov 12, 2026) | **Adopt `@ui-sdk/core` + `@ui-sdk/react` in `kit` Core, wrapped by `@deepwidgets/shell/ui/*` and `@deepwidgets/widget-kit`** | Supplies 50+ headless accessible primitives (`Select`, `Combobox`, `Command`, `Date Picker`, `Calendar`, `Slider`, `Switch`, `Tabs`, `Tree`, `Timeline`, `Waterfall`, `Token Input`, `Trigger Menu`, `Dialog`, `Drawer`, `Popover`, `Resizable`, `Toast`) on one focus/keyboard/popup engine, plus `createAgent()` for two-way `interact` mode and bundled offline `docs/llms.txt`. |
| **`shadcn/ui` AI Elements** ([ui.shadcn.com/docs/ai-elements](https://ui.shadcn.com/docs/ai-elements), Oct 2026) | **Ship `Trace`, `CodeBlock`, and `Confirmation` in `@deepwidgets/shell/components/*`** | Gives every agent surface uniform step traces, diff/log blocks, and confirmation layouts. |

### 4.1 How `createAgent()` upgrades `interact` mode far beyond OpenUI

In `@ui-sdk/react`, every control rendered through `@deepwidgets/shell/ui/*` automatically registers with a page-level `createAgent()` instance mounted once inside `@deepwidgets/widget-kit` ([UI SDK Agent Reference](https://ui-sdk.dev/docs/agents/connect-an-agent/reference)):

- **Semantic UI eyes (`snapshot()` and `query()`):** Synchronously returns structured `AgentComponent[]` entries (`ref`, `component`, `label`, current `value`, `items`, `min`/`max`/`step`, `disabled`, closed tabs/sections, blocking modals) with zero screenshots or vision tokens. Inputs marked `password`, `otp`, or `data-agent-secret` automatically mask values as `"[redacted]"`, and `data-agent-hidden` subtrees are omitted.
- **Deterministic UI hands (`act({ steps })`):** Lets an agent in `interact` mode pre-fill multi-field forms, switch tabs, filter comboboxes, open popovers, or assert UI state (`expect`) by `ref` or accessible label — automatically traversing behind closed `Tabs`, `Accordion`, `Collapsible`, and `Pagination` sections and returning actionable errors on invalid bounds or ambiguous labels.
- **Human confirmation handoff (`data-agent-confirm` + trusted desktop approval):** Controls carrying `data-agent-confirm` refuse autonomous `act()` execution (`allow` returns `false`), allowing an agent to pre-stage an entire review surface and then wait on `widget_await` while **trusted desktop UI** (not spoofable page DOM) presents and settles the operator's final approval ([lifecycle and receipt rules](ephemeral-surface-design.md#the-proposed-decision-and-lifetime-model)).

### 4.2 Exact package seams across `@deepwidgets/kit`, `@deepwidgets/shell`, and `@deepwidgets/widget-kit`

1. **`@deepwidgets/kit` (`CORE` in [deepwidgets/kit/src/folder.ts](../../../deepwidgets/kit/src/folder.ts)):** Replace `@openuidev/react-lang` in `CORE` with `@ui-sdk/core` and `@ui-sdk/react`, and upgrade `react`, `react-dom`, `@types/react`, and `@types/react-dom` to React 19. Pinning `@ui-sdk/*` in `CORE` links it offline in `0 ms` and avoids pnpm's 24-hour `minimumReleaseAge: 1440` rejections during `0.1.0-beta.*` releases.
2. **`@deepwidgets/shell` (`page.css` + `./ui/*` + `./components/*` + prebuilt importmap bundle):** Declare `@layer dw-core, ui-sdk, theme, base, components, utilities;` and `@import "@ui-sdk/core/web.css" layer(components);` in `page.css` mapped onto `--dsw-*` tokens, add `<meta property="csp-nonce" />` so `@ui-sdk` uses `document.adoptedStyleSheets` under strict widget-origin CSP, and export themed wrappers in `@deepwidgets/shell/ui/*` that shield widget code from `0.1.0-beta` API changes. Also emit a single pre-bundled ESM runtime for `<script type="importmap">` fast spawns.
3. **`@deepwidgets/widget-kit` (`mountWidget`, `useWidget`, `requestId`, and `createAgent()`):** Mount plain React 19 components (`mountWidget({ render })` + `useWidget<State, Actions>()`), attach idempotent `requestId` headers on `POST /api/widgets/<slug>/call` so pending/committed/unknown outcomes reconcile cleanly, and instantiate one `createAgent()` bridge per window connected to the same-slug host channel (without exposing browser `WebMCP` `registerTools()`).

```tsx
// Unified widget authoring model (both <200 ms ephemeral spawns and durable widgets):
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

---

## 5. Prioritized implementation sequence

### Phase 1 · React 19 + Vercel UI SDK Core + OpenUI Removal + `stdio` MCP

1. **Zero-config `stdio` MCP bridge (`@deepwidgets/mcp` bin).** Ship a CLI entry (`deepwidgets-mcp`) that reads `$DSH_HOME/deepwidgets/mcp.json`, completes the loopback HMAC token exchange, and transparently re-authenticates across host `epoch` restarts so Cursor, Claude Code, and Codex attach with one standard MCP config entry.
2. **React 19 + `@ui-sdk` Core spine + OpenUI removal.** Upgrade `@deepwidgets/shell`, `@deepwidgets/widget-kit`, and `@deepwidgets/kit` `CORE` to React 19 + `@ui-sdk/core` + `@ui-sdk/react`; ship the themed `@deepwidgets/shell/ui/*` component library (plus `Trace`, `CodeBlock`, `Confirmation`); replace OpenUI in `widget-kit`, `widget-sample`, `widget-main`, and `mcp` templates/gates with `mountWidget({ render })` + `useWidget<State, Actions>()`, renderer `requestId` tracking, and `createAgent()`-backed `widget_ui_snapshot` / `widget_ui_act` tools in `interact` mode.

### Phase 2 · Sub-200 ms Ephemeral `.tsx` Spawning + Resilient `widget_await`

3. **Fast `.tsx` ephemeral tier (`widget_spawn` + leases + Pin).** Serve the pre-bundled React 19 + `@ui-sdk` + `@deepwidgets/shell` ESM runtime via `<script type="importmap">`, compile agent `.tsx` in memory via `esbuild.transform` (~5 ms), attach explicit leases (`ttlMs`, `disposeOnAction`, session disconnect) with full state/window purge on disposal, and add trusted **Pin** promotion on the native window bar ([apps/desktop/src/deepwidgets-window-bar.ts](../../../apps/desktop/src/deepwidgets-window-bar.ts)).
4. **Close the deaf loop (`widget_await` + `decisionId` receipts + trusted confirm).** Add bounded `widget_await` plus idempotent `decisionId` result lookup across timeouts/reconnects, backed by trusted desktop approval UI and strict refusal of late answers on expired or superseded surfaces.

### Phase 3 · Composable Multi-Surface Agency, Packaging, and Later Remote Transport

5. **Composable agency and adaptive window modes.** Add typed inter-widget pub/sub (`ctx.bus`), `ctx.effect()`-scoped sub-agent leases (`ctx.agent`), operator-gated desktop context sensors, and presentation modes (`pill`, auto-height `card`, resizable `panel`, `hud`).
6. **Standalone packaging and optional remote connectors.** Unpack `kit` Core `.d.ts` files outside `app.asar`, complete standalone `.app` packaging decoupled from dormant DSH weight, and later layer device-owned OAuth/relay grants ([architecture.md](architecture.md)) for mobile and hosted connectors.
