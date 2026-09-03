# MCP Implementation Checkpoint

Date: 2026-09-03

## Repository State

- Branch: `add_mcp`.
- Current implementation commit: `37b7884` (`feat(mcp): integrate MCP functionality into the application`).
- The branch matched `origin/add_mcp` and the worktree was clean when this checkpoint was updated.
- The approved implementation plan remains in `Documentation/MCP_IMPLEMENTATION_PLAN.md`.

## Current Phase Status

- **Phase 0: complete and validated.**
- **Phase 1: implementation complete and locally validated.**
- **Phase 2: implementation complete and locally validated.**
- **Phases 1-2 external staging gate: pending.** Real Google credentials, a public HTTPS/WSS deployment, and an external MCP client are still required.
- **Phase 3: only the transport-independent dispatcher shell and `notex_status` exist.** Note, block, tag, and collection reads are not implemented yet.
- **Phase 4: not started.**
- **Phase 5: partially completed early.** Backend hardening, Docker, backend CI, GHCR publication, and production URL injection exist; final end-to-end hardening and release validation remain.

The infrastructure can authenticate and connect a running NoteX instance to the backend, but the current desktop dispatcher cannot yet search, read, or mutate local notes. It returns `INTERNAL` for every command except `notex_status`.

## Local-First Safety State

- No NoteX application database migration was added.
- The NoteX SQLite schema remains at version 3.
- MCP authentication data is not stored in the NoteX SQLite database or browser storage.
- The desktop refresh credential and session metadata are stored through Windows Credential Manager.
- Rust and the backend do not write directly to the notes database.
- The backend has a separate SQLite database containing only account, OAuth, client, grant, token, session, signing-key, registration, and desktop-session metadata.
- Presence, WebSocket tickets, pending requests, arguments, results, and note content remain memory-only in the backend.
- Disconnects, backend restarts, and timeouts fail in-flight requests without queueing or replay.
- No existing note, block, tag, collection, attachment, or other local user data was migrated or modified by this work.

## Phase 0 Result

`packages/notex-mcp-contract` is the source of truth for:

- All 11 MCP commands and their Zod input/output schemas.
- Public errors and the `notex:read`, `notex:create`, and `notex:edit` scopes.
- Presence states, protocol version, ticket lifetime, heartbeat, timeout, and no-queue/no-replay policy.
- Direction-specific bridge frame parsers with strict UTF-8/JSON validation and a 2 MiB limit.
- Active/trash/all note locations and optimistic note versions.

Validated result: 1 Vitest file / 8 tests passed, plus clean typecheck and build.

## Phase 1 Result

### Identity and OAuth

- Independent Node.js 24/TypeScript backend in `backend/`, with its own lockfile.
- Better Auth with Google, MCP OAuth Provider, Device Authorization, CIMD, DCR, PKCE S256, resource indicators, refresh rotation, and audience-bound MCP tokens.
- Canonical Google identity uses issuer plus subject; verified email is display metadata only.
- New accounts require a one-use registration intent initiated by `Register` in NoteX.
- Login and MCP OAuth do not create accounts silently.
- A deterministic first-party desktop OAuth client and MCP resource are bootstrapped after backend migrations.
- AI access revocation preserves the first-party desktop grant.
- Remote account deletion removes only backend metadata and never local notes.

### Bridge and Routing

- One-use, 30-second WebSocket tickets.
- One active desktop session and one ready bridge connection per account.
- A new desktop activation invalidates and disconnects the previous session immediately.
- Exact bridge protocol negotiation, heartbeat, 20-second command timeout, strict frame parsing, and no replay.
- Presence and in-flight requests are held only in memory.
- Streamable HTTP MCP exposes all 11 tools from the shared contract and checks each required scope before dispatch.
- The backend distinguishes `USER_NOT_LOGGED_IN` from `NOTEX_OFFLINE`.

### Backend Operations

- Multi-stage Debian slim Docker image using Node 24 and non-root UID/GID 10001.
- Persistent `/data` volume, port 8080, and healthcheck.
- Compose configuration with read-only root filesystem, tmpfs `/tmp`, dropped capabilities, and no-new-privileges.
- Node 24 CI for contract, backend, and Docker.
- GHCR multi-platform publication workflow for `linux/amd64` and `linux/arm64`.
- Deployment and recovery documentation in `Documentation/MCP_BACKEND_OPERATIONS.md` and `backend/README.md`.

## Phase 2 Result

### Backend Support for Native Sessions

- The desktop device-start response includes the OAuth client, token endpoint, MCP resource, and a short-lived activation token.
- Backend-only activation metadata is stored in `notex_desktop_activations`; this is not a NoteX database migration.
- Activation tokens are single-use and cannot reactivate a session after that session has been replaced.
- Activated desktop routes require `X-NoteX-Desktop-Session` and verify that the session is still current.
- Presence and bridge ticket issuance are unavailable to stale or logged-out desktop sessions.

### Tauri/Rust Integration

- Device registration and login open the system browser and poll the OAuth device flow.
- Access tokens remain in memory; refresh credentials persist in Windows Credential Manager.
- Stored backend endpoints and bridge URLs are constrained to the configured backend origin.
- Production builds require the compile-time `NOTEX_MCP_BACKEND_URL` HTTPS origin.
- Startup refreshes the credential, verifies the current desktop session, obtains a one-use bridge ticket, and opens WSS.
- The bridge sends `ready` only after the NoteX stores and renderer dispatcher are initialized.
- WebSocket reconnect uses fresh tickets and never replays commands.
- Session replacement, logout, invalid refresh credentials, cancellation, and secure-storage failures clean up local/remote state defensively.
- Tauri events carry requests and public connection state between Rust and the renderer.

### Renderer and UI

- `App.tsx` starts MCP only after the existing SQLite, settings, knowledge, and notes bootstrap completes.
- `src/core/services/mcpBridge.ts` installs event listeners before native initialization and drops responses after disconnection.
- `src/core/mcp/dispatcher.ts` is independent of transport, enforces deadlines, and currently implements only `notex_status`.
- The Zustand MCP store is transient and does not persist tokens or account state.
- Profile includes Register, Login, Cancel, Logout, Revoke AI access, and Delete MCP account states.
- Revocation and account deletion use confirmation modals; their copy explicitly preserves local notes.
- The sidebar shows green `Online` only after bridge readiness and red `Offline` for every other state.
- MCP UI text exists in Portuguese and English.

## Validation Completed

### Contract and Backend

```text
npm run typecheck
npm test
npm run build
npm audit --audit-level=moderate
```

- Contract: 1 Vitest file / 8 tests passed.
- Backend: 7 Vitest files / 33 tests passed.
- Backend and contract production builds passed.
- Backend and contract audits reported 0 vulnerabilities at the time of validation.
- Compiled backend smoke tests returned health, RFC 8414, and RFC 9728 metadata.
- Real-network WebSocket tests covered routing, ticket replay rejection, Origin rejection, and in-flight disconnect failure.

### Tauri and Frontend

```text
cargo test --manifest-path src-tauri/Cargo.toml
npm run typecheck
npm run check:styles
npm run build
```

- Rust: 6 tests passed, including endpoint restrictions and bridge frame validation.
- Frontend typecheck, style checks, and production build passed.
- Profile/sidebar were inspected in PT/EN, dark/light, and desktop/mobile viewports using a local Tauri IPC mock.
- The visual run had no application console errors; only the existing React Router warnings were present.

### Docker

- The `linux/amd64` image built and ran successfully under Node 24.
- The container ran as UID/GID 10001 and became healthy.
- `better-sqlite3` loaded successfully with the read-only root filesystem configuration.
- Runtime SQLite inspection found only Better Auth and `notex_` metadata tables.
- Local `linux/arm64` execution was unavailable because Docker Desktop lacked an arm64 binfmt/QEMU handler; the publication workflow installs QEMU for the multi-platform build.

## External Staging Gate

The following checks require deployment inputs that are not present in the repository:

1. Select and deploy the public HTTPS/WSS backend origin.
2. Configure a real Google OAuth web client and exact callback URL.
3. Configure backend secrets, persistent `/data`, reverse-proxy TLS, Host/Origin allowlists, and health monitoring.
4. Set the GitHub repository variable `NOTEX_MCP_BACKEND_URL` before producing a desktop release.
5. Validate Register for a new account, Register for an existing account, Login for an existing account, and Login rejection for an unknown account.
6. Validate callback continuation, device polling, refresh rotation, restart, logout, AI revocation, account deletion, and immediate desktop-session replacement.
7. Connect MCP Inspector or another external client through CIMD/DCR and PKCE.
8. Confirm offline, logged-out, backend-restart, and interrupted-socket behavior without queueing or replay.

No production secret or authentication bypass should be committed to avoid this gate.

## Remaining Implementation

### Phase 3: Local Reads

- Extract the current global note search into a shared function used by both UI and MCP.
- Connect the dispatcher to `useNotesStore.getState()` and `useKnowledgeStore.getState()`.
- Implement `search_notes`, `get_note`, `get_note_block`, `list_tags`, and `list_collections`.
- Return both plain text and supported rich HTML without exposing Tiptap JSON.
- Include active and trashed notes according to `location`; mark trashed notes and blocks read-only.
- Add focused dispatcher/search tests covering ordering, limits, accents, active/trash/all, missing IDs, and deadlines.
- Validate the read-only flow against a real copy of a schema-v3 NoteX database.

### Phase 4: Writes and Rich Text

- Extract shared inline/full Tiptap extension factories.
- Parse and sanitize `{ format: "text" | "html", value }` with the same editor schema.
- Reject scripts, unsafe protocols, images, files, and unsupported nodes.
- Add a per-note coordinator for debounced saves, saves in progress, and local dirty drafts.
- Enforce `expectedVersion` on every mutation and return typed conflicts.
- Implement `create_note`, `update_note_header`, `add_note_block`, `update_note_block`, and `set_note_tags` through existing stores/repository behavior.
- Make note-plus-block creation one local SQLite transaction.
- Reject every write to trashed notes.
- Add rich-text, transaction, conflict, dirty-draft, disconnect, and two-client tests.

### Phase 5: Final Hardening and Release

- Add a dedicated frontend/Rust CI workflow; current MCP CI covers only contract, backend, and Docker.
- Complete SSRF/CIMD and authorization abuse tests against the deployed environment.
- Run the full schema-v3 before/after compatibility fixture and assert unchanged tables, columns, schema version, and existing rows.
- Exercise all 11 tools through the official MCP Inspector over public HTTPS/WSS.
- Validate compatible custom remote MCP clients without platform-specific backend code.
- Publish the backend image and signed NoteX desktop build only after the external gate passes.

## Exact Resume Sequence

1. Run `git status --short` and confirm this checkpoint still matches the branch.
2. Implement the shared search utility and refactor the existing SearchBox to use it.
3. Implement and test the five missing Phase 3 read commands in the local dispatcher.
4. Run frontend typecheck, style checks, build, Rust tests, backend tests, and contract tests.
5. Create the schema-v3 read-only compatibility fixture.
6. Deploy staging and complete the real Google/MCP read-only path before starting writes.
7. Implement Phase 4 writes and rich-text handling.
8. Complete the remaining Phase 5 release gates.
