# Local MCP

Open NoteX, open Profile, and select **Start MCP**. Open **Configure MCP** to
copy the current URL or the generic connection details. The configuration stays
available every time you open Profile. Stop MCP with **Stop MCP**.

Use these values in a client that supports custom local Streamable HTTP servers:

```text
Name: NoteX
Transport: Streamable HTTP
URL: http://127.0.0.1:47321/mcp
Authentication: None
```

The port above is the default. Always copy the current value from NoteX if you
have changed it. The client must run on the same computer. A hosted AI website
cannot use this address to reach your computer directly. The preserved remote
backend is a separate future connection option.

NoteX starts with MCP stopped. It must remain open and MCP must remain online
for tool calls to work. No Google account, backend or cloud synchronization is
needed. Note data remains in the existing local SQLite database. Data returned
to an AI client is subject to that client's own processing and privacy settings.

## Tools

Read tools: `notex_status`, `search_notes`, `get_note`, `get_note_block`,
`list_tags`, and `list_collections`.

Write tools: `create_note`, `update_note_header`, `add_note_block`,
`update_note_block`, and `set_note_tags`.

Read the current note version before editing; send it as `expectedVersion`.
An outdated version or unsaved local edits prevents an MCP edit. Wait for local
edits to save and read the note again before proposing an updated edit.
Notes in the trash can be read but cannot be changed through MCP.

Text and supported HTML formatting are accepted. Attachments and images are not
accepted through MCP. Tags and collections must already exist in NoteX.

## Local Access

There is no authentication token in this version. Any local process able to
connect to the port can use the tools while MCP is running. Enable write
approvals in your AI client when available, and stop MCP when finished.
The server binds only to `127.0.0.1`, rejects browser Origin headers, and does not
enable CORS. It limits request bodies to 2 MiB, in-flight tool calls to 32, and
HTTP requests to 60 per second. HTTP 429 includes `Retry-After: 1`.

If the port is occupied, stop MCP, choose another port in Configure MCP and
update the client URL. Multiple NoteX instances must use different ports;
choose the endpoint belonging to the intended instance.

Requests are not queued for later use or replayed after reconnection. A lost
response during a write does not establish whether the local commit happened.
Read the note after reconnecting before retrying, especially for note creation.

Windows is the current validation target. macOS/Linux release validation remains
separate. Local client compatibility requires Streamable HTTP; STDIO is not
provided by this version.
