# Plan for MCP consent `mcp_consent.plan`

This plan implements `docs/specs/mcp-consent.md`. The process is `widget_mvp.plan.process`.

## Units `mcp_consent.plan.units`

| Unit | Change | Check | Mutant that must fail the check | Needs |
|---|---|---|---|---|
| `mcp.consent_server` | The OAuth endpoints, the metadata, client registration, the token store, and token checks on `/mcp` (`mcp_consent.flow`, `mcp_consent.tokens`). Remove `POST /mcp/token`. | A script runs the full flow against a host with a test consent provider. A request with no token gets 401. A revoked token gets 401. A wrong PKCE verifier gets refused. | A token is issued with no consent: the no-consent check fails. | `mcp_consent.spikes.clients` |
| `mcp.consent_dialog` | The native consent dialog in Electron main, and the match code (`mcp_consent.flow` steps 5 to 8). | A smoke flag starts the flow, finds the dialog, checks that the code in the dialog equals the code on the page, clicks Allow, and gets a token. A second run clicks Deny and gets `access_denied`. | The browser page approves by itself: the Deny run gets a token. | `mcp.consent_server` |
| `mcp.agents_list` | The agents list in the Settings tab of the main widget, with Revoke (`mcp_consent.agents`, `main_widget.settings`). | The smoke approves an agent, finds its row, clicks Revoke, and gets 401 on the next call. | Revoke removes the row only: the next call works. | `mcp.consent_dialog`, `main.settings` |
| `mcp.bridge` | The stdio bridge in `@deepwidgets/mcp`, with the Keychain (`mcp_consent.bridge`). | The bridge connects, the operator approves once, and the bridge reconnects after a host restart with no second approval. A fake server on the port gets no refresh token. | Nonce check off: the fake server gets the refresh token. | `mcp.consent_dialog` |
