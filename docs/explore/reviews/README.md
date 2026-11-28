# deepWidgets design reviews

These reviews capture the November 2026 product, pliability, UI architecture, and security evaluations. The [product direction](../../specs/product-direction.md) records the settled direction for ongoing work.

- [Ephemeral agent surfaces, OpenUI removal, and uniform Vercel UI SDK architecture](future-of-ui-verdict.md) records the settled product and UI architecture verdict: drop `@openuidev/react-lang`, upgrade unconditionally to React 19, ship a themed `@deepwidgets/shell/ui/*` component library on `@ui-sdk/core` + `@ui-sdk/react`, power two-way `interact` mode with `createAgent()` + `ctx.widgets`, and compile ephemeral `.tsx` surfaces in milliseconds via `esbuild.transform` + pre-bundled ESM importmaps.
- [Ephemeral agent surface lifecycle and decision receipts](ephemeral-surface-design.md) details the lease states, `decisionId` result lookup across timeouts/reconnects, renderer `requestId` reconciliation, and trusted desktop confirmation authority (superseded on OpenUI retention by `future-of-ui-verdict.md`).
- [Shared widget interactions and Vercel UI SDK notes](widget-interaction-ui-sdk.md) captures control-level focus, pending/unknown state feedback, and accessibility checks (superseded on React 18 retention and single-control deferral by `future-of-ui-verdict.md`).
- [System architecture and remote access](architecture.md) maps the runtime seams and the device authority that optional hosted connectors will need after the local loop ships.
- [Decision history and agent handoffs](decision-history.md) traces the prototype decisions, window-bar and packaging blockers, and how development and review agents receive instructions.
- [Design workarounds](design-workarounds.md) follows failure sequences across components and proposes ownership, activation, and recovery changes.
