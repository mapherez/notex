# Local MCP Feature Parity Plan

## Goal

Expose the remaining note-management features of NoteX through the embedded
local MCP server while continuing to use the existing stores and SQLite v3
schema.

This work does not expose Profile, user settings, database management,
import/export, updates, MCP controls, or other private application settings.
File and image tools are also deferred.

## Status

- All implementation phases completed on 2026-09-09.
- Automated contract, dispatcher, manifest, Rust, and production-build
  validation completed. A live client smoke test remains release acceptance and
  should use disposable notes rather than existing user data.

## Scope

### New tools

Tags:

- `create_tag`
- `update_tag`
- `delete_tag`

Collections:

- `create_collection`
- `update_collection`
- `delete_collection`

Note state:

- `set_note_favorite`
- `set_note_pinned`
- `set_note_thumbnail`

Linked notes:

- `add_linked_note`
- `remove_linked_note`

Additional examples:

- `add_note_example`
- `update_note_example`
- `delete_note_example`

Related links:

- `add_note_link`
- `delete_note_link`

Blocks:

- `delete_note_block`
- `reorder_note_blocks`

### Existing tools retained

- `set_note_tags` remains the tag assignment operation. It replaces the full
  tag set and accepts only IDs returned by `list_tags`.
- `create_note` and `update_note_header` remain the collection assignment
  operations.

No duplicate `assign_tag` or `assign_collection` tools will be added.

## Contract Rules

- Every mutation of an existing note requires `expectedVersion`.
- Setters use explicit values rather than toggles, so retries cannot invert the
  intended favorite or pinned state.
- Fields omitted from an update remain unchanged.
- Trash notes remain read-only except for the existing restore and permanent
  deletion operations.
- Linked-note operations are individual and do not create reciprocal links
  implicitly. Adding rejects self-links, unknown IDs, and trash destinations;
  removing is idempotent and can clean a reference whose destination no longer
  exists.
- Example indexes refer to the ordered array returned by `get_note` and are
  protected by `expectedVersion`.
- Related links are deleted by their stable link ID.
- Block reordering receives the complete ordered list of current block IDs and
  rejects missing, duplicate, or unknown IDs.
- Tag and collection names are trimmed and cannot be empty. Colors are limited
  to the existing `TagColor` palette.
- Destructive tools are marked as destructive in MCP metadata.
- Tag and collection deletion reuses the existing store behavior that removes
  the deleted entity from affected notes.
- No new tables, columns, migrations, or persisted MCP state are introduced.

## Read Model

Extend `get_note` with the state required to use the new tools safely:

- `isFavorite`
- `isPinned`
- `thumbnail`
- ordered `linkedNoteIds`
- ordered `additionalExamples`
- `relatedLinks` with IDs, titles, and URLs

Files remain absent from the MCP response in this phase. Existing search
behavior is unchanged by this plan.

## Implementation Phases

### Phase 1: Shared Contract

1. Add Zod input and output schemas for all new commands.
2. Add scopes, descriptions, tool annotations, and public result types.
3. Extend the `get_note` output schema.
4. Regenerate the shared tool manifest.
5. Add focused contract tests for accepted and rejected payloads.

Completion: the contract package builds independently and the generated
manifest contains every new tool.

### Phase 2: Read Model and Note State

1. Extend the dispatcher DTO returned by `get_note`.
2. Add `set_note_favorite`, `set_note_pinned`, and `set_note_thumbnail`.
3. Reuse `useNotesStore`; add explicit setter methods where the store currently
   exposes only toggle methods.
4. Run all changes through the existing note mutation coordinator.

Completion: an MCP client can inspect and deterministically set the three note
state fields without changing unrelated fields.

### Phase 3: Tag and Collection Management

1. Implement create, update, and delete commands through
   `useKnowledgeStore`.
2. Return the resulting entity DTO after create/update and a stable deletion
   result after delete.
3. Before deleting an entity, acquire MCP mutation leases for every affected
   note. Fail instead of overwriting pending local edits.
4. Preserve the current behavior: deleting a tag unassigns it from notes, and
   deleting a collection moves affected notes to no collection.

Completion: tags and collections can be managed entirely by MCP without schema
changes or stale references.

### Phase 4: Linked Notes

1. Implement individual add and remove commands.
2. Validate source and target note IDs and prevent duplicate or self-links.
3. Reuse `updateNoteLinkedNotes` after deriving the new complete ID set.

Completion: links can be added and removed independently while preserving all
other linked notes.

### Phase 5: Examples and Related Links

1. Implement add, update, and delete for additional examples.
2. Implement add and delete for related links.
3. Validate non-empty example text, link title, and supported HTTP/HTTPS URLs.
4. Return created link IDs and the new note version.

Completion: the side-content features visible on a note can be read and edited
through MCP.

### Phase 6: Block Management

1. Implement `delete_note_block` with note and block validation.
2. Ensure deleting a block also removes any physical attachments owned by that
   block, preventing orphaned files even though file tools are out of scope.
3. Implement strict full-list block reordering.
4. Reuse the existing store transactions and mutation coordinator.

Completion: blocks can be created, edited, deleted, and reordered through MCP
without corrupting order or leaving block attachments behind.

### Phase 7: Integration and Documentation

1. Add dispatcher tests for success, stale versions, trash notes, invalid IDs,
   pending local edits, and destructive side effects.
2. Run the contract tests, MCP dispatcher tests, typecheck, and build once after
   implementation is complete.
3. Perform one end-to-end check with the running NoteX local MCP server.
4. Update the local MCP user guide and add concise unreleased patch notes.

Completion: the manifest, runtime dispatcher, user guide, and shipped local MCP
server expose the same tool set and the flow works from a real MCP client.

## Explicitly Deferred

- Listing, importing, inserting, or deleting files and images through MCP.
- Profile and user-preference operations.
- App updates, database import/export, and MCP start/stop controls.
- Bulk note operations beyond existing trash clearing.
- Remote backend integration.
- Any SQLite schema change.

## Definition of Done

- All 18 new tools are discoverable and executable through local Streamable
  HTTP.
- Existing 16 tools continue to work unchanged.
- All note mutations enforce optimistic versioning and local-edit conflict
  protection.
- Existing local notes open without migration and retain the same content.
- No profile, settings, file, or image data is newly exposed.
