# 2.2.2

## What's New in NoteX

This release expands local MCP access across the remaining note organization and content-management features.

### Highlights

- Expanded local MCP support with tag and collection management, note state,
  linked notes, examples, related links, and block organization tools.
- Added MCP block deletion and reordering with version checks and local-edit
  conflict protection.
- Deleting an inline image or attachment now also removes its stored file and database reference.

---

# 2.2.1

## What's New in NoteX

This release expands local MCP automation and refreshes the public NoteX website.

### Highlights

- Added MCP actions to move notes to trash, restore them, delete them permanently, and clear the entire trash.
- Added version and trash-state checks for safer destructive MCP operations.
- Permanent note deletion now also removes associated local attachment files.
- Improved MCP rich-text guidance for formatting, colors, alignment, checklists, tips, and tables with custom dimensions.
- Refreshed the NoteX landing page and added standalone public Privacy Policy and Terms of Service pages.

---

# 2.2.0

## What's New in NoteX

This release adds local MCP support, making it possible to connect compatible AI clients directly to NoteX while keeping notes stored locally.

### Highlights

- Added a local MCP server for searching, reading, creating, and editing notes through compatible AI clients.
- Added MCP controls, connection status, and configuration options to the Profile page and sidebar.
- Improved search with independent search terms, broader note-field matching, and relevance-based results.
- Introduced a shared modal system for a more consistent experience across the app.
- Moved Privacy and Terms into in-app modals without leaving the current page.
- Refined the Profile layout and added manual update checking.

---

# 2.1.0

## What's New in NoteX

This release adds a new custom window bar at the top, and a few UI/UX fixes.

### Highlights

- Added a new boot/loading screen
- Replaced the default window bar with a custom implementation, which will permit custom menus and buttons to exist there.
- Many UI/UX improvements
- Revamped Export/Import process:
  - NoteX can now export the whole database, including attached files, and maintain correct structure
  - When importing a database file, the user will be prompted if he wants to export the current database, as the import will overwrite everything
  - NoteX can also export/import individual notes

---

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
