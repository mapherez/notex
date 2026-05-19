# Google Login And Drive Sync Plan

## Summary
Implement Google as optional sync, not as a required account gate. NoteX remains local-first with Dexie/IndexedDB as the working database, and Google Drive becomes a background backup/sync target.

Use Google Identity Services for account/profile data and Drive authorization, with Drive files stored in the hidden `appDataFolder` using the narrow `drive.appdata` scope. Sources: [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/overview), [Drive appDataFolder](https://developers.google.com/workspace/drive/api/guides/appdata), [Drive scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [Drive uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

## Key Changes
- Add `VITE_GOOGLE_CLIENT_ID` config and lazy-load Google Identity Services only when the user connects sync.
- Add auth/sync state models:
  - `User.firstName`, `googleSub`, `lastLoginAt`, `provider`.
  - `SyncState` for connected account, last sync, last error, device id, workspace/manifest Drive file ids.
  - `SyncItem` metadata for note/workspace Drive file ids, hashes, remote versions, modified times, and statuses.
  - `DeviceSession` records for NoteX-connected browsers/devices.
- Store profile data from Google:
  - dashboard greeting uses first name.
  - profile name uses full name.
  - email comes from Google profile.
  - handle is derived from email local part, e.g. `joseph@gmail.com` -> `@joseph`.
  - last login updates on successful Google connect.
  - active sessions means active NoteX devices, not Google account sessions.

## Sync Design
- Cloud file layout in Drive `appDataFolder`:
  - `notex-workspace.json`: settings, tags, collections, activities, user profile, dashboard workspace, sessions.
  - `notex-manifest.json`: note index, tombstones, note file ids, hashes, schema version.
  - `notex-note-{noteId}.json`: one JSON file per note.
- Notes sync individually, so changing one note uploads only that note.
- Workspace data syncs as one file, with merge-by-id for tags, collections, activities, sessions, and settings.
- Queue local changes automatically and debounce uploads. Also add a manual “Sync now” action/status.
- First connect merges local and cloud data. Local notes are never discarded silently.
- Conflicting note edits create a conflict copy instead of overwriting either version.
- Moving a note to Trash syncs the trashed state. Clearing Trash writes tombstones first, then deletes remote note files.

## Implementation Shape
- Add a small Google auth service using direct browser `fetch` for Drive REST calls instead of adding a heavy Google API client dependency.
- Add a sync orchestrator outside React components. Zustand stores should only save local data and enqueue sync work.
- Update note/tag/collection/settings mutations so they mark affected entities as pending when sync is connected.
- Add a root sync bootstrap hook that reacts to app startup, online/offline changes, visibility changes, and manual sync.
- Update Profile UI with Connect Google, Sync now, sync status, email, last login, and NoteX active session count.

## Test Plan
- Typecheck with `npm run typecheck`.
- Unit-level checks for email-to-handle derivation, profile normalization, stable JSON hashing, manifest merge, and conflict-copy creation.
- Manual scenarios:
  - use app fully offline without Google.
  - connect Google with existing local notes and empty cloud.
  - connect second browser/device and pull synced notes/settings.
  - edit same note on two devices while offline, then sync both and verify conflict copy.
  - create/update/delete tags and collections, then verify they transfer.
  - move note to Trash, restore it, clear Trash, and verify remote/local behavior.
  - expire/revoke token and verify app asks for Drive permission again without losing local data.

## Assumptions
- Sync is optional and local-first.
- Hidden Drive app data is preferred over a visible Drive folder.
- Active sessions means NoteX device sessions.
- Tokens are not stored long-term; access tokens are requested again when needed.
- Images remain out of scope for this phase.
