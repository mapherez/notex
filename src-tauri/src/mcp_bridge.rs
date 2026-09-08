use std::{
    fmt,
    sync::Arc,
    time::{Duration, Instant},
};

use futures_util::{SinkExt, StreamExt};
use reqwest::{Method, StatusCode, Url};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::{
    connect_async,
    tungstenite::{self, Message},
};

use crate::{
    external_links,
    mcp_request_broker::{
        DesktopResponse, McpRequestBroker, McpRequestEvent as BridgeRequestEvent,
        REQUEST_EVENT,
    },
};

const BRIDGE_PROTOCOL_VERSION: &str = "1.0";
const MAX_BRIDGE_FRAME_BYTES: usize = 2 * 1024 * 1024;
const STATE_EVENT: &str = "notex://mcp-state";
const CREDENTIAL_SERVICE: &str = "com.mapherez.notex.mcp";
const CREDENTIAL_ACCOUNT: &str = "desktop-refresh-token";
const DESKTOP_SESSION_HEADER: &str = "x-notex-desktop-session";
const HTTP_TIMEOUT: Duration = Duration::from_secs(20);
const BRIDGE_AUTH_TIMEOUT: Duration = Duration::from_secs(8);

type McpResult<T> = Result<T, McpError>;

#[derive(Clone, Debug)]
struct McpError {
    code: &'static str,
    message: String,
}

impl McpError {
    fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    fn network() -> Self {
        Self::new("NETWORK", "The NoteX MCP backend is unavailable.")
    }

    fn auth_required() -> Self {
        Self::new("AUTH_REQUIRED", "The NoteX MCP login is no longer valid.")
    }
}

impl fmt::Display for McpError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)
    }
}

impl std::error::Error for McpError {}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum McpConnectionState {
    LoggedOut,
    Authorizing,
    Connecting,
    Online,
    Offline,
    Error,
}

#[derive(Clone, Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct McpPublicState {
    state: McpConnectionState,
    #[serde(skip_serializing_if = "Option::is_none")]
    email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_message: Option<String>,
}

impl McpPublicState {
    fn logged_out() -> Self {
        Self {
            state: McpConnectionState::LoggedOut,
            email: None,
            error_code: None,
            error_message: None,
        }
    }

    fn with_state(state: McpConnectionState, email: Option<String>) -> Self {
        Self {
            state,
            email,
            error_code: None,
            error_message: None,
        }
    }

    fn with_error(state: McpConnectionState, email: Option<String>, error: &McpError) -> Self {
        Self {
            state,
            email,
            error_code: Some(error.code.to_string()),
            error_message: Some(error.message.clone()),
        }
    }
}

#[derive(Clone)]
struct BackendConfig {
    origin: Url,
    device_start: Url,
    token_endpoint: Url,
    resource: Url,
}

impl BackendConfig {
    fn from_configured_url(raw: &str) -> McpResult<Self> {
        let mut origin = Url::parse(raw)
            .map_err(|_| McpError::new("CONFIGURATION", "The MCP backend URL is invalid."))?;
        let host = origin.host_str().unwrap_or_default();
        let loopback = matches!(host, "127.0.0.1" | "localhost" | "::1");
        if origin.scheme() != "https" && !(origin.scheme() == "http" && loopback) {
            return Err(McpError::new(
                "CONFIGURATION",
                "The MCP backend must use HTTPS outside loopback development.",
            ));
        }
        if origin.username() != ""
            || origin.password().is_some()
            || origin.query().is_some()
            || origin.fragment().is_some()
            || !matches!(origin.path(), "" | "/")
        {
            return Err(McpError::new(
                "CONFIGURATION",
                "The MCP backend URL must be an origin without credentials, path, query, or fragment.",
            ));
        }
        origin.set_path("/");
        let device_start = origin
            .join("v1/desktop/device/start")
            .map_err(|_| McpError::new("CONFIGURATION", "The MCP backend URL is invalid."))?;
        let token_endpoint = origin
            .join("api/auth/oauth2/token")
            .map_err(|_| McpError::new("CONFIGURATION", "The MCP backend URL is invalid."))?;
        let resource = origin
            .join("mcp")
            .map_err(|_| McpError::new("CONFIGURATION", "The MCP backend URL is invalid."))?;
        Ok(Self {
            origin,
            device_start,
            token_endpoint,
            resource,
        })
    }

    fn endpoint(&self, path: &str) -> McpResult<Url> {
        self.origin
            .join(path.trim_start_matches('/'))
            .map_err(|_| McpError::new("CONFIGURATION", "The MCP backend URL is invalid."))
    }

    fn validate_http_endpoint(&self, raw: &str, expected: &Url) -> McpResult<Url> {
        let parsed = Url::parse(raw).map_err(|_| {
            McpError::new("BACKEND", "The MCP backend returned an invalid endpoint.")
        })?;
        if &parsed != expected {
            return Err(McpError::new(
                "BACKEND",
                "The MCP backend returned an unexpected endpoint.",
            ));
        }
        Ok(parsed)
    }

    fn validate_browser_url(&self, raw: &str) -> McpResult<Url> {
        let parsed = Url::parse(raw).map_err(|_| {
            McpError::new("BACKEND", "The MCP backend returned an invalid login URL.")
        })?;
        if !same_origin(&parsed, &self.origin) {
            return Err(McpError::new(
                "BACKEND",
                "The MCP backend returned an unexpected login URL.",
            ));
        }
        Ok(parsed)
    }

    fn validate_bridge_url(&self, raw: &str) -> McpResult<Url> {
        let parsed = Url::parse(raw).map_err(|_| {
            McpError::new("BACKEND", "The MCP backend returned an invalid bridge URL.")
        })?;
        let expected_scheme = if self.origin.scheme() == "https" {
            "wss"
        } else {
            "ws"
        };
        if parsed.scheme() != expected_scheme
            || parsed.host_str() != self.origin.host_str()
            || parsed.port_or_known_default() != self.origin.port_or_known_default()
            || parsed.path() != "/v1/bridge"
            || parsed.query().is_some()
            || parsed.fragment().is_some()
        {
            return Err(McpError::new(
                "BACKEND",
                "The MCP backend returned an unexpected bridge URL.",
            ));
        }
        Ok(parsed)
    }
}

fn same_origin(left: &Url, right: &Url) -> bool {
    left.scheme() == right.scheme()
        && left.host_str() == right.host_str()
        && left.port_or_known_default() == right.port_or_known_default()
}

fn is_wire_uuid(value: &str) -> bool {
    value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| {
            if matches!(index, 8 | 13 | 18 | 23) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        })
}

fn configured_backend() -> McpResult<BackendConfig> {
    #[cfg(debug_assertions)]
    let configured = std::env::var("NOTEX_MCP_BACKEND_URL")
        .ok()
        .or_else(|| option_env!("NOTEX_MCP_BACKEND_URL").map(str::to_owned))
        .unwrap_or_else(|| "http://127.0.0.1:8080".to_string());

    #[cfg(not(debug_assertions))]
    let configured = option_env!("NOTEX_MCP_BACKEND_URL")
        .unwrap_or("")
        .to_string();

    if configured.trim().is_empty() {
        return Err(McpError::new(
            "CONFIGURATION",
            "The production MCP backend URL is not configured.",
        ));
    }
    BackendConfig::from_configured_url(configured.trim())
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredCredential {
    refresh_token: String,
    client_id: String,
    token_endpoint: String,
    resource: String,
    session_id: String,
}

trait CredentialStore: Send + Sync {
    fn load(&self) -> McpResult<Option<StoredCredential>>;
    fn save(&self, credential: &StoredCredential) -> McpResult<()>;
    fn delete(&self) -> McpResult<()>;
}

#[cfg(target_os = "windows")]
struct SystemCredentialStore;

#[cfg(target_os = "windows")]
impl SystemCredentialStore {
    fn entry(&self) -> McpResult<keyring::Entry> {
        keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT).map_err(|_| {
            McpError::new(
                "SECURE_STORAGE",
                "Windows Credential Manager is unavailable.",
            )
        })
    }
}

#[cfg(target_os = "windows")]
impl CredentialStore for SystemCredentialStore {
    fn load(&self) -> McpResult<Option<StoredCredential>> {
        let serialized = match self.entry()?.get_password() {
            Ok(value) => value,
            Err(keyring::Error::NoEntry) => return Ok(None),
            Err(_) => {
                return Err(McpError::new(
                    "SECURE_STORAGE",
                    "The NoteX MCP credential could not be read.",
                ))
            }
        };
        serde_json::from_str(&serialized).map(Some).map_err(|_| {
            McpError::new(
                "SECURE_STORAGE",
                "The stored NoteX MCP credential is invalid.",
            )
        })
    }

    fn save(&self, credential: &StoredCredential) -> McpResult<()> {
        let serialized = serde_json::to_string(credential).map_err(|_| {
            McpError::new(
                "SECURE_STORAGE",
                "The NoteX MCP credential could not be encoded.",
            )
        })?;
        self.entry()?.set_password(&serialized).map_err(|_| {
            McpError::new(
                "SECURE_STORAGE",
                "The NoteX MCP credential could not be saved.",
            )
        })
    }

    fn delete(&self) -> McpResult<()> {
        match self.entry()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(McpError::new(
                "SECURE_STORAGE",
                "The NoteX MCP credential could not be removed.",
            )),
        }
    }
}

#[cfg(not(target_os = "windows"))]
struct SystemCredentialStore;

#[cfg(not(target_os = "windows"))]
impl CredentialStore for SystemCredentialStore {
    fn load(&self) -> McpResult<Option<StoredCredential>> {
        Err(McpError::new(
            "SECURE_STORAGE",
            "Secure MCP credential storage is not available on this platform.",
        ))
    }

    fn save(&self, _credential: &StoredCredential) -> McpResult<()> {
        self.load().map(|_| ())
    }

    fn delete(&self) -> McpResult<()> {
        Ok(())
    }
}

#[derive(Clone)]
struct AccessToken {
    value: String,
    expires_at: Instant,
}

impl AccessToken {
    fn is_fresh(&self) -> bool {
        self.expires_at > Instant::now() + Duration::from_secs(30)
    }
}

enum BridgeControl {
    Frame(String),
    Ready(String),
    Close,
}

struct RuntimeState {
    public: McpPublicState,
    generation: u64,
    initialized: bool,
    renderer_ready: bool,
    app_version: Option<String>,
    credential: Option<StoredCredential>,
    access_token: Option<AccessToken>,
    bridge_sender: Option<mpsc::UnboundedSender<BridgeControl>>,
}

struct ManagerInner {
    backend: McpResult<BackendConfig>,
    client: reqwest::Client,
    credentials: Arc<dyn CredentialStore>,
    runtime: Mutex<RuntimeState>,
}

#[derive(Clone)]
pub struct McpManager {
    inner: Arc<ManagerInner>,
}

impl McpManager {
    pub fn new() -> Self {
        let backend = configured_backend();
        let public = match &backend {
            Ok(_) => McpPublicState::logged_out(),
            Err(error) => McpPublicState::with_error(McpConnectionState::Error, None, error),
        };
        let client = reqwest::Client::builder()
            .timeout(HTTP_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .user_agent(concat!("NoteX/", env!("CARGO_PKG_VERSION")))
            .build()
            .expect("valid NoteX MCP HTTP client");
        Self {
            inner: Arc::new(ManagerInner {
                backend,
                client,
                credentials: Arc::new(SystemCredentialStore),
                runtime: Mutex::new(RuntimeState {
                    public,
                    generation: 0,
                    initialized: false,
                    renderer_ready: false,
                    app_version: None,
                    credential: None,
                    access_token: None,
                    bridge_sender: None,
                }),
            }),
        }
    }

    async fn snapshot(&self) -> McpPublicState {
        self.inner.runtime.lock().await.public.clone()
    }

    async fn publish(&self, app: &AppHandle, public: McpPublicState) {
        {
            let mut runtime = self.inner.runtime.lock().await;
            runtime.public = public.clone();
        }
        let _ = app.emit(STATE_EVENT, public);
    }

    async fn publish_error(&self, app: &AppHandle, state: McpConnectionState, error: &McpError) {
        let email = self.inner.runtime.lock().await.public.email.clone();
        self.publish(app, McpPublicState::with_error(state, email, error))
            .await;
    }

    fn backend(&self) -> McpResult<BackendConfig> {
        self.inner.backend.clone()
    }

    async fn is_current(&self, generation: u64) -> bool {
        self.inner.runtime.lock().await.generation == generation
    }

    async fn begin_generation(&self) -> u64 {
        let mut runtime = self.inner.runtime.lock().await;
        runtime.generation = runtime.generation.wrapping_add(1);
        if let Some(sender) = runtime.bridge_sender.take() {
            let _ = sender.send(BridgeControl::Close);
        }
        runtime.access_token = None;
        runtime.generation
    }

    async fn load_credential(&self) -> McpResult<Option<StoredCredential>> {
        let store = self.inner.credentials.clone();
        tauri::async_runtime::spawn_blocking(move || store.load())
            .await
            .map_err(|_| {
                McpError::new(
                    "SECURE_STORAGE",
                    "The NoteX MCP credential could not be read.",
                )
            })?
    }

    async fn save_credential(&self, credential: StoredCredential) -> McpResult<()> {
        let store = self.inner.credentials.clone();
        let saved = credential.clone();
        tauri::async_runtime::spawn_blocking(move || store.save(&saved))
            .await
            .map_err(|_| {
                McpError::new(
                    "SECURE_STORAGE",
                    "The NoteX MCP credential could not be saved.",
                )
            })??;
        self.inner.runtime.lock().await.credential = Some(credential);
        Ok(())
    }

    async fn delete_credential(&self) -> McpResult<()> {
        let store = self.inner.credentials.clone();
        tauri::async_runtime::spawn_blocking(move || store.delete())
            .await
            .map_err(|_| {
                McpError::new(
                    "SECURE_STORAGE",
                    "The NoteX MCP credential could not be removed.",
                )
            })??;
        self.inner.runtime.lock().await.credential = None;
        Ok(())
    }

    async fn initialize(&self, app: &AppHandle) -> McpResult<McpPublicState> {
        let app_version = app.package_info().version.to_string();
        {
            let mut runtime = self.inner.runtime.lock().await;
            runtime.renderer_ready = true;
            runtime.app_version = Some(app_version.clone());
            if let Some(sender) = &runtime.bridge_sender {
                let _ = sender.send(BridgeControl::Ready(app_version));
            }
            if runtime.initialized {
                return Ok(runtime.public.clone());
            }
            runtime.initialized = true;
        }

        if let Err(error) = self.backend() {
            self.publish_error(app, McpConnectionState::Error, &error)
                .await;
            return Err(error);
        }
        let credential = match self.load_credential().await {
            Ok(value) => value,
            Err(error) => {
                self.publish_error(app, McpConnectionState::Error, &error)
                    .await;
                return Err(error);
            }
        };
        let Some(credential) = credential else {
            self.publish(app, McpPublicState::logged_out()).await;
            return Ok(self.snapshot().await);
        };
        if let Err(error) = self.validate_credential(&credential) {
            let surfaced = self.delete_credential().await.err().unwrap_or(error);
            self.publish_error(app, McpConnectionState::Error, &surfaced)
                .await;
            return Err(surfaced);
        }
        let generation = self.begin_generation().await;
        self.inner.runtime.lock().await.credential = Some(credential);
        self.publish(
            app,
            McpPublicState::with_state(McpConnectionState::Connecting, None),
        )
        .await;
        self.spawn_supervisor(app.clone(), generation, None);
        Ok(self.snapshot().await)
    }

    fn validate_credential(&self, credential: &StoredCredential) -> McpResult<()> {
        let backend = self.backend()?;
        backend.validate_http_endpoint(&credential.token_endpoint, &backend.token_endpoint)?;
        backend.validate_http_endpoint(&credential.resource, &backend.resource)?;
        if credential.client_id.is_empty()
            || credential.client_id.len() > 256
            || credential.refresh_token.is_empty()
            || credential.refresh_token.len() > 4096
            || !is_wire_uuid(&credential.session_id)
        {
            return Err(McpError::new(
                "SECURE_STORAGE",
                "The stored NoteX MCP credential is invalid.",
            ));
        }
        Ok(())
    }

    async fn start_authorization(
        &self,
        app: &AppHandle,
        mode: AuthorizationMode,
    ) -> McpResult<McpPublicState> {
        let backend = self.backend()?;
        let generation = self.begin_generation().await;
        self.publish(
            app,
            McpPublicState::with_state(McpConnectionState::Authorizing, None),
        )
        .await;

        let response = self
            .inner
            .client
            .post(backend.device_start.clone())
            .json(&StartAuthorizationBody { mode })
            .send()
            .await
            .map_err(|_| McpError::network());
        let response = match response {
            Ok(value) => value,
            Err(error) => {
                self.publish_error(app, McpConnectionState::Error, &error)
                    .await;
                return Err(error);
            }
        };
        let start = async {
            let start: DeviceAuthorization = decode_success(response).await?;
            backend.validate_http_endpoint(&start.token_endpoint, &backend.token_endpoint)?;
            backend.validate_http_endpoint(&start.resource, &backend.resource)?;
            let browser_url = backend.validate_browser_url(&start.verification_uri_complete)?;
            if start.client_id.is_empty()
                || start.device_code.is_empty()
                || start.activation_token.is_empty()
                || start.expires_in == 0
            {
                return Err(McpError::new(
                    "BACKEND",
                    "The MCP backend returned an incomplete authorization response.",
                ));
            }
            if !self.is_current(generation).await {
                return Err(McpError::new(
                    "CANCELLED",
                    "The Google login request was cancelled.",
                ));
            }
            external_links::open_external_url(browser_url.as_str()).map_err(|_| {
                McpError::new("BROWSER", "The Google login page could not be opened.")
            })?;
            Ok(start)
        }
        .await;
        let start = match start {
            Ok(value) => value,
            Err(error) => {
                if self.is_current(generation).await {
                    self.publish_error(app, McpConnectionState::Error, &error)
                        .await;
                    return Err(error);
                }
                return Ok(self.snapshot().await);
            }
        };

        let manager = self.clone();
        let app = app.clone();
        tauri::async_runtime::spawn(async move {
            manager
                .run_device_authorization(app, generation, start)
                .await;
        });
        Ok(self.snapshot().await)
    }

    async fn run_device_authorization(
        &self,
        app: AppHandle,
        generation: u64,
        start: DeviceAuthorization,
    ) {
        let deadline = Instant::now() + Duration::from_secs(start.expires_in.into());
        let mut interval = Duration::from_secs(u64::from(start.interval.max(1)));
        loop {
            tokio::time::sleep(interval).await;
            if !self.is_current(generation).await {
                return;
            }
            if Instant::now() >= deadline {
                let error =
                    McpError::new("AUTHORIZATION_EXPIRED", "The Google login request expired.");
                self.publish_error(&app, McpConnectionState::Error, &error)
                    .await;
                return;
            }

            match self.poll_device_token(&start).await {
                Ok(Some(token)) => {
                    if let Err(error) = self
                        .complete_authorization(&app, generation, &start, token)
                        .await
                    {
                        if self.is_current(generation).await {
                            self.publish_error(&app, McpConnectionState::Error, &error)
                                .await;
                        }
                    }
                    return;
                }
                Ok(None) => {}
                Err(error) if error.code == "SLOW_DOWN" => {
                    interval += Duration::from_secs(5);
                }
                Err(error) => {
                    self.publish_error(&app, McpConnectionState::Error, &error)
                        .await;
                    return;
                }
            }
        }
    }

    async fn poll_device_token(
        &self,
        start: &DeviceAuthorization,
    ) -> McpResult<Option<TokenResponse>> {
        let response = self
            .inner
            .client
            .post(&start.token_endpoint)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("device_code", start.device_code.as_str()),
                ("client_id", start.client_id.as_str()),
                ("resource", start.resource.as_str()),
            ])
            .send()
            .await
            .map_err(|_| McpError::network())?;
        if response.status().is_success() {
            return decode_success(response).await.map(Some);
        }
        let error: OAuthError = decode_json(response).await?;
        match error.error.as_str() {
            "authorization_pending" => Ok(None),
            "slow_down" => Err(McpError::new(
                "SLOW_DOWN",
                "Authorization polling slowed down.",
            )),
            "access_denied" => Err(McpError::new(
                "ACCESS_DENIED",
                "The Google login request was denied.",
            )),
            "expired_token" => Err(McpError::new(
                "AUTHORIZATION_EXPIRED",
                "The Google login request expired.",
            )),
            _ => Err(McpError::new(
                "AUTHORIZATION_FAILED",
                "The Google login could not be completed.",
            )),
        }
    }

    async fn complete_authorization(
        &self,
        app: &AppHandle,
        generation: u64,
        start: &DeviceAuthorization,
        token: TokenResponse,
    ) -> McpResult<()> {
        if !self.is_current(generation).await {
            return Ok(());
        }
        let refresh_token = token.refresh_token.clone().ok_or_else(|| {
            McpError::new(
                "AUTHORIZATION_FAILED",
                "The MCP backend did not issue a refresh token.",
            )
        })?;
        let access = AccessToken::from_response(&token)?;
        let activation: ActivationResponse = self
            .authorized_json(
                Method::POST,
                "v1/desktop/session/activate",
                &access.value,
                None,
                Some(serde_json::json!({ "activationToken": start.activation_token })),
            )
            .await?;
        let backend = self.backend()?;
        let activation_valid = is_wire_uuid(&activation.session_id)
            && !activation.email.is_empty()
            && activation.email.len() <= 320
            && !activation.email.chars().any(char::is_control)
            && !activation.ticket.is_empty()
            && activation.ticket.len() <= 4096;
        if !activation_valid {
            self.best_effort_logout_session(&access.value, &activation.session_id)
                .await;
            return Err(McpError::new(
                "BACKEND",
                "The MCP backend returned an invalid desktop session.",
            ));
        }
        if let Err(error) = backend.validate_bridge_url(&activation.bridge_url) {
            self.best_effort_logout_session(&access.value, &activation.session_id)
                .await;
            return Err(error);
        }
        if !self.is_current(generation).await {
            self.best_effort_logout_session(&access.value, &activation.session_id)
                .await;
            return Ok(());
        }
        let credential = StoredCredential {
            refresh_token,
            client_id: start.client_id.clone(),
            token_endpoint: start.token_endpoint.clone(),
            resource: start.resource.clone(),
            session_id: activation.session_id.clone(),
        };
        if let Err(error) = self.save_credential(credential).await {
            self.best_effort_logout_session(&access.value, &activation.session_id)
                .await;
            return Err(error);
        }
        {
            let mut runtime = self.inner.runtime.lock().await;
            runtime.access_token = Some(access);
        }
        self.publish(
            app,
            McpPublicState::with_state(
                McpConnectionState::Connecting,
                Some(activation.email.clone()),
            ),
        )
        .await;
        self.spawn_supervisor(
            app.clone(),
            generation,
            Some(BridgeTicket {
                bridge_url: activation.bridge_url,
                ticket: activation.ticket,
            }),
        );
        Ok(())
    }

    async fn refresh_access_token(&self, credential: StoredCredential) -> McpResult<AccessToken> {
        self.validate_credential(&credential)?;
        let response = self
            .inner
            .client
            .post(&credential.token_endpoint)
            .form(&[
                ("grant_type", "refresh_token"),
                ("refresh_token", credential.refresh_token.as_str()),
                ("client_id", credential.client_id.as_str()),
                ("resource", credential.resource.as_str()),
            ])
            .send()
            .await
            .map_err(|_| McpError::network())?;
        if !response.status().is_success() {
            let status = response.status();
            let error = decode_json::<OAuthError>(response).await.ok();
            if status == StatusCode::BAD_REQUEST
                && matches!(
                    error.as_ref().map(|value| value.error.as_str()),
                    Some("invalid_grant")
                )
            {
                return Err(McpError::auth_required());
            }
            return Err(McpError::new(
                "AUTHORIZATION_FAILED",
                "The NoteX MCP login could not be refreshed.",
            ));
        }
        let token: TokenResponse = decode_json(response).await?;
        let access = AccessToken::from_response(&token)?;
        let mut rotated = credential;
        if let Some(refresh_token) = token.refresh_token {
            rotated.refresh_token = refresh_token;
        }
        self.save_credential(rotated).await?;
        self.inner.runtime.lock().await.access_token = Some(access.clone());
        Ok(access)
    }

    async fn access_token(&self) -> McpResult<AccessToken> {
        {
            let runtime = self.inner.runtime.lock().await;
            if let Some(access) = &runtime.access_token {
                if access.is_fresh() {
                    return Ok(access.clone());
                }
            }
        }
        let credential = self
            .inner
            .runtime
            .lock()
            .await
            .credential
            .clone()
            .ok_or_else(McpError::auth_required)?;
        self.refresh_access_token(credential).await
    }

    async fn request_bridge_ticket(&self) -> McpResult<BridgeTicket> {
        let access = self.access_token().await?;
        let credential = self
            .inner
            .runtime
            .lock()
            .await
            .credential
            .clone()
            .ok_or_else(McpError::auth_required)?;
        let response: TicketResponse = self
            .authorized_json(
                Method::POST,
                "v1/desktop/session/ticket",
                &access.value,
                Some(&credential.session_id),
                Some(serde_json::json!({ "sessionId": credential.session_id })),
            )
            .await?;
        self.backend()?.validate_bridge_url(&response.bridge_url)?;
        Ok(BridgeTicket {
            bridge_url: response.bridge_url,
            ticket: response.ticket,
        })
    }

    async fn account_email(&self) -> McpResult<String> {
        let access = self.access_token().await?;
        let credential = self
            .inner
            .runtime
            .lock()
            .await
            .credential
            .clone()
            .ok_or_else(McpError::auth_required)?;
        let account: AccountResponse = self
            .authorized_json::<Value, AccountResponse>(
                Method::GET,
                "v1/desktop/account",
                &access.value,
                Some(&credential.session_id),
                None,
            )
            .await?;
        Ok(account.email)
    }

    fn spawn_supervisor(
        &self,
        app: AppHandle,
        generation: u64,
        initial_ticket: Option<BridgeTicket>,
    ) {
        let manager = self.clone();
        tauri::async_runtime::spawn(async move {
            manager
                .bridge_supervisor(app, generation, initial_ticket)
                .await;
        });
    }

    async fn bridge_supervisor(
        &self,
        app: AppHandle,
        generation: u64,
        mut initial_ticket: Option<BridgeTicket>,
    ) {
        let mut retry_delay = Duration::from_secs(1);
        loop {
            if !self.is_current(generation).await {
                return;
            }
            let email = self.inner.runtime.lock().await.public.email.clone();
            self.publish(
                &app,
                McpPublicState::with_state(McpConnectionState::Connecting, email),
            )
            .await;

            if self.inner.runtime.lock().await.public.email.is_none() {
                match self.account_email().await {
                    Ok(email) => {
                        self.publish(
                            &app,
                            McpPublicState::with_state(McpConnectionState::Connecting, Some(email)),
                        )
                        .await;
                    }
                    Err(error)
                        if error.code == "AUTH_REQUIRED" || error.code == "USER_NOT_LOGGED_IN" =>
                    {
                        self.handle_auth_lost(&app).await;
                        return;
                    }
                    Err(error) => {
                        self.publish_error(&app, McpConnectionState::Offline, &error)
                            .await;
                        if !self.wait_for_retry(generation, retry_delay).await {
                            return;
                        }
                        retry_delay = (retry_delay * 2).min(Duration::from_secs(30));
                        continue;
                    }
                }
            }

            let ticket = match initial_ticket.take() {
                Some(value) => Ok(value),
                None => self.request_bridge_ticket().await,
            };
            let ticket = match ticket {
                Ok(value) => value,
                Err(error)
                    if error.code == "AUTH_REQUIRED" || error.code == "USER_NOT_LOGGED_IN" =>
                {
                    self.handle_auth_lost(&app).await;
                    return;
                }
                Err(error) => {
                    self.publish_error(&app, McpConnectionState::Offline, &error)
                        .await;
                    if !self.wait_for_retry(generation, retry_delay).await {
                        return;
                    }
                    retry_delay = (retry_delay * 2).min(Duration::from_secs(30));
                    continue;
                }
            };

            match self.run_bridge(&app, generation, ticket).await {
                BridgeExit::Cancelled => return,
                BridgeExit::SessionRevoked => {
                    self.handle_auth_lost(&app).await;
                    return;
                }
                BridgeExit::Disconnected => {
                    let error = McpError::new("BRIDGE", "The NoteX MCP bridge disconnected.");
                    self.publish_error(&app, McpConnectionState::Offline, &error)
                        .await;
                }
            }
            retry_delay = Duration::from_secs(1);
            if !self.wait_for_retry(generation, retry_delay).await {
                return;
            }
        }
    }

    async fn wait_for_retry(&self, generation: u64, duration: Duration) -> bool {
        tokio::time::sleep(duration).await;
        self.is_current(generation).await
    }

    async fn run_bridge(
        &self,
        app: &AppHandle,
        generation: u64,
        ticket: BridgeTicket,
    ) -> BridgeExit {
        let backend = match self.backend() {
            Ok(value) => value,
            Err(_) => return BridgeExit::Disconnected,
        };
        let bridge_url = match backend.validate_bridge_url(&ticket.bridge_url) {
            Ok(value) => value,
            Err(_) => return BridgeExit::Disconnected,
        };
        let connection =
            tokio::time::timeout(BRIDGE_AUTH_TIMEOUT, connect_async(bridge_url.as_str())).await;
        let (mut socket, _) = match connection {
            Ok(Ok(value)) => value,
            _ => return BridgeExit::Disconnected,
        };
        let authenticate =
            serde_json::json!({ "type": "authenticate", "ticket": ticket.ticket }).to_string();
        if socket
            .send(Message::Text(authenticate.into()))
            .await
            .is_err()
        {
            return BridgeExit::Disconnected;
        }
        let authenticated = tokio::time::timeout(BRIDGE_AUTH_TIMEOUT, socket.next()).await;
        let Some(Ok(message)) = authenticated.ok().flatten() else {
            return BridgeExit::Disconnected;
        };
        if !matches!(decode_server_frame(message), Ok(ServerFrame::Authenticated)) {
            return BridgeExit::Disconnected;
        }

        let (sender, mut receiver) = mpsc::unbounded_channel();
        let (renderer_ready, app_version, email) = {
            let mut runtime = self.inner.runtime.lock().await;
            if runtime.generation != generation {
                return BridgeExit::Cancelled;
            }
            runtime.bridge_sender = Some(sender);
            (
                runtime.renderer_ready,
                runtime.app_version.clone(),
                runtime.public.email.clone(),
            )
        };
        if renderer_ready {
            let Some(version) = app_version else {
                return BridgeExit::Disconnected;
            };
            if send_ready(&mut socket, &version).await.is_err() {
                return BridgeExit::Disconnected;
            }
            self.publish(
                app,
                McpPublicState::with_state(McpConnectionState::Online, email),
            )
            .await;
        }

        loop {
            tokio::select! {
                control = receiver.recv() => {
                    match control {
                        Some(BridgeControl::Frame(frame)) => {
                            if frame.len() > MAX_BRIDGE_FRAME_BYTES || socket.send(Message::Text(frame.into())).await.is_err() {
                                break;
                            }
                        }
                        Some(BridgeControl::Ready(version)) => {
                            if send_ready(&mut socket, &version).await.is_err() {
                                break;
                            }
                            let email = self.inner.runtime.lock().await.public.email.clone();
                            self.publish(app, McpPublicState::with_state(McpConnectionState::Online, email)).await;
                        }
                        Some(BridgeControl::Close) | None => {
                            let _ = socket.close(None).await;
                            self.clear_bridge_sender(generation).await;
                            return BridgeExit::Cancelled;
                        }
                    }
                }
                incoming = socket.next() => {
                    match incoming {
                        Some(Ok(Message::Ping(payload))) => {
                            if socket.send(Message::Pong(payload)).await.is_err() {
                                break;
                            }
                        }
                        Some(Ok(Message::Pong(_))) => {}
                        Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                        Some(Ok(message)) => {
                            match decode_server_frame(message) {
                                Ok(frame @ ServerFrame::Request { .. }) => {
                                    let request = BridgeRequestEvent::from(frame);
                                    if app.emit(REQUEST_EVENT, &request).is_err() {
                                        let frame = renderer_error_response(&request.request_id);
                                        if socket.send(Message::Text(frame.into())).await.is_err() {
                                            break;
                                        }
                                    }
                                }
                                Ok(ServerFrame::SessionRevoked { .. }) => {
                                    self.clear_bridge_sender(generation).await;
                                    return BridgeExit::SessionRevoked;
                                }
                                _ => break,
                            }
                        }
                    }
                }
            }
            if !self.is_current(generation).await {
                self.clear_bridge_sender(generation).await;
                return BridgeExit::Cancelled;
            }
        }
        self.clear_bridge_sender(generation).await;
        BridgeExit::Disconnected
    }

    async fn clear_bridge_sender(&self, generation: u64) {
        let mut runtime = self.inner.runtime.lock().await;
        if runtime.generation == generation {
            runtime.bridge_sender = None;
        }
    }

    async fn handle_auth_lost(&self, app: &AppHandle) {
        let _ = self.begin_generation().await;
        let delete_result = self.delete_credential().await;
        {
            let mut runtime = self.inner.runtime.lock().await;
            runtime.access_token = None;
        }
        match delete_result {
            Ok(()) => self.publish(app, McpPublicState::logged_out()).await,
            Err(error) => {
                self.publish_error(app, McpConnectionState::Error, &error)
                    .await
            }
        }
    }

    async fn cancel_authorization(&self, app: &AppHandle) -> McpPublicState {
        self.begin_generation().await;
        self.publish(app, McpPublicState::logged_out()).await;
        self.snapshot().await
    }

    async fn logout(&self, app: &AppHandle) -> McpResult<McpPublicState> {
        let access = match self.access_token().await {
            Ok(value) => value,
            Err(error) if error.code == "AUTH_REQUIRED" => {
                self.handle_auth_lost(app).await;
                return Ok(self.snapshot().await);
            }
            Err(error) => {
                self.publish_error(app, McpConnectionState::Offline, &error)
                    .await;
                return Err(error);
            }
        };
        let credential = self
            .inner
            .runtime
            .lock()
            .await
            .credential
            .clone()
            .ok_or_else(McpError::auth_required)?;
        let result = self
            .authorized_json::<Value, SuccessResponse>(
                Method::POST,
                "v1/desktop/session/logout",
                &access.value,
                Some(&credential.session_id),
                Some(serde_json::json!({ "sessionId": credential.session_id })),
            )
            .await;
        if let Err(error) = result {
            if error.code != "AUTH_REQUIRED" {
                self.publish_error(app, McpConnectionState::Offline, &error)
                    .await;
                return Err(error);
            }
        }
        self.handle_auth_lost(app).await;
        Ok(self.snapshot().await)
    }

    async fn best_effort_logout_session(&self, access_token: &str, session_id: &str) {
        if !is_wire_uuid(session_id) {
            return;
        }
        let _ = self
            .authorized_json::<Value, SuccessResponse>(
                Method::POST,
                "v1/desktop/session/logout",
                access_token,
                Some(session_id),
                Some(serde_json::json!({ "sessionId": session_id })),
            )
            .await;
    }

    async fn revoke_ai_access(&self) -> McpResult<()> {
        self.account_action(Method::POST, "v1/desktop/revoke-ai-access")
            .await
    }

    async fn delete_account(&self, app: &AppHandle) -> McpResult<McpPublicState> {
        self.account_action(Method::DELETE, "v1/desktop/account")
            .await?;
        self.handle_auth_lost(app).await;
        Ok(self.snapshot().await)
    }

    async fn account_action(&self, method: Method, path: &str) -> McpResult<()> {
        let access = self.access_token().await?;
        let credential = self
            .inner
            .runtime
            .lock()
            .await
            .credential
            .clone()
            .ok_or_else(McpError::auth_required)?;
        self.authorized_json::<Value, SuccessResponse>(
            method,
            path,
            &access.value,
            Some(&credential.session_id),
            None,
        )
        .await
        .map(|_| ())
    }

    async fn send_bridge_response(&self, response: DesktopResponse) -> McpResult<()> {
        if !is_wire_uuid(&response.request_id) {
            return Err(McpError::new(
                "INVALID_INPUT",
                "The bridge response is invalid.",
            ));
        }
        if response.ok {
            if response.result.is_none() || response.error.is_some() {
                return Err(McpError::new(
                    "INVALID_INPUT",
                    "The bridge response is invalid.",
                ));
            }
        } else {
            let error = response
                .error
                .as_ref()
                .ok_or_else(|| McpError::new("INVALID_INPUT", "The bridge response is invalid."))?;
            if response.result.is_some()
                || !is_bridge_error_code(&error.code)
                || error.message.is_empty()
                || error.message.len() > 500
            {
                return Err(McpError::new(
                    "INVALID_INPUT",
                    "The bridge response is invalid.",
                ));
            }
        }
        let wire = WireDesktopResponse {
            frame_type: "response",
            response,
        };
        let frame = serde_json::to_string(&wire)
            .map_err(|_| McpError::new("INVALID_INPUT", "The bridge response is invalid."))?;
        if frame.len() > MAX_BRIDGE_FRAME_BYTES {
            return Err(McpError::new(
                "INVALID_INPUT",
                "The bridge response is too large.",
            ));
        }
        let sender = self
            .inner
            .runtime
            .lock()
            .await
            .bridge_sender
            .clone()
            .ok_or_else(|| McpError::new("NOTEX_OFFLINE", "NoteX is offline."))?;
        sender
            .send(BridgeControl::Frame(frame))
            .map_err(|_| McpError::new("NOTEX_OFFLINE", "NoteX is offline."))
    }

    async fn authorized_json<B: Serialize, T: DeserializeOwned>(
        &self,
        method: Method,
        path: &str,
        access_token: &str,
        session_id: Option<&str>,
        body: Option<B>,
    ) -> McpResult<T> {
        let endpoint = self.backend()?.endpoint(path)?;
        let mut request = self
            .inner
            .client
            .request(method, endpoint)
            .bearer_auth(access_token);
        if let Some(session_id) = session_id {
            request = request.header(DESKTOP_SESSION_HEADER, session_id);
        }
        if let Some(body) = body {
            request = request.json(&body);
        }
        let response = request.send().await.map_err(|_| McpError::network())?;
        if response.status().is_success() {
            return decode_json(response).await;
        }
        let status = response.status();
        let public = decode_json::<PublicHttpError>(response).await.ok();
        if matches!(
            public.as_ref().map(|value| value.code.as_str()),
            Some("USER_NOT_LOGGED_IN")
        ) {
            return Err(McpError::auth_required());
        }
        if status == StatusCode::UNAUTHORIZED || status == StatusCode::FORBIDDEN {
            return Err(McpError::auth_required());
        }
        Err(McpError::new(
            "BACKEND",
            "The NoteX MCP backend rejected the request.",
        ))
    }
}

impl Default for McpManager {
    fn default() -> Self {
        Self::new()
    }
}

impl AccessToken {
    fn from_response(response: &TokenResponse) -> McpResult<Self> {
        if response.access_token.is_empty() || response.expires_in == 0 {
            return Err(McpError::new(
                "AUTHORIZATION_FAILED",
                "The MCP backend returned an invalid access token.",
            ));
        }
        Ok(Self {
            value: response.access_token.clone(),
            expires_at: Instant::now() + Duration::from_secs(response.expires_in.into()),
        })
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthorizationMode {
    Register,
    Login,
}

#[derive(Serialize)]
struct StartAuthorizationBody {
    mode: AuthorizationMode,
}

#[derive(Deserialize)]
struct DeviceAuthorization {
    device_code: String,
    #[allow(dead_code)]
    user_code: String,
    verification_uri_complete: String,
    expires_in: u32,
    interval: u32,
    activation_token: String,
    client_id: String,
    token_endpoint: String,
    resource: String,
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u32,
}

#[derive(Deserialize)]
struct OAuthError {
    error: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ActivationResponse {
    session_id: String,
    email: String,
    bridge_url: String,
    ticket: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TicketResponse {
    bridge_url: String,
    ticket: String,
}

struct BridgeTicket {
    bridge_url: String,
    ticket: String,
}

#[derive(Deserialize)]
struct AccountResponse {
    email: String,
}

#[derive(Deserialize)]
struct SuccessResponse {
    #[allow(dead_code)]
    success: bool,
}

#[derive(Deserialize)]
struct PublicHttpError {
    code: String,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
enum ServerFrame {
    Authenticated,
    Request {
        #[serde(rename = "requestId")]
        request_id: String,
        command: String,
        input: Value,
        #[serde(rename = "deadlineAt")]
        deadline_at: String,
    },
    SessionRevoked {
        #[allow(dead_code)]
        reason: String,
    },
}

impl ServerFrame {
    fn into_validated(self) -> McpResult<Self> {
        if let Self::Request {
            request_id,
            command,
            deadline_at,
            ..
        } = &self
        {
            if !is_wire_uuid(request_id) || command.len() > 64 || deadline_at.len() > 64 {
                return Err(McpError::new("BRIDGE", "The bridge request is invalid."));
            }
        }
        Ok(self)
    }
}

impl From<ServerFrame> for BridgeRequestEvent {
    fn from(frame: ServerFrame) -> Self {
        match frame {
            ServerFrame::Request {
                request_id,
                command,
                input,
                deadline_at,
            } => Self {
                request_id,
                command,
                input,
                deadline_at,
            },
            _ => unreachable!("only request frames become renderer events"),
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct WireDesktopResponse {
    #[serde(rename = "type")]
    frame_type: &'static str,
    #[serde(flatten)]
    response: DesktopResponse,
}

enum BridgeExit {
    Cancelled,
    SessionRevoked,
    Disconnected,
}

fn decode_server_frame(message: Message) -> McpResult<ServerFrame> {
    let bytes = match message {
        Message::Text(text) => text.as_bytes().to_vec(),
        Message::Binary(bytes) => bytes.to_vec(),
        _ => return Err(McpError::new("BRIDGE", "The bridge frame is invalid.")),
    };
    if bytes.len() > MAX_BRIDGE_FRAME_BYTES {
        return Err(McpError::new("BRIDGE", "The bridge frame is too large."));
    }
    serde_json::from_slice::<ServerFrame>(&bytes)
        .map_err(|_| McpError::new("BRIDGE", "The bridge frame is invalid."))?
        .into_validated()
}

async fn send_ready<S>(socket: &mut S, app_version: &str) -> Result<(), tungstenite::Error>
where
    S: SinkExt<Message, Error = tungstenite::Error> + Unpin,
{
    let frame = serde_json::json!({
        "type": "ready",
        "protocolVersion": BRIDGE_PROTOCOL_VERSION,
        "appVersion": app_version,
    })
    .to_string();
    socket.send(Message::Text(frame.into())).await
}

fn renderer_error_response(request_id: &str) -> String {
    serde_json::json!({
        "type": "response",
        "requestId": request_id,
        "ok": false,
        "error": {
            "code": "INTERNAL",
            "message": "An internal error occurred",
            "retryable": false,
        }
    })
    .to_string()
}

fn is_bridge_error_code(code: &str) -> bool {
    matches!(
        code,
        "USER_NOT_LOGGED_IN"
            | "NOTEX_OFFLINE"
            | "FORBIDDEN"
            | "NOT_FOUND"
            | "READ_ONLY_TRASH"
            | "CONFLICT"
            | "LOCAL_EDITS_PENDING"
            | "INVALID_INPUT"
            | "UNSUPPORTED_CONTENT"
            | "TIMEOUT"
            | "INTERNAL"
    )
}

async fn decode_success<T: DeserializeOwned>(response: reqwest::Response) -> McpResult<T> {
    if !response.status().is_success() {
        return Err(McpError::new(
            "BACKEND",
            "The NoteX MCP backend rejected the request.",
        ));
    }
    decode_json(response).await
}

async fn decode_json<T: DeserializeOwned>(response: reqwest::Response) -> McpResult<T> {
    let bytes = response
        .bytes()
        .await
        .map_err(|_| McpError::new("BACKEND", "The MCP backend response could not be read."))?;
    if bytes.len() > 256 * 1024 {
        return Err(McpError::new(
            "BACKEND",
            "The MCP backend response is too large.",
        ));
    }
    serde_json::from_slice(&bytes)
        .map_err(|_| McpError::new("BACKEND", "The MCP backend response is invalid."))
}

#[tauri::command]
pub async fn notex_mcp_get_state(manager: State<'_, McpManager>) -> Result<McpPublicState, String> {
    Ok(manager.snapshot().await)
}

#[tauri::command]
pub async fn notex_mcp_initialize(
    app: AppHandle,
    manager: State<'_, McpManager>,
) -> Result<McpPublicState, String> {
    manager
        .initialize(&app)
        .await
        .map_err(|error| error.message)
}

#[tauri::command]
pub async fn notex_mcp_start_authorization(
    app: AppHandle,
    manager: State<'_, McpManager>,
    mode: AuthorizationMode,
) -> Result<McpPublicState, String> {
    manager
        .start_authorization(&app, mode)
        .await
        .map_err(|error| error.message)
}

#[tauri::command]
pub async fn notex_mcp_cancel_authorization(
    app: AppHandle,
    manager: State<'_, McpManager>,
) -> Result<McpPublicState, String> {
    Ok(manager.cancel_authorization(&app).await)
}

#[tauri::command]
pub async fn notex_mcp_logout(
    app: AppHandle,
    manager: State<'_, McpManager>,
) -> Result<McpPublicState, String> {
    manager.logout(&app).await.map_err(|error| error.message)
}

#[tauri::command]
pub async fn notex_mcp_revoke_ai_access(manager: State<'_, McpManager>) -> Result<(), String> {
    manager
        .revoke_ai_access()
        .await
        .map_err(|error| error.message)
}

#[tauri::command]
pub async fn notex_mcp_delete_account(
    app: AppHandle,
    manager: State<'_, McpManager>,
) -> Result<McpPublicState, String> {
    manager
        .delete_account(&app)
        .await
        .map_err(|error| error.message)
}

#[tauri::command]
pub async fn notex_mcp_respond(
    manager: State<'_, McpManager>,
    request_broker: State<'_, McpRequestBroker>,
    response: DesktopResponse,
) -> Result<(), String> {
    if McpRequestBroker::owns_request_id(&response.request_id) {
        return request_broker
            .respond(response)
            .await
            .map_err(|error| error.to_string());
    }
    manager
        .send_bridge_response(response)
        .await
        .map_err(|error| error.message)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_https_and_loopback_development_origins_only() {
        assert!(BackendConfig::from_configured_url("https://mcp.notex.example").is_ok());
        assert!(BackendConfig::from_configured_url("http://127.0.0.1:8080").is_ok());
        assert!(BackendConfig::from_configured_url("http://localhost:8080").is_ok());
        assert!(BackendConfig::from_configured_url("http://mcp.notex.example").is_err());
        assert!(BackendConfig::from_configured_url("https://user@example.com").is_err());
        assert!(BackendConfig::from_configured_url("https://example.com/path").is_err());
    }

    #[test]
    fn validates_backend_supplied_endpoints_against_the_configured_origin() {
        let backend = BackendConfig::from_configured_url("https://mcp.notex.example").unwrap();
        assert!(backend
            .validate_http_endpoint(
                "https://mcp.notex.example/api/auth/oauth2/token",
                &backend.token_endpoint,
            )
            .is_ok());
        assert!(backend
            .validate_http_endpoint(
                "https://attacker.example/api/auth/oauth2/token",
                &backend.token_endpoint,
            )
            .is_err());
        assert!(backend
            .validate_bridge_url("wss://mcp.notex.example/v1/bridge")
            .is_ok());
        assert!(backend
            .validate_bridge_url("wss://attacker.example/v1/bridge")
            .is_err());
    }

    #[test]
    fn parses_and_limits_server_bridge_frames() {
        let request_id = "11d29c3b-14f1-4878-aab9-65f901d62aba";
        let frame = Message::Text(
            serde_json::json!({
                "type": "request",
                "requestId": request_id,
                "command": "notex_status",
                "input": {},
                "deadlineAt": "2026-09-02T20:00:00.000Z",
            })
            .to_string()
            .into(),
        );
        assert!(matches!(
            decode_server_frame(frame),
            Ok(ServerFrame::Request { .. })
        ));
        assert!(decode_server_frame(Message::Binary(
            vec![b'x'; MAX_BRIDGE_FRAME_BYTES + 1].into()
        ))
        .is_err());

        let invalid_id = Message::Text(
            serde_json::json!({
                "type": "request",
                "requestId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
                "command": "notex_status",
                "input": {},
                "deadlineAt": "2026-09-02T20:00:00.000Z",
            })
            .to_string()
            .into(),
        );
        assert!(decode_server_frame(invalid_id).is_err());
    }

    #[test]
    fn serializes_bridge_responses_without_transport_metadata() {
        let response = DesktopResponse {
            request_id: "11d29c3b-14f1-4878-aab9-65f901d62aba".to_string(),
            ok: true,
            result: Some(serde_json::json!({ "state": "online" })),
            error: None,
        };
        let value = serde_json::to_value(WireDesktopResponse {
            frame_type: "response",
            response,
        })
        .unwrap();
        assert_eq!(value["type"], "response");
        assert_eq!(value["requestId"], "11d29c3b-14f1-4878-aab9-65f901d62aba");
        assert!(value.get("refreshToken").is_none());
        assert!(value.get("sessionId").is_none());
    }
}
