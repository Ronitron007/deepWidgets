# MCP consent `mcp_consent`

This spec makes the MCP endpoint safe. An agent gets access only after the operator approves it in the app. The approval travels through a channel that no other local process can forge. The decision is `widget.mcp_consent` in `docs/explore/widget-system/where-we-stand.md`.

## Scope `mcp_consent.scope`

- In the MVP, the endpoint is the only security work. An approved agent can call every tool and do every action.

- This spec protects against these players:

  - a web page in a browser

  - a local process that the operator did not approve

  - another user account on the same computer

  - a process that takes the port after the host stops

  - a token after the operator revokes it, or after it expires

- This spec does not protect against malware that runs as the operator's user with full file access.

## Today `mcp_consent.today`

`POST /mcp/token` gives a token to each loopback caller. The nonce in `mcp.json` proves the server to the client. Nothing proves the client to the operator. This spec removes `POST /mcp/token`.

## Flow `mcp_consent.flow`

The host is the OAuth 2.1 authorization server and the resource server, on the loopback address. The flow is the MCP authorization flow, so a client with MCP OAuth support needs no change.

1. A request to `/mcp` with no valid token gets 401. The answer names the protected resource metadata.

2. The client reads the protected resource metadata and the authorization server metadata from the host.

3. The client registers with dynamic client registration and gets a client ID.

4. The client opens the authorization URL with a PKCE S256 challenge and a loopback redirect URI.

5. The host shows the browser page "Approve in the deepWidgets app" and a match code of 6 characters. The page has no approve button.

6. Electron main shows a native consent dialog. The dialog shows the client name, the redirect URI, and the same match code. It has the buttons Allow and Deny.

7. On Allow, the host redirects with an authorization code. The client exchanges the code and the PKCE verifier for an access token and a refresh token.

8. On Deny, or when the dialog is closed, the host redirects with `access_denied`.

A local process can drive a browser page. It can not click a native dialog without the macOS Accessibility permission. Thus the approval comes from the operator.

## Tokens `mcp_consent.tokens`

- An access token is valid for 1 hour. A refresh token is valid for 30 days, and each use replaces it.

- The host stores only the hash of each token.

- An approval stays until the operator revokes it. A revoke makes each token of that client fail at once.

- The client ID names the agent. `widget_changes` shows that name.

## Agents list `mcp_consent.agents`

The main window shows each approved agent: its name, the time of approval, and the time of last use. Each row has a Revoke button.

## Bridge `mcp_consent.bridge`

The stdio bridge moves into `@deepwidgets/mcp` as a `bin`. It runs the same flow and keeps the refresh token in the macOS Keychain. It never writes a token to a config file. Before it sends a refresh token, it checks the server with the nonce proof of `mcp.json`.

## Fence `mcp_consent.fence`

The fence of `widget_mvp.mcp` stays. The host still refuses a request with an `Origin` header or a `Sec-Fetch-Site` header, a request whose `Host` is not loopback, and a request from a socket peer that is not loopback. The authorization pages accept `Origin` only from the host's own loopback origin.

## Provisional choices `mcp_consent.provisional`

The operator has not decided these items. A later decision can change each one.

| Item | Choice |
|---|---|
| Access token life | 1 hour |
| Refresh token life | 30 days, replaced at each use |
| Approval life | Until revoke |
| Consent place | A native Electron dialog |

## Spikes `mcp_consent.spikes`

| Name | Question | Blocks |
|---|---|---|
| `mcp_consent.spikes.clients` | Does Claude Code complete the MCP OAuth flow against a loopback authorization server with dynamic client registration? Which MCP SDK parts can the host use for the authorization server? | `mcp.consent_server` |
