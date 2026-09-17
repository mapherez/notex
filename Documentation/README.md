# NoteX Documentation

NoteX is a local-first knowledge management app. Desktop libraries use SQLite
and local attachments; browser libraries use IndexedDB. Google Drive backup
stores note JSON and attachments in the user's own Drive, with separate local
libraries for each Google account.

## User Guides

- [Google Drive and browser mode](../landing/docs/content/google-drive-web.md):
  sign in, understand backups, use notes offline, and switch accounts.
- [Local MCP](MCP_LOCAL_USER_GUIDE.md): connect a compatible AI client directly
  to NoteX, review the available tools, and understand the local access model.

## Developer Documentation

Architecture references and future implementation plans are kept separately in
[Developer](Developer/README.md).
