<!-- markdownlint-disable MD025 -->
<!-- markdownlint-disable MD024 -->
# 2.0.0

## What's New in NoteX

Implemented the Dynamic Notes pass across the app.

### Highlights

- Added separate SQLite-backed Dynamic Note tables and Tauri commands for `.notex` package export/import plus dynamic file import/open/export.
- Added `useDynamicNotesStore`, dynamic note models, filters, file services, and package services.
- `/notes` is now the Dynamic Notes experience; Classic Notes moved to `/classic-notes`.
- Sidebar New Note is now a split button for Dynamic Note vs Classic Note.
- Built the Dynamic Note editor with header fields, empty state, add-block controls, block drag/reorder/delete, autosave, TOC, configurable right panels, sticky toolbar, and selection bubble toolbar.
- Integrated Tiptap JSON storage per block, including tables, task lists, links, colors/highlights, text alignment, images, and attachment cards.
- Added Classic Note migration action on Classic detail pages.
- Updated profile backup/import to use `.notex` packages.
- Updated docs and locale strings.

### Notes

- Dashboard quick capture still creates Classic Notes during the migration period, but Classic IDs now redirect correctly from `/notes/:id` to `/classic-notes/:id`.

---

# 1.3.1

- Implemented global shortcut for navigating to the profile page using "Ctrl / ⌘ + U".
- Added a new shortcut help modal to display available keyboard shortcuts.
- Updated styles for the shortcut help modal and its components.
- Enhanced keyboard navigation experience across various pages.
- Added patch notes modal.

---

# 1.3.0

## What's New in NoteX

This release brings a major polish pass to notes, editing, colors, keyboard navigation, and organization.

### Highlights

- Added text color and background highlight support across markdown editors.
- Added a new 20-color preset palette for tags, collections, and text formatting.
- Improved rich paste support from websites, Word-like editors, and formatted sources.
- Added keyboard navigation and shortcuts across search, filters, dashboard, note editing, tags, and collections.
- Improved pinned notes with a separate pinned section, manual ordering, and clearer pin/favorite controls.
- Added drag-and-drop ordering for favorite tags and note tags.
- Added safer in-app confirmation modals for deleting tags, collections, and clearing trash.
- Improved the note editor with a shared sticky toolbar, better preview/edit flow, and smarter formatting toggles.
- Refined layouts for notes, collections, headers, filters, and grid/list views.
- External links in notes now open in the system default browser.
- Trash now supports deleting individual notes permanently.

### Improvements

- Better formatting rendering across note details, note rows, dashboard cards, search results, and examples.
- Search, sorting, and stats now ignore formatting tokens for cleaner results.
- Note title and rename fields now focus automatically when editing.
- Selection is cleared correctly when changing note list context.
- Pinned note ordering is preserved more reliably.
- Note footers now show the actual edited timestamp instead of reading time.
- Added English and Portuguese labels for the new UI elements.
