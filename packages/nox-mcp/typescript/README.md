# @nox/mcp

MCP registration, validation, execution policies and optional desktop bridges for
NoX apps. See the [repository documentation](https://github.com/mapherez/mcp).

Install this package in each app and register that app's tools and handlers.
Importing it starts no service. Execution stays in the app's Node runtime;
remote authentication and bridge adapters are optional. No shared NoX backend
is required. Apps using Rust or Go install the corresponding native library.

Install `zod@^4.6.0` as a peer dependency so application and library schemas use
the same Zod instance. `@nox/mcp` supplies `createServer`, `createHttpHandler`, `McpError` and tool/context
types. `@nox/mcp/contract` is browser-safe. Optional adapters:

- `@nox/mcp/node`: install `@modelcontextprotocol/node` for Node HTTP or stdio.
- `@nox/mcp/bridge/server` and `/client`: install `ws` for WebSocket transport.
- `@nox/mcp/better-auth`: install `@better-auth/mcp` and `better-auth`; provide an
  uncached `isActive` check to enforce revocation on every request.

Handlers receive a deadline and AbortSignal. Check cancellation immediately
before changing data. A completed mutation is not undone by a timeout; never
automatically retry a mutation whose result is unknown. Defaults are 20 seconds,
2 MiB and 32 concurrent executions. Authentication, persistence, tools and domain
rules are supplied by the application.
