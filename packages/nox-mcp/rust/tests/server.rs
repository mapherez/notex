use nox_mcp::{
    error_result, load_tools, tool_result, ExecutionContext, Executor, McpServer, ServerOptions,
};
use rmcp::{
    model::{CallToolRequestParams, CallToolResult},
    ServiceExt,
};
use serde_json::{json, Value};
use std::{sync::Arc, time::Duration};

#[derive(Clone)]
struct Echo;
impl Executor for Echo {
    async fn execute(
        &self,
        name: String,
        input: Value,
        context: ExecutionContext,
    ) -> CallToolResult {
        if !context.is_active() {
            return error_result("CANCELLED", "Cancelled", false);
        }
        if name == "write" {
            context.cancellation.cancelled().await;
            return tool_result(input, false);
        }
        tool_result(input, false)
    }
}
#[tokio::test]
async fn official_client_validates_inputs_outputs_and_write_timeouts() {
    let schema =
        json!({"type":"object","required":["message"],"properties":{"message":{"type":"string"}}});
    let manifest = json!({"schemaVersion":1,"protocolVersion":"2.0","tools":[{"name":"echo","title":"Echo","description":"Echo","inputSchema":schema,"outputSchema":schema,"annotations":{"readOnlyHint":true}},{"name":"write","title":"Write","description":"Wait","inputSchema":schema,"outputSchema":schema,"annotations":{"readOnlyHint":false}}]});
    let tools = load_tools(&manifest.to_string()).unwrap();
    assert_eq!(tools.len(), 2);
    let server = McpServer::new(
        "Echo".into(),
        "1".into(),
        Arc::new(tools),
        Echo,
        ServerOptions {
            timeout: Duration::from_millis(30),
            ..Default::default()
        },
    )
    .unwrap();
    let (server_transport, client_transport) = tokio::io::duplex(65536);
    let running = tokio::spawn(async move { server.serve(server_transport).await.unwrap() });
    let client = ().serve(client_transport).await.unwrap();
    let server = running.await.unwrap();
    let listed = client.list_all_tools().await.unwrap();
    assert_eq!(listed.len(), 2);
    assert!(listed[0].output_schema.is_some());
    let call = |name: &str, input: Value| {
        CallToolRequestParams::new(name.to_owned())
            .with_arguments(input.as_object().unwrap().clone())
    };
    let result = client
        .call_tool(call("echo", json!({"message":"hello"})))
        .await
        .unwrap();
    assert_eq!(result.structured_content, Some(json!({"message":"hello"})));
    let invalid = client
        .call_tool(call("echo", json!({"message":123})))
        .await
        .unwrap();
    assert_eq!(invalid.is_error, Some(true));
    let timeout = client
        .call_tool(call("write", json!({"message":"hello"})))
        .await
        .unwrap();
    assert_eq!(
        timeout.structured_content.as_ref().unwrap()["code"],
        "TIMEOUT"
    );
    assert_eq!(
        timeout.structured_content.as_ref().unwrap()["retryable"],
        false
    );
    client.cancel().await.unwrap();
    server.cancel().await.unwrap();
}
