# Note Editing Implementation Plan

Goal: evolve the note detail page into a local-first note creation and editing experience while preserving the visual structure of `Documentation/Layout/note_page.png`.

NoteX V1 should be a real daily-driver offline-first knowledge management app. It began as a personal linguistic-doubt database for translation/proofreading work, but the product direction is now broader: a structured note-based knowledge base for general use.

Backend, auth, sync, file upload, image attachments, and cloud storage are out of scope for these steps. All behavior should remain local and persistent through the existing Zustand + Dexie/IndexedDB setup. Future versions may add Google Drive backup/sync and image/file attachments.

## Product Decisions

- Notes remain structured for V1 and keep the current sections:
  - title
  - collection
  - tags
  - intro
  - summary
  - explanation
  - usage examples
  - tip
  - additional examples
  - related links / linked notes
  - backlinks
- Note types are labels only for now. They should not create different templates or editing flows.
- Read mode should stay close to the existing reference layout.
- Edit mode may introduce clear inline editor panels inside each section, as long as the read-mode layout remains faithful.
- Main note editing uses a page-level edit mode for V1:
  - existing notes show a single `Edit` button near the note heading
  - clicking `Edit` makes collection, title, intro, summary, explanation, usage examples, and tip editable together
  - `Save` commits the whole page draft
  - `Cancel` restores the saved note state
- Tags, additional examples, and related links keep their focused controls for now.
- New notes should not immediately persist as complete saved notes. A new note becomes persistent after the user clicks page-level `Save`.
- New-note creation requires a title.
- Markdown editing should use `Text` and `Preview` tabs.
- `Text` mode exposes raw Markdown.
- `Preview` mode is read-only for V1, matching the rendered final look before the user accepts changes.
- Images are intentionally deferred. Do not add image URL insertion, local upload, attachment tables, or image export/import in this phase.
- Success criterion: the user can create a blank note, edit title/body/tags/examples/links, reload, and everything persists locally.

## Step 1: Editing Foundation

- Add reusable edit primitives:
  - `EditableTextField` for simple fields such as title and brief description.
  - Pencil icon in read mode.
  - Checkmark and X icons in edit mode.
  - `MarkdownEditor` with textarea, formatting toolbar, and `Text` / `Preview` tabs.
  - Markdown editor uses visible `Accept` and `Cancel` buttons.
- Markdown support should cover the V1 subset:
  - headings
  - bold
  - italic
  - unordered lists
  - ordered lists
  - blockquotes
  - inline code
  - fenced code blocks
  - links
  - tables
  - checkboxes if practical
- Raw HTML should not be supported in Markdown rendering for V1.
- Add polished rendered styles for Markdown tables so they visually align with the existing usage examples table.
- Add local store actions for updating note content.
- Keep this step focused on foundations, not full page conversion.

## Step 2: Editable Header

- Make these fields editable on `NoteDetailPage`:
  - title
  - brief description / intro
  - collection
- Keep the layout close to `note_page.png`.
- Persist accepted edits to IndexedDB.
- Cancel should restore the previous value.

## Step 3: Tags

- Improve note-level tag editing:
  - add existing tag
  - remove tag
  - create a new tag from the tag picker
- Newly created tags persist locally.
- New tags become immediately selectable and attachable to the current note.
- Add tag/label management in the profile page or a dedicated labels page, whichever fits the existing app structure better:
  - create labels
  - rename labels
  - change label color
  - delete labels
- Deleting a label should remove it from all notes that reference it.

## Step 4: Markdown Sections

- Add Markdown editor support for:
  - summary
  - explanation
  - tip box
- Toolbar options:
  - bold
  - italic
  - heading
  - bullet list
  - numbered list
  - quote
  - code
  - link
  - table menu
- The table toolbar control should be a menu trigger, not a direct default action:
  - show a table icon with a small arrow/chevron indicator
  - open a compact popover on click/tap, with hover behavior acceptable on desktop
  - menu actions:
    - insert table
    - add row above
    - add row below
    - add column left
    - add column right
  - omit delete row/delete column for V1; users can remove Markdown manually in the editor
- Table row/column actions may infer the current table from the textarea cursor position.
- If a row/column action is used outside an existing Markdown table, either disable it or insert a new table.
- In read mode, render Markdown nicely.
- In edit mode, show editor plus `Accept` and `Cancel`.

## Step 5: Usage Examples Table

- Keep the usage examples section as a dedicated structured table editor, not a generic Markdown field.
- Make the examples table editable as a whole table:
  - add row
  - edit expression
  - edit meaning
  - edit example text
  - delete row
- Entering edit mode should make all rows and all columns editable at once.
- Expression, meaning, and example cells should all use textareas.
- The user should be able to accept or cancel the full table edit as one operation.
- Use compact editing controls so the table still resembles the mockup.
- Example text can use the Markdown editor in compact mode if it does not make the table feel too heavy.

## Step 6: Additional Examples + Links

- Additional examples:
  - add
  - edit
  - delete
- Linked to:
  - link existing note
  - link external URL
  - delete link
- External URL linking:
  - user enters a display name
  - user enters the URL
  - accepted links persist locally
- Existing note linking:
  - provide a searchable note picker
  - the link input placeholder should clearly indicate that typing `/` searches existing notes
  - when the user types `/`, show a filtered list of existing notes
  - while the user keeps typing after `/`, filter the list by the typed query
  - selecting a note should set the link name to the selected note title
- Backlinks:
  - show notes that link back to the current note
  - display backlinks as a sub-section inside the `Linked to` / related links area
- Keep all changes local and persistent.

## Step 7: New Note Creation Flow

- Make `New Note` open a proper editable draft.
- Draft starts with empty title, description, summary, explanation, examples, and tip.
- Tags, additional examples, and related links can be managed after the note is saved, using the existing focused controls.
- User can build the main note body using the same page-level editing controls.
- The draft should persist to IndexedDB only after the user clicks page-level `Save`.
- Save should refuse to create a new note until the title is filled.
- Once persisted, the note should be recoverable after reload.
- Save state should show unsaved draft / editing draft / local draft / saved locally using the existing top-bar area.

## Step 8: QA + Visual Pass

- Run `npm run typecheck`.
- Run `npm run build`.
- Check:
  - existing note read mode still matches `note_page.png`
  - edit mode is clear and polished
  - cancel restores previous values
  - accepted edits persist after reload
  - new tags, examples, and links persist locally
  - Markdown preview renders headings, lists, code, blockquotes, links, tables, and checkboxes as expected
  - table menu actions work when the cursor is inside a Markdown table
  - row/column table actions handle non-table cursor positions predictably
  - new-note drafts persist only after a saved field
  - backlinks update after linking notes
  - deleted labels are removed from notes

Recommended starting point: Step 1, because the reusable editing primitives make every later step smaller and easier to review.
