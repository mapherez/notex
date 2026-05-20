# NoteX Three-Way Google Drive Sync Plan

## Summary

Replace the current local-priority sync with a three-way sync model:

- IndexedDB remains the local source of truth.
- Google Drive `appDataFolder` remains remote storage.
- The backend remains auth/session-only, plus in-memory realtime sync hints.
- Sync compares `baseHash`, `localHash`, and `remoteHash` per note so browsers converge without silently overwriting each other.
- Normal sync becomes: pull remote changes, push safe local changes, pull once more if needed.

## Key Changes

- Extend sync metadata so each synced entity tracks:
  - `baseHash`: last accepted common version.
  - `localHash`: current local hash.
  - `remoteHash`: latest observed cloud hash.
  - `driveFileId`, remote modified/version metadata, and optional conflict snapshots.
- Update manifest handling:
  - Keep `notex-manifest.json` as the remote index for note IDs, file IDs, hashes, versions, and deletion tombstones.
  - Keep tombstones for cleared-trash notes instead of simply removing entries.
  - Stop deleting remote notes just because they are missing locally.
- Update note sync:
  - If local and remote match: no-op.
  - If only remote changed: download and apply remote note.
  - If only local changed: create/update the note file and manifest entry.
  - If both changed: store conflict snapshots and do not overwrite either side.
- Update workspace sync:
  - Apply the same hash model to `notex-workspace.json`.
  - Merge device sessions automatically.
  - Treat conflicting workspace changes as a sync conflict instead of silently replacing tags/settings/collections.
- Add conflict UX:
  - Show conflicted notes in a review surface.
  - Support Keep Local, Use Remote, Duplicate Both, and Manual Merge.
  - Manual Merge lets the user choose final values for structured note fields, then saves and queues the resolved note.
- Add realtime sync hints:
  - Backend adds `GET /api/sync/events` using Server-Sent Events.
  - Backend adds `POST /api/sync/hint`.
  - After a successful push, the syncing browser sends a hint.
  - Other active sessions for the same Google account receive the hint and run `syncNow()`.
  - Polling/focus/online sync remains as fallback.

## Scale And Safety

- Normal sync downloads only changed/new remote note files, not every note.
- Initial cloud restore may download all notes.
- Note uploads/downloads should be concurrency-limited to avoid Drive quota spikes.
- Hashes ignore sync-only fields like `syncStatus`.
- Timestamps can be stored for UI/debugging, but must not decide conflicts.
- Clear Trash creates remote tombstones so old devices do not recreate deleted notes later.

## Test Plan

- Browser A creates a note; Browser B receives/pulls it without clearing site data.
- Browser A and Browser B create different notes before syncing; both notes survive after sync.
- Browser A edits a note, syncs; Browser B pulls that edit.
- Browser A and Browser B edit the same note offline; sync creates a conflict instead of overwriting.
- Clear Trash in one browser removes those notes from another browser after sync.
- Tag/collection/settings changes sync through workspace without forcing unrelated note loss.
- Login on a clean browser and choose cloud data; it loads the current cloud workspace.
- Revoke Google access; sync pauses, local edits remain queued, and reconnect is shown.
- Build/typecheck passes.

## Assumptions

- We keep the current Drive file structure: manifest, workspace, one JSON file per note.
- We use SSE instead of WebSockets because sync hints are one-way notifications.
- The backend does not store notes, tags, collections, or workspace data.
- Full collaborative real-time editing inside the same note is out of scope; this is eventual sync with conflict protection.
