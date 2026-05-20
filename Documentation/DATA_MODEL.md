# Data Model

The authoritative model definitions live in `src/core/models/models.ts`.

## Core Entities

- `Note` stores structured note content, tags, collection membership, favorite/pin/trash state, thumbnail variant, statistics, related links, and sync status.
- `Tag` stores a label name, optional color, and optional computed count for display contexts.
- `Collection` stores a collection name, icon, and optional color.
- `User` stores local or Google account identity, including optional first name, handle, email, avatar URL, Google subject, provider, and last login.
- `UserSettings` stores theme, language, layout, startup page, sidebar state, primary collection, favorite tags, and quick pins.
- `ActivityItem` stores recent note activity shown in the dashboard and profile.

## Sync Entities

- `SyncState` stores Google Drive connection state and Drive file IDs.
- `SyncItem` tracks queued, synced, conflicted, and deleted local entities.
- `DeviceSession` stores NoteX sync devices shown in the profile.
- `CloudNoteFile`, `CloudWorkspaceFile`, and `CloudManifestFile` define the Google Drive payload format.

Keep this document high-level. Update `src/core/models/models.ts` first when the schema changes.
