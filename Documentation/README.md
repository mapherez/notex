# NoteX

Offline-first knowledge management app built around structured notes, tags, collections, quick pins, and optional Google Drive sync.

Current scope:

- Local-first editing backed by IndexedDB/Dexie
- Structured note sections with Markdown fields and editable usage-example tables
- Tags, collections, favorites, trash, quick capture, and quick pins
- Google Drive backup/sync through a Node auth broker
- Docker deployment from one image that serves the frontend and backend

Operational notes:

- The app must remain usable without a Google account.
- Cloud sync is used for backup and transfer between devices, not as the primary working store.
- Runtime SQLite data lives under `data/` and must not be committed.
- User-facing text should stay in `src/locales/en.json` and `src/locales/pt.json`.
