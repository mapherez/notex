use std::path::PathBuf;
use std::process::Command;

use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn notex_prepare_update_relaunch_with_local_data_reset(app: AppHandle) -> Result<(), String> {
    let local_data_dir = app.path().app_local_data_dir().map_err(to_string)?;
    let roaming_data_dir = app.path().app_data_dir().map_err(to_string)?;
    ensure_distinct_data_dirs(&local_data_dir, &roaming_data_dir)?;

    schedule_clean_relaunch(local_data_dir)
}

fn ensure_distinct_data_dirs(
    local_data_dir: &PathBuf,
    roaming_data_dir: &PathBuf,
) -> Result<(), String> {
    if normalize_path_text(local_data_dir) == normalize_path_text(roaming_data_dir) {
        return Err(
            "Refusing to clear local app data because it matches the persistent app data directory"
                .to_string(),
        );
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn schedule_clean_relaunch(local_data_dir: PathBuf) -> Result<(), String> {
    use std::os::windows::process::CommandExt;

    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let current_exe = std::env::current_exe().map_err(to_string)?;
    let script = build_windows_cleanup_script(std::process::id(), &local_data_dir, &current_exe);

    Command::new("powershell.exe")
        .args([
            "-NoProfile",
            "-WindowStyle",
            "Hidden",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            &script,
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .spawn()
        .map_err(to_string)?;

    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn schedule_clean_relaunch(local_data_dir: PathBuf) -> Result<(), String> {
    let current_exe = std::env::current_exe().map_err(to_string)?;

    if local_data_dir.exists() {
        std::fs::remove_dir_all(&local_data_dir).map_err(to_string)?;
    }
    std::fs::create_dir_all(&local_data_dir).map_err(to_string)?;
    Command::new(current_exe).spawn().map_err(to_string)?;

    Ok(())
}

#[cfg(target_os = "windows")]
fn build_windows_cleanup_script(
    process_id: u32,
    local_data_dir: &PathBuf,
    current_exe: &PathBuf,
) -> String {
    let local_data_dir = powershell_quote(&local_data_dir.to_string_lossy());
    let current_exe = powershell_quote(&current_exe.to_string_lossy());

    format!(
        "$ErrorActionPreference = 'SilentlyContinue';\
         Wait-Process -Id {process_id} -Timeout 45;\
         Start-Sleep -Milliseconds 350;\
         for ($i = 0; $i -lt 20; $i++) {{\
           if (Test-Path -LiteralPath {local_data_dir}) {{\
             Remove-Item -LiteralPath {local_data_dir} -Recurse -Force -ErrorAction SilentlyContinue;\
           }}\
           if (-not (Test-Path -LiteralPath {local_data_dir})) {{ break }}\
           Start-Sleep -Milliseconds 250;\
         }}\
         New-Item -ItemType Directory -Force -Path {local_data_dir} | Out-Null;\
         Start-Process -FilePath {current_exe};"
    )
}

#[cfg(target_os = "windows")]
fn powershell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn normalize_path_text(path: &PathBuf) -> String {
    path.to_string_lossy().replace('\\', "/").to_lowercase()
}

fn to_string(error: impl ToString) -> String {
    error.to_string()
}
