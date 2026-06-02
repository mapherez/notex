# Data Model

The authoritative model definitions live in `src/core/models/models.ts`.

## Core Entities

- `Note` stores the note header, subtitle, tags, collection membership, favorite/pin/trash state, thumbnail variant, statistics, related links, and ordered block/file relations.
- `NoteBlock` stores one ordered note block with a text-only title and optional Tiptap JSON content.
- `NoteFile` stores metadata for files copied into the app data `files` folder and referenced by note blocks.
- `Tag` stores a label name, optional color, and optional computed count for display contexts.
- `Collection` stores a collection name, icon, and optional color.
- `User` stores local account identity, including optional first name, handle, email, avatar URL, and last login.
- `UserSettings` stores theme, language, layout, startup page, sidebar state, primary collection, favorite tags, pinned notes, quick pins, and hidden note panels.
- `ActivityItem` stores recent note activity shown in the dashboard and profile.

Keep this document high-level. Update `src/core/models/models.ts` first when the schema changes.

## Local Packages

`.notex` exports bundle the SQLite database plus the app data `files` folder. The profile UI uses `.notex` packages so note attachments are included.
