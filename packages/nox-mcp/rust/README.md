# nox-mcp

Native MCP server and cancellable request brokers with no Tauri dependency.
See the [repository documentation](https://github.com/mapherez/mcp).

Configure a manifest with input/output JSON Schemas and provide an `Executor`.
`McpServer` implements `rmcp::ServerHandler`; attach an `rmcp` stdio or Streamable
HTTP transport. `RequestBroker<T>` delivers through an injected emit callback.
`ExecutionRegistry` associates work with a generation and deadline, rejects
duplicates, and prevents late responses from crossing connection replacements.
`CredentialStore<T>` is an adapter interface; the crate does not store secrets.

Cancellation is cooperative. Check validity immediately before a mutation;
transactions already completed are not rolled back. Defaults: 20 seconds,
2 MiB and 32 requests. No replay or exactly-once guarantee.
