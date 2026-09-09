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
`get_trash_status`, `list_tags`, and `list_collections`.

`search_notes` treats each word as an independent search term. A note is
included when any term appears in its title, subtitle, block titles, block
content, tags, or collection. Notes matching more distinct terms are ranked
first, followed by match source and most recent update.

Write tools: `create_note`, `update_note_header`, `add_note_block`,
`update_note_block`, `delete_note_block`, `reorder_note_blocks`,
`set_note_tags`, `set_note_favorite`, `set_note_pinned`, and
`set_note_thumbnail`.

Organization tools: `create_tag`, `update_tag`, `delete_tag`,
`create_collection`, `update_collection`, and `delete_collection`.
Deleting a tag removes it from affected notes. Deleting a collection leaves
affected notes without a collection.

Linked-content tools: `add_linked_note`, `remove_linked_note`,
`add_note_example`, `update_note_example`, `delete_note_example`,
`add_note_link`, and `delete_note_link`.

Trash tools: `move_note_to_trash`, `restore_note`,
`delete_note_permanently`, and `clear_trash`.

Read the current note version before editing; send it as `expectedVersion`.
An outdated version or unsaved local edits prevents an MCP edit. Wait for local
edits to save and read the note again before proposing an updated edit.
Notes in the trash can be read but their content cannot be edited through MCP.
They can be restored or deleted permanently. Moving, restoring, and permanently
deleting one note requires its current `expectedVersion`.

`get_note` returns the IDs and ordered values needed by these operations,
including note state, linked notes, examples, related links, and blocks. Linked
notes are added and removed individually. They are directional; adding a link
does not create a reciprocal link. Block reordering requires the complete
ordered list of current block IDs.

Permanent deletion cannot be undone. Before `clear_trash`, the client calls
`get_trash_status` and passes its `stateToken`. If the trash has changed, the
clear call fails without deleting anything and the client must check it again.

Text and supported HTML formatting are accepted. Attachments and images are not
accepted through MCP. Existing attachments are removed from local storage when
their complete block is deleted.

### Rich text

Use `{ "format": "text", "value": "..." }` for literal text or
`{ "format": "html", "value": "..." }` for formatting. Note and block
headers support inline formatting: bold, italic, underline, strike, inline code,
links, text color, and highlights.

Block bodies additionally support headings, alignment, bullet and ordered
lists, checklists, quotes, tips, code blocks, horizontal rules, and tables. Use
one `<tr>` per table row and one `<th>` or `<td>` per column, with cell content
inside `<p>`. Checklists use `data-type="taskList"` and
`data-type="taskItem"`; tips use `<notex-tip title="Tip">`.

Rich-text values sent to an update tool replace that complete field. Read the
current block first, preserve the parts that should remain, and then submit the
complete updated HTML. The exact supported syntax and NoteX color palette are
also published in each relevant MCP tool schema.

## Local Access

There is no authentication token in this version. Any local process able to
connect to the port can use the tools while MCP is running. Enable write
approvals in your AI client when available, especially for permanently
destructive tools, and stop MCP when finished.
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
