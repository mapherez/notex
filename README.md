# NoteX

NoteX is a local/offline-first knowledge management app built around structured notes, tags, collections, quick pins, and SQLite persistence.

The production app is a Tauri desktop app. Cloud sync is not part of the active app.

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

- Node.js 20+
- npm
- Rust and the Tauri prerequisites for your platform

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
```

## Desktop Build

Build the desktop app:

```bash
npm run tauri:build
```

The app stores its SQLite database in the Tauri app data directory for the installed application.

## Release

The Tauri release workflow is defined in `.github/workflows/release.yml`, with helper logic in `.github/scripts/tauri-release.mjs`.

The in-app updater is configured through `src-tauri/tauri.conf.json` and checks signed GitHub release artifacts.

## Scripts

- `npm run dev` - start the Vite dev server.
- `npm run tauri:dev` - start the Tauri desktop app in development mode.
- `npm run tauri:build` - build the desktop app.
- `npm run tauri:icon` - regenerate Tauri icons from `public/assets/notex_logo_small.webp`.
- `npm run release:tauri` - run the Tauri release helper script.
- `npm run build` - typecheck and build the frontend.
- `npm run preview` - preview the frontend build with Vite.
- `npm run typecheck` - run TypeScript checks.
- `npm run check:styles` - run SCSS Stylelint and inline-style guardrails.

## Project Structure

- `src/` - React app, stores, local database, storage services, and UI.
- `src-tauri/` - Tauri shell, SQLite commands, updater config, and desktop packaging.
- `public/` - static assets used by the app.
- `landing/` - static public marketing site.
- `Documentation/` - design and architecture reference docs.
- `dist/` - generated frontend build output.

## Data

SQLite is the official app storage layer. Import/export uses SQLite database files, and importing a database replaces the current database after user confirmation.

IndexedDB and cloud sync are not used by the current app.
