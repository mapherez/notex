# NoteX Development

This guide contains the development and repository details previously kept in
the main README. For an overview of the app, see the [project README](../../README.md).

## Requirements

- Node.js 24 and npm.
- Rust 1.88+ and the Tauri prerequisites for your platform when working on desktop.

## Local development

Install dependencies:

```bash
npm install
```

Run the browser frontend:

```bash
npm run dev
```

Run the Tauri desktop app:

```bash
npm run tauri:dev
```

For Google authentication and Drive configuration, follow
[Google OAuth and build configuration](GOOGLE_DRIVE_SETUP.md). Browser mode
requires a Google account; desktop can run without one.

## Checks and builds

```bash
npm run typecheck
npm run check:styles
npm run build
npm test
```

Build the desktop app:

```bash
npm run tauri:build
```

Installers and updater bundles are generated under
`src-tauri/target/release/bundle/`.

## Architecture overview

- React 18, TypeScript, Vite, React Router, and Zustand.
- Tauri 2 desktop shell with SQLite via Rust `rusqlite` and local attachments.
- IndexedDB storage for browser libraries, including attachments and pending transfers.
- Google Drive backups using note JSON and attachments in the user's application-data area.
- SCSS with Sass maps, theme tokens, and Stylelint guardrails.
- Static marketing site and public documentation in `landing/`.

Desktop and browser share note models and transfer logic while using separate
storage adapters. Account libraries are isolated. The web host serves the app;
it does not store users' notes or Google tokens.

See the [architecture constraints](ARCHITECTURE_CONSTRAINTS.md),
[data model](DATA_MODEL.md), and
[Google Drive implementation plan](GOOGLE_DRIVE_WEB_IMPLEMENTATION_PLAN.md).

## Local MCP

Open Profile in the desktop app and select **Start MCP**. **Configure MCP**
provides the current Streamable HTTP URL and generic client configuration.

The server listens only on the local computer and remains available only while
NoteX is open and MCP is running. It operates on the active desktop library.
See the [local MCP guide](../MCP_LOCAL_USER_GUIDE.md) for setup and access details.

## Releases

Set the release version across manifests:

```bash
npm run version:set
```

Update `src/content/patch-notes.md` before publishing. The signed Tauri release
workflow is defined in `.github/workflows/release.yml`, with helper logic in
`.github/scripts/tauri-release.mjs`.

The in-app updater is configured through `src-tauri/tauri.conf.json` and checks
signed GitHub release artifacts. Browser deployment is documented separately in
[web deployment and release preparation](GOOGLE_DRIVE_WEB_DEPLOYMENT.md).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run tauri:dev` | Start the Tauri desktop app in development mode. |
| `npm run tauri:build` | Build the desktop app. |
| `npm run tauri:icon` | Regenerate Tauri icons from `public/assets/notex_logo_small.webp`. |
| `npm run release:tauri` | Run the Tauri release helper. |
| `npm run version:set` | Update the version in release manifests. |
| `npm run build` | Typecheck and build the frontend and web worker. |
| `npm run preview` | Preview the frontend build with Vite. |
| `npm run typecheck` | Run TypeScript checks. |
| `npm run check:styles` | Run SCSS Stylelint and inline-style guardrails. |
| `npm test` | Build the MCP contract and run Vitest. |

## Project structure

- `src/`: React app, stores, storage adapters, services, and UI.
- `src-tauri/`: desktop shell, SQLite commands, updater, and packaging.
- `packages/notex-mcp-contract/`: shared MCP schemas, tools, and generated manifest.
- `backend/`: preserved hosted MCP bridge for future remote access; not required by local MCP.
- `public/`: app assets.
- `landing/`: public marketing site and user documentation.
- `scripts/`: repository maintenance scripts.
- `Documentation/`: user guides and internal references under `Developer/`.
- `dist/`: generated frontend build output.

## Data and exports

Desktop libraries use SQLite and local files; browser libraries use IndexedDB.
Google Drive stores note JSON and attachments rather than a copy of the desktop database.

Desktop `.notex` packages contain a complete library and associated files. A full
import replaces the active library after confirmation. `.notex-note` packages
contain one note and its attachments. See the
[import and export guide](../../landing/docs/content/import-export.md).
