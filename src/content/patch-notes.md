# 2.0.0

## What's New in NoteX

This release makes block-based Notes the default NoteX experience.

### Highlights

- Replaced the old note system with the new block-based Notes editor.
- Added flexible note blocks with autosave, drag reorder, delete confirmation, and table of contents.
- Added rich editing with toolbar shortcuts, active formatting states, tables, checklists, links, tips, images, and file attachments.
- Updated Notes, search, dashboard, favorites, recent, trash, tags, and collections to use the new Notes model.
- Added `.notex` package export/import for local backups with database and files.
- Improved startup and editor loading with route splitting, async editor chunks, and loading indicators.
- Polished Notes list behavior, pinned note reordering, menus, tooltips, and New Note handling.

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
