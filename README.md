# NoteX

NoteX is a local-first desktop knowledge management app built around structured
notes, rich content blocks, tags, collections, attachments, and SQLite
persistence.

The production app is built with Tauri. It does not require an account, and
cloud sync is not part of the active app.

## Features

- Block-based rich-text notes with images and file attachments
- Tags, collections, favorites, pins, trash, quick capture, and search
- Local `.notex` package import and export
- Embedded local MCP server for compatible AI clients
- English and Portuguese interfaces with light and dark themes

## Stack

- React 18
- TypeScript
- Vite
- Zustand
- Tauri 2
- Tauri SQLite via Rust `rusqlite`
- React Router
- SCSS with Sass maps, theme tokens, and Stylelint guardrails
- Static marketing site in `landing/`

## Requirements

- Node.js 24 LTS
- npm
- Rust 1.88+ and the Tauri prerequisites for your platform

## Local Development

Install dependencies:

```bash
npm install
```

Run the Vite frontend:

```bash
npm run dev
```

Run the Tauri desktop app:

```bash
npm run tauri:dev
```

Useful checks:

```bash
npm run typecheck
npm run check:styles
npm run build
npm test
```

## Local MCP

Open Profile in the desktop app and select **Start MCP**. **Configure MCP**
provides the current Streamable HTTP URL and generic client configuration.

The server listens only on the local computer and remains available only while
NoteX is open and MCP is running. Notes continue to be stored exclusively in
the existing local SQLite database. See the [Local MCP guide](Documentation/MCP_LOCAL_USER_GUIDE.md)
for setup, tools, and access details.

## Desktop Build

Build the desktop app:

```bash
npm run tauri:build
```

Installers and updater bundles are generated under
`src-tauri/target/release/bundle/`. The installed app stores its SQLite database
and attachments in the Tauri app data directory.

## Release

Set the release version across all manifests:

```bash
npm run version:set
```

Update `src/content/patch-notes.md` before publishing. The signed Tauri release
workflow is defined in `.github/workflows/release.yml`, with helper logic in
`.github/scripts/tauri-release.mjs`.

The in-app updater is configured through `src-tauri/tauri.conf.json` and checks signed GitHub release artifacts.

## Scripts

- `npm run dev` - start the Vite dev server.
- `npm run tauri:dev` - start the Tauri desktop app in development mode.
- `npm run tauri:build` - build the desktop app.
- `npm run tauri:icon` - regenerate Tauri icons from `public/assets/notex_logo_small.webp`.
- `npm run release:tauri` - run the Tauri release helper script.
- `npm run version:set` - update the app version in all release manifests.
- `npm run build` - typecheck and build the frontend.
- `npm run preview` - preview the frontend build with Vite.
- `npm run typecheck` - run TypeScript checks.
- `npm run check:styles` - run SCSS Stylelint and inline-style guardrails.

## Project Structure

- `src/` - React app, stores, local database, storage services, and UI.
- `src-tauri/` - Tauri shell, SQLite commands, updater config, and desktop packaging.
- `packages/notex-mcp-contract/` - shared MCP schemas, tool definitions, and generated manifest.
- `backend/` - preserved hosted MCP bridge for future remote-platform access; not required by local MCP.
- `public/` - static assets used by the app.
- `landing/` - static public marketing site.
- `scripts/` - local repository maintenance scripts.
- `Documentation/` - user guides, with internal references under `Documentation/Developer/`.
- `dist/` - generated frontend build output.

## Data

SQLite is the official app storage layer. `.notex` packages contain the local
database and associated files. Importing a complete package replaces the
current local data only after user confirmation.

IndexedDB and cloud sync are not used by the current app.
