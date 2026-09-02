# NoteX MCP Backend

Hosted authentication and routing bridge between remote MCP clients and one live NoteX Desktop instance. It stores account and OAuth metadata in its own SQLite database. It never stores notes, tool payloads, pending actions, or replay queues.

## Requirements

- Node.js 24 LTS
- A Google OAuth web application
- HTTPS at the public reverse proxy outside loopback development

The Google authorized redirect URI is:

```text
https://your-mcp-host.example/api/auth/callback/google
```

## Local development

Create `backend/.env` from `backend/.env.example`, then install the independent contract and backend lockfiles:

```text
cd packages/notex-mcp-contract
npm ci
cd ../../backend
npm ci
```

Load the variables from `backend/.env` in the shell, then run:

```text
npm run typecheck
npm test
npm run dev
```

Development endpoints use `http://127.0.0.1:8080`. Production rejects a non-HTTPS public URL unless it is loopback.

## Configuration

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development`, `test`, or `production`. |
| `NOTEX_MCP_PUBLIC_URL` | Canonical externally reachable origin. It determines OAuth issuer, MCP resource, callbacks, and WSS URL. |
| `NOTEX_MCP_HOST` | Listen address. Use `0.0.0.0` in the container. |
| `NOTEX_MCP_PORT` | HTTP listen port; defaults to `8080`. |
| `NOTEX_MCP_DATABASE_PATH` | Backend-only SQLite path; use `/data/notex-mcp.sqlite` in the container. |
| `NOTEX_MCP_ALLOWED_HOSTS` | Additional comma-separated Host values accepted behind the proxy. The public URL hostname is always included. |
| `NOTEX_MCP_TRUST_PROXY` | Optional trusted proxy address/CIDR accepted by Express. Leave empty when clients can reach the backend directly. |
| `NOTEX_MCP_LOG_LEVEL` | Pino level. Payloads, query strings, credentials, email addresses, and bridge frames are never logged. |
| `BETTER_AUTH_SECRET` | Random secret of at least 32 characters. Rotating it invalidates existing credentials. |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret. |

## Docker

The build context must be the repository root because `backend/` depends on `packages/notex-mcp-contract`:

```text
docker build -f backend/Dockerfile -t notex-mcp:dev .
docker compose --env-file backend/.env -f docker-compose.mcp.yml up -d
```

The image runs as UID/GID `10001`, writes only to `/data`, exposes port `8080`, and has an HTTP healthcheck. The compose file also drops Linux capabilities and makes the root filesystem read-only.

Terminate TLS in a reverse proxy and forward normal HTTP plus WebSocket upgrades for `/v1/bridge`. Preserve the original `Host`, `Origin`, scheme, and client address headers. Set `NOTEX_MCP_TRUST_PROXY` only to the actual proxy address or private CIDR, and do not expose port 8080 around that proxy. Run exactly one backend replica for the MVP because presence and in-flight requests are memory-only.

## Public surface

- `POST /mcp`: stateless Streamable HTTP MCP endpoint.
- `GET /.well-known/oauth-protected-resource/mcp`: RFC 9728 metadata.
- `GET /.well-known/oauth-authorization-server/api/auth`: RFC 8414 metadata.
- `/api/auth/*`: Google/OAuth provider endpoints.
- `/v1/desktop/*`: authenticated desktop session and account endpoints.
- `GET /v1/bridge`: WebSocket upgrade endpoint for NoteX Desktop.
- `GET /healthz`: liveness endpoint.

`GET /mcp` intentionally returns `405`; there is no SSE session or server-side MCP request queue.

`POST /v1/desktop/device/start` returns the RFC 8628 device fields together with
the first-party `client_id`, `token_endpoint`, audience `resource`, and a
short-lived, single-login `activation_token` required by NoteX Desktop. OAuth
metadata is public and no client secret is issued to the native application.
After activation, every desktop endpoint except a new activation requires the
active session UUID in `X-NoteX-Desktop-Session`; a replaced installation cannot
reuse its old session to reconnect or manage the account.

## Simulator

After obtaining a one-use bridge ticket from the authenticated desktop session endpoint:

```text
NOTEX_SIMULATOR_BRIDGE_URL=wss://your-mcp-host.example/v1/bridge
NOTEX_SIMULATOR_TICKET=one-use-ticket
npm run simulate:desktop
```

The simulator validates the shared protocol and returns deterministic empty fixtures. It is a development tool and does not access a NoteX database.
