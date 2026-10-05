use nox_mcp::{
    error_result, load_tools, tool_result, ExecutionContext, Executor, McpServer, ServerOptions,
};
use rmcp::{model::CallToolResult, ServiceExt};
use serde_json::{json, Value};
use std::sync::Arc;

#[derive(Clone)]
struct Echo;
impl Executor for Echo {
    async fn execute(&self, _: String, input: Value, context: ExecutionContext) -> CallToolResult {
        if !context.is_active() {
            return error_result("CANCELLED", "The request was cancelled", false);
        }
        tool_result(input, false)
    }
}

#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let schema = json!({"type":"object","required":["message"],"properties":{"message":{"type":"string","maxLength":200}}});
    let manifest = json!({"schemaVersion":1,"protocolVersion":"2.0","tools":[{
        "name":"echo","title":"Echo","description":"Echo a message",
        "inputSchema":schema,"outputSchema":schema,"annotations":{"readOnlyHint":true}
    }]});
    let server = McpServer::new(
        "NoX Echo".into(),
        "0.1.0".into(),
        Arc::new(load_tools(&manifest.to_string())?),
        Echo,
        ServerOptions {
            app_id: "echo".into(),
            ..Default::default()
        },
    )?;
    server
        .serve(rmcp::transport::stdio())
        .await?
        .waiting()
        .await?;
    Ok(())
}
