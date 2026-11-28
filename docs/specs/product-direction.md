# Product direction

deepWidgets gives an agent a desktop surface to work with the person at the PC. A local agent can open an interactive review, ask the person for a decision, and continue once the person responds. The surface closes when its work ends. The person can pin a useful surface as a durable desktop widget.

The same provider-neutral MCP and widget action contracts support the longer-term product. A person can connect a compatible model-provider app or agent from anywhere to a selected PC and grant it access to specific widgets and actions. Each connection has its own grants. The PC owner can review, pause, and revoke access, and widgets remain useful locally while the PC is offline.

## What this means for development

- Prove the local agent-to-person loop first. Use standard local MCP attachment, a temporary surface rendered from existing controls without a build or package install, and a decision that the calling agent can receive in the same working session. Measure warm time to first usable frame separately from cold attachment and app launch.
- Give built-in, temporary, and custom widgets the same conventions for keyboard use, focus, accessibility, feedback about action outcomes, and recovery. `@deepwidgets/shell` owns reusable controls, styling, and catalog bindings. `@deepwidgets/widget-kit` owns the common frame and widget action bindings. `@deepwidgets/kit` distributes the pinned dependencies. Vercel UI SDK is a candidate implementation behind the controls. [Widget interaction design review](../explore/reviews/widget-interaction-ui-sdk.md)
- Keep durable queries and mutations on the host action path whether a person clicks or a connector invokes them. Preserve operation identity and operator choices across retries and restarts. Show pending, completed, failed, and unknown outcomes distinctly. Keep transient focus, drafts, and selections in the renderer unless the widget explicitly commits them.
- Give the PC owner control over the lifetime and authority of a surface. Define expiration, cancellation, and pinning. Bind a human decision to the request it resolves. Treat surface creation, durable installation, UI observation, UI operation, screenshots, window geometry, desktop context, packages, and sub-agents as separate capabilities.
- Develop wider capabilities through the complete [permission-layer design](../explore/widget-system/where-we-stand.md#permission-gaps-standingpermission_gaps). The existing loopback endpoint and Cordis authoring workflow serve trusted local development. Hosted access requires device-side grants for discovery, observations, and each effect. Provider reachability, relay selection, remote authoring, and platform rollout remain implementation decisions.

## What a unit brief carries

For new or resumed work that changes attachment, lifecycle, actions, execution, visible data, shared interactions, window authority, startup, update, or packaging, give the implementer and reviewer the unit spec, base revision, and the revision of this direction. State which product rule the unit affects. Older worktrees can read that revision without updating their branch. This applies to an existing session at its next handoff. The unit brief controls which files and behavior the agent may change.

The reviewer checks the affected product rule against the change and its acceptance evidence. An unresolved finding that conflicts with the product direction goes back to the operator for a decision before the unit expands in scope.

## First pilot proposal

Connect a standard MCP client to a running desktop app with one local configuration entry. Ask it to present a small diff review or parameter choice using the built-in catalog. Target under 200 ms for the warm path from the desktop accepting a spawn to an interactive frame. Have the person choose or cancel on the PC. Return that result to the originating agent, with a way to retrieve it after timeout or reconnect. Check that an expired or superseded surface cannot submit a late answer and that disposal clears its session state. Prove pinning separately with an explicit owner action that survives restart. [Ephemeral surface proposal](../explore/reviews/future-of-ui-verdict.md)

[Architecture and decision reviews](../explore/reviews/README.md)
