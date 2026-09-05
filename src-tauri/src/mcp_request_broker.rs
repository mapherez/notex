use std::{
    collections::HashMap,
    fmt,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::{oneshot, Mutex};

pub(crate) const REQUEST_EVENT: &str = "notex://mcp-request";

const LOCAL_REQUEST_ID_PREFIX: &str = "local-mcp-";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_IN_FLIGHT_REQUESTS: usize = 32;
const MAX_PAYLOAD_BYTES: usize = 2 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct McpRequestEvent {
    pub(crate) request_id: String,
    pub(crate) command: String,
    pub(crate) input: Value,
    pub(crate) deadline_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopResponse {
    pub(crate) request_id: String,
    pub(crate) ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) error: Option<DesktopBridgeError>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DesktopBridgeError {
    pub(crate) code: String,
    pub(crate) message: String,
    pub(crate) retryable: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) current_version: Option<u64>,
}

#[derive(Clone, Debug)]
pub(crate) enum McpRequestBrokerError {
    InvalidRequest,
    Overloaded,
    RendererUnavailable,
    Timeout,
    Cancelled,
    UnknownRequest,
}

impl fmt::Display for McpRequestBrokerError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let message = match self {
            Self::InvalidRequest => "The MCP request is invalid.",
            Self::Overloaded => "NoteX has too many MCP requests in progress.",
            Self::RendererUnavailable => "The NoteX renderer is unavailable.",
            Self::Timeout => "The MCP request timed out.",
            Self::Cancelled => "The MCP request was cancelled.",
            Self::UnknownRequest => "The MCP request is no longer pending.",
        };
        formatter.write_str(message)
    }
}

impl std::error::Error for McpRequestBrokerError {}

type PendingResult = Result<DesktopResponse, McpRequestBrokerError>;

struct BrokerInner {
    pending: Mutex<HashMap<String, oneshot::Sender<PendingResult>>>,
    next_request_id: AtomicU64,
}

#[derive(Clone)]
pub(crate) struct McpRequestBroker {
    inner: Arc<BrokerInner>,
}

impl McpRequestBroker {
    pub(crate) fn new() -> Self {
        Self {
            inner: Arc::new(BrokerInner {
                pending: Mutex::new(HashMap::new()),
                next_request_id: AtomicU64::new(1),
            }),
        }
    }

    pub(crate) fn owns_request_id(request_id: &str) -> bool {
        request_id.starts_with(LOCAL_REQUEST_ID_PREFIX)
    }

    pub(crate) async fn dispatch<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        command: String,
        input: Value,
    ) -> Result<DesktopResponse, McpRequestBrokerError> {
        if command.is_empty()
            || command.len() > 64
            || serde_json::to_vec(&input)
                .map_err(|_| McpRequestBrokerError::InvalidRequest)?
                .len()
                > MAX_PAYLOAD_BYTES
        {
            return Err(McpRequestBrokerError::InvalidRequest);
        }

        let request_id = format!(
            "{LOCAL_REQUEST_ID_PREFIX}{}",
            self.inner.next_request_id.fetch_add(1, Ordering::Relaxed)
        );
        let (sender, receiver) = oneshot::channel();

        {
            let mut pending = self.inner.pending.lock().await;
            if pending.len() >= MAX_IN_FLIGHT_REQUESTS {
                return Err(McpRequestBrokerError::Overloaded);
            }
            pending.insert(request_id.clone(), sender);
        }

        let deadline_at = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
            .saturating_add(REQUEST_TIMEOUT.as_millis())
            .to_string();
        let request = McpRequestEvent {
            request_id: request_id.clone(),
            command,
            input,
            deadline_at,
        };

        if app.emit(REQUEST_EVENT, &request).is_err() {
            self.inner.pending.lock().await.remove(&request_id);
            return Err(McpRequestBrokerError::RendererUnavailable);
        }

        match tokio::time::timeout(REQUEST_TIMEOUT, receiver).await {
            Ok(Ok(result)) => result,
            Ok(Err(_)) => Err(McpRequestBrokerError::Cancelled),
            Err(_) => {
                self.inner.pending.lock().await.remove(&request_id);
                Err(McpRequestBrokerError::Timeout)
            }
        }
    }

    pub(crate) async fn respond(
        &self,
        response: DesktopResponse,
    ) -> Result<(), McpRequestBrokerError> {
        if !Self::owns_request_id(&response.request_id)
            || serde_json::to_vec(&response)
                .map_err(|_| McpRequestBrokerError::InvalidRequest)?
                .len()
                > MAX_PAYLOAD_BYTES
        {
            return Err(McpRequestBrokerError::InvalidRequest);
        }

        let sender = self
            .inner
            .pending
            .lock()
            .await
            .remove(&response.request_id)
            .ok_or(McpRequestBrokerError::UnknownRequest)?;
        sender
            .send(Ok(response))
            .map_err(|_| McpRequestBrokerError::UnknownRequest)
    }

    pub(crate) async fn cancel_all(&self) {
        let senders = {
            let mut pending = self.inner.pending.lock().await;
            pending.drain().map(|(_, sender)| sender).collect::<Vec<_>>()
        };

        for sender in senders {
            let _ = sender.send(Err(McpRequestBrokerError::Cancelled));
        }
    }
}
