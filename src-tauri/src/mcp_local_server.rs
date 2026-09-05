use std::{
    collections::HashSet,
    future::Future,
    net::{Ipv4Addr, SocketAddr},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use axum::{
    body::Body,
    http::{header::ORIGIN, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    Router,
};
use rmcp::{
    model::{
        CallToolRequestParams, CallToolResponse, CallToolResult, ContentBlock, Implementation,
        ListToolsResult, PaginatedRequestParams, ServerCapabilities, ServerInfo, Tool,
        ToolAnnotations,
    },
    service::{RequestContext, RoleServer},
    transport::streamable_http_server::{
        session::never::NeverSessionManager, StreamableHttpServerConfig, StreamableHttpService,
    },
    ErrorData, ServerHandler,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::{net::TcpListener, sync::Mutex, task::JoinHandle};
use tokio_util::sync::CancellationToken;

use crate::mcp_request_broker::{
    DesktopResponse, McpRequestBroker, McpRequestBrokerError,
};

const LOCAL_STATE_EVENT: &str = "notex://mcp-local-state";
const TOOL_MANIFEST_JSON: &str =
    include_str!("../../packages/notex-mcp-contract/generated/tool-manifest.json");
const TOOL_MANIFEST_SCHEMA_VERSION: u8 = 1;
const BRIDGE_PROTOCOL_VERSION: &str = "1.0";
const EXPECTED_TOOL_COUNT: usize = 11;
const MAX_REQUEST_BODY_BYTES: usize = 2 * 1024 * 1024;
const MIN_PORT: u16 = 1024;

#[derive(Clone, Copy, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LocalMcpLifecycleState {
    Stopped,
    Starting,
    Running,
    Stopping,
    Error,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalMcpPublicState {
    state: LocalMcpLifecycleState,
    renderer_ready: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    port: Option<u16>,
    #[serde(skip_serializing_if = "Option::is_none")]
    url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_message: Option<String>,
}

impl LocalMcpPublicState {
    fn stopped(renderer_ready: bool, port: Option<u16>) -> Self {
        Self::new(LocalMcpLifecycleState::Stopped, renderer_ready, port)
    }

    fn new(
        state: LocalMcpLifecycleState,
        renderer_ready: bool,
        port: Option<u16>,
    ) -> Self {
        Self {
            state,
            renderer_ready,
            port,
            url: port.map(local_mcp_url),
            error_code: None,
            error_message: None,
        }
    }

    fn error(renderer_ready: bool, port: Option<u16>, error: &LocalMcpError) -> Self {
        let mut state = Self::new(LocalMcpLifecycleState::Error, renderer_ready, port);
        state.error_code = Some(error.code.to_string());
        state.error_message = Some(error.message.clone());
        state
    }
}

#[derive(Clone, Debug)]
struct LocalMcpError {
    code: &'static str,
    message: String,
}

impl LocalMcpError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn invalid_manifest() -> Self {
        Self::new("INVALID_MANIFEST", "The MCP tool manifest is invalid.")
    }
}

struct LocalMcpRuntime {
    public: LocalMcpPublicState,
    cancellation: Option<CancellationToken>,
    task: Option<JoinHandle<()>>,
}

struct LocalMcpManagerInner {
    lifecycle: Mutex<()>,
    runtime: Mutex<LocalMcpRuntime>,
    renderer_ready: Arc<AtomicBool>,
}

#[derive(Clone)]
pub struct LocalMcpManager {
    inner: Arc<LocalMcpManagerInner>,
}

impl LocalMcpManager {
    pub fn new() -> Self {
        let renderer_ready = Arc::new(AtomicBool::new(false));
        Self {
            inner: Arc::new(LocalMcpManagerInner {
                lifecycle: Mutex::new(()),
                runtime: Mutex::new(LocalMcpRuntime {
                    public: LocalMcpPublicState::stopped(false, None),
                    cancellation: None,
                    task: None,
                }),
                renderer_ready,
            }),
        }
    }

    async fn public_state(&self) -> LocalMcpPublicState {
        self.inner.runtime.lock().await.public.clone()
    }

    async fn set_renderer_ready<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        broker: &McpRequestBroker,
        ready: bool,
    ) -> LocalMcpPublicState {
        self.inner.renderer_ready.store(ready, Ordering::Release);
        if !ready {
            broker.cancel_all().await;
        }

        let public = {
            let mut runtime = self.inner.runtime.lock().await;
            runtime.public.renderer_ready = ready;
            runtime.public.clone()
        };
        emit_state(app, &public);
        public
    }

    async fn start<R: Runtime>(
        &self,
        app: AppHandle<R>,
        broker: McpRequestBroker,
        port: u16,
    ) -> Result<LocalMcpPublicState, LocalMcpError> {
        let _lifecycle = self.inner.lifecycle.lock().await;
        let renderer_ready = self.inner.renderer_ready.load(Ordering::Acquire);
        if !renderer_ready {
            return self
                .set_error(
                    &app,
                    Some(port),
                    LocalMcpError::new(
                        "RENDERER_NOT_READY",
                        "NoteX is not ready to handle MCP requests.",
                    ),
                )
                .await;
        }
        if port < MIN_PORT {
            return self
                .set_error(
                    &app,
                    Some(port),
                    LocalMcpError::new(
                        "INVALID_PORT",
                        "The MCP port must be between 1024 and 65535.",
                    ),
                )
                .await;
        }

        {
            let mut runtime = self.inner.runtime.lock().await;
            if runtime.public.state == LocalMcpLifecycleState::Running
                && runtime.public.port == Some(port)
            {
                return Ok(runtime.public.clone());
            }
            if !matches!(
                runtime.public.state,
                LocalMcpLifecycleState::Stopped | LocalMcpLifecycleState::Error
            ) {
                return Err(LocalMcpError::new(
                    "INVALID_STATE",
                    "The MCP server is already changing state.",
                ));
            }
            runtime.public = LocalMcpPublicState::new(
                LocalMcpLifecycleState::Starting,
                renderer_ready,
                Some(port),
            );
            emit_state(&app, &runtime.public);
        }

        let tools = match load_tools() {
            Ok(tools) => Arc::new(tools),
            Err(error) => return self.set_error(&app, Some(port), error).await,
        };
        let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
        let listener = match TcpListener::bind(address).await {
            Ok(listener) => listener,
            Err(_) => {
                return self
                    .set_error(
                        &app,
                        Some(port),
                        LocalMcpError::new(
                            "PORT_UNAVAILABLE",
                            "The configured MCP port is unavailable.",
                        ),
                    )
                    .await
            }
        };

        let cancellation = CancellationToken::new();
        let handler = NoteXMcpHandler {
            app: app.clone(),
            broker: broker.clone(),
            renderer_ready: self.inner.renderer_ready.clone(),
            tools,
        };
        let service = StreamableHttpService::new(
            move || Ok::<_, std::io::Error>(handler.clone()),
            NeverSessionManager::default().into(),
            StreamableHttpServerConfig::default()
                .with_legacy_session_mode(false)
                .with_json_response(true)
                .with_cancellation_token(cancellation.child_token())
                .with_allowed_hosts([format!("127.0.0.1:{port}")])
                .with_max_request_body_bytes(MAX_REQUEST_BODY_BYTES),
        );
        let router = Router::new()
            .nest_service("/mcp", service)
            .layer(middleware::from_fn(reject_browser_origin));

        {
            let mut runtime = self.inner.runtime.lock().await;
            runtime.public = LocalMcpPublicState::new(
                LocalMcpLifecycleState::Running,
                renderer_ready,
                Some(port),
            );
            runtime.cancellation = Some(cancellation.clone());
            emit_state(&app, &runtime.public);
        }

        let manager = self.clone();
        let task_app = app.clone();
        let task_broker = broker.clone();
        let shutdown = cancellation.clone();
        let task = tokio::spawn(async move {
            let result = axum::serve(listener, router)
                .with_graceful_shutdown(shutdown.cancelled_owned())
                .await;
            task_broker.cancel_all().await;
            manager.server_exited(&task_app, port, result.is_err()).await;
        });

        let mut runtime = self.inner.runtime.lock().await;
        if runtime.public.state == LocalMcpLifecycleState::Running {
            runtime.task = Some(task);
        } else {
            cancellation.cancel();
            task.abort();
        }
        Ok(runtime.public.clone())
    }

    async fn stop<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        broker: &McpRequestBroker,
    ) -> LocalMcpPublicState {
        let _lifecycle = self.inner.lifecycle.lock().await;
        let (cancellation, task, port) = {
            let mut runtime = self.inner.runtime.lock().await;
            if runtime.public.state == LocalMcpLifecycleState::Stopped {
                return runtime.public.clone();
            }
            let port = runtime.public.port;
            runtime.public = LocalMcpPublicState::new(
                LocalMcpLifecycleState::Stopping,
                self.inner.renderer_ready.load(Ordering::Acquire),
                port,
            );
            emit_state(app, &runtime.public);
            (runtime.cancellation.take(), runtime.task.take(), port)
        };

        if let Some(cancellation) = cancellation {
            cancellation.cancel();
        }
        broker.cancel_all().await;
        if let Some(task) = task {
            let _ = task.await;
        }

        let public = LocalMcpPublicState::stopped(
            self.inner.renderer_ready.load(Ordering::Acquire),
            port,
        );
        let mut runtime = self.inner.runtime.lock().await;
        runtime.public = public.clone();
        emit_state(app, &public);
        public
    }

    async fn set_error<R: Runtime>(
        &self,
        app: &AppHandle<R>,
        port: Option<u16>,
        error: LocalMcpError,
    ) -> Result<LocalMcpPublicState, LocalMcpError> {
        let public = LocalMcpPublicState::error(
            self.inner.renderer_ready.load(Ordering::Acquire),
            port,
            &error,
        );
        let mut runtime = self.inner.runtime.lock().await;
        runtime.public = public;
        runtime.cancellation = None;
        runtime.task = None;
        emit_state(app, &runtime.public);
        Err(error)
    }

    async fn server_exited<R: Runtime>(&self, app: &AppHandle<R>, port: u16, failed: bool) {
        let mut runtime = self.inner.runtime.lock().await;
        if runtime.public.port != Some(port) {
            return;
        }

        runtime.cancellation = None;
        runtime.task = None;
        runtime.public = if failed
            && runtime.public.state != LocalMcpLifecycleState::Stopping
        {
            LocalMcpPublicState::error(
                self.inner.renderer_ready.load(Ordering::Acquire),
                Some(port),
                &LocalMcpError::new("SERVER_STOPPED", "The MCP server stopped unexpectedly."),
            )
        } else {
            LocalMcpPublicState::stopped(
                self.inner.renderer_ready.load(Ordering::Acquire),
                Some(port),
            )
        };
        emit_state(app, &runtime.public);
    }
}

struct NoteXMcpHandler<R: Runtime> {
    app: AppHandle<R>,
    broker: McpRequestBroker,
    renderer_ready: Arc<AtomicBool>,
    tools: Arc<Vec<Tool>>,
}

impl<R: Runtime> Clone for NoteXMcpHandler<R> {
    fn clone(&self) -> Self {
        Self {
            app: self.app.clone(),
            broker: self.broker.clone(),
            renderer_ready: self.renderer_ready.clone(),
            tools: self.tools.clone(),
        }
    }
}

impl<R: Runtime> ServerHandler for NoteXMcpHandler<R> {
    fn get_info(&self) -> ServerInfo {
        ServerInfo::new(ServerCapabilities::builder().enable_tools().build())
            .with_server_info(Implementation::new("NoteX", env!("CARGO_PKG_VERSION")))
            .with_instructions("Read and update notes in the open NoteX desktop application.")
    }

    fn list_tools(
        &self,
        _request: Option<PaginatedRequestParams>,
        _context: RequestContext<RoleServer>,
    ) -> impl Future<Output = Result<ListToolsResult, ErrorData>> + Send + '_ {
        std::future::ready(Ok(ListToolsResult::with_all_items(
            self.tools.as_ref().clone(),
        )))
    }

    fn get_tool(&self, name: &str) -> Option<Tool> {
        self.tools.iter().find(|tool| tool.name == name).cloned()
    }

    async fn call_tool(
        &self,
        request: CallToolRequestParams,
        _context: RequestContext<RoleServer>,
    ) -> Result<CallToolResponse, ErrorData> {
        if !self.renderer_ready.load(Ordering::Acquire) {
            return Ok(tool_error(
                "NOTEX_OFFLINE",
                "NoteX is not ready to handle MCP requests.",
            )
            .into());
        }
        if self.get_tool(request.name.as_ref()).is_none() {
            return Err(ErrorData::invalid_params("Unknown NoteX tool.", None));
        }

        let response = self
            .broker
            .dispatch(
                &self.app,
                request.name.into_owned(),
                Value::Object(request.arguments.unwrap_or_default()),
            )
            .await;
        Ok(renderer_response(response).into())
    }
}

fn renderer_response(
    response: Result<DesktopResponse, McpRequestBrokerError>,
) -> CallToolResult {
    match response {
        Ok(response) if response.ok => match response.result {
            Some(result) => {
                let mut tool_result = CallToolResult::structured(result.clone());
                tool_result.content = vec![ContentBlock::text(result.to_string())];
                tool_result
            }
            None => tool_error("INTERNAL", "An internal error occurred."),
        },
        Ok(response) => match response.error {
            Some(error) => tool_error(&error.code, &error.message),
            None => tool_error("INTERNAL", "An internal error occurred."),
        },
        Err(McpRequestBrokerError::Timeout) => {
            tool_error("TIMEOUT", "The MCP request timed out.")
        }
        Err(McpRequestBrokerError::Overloaded) => tool_error(
            "INTERNAL",
            "NoteX has too many MCP requests in progress.",
        ),
        Err(McpRequestBrokerError::RendererUnavailable) => {
            tool_error("NOTEX_OFFLINE", "The NoteX renderer is unavailable.")
        }
        Err(McpRequestBrokerError::Cancelled) => {
            tool_error("NOTEX_OFFLINE", "The MCP request was cancelled.")
        }
        Err(McpRequestBrokerError::InvalidRequest | McpRequestBrokerError::UnknownRequest) => {
            tool_error("INTERNAL", "An internal error occurred.")
        }
    }
}

fn tool_error(code: &str, message: &str) -> CallToolResult {
    let mut result = CallToolResult::structured_error(json!({
        "code": code,
        "message": message,
    }));
    result.content = vec![ContentBlock::text(message.to_string())];
    result
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolManifest {
    schema_version: u8,
    protocol_version: String,
    tools: Vec<ToolManifestEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolManifestEntry {
    name: String,
    title: String,
    description: String,
    input_schema: Map<String, Value>,
    annotations: ToolManifestAnnotations,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ToolManifestAnnotations {
    read_only_hint: bool,
    destructive_hint: bool,
    idempotent_hint: bool,
    open_world_hint: bool,
}

fn load_tools() -> Result<Vec<Tool>, LocalMcpError> {
    let manifest: ToolManifest =
        serde_json::from_str(TOOL_MANIFEST_JSON).map_err(|_| LocalMcpError::invalid_manifest())?;
    if manifest.schema_version != TOOL_MANIFEST_SCHEMA_VERSION
        || manifest.protocol_version != BRIDGE_PROTOCOL_VERSION
        || manifest.tools.len() != EXPECTED_TOOL_COUNT
    {
        return Err(LocalMcpError::invalid_manifest());
    }

    let mut names = HashSet::with_capacity(manifest.tools.len());
    manifest
        .tools
        .into_iter()
        .map(|entry| {
            if entry.name.is_empty()
                || entry.name.len() > 64
                || !names.insert(entry.name.clone())
                || entry.input_schema.get("type") != Some(&Value::String("object".to_string()))
            {
                return Err(LocalMcpError::invalid_manifest());
            }

            let annotations = ToolAnnotations::new()
                .read_only(entry.annotations.read_only_hint)
                .destructive(entry.annotations.destructive_hint)
                .idempotent(entry.annotations.idempotent_hint)
                .open_world(entry.annotations.open_world_hint);
            Ok(Tool::new(entry.name, entry.description, entry.input_schema)
                .with_title(entry.title)
                .with_annotations(annotations))
        })
        .collect()
}

async fn reject_browser_origin(request: Request<Body>, next: Next) -> Response {
    if request.headers().contains_key(ORIGIN) {
        return (StatusCode::FORBIDDEN, "Forbidden").into_response();
    }
    next.run(request).await
}

fn local_mcp_url(port: u16) -> String {
    format!("http://127.0.0.1:{port}/mcp")
}

fn emit_state<R: Runtime>(app: &AppHandle<R>, state: &LocalMcpPublicState) {
    let _ = app.emit(LOCAL_STATE_EVENT, state);
}

#[tauri::command]
pub async fn notex_local_mcp_get_state(
    manager: State<'_, LocalMcpManager>,
) -> Result<LocalMcpPublicState, String> {
    Ok(manager.public_state().await)
}

#[tauri::command]
pub async fn notex_local_mcp_set_renderer_ready<R: Runtime>(
    app: AppHandle<R>,
    manager: State<'_, LocalMcpManager>,
    broker: State<'_, McpRequestBroker>,
    ready: bool,
) -> Result<LocalMcpPublicState, String> {
    Ok(manager.set_renderer_ready(&app, &broker, ready).await)
}

#[tauri::command]
pub async fn notex_local_mcp_start<R: Runtime>(
    app: AppHandle<R>,
    manager: State<'_, LocalMcpManager>,
    broker: State<'_, McpRequestBroker>,
    port: u16,
) -> Result<LocalMcpPublicState, String> {
    manager
        .start(app, broker.inner().clone(), port)
        .await
        .map_err(|error| error.message)
}

#[tauri::command]
pub async fn notex_local_mcp_stop<R: Runtime>(
    app: AppHandle<R>,
    manager: State<'_, LocalMcpManager>,
    broker: State<'_, McpRequestBroker>,
) -> Result<LocalMcpPublicState, String> {
    Ok(manager.stop(&app, &broker).await)
}
