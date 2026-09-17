# Import, export & backups

NoteX has two package formats: one for an entire workspace and one for a single note. Both include the files belonging to what you export.

## Choose the right package

The package import/export actions below are desktop features. For automatic
backups and access from the browser, see [Google Drive and browser mode](google-drive-web.md).

| Format | Contains | Use it for |
| --- | --- | --- |
| `.notex` | The workspace database and attached files | Full backups and moving a complete library |
| `.notex-note` | One note's data and attached files | Sharing or importing a single note |

Exporting creates a separate copy. It does not move or remove your working notes.

## Export your workspace

1. Open **Profile** and the data-management section.
2. Choose the workspace export action.
3. Choose where to save the `.notex` package.
4. Keep the package somewhere independent of the working library.

For important work, repeat this regularly and retain more than one dated backup. A copy on the same failing disk cannot protect against that disk failing.

## Restore a workspace

A full-workspace import **replaces the current library**; it does not merge two libraries.

Choose the workspace import action in Profile and select a `.notex` package. NoteX prompts you to export the current database before replacement. Keep that export if there is anything in the current library you might need later.

> Check which library you are restoring and back up the current one before confirming replacement.

## Export one note

Use the note's export action to create a `.notex-note` package. It includes the note and its stored files, so you do not need to send attachments separately.

This format is a ZIP-based package containing `manifest.json`, `note.json`, and a `files` directory. You do not need to unpack it to import it into NoteX.

## Import one note

Use the single-note import action in Profile and choose the `.notex-note` package.

The import matches tags, the collection, and linked notes against the receiving library. Relationships that cannot be matched may be skipped. Review the import result: it reports imported files and any skipped organization or links.

A single-note package is useful for transferring one note, but it does not replace a full backup of your library.

## Keep exports private when needed

Packages contain your content and attached files. Treat them as copies of your notes, and store or share them accordingly. Exporting is not an encryption step.
