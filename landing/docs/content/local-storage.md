# Local storage & privacy

The NoteX desktop app stores your library locally. It does not require an account to create, edit, organize, or export notes. Browser mode requires a Google account and stores each account's downloaded library in IndexedDB.

## Where your library lives

Notes and their organization are stored in a SQLite database in NoteX's local application-data directory. Imported images and attachments are stored with the library as files.

Use the folder-opening controls in **Profile → Data management** to locate your current data. Prefer the app's export controls when making a portable backup rather than copying a database while it is being written.

## Autosave

Edits are saved locally as you work. Autosave helps you continue where you left off, but it does not create an independent copy of your data elsewhere.

A disk failure or loss of the computer can also affect the local library. Keep [exported backups](import-export.md) on another drive or another location you control.

## Database compatibility

NoteX migrates supported database versions without resetting your notes, creating a consistent backup before migration. Unsupported, invalid, or missing schema versions in an existing database produce an error instead of deleting data.

If you see a compatibility error, keep the database and files intact. Do not delete them to dismiss the message. See [troubleshooting](troubleshooting.md#database-compatibility-errors).

## Optional AI access

Local MCP is stopped when NoteX starts. Enabling it lets compatible local clients access the supported tools while NoteX and MCP are running.

The server listens on your computer's loopback address. It is not a public internet endpoint. However, there is no authentication token in this release, so other local processes able to connect can use it while it is enabled.

An AI client may send the information it reads to its own online service. Local NoteX storage does not determine that client's data handling. Review the client and provider's settings before using sensitive notes.

## Public website

Google Drive backup is optional on desktop. When connected, NoteX uploads note
JSON and attachments directly to the application's area of your personal
Google Drive. Account libraries remain separate. Browser notes are stored
locally and backed up to that same Drive area; the NoteX host does not store
the library. See [Google Drive and browser mode](google-drive-web.md).

Reading this documentation does not give the website access to your desktop library. Downloads, release checks, and an online AI client are separate from editing notes offline.

Read the full [Privacy Policy](../privacy.html) for more information.
