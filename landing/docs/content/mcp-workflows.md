# Tools & workflows

MCP exposes NoteX actions to a compatible AI client. It does not run an AI model inside NoteX: the connected client decides when and how to use those actions.

## What a client can do

| Area | Available actions |
| --- | --- |
| Read | Check status, search notes, read notes and blocks, list tags and collections |
| Write | Create notes, update headers, add or edit blocks, delete or reorder blocks |
| Organize | Manage tags and collections, set favorites, pins, and thumbnails |
| Connect content | Manage linked notes, examples, and related links |
| Trash | Move, restore, permanently delete notes, and clear trash |

Images and attachment uploads are not accepted through MCP. Add those through the app. Deleting a complete block through MCP also removes its associated stored files.

## Find and summarize

Try a prompt such as:

> Search my NoteX library for release planning. Read the relevant notes and summarize the remaining decisions, with the note titles as references.

The client can search across titles, subtitles, block content, tags, and collections, then read the results it needs.

## Turn information into a note

> Create a note called “Project handover” with blocks for Overview, Decisions, and Next steps. Use the information from this conversation, and show me what you plan to save first.

The client can create structured blocks and use supported rich text. Ask it to preserve useful structure instead of putting a whole document into one unformatted field.

## Organize existing notes

> Find my notes about cooking, suggest which tags they should have, and wait for my approval before changing them.

You can also ask a client to move block sections, link related notes, or update examples. Linked-note relationships are directional: adding one does not create the reverse relationship automatically.

## How edit protection works

A client must read a note's current version before editing and send it as `expectedVersion`. An outdated version or unsaved local edits blocks the MCP edit.

If an edit is rejected, let local changes save and ask the client to read the current note again before retrying. Rich-text updates replace the complete field, so the client should preserve any content that still belongs there.

If a connection drops during a write, a missing response does not tell you whether the write happened. Read the note again before repeating a creation or edit.

## Destructive actions

Notes in trash can be read, restored, or permanently deleted, but their content cannot be edited through MCP.

Permanent deletion cannot be undone. Clearing trash also checks its current state: if trash changed after the client checked it, the clear request fails rather than deleting a different set of notes.

Use client approvals for destructive actions, and keep [exported backups](import-export.md) for content you need to preserve.
