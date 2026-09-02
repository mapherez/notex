# MCP Backend Operations

## Deployment Invariants

- Run one backend replica for the MVP. Desktop presence, bridge tickets, and in-flight requests exist only in that process.
- Terminate TLS at the reverse proxy. The public URL must use HTTPS and the desktop bridge must reach the same origin over WSS.
- Persist only `/data/notex-mcp.sqlite`. This database contains identity and OAuth metadata, never notes or tool payloads.
- A backend restart intentionally fails live tool calls and disconnects NoteX Desktop. Nothing is replayed when either side reconnects.

The runnable configuration reference and Docker commands are in [`backend/README.md`](../backend/README.md).

## Reverse Proxy

Forward HTTP requests and WebSocket upgrades to port 8080. In particular, `/v1/bridge` must preserve the WebSocket `Upgrade` and `Connection` headers. Preserve the public `Host`, scheme, and `Origin` values because the backend validates them and derives audience-bound URLs from `NOTEX_MCP_PUBLIC_URL`.

Do not expose port 8080 directly when a reverse proxy is in use. Set `NOTEX_MCP_TRUST_PROXY` to the concrete proxy address or private CIDR, never to an unrestricted hop count. Add alternate proxy Host values only through `NOTEX_MCP_ALLOWED_HOSTS`.

The Google OAuth callback configured in Google Cloud must be:

```text
https://<public-host>/api/auth/callback/google
```

## Secrets

- Store `BETTER_AUTH_SECRET` and `GOOGLE_CLIENT_SECRET` in the deployment secret manager, not in Compose files or the repository.
- Use at least 32 random characters for `BETTER_AUTH_SECRET`.
- Rotating the Better Auth secret invalidates issued credentials and requires platforms and desktops to authenticate again.
- Restrict read/write access to the `/data` volume because it contains OAuth grants and signing material.

## Database And Backups

The backend applies its own migrations before opening the listener. Its SQLite file is independent from every NoteX desktop database and has no path or schema relationship with NoteX schema v3.

For a simple backup, stop the backend cleanly and copy `/data/notex-mcp.sqlite`. If an online backup is required later, use SQLite's backup API; do not copy only the main file while WAL writes are active. Restoring this file restores remote accounts and grants, not note content.

Deleting an MCP account removes Better Auth records and backend account/session metadata. It does not contact, open, migrate, or delete the local NoteX SQLite database.

## Health And Logs

`GET /healthz` returns `{"status":"ok"}` after configuration, custom migrations, Better Auth migrations, OAuth resource seeding, and server startup have succeeded. The container healthcheck calls it every 30 seconds.

Application logs contain request IDs, methods, paths without query strings, status codes, durations, event names, and error types. Better Auth's own logger is disabled. Authorization headers, cookies, email addresses, request/response bodies, MCP arguments/results, and WebSocket frames are excluded.

## Rollout And Recovery

1. Back up the backend SQLite volume.
2. Deploy exactly one new image and keep the same `/data` volume and Better Auth secret.
3. Wait for the healthcheck before exposing traffic.
4. Expect connected desktops to reconnect and in-flight AI calls to fail once during replacement.
5. Roll back with the same volume if startup fails; never point the backend at a NoteX desktop database.

Horizontal scaling requires a shared presence router that preserves single active desktop ownership and no-replay semantics. It is deliberately outside the MVP.
