# deepWidgets design reviews

These reviews capture the November 2026 product, pliability, UI architecture, and security evaluations. The [product direction](../../specs/product-direction.md) supplies the authoritative brief for ongoing work.

- [Ephemeral agent surfaces and uniform UI operations](future-of-ui-verdict.md) establishes the primary product and architecture verdict: prioritizing sub-200 ms local-first disposable agent surfaces, synchronous human-to-agent turn resumption (`widget_await`), Direct React authoring, and a uniform `@ui-sdk/core` + `@ui-sdk/react` behavioral spine in `kit` Core, `@deepwidgets/shell`, and `@deepwidgets/widget-kit` over premature phone-to-PC remote connector plumbing.
- [System architecture and remote access](architecture.md) maps the checkout's runtime seams, trust boundaries, and the capability-grant requirements that apply when optional remote connectors are added later.
- [Decision history and agent handoffs](decision-history.md) traces the prototype decisions, window-bar and packaging blockers, and how development and review agents receive instructions.
- [Design workarounds](design-workarounds.md) follows failure sequences across components and proposes ownership, activation, and recovery changes.
