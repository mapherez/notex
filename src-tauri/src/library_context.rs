use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use tauri::{AppHandle, Manager};

static STORAGE_GATE: Mutex<()> = Mutex::new(());

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub email: String,
    pub name: String,
    pub picture: Option<String>,
}

#[derive(Default)]
pub struct LibraryManager(Mutex<Option<Selection>>);

#[derive(Clone)]
struct Selection {
    account: Option<Account>,
    directory: PathBuf,
}

fn validate_storage_identifier(identifier: &str, development: bool) -> Result<(), String> {
    // A debug build can run an experimental schema. Never let it open or migrate
    // an installed release's data, even when started outside the npm wrapper.
    if development && !identifier.ends_with(".dev") {
        return Err("Development builds require an isolated application identifier. Start NoteX using npm run tauri:dev.".into());
    }
    Ok(())
}

fn data_directory(app: &AppHandle) -> Result<PathBuf, String> {
    validate_storage_identifier(&app.config().identifier, cfg!(debug_assertions))?;
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn registry(base: &Path) -> Result<Connection, String> {
    std::fs::create_dir_all(base).map_err(|e| e.to_string())?;
    let conn = Connection::open(base.join("notex-accounts.sqlite")).map_err(|e| e.to_string())?;
    conn.execute_batch("CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, directory TEXT NOT NULL UNIQUE, profile TEXT NOT NULL);
                        CREATE TABLE IF NOT EXISTS session (id INTEGER PRIMARY KEY CHECK(id = 1), account_id TEXT);").map_err(|e| e.to_string())?;
    Ok(conn)
}

fn account_directory(email: &str) -> Result<String, String> {
    let normalized = email.trim().to_lowercase();
    if !normalized.contains('@') || normalized.len() > 180 {
        return Err("Invalid account email".into());
    }
    let mut name = String::new();
    for byte in normalized.bytes() {
        if byte.is_ascii_alphanumeric() || b"@._+-".contains(&byte) {
            name.push(byte as char);
        } else {
            name.push_str(&format!("%{byte:02X}"));
        }
    }
    Ok(name)
}

fn checked_directory(base: &Path, name: &str) -> Result<PathBuf, String> {
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\', ':']) {
        return Err("Invalid account directory".into());
    }
    let path = base.join(name);
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    let base = base.canonicalize().map_err(|e| e.to_string())?;
    let resolved = path.canonicalize().map_err(|e| e.to_string())?;
    if resolved.parent() != Some(base.as_path()) {
        return Err("Account directory is outside NoteX data".into());
    }
    Ok(path)
}

fn selection(app: &AppHandle) -> Result<Selection, String> {
    let manager = app.state::<LibraryManager>();
    let mut selected = manager.0.lock().map_err(|e| e.to_string())?;
    if let Some(value) = selected.as_ref() {
        return Ok(value.clone());
    }
    let base = data_directory(app)?;
    let conn = registry(&base)?;
    let record: Option<(String, String)> = conn.query_row(
        "SELECT a.directory, a.profile FROM session s JOIN accounts a ON a.id = s.account_id WHERE s.id = 1", [],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).optional().map_err(|e| e.to_string())?;
    let value = if let Some((directory, profile)) = record {
        Selection {
            account: Some(serde_json::from_str(&profile).map_err(|e| e.to_string())?),
            directory: checked_directory(&base, &directory)?,
        }
    } else {
        Selection {
            account: None,
            directory: base,
        }
    };
    *selected = Some(value.clone());
    Ok(value)
}

pub fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(selection(app)?.directory)
}

pub fn guard(app: &AppHandle, expected: Option<&str>) -> Result<MutexGuard<'static, ()>, String> {
    let guard = STORAGE_GATE.lock().map_err(|e| e.to_string())?;
    if selection(app)?
        .account
        .as_ref()
        .map(|account| account.id.as_str())
        != expected
    {
        return Err("The account library changed. This operation was not applied.".into());
    }
    Ok(guard)
}

#[tauri::command]
pub fn notex_library_current(app: AppHandle) -> Result<Option<Account>, String> {
    let _guard = STORAGE_GATE.lock().map_err(|e| e.to_string())?;
    Ok(selection(&app)?.account)
}

// Called after Google has verified the account. The UI drains editor writes and
// stops MCP before entering this function; the gate also protects native calls.
pub fn activate(
    app: &AppHandle,
    account: Account,
    expected: Option<&str>,
    resolutions: &std::collections::HashMap<String, String>,
) -> Result<(), String> {
    let _guard = guard(app, expected)?;
    let base = data_directory(app)?;
    let conn = registry(&base)?;
    let existing: Option<String> = conn
        .query_row(
            "SELECT directory FROM accounts WHERE id = ?1",
            [&account.id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let directory_name = existing.unwrap_or(account_directory(&account.email)?);
    let directory = checked_directory(&base, &directory_name)?;
    // Register ownership before moving data; a different Google ID cannot claim
    // the same directory, even if it presents an email used by another account.
    conn.execute("INSERT INTO accounts (id, directory, profile) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO UPDATE SET profile = excluded.profile",
        params![account.id, directory_name, serde_json::to_string(&account).map_err(|e| e.to_string())?]).map_err(|e| e.to_string())?;
    crate::sqlite_storage::merge_local_library_with_choices(&base, &directory, resolutions)?;
    conn.execute("INSERT INTO session VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET account_id = excluded.account_id", [&account.id]).map_err(|e| e.to_string())?;
    *app.state::<LibraryManager>()
        .0
        .lock()
        .map_err(|e| e.to_string())? = Some(Selection {
        account: Some(account),
        directory,
    });
    Ok(())
}

#[tauri::command]
pub fn notex_library_logout(app: AppHandle, library_id: Option<String>) -> Result<(), String> {
    let _guard = guard(&app, library_id.as_deref())?;
    let base = data_directory(&app)?;
    registry(&base)?
        .execute(
            "INSERT INTO session VALUES (1, NULL) ON CONFLICT(id) DO UPDATE SET account_id = NULL",
            [],
        )
        .map_err(|e| e.to_string())?;
    *app.state::<LibraryManager>()
        .0
        .lock()
        .map_err(|e| e.to_string())? = Some(Selection {
        account: None,
        directory: base,
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{account_directory, validate_storage_identifier};
    #[test]
    fn development_config_cannot_open_release_storage() {
        let release: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        let development: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.dev.conf.json")).unwrap();
        let release_id = release["identifier"].as_str().unwrap();
        let development_id = development["identifier"].as_str().unwrap();
        assert_ne!(release_id, development_id);
        assert!(validate_storage_identifier(release_id, true).is_err());
        assert!(validate_storage_identifier(development_id, true).is_ok());
        assert!(validate_storage_identifier(release_id, false).is_ok());
    }
    #[test]
    fn account_names_are_single_safe_components() {
        assert_eq!(
            account_directory("User.Name+notes@gmail.com").unwrap(),
            "user.name+notes@gmail.com"
        );
        assert_eq!(
            account_directory("a/b@gmail.com").unwrap(),
            "a%2Fb@gmail.com"
        );
        assert_ne!(
            account_directory("a/b@gmail.com").unwrap(),
            account_directory("a%2fb@gmail.com").unwrap()
        );
        assert!(account_directory("../other").is_err());
    }
}
