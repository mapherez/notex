# NoX MCP

Native MCP infrastructure for NoX applications. MIT licensed. No note, editor,
database, Google identity or Tauri dependency belongs to the core.

Each NoX app installs the library for its own language, imports it and supplies
its own tools and handlers. The MCP implementation runs within that app's
runtime. Installing or importing the library does not start a process, bind a
port, create a database or connect to a backend.

NoX MCP is a dependency, not a separately deployed NoX service. Its HTTP, stdio,
authentication and bridge adapters are explicit opt-ins. Apps executing locally
do not need a remote backend. NoteX's existing remote authentication/bridge
backend is an application-specific integration and is not a prerequisite for
installing or using these libraries in another app.

| Library | Install after publication | Runtime |
| --- | --- | --- |
| TypeScript | `npm install @nox/mcp` | Node 24+ |
| Rust | `cargo add nox-mcp` | Rust 1.88+ |
| Go | `go get github.com/mapherez/mcp/go@v0.1.0` | Go 1.26+ |

The libraries build on the official TypeScript and Go SDKs and `rmcp`. They share
JSON Schema contracts and conformance fixtures, rather than sharing a process or
requiring Go/Rust applications to install Node. The desktop gateway is initially
TypeScript; applications executing tools directly do not need that gateway.

## TypeScript

```ts
import { z } from 'zod';
import { createServer } from '@nox/mcp';
import { serveStdio } from '@nox/mcp/node';

const schema = z.object({ message: z.string().max(200) });
await serveStdio(createServer({
  appId: 'echo', name: 'NoX Echo', version: '0.1.0',
  tools: [{
    name: 'echo', description: 'Echo a message',
    inputSchema: schema, outputSchema: schema,
    annotations: { readOnlyHint: true },
    execute: async (input, context) => {
      context.signal.throwIfAborted();
      return input as { message: string };
    },
  }],
}));
```

Install `@modelcontextprotocol/node` for `@nox/mcp/node`, `ws` for the bridge
transport, and `zod@^4.6.0` as the required schema peer dependency. Install
`@better-auth/mcp`/`better-auth` for the optional Better Auth
adapter. None of those is imported by the browser-safe `@nox/mcp/contract` entry.
`createHttpHandler` supplies Streamable HTTP; `toNodeHandler` adapts it to Node
HTTP or Express. Configure `resolveAuth` with verified authentication supplied by
your middleware. An unauthenticated server can expose tools without scopes for
local use; a remote server must wrap its route with authentication.

`ToolDefinition` declares input/output Zod schemas, required scopes, annotations
and a handler. `ExecutionContext` supplies request/app/user IDs, scopes, deadline
and an AbortSignal. Public errors are `McpError(code, message, retryable, details)`;
unrecognized exceptions are sanitized. An optional `formatError` preserves an
application's existing error contract.

## Go

Run the native example without Node:

```sh
cd go
go run ./examples/echo          # stdio
go run ./examples/echo http     # loopback HTTP on port 8089
```

`New(Options)` compiles JSON Schemas and registers native SDK tools. `Execute`
validates scopes, inputs and outputs; handlers receive an `ExecutionContext`.
Call `CheckActive()` immediately before a mutation after asynchronous work.
`ServeStdio`, `HTTPHandler`, `Protect`, `JWTVerifier`, and `RunBridge` are native
Go APIs. `Protect` requires both a trusted cryptographic verifier and an uncached
live authorization check. `JWTVerifier` requires issuer, audience and a trusted
key function; key URLs from untrusted token headers are never used.

## Rust

Run the native example with `cd rust && cargo run --example echo` (stdio).

`load_tools` loads a JSON manifest of any catalog size and includes output
schemas. `McpServer<E>` implements `rmcp::ServerHandler` with an app-provided
`Executor`. Use `rmcp` stdio or Streamable HTTP transports directly.
`RequestBroker<T>` bridges to an external executor through an injected emit
callback; `BrokerOptions` configures prefix, timeout, size and concurrency limits.
`ExecutionRegistry` invalidates work by connection generation and deadline.
`CredentialStore<T>` leaves secure credential storage to an OS/app adapter.
There is no Tauri dependency in the crate. The NoteX adapter preserves its event
names, commands and Windows keyring identifiers.

## Desktop bridge

`@nox/mcp/bridge` contains a registry with an injected session store and input/
output parsers. `@nox/mcp/bridge/server` installs a WebSocket gateway with explicit
host/origin allowlists. `@nox/mcp/bridge/client` and Go `RunBridge` connect an
executor. Tickets are single-use and short-lived. Get a fresh ticket before
reconnecting; never retry authentication with an old ticket.

There is one active desktop connection per user in each app's registry. Keep
separate registries/session stores for separate apps. No payloads or credentials
are logged by the core; request payloads/results only live in process memory.
The core never persists bridge data. Implementations of injected adapters must
follow the same rules. The gateway logger accepts only fixed lifecycle events.

Defaults: bridge v2.0, manifest v1, 20 seconds, 2 MiB UTF-8 payload, 32 in-flight
requests, 30-second tickets, 15-second heartbeats and 45-second offline cutoff.
The gateway accepts v1 and v2 readiness during migration, sends cancel frames only
to v2, and never queues or replays work. A v1 client cannot receive explicit
cancellation; deadlines and disconnects still bound pending gateway calls. Do
not claim v2 cancellation guarantees for old desktops.

Cancellation is cooperative. Check validity before committing changes. A completed
transaction is never rolled back by a timeout. After delivery, timeout/cancellation
or disconnection can mean an unknown outcome; mutations must not be automatically
retried. The library does not promise exactly-once execution. If the business
domain needs idempotency, implement an app-level transaction/idempotency key.

## Authentication and portability

Authorization servers issue tokens; the core verifies requests and tool scopes.
Apps own identity, grants and revocation independently. There is no NoX SSO here.
The Better Auth adapter requires `isActive` on every authenticated request.
Removing a database grant does not invalidate a signed JWT by itself; retain a
revocation watermark or equivalent until all earlier tokens expire. Use a
canonical audience unique to each app, trusted JWKS, issuer and token expiry.

| Area | Windows | macOS / Linux |
| --- | --- | --- |
| TS, Go and Rust cores | Supported | Supported |
| NoteX remote credential adapter | Windows keyring | Explicit unsupported-storage error |
| Custom credential adapters | Injectable | Injectable |

JSON Schema is the cross-language interchange format (draft-07 for generated
contracts). Schema validation does not implicitly apply defaults, strip unknown
properties, normalize text, or execute Zod refinements. If apps need those
behaviors, implement them explicitly and add common fixtures. The NoX fixtures
test validation decisions and lifecycle rules; NoteX's rich text, version checks,
trash and local-edit coordination remain app-specific.

## Development and release

```sh
npm ci --prefix typescript
npm run build --prefix typescript
node scripts/generate.mjs
npm test --prefix typescript
cd go && go test ./... && go vet ./...
cd ../rust && cargo test --locked && cargo package --locked
```

`scripts/generate.mjs --check` rejects drift in schemas, defaults and per-language
fixture copies. Standalone CI covers all three languages. Publish workflow needs
an npm token permitted to publish `@nox/mcp` and a crates.io token for `nox-mcp`.
Go versions are tags in the repository root: `go/v0.1.0` for this submodule.
Registry namespace ownership and credentials must be configured before publishing.

While embedded in NoteX, source is at `packages/nox-mcp`. Export only that
directory into the standalone repository. NoteX currently uses local path
dependencies to keep the migration runnable before publication. After the release
passes standalone CI, replace those dependencies with pinned released versions.

See [UPLOAD.md](UPLOAD.md) for the clean export, repository URL configuration,
GitHub upload and package publication. The repository path shown above is an
initial value and must be configured for your prepared repository before release.

Distributed session stores, multiple active desktops, SSO, and other language
adapters are outside v0.1. New adapters must pass the shared fixtures and relevant
execution lifecycle tests; existing libraries do not need to be rewritten.
