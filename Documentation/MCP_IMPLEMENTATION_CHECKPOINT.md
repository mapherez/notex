# MCP Implementation Checkpoint

Date: 2026-09-02

## Current Phase Status

- **Phase 0: complete and validated.**
- **Phase 1: implementation complete and locally validated.**
- **Phase 1 external staging gate:** pending real Google credentials and an external MCP client/Inspector.
- **Phases 2-5 application integration:** not started.

This is the restart point for the next session. The backend is no longer an unvalidated scaffold, but it is not a production deployment until the external staging gate passes.

## Repository Safety State

- No NoteX application database migration was added.
- The existing NoteX SQLite schema/version 3 was not changed or opened by backend code or tests.
- No existing note, block, tag, collection, attachment, or other local user data was modified.
- No frontend, Tauri/Rust, CSS, editor, Profile, sidebar, or translation file has been changed for MCP yet.
- Existing user files `Documentation/MCP_IMPLEMENTATION_PLAN.md` and `_IMPROVEMENTS.txt` were left untouched.

## Phase 0 Result

`packages/notex-mcp-contract` remains the source of truth for:

- All 11 MCP commands and their Zod input/output schemas.
- Public errors, scopes, detailed presence, protocol version, ticket/heartbeat/timeout limits, and no-queue/no-replay policy.
- Direction-specific bridge frame parsers with strict UTF-8/JSON validation and a 2 MiB limit.

Validated result: 1 Vitest file / 8 tests passed, plus clean typecheck and build.

## Phase 1 Completed

### Backend identity and OAuth

- Independent Node.js 24/TypeScript backend in `backend/` with its own lockfile.
- Better Auth with Google, MCP OAuth Provider, OAuth Device Authorization, CIMD, DCR, PKCE S256, resource indicators, refresh rotation, and audience-bound MCP tokens.
- Canonical Google identity uses issuer plus subject; verified email is display metadata only.
- New Better Auth users require a one-use registration intent created by NoteX Register. Login/MCP OAuth cannot create an account silently.
- Deterministic first-party native desktop OAuth client and MCP resource bootstrap after migrations.
- AI access revocation preserves the first-party desktop grant. Remote account deletion removes only backend/Better Auth metadata.
- Better Auth's own logger is disabled; application logging is structured and redacted.

### Backend persistence

- Custom tables store only account registration, desktop-session, settings, and migration metadata.
- Better Auth tables store users, sessions, OAuth clients/grants/tokens/resources, device codes, and signing keys.
- Presence, bridge tickets, pending requests, arguments, results, and note data are memory-only.
- Tests assert that no note-content tables or fields exist in the backend database.

### Bridge and MCP

- One-use 30-second WebSocket tickets and one ready desktop connection per account.
- Exact bridge protocol negotiation, strict shared frame parsing, heartbeat, 20-second timeout, replacement, logout, disconnect, and no replay.
- Real-network WebSocket integration covers routing, ticket replay rejection, Origin rejection, and in-flight disconnect failure.
- Streamable HTTP MCP supports the modern `2026-07-28` `server/discover` envelope and stateless 2025 clients.
- All 11 tools are registered from the shared contract. Every invocation checks its read/create/edit scope before bridge dispatch.
- Invalid schemas become public `INVALID_INPUT`; unexpected failures do not expose implementation details.

### Operations

- Multi-stage Debian slim Dockerfile with Node 24, non-root UID/GID 10001, `/data`, port 8080, and healthcheck.
- Compose configuration uses a named data volume, read-only root filesystem, tmpfs `/tmp`, dropped capabilities, and no-new-privileges.
- Separate Node 24 CI for contract/backend/Docker and GHCR multi-arch publication workflow for `linux/amd64` and `linux/arm64`.
- Deployment and recovery documentation in `Documentation/MCP_BACKEND_OPERATIONS.md` and `backend/README.md`.

## Validation Completed

Backend validation:

```text
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

Result:

- TypeScript source and test typechecks passed.
- 7 Vitest files / 33 tests passed.
- Production build passed.
- Backend and contract audits reported 0 vulnerabilities.
- Compiled backend smoke test returned health, RFC 8414, and RFC 9728 metadata correctly.

Docker validation:

- `linux/amd64` image built successfully under Node 24.
- Container ran with a read-only root filesystem, temporary `/data`, and `better-sqlite3` loaded successfully.
- Runtime identity was UID/GID 10001 and Docker health status became healthy.
- Runtime SQLite contained only Better Auth and `notex_` metadata tables.
- Local `linux/arm64` execution was not available because Docker Desktop had no arm64 binfmt/QEMU handler. The publication workflow installs QEMU before its two-platform Buildx build.

## External Staging Gate

These checks require deployment inputs that are not present in the repository:

1. Configure a real Google OAuth web client and callback URL.
2. Run Register for a new Google account, Login for an existing account, and rejection for an unregistered account.
3. Verify browser callback, consent continuation, device polling, refresh rotation, logout, AI revocation, and account deletion against the hosted URL.
4. Connect MCP Inspector or another external MCP client through CIMD/DCR and PKCE.
5. Execute `notex_status` and a read tool through the CLI desktop simulator over public HTTPS/WSS.

No production secret or fake bypass should be added to avoid this gate.

## Exact Resume Sequence

1. Review `git status --short` because all MCP changes remain uncommitted and the user may have edited files.
2. If staging credentials/domain are available, run the external staging gate above before changing the desktop app.
3. Begin Phase 2 in Rust/Tauri: secure refresh-token storage, device flow, token refresh, desktop session activation, WSS lifecycle, and renderer events.
4. Add the renderer MCP state/dispatcher only after the existing `App.tsx` bootstrap is complete; send bridge `ready` only after dispatcher readiness.
5. Add the Profile/sidebar MCP UI and PT/EN states without changing NoteX SQLite schema v3.
6. Deliver Phase 3 reads end to end before beginning rich-text writes.

## Work Not Started

- Windows Credential Manager integration and Tauri OAuth/WSS commands.
- Renderer transport state and transport-independent local dispatcher.
- Shared UI/MCP note search extraction.
- Profile/sidebar MCP controls and translations.
- Local reads from existing stores/repository.
- Dirty-note/save coordinator, optimistic version enforcement, shared Tiptap factories, sanitization, and local writes.
- Schema-v3 compatibility fixture against a copy of an existing NoteX database.
