# NoteX

Offline-first knowledge management app built around block-based notes, tags, collections, quick pins, file attachments, and SQLite persistence.

Current scope:

- Local-first editing backed by SQLite in the Tauri desktop app
- Block-based notes with Tiptap content, inline images, file attachments, and `.notex` package export/import
- Tags, collections, favorites, trash, quick capture, and quick pins
- Static landing page deployment is separate from the desktop app

Operational notes:

- The app must remain usable without an account.
- The desktop app uses SQLite as the official storage layer.
- SQLite is the primary working store.
- Runtime SQLite data lives in the Tauri app data directory and must not be committed.
- User-facing text should stay in `src/locales/en.json` and `src/locales/pt.json`.
