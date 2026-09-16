# Connect an AI client

Local MCP lets a compatible AI client work with your NoteX library. The client must support a custom local **Streamable HTTP** MCP server and run on the same computer.

## Start the server

1. Open NoteX and go to **Profile**.
2. Select **Start MCP**.
3. Open **Configure MCP** and copy the current connection details.

NoteX starts with MCP stopped. It must remain open, and MCP must remain online, for tool calls to work.

## Add NoteX to your client

Use the client's custom MCP-server setup with the values copied from NoteX. The default connection is:

```text
Name: NoteX
Transport: Streamable HTTP
URL: http://127.0.0.1:47321/mcp
Authentication: None
```

Always copy the current URL from the app if you changed the port. The exact client configuration field names depend on that client's MCP support.

This release does not provide a STDIO server. A hosted AI website cannot use the loopback URL to reach your computer directly.

## Check the connection

Ask the client to check NoteX's status, list collections, or search for a note you know exists. Start with reading before asking it to change your library.

If it cannot connect, confirm NoteX is open, MCP is online, and the client's URL matches **Configure MCP**. See [troubleshooting](troubleshooting.md#mcp-cannot-connect) for common causes.

## Understand access

No NoteX account or cloud synchronization is needed. Notes remain in the existing local SQLite library.

There is no authentication token in this release. Other local processes able to connect to the port can use the tools while MCP is running. Enable write approvals in your AI client when available, especially for deletion, and stop MCP when finished.

Content read by an AI client is subject to that client's own processing and privacy settings. See [local storage and privacy](local-storage.md).

## Stop or change the connection

Select **Stop MCP** in Profile to stop access. If the port is occupied, stop MCP, choose another port in **Configure MCP**, and update your client's URL.

Multiple NoteX instances need different ports. Use the endpoint belonging to the library you intend to work with.
