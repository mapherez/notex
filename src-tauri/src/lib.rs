mod sqlite_storage;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            sqlite_storage::notex_sqlite_status,
            sqlite_storage::notex_sqlite_migrate_from_indexeddb,
            sqlite_storage::notex_sqlite_get,
            sqlite_storage::notex_sqlite_read_table,
            sqlite_storage::notex_sqlite_count,
            sqlite_storage::notex_sqlite_where_read,
            sqlite_storage::notex_sqlite_where_count,
            sqlite_storage::notex_sqlite_transaction,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
