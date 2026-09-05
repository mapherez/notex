mod external_links;
mod mcp_bridge;
mod mcp_local_server;
mod mcp_request_broker;
mod sqlite_storage;
mod update_cleanup;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(mcp_bridge::McpManager::new())
        .manage(mcp_local_server::LocalMcpManager::new())
        .manage(mcp_request_broker::McpRequestBroker::new())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            external_links::notex_open_external_url,
            mcp_bridge::notex_mcp_get_state,
            mcp_bridge::notex_mcp_initialize,
            mcp_bridge::notex_mcp_start_authorization,
            mcp_bridge::notex_mcp_cancel_authorization,
            mcp_bridge::notex_mcp_logout,
            mcp_bridge::notex_mcp_revoke_ai_access,
            mcp_bridge::notex_mcp_delete_account,
            mcp_bridge::notex_mcp_respond,
            mcp_local_server::notex_local_mcp_get_state,
            mcp_local_server::notex_local_mcp_set_renderer_ready,
            mcp_local_server::notex_local_mcp_start,
            mcp_local_server::notex_local_mcp_stop,
            sqlite_storage::notex_sqlite_status,
            sqlite_storage::notex_sqlite_create_temp_export,
            sqlite_storage::notex_sqlite_copy_export_to,
            sqlite_storage::notex_sqlite_replace_database_from_file,
            sqlite_storage::notex_sqlite_open_database_folder,
            sqlite_storage::notex_sqlite_open_local_data_folder,
            sqlite_storage::notex_sqlite_open_files_folder,
            sqlite_storage::notex_package_create_temp_export,
            sqlite_storage::notex_package_copy_export_to,
            sqlite_storage::notex_package_replace_from_file,
            sqlite_storage::notex_note_package_create_temp_export,
            sqlite_storage::notex_note_package_copy_export_to,
            sqlite_storage::notex_note_package_import_from_file,
            sqlite_storage::notex_note_file_import,
            sqlite_storage::notex_note_file_absolute_path,
            sqlite_storage::notex_note_file_open,
            sqlite_storage::notex_note_file_copy_to,
            sqlite_storage::notex_note_file_delete,
            sqlite_storage::notex_sqlite_get,
            sqlite_storage::notex_sqlite_read_table,
            sqlite_storage::notex_sqlite_count,
            sqlite_storage::notex_sqlite_where_read,
            sqlite_storage::notex_sqlite_where_count,
            sqlite_storage::notex_sqlite_transaction,
            update_cleanup::notex_prepare_update_relaunch_with_local_data_reset,
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
