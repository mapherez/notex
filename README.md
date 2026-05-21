# NoteX

NoteX is a local/offline-first knowledge management app built around structured notes, tags, collections, and quick pins.

The app currently runs in local-only mode. Google Drive sync and the Node auth broker code are still kept in the repository for possible future use, but cloud sync is disabled by `features.cloudSync` in `src/config/settings.json`.

## Stack

- React 18
- TypeScript
- Vite
- Zustand
- Dexie / IndexedDB
- React Router
- Tailwind CSS
- Node.js auth broker, parked for future sync work
- SQLite via `better-sqlite3`, parked for future sync work
- Google Drive `appDataFolder` sync, parked for future sync work

## Requirements

- Node.js 20+
- npm
- Docker, optional for production deployment
- A Google Cloud OAuth client only if cloud sync is re-enabled later

## Local Development

Install dependencies:

```bash
npm install
```

Run the frontend only:

```bash
npm run dev
```

The backend broker is not needed for current local-only development. If cloud sync is re-enabled later, run it in another terminal:

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

The repo includes a manual GitHub Action that builds and publishes the Docker image to GitHub Container Registry.

To publish a new image:

1. Push your changes to GitHub.
2. Open GitHub Actions.
3. Run `Build Docker Image` manually.
4. Use `latest` or provide another tag.

The default published image is:

```text
ghcr.io/mapherez/notex:latest
```

You can also build locally:

```bash
docker build -t notex .
```

For server deployment, copy `docker-compose.yml` and a production `.env` file to your server, then run:

```bash
docker compose pull
docker compose up -d
```

The `/data` volume stores the SQLite database, including encrypted refresh tokens and browser session metadata.

Put the container behind HTTPS in production. Cookies are marked `Secure` automatically when `APP_ORIGIN` starts with `https://`.

If the GHCR package is private, log in on the server before pulling:

```bash
echo YOUR_GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

The token needs permission to read packages.

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
