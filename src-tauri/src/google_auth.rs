//! Google authorization is independent of the hosted MCP service. Refresh
//! tokens never cross IPC; only short-lived access tokens reach the renderer.
use crate::library_context::{self, Account};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::Html,
    routing::get,
    Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;
use tokio_util::sync::CancellationToken;

const DRIVE_SCOPE: &str = "https://www.googleapis.com/auth/drive.appdata";
const SCOPES: &str = "openid email profile https://www.googleapis.com/auth/drive.appdata";
const TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

#[derive(Default)]
pub struct GoogleAuth {
    login: tokio::sync::Mutex<()>,
    cancellation: Mutex<Option<CancellationToken>>,
    candidate: Mutex<Option<Account>>,
    tokens: Mutex<HashMap<String, CachedToken>>,
    refresh: tokio::sync::Mutex<()>,
}
struct CachedToken {
    value: String,
    expires: Instant,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Config {
    desktop_client_id: String,
}

fn client_id() -> Result<String, String> {
    let config: Config = serde_json::from_str(include_str!("../../src/config/google.json"))
        .map_err(|_| "GOOGLE_CONFIG_INVALID")?;
    let id = config.desktop_client_id.trim();
    if id.is_empty() {
        return Err("GOOGLE_NOT_CONFIGURED".into());
    }
    Ok(id.to_string())
}

fn random_secret() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}
fn challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

#[derive(Clone)]
struct CallbackState {
    expected: String,
    sender: Arc<Mutex<Option<oneshot::Sender<Result<String, String>>>>>,
}
#[derive(Deserialize)]
struct Callback {
    state: Option<String>,
    code: Option<String>,
    error: Option<String>,
}

async fn callback(
    State(state): State<CallbackState>,
    Query(query): Query<Callback>,
) -> (StatusCode, Html<&'static str>) {
    if query.state.as_deref() != Some(&state.expected) {
        return (
            StatusCode::BAD_REQUEST,
            Html("Invalid authorization request."),
        );
    }
    let result = if query.error.is_some() {
        Err("GOOGLE_AUTH_CANCELLED".into())
    } else {
        query
            .code
            .filter(|code| !code.is_empty())
            .ok_or_else(|| "GOOGLE_AUTH_INVALID_CALLBACK".into())
    };
    if let Ok(mut sender) = state.sender.lock() {
        if let Some(sender) = sender.take() {
            let _ = sender.send(result);
        }
    }
    (StatusCode::OK, Html("<!doctype html><meta charset=utf-8><title>NoteX</title><p>NoteX: regressa à aplicação / return to the app. Podes fechar esta página / you can close this page.</p>"))
}

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    expires_in: u64,
    refresh_token: Option<String>,
    scope: Option<String>,
}
async fn exchange(fields: &[(&str, &str)]) -> Result<TokenResponse, String> {
    let response = reqwest::Client::new()
        .post(TOKEN_URL)
        .timeout(Duration::from_secs(30))
        .form(fields)
        .send()
        .await
        .map_err(|_| "GOOGLE_NETWORK_ERROR")?;
    if !response.status().is_success() {
        let body: serde_json::Value = response.json().await.unwrap_or_default();
        return Err(if body["error"] == "invalid_grant" {
            "GOOGLE_REAUTHORIZE"
        } else {
            "GOOGLE_TOKEN_ERROR"
        }
        .into());
    }
    let token: TokenResponse = response.json().await.map_err(|_| "GOOGLE_TOKEN_ERROR")?;
    if token.access_token.is_empty() || token.expires_in == 0 {
        return Err("GOOGLE_TOKEN_ERROR".into());
    }
    if let Some(scope) = &token.scope {
        if !scope.split_whitespace().any(|scope| scope == DRIVE_SCOPE) {
            return Err("GOOGLE_DRIVE_PERMISSION_REQUIRED".into());
        }
    }
    Ok(token)
}

#[derive(Deserialize)]
struct Profile {
    sub: String,
    email: String,
    email_verified: bool,
    name: Option<String>,
    picture: Option<String>,
}
async fn profile(access_token: &str) -> Result<Account, String> {
    let response = reqwest::Client::new()
        .get("https://www.googleapis.com/oauth2/v3/userinfo")
        .bearer_auth(access_token)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .map_err(|_| "GOOGLE_NETWORK_ERROR")?;
    if !response.status().is_success() {
        return Err("GOOGLE_PROFILE_ERROR".into());
    }
    let profile: Profile = response.json().await.map_err(|_| "GOOGLE_PROFILE_ERROR")?;
    if profile.sub.is_empty() || !profile.email_verified || !profile.email.contains('@') {
        return Err("GOOGLE_PROFILE_ERROR".into());
    }
    Ok(Account {
        id: profile.sub,
        name: profile.name.unwrap_or_else(|| profile.email.clone()),
        email: profile.email,
        picture: profile.picture,
    })
}

#[cfg(target_os = "windows")]
fn credential(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.mapherez.notex.google", account)
        .map_err(|_| "GOOGLE_CREDENTIAL_STORAGE_ERROR".into())
}
#[cfg(target_os = "windows")]
fn save_refresh(account: &str, token: &str) -> Result<(), String> {
    credential(account)?
        .set_password(token)
        .map_err(|_| "GOOGLE_CREDENTIAL_STORAGE_ERROR".into())
}
#[cfg(target_os = "windows")]
fn read_refresh(account: &str) -> Result<String, String> {
    credential(account)?
        .get_password()
        .map_err(|error| match error {
            keyring::Error::NoEntry => "GOOGLE_REAUTHORIZE".into(),
            _ => "GOOGLE_CREDENTIAL_STORAGE_ERROR".into(),
        })
}
#[cfg(not(target_os = "windows"))]
fn save_refresh(_: &str, _: &str) -> Result<(), String> {
    Err("GOOGLE_SECURE_STORAGE_UNAVAILABLE".into())
}
#[cfg(not(target_os = "windows"))]
fn read_refresh(_: &str) -> Result<String, String> {
    Err("GOOGLE_SECURE_STORAGE_UNAVAILABLE".into())
}

fn cache(auth: &GoogleAuth, id: &str, token: &TokenResponse) -> Result<(), String> {
    auth.tokens
        .lock()
        .map_err(|_| "GOOGLE_AUTH_STATE_ERROR")?
        .insert(
            id.to_string(),
            CachedToken {
                value: token.access_token.clone(),
                expires: Instant::now() + Duration::from_secs(token.expires_in.saturating_sub(60)),
            },
        );
    Ok(())
}

#[tauri::command]
pub async fn notex_google_login(app: AppHandle) -> Result<Account, String> {
    let auth = app.state::<GoogleAuth>();
    let _login = auth
        .login
        .try_lock()
        .map_err(|_| "GOOGLE_LOGIN_IN_PROGRESS")?;
    let id = client_id()?;
    *auth
        .candidate
        .lock()
        .map_err(|_| "GOOGLE_AUTH_STATE_ERROR")? = None;
    let cancellation = CancellationToken::new();
    *auth
        .cancellation
        .lock()
        .map_err(|_| "GOOGLE_AUTH_STATE_ERROR")? = Some(cancellation.clone());
    let result = authorize(&app, &id, cancellation).await;
    *auth
        .cancellation
        .lock()
        .map_err(|_| "GOOGLE_AUTH_STATE_ERROR")? = None;
    result
}

async fn authorize(
    app: &AppHandle,
    id: &str,
    cancellation: CancellationToken,
) -> Result<Account, String> {
    let verifier = random_secret();
    let state = random_secret();
    let listener = tokio::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))
        .await
        .map_err(|_| "GOOGLE_CALLBACK_UNAVAILABLE")?;
    let redirect = format!(
        "http://127.0.0.1:{}/oauth/callback",
        listener
            .local_addr()
            .map_err(|_| "GOOGLE_CALLBACK_UNAVAILABLE")?
            .port()
    );
    let (sender, receiver) = oneshot::channel();
    let router = Router::new()
        .route("/oauth/callback", get(callback))
        .with_state(CallbackState {
            expected: state.clone(),
            sender: Arc::new(Mutex::new(Some(sender))),
        });
    let shutdown = CancellationToken::new();
    let stop = shutdown.clone();
    let mut server = tokio::spawn(async move {
        axum::serve(listener, router)
            .with_graceful_shutdown(stop.cancelled_owned())
            .await
    });
    let mut url = reqwest::Url::parse("https://accounts.google.com/o/oauth2/v2/auth")
        .map_err(|_| "GOOGLE_CONFIG_INVALID")?;
    url.query_pairs_mut().extend_pairs([
        ("client_id", id),
        ("redirect_uri", redirect.as_str()),
        ("response_type", "code"),
        ("scope", SCOPES),
        ("state", state.as_str()),
        ("code_challenge", challenge(&verifier).as_str()),
        ("code_challenge_method", "S256"),
        ("access_type", "offline"),
        ("prompt", "select_account consent"),
    ]);
    let opened = crate::external_links::open_external_url(url.as_str());
    let code = if opened.is_err() {
        Err("GOOGLE_BROWSER_UNAVAILABLE".into())
    } else {
        tokio::select! {
            _ = cancellation.cancelled() => Err("GOOGLE_AUTH_CANCELLED".into()),
            result = tokio::time::timeout(Duration::from_secs(180), receiver) => {
                match result {
                    Ok(Ok(result)) => result,
                    Ok(Err(_)) => Err("GOOGLE_AUTH_INVALID_CALLBACK".into()),
                    Err(_) => Err("GOOGLE_AUTH_TIMEOUT".into()),
                }
            }
        }
    };
    shutdown.cancel();
    // The callback has no long-lived work; shut it down even if an unrelated
    // local connection stays open after the authorization window has ended.
    if tokio::time::timeout(Duration::from_secs(2), &mut server)
        .await
        .is_err()
    {
        server.abort();
    }
    let code = code?;
    let token = exchange(&[
        ("client_id", id),
        ("code", &code),
        ("code_verifier", &verifier),
        ("redirect_uri", &redirect),
        ("grant_type", "authorization_code"),
    ])
    .await?;
    let account = profile(&token.access_token).await?;
    if cancellation.is_cancelled() {
        return Err("GOOGLE_AUTH_CANCELLED".into());
    }
    if let Some(refresh) = &token.refresh_token {
        save_refresh(&account.id, refresh)?;
    } else {
        read_refresh(&account.id)?;
    }
    let auth = app.state::<GoogleAuth>();
    cache(&auth, &account.id, &token)?;
    *auth
        .candidate
        .lock()
        .map_err(|_| "GOOGLE_AUTH_STATE_ERROR")? = Some(account.clone());
    Ok(account)
}

#[tauri::command]
pub fn notex_google_cancel_login(app: AppHandle) -> Result<(), String> {
    let auth = app.state::<GoogleAuth>();
    if let Some(token) = auth
        .cancellation
        .lock()
        .map_err(|_| "GOOGLE_AUTH_STATE_ERROR")?
        .as_ref()
    {
        token.cancel();
    }
    *auth
        .candidate
        .lock()
        .map_err(|_| "GOOGLE_AUTH_STATE_ERROR")? = None;
    Ok(())
}

// Separate authorization from adoption, so the UI can flush editors, stop MCP,
// and handle a merge conflict before switching any active library.
#[tauri::command]
pub fn notex_google_activate(
    app: AppHandle,
    library_id: Option<String>,
    resolutions: Option<HashMap<String, String>>,
) -> Result<Account, String> {
    let auth = app.state::<GoogleAuth>();
    let mut candidate = auth
        .candidate
        .lock()
        .map_err(|_| "GOOGLE_AUTH_STATE_ERROR")?;
    let account = candidate.as_ref().ok_or("GOOGLE_LOGIN_REQUIRED")?.clone();
    library_context::activate(
        &app,
        account.clone(),
        library_id.as_deref(),
        &resolutions.unwrap_or_default(),
    )?;
    *candidate = None;
    Ok(account)
}

#[tauri::command]
pub async fn notex_google_access_token(
    app: AppHandle,
    library_id: String,
) -> Result<String, String> {
    {
        let _guard = library_context::guard(&app, Some(&library_id))?;
    }
    let auth = app.state::<GoogleAuth>();
    let _refresh = auth.refresh.lock().await;
    {
        let _guard = library_context::guard(&app, Some(&library_id))?;
    }
    if let Some(token) = auth
        .tokens
        .lock()
        .map_err(|_| "GOOGLE_AUTH_STATE_ERROR")?
        .get(&library_id)
    {
        if token.expires > Instant::now() {
            return Ok(token.value.clone());
        }
    }
    let refresh = read_refresh(&library_id)?;
    let id = client_id()?;
    let token = exchange(&[
        ("client_id", &id),
        ("refresh_token", &refresh),
        ("grant_type", "refresh_token"),
    ])
    .await?;
    let account = profile(&token.access_token).await?;
    if account.id != library_id {
        return Err("GOOGLE_ACCOUNT_MISMATCH".into());
    }
    {
        let _guard = library_context::guard(&app, Some(&library_id))?;
    }
    if let Some(refresh) = &token.refresh_token {
        save_refresh(&library_id, refresh)?;
    }
    cache(&auth, &library_id, &token)?;
    Ok(token.access_token)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pkce_matches_rfc7636_and_secrets_are_url_safe() {
        assert_eq!(
            challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
        let first = random_secret();
        assert_eq!(first.len(), 43);
        assert_ne!(first, random_secret());
        assert!(first
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_'));
    }
    #[tokio::test]
    async fn invalid_callback_state_cannot_finish_authorization() {
        let (sender, mut receiver) = oneshot::channel();
        let state = CallbackState {
            expected: "expected".into(),
            sender: Arc::new(Mutex::new(Some(sender))),
        };
        let bad = callback(
            State(state.clone()),
            Query(Callback {
                state: Some("wrong".into()),
                code: Some("code".into()),
                error: None,
            }),
        )
        .await;
        assert_eq!(bad.0, StatusCode::BAD_REQUEST);
        assert!(matches!(
            receiver.try_recv(),
            Err(oneshot::error::TryRecvError::Empty)
        ));
        let valid = callback(
            State(state),
            Query(Callback {
                state: Some("expected".into()),
                code: Some("code".into()),
                error: None,
            }),
        )
        .await;
        assert_eq!(valid.0, StatusCode::OK);
        assert_eq!(receiver.await.unwrap().unwrap(), "code");
    }
}
