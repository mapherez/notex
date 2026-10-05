use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Runtime};
pub(crate) use nox_mcp::BrokerError as McpRequestBrokerError;
pub(crate) const REQUEST_EVENT: &str = "notex://mcp-request";
const LOCAL_REQUEST_ID_PREFIX: &str = "local-mcp-";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopResponse {
    pub(crate) request_id: String, pub(crate) ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")] pub(crate) result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")] pub(crate) error: Option<DesktopBridgeError>,
    #[serde(skip_serializing_if = "Option::is_none", default)] pub(crate) generation: Option<String>,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopBridgeError {
    pub(crate) code: String, pub(crate) message: String, pub(crate) retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")] pub(crate) current_version: Option<u64>,
}
#[derive(Clone)]
pub(crate) struct McpRequestBroker { broker: nox_mcp::RequestBroker<DesktopResponse> }
impl McpRequestBroker {
    pub(crate) fn new() -> Self { Self { broker: nox_mcp::RequestBroker::new(nox_mcp::BrokerOptions { id_prefix: LOCAL_REQUEST_ID_PREFIX.into(), ..Default::default() }) } }
    pub(crate) fn owns_request_id(id: &str) -> bool { id.starts_with(LOCAL_REQUEST_ID_PREFIX) }
    pub(crate) async fn is_pending(&self, id: &str) -> bool { self.broker.is_pending(id).await }
    pub(crate) async fn dispatch<R: Runtime>(&self, app: &AppHandle<R>, command: String, input: Value) -> Result<DesktopResponse, McpRequestBrokerError> {
        self.broker.dispatch(command, input, |event| app.emit(REQUEST_EVENT, event).map_err(|_| McpRequestBrokerError::RendererUnavailable)).await
    }
    pub(crate) async fn respond(&self, response: DesktopResponse) -> Result<(), McpRequestBrokerError> {
        if !Self::owns_request_id(&response.request_id) || response.ok != response.result.is_some() || response.ok == response.error.is_some() { return Err(McpRequestBrokerError::InvalidRequest); }
        self.broker.respond(&response.request_id.clone(), response).await
    }
    pub(crate) async fn cancel_all(&self) { self.broker.cancel_all().await; }
}
#[tauri::command]
pub(crate) async fn notex_local_mcp_request_pending(broker: tauri::State<'_, McpRequestBroker>, request_id: String) -> Result<bool, String> { Ok(broker.is_pending(&request_id).await) }
