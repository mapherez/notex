use rusqlite::types::Value as SqlValue;
use rusqlite::{params, params_from_iter, Connection, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::Component;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

const SCHEMA_VERSION: &str = crate::storage_migrations::CURRENT_VERSION;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SqliteStatus {
    initialized: bool,
    should_seed_demo: bool,
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
pub struct FileImportInfo {
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

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotePackageImportInfo {
    note_id: String,
    title: String,
    imported_files_count: usize,
    matched_tags: Vec<String>,
    dropped_tags: Vec<String>,
    matched_collection: Option<String>,
    dropped_collection: Option<String>,
    matched_linked_notes: Vec<String>,
    dropped_linked_notes: Vec<String>,
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
pub fn notex_sqlite_status(
    app: AppHandle,
    library_id: Option<String>,
) -> Result<SqliteStatus, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
    let note_count: i64 = conn
        .query_row("SELECT count(*) FROM notes", [], |row| row.get(0))
        .map_err(to_string)?;
    if note_count > 0 {
        conn.execute("INSERT OR IGNORE INTO app_metadata (key, value, updated_at) VALUES ('demo_seeded', 'true', datetime('now'))", []).map_err(to_string)?;
    }

    Ok(SqliteStatus {
        initialized: existed || read_metadata(&conn, "sqlite_schema_version")?.is_some(),
        should_seed_demo: library_id.is_none()
            && note_count == 0
            && read_metadata(&conn, "demo_seeded")?.is_none(),
        database_path: database_path.to_string_lossy().to_string(),
        local_data_directory: local_data_directory(&app)?.to_string_lossy().to_string(),
        files_directory: files_directory.to_string_lossy().to_string(),
        backup_directory: backup_directory.to_string_lossy().to_string(),
        temp_directory: temp_directory.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn notex_sqlite_create_temp_export(
    app: AppHandle,
    library_id: Option<String>,
) -> Result<SqliteExportInfo, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
    app: AppHandle,
    temp_path: String,
    destination_path: String,
    library_id: Option<String>,
) -> Result<String, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
pub fn notex_package_create_temp_export(
    app: AppHandle,
    library_id: Option<String>,
) -> Result<SqliteExportInfo, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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

    conn.execute(
        "VACUUM INTO ?1",
        params![temp_database.to_string_lossy().to_string()],
    )
    .map_err(to_string)?;
    validate_sqlite_database(&temp_database)?;

    create_notex_package(
        &package_path,
        &temp_database,
        &files_directory(&app)?,
        &created_at,
    )?;
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
    app: AppHandle,
    temp_path: String,
    destination_path: String,
    library_id: Option<String>,
) -> Result<String, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
pub fn notex_note_package_create_temp_export(
    app: AppHandle,
    note_id: String,
    library_id: Option<String>,
) -> Result<SqliteExportInfo, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;

    let notes = read_payloads(
        &conn,
        "notes",
        Some("id"),
        &[JsonValue::String(note_id.clone())],
    )?;
    let note = notes
        .into_iter()
        .next()
        .ok_or("Selected note was not found")?;
    let blocks = read_payloads(
        &conn,
        "noteBlocks",
        Some("noteId"),
        &[JsonValue::String(note_id.clone())],
    )?;
    let files = read_payloads(
        &conn,
        "noteFiles",
        Some("noteId"),
        &[JsonValue::String(note_id)],
    )?;
    let tags = read_payloads_for_ids(&conn, "tags", string_array_field(&note, "tagIds"))?;
    let collection = opt_text(&note, "collectionId")
        .map(|collection_id| read_payloads_for_ids(&conn, "collections", vec![collection_id]))
        .transpose()?
        .and_then(|mut collections| collections.pop());
    let linked_notes =
        read_payloads_for_ids(&conn, "notes", string_array_field(&note, "linkedNoteIds"))?
            .into_iter()
            .map(|linked_note| {
                serde_json::json!({
                    "id": opt_text(&linked_note, "id"),
                    "title": opt_text(&linked_note, "title"),
                })
            })
            .collect::<Vec<_>>();

    let created_at = timestamp_for_filename();
    let title = text(&note, "title", "untitled")?;
    let file_name = format!(
        "notex-note-{}-{}.notex-note",
        sanitize_file_stem(&title),
        created_at
    );
    let temp_dir = temp_directory(&app)?;
    fs::create_dir_all(&temp_dir).map_err(to_string)?;
    let package_path = temp_dir.join(&file_name);
    if package_path.exists() {
        fs::remove_file(&package_path).map_err(to_string)?;
    }

    let note_export = serde_json::json!({
        "schemaVersion": 1,
        "exportedAt": created_at,
        "note": note,
        "blocks": blocks,
        "files": files,
        "tags": tags,
        "collection": collection,
        "linkedNotes": linked_notes,
    });
    create_notex_note_package(
        &package_path,
        &note_export,
        &files_directory(&app)?,
        &created_at,
    )?;
    validate_notex_note_package(&package_path)?;

    Ok(SqliteExportInfo {
        temp_path: package_path.to_string_lossy().to_string(),
        file_name,
        created_at,
    })
}

#[tauri::command]
pub fn notex_note_package_copy_export_to(
    app: AppHandle,
    temp_path: String,
    destination_path: String,
    library_id: Option<String>,
) -> Result<String, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    let source = PathBuf::from(temp_path);
    let destination = PathBuf::from(destination_path);
    if !source.is_file() {
        return Err("The temporary NoteX note export was not found".to_string());
    }
    validate_notex_note_package(&source)?;

    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(to_string)?;
    }

    fs::copy(&source, &destination).map_err(to_string)?;
    validate_notex_note_package(&destination)?;
    Ok(destination.to_string_lossy().to_string())
}

#[tauri::command]
pub fn notex_note_package_import_from_file(
    app: AppHandle,
    source_path: String,
    library_id: Option<String>,
) -> Result<NotePackageImportInfo, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    let source = PathBuf::from(source_path);
    if !source.is_file() {
        return Err("Selected NoteX note export was not found".to_string());
    }
    validate_notex_note_package(&source)?;

    let imported_at = timestamp_for_filename();
    let import_id = timestamp_for_id();
    let now = current_timestamp();
    let temp_dir = temp_directory(&app)?.join(format!("notex-note-import-{}", imported_at));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(to_string)?;
    }
    fs::create_dir_all(&temp_dir).map_err(to_string)?;
    extract_notex_package(&source, &temp_dir)?;

    let note_export_text = fs::read_to_string(temp_dir.join("note.json")).map_err(to_string)?;
    let note_export: JsonValue = serde_json::from_str(&note_export_text).map_err(to_string)?;
    let mut note = note_export
        .get("note")
        .cloned()
        .ok_or("NoteX note export is missing note data")?;
    let blocks = json_array_items(&note_export, "blocks");
    let files = json_array_items(&note_export, "files");
    let exported_tags = json_array_items(&note_export, "tags");
    let linked_notes = json_array_items(&note_export, "linkedNotes");
    let collection = note_export.get("collection").cloned();

    let mut conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    let existing_tags = read_payloads(&conn, "tags", None, &[])?;
    let existing_collections = read_payloads(&conn, "collections", None, &[])?;
    let existing_notes = read_payloads(&conn, "notes", None, &[])?;

    let new_note_id = format!("note-{}-import", import_id);
    let title = text(&note, "title", "Untitled note")?;
    let old_tag_ids = string_array_field(&note, "tagIds");
    let old_linked_note_ids = string_array_field(&note, "linkedNoteIds");
    let tag_by_old_id = payload_by_id(exported_tags);
    let existing_tag_by_name = payload_by_normalized_name(existing_tags, "name");
    let existing_collection_by_name = payload_by_normalized_name(existing_collections, "name");
    let existing_note_titles = payloads_by_normalized_name(existing_notes, "title");

    let mut new_tag_ids = Vec::new();
    let mut matched_tags = Vec::new();
    let mut dropped_tags = Vec::new();
    for old_tag_id in old_tag_ids {
        let Some(exported_tag) = tag_by_old_id.get(&old_tag_id) else {
            continue;
        };
        let tag_name = text(exported_tag, "name", "")?;
        if tag_name.trim().is_empty() {
            continue;
        }
        if let Some(existing_tag) = existing_tag_by_name.get(&normalize_match_name(&tag_name)) {
            new_tag_ids.push(text(existing_tag, "id", "")?);
            matched_tags.push(tag_name);
        } else {
            dropped_tags.push(tag_name);
        }
    }

    let mut matched_collection = None;
    let mut dropped_collection = None;
    let new_collection_id = if opt_text(&note, "collectionId").is_some() {
        collection
            .as_ref()
            .and_then(|value| text(value, "name", "").ok())
            .and_then(|collection_name| {
                if collection_name.trim().is_empty() {
                    return None;
                }
                existing_collection_by_name
                    .get(&normalize_match_name(&collection_name))
                    .and_then(|existing_collection| {
                        matched_collection = Some(collection_name.clone());
                        text(existing_collection, "id", "").ok()
                    })
                    .or_else(|| {
                        dropped_collection = Some(collection_name);
                        None
                    })
            })
    } else {
        None
    };

    let linked_note_by_old_id = payload_by_id(linked_notes);
    let mut new_linked_note_ids = Vec::new();
    let mut matched_linked_notes = Vec::new();
    let mut dropped_linked_notes = Vec::new();
    for old_linked_note_id in old_linked_note_ids {
        let Some(exported_linked_note) = linked_note_by_old_id.get(&old_linked_note_id) else {
            continue;
        };
        let linked_title = text(exported_linked_note, "title", "")?;
        if linked_title.trim().is_empty() {
            continue;
        }
        match existing_note_titles.get(&normalize_match_name(&linked_title)) {
            Some(matches) if matches.len() == 1 => {
                new_linked_note_ids.push(text(&matches[0], "id", "")?);
                matched_linked_notes.push(linked_title);
            }
            _ => dropped_linked_notes.push(linked_title),
        }
    }

    let mut block_id_map = HashMap::new();
    for (index, block) in blocks.iter().enumerate() {
        let old_block_id = text(block, "id", "")?;
        block_id_map.insert(old_block_id, format!("block-{}-{}", import_id, index + 1));
    }

    let mut new_files = Vec::new();
    let mut file_map = HashMap::new();
    let destination_files_directory = files_directory(&app)?;
    for (index, file) in files.iter().enumerate() {
        let old_file_id = text(file, "id", "")?;
        let old_relative_path = text(file, "relativePath", "")?;
        let old_relative = safe_relative_files_path(&old_relative_path)?;
        let source_file = temp_dir.join("files").join(&old_relative);
        if !source_file.is_file() {
            let original_name = text(file, "originalName", &old_relative_path)?;
            return Err(format!(
                "Imported note is missing attachment: {}",
                original_name
            ));
        }

        let extension = Path::new(&old_relative_path)
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| format!(".{}", sanitize_extension(value)))
            .unwrap_or_default();
        let new_file_id = format!("file-{}-{}", import_id, index + 1);
        let new_relative_path = format!(
            "{}/{}{}",
            sanitize_path_segment(&new_note_id),
            new_file_id,
            extension
        );
        let destination = destination_files_directory.join(&new_relative_path);
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent).map_err(to_string)?;
        }
        fs::copy(&source_file, &destination).map_err(to_string)?;

        let mut new_file = file.clone();
        set_json_field(&mut new_file, "id", JsonValue::String(new_file_id))?;
        set_json_field(
            &mut new_file,
            "noteId",
            JsonValue::String(new_note_id.clone()),
        )?;
        let new_block_id =
            opt_text(file, "blockId").and_then(|block_id| block_id_map.get(&block_id).cloned());
        set_json_field(
            &mut new_file,
            "blockId",
            new_block_id
                .map(JsonValue::String)
                .unwrap_or(JsonValue::Null),
        )?;
        set_json_field(
            &mut new_file,
            "relativePath",
            JsonValue::String(new_relative_path),
        )?;
        set_json_field(&mut new_file, "createdAt", JsonValue::String(now.clone()))?;
        file_map.insert(old_file_id, new_file.clone());
        new_files.push(new_file);
    }

    set_json_field(&mut note, "id", JsonValue::String(new_note_id.clone()))?;
    set_json_field(&mut note, "tagIds", strings_to_json_array(new_tag_ids))?;
    set_json_field(
        &mut note,
        "collectionId",
        new_collection_id
            .map(JsonValue::String)
            .unwrap_or(JsonValue::Null),
    )?;
    set_json_field(
        &mut note,
        "linkedNoteIds",
        strings_to_json_array(new_linked_note_ids),
    )?;
    set_json_field(&mut note, "isTrashed", JsonValue::Bool(false))?;
    set_json_field(
        &mut note,
        "saveState",
        JsonValue::String("saved".to_string()),
    )?;
    set_json_field(&mut note, "createdAt", JsonValue::String(now.clone()))?;
    set_json_field(&mut note, "updatedAt", JsonValue::String(now.clone()))?;
    set_json_field(&mut note, "lastOpenedAt", JsonValue::String(now.clone()))?;
    set_json_field(&mut note, "version", JsonValue::from(1))?;

    let mut new_blocks = Vec::new();
    for block in blocks {
        let old_block_id = text(&block, "id", "")?;
        let new_block_id = block_id_map
            .get(&old_block_id)
            .cloned()
            .ok_or("Imported block ID could not be mapped")?;
        let mut new_block = block;
        set_json_field(&mut new_block, "id", JsonValue::String(new_block_id))?;
        set_json_field(
            &mut new_block,
            "noteId",
            JsonValue::String(new_note_id.clone()),
        )?;
        set_json_field(&mut new_block, "createdAt", JsonValue::String(now.clone()))?;
        set_json_field(&mut new_block, "updatedAt", JsonValue::String(now.clone()))?;
        if let Some(content_json) = new_block.get_mut("contentJson") {
            rewrite_note_file_nodes(content_json, &file_map)?;
        }
        new_blocks.push(new_block);
    }

    let tx = conn.transaction().map_err(to_string)?;
    let insert_result = (|| -> Result<(), String> {
        insert_payload(&tx, "notes", &note)?;
        for block in &new_blocks {
            insert_payload(&tx, "noteBlocks", block)?;
        }
        for file in &new_files {
            insert_payload(&tx, "noteFiles", file)?;
        }
        tx.commit().map_err(to_string)?;
        Ok(())
    })();

    if let Err(error) = insert_result {
        for file in &new_files {
            if let Some(relative_path) = file.get("relativePath").and_then(JsonValue::as_str) {
                if let Ok(relative) = safe_relative_files_path(relative_path) {
                    let path = destination_files_directory.join(relative);
                    if path.is_file() {
                        let _ = fs::remove_file(path);
                    }
                }
            }
        }
        return Err(error);
    }

    let conn = open_connection(&app)?;
    let _ = write_metadata(&conn, "last_note_imported_at", &imported_at);

    Ok(NotePackageImportInfo {
        note_id: new_note_id,
        title,
        imported_files_count: new_files.len(),
        matched_tags,
        dropped_tags,
        matched_collection,
        dropped_collection,
        matched_linked_notes,
        dropped_linked_notes,
    })
}

#[tauri::command]
pub fn notex_package_replace_from_file(
    app: AppHandle,
    source_path: String,
    library_id: Option<String>,
) -> Result<(), String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
    prepare_imported_database(&incoming_database)?;

    let database = database_path(&app)?;
    let files = files_directory(&app)?;
    let backup_database =
        temp_directory(&app)?.join(format!("notex-before-package-import-{}.sqlite", created_at));
    let backup_files =
        temp_directory(&app)?.join(format!("notex-files-before-package-import-{}", created_at));
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
pub fn notex_note_file_import(
    app: AppHandle,
    source_path: String,
    note_id: String,
    block_id: Option<String>,
    library_id: Option<String>,
) -> Result<FileImportInfo, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
    let id = format!(
        "file-{}-{}",
        timestamp_for_filename(),
        &checksum[..12.min(checksum.len())]
    );
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
    let kind = if mime_type.starts_with("image/") {
        "image"
    } else {
        "attachment"
    }
    .to_string();
    Ok(FileImportInfo {
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
pub fn notex_note_file_absolute_path(
    app: AppHandle,
    relative_path: String,
    library_id: Option<String>,
) -> Result<String, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    let relative = safe_relative_files_path(&relative_path)?;
    Ok(files_directory(&app)?
        .join(relative)
        .to_string_lossy()
        .to_string())
}

#[tauri::command]
pub fn notex_note_file_open(
    app: AppHandle,
    relative_path: String,
    library_id: Option<String>,
) -> Result<(), String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    let relative = safe_relative_files_path(&relative_path)?;
    open_file(&files_directory(&app)?.join(relative))
}

#[tauri::command]
pub fn notex_note_file_copy_to(
    app: AppHandle,
    relative_path: String,
    destination_path: String,
    library_id: Option<String>,
) -> Result<String, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
pub fn notex_note_file_delete(
    app: AppHandle,
    relative_path: String,
    library_id: Option<String>,
) -> Result<(), String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
    library_id: Option<String>,
) -> Result<(), String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
    prepare_imported_database(&incoming)?;

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
pub fn notex_sqlite_open_database_folder(
    app: AppHandle,
    library_id: Option<String>,
) -> Result<(), String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    let database = database_path(&app)?;
    let folder = database
        .parent()
        .ok_or("Could not resolve the database folder")?;
    open_folder(folder)
}

#[tauri::command]
pub fn notex_sqlite_open_local_data_folder(
    app: AppHandle,
    library_id: Option<String>,
) -> Result<(), String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    let folder = local_data_directory(&app)?;
    fs::create_dir_all(&folder).map_err(to_string)?;
    open_folder(&folder)
}

#[tauri::command]
pub fn notex_sqlite_open_files_folder(
    app: AppHandle,
    library_id: Option<String>,
) -> Result<(), String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    let folder = files_directory(&app)?;
    fs::create_dir_all(&folder).map_err(to_string)?;
    open_folder(&folder)
}

#[tauri::command]
pub fn notex_sqlite_get(
    app: AppHandle,
    table: String,
    key: String,
    library_id: Option<String>,
) -> Result<Option<JsonValue>, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
pub fn notex_sqlite_read_table(
    app: AppHandle,
    table: String,
    library_id: Option<String>,
) -> Result<Vec<JsonValue>, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    let conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    read_payloads(&conn, &table, None, &[])
}

#[tauri::command]
pub fn notex_sqlite_count(
    app: AppHandle,
    table: String,
    library_id: Option<String>,
) -> Result<i64, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
    library_id: Option<String>,
) -> Result<Vec<JsonValue>, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
    library_id: Option<String>,
) -> Result<i64, String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
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
    library_id: Option<String>,
) -> Result<(), String> {
    let _library_guard = crate::library_context::guard(&app, library_id.as_deref())?;
    if operations.is_empty() {
        return Ok(());
    }

    let mut conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    let tx = conn.transaction().map_err(to_string)?;
    for operation in operations {
        if operation.table == "notes" {
            tx.execute("INSERT OR IGNORE INTO app_metadata (key, value, updated_at) VALUES ('demo_seeded', 'true', datetime('now'))", []).map_err(to_string)?;
        }
        apply_operation(&tx, operation)?;
    }
    tx.commit().map_err(to_string)?;
    Ok(())
}

#[tauri::command]
pub fn notex_cloud_storage(
    app: AppHandle,
    library_id: String,
    action: String,
    input: JsonValue,
) -> Result<JsonValue, String> {
    use base64::Engine;
    let _guard = crate::library_context::guard(&app, Some(&library_id))?;
    let mut conn = open_connection(&app)?;
    ensure_schema(&conn)?;
    let id = input.get("id").and_then(JsonValue::as_str).unwrap_or("");
    match action.as_str() {
        "state" => {
            let raw: Option<String> = conn
                .query_row("SELECT payload FROM cloud_state WHERE id = ?1", [id], |r| {
                    r.get(0)
                })
                .optional()
                .map_err(to_string)?;
            raw.map(|raw| serde_json::from_str(&raw).map_err(to_string))
                .unwrap_or(Ok(JsonValue::Null))
        }
        "putState" => {
            conn.execute("INSERT INTO cloud_state VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload", params![id, input["value"].to_string()]).map_err(to_string)?;
            Ok(JsonValue::Null)
        }
        "pending" => {
            let mut statement = conn.prepare("SELECT entity_id, kind, change_token, version, deleted, first_changed_at, last_changed_at FROM cloud_outbox ORDER BY first_changed_at").map_err(to_string)?;
            let values = statement.query_map([], |r| Ok(serde_json::json!({
                "entityId":r.get::<_,String>(0)?, "kind":r.get::<_,String>(1)?, "changeToken":r.get::<_,String>(2)?,
                "version":r.get::<_,i64>(3)?, "deleted":r.get::<_,bool>(4)?, "firstChangedAt":r.get::<_,i64>(5)?, "lastChangedAt":r.get::<_,i64>(6)?
            }))).map_err(to_string)?.collect::<Result<Vec<_>,_>>().map_err(to_string)?;
            Ok(JsonValue::Array(values))
        }
        "acknowledge" => {
            conn.execute(
                "DELETE FROM cloud_outbox WHERE entity_id = ?1 AND change_token = ?2",
                params![id, input["token"].as_str()],
            )
            .map_err(to_string)?;
            Ok(JsonValue::Null)
        }
        "applyOrganization" => {
            let tx = conn
                .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                .map_err(to_string)?;
            let pending: bool = tx
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM cloud_outbox WHERE entity_id = '@library')",
                    [],
                    |r| r.get(0),
                )
                .map_err(to_string)?;
            if pending {
                return Ok(JsonValue::Null);
            }
            let catalog = &input["catalog"];
            tx.execute("DELETE FROM tags", []).map_err(to_string)?;
            tx.execute("DELETE FROM collections", [])
                .map_err(to_string)?;
            for value in catalog["tags"].as_array().ok_or("Invalid catalog")? {
                insert_tag(&tx, value)?;
            }
            for value in catalog["collections"].as_array().ok_or("Invalid catalog")? {
                insert_collection(&tx, value)?;
            }
            if let Some(organization) = catalog["organization"].as_object() {
                for mut settings in read_payloads(&tx, "userSettings", None, &[])? {
                    for field in [
                        "primaryCollectionId",
                        "favoriteTagIds",
                        "pinnedNoteIds",
                        "quickPinNoteIds",
                        "noteHiddenPanelIds",
                    ] {
                        if let Some(value) = organization.get(field) {
                            settings[field] = value.clone();
                        }
                    }
                    insert_user_settings(&tx, &settings)?;
                }
            }
            tx.execute("DELETE FROM cloud_outbox WHERE entity_id = '@library'", [])
                .map_err(to_string)?;
            tx.commit().map_err(to_string)?;
            Ok(JsonValue::Null)
        }
        "snapshot" => {
            let tx = conn.transaction().map_err(to_string)?;
            let note =
                read_payloads(&tx, "notes", Some("id"), &[JsonValue::String(id.into())])?.pop();
            let token: Option<String> = tx
                .query_row(
                    "SELECT change_token FROM cloud_outbox WHERE entity_id = ?1",
                    [id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(to_string)?;
            let version = note
                .as_ref()
                .and_then(|n| n.get("version"))
                .cloned()
                .unwrap_or(JsonValue::Null);
            let backup = if let Some(note) = note {
                let blocks = read_payloads(
                    &tx,
                    "noteBlocks",
                    Some("noteId"),
                    &[JsonValue::String(id.into())],
                )?;
                let files = read_payloads(
                    &tx,
                    "noteFiles",
                    Some("noteId"),
                    &[JsonValue::String(id.into())],
                )?;
                let tags: Vec<_> = read_payloads(&tx, "tags", None, &[])?
                    .into_iter()
                    .filter(|tag| {
                        string_array_field(&note, "tagIds")
                            .contains(&opt_text(tag, "id").unwrap_or_default())
                    })
                    .collect();
                let collection = read_payloads(
                    &tx,
                    "collections",
                    Some("id"),
                    &[note["collectionId"].clone()],
                )?
                .pop();
                serde_json::json!({"schemaVersion":1, "exportedAt":timestamp_for_filename(), "note":note, "blocks":blocks, "files":files, "tags":tags, "collection":collection, "linkedNotes":[]})
            } else {
                JsonValue::Null
            };
            Ok(serde_json::json!({"backup":backup,"version":version,"changeToken":token}))
        }
        "readBlob" => {
            let path = files_directory(&app)?.join(safe_relative_files_path(id)?);
            let root = crate::library_context::root(&app)?
                .canonicalize()
                .map_err(to_string)?
                .join("files");
            if !path.canonicalize().map_err(to_string)?.starts_with(root) {
                return Err("Invalid attachment path".into());
            }
            Ok(JsonValue::String(
                base64::engine::general_purpose::STANDARD
                    .encode(fs::read(path).map_err(to_string)?),
            ))
        }
        "writeBlob" => {
            let path = files_directory(&app)?.join(safe_relative_files_path(id)?);
            let parent = path.parent().ok_or("Invalid attachment path")?;
            fs::create_dir_all(parent).map_err(to_string)?;
            let root = crate::library_context::root(&app)?
                .canonicalize()
                .map_err(to_string)?
                .join("files");
            if !parent.canonicalize().map_err(to_string)?.starts_with(&root) {
                return Err("Invalid attachment path".into());
            }
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(input["base64"].as_str().ok_or("Invalid attachment data")?)
                .map_err(to_string)?;
            // Downloads use fresh paths; never truncate an attachment in use.
            let mut file = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(path)
                .map_err(to_string)?;
            file.write_all(&bytes).map_err(to_string)?;
            file.sync_all().map_err(to_string)?;
            Ok(JsonValue::Null)
        }
        "apply" => {
            let tx = conn
                .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
                .map_err(to_string)?;
            let existing =
                read_payloads(&tx, "notes", Some("id"), &[JsonValue::String(id.into())])?.pop();
            let current_version = existing
                .as_ref()
                .and_then(|n| n.get("version"))
                .cloned()
                .unwrap_or(JsonValue::Null);
            let current_token: Option<String> = tx
                .query_row(
                    "SELECT change_token FROM cloud_outbox WHERE entity_id = ?1",
                    [id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(to_string)?;
            if current_version != input["expectedVersion"]
                || serde_json::to_value(current_token).map_err(to_string)? != input["expectedToken"]
            {
                return Err("LOCAL_NOTE_CHANGED".into());
            }
            if let Some(backup) = input.get("backup").filter(|value| !value.is_null()) {
                if backup["note"]["id"].as_str() != Some(id) {
                    return Err("Invalid note identity".into());
                }
                for (table, records) in [("noteBlocks", "blocks"), ("noteFiles", "files")] {
                    for record in backup[records].as_array().ok_or("Invalid note records")? {
                        if record["noteId"].as_str() != Some(id) {
                            return Err("Invalid note relationship".into());
                        }
                        let existing =
                            read_payloads(&tx, table, Some("id"), &[record["id"].clone()])?;
                        if existing
                            .iter()
                            .any(|value| value["noteId"].as_str() != Some(id))
                        {
                            return Err("Note record identity collision".into());
                        }
                        if table == "noteFiles"
                            && !files_directory(&app)?
                                .join(safe_relative_files_path(
                                    record["relativePath"]
                                        .as_str()
                                        .ok_or("Invalid attachment path")?,
                                )?)
                                .is_file()
                        {
                            return Err("Missing downloaded attachment".into());
                        }
                    }
                }
                where_delete(&tx, "noteBlocks", "noteId", &[JsonValue::String(id.into())])?;
                where_delete(&tx, "noteFiles", "noteId", &[JsonValue::String(id.into())])?;
                insert_note(&tx, &backup["note"])?;
                for block in backup["blocks"].as_array().unwrap() {
                    insert_note_block(&tx, block)?;
                }
                for file in backup["files"].as_array().unwrap() {
                    insert_note_file(&tx, file)?;
                }
            } else {
                where_delete(&tx, "noteBlocks", "noteId", &[JsonValue::String(id.into())])?;
                where_delete(&tx, "noteFiles", "noteId", &[JsonValue::String(id.into())])?;
                delete_key(&tx, "notes", id)?;
            }
            tx.execute("DELETE FROM cloud_outbox WHERE entity_id = ?1", [id])
                .map_err(to_string)?;
            tx.execute("INSERT INTO cloud_state VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload", params![format!("baseline:{id}"), input["entry"].to_string()]).map_err(to_string)?;
            tx.commit().map_err(to_string)?;
            Ok(JsonValue::Null)
        }
        _ => Err("Unknown cloud storage operation".into()),
    }
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
    Ok(crate::library_context::root(app)?.join("notex.sqlite"))
}

fn local_data_directory(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_local_data_dir().map_err(to_string)
}

fn files_directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(crate::library_context::root(app)?.join("files"))
}

fn backup_directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(crate::library_context::root(app)?.join("backups"))
}

fn temp_directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(crate::library_context::root(app)?.join("_temp"))
}

#[cfg(test)]
pub(crate) fn merge_local_library(source_root: &Path, target_root: &Path) -> Result<(), String> {
    merge_local_library_with_choices(source_root, target_root, &HashMap::new())
}

pub(crate) fn merge_local_library_with_choices(
    source_root: &Path,
    target_root: &Path,
    resolutions: &HashMap<String, String>,
) -> Result<(), String> {
    let source_root = &source_root.canonicalize().map_err(to_string)?;
    let target_root = &target_root.canonicalize().map_err(to_string)?;
    if source_root == target_root {
        return Err("Cannot adopt a library into itself".into());
    }
    let source_path = source_root.join("notex.sqlite");
    let source = Connection::open(&source_path).map_err(to_string)?;
    ensure_schema(&source)?;
    let mut target = Connection::open(target_root.join("notex.sqlite")).map_err(to_string)?;
    ensure_schema(&target)?;
    // Attached databases use rollback journals so their changes commit together.
    source
        .pragma_update(None, "journal_mode", "DELETE")
        .map_err(to_string)?;
    target
        .pragma_update(None, "journal_mode", "DELETE")
        .map_err(to_string)?;
    let notes = read_payloads(&source, "notes", None, &[])?;
    if notes.is_empty()
        && read_payloads(&source, "tags", None, &[])?.is_empty()
        && read_payloads(&source, "collections", None, &[])?.is_empty()
    {
        source.execute("INSERT OR IGNORE INTO app_metadata (key, value, updated_at) VALUES ('demo_seeded', 'true', datetime('now'))", []).map_err(to_string)?;
        return Ok(());
    }
    for (conn, root) in [(&source, source_root), (&target, target_root)] {
        fs::create_dir_all(root.join("backups")).map_err(to_string)?;
        let backup = root.join("backups").join(format!(
            "before-account-adoption-{}.sqlite",
            timestamp_for_id()
        ));
        conn.execute("VACUUM INTO ?1", [backup.to_string_lossy().as_ref()])
            .map_err(to_string)?;
        validate_sqlite_database(&backup)?;
    }
    target
        .execute(
            "ATTACH DATABASE ?1 AS local_source",
            [source_path.to_string_lossy().as_ref()],
        )
        .map_err(to_string)?;
    let tx = target
        .transaction_with_behavior(rusqlite::TransactionBehavior::Immediate)
        .map_err(to_string)?;
    // The source write lock also prevents another process changing it mid-copy.
    tx.execute(
        "UPDATE local_source.app_metadata SET value = value WHERE key = 'sqlite_schema_version'",
        [],
    )
    .map_err(to_string)?;
    let notes = read_payloads(&source, "notes", None, &[])?;
    let mut obsolete_files = Vec::new();
    for mut note in notes {
        let id = text(&note, "id", "")?;
        let existing =
            read_payloads(&tx, "notes", Some("id"), &[JsonValue::String(id.clone())])?.pop();
        let mut incoming_version = note.get("version").and_then(JsonValue::as_i64).unwrap_or(1);
        let existing_version = existing
            .as_ref()
            .and_then(|value| value.get("version"))
            .and_then(JsonValue::as_i64)
            .unwrap_or(0);
        let mut blocks = read_payloads(
            &source,
            "noteBlocks",
            Some("noteId"),
            &[JsonValue::String(id.clone())],
        )?;
        let mut files = read_payloads(
            &source,
            "noteFiles",
            Some("noteId"),
            &[JsonValue::String(id.clone())],
        )?;
        if let Some(existing) = &existing {
            if incoming_version == existing_version {
                let old_blocks = read_payloads(
                    &tx,
                    "noteBlocks",
                    Some("noteId"),
                    &[JsonValue::String(id.clone())],
                )?;
                let old_files = read_payloads(
                    &tx,
                    "noteFiles",
                    Some("noteId"),
                    &[JsonValue::String(id.clone())],
                )?;
                if comparable_bundle(existing, &old_blocks, &old_files)
                    != comparable_bundle(&note, &blocks, &files)
                {
                    match resolutions.get(&id).map(String::as_str) {
                        Some("local") => {
                            incoming_version += 1;
                            note["version"] = JsonValue::from(incoming_version);
                        }
                        Some("remote") => {}
                        _ => return Err(format!("ACCOUNT_NOTE_CONFLICT:{id}")),
                    }
                }
            }
        }
        for file in &files {
            let path = source_root
                .join("files")
                .join(safe_relative_files_path(&text(file, "relativePath", "")?)?);
            if path.exists() {
                if !path
                    .canonicalize()
                    .map_err(to_string)?
                    .starts_with(source_root.join("files"))
                {
                    return Err("Attachment is outside the local library".into());
                }
                obsolete_files.push(path);
            }
        }
        if existing.is_none() || incoming_version > existing_version {
            for (table, records) in [("noteBlocks", &blocks), ("noteFiles", &files)] {
                for record in records {
                    let record_id = text(record, "id", "")?;
                    if read_payloads(&tx, table, Some("id"), &[JsonValue::String(record_id)])?
                        .iter()
                        .any(|old| old.get("noteId") != record.get("noteId"))
                    {
                        return Err("An attachment or block ID belongs to another note".into());
                    }
                }
            }
            let mut remapped = HashMap::new();
            for file in &mut files {
                let old_path = text(file, "relativePath", "")?;
                let relative = safe_relative_files_path(&old_path)?;
                let source_file = source_root.join("files").join(relative);
                if !source_file.is_file() {
                    return Err(format!("Missing local attachment: {old_path}"));
                }
                let normalized_root = source_root
                    .join("files")
                    .canonicalize()
                    .map_err(to_string)?;
                if normalized_root != source_root.join("files") {
                    return Err("Attachment directory is outside the local library".into());
                }
                if !source_file
                    .canonicalize()
                    .map_err(to_string)?
                    .starts_with(&normalized_root)
                {
                    return Err("Attachment is outside the local library".into());
                }
                let new_path = format!(
                    "adopted-{}/{}",
                    timestamp_for_id(),
                    old_path.replace('\\', "/")
                );
                let destination = target_root
                    .join("files")
                    .join(safe_relative_files_path(&new_path)?);
                fs::create_dir_all(
                    destination
                        .parent()
                        .ok_or("Attachment directory is missing")?,
                )
                .map_err(to_string)?;
                if !destination
                    .parent()
                    .unwrap()
                    .canonicalize()
                    .map_err(to_string)?
                    .starts_with(target_root.join("files"))
                {
                    return Err("Attachment directory is outside the account library".into());
                }
                fs::copy(&source_file, &destination).map_err(to_string)?;
                fs::OpenOptions::new()
                    .write(true)
                    .open(&destination)
                    .map_err(to_string)?
                    .sync_all()
                    .map_err(to_string)?;
                if checksum_file(&source_file)? != checksum_file(&destination)? {
                    return Err("Attachment copy failed validation".into());
                }
                remapped.insert(old_path, new_path.clone());
                file["relativePath"] = JsonValue::String(new_path);
            }
            for block in &mut blocks {
                remap_attachment_paths(block, &remapped);
            }
            where_delete(
                &tx,
                "noteBlocks",
                "noteId",
                &[JsonValue::String(id.clone())],
            )?;
            where_delete(&tx, "noteFiles", "noteId", &[JsonValue::String(id.clone())])?;
            insert_note(&tx, &note)?;
            for block in blocks {
                insert_note_block(&tx, &block)?;
            }
            for file in files {
                insert_note_file(&tx, &file)?;
            }
        }
    }
    for table in ["tags", "collections"] {
        for value in read_payloads(&source, table, None, &[])? {
            let id = text(&value, "id", "")?;
            if read_payloads(&tx, table, Some("id"), &[JsonValue::String(id)])?.is_empty() {
                insert_payload(&tx, table, &value)?;
            }
        }
    }
    // The guest keeps device preferences, but its organization moves with the
    // notes. Existing account choices take precedence; lists are merged by ID.
    for mut guest in read_payloads(&source, "userSettings", None, &[])? {
        let settings_id = text(&guest, "id", "")?;
        let mut merged = read_payloads(
            &tx,
            "userSettings",
            Some("id"),
            &[JsonValue::String(settings_id.clone())],
        )?
        .pop()
        .unwrap_or_else(|| guest.clone());
        for field in [
            "favoriteTagIds",
            "pinnedNoteIds",
            "quickPinNoteIds",
            "noteHiddenPanelIds",
        ] {
            let mut values = merged
                .get(field)
                .and_then(JsonValue::as_array)
                .cloned()
                .unwrap_or_default();
            if let Some(incoming) = guest.get(field).and_then(JsonValue::as_array) {
                for value in incoming {
                    if !values.contains(value) {
                        values.push(value.clone());
                    }
                }
            }
            merged[field] = JsonValue::Array(values);
            guest[field] = serde_json::json!([]);
        }
        insert_user_settings(&tx, &merged)?;
        guest["primaryCollectionId"] = JsonValue::String(String::new());
        tx.execute("UPDATE local_source.user_settings SET primary_collection_id = '', favorite_tag_ids = '[]', quick_pin_note_ids = '[]', payload = ?1 WHERE id = ?2",
            params![payload_text(&guest)?, settings_id]).map_err(to_string)?;
    }
    // No deletions are published for the guest library: these records moved to
    // the account, they were not deleted by the user.
    tx.execute_batch(
        "DELETE FROM local_source.note_blocks;
                      DELETE FROM local_source.note_files;
                      DELETE FROM local_source.notes;
                      DELETE FROM local_source.activities;
                      DELETE FROM local_source.tags;
                      DELETE FROM local_source.collections;
                      INSERT INTO local_source.app_metadata (key, value, updated_at) VALUES ('demo_seeded', 'true', datetime('now'))
                        ON CONFLICT(key) DO UPDATE SET value = 'true';
                      DELETE FROM local_source.cloud_outbox;",
    )
    .map_err(to_string)?;
    tx.commit().map_err(to_string)?;
    // Interrupted cleanup leaves only unreferenced files, never lost notes.
    let recovery_files = source_root
        .join("backups")
        .join(format!("adopted-files-{}", timestamp_for_id()));
    for path in obsolete_files {
        if let Ok(relative) = path.strip_prefix(source_root.join("files")) {
            let recovery = recovery_files.join(relative);
            if let Some(parent) = recovery.parent() {
                if fs::create_dir_all(parent).is_ok() {
                    let _ = fs::rename(&path, recovery);
                }
            }
        }
    }
    Ok(())
}

fn remap_attachment_paths(value: &mut JsonValue, paths: &HashMap<String, String>) {
    match value {
        JsonValue::Array(items) => {
            for item in items {
                remap_attachment_paths(item, paths);
            }
        }
        JsonValue::Object(fields) => {
            if let Some(path) = fields
                .get("relativePath")
                .and_then(JsonValue::as_str)
                .and_then(|path| paths.get(path))
            {
                fields.insert("relativePath".into(), JsonValue::String(path.clone()));
            }
            for value in fields.values_mut() {
                remap_attachment_paths(value, paths);
            }
        }
        _ => {}
    }
}

fn comparable_bundle(note: &JsonValue, blocks: &[JsonValue], files: &[JsonValue]) -> JsonValue {
    fn remove_fields(value: &mut JsonValue, keys: &[&str]) {
        if let Some(fields) = value.as_object_mut() {
            for key in keys {
                fields.remove(*key);
            }
        }
    }
    let mut note = note.clone();
    remove_fields(
        &mut note,
        &["lastOpenedAt", "updatedAt", "stats", "blocks", "files"],
    );
    let paths: HashMap<String, String> = files
        .iter()
        .filter_map(|file| {
            Some((
                opt_text(file, "relativePath")?,
                format!("file:{}", opt_text(file, "id")?),
            ))
        })
        .collect();
    let mut blocks = blocks.to_vec();
    let mut files = files.to_vec();
    for block in &mut blocks {
        remove_fields(block, &["updatedAt"]);
        remap_attachment_paths(block, &paths);
    }
    for file in &mut files {
        remove_fields(file, &["relativePath"]);
    }
    blocks.sort_by_key(|value| opt_text(value, "id"));
    files.sort_by_key(|value| opt_text(value, "id"));
    serde_json::json!({ "note": note, "blocks": blocks, "files": files })
}
fn ensure_schema(conn: &Connection) -> Result<(), String> {
    // Inspect before writing anything. An unknown database must never be reset
    // or silently upgraded; each supported upgrade needs an explicit migration.
    let tx = conn.unchecked_transaction().map_err(to_string)?;
    let has_metadata: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'app_metadata')",
            [],
            |row| row.get(0),
        )
        .map_err(to_string)?;
    if has_metadata {
        match read_metadata(&tx, "sqlite_schema_version")?.as_deref() {
            Some(SCHEMA_VERSION) => return Ok(()),
            Some("3") => {
                drop(tx);
                crate::storage_migrations::migrate_v3_to_v4(conn)?;
                return Ok(());
            }
            Some(version) => {
                return Err(format!(
                    "Unsupported NoteX database schema version '{}'; this app supports '{}'. No data was changed. An explicit migration or a compatible app version is required.",
                    version, SCHEMA_VERSION
                ));
            }
            None => {
                return Err("The existing NoteX database has no schema version. No data was changed; recovery is required before opening it.".to_string());
            }
        }
    }

    let has_existing_schema: bool = tx
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE name NOT GLOB 'sqlite_*')",
            [],
            |row| row.get(0),
        )
        .map_err(to_string)?;
    if has_existing_schema {
        return Err("The existing database has no NoteX schema metadata. No data was changed; recovery is required before opening it.".to_string());
    }

    // Only an empty database is initialized. DDL and the version marker commit
    // together so an interrupted initialization cannot leave a partial schema.
    tx.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS notes (
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
          payload TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_notes_collection_id ON notes(collection_id);
        CREATE INDEX IF NOT EXISTS idx_notes_is_favorite ON notes(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_notes_is_pinned ON notes(is_pinned);
        CREATE INDEX IF NOT EXISTS idx_notes_is_archived ON notes(is_archived);
        CREATE INDEX IF NOT EXISTS idx_notes_is_trashed ON notes(is_trashed);
        CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);
        CREATE INDEX IF NOT EXISTS idx_notes_last_opened_at ON notes(last_opened_at);

        CREATE TABLE IF NOT EXISTS note_blocks (
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
        CREATE INDEX IF NOT EXISTS idx_note_blocks_note_id ON note_blocks(note_id);
        CREATE INDEX IF NOT EXISTS idx_note_blocks_sort_order ON note_blocks(sort_order);
        CREATE INDEX IF NOT EXISTS idx_note_blocks_updated_at ON note_blocks(updated_at);

        CREATE TABLE IF NOT EXISTS note_files (
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
        CREATE INDEX IF NOT EXISTS idx_note_files_note_id ON note_files(note_id);
        CREATE INDEX IF NOT EXISTS idx_note_files_block_id ON note_files(block_id);
        CREATE INDEX IF NOT EXISTS idx_note_files_kind ON note_files(kind);

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
          last_login_at TEXT,
          payload TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

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

        CREATE TABLE IF NOT EXISTS app_metadata (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        "#,
    )
    .map_err(to_string)?;

    crate::storage_migrations::create_cloud_schema(&tx)?;
    write_metadata(&tx, "sqlite_schema_version", SCHEMA_VERSION)?;
    tx.commit().map_err(to_string)
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
        "noteBlocks" => insert_note_block(tx, value),
        "noteFiles" => insert_note_file(tx, value),
        "tags" => insert_tag(tx, value),
        "collections" => insert_collection(tx, value),
        "users" => insert_user(tx, value),
        "activities" => insert_activity(tx, value),
        "userSettings" => insert_user_settings(tx, value),
        _ => Err(format!("Unknown SQLite table: {}", table)),
    }
}

fn insert_note(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO notes (
          id, title, subtitle, collection_id, tag_ids, linked_note_ids, is_favorite,
          is_pinned, is_archived, is_trashed, save_state, author_id, created_at,
          updated_at, last_opened_at, stats, thumbnail, version, payload
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)
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
            payload_text(value)?,
        ],
    )
    .map_err(to_string)?;
    Ok(())
}

fn insert_note_block(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO note_blocks (
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

fn insert_note_file(tx: &Transaction<'_>, value: &JsonValue) -> Result<(), String> {
    tx.execute(
        "INSERT INTO note_files (
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
        "INSERT INTO users (id, name, first_name, email, avatar_url, handle, last_login_at, payload)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          first_name = excluded.first_name,
          email = excluded.email,
          avatar_url = excluded.avatar_url,
          handle = excluded.handle,
          last_login_at = excluded.last_login_at,
          payload = excluded.payload",
        params![
            text(value, "id", "")?,
            text(value, "name", "")?,
            opt_text(value, "firstName"),
            opt_text(value, "email"),
            opt_text(value, "avatarUrl"),
            opt_text(value, "handle"),
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

fn read_payloads_for_ids(
    conn: &Connection,
    table: &str,
    ids: Vec<String>,
) -> Result<Vec<JsonValue>, String> {
    let values = ids.into_iter().map(JsonValue::String).collect::<Vec<_>>();
    read_payloads(conn, table, Some("id"), &values)
}

fn json_array_items(value: &JsonValue, field: &str) -> Vec<JsonValue> {
    value
        .get(field)
        .and_then(JsonValue::as_array)
        .cloned()
        .unwrap_or_default()
}

fn payload_by_id(values: Vec<JsonValue>) -> HashMap<String, JsonValue> {
    values
        .into_iter()
        .filter_map(|value| opt_text(&value, "id").map(|id| (id, value)))
        .collect()
}

fn payload_by_normalized_name(values: Vec<JsonValue>, field: &str) -> HashMap<String, JsonValue> {
    values
        .into_iter()
        .filter_map(|value| {
            opt_text(&value, field)
                .map(|name| normalize_match_name(&name))
                .filter(|name| !name.is_empty())
                .map(|name| (name, value))
        })
        .collect()
}

fn payloads_by_normalized_name(
    values: Vec<JsonValue>,
    field: &str,
) -> HashMap<String, Vec<JsonValue>> {
    let mut by_name: HashMap<String, Vec<JsonValue>> = HashMap::new();
    for value in values {
        let Some(name) = opt_text(&value, field) else {
            continue;
        };
        let normalized = normalize_match_name(&name);
        if normalized.is_empty() {
            continue;
        }
        by_name.entry(normalized).or_default().push(value);
    }
    by_name
}

fn normalize_match_name(value: &str) -> String {
    value
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn table_info(table: &str) -> Result<TableInfo, String> {
    match table {
        "notes" => Ok(TableInfo {
            sql_name: "notes",
            key_column: "id",
        }),
        "noteBlocks" => Ok(TableInfo {
            sql_name: "note_blocks",
            key_column: "id",
        }),
        "noteFiles" => Ok(TableInfo {
            sql_name: "note_files",
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
        _ => Err(format!("Unknown SQLite table: {}", table)),
    }
}

fn index_column(table: &str, index: &str) -> Result<&'static str, String> {
    match (table, index) {
        ("notes", "id") => Ok("id"),
        ("notes", "collectionId") => Ok("collection_id"),
        ("notes", "isFavorite") => Ok("is_favorite"),
        ("notes", "isPinned") => Ok("is_pinned"),
        ("notes", "isArchived") => Ok("is_archived"),
        ("notes", "isTrashed") => Ok("is_trashed"),
        ("notes", "updatedAt") => Ok("updated_at"),
        ("notes", "lastOpenedAt") => Ok("last_opened_at"),
        ("noteBlocks", "id") => Ok("id"),
        ("noteBlocks", "noteId") => Ok("note_id"),
        ("noteBlocks", "sortOrder") => Ok("sort_order"),
        ("noteBlocks", "updatedAt") => Ok("updated_at"),
        ("noteFiles", "id") => Ok("id"),
        ("noteFiles", "noteId") => Ok("note_id"),
        ("noteFiles", "blockId") => Ok("block_id"),
        ("noteFiles", "kind") => Ok("kind"),
        ("tags", "id") => Ok("id"),
        ("tags", "name") => Ok("name"),
        ("collections", "id") => Ok("id"),
        ("collections", "name") => Ok("name"),
        ("users", "id") => Ok("id"),
        ("users", "email") => Ok("email"),
        ("activities", "id") => Ok("id"),
        ("activities", "noteId") => Ok("note_id"),
        ("activities", "createdAt") => Ok("created_at"),
        ("userSettings", "id") => Ok("id"),
        ("userSettings", "language") => Ok("language"),
        ("userSettings", "theme") => Ok("theme"),
        ("userSettings", "updatedAt") => Ok("updated_at"),
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

fn string_array_field(value: &JsonValue, field: &str) -> Vec<String> {
    value
        .get(field)
        .and_then(JsonValue::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(JsonValue::as_str)
                .map(ToString::to_string)
                .collect()
        })
        .unwrap_or_default()
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

fn set_json_field(value: &mut JsonValue, field: &str, next: JsonValue) -> Result<(), String> {
    let Some(object) = value.as_object_mut() else {
        return Err("Expected JSON object while preparing NoteX note import".to_string());
    };
    object.insert(field.to_string(), next);
    Ok(())
}

fn strings_to_json_array(values: Vec<String>) -> JsonValue {
    JsonValue::Array(values.into_iter().map(JsonValue::String).collect())
}

fn rewrite_note_file_nodes(
    value: &mut JsonValue,
    file_map: &HashMap<String, JsonValue>,
) -> Result<bool, String> {
    let is_note_file = value.get("type").and_then(JsonValue::as_str) == Some("noteFile");
    let Some(object) = value.as_object_mut() else {
        return Ok(true);
    };

    if is_note_file {
        let old_file_id = object
            .get("attrs")
            .and_then(|attrs| attrs.get("id"))
            .and_then(JsonValue::as_str)
            .map(ToString::to_string);
        let Some(old_file_id) = old_file_id else {
            return Ok(false);
        };
        let Some(new_file) = file_map.get(&old_file_id) else {
            return Ok(false);
        };
        let Some(attrs) = object.get_mut("attrs").and_then(JsonValue::as_object_mut) else {
            return Ok(false);
        };
        for field in [
            "id",
            "noteId",
            "blockId",
            "kind",
            "originalName",
            "mimeType",
            "sizeBytes",
            "checksum",
            "relativePath",
            "createdAt",
        ] {
            attrs.insert(
                field.to_string(),
                new_file.get(field).cloned().unwrap_or(JsonValue::Null),
            );
        }
    }

    if let Some(content) = object.get_mut("content").and_then(JsonValue::as_array_mut) {
        let mut next_content = Vec::with_capacity(content.len());
        for mut child in std::mem::take(content) {
            if rewrite_note_file_nodes(&mut child, file_map)? {
                next_content.push(child);
            }
        }
        *content = next_content;
    }

    Ok(true)
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

fn timestamp_for_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);

    nanos.to_string()
}

fn current_timestamp() -> String {
    let seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or(0);
    unix_seconds_to_iso8601(seconds)
}

fn unix_seconds_to_iso8601(seconds: u64) -> String {
    let days = (seconds / 86_400) as i64;
    let seconds_of_day = seconds % 86_400;
    let hour = seconds_of_day / 3_600;
    let minute = (seconds_of_day % 3_600) / 60;
    let second = seconds_of_day % 60;
    let (year, month, day) = civil_from_days(days);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, minute, second
    )
}

fn civil_from_days(days_since_epoch: i64) -> (i64, u32, u32) {
    let z = days_since_epoch + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    if month <= 2 {
        year += 1;
    }

    (year, month as u32, day as u32)
}

fn validate_sqlite_database(path: &Path) -> Result<(), String> {
    let conn =
        Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(to_string)?;
    for table in [
        "notes",
        "note_blocks",
        "note_files",
        "tags",
        "collections",
        "users",
        "activities",
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

fn prepare_imported_database(path: &Path) -> Result<(), String> {
    let mut conn = Connection::open(path).map_err(to_string)?;
    ensure_schema(&conn)?;
    let tx = conn.transaction().map_err(to_string)?;
    // A package may come from another account. Its remote IDs, exclusion list
    // and deletion queue must never be replayed into this account's Drive.
    tx.execute_batch("DELETE FROM cloud_state; DELETE FROM cloud_outbox;
        INSERT INTO cloud_outbox SELECT id, 'note', lower(hex(randomblob(16))), version, 0,
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER) FROM notes;
        INSERT INTO cloud_outbox VALUES ('@library', 'library', lower(hex(randomblob(16))), 1, 0,
            CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER), CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER));
        INSERT OR REPLACE INTO app_metadata (key,value,updated_at) VALUES ('demo_seeded','true',datetime('now'));").map_err(to_string)?;
    tx.commit().map_err(to_string)?;
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

    zip.start_file("manifest.json", options)
        .map_err(to_string)?;
    zip.write_all(manifest.to_string().as_bytes())
        .map_err(to_string)?;
    zip.start_file("notex.sqlite", options).map_err(to_string)?;
    let mut database_file = File::open(database_path).map_err(to_string)?;
    std::io::copy(&mut database_file, &mut zip).map_err(to_string)?;

    if files_path.exists() {
        add_directory_to_zip(&mut zip, files_path, files_path, "files", options)?;
    }

    zip.finish().map_err(to_string)?;
    Ok(())
}

fn create_notex_note_package(
    package_path: &Path,
    note_export: &JsonValue,
    files_path: &Path,
    created_at: &str,
) -> Result<(), String> {
    let package_file = File::create(package_path).map_err(to_string)?;
    let mut zip = ZipWriter::new(package_file);
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let manifest = serde_json::json!({
        "packageType": "notex-note",
        "schemaVersion": 1,
        "exportedAt": created_at,
        "note": "note.json",
        "filesDirectory": "files"
    });

    zip.start_file("manifest.json", options)
        .map_err(to_string)?;
    zip.write_all(manifest.to_string().as_bytes())
        .map_err(to_string)?;
    zip.start_file("note.json", options).map_err(to_string)?;
    zip.write_all(
        serde_json::to_string_pretty(note_export)
            .map_err(to_string)?
            .as_bytes(),
    )
    .map_err(to_string)?;

    if let Some(files) = note_export.get("files").and_then(JsonValue::as_array) {
        for file in files {
            let relative_path = file
                .get("relativePath")
                .and_then(JsonValue::as_str)
                .ok_or("Note file metadata is missing a relative path")?;
            let relative = safe_relative_files_path(relative_path)?;
            let source = files_path.join(&relative);
            if !source.is_file() {
                let original_name = file
                    .get("originalName")
                    .and_then(JsonValue::as_str)
                    .unwrap_or(relative_path);
                return Err(format!(
                    "Stored attachment was not found: {}",
                    original_name
                ));
            }
            let archive_name = format!("files/{}", relative.to_string_lossy().replace('\\', "/"));
            zip.start_file(archive_name, options).map_err(to_string)?;
            let mut source_file = File::open(source).map_err(to_string)?;
            std::io::copy(&mut source_file, &mut zip).map_err(to_string)?;
        }
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

fn validate_notex_note_package(path: &Path) -> Result<(), String> {
    let file = File::open(path).map_err(to_string)?;
    let mut archive = ZipArchive::new(file).map_err(to_string)?;
    let mut has_manifest = false;
    let mut has_note = false;

    for index in 0..archive.len() {
        let file = archive.by_index(index).map_err(to_string)?;
        let safe_path = safe_archive_path(file.name())?;
        if safe_path == PathBuf::from("manifest.json") {
            has_manifest = true;
        }
        if safe_path == PathBuf::from("note.json") {
            has_note = true;
        }
    }

    if !has_manifest {
        return Err(
            "Selected file is not a valid NoteX note export. Missing manifest.json".to_string(),
        );
    }
    if !has_note {
        return Err(
            "Selected file is not a valid NoteX note export. Missing note.json".to_string(),
        );
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
        return Err(
            "Selected file is not a valid NoteX package. Missing manifest.json".to_string(),
        );
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
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(to_string)?;
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

fn sanitize_file_stem(value: &str) -> String {
    let sanitized = sanitize_path_segment(&value.to_ascii_lowercase());
    if sanitized.is_empty() {
        "untitled".to_string()
    } else {
        sanitized
    }
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
    use super::{ensure_schema, read_metadata, safe_archive_path, SCHEMA_VERSION};
    use rusqlite::Connection;
    use std::path::PathBuf;

    struct AdoptionFixture {
        root: PathBuf,
        account: PathBuf,
    }
    impl AdoptionFixture {
        fn new() -> Self {
            let root = std::env::temp_dir()
                .join(format!("notex-adoption-test-{}", super::timestamp_for_id()));
            let account = root.join("user@gmail.com");
            std::fs::create_dir_all(root.join("files")).unwrap();
            std::fs::create_dir_all(&account).unwrap();
            Self { root, account }
        }
        fn database(&self, account: bool) -> Connection {
            let conn = Connection::open(
                if account { &self.account } else { &self.root }.join("notex.sqlite"),
            )
            .unwrap();
            ensure_schema(&conn).unwrap();
            conn
        }
        fn seed(&self, account: bool, title: &str, version: u64, with_file: bool) {
            let mut conn = self.database(account);
            let tx = conn.transaction().unwrap();
            super::insert_note(
                &tx,
                &serde_json::json!({"id":"note", "title":title, "version":version}),
            )
            .unwrap();
            super::insert_note_block(&tx, &serde_json::json!({"id":"block", "noteId":"note", "contentText":title,
                "contentJson":{"relativePath":"attachment.txt", "updatedAt":"content field must survive"}})).unwrap();
            if with_file {
                super::insert_note_file(&tx, &serde_json::json!({"id":"file", "noteId":"note", "blockId":"block", "relativePath":"attachment.txt"})).unwrap();
                let root = if account { &self.account } else { &self.root };
                std::fs::create_dir_all(root.join("files")).unwrap();
                std::fs::write(root.join("files/attachment.txt"), title).unwrap();
            }
            tx.commit().unwrap();
        }
    }
    impl Drop for AdoptionFixture {
        fn drop(&mut self) {
            // This unique fixture directory was created by this test only.
            let expected_parent = std::env::temp_dir().canonicalize().unwrap();
            let resolved = self.root.canonicalize().unwrap();
            assert_eq!(resolved.parent(), Some(expected_parent.as_path()));
            assert!(resolved
                .file_name()
                .unwrap()
                .to_string_lossy()
                .starts_with("notex-adoption-test-"));
            std::fs::remove_dir_all(resolved).unwrap();
        }
    }

    #[test]
    fn account_adoption_preserves_ids_and_files_and_clears_guest_only_after_commit() {
        let fixture = AdoptionFixture::new();
        fixture.seed(false, "Local note", 7, true);
        super::merge_local_library(&fixture.root, &fixture.account).unwrap();
        let guest = fixture.database(false);
        let account = fixture.database(true);
        assert_eq!(
            super::read_payloads(&guest, "notes", None, &[])
                .unwrap()
                .len(),
            0
        );
        let note = super::read_payloads(&account, "notes", None, &[])
            .unwrap()
            .pop()
            .unwrap();
        assert_eq!(note["id"], "note");
        assert_eq!(note["version"], 7);
        let file = super::read_payloads(&account, "noteFiles", None, &[])
            .unwrap()
            .pop()
            .unwrap();
        let path = file["relativePath"].as_str().unwrap();
        assert_eq!(
            std::fs::read_to_string(fixture.account.join("files").join(path)).unwrap(),
            "Local note"
        );
        let block = super::read_payloads(&account, "noteBlocks", None, &[])
            .unwrap()
            .pop()
            .unwrap();
        assert_eq!(block["contentJson"]["relativePath"], path);
        assert_eq!(
            block["contentJson"]["updatedAt"],
            "content field must survive"
        );
        assert!(!fixture.root.join("files/attachment.txt").exists());
        assert_eq!(
            read_metadata(&guest, "demo_seeded").unwrap().as_deref(),
            Some("true")
        );
        assert_eq!(
            account
                .query_row(
                    "SELECT version FROM cloud_outbox WHERE entity_id = 'note'",
                    [],
                    |r| r.get::<_, i64>(0)
                )
                .unwrap(),
            7
        );
        drop(guest);
        drop(account);
        // Retrying after a committed adoption does not duplicate data.
        super::merge_local_library(&fixture.root, &fixture.account).unwrap();
    }

    #[test]
    fn account_adoption_conflict_or_missing_file_preserves_both_libraries() {
        let fixture = AdoptionFixture::new();
        fixture.seed(false, "Local", 2, true);
        fixture.seed(true, "Account", 2, true);
        assert!(super::merge_local_library(&fixture.root, &fixture.account)
            .unwrap_err()
            .starts_with("ACCOUNT_NOTE_CONFLICT:"));
        let guest = fixture.database(false);
        let account = fixture.database(true);
        assert_eq!(
            super::read_payloads(&guest, "notes", None, &[]).unwrap()[0]["title"],
            "Local"
        );
        assert_eq!(
            super::read_payloads(&account, "notes", None, &[]).unwrap()[0]["title"],
            "Account"
        );
        assert_eq!(
            std::fs::read_to_string(fixture.root.join("files/attachment.txt")).unwrap(),
            "Local"
        );
        drop(guest);
        drop(account);
        fixture.seed(false, "Newer local", 3, true);
        std::fs::remove_file(fixture.root.join("files/attachment.txt")).unwrap();
        assert!(super::merge_local_library(&fixture.root, &fixture.account)
            .unwrap_err()
            .contains("Missing local attachment"));
        assert_eq!(
            super::read_payloads(&fixture.database(false), "notes", None, &[]).unwrap()[0]
                ["version"],
            3
        );
        assert_eq!(
            super::read_payloads(&fixture.database(true), "notes", None, &[]).unwrap()[0]
                ["version"],
            2
        );
        assert_eq!(
            std::fs::read_to_string(fixture.account.join("files/attachment.txt")).unwrap(),
            "Account"
        );
    }

    #[test]
    fn account_adoption_never_replaces_a_newer_account_note() {
        let fixture = AdoptionFixture::new();
        fixture.seed(false, "Local", 2, true);
        fixture.seed(true, "Account", 5, true);
        super::merge_local_library(&fixture.root, &fixture.account).unwrap();
        assert_eq!(
            super::read_payloads(&fixture.database(true), "notes", None, &[]).unwrap()[0]
                ["version"],
            5
        );
        assert_eq!(
            std::fs::read_to_string(fixture.account.join("files/attachment.txt")).unwrap(),
            "Account"
        );
        assert!(
            super::read_payloads(&fixture.database(false), "notes", None, &[])
                .unwrap()
                .is_empty()
        );
    }

    #[test]
    fn note_revision_enqueues_block_edits_even_without_header_changes() {
        let mut conn = Connection::open_in_memory().unwrap();
        ensure_schema(&conn).unwrap();
        let tx = conn.transaction().unwrap();
        super::insert_note(
            &tx,
            &serde_json::json!({"id":"note", "title":"Unchanged", "version":1}),
        )
        .unwrap();
        tx.execute("DELETE FROM cloud_outbox", []).unwrap();
        super::insert_note(
            &tx,
            &serde_json::json!({"id":"note", "title":"Unchanged", "version":2}),
        )
        .unwrap();
        assert_eq!(
            tx.query_row(
                "SELECT version FROM cloud_outbox WHERE entity_id = 'note'",
                [],
                |r| r.get::<_, i64>(0)
            )
            .unwrap(),
            2
        );
        tx.commit().unwrap();
    }

    fn schema_snapshot(conn: &Connection) -> Vec<(String, String, Option<String>)> {
        let mut statement = conn
            .prepare(
                "SELECT type, name, sql
                 FROM sqlite_master
                 WHERE name NOT LIKE 'sqlite_%'
                 ORDER BY type, name",
            )
            .unwrap();

        statement
            .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap()
    }

    #[test]
    fn accepts_safe_package_paths() {
        assert_eq!(
            safe_archive_path("notex.sqlite").unwrap(),
            PathBuf::from("notex.sqlite")
        );
        assert_eq!(
            safe_archive_path("files/note-1/file.png").unwrap(),
            PathBuf::from("files/note-1/file.png")
        );
    }

    fn make_legacy_database(conn: &Connection) {
        ensure_schema(conn).unwrap();
        let triggers: Vec<String> = conn
            .prepare(
                "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'cloud_%'",
            )
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for trigger in triggers {
            conn.execute_batch(&format!("DROP TRIGGER \"{trigger}\";"))
                .unwrap();
        }
        conn.execute_batch("DROP TABLE cloud_state; DROP TABLE cloud_outbox;
            UPDATE app_metadata SET value = '3' WHERE key = 'sqlite_schema_version';
            INSERT INTO notes (id, title, subtitle, tag_ids, linked_note_ids, created_at, updated_at, stats, payload)
            VALUES ('legacy', 'Existing note', '', '[]', '[]', '2026-01-01', '2026-01-01', '{}', '{\"id\":\"legacy\",\"title\":\"Existing note\"}');").unwrap();
    }

    #[test]
    fn migrates_v3_without_changing_notes_and_preserves_a_consistent_backup() {
        let root = std::env::temp_dir().join(format!(
            "notex-migration-test-{}",
            super::timestamp_for_id()
        ));
        std::fs::create_dir(&root).unwrap();
        let path = root.join("notex.sqlite");
        let conn = Connection::open(&path).unwrap();
        conn.pragma_update(None, "journal_mode", "WAL").unwrap();
        make_legacy_database(&conn);
        ensure_schema(&conn).unwrap();
        assert_eq!(
            read_metadata(&conn, "sqlite_schema_version")
                .unwrap()
                .as_deref(),
            Some(SCHEMA_VERSION)
        );
        let payload: String = conn
            .query_row("SELECT payload FROM notes WHERE id = 'legacy'", [], |row| {
                row.get(0)
            })
            .unwrap();
        let backup_path = read_metadata(&conn, "last_migration_backup_path")
            .unwrap()
            .unwrap();
        let backup =
            Connection::open_with_flags(&backup_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY)
                .unwrap();
        assert_eq!(
            read_metadata(&backup, "sqlite_schema_version")
                .unwrap()
                .as_deref(),
            Some("3")
        );
        let backed_up: String = backup
            .query_row("SELECT payload FROM notes WHERE id = 'legacy'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(payload, backed_up);
        drop(backup);
        drop(conn);
        std::fs::remove_file(&backup_path).unwrap();
        std::fs::remove_dir(root.join("backups")).unwrap();
        std::fs::remove_file(path).unwrap();
        std::fs::remove_dir(root).unwrap();
    }

    #[test]
    fn migration_failure_rolls_back_all_schema_changes() {
        let conn = Connection::open_in_memory().unwrap();
        make_legacy_database(&conn);
        conn.execute_batch(
            "CREATE TRIGGER cloud_notes_INSERT AFTER INSERT ON notes BEGIN SELECT 1; END;",
        )
        .unwrap();
        let before = schema_snapshot(&conn);
        assert!(ensure_schema(&conn).is_err());
        assert_eq!(schema_snapshot(&conn), before);
        assert_eq!(
            read_metadata(&conn, "sqlite_schema_version")
                .unwrap()
                .as_deref(),
            Some("3")
        );
        let title: String = conn
            .query_row("SELECT title FROM notes WHERE id = 'legacy'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(title, "Existing note");
    }

    #[test]
    fn outbox_coalesces_edits_ignores_visits_and_records_deletions_atomically() {
        let conn = Connection::open_in_memory().unwrap();
        make_legacy_database(&conn);
        ensure_schema(&conn).unwrap();
        conn.execute("UPDATE notes SET last_opened_at = 'today', payload = json_set(payload, '$.lastOpenedAt', 'today') WHERE id = 'legacy'", []).unwrap();
        let count = || {
            conn.query_row::<i64, _, _>("SELECT COUNT(*) FROM cloud_outbox", [], |row| row.get(0))
                .unwrap()
        };
        assert_eq!(count(), 0);
        conn.execute("UPDATE notes SET title = 'Edited', version = 2, payload = json_set(payload, '$.title', 'Edited', '$.version', 2) WHERE id = 'legacy'", []).unwrap();
        assert_eq!(count(), 1);
        let token: String = conn
            .query_row("SELECT change_token FROM cloud_outbox", [], |row| {
                row.get(0)
            })
            .unwrap();
        conn.execute("UPDATE notes SET title = 'Again', version = 3, payload = json_set(payload, '$.title', 'Again', '$.version', 3) WHERE id = 'legacy'", []).unwrap();
        assert_eq!(count(), 1);
        let next: String = conn
            .query_row("SELECT change_token FROM cloud_outbox", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_ne!(token, next);
        conn.execute_batch("BEGIN; DELETE FROM notes WHERE id = 'legacy'; ROLLBACK;")
            .unwrap();
        let deleted: i64 = conn
            .query_row("SELECT deleted FROM cloud_outbox", [], |row| row.get(0))
            .unwrap();
        assert_eq!(deleted, 0);
        conn.execute("DELETE FROM notes WHERE id = 'legacy'", [])
            .unwrap();
        let result: (i64, i64) = conn
            .query_row("SELECT deleted, version FROM cloud_outbox", [], |row| {
                Ok((row.get(0)?, row.get(1)?))
            })
            .unwrap();
        assert_eq!(result, (1, 4));
    }

    #[test]
    fn rejects_unsafe_package_paths() {
        assert!(safe_archive_path("../notex.sqlite").is_err());
        assert!(safe_archive_path("files/../../secret.txt").is_err());
        assert!(safe_archive_path("/tmp/notex.sqlite").is_err());
        assert!(safe_archive_path("C:\\tmp\\notex.sqlite").is_err());
    }

    #[test]
    fn initializes_empty_database_and_records_current_version() {
        let conn = Connection::open_in_memory().unwrap();
        ensure_schema(&conn).unwrap();
        assert!(conn.is_autocommit());
        assert_eq!(
            read_metadata(&conn, "sqlite_schema_version")
                .unwrap()
                .as_deref(),
            Some(SCHEMA_VERSION)
        );
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM notes", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn rejects_unknown_versions_and_missing_marker_without_changing_data() {
        for version in [Some("2"), Some("5"), Some("invalid"), Some(""), None] {
            let conn = Connection::open_in_memory().unwrap();
            ensure_schema(&conn).unwrap();
            conn.execute(
                "INSERT INTO notes (id, title, subtitle, tag_ids, linked_note_ids, created_at, updated_at, stats, payload)
                 VALUES ('keep', 'Keep this note', '', '[]', '[]', '2026-01-01', '2026-01-01', '{}', '{\"text\":\"User content\"}')",
                [],
            ).unwrap();
            if let Some(version) = version {
                conn.execute(
                    "UPDATE app_metadata SET value = ?1 WHERE key = 'sqlite_schema_version'",
                    [version],
                )
                .unwrap();
            } else {
                conn.execute(
                    "DELETE FROM app_metadata WHERE key = 'sqlite_schema_version'",
                    [],
                )
                .unwrap();
            }
            let before = schema_snapshot(&conn);
            let changes_before = conn.total_changes();
            let error = ensure_schema(&conn).unwrap_err();
            assert!(error.contains("No data was changed"));
            assert_eq!(schema_snapshot(&conn), before);
            assert_eq!(conn.total_changes(), changes_before);
            assert_eq!(
                read_metadata(&conn, "sqlite_schema_version")
                    .unwrap()
                    .as_deref(),
                version
            );
            let payload: String = conn
                .query_row("SELECT payload FROM notes WHERE id = 'keep'", [], |row| {
                    row.get(0)
                })
                .unwrap();
            assert_eq!(payload, r#"{"text":"User content"}"#);
            assert!(conn.is_autocommit());
        }
    }

    #[test]
    fn rejects_unversioned_existing_database_without_creating_metadata() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE notes (id TEXT, content TEXT);
                            INSERT INTO notes VALUES ('keep', 'Original content');",
        )
        .unwrap();
        let before = schema_snapshot(&conn);
        let changes_before = conn.total_changes();
        assert!(ensure_schema(&conn)
            .unwrap_err()
            .contains("No data was changed"));
        assert_eq!(schema_snapshot(&conn), before);
        assert_eq!(conn.total_changes(), changes_before);
        let content: String = conn
            .query_row("SELECT content FROM notes WHERE id = 'keep'", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(content, "Original content");
    }

    #[test]
    fn preserves_existing_v3_schema_and_note_content() {
        let conn = Connection::open_in_memory().unwrap();
        ensure_schema(&conn).unwrap();
        conn.execute(
            "INSERT INTO notes (
                id, title, subtitle, tag_ids, linked_note_ids,
                created_at, updated_at, stats, payload
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            (
                "note-v3",
                "Existing note",
                "Local content",
                "[]",
                "[]",
                "2026-01-01T00:00:00.000Z",
                "2026-01-01T00:00:00.000Z",
                "{}",
                r#"{"id":"note-v3","title":"Existing note"}"#,
            ),
        )
        .unwrap();

        let schema_before = schema_snapshot(&conn);
        let note_before: (String, String, String, i64, String) = conn
            .query_row(
                "SELECT id, title, subtitle, version, payload FROM notes WHERE id = ?1",
                ["note-v3"],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                },
            )
            .unwrap();

        let changes_before = conn.total_changes();
        ensure_schema(&conn).unwrap();
        assert_eq!(conn.total_changes(), changes_before);

        let schema_after = schema_snapshot(&conn);
        let note_after: (String, String, String, i64, String) = conn
            .query_row(
                "SELECT id, title, subtitle, version, payload FROM notes WHERE id = ?1",
                ["note-v3"],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                    ))
                },
            )
            .unwrap();

        assert_eq!(schema_before, schema_after);
        assert_eq!(note_before, note_after);
        assert_eq!(
            read_metadata(&conn, "sqlite_schema_version")
                .unwrap()
                .as_deref(),
            Some(SCHEMA_VERSION)
        );
    }
}
