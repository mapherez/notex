# MCP Implementation Checkpoint

Date: 2026-09-01

## Current Phase Status

- **Phase 0: complete and validated.**
- **Phase 1: started, paused, and not yet validated.**
- Phases 2-5: not started.

This file is the restart point for the next session. Do not treat the current backend scaffold as release-ready or validated.

## Repository Safety State

- No NoteX application database migration was added.
- The existing NoteX SQLite schema/version 3 was not changed or opened by the new code.
- No existing note, tag, collection, or other local user data was modified.
- No frontend, Tauri/Rust, CSS, editor, Profile, sidebar, translation, or workflow file has been changed yet.
- Historical editor/CSS constraints were reviewed before starting: audit `16` from commit `8f86a62` and audit `99` from commit `617bf8a`.
- Existing untracked files `MCP_IMPLEMENTATION_PLAN.md` and `_IMPROVEMENTS.txt` were left untouched.

## Completed And Validated

### Shared contract

Created `packages/notex-mcp-contract` with:

- Zod schemas and TypeScript types for all 11 MCP commands.
- Typed public errors and exact offline/logged-out semantics.
- Bridge authentication, ready, request, response, protocol version, limits, heartbeat, ticket TTL, and timeout contracts.
- Explicit detailed presence states and the narrower public MCP availability states.
- Direction-specific frame parsers with a 2 MiB byte limit, strict UTF-8/JSON decoding, and schema validation.
- A fixed machine-readable delivery policy: no queue, no replay, fail in-flight work on disconnect, and single-use tickets.
- Canonical public error messages, including exact logged-out and offline text.
- Scope mapping for `notex:read`, `notex:create`, and `notex:edit`.

Validation already run successfully:

```text
npm run build
npm test
```

Final Phase 0 result:

- TypeScript typecheck passed.
- Clean TypeScript build passed.
- 1 Vitest file / 8 tests passed.
- `dist` contains only `index.js`, `index.d.ts`, and `index.d.ts.map`; tests are neither emitted nor rediscovered.

### Architecture documentation

Created `Documentation/MCP_ARCHITECTURE.md` with the local-first invariants, trust boundaries, explicit threat model, accepted exposure, retention rules, availability semantics, versioning, implementation guardrails, and the Phase 0 gate.

### Dependency manifests

- Created an independent `backend/package.json` and `backend/package-lock.json`.
- Installed backend dependencies successfully (0 reported vulnerabilities).
- Created and installed the independent contract package and lockfile.
- The local machine currently uses Node 20; the backend manifest targets Node 24 and npm emitted the expected engine warning during installation.

## Written But Not Yet Validated

The following backend first-pass modules were just added and have **not** been typechecked, built, started, or tested:

- `backend/src/config.ts`
- `backend/src/database.ts`
- `backend/src/errors.ts`
- `backend/src/logger.ts`
- `backend/src/auth.ts`
- `backend/src/pages.ts`
- `backend/src/bridge/registry.ts`
- `backend/src/bridge/server.ts`
- `backend/src/mcp.ts`
- `backend/src/desktop-api.ts`
- `backend/src/app.ts`
- `backend/src/main.ts`
- `backend/src/simulator.ts`

The intended behavior represented by this scaffold is:

- Better Auth with Google, MCP OAuth Provider, CIMD, DCR, PKCE policy, refresh rotation, and Device Authorization.
- Explicit NoteX registration intent required before Better Auth may create a new Google-backed user.
- A first-party native OAuth client is created for NoteX Desktop.
- Backend-only SQLite tables use the `notex_` prefix and store account/session metadata only.
- WebSocket tickets, presence, pending bridge requests, and payloads live in memory only.
- One ready desktop connection per account; replacement closes the older connection.
- Disconnect, timeout, backend restart, or logout rejects in-flight work without replay.
- MCP v2 stateless HTTP with the SDK's stateless 2025 compatibility path.
- Per-tool scope checks and routing by authenticated user ID.
- Desktop endpoints for activation, ticket renewal, logout, account status, AI grant revocation, and remote MCP account deletion.
- A CLI desktop simulator that needs a bridge URL and one-time ticket.

## Known Unresolved Risks

These are Phase 1 and later risks; they do not reopen the completed Phase 0 contract gate:

1. Run backend TypeScript validation and fix API/type mismatches against Better Auth 1.7.2 and MCP SDK 2.0.0. The newest files were not compiled after being written.
2. Verify the Better Auth device-code route, OAuth token exchange, generated desktop client, Google callback, signed `oauth_query`, consent continuation, and registration cookie as a real browser flow.
3. Confirm the registration database hook returns a clear `Register account first` error for a new user entering through an AI platform or desktop Login.
4. Inspect Better Auth's generated SQLite migration and prove that account/grant/token deletion and AI-only revocation target all required records while preserving the desktop authorization.
5. Add backend unit/integration tests for the registry, one-use tickets, replacement, timeout, disconnect, no replay, scopes, and account lifecycle.
6. Ensure operational logs never include URL query strings, emails, Authorization/Cookie headers, MCP arguments/results, or WebSocket frames.
7. Verify Express 5 wildcard route syntax and Host/Origin handling, including IPv6 and reverse-proxy deployment.
8. Add Docker, healthcheck, non-root runtime, GHCR workflow, Node 24 CI, and backend deployment documentation.

## Work Not Started

- Rust/Tauri credential storage in Windows Credential Manager.
- Rust HTTP/OAuth device polling/WebSocket bridge and renderer event transport.
- Renderer MCP state store and post-bootstrap bridge readiness.
- Transport-independent local dispatcher.
- Shared UI/MCP note search extraction.
- Dirty-note/save coordinator and optimistic version checks.
- Shared Tiptap extension factories, rich-text conversion, and sanitization.
- MCP reads and writes through the current stores/repository.
- Profile/sidebar MCP UI and PT/EN translations.
- NoteX schema-v3 compatibility fixture and end-to-end tests.
- Full frontend/Rust/backend/Docker validation.

## Exact Resume Sequence

1. Do not start desktop or frontend work yet.
2. Run `npm run typecheck` in `backend/` and resolve every compile error without weakening types.
3. Add focused tests for `BackendDatabase` and `BridgeRegistry`; run `npm test` in `backend/`.
4. Start the backend with development Google credentials and inspect the Better Auth-generated schema separately from the NoteX database.
5. Validate Register and Login device flows, then validate MCP OAuth discovery/authentication with MCP Inspector.
6. Exercise one `notex_status` request through the simulator, including offline, replacement, timeout, disconnect, and no-replay cases.
7. Only after that vertical slice passes, begin the Tauri integration and then the renderer dispatcher/UI phases from the approved plan.

## Current Git State

All MCP work is still uncommitted and appears as new/untracked paths under `backend/`, `packages/`, and `Documentation/`. Review `git status --short` before resuming because the user may make changes in the meantime.
