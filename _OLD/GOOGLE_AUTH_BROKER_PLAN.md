# Google Auth Broker For Durable Sync

## Summary
- Implement a small Node backend in the same Docker container as the frontend.
- Use Google OAuth **authorization code flow** with `access_type=offline`, so the backend stores a refresh token and can mint fresh access tokens silently.
- Keep the current browser-to-Google Drive sync code mostly intact: the backend brokers tokens, while the frontend still performs Drive sync using short-lived access tokens.
- Difficulty: moderate, not a rewrite. Most rework is auth/session plumbing; Dexie, note editing, sync queue, and Drive file format stay mostly unchanged.

## Key Changes
- Add a Node server that serves the built Vite app and exposes `/api/auth/*`.
- Store auth data in SQLite at `/data/notex.sqlite`, mounted as a Docker volume.
- Store refresh tokens encrypted with a server env key; store browser sessions as hashed session IDs.
- Use an HttpOnly, Secure, SameSite cookie so login survives browser restarts.
- Replace frontend Google popup token acquisition with a backend token provider:
  - `GET /api/auth/session` returns connected user/session state.
  - `GET /api/auth/google/start` redirects to Google.
  - `GET /api/auth/google/callback` exchanges code, stores refresh token, sets session cookie.
  - `POST /api/auth/google/token` returns a fresh short-lived Google access token.
  - `POST /api/auth/logout` clears the NoteX session.
- Keep the existing Drive sync functions taking `accessToken`; only change where the token comes from.

## Sync Behavior
- User logs in once through Google.
- Edits queue sync exactly as they do now.
- Background sync asks the backend for an access token; backend refreshes silently when needed.
- No Google popup appears during normal edits, long sessions, or browser restarts.
- If Google access is revoked or the refresh token expires, sync pauses, pending changes remain local, and UI shows a reconnect action.
- Active sessions in Profile should come from backend sessions, not mock/local Drive session guesses.

## Docker And Config
- One container, one exposed port.
- Production server serves static frontend files and `/api` routes from the same origin.
- Required env vars:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URI`
  - `SESSION_SECRET`
  - `TOKEN_ENCRYPTION_KEY`
  - `DATABASE_PATH=/data/notex.sqlite`
  - `APP_ORIGIN`
- Google redirect URI should be: `https://your-domain.com/api/auth/google/callback`.
- Do not use `VITE_GOOGLE_CLIENT_SECRET`; no Google secret goes into frontend code.

## Future Desktop Compatibility
- Add a small auth/token-provider interface now.
- Web implementation uses the backend broker.
- Future desktop implementation can use native OAuth + OS keychain, then feed tokens into the same sync engine.
- This avoids reworking note storage, editor UI, local queueing, or Drive sync payloads later.

## Test Plan
- Login once, edit notes for 2-3 hours, verify sync continues without Google popups.
- Restart browser, reopen NoteX, verify session is restored and sync continues.
- Revoke Google app access, verify sync pauses without popup spam and pending changes stay local.
- Logout, verify local mode works and no backend token requests happen.
- Clear cloud data, tag deletion, trash clearing, and quick pin/settings changes all push to Drive.
- Build Docker image and verify frontend + backend work from one origin.

## Assumptions
- Use token broker now, not full Drive proxy.
- Use Node + SQLite because it fits one self-hosted Docker container with low operational overhead.
- Notes still sync directly from browser to Google Drive for now.
- Official basis: Google’s browser token model is short-lived/popup based, while Google’s web-server OAuth flow supports offline refresh tokens:
  - https://developers.google.com/identity/oauth2/web/guides/use-token-model
  - https://developers.google.com/identity/protocols/oauth2/web-server
