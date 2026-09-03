# MCP Implementation Checkpoint

Date: 2026-09-03

## Repository State

- Branch: `add_mcp`.
- Baseline implementation commit: `37b7884` (`feat(mcp): integrate MCP functionality into the application`).
- The Phase 3 implementation described below is present as uncommitted worktree changes on top of that commit and must not be discarded.
- The approved implementation plan remains in `Documentation/MCP_IMPLEMENTATION_PLAN.md`.

## Current Phase Status

- **Phase 0: complete and validated.**
- **Phase 1: implementation complete and locally validated.**
- **Phase 2: implementation complete and locally validated.**
- **Phase 3: implementation complete and locally validated.** All six read/status commands are connected to the current renderer stores.
- **Phases 1-3 external staging gate: pending.** Real Google credentials, a public HTTPS/WSS deployment, a running desktop app, and an external MCP client are still required.
- **Phase 4: writes not started.** The shared Tiptap factories and read-side rich-text serializer were completed early as Phase 3 prerequisites.
- **Phase 5: partially completed early.** Backend hardening, Docker, backend CI, GHCR publication, and production URL injection exist; final end-to-end hardening and release validation remain.

The desktop dispatcher can report status, search notes, read note summaries and blocks, and list tags and collections. The five write commands remain intentionally unimplemented and return `INTERNAL` until Phase 4.

## Local-First Safety State

- No NoteX application database migration was added.
- The NoteX SQLite schema remains at version 3.
- MCP authentication data is not stored in the NoteX SQLite database or browser storage.
- The desktop refresh credential and session metadata are stored through Windows Credential Manager.
- Rust and the backend do not write directly to the notes database.
- Phase 3 reads use only `useNotesStore.getState()` and `useKnowledgeStore.getState()`; dispatcher tests assert that no Tauri/SQLite command is invoked.
- The backend has a separate SQLite database containing only account, OAuth, client, grant, token, session, signing-key, registration, and desktop-session metadata.
- Presence, WebSocket tickets, pending requests, arguments, results, and note content remain memory-only in the backend.
- Disconnects, backend restarts, and timeouts fail in-flight requests without queueing or replay.
- No existing note, block, tag, collection, attachment, or other local user data was migrated or modified by this work.
- The only Phase 3 change in `sqlite_storage.rs` is a `#[cfg(test)]` regression test; production schema code remains unchanged at version 3.

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
- `src/core/mcp/dispatcher.ts` is independent of transport, enforces deadlines, and now implements status plus all five Phase 3 reads.
- The Zustand MCP store is transient and does not persist tokens or account state.
- Profile includes Register, Login, Cancel, Logout, Revoke AI access, and Delete MCP account states.
- Revocation and account deletion use confirmation modals; their copy explicitly preserves local notes.
- The sidebar shows green `Online` only after bridge readiness and red `Offline` for every other state.
- MCP UI text exists in Portuguese and English.

## Phase 3 Result

### Shared Search and Editor Schema

- `src/core/utils/noteSearch.ts` is now the single search implementation used by both the existing SearchBox and MCP.
- Search remains accent-insensitive, excludes trash by default, supports active/trash/all for MCP, preserves cross-field phrase matching, ranks content before tags and collections, and applies deterministic limits.
- The full and inline Tiptap extension sets were extracted to `src/core/editor/noteEditorExtensions.ts` without changing editor markup, node views, shortcuts, or visual behavior.
- `src/core/mcp/richTextOutput.ts` produces plain text plus sanitized supported HTML and never exposes Tiptap JSON or local file metadata.

### Read Dispatcher

- `notex_status`, `search_notes`, `get_note`, `get_note_block`, `list_tags`, and `list_collections` validate both input and output through the shared contract.
- `get_note` returns the header, current version, and summaries ordered by block `sortOrder`.
- `get_note_block` returns exact supported rich content for one block, excluding file nodes and executable or unsafe HTML.
- Trashed notes are searchable only when requested and are marked read-only in note/block responses.
- Missing or mismatched note/block IDs return `NOT_FOUND`; invalid input and expired deadlines return typed errors.

### Compatibility Evidence

- Frontend tests cover search ordering, limits, accents, location filters, rich-text sanitization, all read commands, typed failures, and absence of direct SQLite calls.
- A Rust in-memory v3 fixture snapshots the SQLite objects and an existing note, repeats the current schema bootstrap, and confirms unchanged schema, schema version, and note content.
- A final real-copy and public end-to-end check remains part of the external staging gate; automated fixtures do not replace that release check.

## Validation Completed

### Contract and Backend

```text
npm --prefix packages/notex-mcp-contract test
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix backend run build
```

- Contract: 1 Vitest file / 8 tests passed.
- Backend: 7 Vitest files / 33 tests passed.
- Backend and contract production builds passed.
- Backend and contract audits reported 0 vulnerabilities at the time of validation.
- A backend-local Vitest config now prevents the root frontend test config from shadowing the seven backend test files.
- Compiled backend smoke tests returned health, RFC 8414, and RFC 9728 metadata.
- Real-network WebSocket tests covered routing, ticket replay rejection, Origin rejection, and in-flight disconnect failure.

### Tauri and Frontend

```text
cargo test --manifest-path src-tauri/Cargo.toml
npm test
npm run typecheck
npm run check:styles
npm run build
```

- Rust: 7 tests passed, including endpoint restrictions, bridge frame validation, and SQLite v3 preservation.
- Frontend: 3 Vitest files / 16 tests passed for shared search, rich-text output, and MCP dispatch.
- Frontend typecheck, style checks, and production build passed.
- Profile/sidebar were inspected in PT/EN, dark/light, and desktop/mobile viewports using a local Tauri IPC mock.
- The visual run had no application console errors; only the existing React Router warnings were present.

### Dependency Audit Note

- `npm audit --omit=dev --audit-level=high` passes with no high-severity production finding, but reports 41 moderate findings in the existing React Router/Tiptap dependency graph.
- The full root audit reports 7 high-severity findings in build/development dependencies.
- A dry run showed that blind `npm audit fix` would create mixed Tiptap peer versions. Upgrade the complete Tiptap package set together and re-run editor regression checks before Phase 4 accepts remote rich-text input.

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
8. Execute `notex_status`, all five reads, and trash reads against a real local schema-v3 database.
9. Confirm offline, logged-out, backend-restart, and interrupted-socket behavior without queueing or replay.

No production secret or authentication bypass should be committed to avoid this gate.

## Remaining Implementation

### Phase 3: External Read-Only Gate

- Deploy the backend with real Google credentials and an approved public HTTPS/WSS origin.
- Authenticate the NoteX desktop app and an external MCP client as the same registered account.
- Execute status, search, note, block, tag, and collection reads against a real copied schema-v3 database.
- Compare the copied database before and after the MCP run and confirm unchanged tables, columns, schema version, and rows.
- Repeat with NoteX logged out, closed, disconnected, and restarted to confirm immediate failures and no replay.

### Phase 4: Writes and Rich Text

- Upgrade all Tiptap packages as one compatible set and clear the current Tiptap security advisory before accepting remote HTML.
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
- Retain the automated schema-v3 fixture and complete the real-database before/after staging assertion.
- Exercise all 11 tools through the official MCP Inspector over public HTTPS/WSS.
- Validate compatible custom remote MCP clients without platform-specific backend code.
- Publish the backend image and signed NoteX desktop build only after the external gate passes.

## Exact Resume Sequence

1. Run `git status --short` and confirm this checkpoint still matches the branch.
2. Commit or otherwise preserve the current uncommitted Phase 3 implementation.
3. Obtain the public backend origin and real Google OAuth credentials.
4. Deploy staging and complete the real Google/MCP read-only path before starting writes.
5. Upgrade the full Tiptap dependency set and verify editor/read-output regressions.
6. Implement the Phase 4 input parser, save coordinator, transactions, and five write commands.
7. Run frontend, Rust, contract, backend, Docker, and MCP Inspector validation.
8. Complete the remaining Phase 5 release gates.
