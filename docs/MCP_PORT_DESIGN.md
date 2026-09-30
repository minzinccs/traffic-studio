# Local MCP port — implementation and remaining compatibility work

The MCP service is a separate, opt-in endpoint from capture. Capture defaults to `127.0.0.1:8899`; MCP defaults to `127.0.0.1:8890` in its panel. Entering port `0` lets Windows choose a free loopback port, which the panel displays after Start. Neither service listens on LAN by default. MCP is stopped on app shutdown and must be started again by the user.

```text
Desktop UI ── Start(workspace, port, permissions) ──▶ MCP runtime
                                                   ├─ bind 127.0.0.1:<actual-port>
MCP client ── Bearer token + JSON-RPC POST /mcp ───┤
                                                   └─ SQLite, selected workspace only
```

Start requires an existing workspace and explicit permission. The service returns a random bearer token once; status never returns it. Stop revokes the token and closes the listener. The server rejects requests with an Origin header, requires the exact loopback Host and bearer token, accepts at most eight concurrent requests, 120 authenticated requests per minute, 64 KiB JSON bodies and ten seconds per connection. SQLite audit stores operation/outcome, without tokens or arguments.

Current baseline tools are `list_sessions`, `list_flows` and `list_collections`, returning paged, redacted metadata. A separate opt-in `read_flow` permission reads one completed HTTP flow from native proxy capture: common common credential headers and URL query values are redacted, while decoded request/response bodies are limited to 64 KiB each and may still contain secrets. Bodies above the decode limit or with unsupported encoding return an unavailable reason. This is reading traffic already handled by the app's explicit HTTP proxy; it does not intercept or decrypt unrelated machine packets. Another opt-in permission exposes `save_draft` for inert request, collection and rule-set documents with exact revision checks. The service does not send HTTP, apply rules, delete data or change certificate/OS trust. Token, permission and listener are process-local; workspace documents and audit persist.

The native Settings panel shows listener state, endpoint, token-copy action and a sample client JSON configuration. The sample uses a Streamable HTTP URL and bearer header; MCP client configuration syntax differs between clients, and interoperability has not been verified.

The endpoint is stateless Streamable HTTP with JSON responses. It implements `initialize`, `ping`, `tools/list`, `tools/call` and client notifications; notifications return an empty HTTP 202. It negotiates the supported `2025-11-25` and `2025-03-26` versions at initialization, rejects an unsupported explicit version header, and returns HTTP 405 for GET/DELETE because no SSE stream or server-side client sessions exist. A loopback HTTP fixture covers the initialization/notification/tool-list sequence. Server-to-client streaming and broad MCP client interoperability remain unverified. Native UI interaction and a third-party MCP client handshake remain unverified. The target transport and lifecycle requirements are in the [MCP 2025-11-25 transport specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports) and [lifecycle specification](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).
