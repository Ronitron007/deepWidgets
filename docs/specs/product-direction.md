# Product direction

deepWidgets gives people desktop widgets that live on their PC. A person can use a compatible model-provider app or agent from anywhere to reach a selected PC through deepWidgets' MCP connection. The person who controls that PC chooses which widgets the connection may see and what it may do. The same widget can serve several providers under separate grants. The PC owner can inspect and revoke those grants in deepWidgets.

For example, a person can ask an agent on their phone to add an item to the Grocery widget on their PC and see the change on the desktop. The person can then revoke that connector in deepWidgets. A different provider can still use the widget if it has its own grant. Widgets remain usable locally while the PC is offline.

## What this means for development

- Keep the widget action contract provider-neutral. Adapters can handle each app's connection requirements. Verify what each app supports before promising compatibility.
- Make the target PC, connector, widget, and permitted actions clear when the user gives consent. The PC owner can see, pause, and revoke remote access.
- Treat widget operation, screenshots, window control, and introducing code or dependencies as distinct capabilities. An agreement to share one capability grants only that capability.
- Preserve operator choices through restart, replacement, and connector loss. Report when live state or an operation outcome is unknown.
- The current loopback MCP endpoint and Cordis authoring workflow serve local development. Remote permissions and extension authority belong in the complete [permission-layer design](../explore/widget-system/where-we-stand.md#permission-gaps-standingpermission_gaps). Hosting, relay selection, supported platform order, and remote authoring are open implementation decisions.

## What a unit brief carries

For new or resumed work that changes connector access, actions, execution, visible data, window authority, startup, update, or packaging, give the implementer and reviewer the unit's spec, base revision, and the revision of this direction. State which product rule the unit affects. Older worktrees can read that revision without updating their branch. This applies to an existing session at its next handoff. The unit brief controls which files and behavior the agent may change.

The reviewer checks the affected product rule against the change and its acceptance evidence. An unresolved finding that conflicts with the product direction goes back to the operator for a decision before the unit expands in scope.

## First pilot proposal

Grant two different clients different rights to one trusted widget on one PC. Use one hosted provider and an independent MCP client. Verify a useful update on the desktop, revoke one client during a host restart, and verify that retrying the same operation after a lost response applies the write once. The product direction above is the goal. This pilot is a proposed way to test it.

[Architecture and decision reviews](../explore/reviews/README.md)
