use rusqlite::types::Value as SqlValue;
use rusqlite::{params, params_from_iter, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Component;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const SCHEMA_VERSION: &str = "1";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteStatus {
    initialized: bool,
    database_path: String,
    local_data_directory: String,
    files_directory: String,
    backup_directory: String,
    temp_directory: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteExportInfo {
    temp_path: String,
    file_name: String,
    created_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DynamicFileImportInfo {
    id: String,
    note_id: String,
    block_id: Option<String>,
    kind: String,
    original_name: String,
    mime_type: String,
    size_bytes: u64,
    checksum: String,
    relative_path: String,
    absolute_path: String,
    created_at: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteOperation {
    table: String,
    kind: String,
    value: Option<JsonValue>,
    values: Option<Vec<JsonValue>>,
    key: Option<String>,
    keys: Option<Vec<String>>,
    index: Option<String>,
}

#[derive(Clone, Copy)]
struct TableInfo {
    sql_name: &'static str,
    key_column: &'static str,
}

#[tauri::command]
pub fn notex_sqlite_status(app: AppHandle) -> Result<SqliteStatus, String> {
    let database_path = database_path(&app)?;
    let backup_directory = backup_directory(&app)?;
    let temp_directory = temp_directory(&app)?;
    let files_directory = files_directory(&app)?;
    let existed = database_path.exists();
    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    fs::create_dir_all(&backup_directory).map_err(to_string)?;
    fs::create_dir_all(&temp_directory).map_err(to_string)?;
    fs::create_dir_all(&files_directory).map_err(to_string)?;

    Ok(SqliteStatus {
        initialized: existed || read_metadata(&conn, "sqlite_schema_version")?.is_some(),
        database_path: database_path.to_string_lossy().to_string(),
        local_data_directory: local_data_directory(&app)?.to_string_lossy().to_string(),
        files_directory: files_directory.to_string_lossy().to_string(),
        backup_directory: backup_directory.to_string_lossy().to_string(),
        temp_directory: temp_directory.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn notex_sqlite_create_temp_export(app: AppHandle) -> Result<SqliteExportInfo, String> {
    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    let created_at = timestamp_for_filename();
    let file_name = format!("notex-export-{}.sqlite", created_at);
    let temp_path = temp_directory(&app)?.join(&file_name);

    if temp_path.exists() {
        fs::remove_file(&temp_path).map_err(to_string)?;
    }

    let temp_path_text = temp_path.to_string_lossy().to_string();
    conn.execute("VACUUM INTO ?1", params![temp_path_text])
        .map_err(to_string)?;
    validate_sqlite_database(&temp_path)?;

    Ok(SqliteExportInfo {
        temp_path: temp_path.to_string_lossy().to_string(),
        file_name,
        created_at,
    })
}

#[tauri::command]
pub fn notex_sqlite_copy_export_to(
    temp_path: String,
    destination_path: String,
) -> Result<String, String> {
    let source = PathBuf::from(temp_path);
    let destination = PathBuf::from(destination_path);
    if !source.is_file() {
        return Err("The temporary export file was not found".to_string());
    }

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(to_string)?;
    }

    fs::copy(&source, &destination).map_err(to_string)?;
    validate_sqlite_database(&destination)?;
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub fn notex_package_create_temp_export(app: AppHandle) -> Result<SqliteExportInfo, String> {
    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    let created_at = timestamp_for_filename();
    let file_name = format!("notex-export-{}.notex", created_at);
    let temp_dir = temp_directory(&app)?;
    fs::create_dir_all(&temp_dir).map_err(to_string)?;
    let temp_database = temp_dir.join(format!("notex-package-{}.sqlite", created_at));
    let package_path = temp_dir.join(&file_name);

    if temp_database.exists() {
        fs::remove_file(&temp_database).map_err(to_string)?;
    }
    if package_path.exists() {
        fs::remove_file(&package_path).map_err(to_string)?;
    }

    conn.execute("VACUUM INTO ?1", params![temp_database.to_string_lossy().to_string()])
        .map_err(to_string)?;
    validate_sqlite_database(&temp_database)?;

    create_notex_package(&package_path, &temp_database, &files_directory(&app)?, &created_at)?;
    validate_notex_package(&package_path)?;
    let _ = fs::remove_file(&temp_database);

    Ok(SqliteExportInfo {
        temp_path: package_path.to_string_lossy().to_string(),
        file_name,
        created_at,
    })
}

#[tauri::command]
pub fn notex_package_copy_export_to(
    temp_path: String,
    destination_path: String,
) -> Result<String, String> {
    let source = PathBuf::from(temp_path);
    let destination = PathBuf::from(destination_path);
    if !source.is_file() {
        return Err("The temporary NoteX package was not found".to_string());
    }
    validate_notex_package(&source)?;

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(to_string)?;
    }

    fs::copy(&source, &destination).map_err(to_string)?;
    validate_notex_package(&destination)?;
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub fn notex_package_replace_from_file(app: AppHandle, source_path: String) -> Result<(), String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("Selected NoteX package was not found".to_string());
    }
    validate_notex_package(&source)?;

    let created_at = timestamp_for_filename();
    let temp_dir = temp_directory(&app)?.join(format!("notex-import-{}", created_at));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(to_string)?;
    }
    fs::create_dir_all(&temp_dir).map_err(to_string)?;
    extract_notex_package(&source, &temp_dir)?;

    let incoming_database = temp_dir.join("notex.sqlite");
    validate_sqlite_database(&incoming_database)?;

    let database = database_path(&app)?;
    let files = files_directory(&app)?;
    let backup_database = temp_directory(&app)?.join(format!("notex-before-package-import-{}.sqlite", created_at));
    let backup_files = temp_directory(&app)?.join(format!("notex-files-before-package-import-{}", created_at));
    let had_existing_database = database.exists();
    let had_existing_files = files.exists();

    if had_existing_database {
        fs::copy(&database, &backup_database).map_err(to_string)?;
    }
    if had_existing_files {
        copy_directory(&files, &backup_files)?;
    }

    if let Some(parent) = database.parent() {
        fs::create_dir_all(parent).map_err(to_string)?;
    }

    let replace_result = (|| -> Result<(), String> {
        replace_file(&incoming_database, &database)?;
        if files.exists() {
            fs::remove_dir_all(&files).map_err(to_string)?;
        }
        let incoming_files = temp_dir.join("files");
        if incoming_files.exists() {
            copy_directory(&incoming_files, &files)?;
        } else {
            fs::create_dir_all(&files).map_err(to_string)?;
        }
        Ok(())
    })();

    if let Err(error) = replace_result {
        if had_existing_database && backup_database.exists() {
            let _ = fs::copy(&backup_database, &database);
        }
        if files.exists() {
            let _ = fs::remove_dir_all(&files);
        }
        if had_existing_files && backup_files.exists() {
            let _ = copy_directory(&backup_files, &files);
        }
        return Err(error);
    }

    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    write_metadata(&conn, "last_package_imported_at", &created_at)?;
    Ok(())
}

#[tauri::command]
pub fn notex_dynamic_file_import(
    app: AppHandle,
    source_path: String,
    note_id: String,
    block_id: Option<String>,
) -> Result<DynamicFileImportInfo, String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("Selected file was not found".to_string());
    }

    let original_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or("Selected file has no readable file name")?
        .to_string();
    let metadata = fs::metadata(&source).map_err(to_string)?;
    let checksum = checksum_file(&source)?;
    let id = format!("file-{}-{}", timestamp_for_filename(), &checksum[..12.min(checksum.len())]);
    let extension = source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| format!(".{}", sanitize_extension(value)))
        .unwrap_or_default();
    let relative_path = format!("{}/{}{}", sanitize_path_segment(&note_id), id, extension);
    let destination = files_directory(&app)?.join(&relative_path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(to_string)?;
    }
    fs::copy(&source, &destination).map_err(to_string)?;

    let mime_type = infer_mime_type(&source);
    let kind = if mime_type.starts_with("image/") { "image" } else { "attachment" }.to_string();
    Ok(DynamicFileImportInfo {
        id,
        note_id,
        block_id,
        kind,
        original_name,
        mime_type,
        size_bytes: metadata.len(),
        checksum,
        relative_path,
        absolute_path: destination.to_string_lossy().to_string(),
        created_at: current_timestamp(),
    })
}

#[tauri::command]
pub fn notex_dynamic_file_absolute_path(app: AppHandle, relative_path: String) -> Result<String, String> {
    let relative = safe_relative_files_path(&relative_path)?;
    Ok(files_directory(&app)?.join(relative).to_string_lossy().to_string())
}

#[tauri::command]
pub fn notex_dynamic_file_open(app: AppHandle, relative_path: String) -> Result<(), String> {
    let relative = safe_relative_files_path(&relative_path)?;
    open_file(&files_directory(&app)?.join(relative))
}

#[tauri::command]
pub fn notex_dynamic_file_copy_to(
    app: AppHandle,
    relative_path: String,
    destination_path: String,
) -> Result<String, String> {
    let relative = safe_relative_files_path(&relative_path)?;
    let source = files_directory(&app)?.join(relative);
    if !source.is_file() {
        return Err("The stored attachment was not found".to_string());
    }
    let destination = PathBuf::from(destination_path);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(to_string)?;
    }
    fs::copy(&source, &destination).map_err(to_string)?;
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub fn notex_dynamic_file_delete(app: AppHandle, relative_path: String) -> Result<(), String> {
    let relative = safe_relative_files_path(&relative_path)?;
    let source = files_directory(&app)?.join(relative);
    if source.is_file() {
        fs::remove_file(source).map_err(to_string)?;
    }
    Ok(())
}

#[tauri::command]
pub fn notex_sqlite_replace_database_from_file(
    app: AppHandle,
    source_path: String,
) -> Result<(), String> {
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("Selected database file was not found".to_string());
    }
    validate_sqlite_database(&source)?;

    let database = database_path(&app)?;
    let temp_dir = temp_directory(&app)?;
    fs::create_dir_all(&temp_dir).map_err(to_string)?;
    if let Some(parent) = database.parent() {
        fs::create_dir_all(parent).map_err(to_string)?;
    }

    let current_backup = temp_dir.join(format!(
        "notex-before-import-{}.sqlite",
        timestamp_for_filename()
    ));
    let incoming = temp_dir.join(format!("notex-import-{}.sqlite", timestamp_for_filename()));
    let had_existing_database = database.exists();

    if had_existing_database {
        fs::copy(&database, &current_backup).map_err(to_string)?;
    }

    fs::copy(&source, &incoming).map_err(to_string)?;
    validate_sqlite_database(&incoming)?;

    let replace_result = replace_file(&incoming, &database);
    if let Err(error) = replace_result {
        if had_existing_database && current_backup.exists() {
            let _ = fs::copy(&current_backup, &database);
        }
        return Err(error);
    }

    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    write_metadata(&conn, "last_imported_at", &timestamp_for_filename())?;
    if had_existing_database {
        write_metadata(
            &conn,
            "last_import_backup_path",
            &current_backup.to_string_lossy(),
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn notex_sqlite_open_database_folder(app: AppHandle) -> Result<(), String> {
    let database = database_path(&app)?;
    let folder = database
        .parent()
        .ok_or("Could not resolve the database folder")?;
    open_folder(folder)
}

#[tauri::command]
pub fn notex_sqlite_open_local_data_folder(app: AppHandle) -> Result<(), String> {
    let folder = local_data_directory(&app)?;
    fs::create_dir_all(&folder).map_err(to_string)?;
    open_folder(&folder)
}

#[tauri::command]
pub fn notex_sqlite_get(
    app: AppHandle,
    table: String,
    key: String,
) -> Result<Option<JsonValue>, String> {
    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    let info = table_info(&table)?;
    let sql = format!(
        "SELECT payload FROM {} WHERE {} = ?1 LIMIT 1",
        info.sql_name, info.key_column
    );
    let payload = conn
        .query_row(&sql, params![key], |row| row.get::<_, String>(0))
        .optional()
        .map_err(to_string)?;

    payload
        .map(|text| serde_json::from_str(&text).map_err(to_string))
        .transpose()
}

#[tauri::command]
pub fn notex_sqlite_read_table(app: AppHandle, table: String) -> Result<Vec<JsonValue>, String> {
    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    read_payloads(&conn, &table, None, &[])
}

#[tauri::command]
pub fn notex_sqlite_count(app: AppHandle, table: String) -> Result<i64, String> {
    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    let info = table_info(&table)?;
    let sql = format!("SELECT COUNT(*) FROM {}", info.sql_name);
    conn.query_row(&sql, [], |row| row.get(0))
        .map_err(to_string)
}

#[tauri::command]
pub fn notex_sqlite_where_read(
    app: AppHandle,
    table: String,
    index: String,
    values: Vec<JsonValue>,
) -> Result<Vec<JsonValue>, String> {
    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    read_payloads(&conn, &table, Some(&index), &values)
}

#[tauri::command]
pub fn notex_sqlite_where_count(
    app: AppHandle,
    table: String,
    index: String,
    values: Vec<JsonValue>,
) -> Result<i64, String> {
    if values.is_empty() {
        return Ok(0);
    }

    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    let info = table_info(&table)?;
    let column = index_column(&table, &index)?;
    let placeholders = placeholders(values.len());
    let sql = format!(
        "SELECT COUNT(*) FROM {} WHERE {} IN ({})",
        info.sql_name, column, placeholders
    );
    let params = values.iter().map(json_to_sql_value).collect::<Vec<_>>();
    conn.query_row(&sql, params_from_iter(params), |row| row.get(0))
        .map_err(to_string)
}

#[tauri::command]
pub fn notex_sqlite_transaction(
    app: AppHandle,
    operations: Vec<SqliteOperation>,
) -> Result<(), String> {
    if operations.is_empty() {
        return Ok(());
    }

    let mut conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    let tx = conn.transaction().map_err(to_string)?;
    for operation in operations {
        apply_operation(&tx, operation)?;
    }
    tx.commit().map_err(to_string)?;
    Ok(())
}

fn open_connection(app: &AppHandle) -> Result<Connection, String> {
    let path = database_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(to_string)?;
    }

    let conn = Connection::open(path).map_err(to_string)?;
    conn.pragma_update(None, "foreign_keys", "ON")
        .map_err(to_string)?;
    Ok(conn)
}

fn database_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(to_string)?
        .join("notex.sqlite"))
}

fn local_data_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_local_data_dir().map_err(to_string)
}

fn files_directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(to_string)?.join("files"))
}

fn backup_directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(to_string)?
        .join("backups"))
}

fn temp_directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_data_dir().map_err(to_string)?.join("_temp"))
}

fn ensure_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS notes (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          collection_id TEXT,
          tag_ids TEXT NOT NULL,
          linked_note_ids TEXT NOT NULL,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          is_pinned INTEGER NOT NULL DEFAULT 0,
          is_archived INTEGER NOT NULL DEFAULT 0,
          is_trashed INTEGER NOT NULL DEFAULT 0,
          save_state TEXT NOT NULL DEFAULT 'saved',
          author_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_opened_at TEXT,
          content TEXT NOT NULL,
          stats TEXT NOT NULL,
          related_links TEXT,
          thumbnail TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          sync_status TEXT NOT NULL DEFAULT 'local',
          payload TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
        CREATE INDEX IF NOT EXISTS idx_notes_collection_id ON notes(collection_id);
        CREATE INDEX IF NOT EXISTS idx_notes_is_favorite ON notes(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned);
        CREATE INDEX IF NOT EXISTS idx_notes_is_archived ON notes(is_archived);
        CREATE INDEX IF NOT EXISTS idx_notes_is_trashed ON notes(is_trashed);
        CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
        CREATE INDEX IF NOT EXISTS idx_notes_last_opened_at ON notes(last_opened_at);
        CREATE INDEX IF NOT EXISTS idx_notes_sync_status ON notes(sync_status);

        CREATE TABLE IF NOT EXISTS dynamic_notes (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          subtitle TEXT NOT NULL,
          collection_id TEXT,
          tag_ids TEXT NOT NULL,
          linked_note_ids TEXT NOT NULL,
          is_favorite INTEGER NOT NULL DEFAULT 0,
          is_pinned INTEGER NOT NULL DEFAULT 0,
          is_archived INTEGER NOT NULL DEFAULT 0,
          is_trashed INTEGER NOT NULL DEFAULT 0,
          save_state TEXT NOT NULL DEFAULT 'saved',
          author_id TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          last_opened_at TEXT,
          stats TEXT NOT NULL,
          thumbnail TEXT,
          version INTEGER NOT NULL DEFAULT 1,
          sync_status TEXT NOT NULL DEFAULT 'local',
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dynamic_notes_collection_id ON dynamic_notes(collection_id);
        CREATE INDEX IF NOT EXISTS idx_dynamic_notes_is_favorite ON dynamic_notes(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_dynamic_notes_is_pinned ON dynamic_notes(is_pinned);
        CREATE INDEX IF NOT EXISTS idx_dynamic_notes_is_archived ON dynamic_notes(is_archived);
        CREATE INDEX IF NOT EXISTS idx_dynamic_notes_is_trashed ON dynamic_notes(is_trashed);
        CREATE INDEX IF NOT EXISTS idx_dynamic_notes_updated_at ON dynamic_notes(updated_at);
        CREATE INDEX IF NOT EXISTS idx_dynamic_notes_last_opened_at ON dynamic_notes(last_opened_at);
        CREATE INDEX IF NOT EXISTS idx_dynamic_notes_sync_status ON dynamic_notes(sync_status);

        CREATE TABLE IF NOT EXISTS dynamic_note_blocks (
          id TEXT PRIMARY KEY,
          note_id TEXT NOT NULL,
          sort_order INTEGER NOT NULL,
          title TEXT NOT NULL,
          kind TEXT NOT NULL,
          content_json TEXT,
          content_text TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dynamic_note_blocks_note_id ON dynamic_note_blocks(note_id);
        CREATE INDEX IF NOT EXISTS idx_dynamic_note_blocks_sort_order ON dynamic_note_blocks(sort_order);
        CREATE INDEX IF NOT EXISTS idx_dynamic_note_blocks_updated_at ON dynamic_note_blocks(updated_at);

        CREATE TABLE IF NOT EXISTS dynamic_note_files (
          id TEXT PRIMARY KEY,
          note_id TEXT NOT NULL,
          block_id TEXT,
          kind TEXT NOT NULL,
          original_name TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          checksum TEXT NOT NULL,
          relative_path TEXT NOT NULL,
          created_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_dynamic_note_files_note_id ON dynamic_note_files(note_id);
        CREATE INDEX IF NOT EXISTS idx_dynamic_note_files_block_id ON dynamic_note_files(block_id);
        CREATE INDEX IF NOT EXISTS idx_dynamic_note_files_kind ON dynamic_note_files(kind);

        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT,
          count INTEGER,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);

        CREATE TABLE IF NOT EXISTS collections (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          icon TEXT,
          color TEXT,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);

        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          first_name TEXT,
          email TEXT,
          avatar_url TEXT,
          handle TEXT,
          google_sub TEXT,
          provider TEXT,
          last_login_at TEXT,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_google_sub ON users(google_sub);

        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          note_id TEXT NOT NULL,
          label TEXT NOT NULL,
          time TEXT NOT NULL,
          created_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_activities_note_id ON activities(note_id);
        CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at);

        CREATE TABLE IF NOT EXISTS user_settings (
          id TEXT PRIMARY KEY,
          theme TEXT NOT NULL,
          language TEXT NOT NULL,
          username TEXT NOT NULL,
          startup_page TEXT NOT NULL,
          preferred_layout TEXT NOT NULL,
          primary_collection_id TEXT NOT NULL,
          favorite_tag_ids TEXT NOT NULL,
          quick_pin_note_ids TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_user_settings_language ON user_settings(language);
        CREATE INDEX IF NOT EXISTS idx_user_settings_theme ON user_settings(theme);
        CREATE INDEX IF NOT EXISTS idx_user_settings_updated_at ON user_settings(updated_at);

        CREATE TABLE IF NOT EXISTS sync_state (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          connected INTEGER NOT NULL DEFAULT 0,
          google_sub TEXT,
          email TEXT,
          full_name TEXT,
          first_name TEXT,
          handle TEXT,
          avatar_url TEXT,
          last_login_at TEXT,
          last_sync_at TEXT,
          last_sync_started_at TEXT,
          last_error TEXT,
          device_id TEXT NOT NULL,
          workspace_file_id TEXT,
          manifest_file_id TEXT,
          updated_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sync_state_provider ON sync_state(provider);
        CREATE INDEX IF NOT EXISTS idx_sync_state_connected ON sync_state(connected);
        CREATE INDEX IF NOT EXISTS idx_sync_state_email ON sync_state(email);
        CREATE INDEX IF NOT EXISTS idx_sync_state_updated_at ON sync_state(updated_at);
        CREATE INDEX IF NOT EXISTS idx_sync_state_last_sync_at ON sync_state(last_sync_at);

        CREATE TABLE IF NOT EXISTS sync_items (
          entity_key TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          drive_file_id TEXT,
          base_hash TEXT,
          local_hash TEXT,
          remote_hash TEXT,
          remote_modified_time TEXT,
          remote_version TEXT,
          status TEXT NOT NULL,
          conflict TEXT,
          error TEXT,
          deleted_at TEXT,
          last_synced_at TEXT,
          updated_at TEXT NOT NULL,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_sync_items_entity_type ON sync_items(entity_type);
        CREATE INDEX IF NOT EXISTS idx_sync_items_entity_id ON sync_items(entity_id);
        CREATE INDEX IF NOT EXISTS idx_sync_items_status ON sync_items(status);
        CREATE INDEX IF NOT EXISTS idx_sync_items_updated_at ON sync_items(updated_at);

        CREATE TABLE IF NOT EXISTS device_sessions (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          last_seen_at TEXT NOT NULL,
          user_agent TEXT,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_device_sessions_last_seen_at ON device_sessions(last_seen_at);

        CREATE TABLE IF NOT EXISTS app_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        "#,
    )
    .map_err(to_string)?;

    write_metadata(conn, "sqlite_schema_version", SCHEMA_VERSION)?;
    Ok(())
}

fn read_metadata(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    conn.query_row(
        "SELECT value FROM app_metadata WHERE key = ?1",
        params![key],
        |row| row.get(0),
    )
    .optional()
    .map_err(to_string)
}

fn write_metadata(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO app_metadata (key, value, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        params![key, value],
    )
    .map_err(to_string)?;
    Ok(())
}

fn apply_operation(tx: &Transaction<'_>, operation: SqliteOperation) -> Result<(), String> {
    match operation.kind.as_str() {
        "put" => insert_payload(
            tx,
            &operation.table,
            operation.value.as_ref().ok_or("Missing put value")?,
        ),
        "bulkPut" => {
            for value in operation.values.as_ref().ok_or("Missing bulkPut values")? {
                insert_payload(tx, &operation.table, value)?;
            }
            Ok(())
        }
        "delete" => delete_key(
            tx,
            &operation.table,
            operation.key.as_deref().ok_or("Missing delete key")?,
        ),
        "bulkDelete" => {
            for key in operation.keys.as_ref().ok_or("Missing bulkDelete keys")? {
                delete_key(tx, &operation.table, key)?;
            }
            Ok(())
        }
        "clear" => {
            let info = table_info(&operation.table)?;
            tx.execute(&format!("DELETE FROM {}", info.sql_name), [])
                .map_err(to_string)?;
            Ok(())
        }
        "whereDelete" => where_delete(
            tx,
            &operation.table,
            operation
                .index
                .as_deref()
                .ok_or("Missing whereDelete index")?,
            operation
                .values
                .as_ref()
                .ok_or("Missing whereDelete values")?,
        ),
        other => Err(format!("Unsupported SQLite operation: {}", other)),
    }
}

fn insert_payload(tx: &Transaction<'_>, table: &str, value: &JsonValue) -> Result<(), String> {
    match table {
        "notes" => insert_note(tx, value),
        "dynamicNotes" => insert_dynamic_note(tx, value),
        "dynamicNoteBlocks" => insert_dynamic_note_block(tx, value),
        "dynamicNoteFiles" => insert_dynamic_note_file(tx, value),
        "tags" => insert_tag(tx, value),
        "collections" => insert_collection(tx, value),
        "users" => insert_user(tx, value),
        "activities" => insert_activity(tx, value),
        "userSettings" => insert_user_settings(tx, value),
        "syncState" => insert_sync_state(tx, value),
        "syncItems" => insert_sync_item(tx, value),
        "deviceSessions" => insert_device_session(tx, value),
        _ => Err(format!("Unknown SQLite table: {}", table)),
    }
}

fn insert_note(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO notes (
          id, type, title, collection_id, tag_ids, linked_note_ids, is_favorite,
          is_pinned, is_archived, is_trashed, save_state, author_id, created_at,
          updated_at, last_opened_at, content, stats, related_links, thumbnail,
          version, sync_status, payload
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          title = excluded.title,
          collection_id = excluded.collection_id,
          tag_ids = excluded.tag_ids,
          linked_note_ids = excluded.linked_note_ids,
          is_favorite = excluded.is_favorite,
          is_pinned = excluded.is_pinned,
          is_archived = excluded.is_archived,
          is_trashed = excluded.is_trashed,
          save_state = excluded.save_state,
          author_id = excluded.author_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          last_opened_at = excluded.last_opened_at,
          content = excluded.content,
          stats = excluded.stats,
          related_links = excluded.related_links,
          thumbnail = excluded.thumbnail,
          version = excluded.version,
          sync_status = excluded.sync_status,
          payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "type", "standard")?,
            text(value, "title", "")?,
            opt_text(value, "collectionId"),
            json_field(value, "tagIds", JsonValue::Array(vec![]))?,
            json_field(value, "linkedNoteIds", JsonValue::Array(vec![]))?,
            bool_i64(value, "isFavorite"),
            bool_i64(value, "isPinned"),
            bool_i64(value, "isArchived"),
            bool_i64(value, "isTrashed"),
            text(value, "saveState", "saved")?,
            opt_text(value, "authorId"),
            text(value, "createdAt", "")?,
            text(value, "updatedAt", "")?,
            opt_text(value, "lastOpenedAt"),
            json_field(value, "content", JsonValue::Object(Default::default()))?,
            json_field(value, "stats", JsonValue::Object(Default::default()))?,
            optional_json_field(value, "relatedLinks")?,
            optional_json_field(value, "thumbnail")?,
            i64_field(value, "version", 1),
            text(value, "syncStatus", "local")?,
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_dynamic_note(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO dynamic_notes (
          id, title, subtitle, collection_id, tag_ids, linked_note_ids, is_favorite,
          is_pinned, is_archived, is_trashed, save_state, author_id, created_at,
          updated_at, last_opened_at, stats, thumbnail, version, sync_status, payload
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          subtitle = excluded.subtitle,
          collection_id = excluded.collection_id,
          tag_ids = excluded.tag_ids,
          linked_note_ids = excluded.linked_note_ids,
          is_favorite = excluded.is_favorite,
          is_pinned = excluded.is_pinned,
          is_archived = excluded.is_archived,
          is_trashed = excluded.is_trashed,
          save_state = excluded.save_state,
          author_id = excluded.author_id,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          last_opened_at = excluded.last_opened_at,
          stats = excluded.stats,
          thumbnail = excluded.thumbnail,
          version = excluded.version,
          sync_status = excluded.sync_status,
          payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "title", "")?,
            text(value, "subtitle", "")?,
            opt_text(value, "collectionId"),
            json_field(value, "tagIds", JsonValue::Array(vec![]))?,
            json_field(value, "linkedNoteIds", JsonValue::Array(vec![]))?,
            bool_i64(value, "isFavorite"),
            bool_i64(value, "isPinned"),
            bool_i64(value, "isArchived"),
            bool_i64(value, "isTrashed"),
            text(value, "saveState", "saved")?,
            opt_text(value, "authorId"),
            text(value, "createdAt", "")?,
            text(value, "updatedAt", "")?,
            opt_text(value, "lastOpenedAt"),
            json_field(value, "stats", JsonValue::Object(Default::default()))?,
            optional_json_field(value, "thumbnail")?,
            i64_field(value, "version", 1),
            text(value, "syncStatus", "local")?,
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_dynamic_note_block(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO dynamic_note_blocks (
          id, note_id, sort_order, title, kind, content_json, content_text, created_at, updated_at, payload
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
        ON CONFLICT(id) DO UPDATE SET
          note_id = excluded.note_id,
          sort_order = excluded.sort_order,
          title = excluded.title,
          kind = excluded.kind,
          content_json = excluded.content_json,
          content_text = excluded.content_text,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at,
          payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "noteId", "")?,
            i64_field(value, "sortOrder", 0),
            text(value, "title", "")?,
            text(value, "kind", "content")?,
            optional_json_field(value, "contentJson")?,
            text(value, "contentText", "")?,
            text(value, "createdAt", "")?,
            text(value, "updatedAt", "")?,
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_dynamic_note_file(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO dynamic_note_files (
          id, note_id, block_id, kind, original_name, mime_type, size_bytes, checksum, relative_path, created_at, payload
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ON CONFLICT(id) DO UPDATE SET
          note_id = excluded.note_id,
          block_id = excluded.block_id,
          kind = excluded.kind,
          original_name = excluded.original_name,
          mime_type = excluded.mime_type,
          size_bytes = excluded.size_bytes,
          checksum = excluded.checksum,
          relative_path = excluded.relative_path,
          created_at = excluded.created_at,
          payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "noteId", "")?,
            opt_text(value, "blockId"),
            text(value, "kind", "attachment")?,
            text(value, "originalName", "")?,
            text(value, "mimeType", "application/octet-stream")?,
            i64_field(value, "sizeBytes", 0),
            text(value, "checksum", "")?,
            text(value, "relativePath", "")?,
            text(value, "createdAt", "")?,
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_tag(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO tags (id, name, color, count, payload)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color, count = excluded.count, payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "name", "")?,
            opt_text(value, "color"),
            optional_i64(value, "count"),
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_collection(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO collections (id, name, icon, color, payload)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, icon = excluded.icon, color = excluded.color, payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "name", "")?,
            opt_text(value, "icon"),
            opt_text(value, "color"),
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_user(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO users (id, name, first_name, email, avatar_url, handle, google_sub, provider, last_login_at, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          first_name = excluded.first_name,
          email = excluded.email,
          avatar_url = excluded.avatar_url,
          handle = excluded.handle,
          google_sub = excluded.google_sub,
          provider = excluded.provider,
          last_login_at = excluded.last_login_at,
          payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "name", "")?,
            opt_text(value, "firstName"),
            opt_text(value, "email"),
            opt_text(value, "avatarUrl"),
            opt_text(value, "handle"),
            opt_text(value, "googleSub"),
            opt_text(value, "provider"),
            opt_text(value, "lastLoginAt"),
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_activity(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO activities (id, note_id, label, time, created_at, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(id) DO UPDATE SET
          note_id = excluded.note_id,
          label = excluded.label,
          time = excluded.time,
          created_at = excluded.created_at,
          payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "noteId", "")?,
            text(value, "label", "")?,
            text(value, "time", "")?,
            text(value, "createdAt", "")?,
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_user_settings(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO user_settings (
          id, theme, language, username, startup_page, preferred_layout,
          primary_collection_id, favorite_tag_ids, quick_pin_note_ids, updated_at, payload
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ON CONFLICT(id) DO UPDATE SET
          theme = excluded.theme,
          language = excluded.language,
          username = excluded.username,
          startup_page = excluded.startup_page,
          preferred_layout = excluded.preferred_layout,
          primary_collection_id = excluded.primary_collection_id,
          favorite_tag_ids = excluded.favorite_tag_ids,
          quick_pin_note_ids = excluded.quick_pin_note_ids,
          updated_at = excluded.updated_at,
          payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "theme", "dark")?,
            text(value, "language", "pt")?,
            text(value, "username", "Local user")?,
            text(value, "startupPage", "/")?,
            text(value, "preferredLayout", "list")?,
            text(value, "primaryCollectionId", "collection-work")?,
            json_field(value, "favoriteTagIds", JsonValue::Array(vec![]))?,
            json_field(value, "quickPinNoteIds", JsonValue::Array(vec![]))?,
            text(value, "updatedAt", "")?,
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_sync_state(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO sync_state (
          id, provider, connected, google_sub, email, full_name, first_name,
          handle, avatar_url, last_login_at, last_sync_at, last_sync_started_at,
          last_error, device_id, workspace_file_id, manifest_file_id, updated_at, payload
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)
        ON CONFLICT(id) DO UPDATE SET
          provider = excluded.provider,
          connected = excluded.connected,
          google_sub = excluded.google_sub,
          email = excluded.email,
          full_name = excluded.full_name,
          first_name = excluded.first_name,
          handle = excluded.handle,
          avatar_url = excluded.avatar_url,
          last_login_at = excluded.last_login_at,
          last_sync_at = excluded.last_sync_at,
          last_sync_started_at = excluded.last_sync_started_at,
          last_error = excluded.last_error,
          device_id = excluded.device_id,
          workspace_file_id = excluded.workspace_file_id,
          manifest_file_id = excluded.manifest_file_id,
          updated_at = excluded.updated_at,
          payload = excluded.payload",
        params![
            text(value, "id", "google-drive")?,
            text(value, "provider", "google-drive")?,
            bool_i64(value, "connected"),
            opt_text(value, "googleSub"),
            opt_text(value, "email"),
            opt_text(value, "fullName"),
            opt_text(value, "firstName"),
            opt_text(value, "handle"),
            opt_text(value, "avatarUrl"),
            opt_text(value, "lastLoginAt"),
            opt_text(value, "lastSyncAt"),
            opt_text(value, "lastSyncStartedAt"),
            opt_text(value, "lastError"),
            text(value, "deviceId", "")?,
            opt_text(value, "workspaceFileId"),
            opt_text(value, "manifestFileId"),
            text(value, "updatedAt", "")?,
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_sync_item(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO sync_items (
          entity_key, entity_type, entity_id, drive_file_id, base_hash, local_hash,
          remote_hash, remote_modified_time, remote_version, status, conflict,
          error, deleted_at, last_synced_at, updated_at, payload
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        ON CONFLICT(entity_key) DO UPDATE SET
          entity_type = excluded.entity_type,
          entity_id = excluded.entity_id,
          drive_file_id = excluded.drive_file_id,
          base_hash = excluded.base_hash,
          local_hash = excluded.local_hash,
          remote_hash = excluded.remote_hash,
          remote_modified_time = excluded.remote_modified_time,
          remote_version = excluded.remote_version,
          status = excluded.status,
          conflict = excluded.conflict,
          error = excluded.error,
          deleted_at = excluded.deleted_at,
          last_synced_at = excluded.last_synced_at,
          updated_at = excluded.updated_at,
          payload = excluded.payload",
        params![
            text(value, "entityKey", "")?,
            text(value, "entityType", "")?,
            text(value, "entityId", "")?,
            opt_text(value, "driveFileId"),
            opt_text(value, "baseHash"),
            opt_text(value, "localHash"),
            opt_text(value, "remoteHash"),
            opt_text(value, "remoteModifiedTime"),
            opt_text(value, "remoteVersion"),
            text(value, "status", "pending")?,
            optional_json_field(value, "conflict")?,
            opt_text(value, "error"),
            opt_text(value, "deletedAt"),
            opt_text(value, "lastSyncedAt"),
            text(value, "updatedAt", "")?,
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_device_session(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO device_sessions (id, name, last_seen_at, user_agent, payload)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          last_seen_at = excluded.last_seen_at,
          user_agent = excluded.user_agent,
          payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "name", "")?,
            text(value, "lastSeenAt", "")?,
            opt_text(value, "userAgent"),
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn delete_key(tx: &Transaction<'_>, table: &str, key: &str) -> Result<(), String> {
    let info = table_info(table)?;
    let sql = format!(
        "DELETE FROM {} WHERE {} = ?1",
        info.sql_name, info.key_column
    );
    tx.execute(&sql, params![key]).map_err(to_string)?;
    Ok(())
}

fn where_delete(
    tx: &Transaction<'_>,
    table: &str,
    index: &str,
    values: &[JsonValue],
) -> Result<(), String> {
    if values.is_empty() {
        return Ok(());
    }

    let info = table_info(table)?;
    let column = index_column(table, index)?;
    let sql = format!(
        "DELETE FROM {} WHERE {} IN ({})",
        info.sql_name,
        column,
        placeholders(values.len())
    );
    let params = values.iter().map(json_to_sql_value).collect::<Vec<_>>();
    tx.execute(&sql, params_from_iter(params))
        .map_err(to_string)?;
    Ok(())
}

fn read_payloads(
    conn: &Connection,
    table: &str,
    index: Option<&str>,
    values: &[JsonValue],
) -> Result<Vec<JsonValue>, String> {
    let info = table_info(table)?;
    let mut sql = format!("SELECT payload FROM {}", info.sql_name);
    let params = values.iter().map(json_to_sql_value).collect::<Vec<_>>();

    if let Some(index) = index {
        if values.is_empty() {
            return Ok(vec![]);
        }
        let column = index_column(table, index)?;
        sql.push_str(&format!(
            " WHERE {} IN ({})",
            column,
            placeholders(values.len())
        ));
    }

    let mut stmt = conn.prepare(&sql).map_err(to_string)?;
    let rows = stmt
        .query_map(params_from_iter(params), |row| row.get::<_, String>(0))
        .map_err(to_string)?;

    let mut payloads = Vec::new();
    for row in rows {
        let text = row.map_err(to_string)?;
        payloads.push(serde_json::from_str(&text).map_err(to_string)?);
    }
    Ok(payloads)
}

fn table_info(table: &str) -> Result<TableInfo, String> {
    match table {
        "notes" => Ok(TableInfo {
            sql_name: "notes",
            key_column: "id",
        }),
        "dynamicNotes" => Ok(TableInfo {
            sql_name: "dynamic_notes",
            key_column: "id",
        }),
        "dynamicNoteBlocks" => Ok(TableInfo {
            sql_name: "dynamic_note_blocks",
            key_column: "id",
        }),
        "dynamicNoteFiles" => Ok(TableInfo {
            sql_name: "dynamic_note_files",
            key_column: "id",
        }),
        "tags" => Ok(TableInfo {
            sql_name: "tags",
            key_column: "id",
        }),
        "collections" => Ok(TableInfo {
            sql_name: "collections",
            key_column: "id",
        }),
        "users" => Ok(TableInfo {
            sql_name: "users",
            key_column: "id",
        }),
        "activities" => Ok(TableInfo {
            sql_name: "activities",
            key_column: "id",
        }),
        "userSettings" => Ok(TableInfo {
            sql_name: "user_settings",
            key_column: "id",
        }),
        "syncState" => Ok(TableInfo {
            sql_name: "sync_state",
            key_column: "id",
        }),
        "syncItems" => Ok(TableInfo {
            sql_name: "sync_items",
            key_column: "entity_key",
        }),
        "deviceSessions" => Ok(TableInfo {
            sql_name: "device_sessions",
            key_column: "id",
        }),
        _ => Err(format!("Unknown SQLite table: {}", table)),
    }
}

fn index_column(table: &str, index: &str) -> Result<&'static str, String> {
    match (table, index) {
        ("notes", "id") => Ok("id"),
        ("notes", "type") => Ok("type"),
        ("notes", "collectionId") => Ok("collection_id"),
        ("notes", "isFavorite") => Ok("is_favorite"),
        ("notes", "isPinned") => Ok("is_pinned"),
        ("notes", "isArchived") => Ok("is_archived"),
        ("notes", "isTrashed") => Ok("is_trashed"),
        ("notes", "updatedAt") => Ok("updated_at"),
        ("notes", "lastOpenedAt") => Ok("last_opened_at"),
        ("notes", "syncStatus") => Ok("sync_status"),
        ("dynamicNotes", "id") => Ok("id"),
        ("dynamicNotes", "collectionId") => Ok("collection_id"),
        ("dynamicNotes", "isFavorite") => Ok("is_favorite"),
        ("dynamicNotes", "isPinned") => Ok("is_pinned"),
        ("dynamicNotes", "isArchived") => Ok("is_archived"),
        ("dynamicNotes", "isTrashed") => Ok("is_trashed"),
        ("dynamicNotes", "updatedAt") => Ok("updated_at"),
        ("dynamicNotes", "lastOpenedAt") => Ok("last_opened_at"),
        ("dynamicNotes", "syncStatus") => Ok("sync_status"),
        ("dynamicNoteBlocks", "id") => Ok("id"),
        ("dynamicNoteBlocks", "noteId") => Ok("note_id"),
        ("dynamicNoteBlocks", "sortOrder") => Ok("sort_order"),
        ("dynamicNoteBlocks", "updatedAt") => Ok("updated_at"),
        ("dynamicNoteFiles", "id") => Ok("id"),
        ("dynamicNoteFiles", "noteId") => Ok("note_id"),
        ("dynamicNoteFiles", "blockId") => Ok("block_id"),
        ("dynamicNoteFiles", "kind") => Ok("kind"),
        ("tags", "id") => Ok("id"),
        ("tags", "name") => Ok("name"),
        ("collections", "id") => Ok("id"),
        ("collections", "name") => Ok("name"),
        ("users", "id") => Ok("id"),
        ("users", "email") => Ok("email"),
        ("users", "googleSub") => Ok("google_sub"),
        ("activities", "id") => Ok("id"),
        ("activities", "noteId") => Ok("note_id"),
        ("activities", "createdAt") => Ok("created_at"),
        ("userSettings", "id") => Ok("id"),
        ("userSettings", "language") => Ok("language"),
        ("userSettings", "theme") => Ok("theme"),
        ("userSettings", "updatedAt") => Ok("updated_at"),
        ("syncState", "id") => Ok("id"),
        ("syncState", "provider") => Ok("provider"),
        ("syncState", "connected") => Ok("connected"),
        ("syncState", "email") => Ok("email"),
        ("syncState", "updatedAt") => Ok("updated_at"),
        ("syncState", "lastSyncAt") => Ok("last_sync_at"),
        ("syncItems", "entityKey") => Ok("entity_key"),
        ("syncItems", "entityType") => Ok("entity_type"),
        ("syncItems", "entityId") => Ok("entity_id"),
        ("syncItems", "status") => Ok("status"),
        ("syncItems", "updatedAt") => Ok("updated_at"),
        ("deviceSessions", "id") => Ok("id"),
        ("deviceSessions", "lastSeenAt") => Ok("last_seen_at"),
        _ => Err(format!("Unsupported SQLite index {}.{}", table, index)),
    }
}

fn text(value: &JsonValue, field: &str, fallback: &str) -> Result<String, String> {
    Ok(value
        .get(field)
        .and_then(JsonValue::as_str)
        .unwrap_or(fallback)
        .to_string())
}

fn opt_text(value: &JsonValue, field: &str) -> Option<String> {
    value
        .get(field)
        .and_then(JsonValue::as_str)
        .map(ToString::to_string)
}

fn bool_i64(value: &JsonValue, field: &str) -> i64 {
    if value
        .get(field)
        .and_then(JsonValue::as_bool)
        .unwrap_or(false)
    {
        1
    } else {
        0
    }
}

fn i64_field(value: &JsonValue, field: &str, fallback: i64) -> i64 {
    value
        .get(field)
        .and_then(JsonValue::as_i64)
        .unwrap_or(fallback)
}

fn optional_i64(value: &JsonValue, field: &str) -> Option<i64> {
    value.get(field).and_then(JsonValue::as_i64)
}

fn json_field(value: &JsonValue, field: &str, fallback: JsonValue) -> Result<String, String> {
    serde_json::to_string(value.get(field).unwrap_or(&fallback)).map_err(to_string)
}

fn optional_json_field(value: &JsonValue, field: &str) -> Result<Option<String>, String> {
    value
        .get(field)
        .map(serde_json::to_string)
        .transpose()
        .map_err(to_string)
}

fn payload_text(value: &JsonValue) -> Result<String, String> {
    serde_json::to_string(value).map_err(to_string)
}

fn json_to_sql_value(value: &JsonValue) -> SqlValue {
    match value {
        JsonValue::Null => SqlValue::Null,
        JsonValue::Bool(value) => SqlValue::Integer(if *value { 1 } else { 0 }),
        JsonValue::Number(value) => {
            if let Some(number) = value.as_i64() {
                SqlValue::Integer(number)
            } else if let Some(number) = value.as_f64() {
                SqlValue::Real(number)
            } else {
                SqlValue::Null
            }
        }
        JsonValue::String(value) => SqlValue::Text(value.clone()),
        other => SqlValue::Text(other.to_string()),
    }
}

fn placeholders(count: usize) -> String {
    std::iter::repeat("?")
        .take(count)
        .collect::<Vec<_>>()
        .join(", ")
}

fn to_string(error: impl std::fmt::Display) -> String {
    error.to_string()
}

fn timestamp_for_filename() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);

    seconds.to_string()
}

fn current_timestamp() -> String {
    timestamp_for_filename()
}

fn validate_sqlite_database(path: &Path) -> Result<(), String> {
    let conn =
        Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(to_string)?;
    for table in [
        "notes",
        "tags",
        "collections",
        "user_settings",
        "app_metadata",
    ] {
        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                params![table],
                |row| row.get(0),
            )
            .map_err(to_string)?;
        if exists == 0 {
            return Err(format!(
                "Selected file is not a valid NoteX SQLite database. Missing table: {}",
                table
            ));
        }
    }

    Ok(())
}

fn create_notex_package(
    package_path: &Path,
    database_path: &Path,
    files_path: &Path,
    created_at: &str,
) -> Result<(), String> {
    let package_file = File::create(package_path).map_err(to_string)?;
    let mut zip = ZipWriter::new(package_file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let manifest = serde_json::json!({
        "schemaVersion": 1,
        "exportedAt": created_at,
        "database": "notex.sqlite",
        "filesDirectory": "files"
    });

    zip.start_file("manifest.json", options).map_err(to_string)?;
    zip.write_all(manifest.to_string().as_bytes()).map_err(to_string)?;
    zip.start_file("notex.sqlite", options).map_err(to_string)?;
    let mut database_file = File::open(database_path).map_err(to_string)?;
    std::io::copy(&mut database_file, &mut zip).map_err(to_string)?;

    if files_path.exists() {
        add_directory_to_zip(&mut zip, files_path, files_path, "files", options)?;
    }

    zip.finish().map_err(to_string)?;
    Ok(())
}

fn add_directory_to_zip(
    zip: &mut ZipWriter<File>,
    root: &Path,
    current: &Path,
    archive_root: &str,
    options: SimpleFileOptions,
) -> Result<(), String> {
    for entry in fs::read_dir(current).map_err(to_string)? {
        let entry = entry.map_err(to_string)?;
        let path = entry.path();
        let relative = path.strip_prefix(root).map_err(to_string)?;
        let archive_name = format!(
            "{}/{}",
            archive_root,
            relative.to_string_lossy().replace('\\', "/")
        );

        if path.is_dir() {
            add_directory_to_zip(zip, root, &path, archive_root, options)?;
        } else if path.is_file() {
            zip.start_file(archive_name, options).map_err(to_string)?;
            let mut file = File::open(path).map_err(to_string)?;
            std::io::copy(&mut file, zip).map_err(to_string)?;
        }
    }

    Ok(())
}

fn validate_notex_package(path: &Path) -> Result<(), String> {
    let file = File::open(path).map_err(to_string)?;
    let mut archive = ZipArchive::new(file).map_err(to_string)?;
    let mut has_database = false;
    let mut has_manifest = false;

    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(to_string)?;
        let name = file.name();
        let safe_path = safe_archive_path(name)?;
        if safe_path == PathBuf::from("notex.sqlite") {
            has_database = true;
        }
        if safe_path == PathBuf::from("manifest.json") {
            has_manifest = true;
        }
    }

    if !has_manifest {
        return Err("Selected file is not a valid NoteX package. Missing manifest.json".to_string());
    }
    if !has_database {
        return Err("Selected file is not a valid NoteX package. Missing notex.sqlite".to_string());
    }
    Ok(())
}

fn extract_notex_package(source: &Path, destination: &Path) -> Result<(), String> {
    let file = File::open(source).map_err(to_string)?;
    let mut archive = ZipArchive::new(file).map_err(to_string)?;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(to_string)?;
        let safe_path = safe_archive_path(entry.name())?;
        let output_path = destination.join(safe_path);
        if !output_path.starts_with(destination) {
            return Err("Unsafe path in NoteX package".to_string());
        }

        if entry.is_dir() {
            fs::create_dir_all(&output_path).map_err(to_string)?;
            continue;
        }

        if let Some(parent) = output_path.parent() {
            fs::create_dir_all(parent).map_err(to_string)?;
        }
        let mut output = File::create(&output_path).map_err(to_string)?;
        std::io::copy(&mut entry, &mut output).map_err(to_string)?;
    }

    Ok(())
}

fn safe_archive_path(name: &str) -> Result<PathBuf, String> {
    let path = Path::new(name);
    if path.is_absolute() {
        return Err("Unsafe absolute path in NoteX package".to_string());
    }

    let mut safe = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Normal(value) => safe.push(value),
            Component::CurDir => {}
            Component::ParentDir | Component::Prefix(_) | Component::RootDir => {
                return Err("Unsafe relative path in NoteX package".to_string());
            }
        }
    }

    if safe.as_os_str().is_empty() {
        return Err("Empty path in NoteX package".to_string());
    }
    Ok(safe)
}

fn safe_relative_files_path(value: &str) -> Result<PathBuf, String> {
    safe_archive_path(value)
}

fn copy_directory(source: &Path, destination: &Path) -> Result<(), String> {
    if !source.exists() {
        return Ok(());
    }
    fs::create_dir_all(destination).map_err(to_string)?;
    for entry in fs::read_dir(source).map_err(to_string)? {
        let entry = entry.map_err(to_string)?;
        let path = entry.path();
        let next_destination = destination.join(entry.file_name());
        if path.is_dir() {
            copy_directory(&path, &next_destination)?;
        } else if path.is_file() {
            if let Some(parent) = next_destination.parent() {
                fs::create_dir_all(parent).map_err(to_string)?;
            }
            fs::copy(&path, &next_destination).map_err(to_string)?;
        }
    }
    Ok(())
}

fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    if destination.exists() {
        fs::remove_file(destination).map_err(to_string)?;
    }

    fs::rename(source, destination)
        .or_else(|_| -> std::io::Result<()> {
            fs::copy(source, destination)?;
            fs::remove_file(source)?;
            Ok(())
        })
        .map_err(to_string)
}

fn open_folder(folder: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(folder)
            .spawn()
            .map_err(to_string)?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(folder)
            .spawn()
            .map_err(to_string)?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(folder)
            .spawn()
            .map_err(to_string)?;
        return Ok(());
    }
}

fn open_file(path: &Path) -> Result<(), String> {
    if !path.is_file() {
        return Err("File was not found".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(to_string)?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(path).spawn().map_err(to_string)?;
        return Ok(());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(path).spawn().map_err(to_string)?;
        return Ok(());
    }
}

fn checksum_file(path: &Path) -> Result<String, String> {
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;

    let mut file = File::open(path).map_err(to_string)?;
    let mut hash = FNV_OFFSET;
    let mut buffer = [0_u8; 8192];
    loop {
        let read = file.read(&mut buffer).map_err(to_string)?;
        if read == 0 {
            break;
        }
        for byte in &buffer[..read] {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(FNV_PRIME);
        }
    }

    Ok(format!("{:016x}", hash))
}

fn sanitize_path_segment(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn sanitize_extension(value: &str) -> String {
    value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .collect::<String>()
}

fn infer_mime_type(path: &Path) -> String {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "apng" => "image/apng",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "gif" => "image/gif",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        "txt" | "md" => "text/plain",
        "csv" => "text/csv",
        "pdf" => "application/pdf",
        "xls" => "application/vnd.ms-excel",
        "xlsx" => "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "doc" => "application/msword",
        "docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        _ => "application/octet-stream",
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::safe_archive_path;
    use std::path::PathBuf;

    #[test]
    fn accepts_safe_package_paths() {
        assert_eq!(safe_archive_path("notex.sqlite").unwrap(), PathBuf::from("notex.sqlite"));
        assert_eq!(
            safe_archive_path("files/note-1/file.png").unwrap(),
            PathBuf::from("files/note-1/file.png")
        );
    }

    #[test]
    fn rejects_unsafe_package_paths() {
        assert!(safe_archive_path("../notex.sqlite").is_err());
        assert!(safe_archive_path("files/../../secret.txt").is_err());
        assert!(safe_archive_path("/tmp/notex.sqlite").is_err());
        assert!(safe_archive_path("C:\\tmp\\notex.sqlite").is_err());
    }
}
