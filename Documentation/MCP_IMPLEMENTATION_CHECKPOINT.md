# MCP Implementation Checkpoint

Date: 2026-09-04

## Current Direction

- The active direction is now the embedded local MCP server documented in `Documentation/MCP_LOCAL_IMPLEMENTATION_PLAN.md`.
- The local path is `local AI client -> Streamable HTTP on 127.0.0.1 -> NoteX/Tauri -> existing renderer dispatcher -> stores/repository -> SQLite v3`.
- The remote backend, Google OAuth, and WebSocket bridge remain preserved for future web-platform access but are no longer the current implementation priority.
- The current uncommitted Phase 4 dispatcher/store/rich-text work is transport-independent and must be preserved for the local path.
- Local MCP implementation has not started yet. The MVP authentication policy is now fixed as loopback-only without login or bearer token, with strict Host/Origin validation and no permissive CORS.

## Repository State

- Branch: `add_mcp`.
- Current committed baseline: `8662938` (`feat: update Tiptap dependencies and add underline extension tests`).
- The branch matched `origin/add_mcp` before the Phase 4 work described below began.
- Phase 4 production changes are currently uncommitted and must not be discarded before validation.
- The approved implementation plan remains in `Documentation/MCP_IMPLEMENTATION_PLAN.md`.

## Current Phase Status

- **Phase 0: complete and validated.**
- **Phase 1: implementation complete and locally validated.**
- **Phase 2: implementation complete and locally validated.**
- **Phase 3: implementation complete and locally validated.** All six read/status commands are connected to the current renderer stores.
- **Phases 1-3 external staging gate: pending.** Real Google credentials, a public HTTPS/WSS deployment, a running desktop app, and an external MCP client are still required.
- **Phase 4: production implementation present, validation pending.** The five write commands, rich-text input sanitization, local draft coordination, optimistic versions, and atomic note-plus-block creation are implemented but no Phase 4 tests, typecheck, or build have been run yet.
- **Phase 5: partially completed early.** Backend hardening, Docker, backend CI, GHCR publication, and production URL injection exist; final end-to-end hardening and release validation remain.

The desktop dispatcher now contains all eleven read and write commands. The five writes must be treated as unvalidated until the focused Phase 4 checks are explicitly authorized and completed.

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

## Phase 4 Implementation State

### Rich-Text Input

- `src/core/mcp/richTextInput.ts` converts MCP `{ format: "text" | "html", value }` inputs with the same full and inline Tiptap extension factories used by the editor.
- HTML is parsed in the renderer, executable and file/image elements are removed, unknown wrappers are unwrapped, unsafe link protocols are removed, and attributes/styles are allowlisted before conversion to Tiptap JSON.
- Inline fields are stored as the editor's normalized HTML; block fields are stored as Tiptap JSON plus generated plain text. Tiptap JSON remains internal and is not returned by the MCP contract.

### Mutations and Conflicts

- `create_note`, `update_note_header`, `add_note_block`, `update_note_block`, and `set_note_tags` are connected to `useNotesStore`.
- Existing-note writes require an exact `expectedVersion`, reject trashed notes, preserve omitted fields, reject unknown tag/collection IDs, and return the resulting version.
- A per-note in-memory coordinator rejects MCP writes while header/block debounces or local saves are active and prevents overlapping MCP mutations on the same note.
- The existing Note Detail header and block debounces now register pending drafts and saves with that coordinator.
- `createNoteWithBlocks` persists the note and its initial blocks through one existing SQLite transaction and then updates the Zustand state. No table, column, migration, or schema version was added.

### Validation Boundary

- These Phase 4 changes were implemented under an explicit instruction not to run tests automatically.
- No Phase 4 test, typecheck, build, browser run, Tauri test, backend test, dependency operation, or network operation has been executed for the current worktree.
- Phase 4 remains open until focused validation is authorized and any resulting defects are corrected.

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
- Frontend: 4 Vitest files / 18 tests passed for editor extensions, shared search, rich-text output, and MCP dispatch.
- Frontend typecheck, style checks, and production build passed.
- Profile/sidebar were inspected in PT/EN, dark/light, and desktop/mobile viewports using a local Tauri IPC mock.
- The visual run had no application console errors; only the existing React Router warnings were present.
- Tiptap 3.31.2 browser QA rendered headings, bold/italic text, bullet lists, tasks, tables, and NoteX tips; an edit persisted through the existing repository path and the shared search returned the fixture note.
- The duplicate `underline` extension introduced by the newer StarterKit was found during browser QA, disabled in StarterKit, and covered by a real Editor regression test.

### Dependency Audit Note

- All direct and transitive Tiptap packages are aligned and pinned at 3.31.2; `npm ls` reports no invalid or mixed peers.
- React Router is now 6.30.6, Vite is 6.4.3, and the previously vulnerable Babel, Browserslist, Fast URI, Immutable, JS-YAML, Nano ID, PostCSS, and selector-parser versions were updated within compatible ranges.
- The npm install audit summary dropped from 50 findings (including 7 high) to 2 moderate findings, with no high or critical findings. The registry audit detail endpoint repeatedly stalled, so the two remaining moderate advisories still need classification before release.
- `npm ci` completed successfully from the resulting lockfile before the final test run.

### Visual QA Note

- At 390 px, the editor itself remains within 300 px and its rich content renders correctly.
- The existing note-detail header still creates horizontal page overflow (`scrollWidth` 637 px) through `.document-actions`; this is outside the editor/Tiptap change and should be fixed as separate responsive UI work.

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

### Phase 4: Validation and Closure

- Add focused rich-text input, transaction, version-conflict, trash, unknown-ID, dirty-draft, deadline, and overlapping-client tests.
- Run the frontend typecheck and focused Phase 4 tests only after explicit authorization.
- Correct any compile or behavioral failures found by that validation.
- Complete the real MCP write flow later in staging; Google OAuth and public HTTPS/WSS remain unavailable locally.

### Phase 5: Final Hardening and Release

- Add a dedicated frontend/Rust CI workflow; current MCP CI covers only contract, backend, and Docker.
- Complete SSRF/CIMD and authorization abuse tests against the deployed environment.
- Retain the automated schema-v3 fixture and complete the real-database before/after staging assertion.
- Exercise all 11 tools through the official MCP Inspector over public HTTPS/WSS.
- Validate compatible custom remote MCP clients without platform-specific backend code.
- Publish the backend image and signed NoteX desktop build only after the external gate passes.

## Exact Resume Sequence

1. Run `git status --short` and confirm the uncommitted Phase 4 files are still present.
2. Review the Phase 4 diff without discarding or rewriting the committed baseline.
3. After explicit authorization, add/run focused Phase 4 tests and frontend typecheck; stop again before broader validation.
4. Correct validation failures, then commit the Phase 4 implementation and its tests.
5. Obtain the public backend origin and real Google OAuth credentials when available.
6. Deploy staging and complete both read and write flows through a real external MCP client.
7. Run the remaining Rust, contract, backend, Docker, and MCP Inspector release validation only when authorized.
8. Complete the remaining Phase 5 release gates.
