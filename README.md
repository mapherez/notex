# NoteX

NoteX is an offline-first knowledge management app built around structured notes, tags, collections, quick pins, and Google Drive backup/sync.

The app stores working data locally in IndexedDB/Dexie so it remains usable offline. When Google sync is connected, NoteX uses a small Node auth broker to keep a durable Google session and silently refresh short-lived Google access tokens for Drive sync.

## Stack

- React 18
- TypeScript
- Vite
- Zustand
- Dexie / IndexedDB
- React Router
- Tailwind CSS
- Node.js auth broker
- SQLite via `better-sqlite3`
- Google Drive `appDataFolder` sync

## Requirements

- Node.js 20+
- npm
- Docker, optional for production deployment
- A Google Cloud OAuth client for Google Drive sync

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend only:

```bash
npm run dev
```

Run the backend broker in another terminal when testing Google login/sync locally:

```bash
npm run server
```

The backend reads `.env` from the repo root. You do not need a separate `.env` file inside `server/`.

The Vite dev server proxies `/api` requests to `http://localhost:3000`, so the frontend can use the auth broker during development.

Useful checks:

```bash
npm run typecheck
npm run build
```

## Environment Variables

Copy `.env.example` into your server environment and fill in the values:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=https://your-domain.com/api/auth/google/callback
SESSION_SECRET=
TOKEN_ENCRYPTION_KEY=
DATABASE_PATH=/data/notex.sqlite
APP_ORIGIN=https://your-domain.com
```

For local development, use:

```env
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
APP_ORIGIN=http://localhost:5173
DATABASE_PATH=./data/notex.sqlite
```

Generate the server secrets yourself. They do not come from Google:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Run that command twice:

- Use the first value as `SESSION_SECRET`.
- Use the second value as `TOKEN_ENCRYPTION_KEY`.

Keep both values private and stable:

- `SESSION_SECRET` hashes/signs NoteX browser sessions. Changing it logs users out.
- `TOKEN_ENCRYPTION_KEY` encrypts stored Google refresh tokens. Changing or losing it means users must reconnect Google.

Do not expose Google secrets or these server secrets through `VITE_*` variables.

## Google OAuth Setup

In Google Cloud Console:

1. Create or select a project.
2. Configure the OAuth consent screen.
3. Enable the Google Drive API.
4. Create an OAuth 2.0 Client ID for a web application.
5. Add redirect URIs:
   - Local: `http://localhost:3000/api/auth/google/callback`
   - Production: `https://your-domain.com/api/auth/google/callback`
6. Use the generated client ID and client secret as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

NoteX requests these scopes:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/drive.appdata`

The app stores NoteX sync files in Google Drive's hidden `appDataFolder`.

## Auth And Sync Model

The browser never stores the Google client secret or refresh token.

Flow:

1. The user clicks Connect Google.
2. The Node broker redirects to Google OAuth using authorization code flow with offline access.
3. The broker stores the encrypted Google refresh token in SQLite.
4. The broker sets an HttpOnly NoteX session cookie.
5. The frontend asks `/api/auth/google/token` for short-lived Google access tokens.
6. The existing frontend Drive sync code uses those access tokens to sync notes and workspace data.

This prevents repeated Google popup prompts during normal editing, long sessions, and browser restarts.

If Google access is revoked or the refresh token stops working, sync pauses and the user must reconnect Google. Local data remains available.

## Backend API

The Node server serves the built frontend and exposes:

- `GET /api/auth/session`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/google/token`
- `POST /api/auth/logout`
- `DELETE /api/auth/sessions/:id`

Production should serve frontend and backend from the same origin.

## Docker Deployment

Build the image:

```bash
docker build -t notex .
```

Run it:

```bash
docker run -d \
  --name notex \
  -p 3000:3000 \
  -v notex-data:/data \
  -e GOOGLE_CLIENT_ID="..." \
  -e GOOGLE_CLIENT_SECRET="..." \
  -e GOOGLE_REDIRECT_URI="https://your-domain.com/api/auth/google/callback" \
  -e SESSION_SECRET="..." \
  -e TOKEN_ENCRYPTION_KEY="..." \
  -e DATABASE_PATH="/data/notex.sqlite" \
  -e APP_ORIGIN="https://your-domain.com" \
  notex
```

The `/data` volume stores the SQLite database, including encrypted refresh tokens and browser session metadata.

Put the container behind HTTPS in production. Cookies are marked `Secure` automatically when `APP_ORIGIN` starts with `https://`.

## Scripts

- `npm run dev` - start the Vite dev server.
- `npm run server` - start the Node auth broker/static server.
- `npm run build` - typecheck and build the frontend.
- `npm run preview` - preview the frontend build with Vite.
- `npm run typecheck` - run TypeScript checks.
- `npm start` - start the production Node server.

## Project Structure

- `src/` - React app, stores, local database, sync engine, UI.
- `server/` - Node auth broker and static file server.
- `public/` - static assets.
- `Documentation/` - original design and architecture reference docs.
- `dist/` - generated frontend build output.

## Notes For Future Desktop App

The sync engine still accepts short-lived Google access tokens. The current web app gets them from the Node broker. A future desktop app can provide tokens through a native OAuth/keychain adapter without rewriting the note editor, local Dexie storage, Drive file format, or sync queue.
