# NoteX MCP Architecture

## Invariants

- Note content remains persisted only in the existing local NoteX SQLite database.
- The NoteX database schema and schema version are not changed by MCP support.
- The hosted service stores identity, authorization, and connection metadata only.
- Tool arguments and results may pass through the hosted service in memory, but are never persisted, indexed, queued, or logged.
- A tool request is executed only while an authenticated NoteX desktop is connected and ready. Disconnects and timeouts fail the request without replay.
- The backend never writes to the NoteX database. All local reads and writes use the renderer command layer and the existing Zustand stores/repository.

## Trust Boundaries

1. An AI platform is an untrusted OAuth client and MCP caller.
2. The hosted backend authenticates the caller, checks scopes, and routes a request to one user connection.
3. The Rust/Tauri bridge owns desktop credentials and the remote WebSocket.
4. The renderer validates the command again before invoking local application logic.
5. SQLite remains reachable only through the existing local Tauri storage commands.

Google identifies people to the hosted backend. It does not authorize access to Google data. The backend keys an account by the Google issuer and subject; verified email is display metadata.

## Threat Model

### Protected assets

- Local note content and organization metadata.
- OAuth grants, refresh tokens, desktop credentials, and WebSocket tickets.
- Correct association between one authenticated AI caller and one registered NoteX account.
- The integrity of local note mutations and their optimistic versions.

### Threats and mandatory controls

| Threat | Mandatory control |
| --- | --- |
| Cross-account routing or email reassignment | Route by the stable identity mapping `Google issuer + subject`; email is display metadata only. Never route by email alone. |
| An AI client creates a NoteX account implicitly | A new account requires a short-lived registration intent created by `Register account` in NoteX Desktop. Normal MCP OAuth and desktop Login cannot create it. |
| Stolen or replayed bridge ticket | Tickets are cryptographically random, expire after 30 seconds, are stored only in memory, and are consumed exactly once. |
| Delayed or duplicated local mutation | Every request carries a UUID and deadline. There is no queue or replay; disconnect, timeout, logout, replacement, or restart fails in-flight work. Existing-note mutations additionally require `expectedVersion`. |
| Oversized, malformed, or wrong-direction WebSocket input | Both peers enforce the 2 MiB byte limit, strict UTF-8/JSON decoding, direction-specific Zod schemas, and the exact bridge protocol version before dispatch. |
| Scope escalation by an OAuth client | Access tokens are audience-bound to the canonical MCP resource and each tool checks its required `notex:read`, `notex:create`, or `notex:edit` scope. The private desktop scope is not available through public client registration. |
| SSRF through Client ID Metadata Documents | CIMD retrieval uses the Node transport that resolves once, rejects special/private addresses, pins the approved address, and refuses redirects. |
| Rich-text script, file, or unsafe URL injection | MCP rich text is parsed by the same Tiptap schema as the editor and sanitized before any store mutation. Unsupported nodes, images, files, scripts, and unsafe protocols are rejected or removed. |
| Backend or log retention of note data | Request arguments, results, bridge frames, note identifiers, titles, email addresses, and query strings are excluded from logs and persistent backend storage. |
| Direct remote access to the NoteX SQLite file | Only the local renderer command layer may invoke the existing stores/repository. Rust and the hosted backend never issue note SQL. |

### Accepted exposure and assumptions

- Note content explicitly requested by a tool can transit the backend process and the selected AI platform in memory. The user accepts the AI platform's own data policy when authorizing it.
- TLS is mandatory outside loopback development and terminates at the deployment reverse proxy.
- A compromised local operating system, a compromised AI provider, and deliberate data sharing by the user are outside the backend's trust boundary.
- Horizontal backend scaling is outside the MVP; a future shared presence router must preserve the same no-queue and no-replay semantics.

## Data Retention

The backend SQLite database may contain users, OAuth clients, grants, tokens, signing keys, desktop sessions, and migrations. It must not contain note IDs, titles, content, tags, collections, tool arguments, tool results, or pending work.

Operational logs may include a generated request ID, tool name, duration, outcome code, and a non-reversible account identifier. Logging middleware must redact request and response bodies, authorization headers, cookies, query strings, email addresses, and bridge frames.

## Availability Semantics

- No valid desktop session: `USER_NOT_LOGGED_IN` / `User not logged in`.
- Valid desktop session without a ready live connection: `NOTEX_OFFLINE` / `NoteX is offline`.
- A disconnected in-flight request fails immediately.
- Reconnection never retries an earlier request.
- Only the most recently authenticated desktop session for an account remains valid.

The fixed bridge delivery policy is `queue: none`, `replay: never`, `disconnect: fail-in-flight`, and `ticketUse: single-use`. A new connection starts as offline/connecting and becomes online only after authentication, exact protocol negotiation, application bootstrap, and `ready`.

Detailed desktop/UI presence states are `logged_out`, `offline`, `connecting`, `online`, and `error`. The public MCP availability result remains intentionally narrower: `logged_out`, `offline`, or `online`.

## Versioning

The desktop bridge protocol is versioned independently from MCP. Both peers must use the exact `BRIDGE_PROTOCOL_VERSION` from `@notex/mcp-contract`; incompatible clients stay offline instead of attempting a partial command.

## Implementation Guardrails

- The contract package is the source of truth for commands, schemas, errors, presence, limits, and delivery policy. Backend and desktop code must not redefine these values independently.
- Bridge payloads are validated once on receipt and command inputs/results are validated again at the dispatcher boundary.
- No transport may retain a request for later delivery. Reconnection creates a new execution opportunity; it never resumes an earlier request.
- No NoteX database schema change is permitted for MCP. Backend migrations target only the independent backend database.
- Before any future editor implementation, reread audit `16` from commit `8f86a62`. CSS work remains governed by audit `99` from commit `617bf8a`. MCP work must not include editor selector, TOC, CSS ownership, or redesign changes.

## Phase 0 Gate

Phase 0 is complete when the shared contract typechecks/builds, its contract tests pass once from source, no test files are emitted to `dist`, this threat model is recorded, and all architecture invariants above are explicit. The completed validation is recorded in `MCP_IMPLEMENTATION_CHECKPOINT.md`.
