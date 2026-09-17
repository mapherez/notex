//! Explicit, additive migrations. Never infer compatibility from a version number.
use rusqlite::{params, Connection, TransactionBehavior};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

pub const CURRENT_VERSION: &str = "4";

pub fn create_cloud_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE cloud_state (id TEXT PRIMARY KEY, payload TEXT NOT NULL);
         CREATE TABLE cloud_outbox (
           entity_id TEXT PRIMARY KEY,
           kind TEXT NOT NULL CHECK(kind IN ('note', 'library')),
           change_token TEXT NOT NULL,
           version INTEGER NOT NULL,
           deleted INTEGER NOT NULL DEFAULT 0,
           first_changed_at INTEGER NOT NULL,
           last_changed_at INTEGER NOT NULL
         );",
    )
    .map_err(|error| error.to_string())?;

    let now = "CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)";
    for (event, reference, condition, deleted) in [
        ("INSERT", "NEW", "", 0),
        ("UPDATE", "NEW", "WHEN OLD.version IS NOT NEW.version OR json_remove(OLD.payload, '$.lastOpenedAt', '$.updatedAt', '$.stats') IS NOT json_remove(NEW.payload, '$.lastOpenedAt', '$.updatedAt', '$.stats')", 0),
        ("DELETE", "OLD", "", 1),
    ] {
        conn.execute_batch(&format!(
            "CREATE TRIGGER cloud_notes_{event} AFTER {event} ON notes {condition} BEGIN
               INSERT INTO cloud_outbox VALUES ({reference}.id, 'note', lower(hex(randomblob(16))), {reference}.version + {deleted}, {deleted}, {now}, {now})
               ON CONFLICT(entity_id) DO UPDATE SET
                 change_token = excluded.change_token, version = excluded.version,
                 deleted = excluded.deleted, last_changed_at = excluded.last_changed_at;
             END;"
        )).map_err(|error| error.to_string())?;
    }

    // A single library entry coalesces tag, collection and organization changes.
    for table in ["tags", "collections", "user_settings"] {
        let projection = |row: &str| {
            if table == "user_settings" {
                format!("json_extract({row}.payload, '$.primaryCollectionId', '$.favoriteTagIds', '$.pinnedNoteIds', '$.quickPinNoteIds', '$.noteHiddenPanelIds')")
            } else {
                format!("json_remove({row}.payload, '$.count')")
            }
        };
        for event in ["INSERT", "UPDATE", "DELETE"] {
            let condition = if event == "UPDATE" {
                format!("WHEN {} IS NOT {}", projection("OLD"), projection("NEW"))
            } else {
                String::new()
            };
            conn.execute_batch(&format!(
                "CREATE TRIGGER cloud_{table}_{event} AFTER {event} ON {table} {condition} BEGIN
                   INSERT INTO cloud_outbox VALUES ('@library', 'library', lower(hex(randomblob(16))), 1, 0, {now}, {now})
                   ON CONFLICT(entity_id) DO UPDATE SET change_token = excluded.change_token,
                     version = cloud_outbox.version + 1, last_changed_at = excluded.last_changed_at;
                 END;"
            )).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

pub fn migrate_v3_to_v4(conn: &Connection) -> Result<Option<PathBuf>, String> {
    // VACUUM INTO produces a consistent SQLite snapshot, including committed WAL
    // data. A failed backup prevents the migration from starting.
    let backup = if let Some(path) = conn.path().filter(|path| !path.is_empty()) {
        let parent = std::path::Path::new(path)
            .parent()
            .ok_or("Database directory is missing")?;
        let directory = parent.join("backups");
        std::fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();
        let target = directory.join(format!("before-schema-3-to-4-{nonce}.sqlite"));
        conn.execute("VACUUM INTO ?1", [target.to_string_lossy().as_ref()])
            .map_err(|error| error.to_string())?;
        let snapshot =
            Connection::open_with_flags(&target, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
                .map_err(|error| error.to_string())?;
        check_integrity(&snapshot)?;
        Some(target)
    } else {
        None
    };

    let tx = rusqlite::Transaction::new_unchecked(conn, TransactionBehavior::Immediate)
        .map_err(|error| error.to_string())?;
    let version: String = tx
        .query_row(
            "SELECT value FROM app_metadata WHERE key = 'sqlite_schema_version'",
            [],
            |row| row.get(0),
        )
        .map_err(|error| error.to_string())?;
    if version == CURRENT_VERSION {
        return Ok(backup);
    }
    if version != "3" {
        return Err(format!(
            "No migration is defined from schema '{version}'. No data was changed."
        ));
    }
    check_integrity(&tx)?;
    create_cloud_schema(&tx)?;
    tx.execute("UPDATE app_metadata SET value = ?1, updated_at = datetime('now') WHERE key = 'sqlite_schema_version'", [CURRENT_VERSION]).map_err(|error| error.to_string())?;
    if let Some(path) = &backup {
        tx.execute("INSERT INTO app_metadata (key, value, updated_at) VALUES ('last_migration_backup_path', ?1, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at", params![path.to_string_lossy()]).map_err(|error| error.to_string())?;
    }
    check_integrity(&tx)?;
    tx.commit().map_err(|error| error.to_string())?;
    Ok(backup)
}

fn check_integrity(conn: &Connection) -> Result<(), String> {
    let result: String = conn
        .query_row("PRAGMA quick_check", [], |row| row.get(0))
        .map_err(|error| error.to_string())?;
    if result != "ok" {
        return Err(format!("Database integrity check failed: {result}"));
    }
    Ok(())
}
