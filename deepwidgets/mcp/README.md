# `@deepwidgets/mcp` `mcp_readme`

This package is the MCP server for widgets. An agent uses it to read and change the widgets of the desktop app. The server is a route on the web server of the host. The host is the Node process that runs the plugins.

## Port setting `mcp_readme.port`

The desktop app binds a fixed port. The default port is 47615.

To use a different port, set `DEEPWIDGETS_MCP_PORT`:

- Put the line `DEEPWIDGETS_MCP_PORT=<port>` in `$DSH_HOME/.env`.

- Or set `DEEPWIDGETS_MCP_PORT` in the environment that starts the app.

The value is an integer from 0 to 65535. The value `0` lets the operating system select a free port. A value that is not a port stops the app with an error.

If a different process uses the port, the app does not start. The app shows an error with `listen EADDRINUSE`. To run a second app at the same time, set `DEEPWIDGETS_MCP_PORT=0` for that app.

## Port file `mcp_readme.port_file`

The host writes the file `$DSH_HOME/deepwidgets/mcp.json`. The file has mode 0600, so only your user can read it. The content is:

```json
{ "port": 47615, "nonce": "<random text>", "pid": 12345 }
```

- `port` is the port of the server.

- `nonce` is a random secret. The host makes a new nonce each time that it starts. The nonce never leaves the file.

- `pid` is the process ID of the host.

The host does not replace a file whose host process is alive. The host removes its file when it stops. The desktop app removes the file when its host stops unexpectedly or fails to start.

## Token handshake `mcp_readme.handshake`

Before you send a token to a server, make sure that the server is the host. Another process can use the port after the host stops.

1. Read `port` and `nonce` from `$DSH_HOME/deepwidgets/mcp.json`.

2. Make a challenge: at least 16 random bytes, as base64url or hex text.

3. Send `POST http://127.0.0.1:<port>/mcp/token` with the JSON body `{ "agent": "<your name>", "challenge": "<challenge>" }`.

4. The answer is `{ "token", "agentId", "proof" }`.

5. Calculate HMAC-SHA256 of the challenge text. Use the nonce text as the key. Write the result as lowercase hex.

6. If your result is not equal to `proof`, stop. Do not use the token. Do not send any data to the server.

7. If your result is equal to `proof`, use the token. Send it in the header `Authorization: Bearer <token>` on each request to `http://127.0.0.1:<port>/mcp`.

A shell example of the proof calculation:

```bash
printf '%s' "$challenge" | openssl dgst -sha256 -hmac "$nonce" -r | cut -d' ' -f1
```

The token stays valid after a host restart. The host keeps the 64 newest tokens.

## Tools `mcp_readme.tools`

| Tool | Use |
|---|---|
| `widget_list` | Gives the live widgets and a cursor for `widget_changes`. |
| `widget_describe` | Gives the actions of one widget, the argument schemas, and the state. |
| `widget_call` | Runs one action. For a change, send a new `requestId`. |
| `widget_changes` | Gives the changes after a cursor. |

Each tool error gives `code`, `message`, and `nextStep`.

## Limits `mcp_readme.limits`

- The server accepts only requests from this computer (loopback addresses). It refuses browser requests.

- The handshake does not protect against a process of your own user. That process can read `mcp.json`.
