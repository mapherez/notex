# Troubleshooting

Start by checking the current app state and the message shown. If a problem involves your library, preserve the database and files before attempting recovery.

## MCP cannot connect

- Confirm NoteX is open and **Start MCP** has been selected.
- Copy the current URL from **Profile → Configure MCP**.
- Confirm the client supports **Streamable HTTP**, rather than only STDIO.
- Run the client on the same computer. A remote website cannot directly reach `127.0.0.1` on your computer.
- If the port is occupied, choose another port and update the client configuration.

See [MCP setup](mcp-setup.md) for the complete connection flow.

## An AI edit was rejected

The note may have changed since the client read it, or there may be local edits waiting to save. Wait for local edits to save, then ask the client to read the note again and retry against its current version.

An AI client cannot edit the content of a note in trash. Restore it first if you want to continue writing.

## An imported note has missing labels or links

Single-note imports match organization and linked-note relationships against the receiving library. A tag, collection, or linked note that cannot be matched may be skipped.

Check the import result, then assign the desired collection or tags and recreate links in the app. The [import guide](import-export.md) explains how this differs from a full-workspace restore.

## Database compatibility errors

An unsupported or missing schema version is a compatibility problem, not a reason to delete the library. NoteX stops opening that database instead of resetting its tables.

Keep the database and attached files intact. Check whether you are opening data with an older app version. If the issue persists, [report it](https://github.com/mapherez/notex/issues) with your app version and the complete error message. Do not post your database or private notes publicly.

## A keyboard command does something unexpected

Check which control has focus. Arrow keys edit or navigate text inside an editor, while **Up** and **Down** reorder a block only when its handle has focus.

For dropdowns, press **Enter** to open first. For the thumbnail picker, navigation starts on the first thumbnail. See [shortcuts and focus](keyboard.md).

## The phone shows a rotate notice

NoteX on phones works in portrait orientation. Rotate your phone back to portrait to continue using the app. For navigation and touch controls, see the [tablet and phone guide](mobile-tablet.md).

## Report a reproducible problem

Include your NoteX version, the steps that led to the issue, and what you expected to happen. For desktop issues, include your Windows version; for browser issues, include the device and browser. An exact error message and a screenshot with private content removed are useful.

If the issue involves data loss, avoid further edits until you have preserved a copy of the affected files.
