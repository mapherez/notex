# Note Editing Implementation Plan

Goal: evolve the note detail page into a local-first note creation and editing experience while preserving the visual structure of `Documentation/Layout/note_page.png`.

Backend, auth, sync, file upload, and cloud storage are out of scope for these steps. All behavior should remain local and persistent through the existing Zustand + Dexie/IndexedDB setup.

## Step 1: Editing Foundation

- Add reusable edit primitives:
  - `EditableTextField` for simple fields such as title and brief description.
  - Pencil icon in read mode.
  - Checkmark and X icons in edit mode.
  - `MarkdownEditor` with textarea and formatting toolbar.
  - Markdown editor uses visible `Accept` and `Cancel` buttons.
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

- Improve tag editing:
  - add existing tag
  - remove tag
  - create a new tag from the tag picker
- Newly created tags persist locally.
- New tags become immediately selectable and attachable to the current note.

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
  - image URL
- In read mode, render Markdown nicely.
- In edit mode, show editor plus `Accept` and `Cancel`.

## Step 5: Usage Examples Table

- Make the examples table editable:
  - add row
  - edit expression
  - edit meaning
  - edit example text
  - delete row
- Use compact editing controls so the table still resembles the mockup.
- Example text can use the Markdown editor in compact mode.

## Step 6: Additional Examples + Links

- Additional examples:
  - add
  - edit
  - delete
- Linked to:
  - link existing note
  - link external URL
  - delete link
- Keep all changes local and persistent.

## Step 7: New Note Creation Flow

- Make `New Note` open a proper editable draft.
- Draft starts with empty title, description, summary, explanation, examples, and tip.
- User can build the full note using the same editing controls.
- Save state should show as local/draft/saved using the existing top-bar area.

## Step 8: QA + Visual Pass

- Run `npm run typecheck`.
- Run `npm run build`.
- Check:
  - existing note read mode still matches `note_page.png`
  - edit mode is clear and polished
  - cancel restores previous values
  - accepted edits persist after reload
  - new tags, examples, and links persist locally

Recommended starting point: Step 1, because the reusable editing primitives make every later step smaller and easier to review.
