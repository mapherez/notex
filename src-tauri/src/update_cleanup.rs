#[cfg(any(target_os = "windows", test))]
use std::path::PathBuf;
#[cfg(target_os = "windows")]
use std::process::Command;

use tauri::AppHandle;
#[cfg(target_os = "windows")]
use tauri::Manager;

#[derive(Clone, Copy, Debug, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum UpdateRelaunchStrategy {
    Exit,
    Relaunch,
}

fn relaunch_strategy_for_os(os: &str) -> UpdateRelaunchStrategy {
    match os {
        "windows" => UpdateRelaunchStrategy::Exit,
        _ => UpdateRelaunchStrategy::Relaunch,
    }
}

#[tauri::command]
pub fn notex_prepare_update_relaunch_with_local_data_reset(
    app: AppHandle,
) -> Result<UpdateRelaunchStrategy, String> {
    #[cfg(target_os = "windows")]
    {
        let local_data_dir = app.path().app_local_data_dir().map_err(to_string)?;
        let roaming_data_dir = app.path().app_data_dir().map_err(to_string)?;
        ensure_distinct_data_dirs(&local_data_dir, &roaming_data_dir)?;
        schedule_clean_relaunch(local_data_dir)?;
    }
    // On macOS the local and persistent data directories coincide. Never
    // clear either; let plugin-process restart the application normally.
    #[cfg(not(target_os = "windows"))]
    let _ = app;

    Ok(relaunch_strategy_for_os(std::env::consts::OS))
}

#[cfg(any(target_os = "windows", test))]
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

#[cfg(any(target_os = "windows", test))]
fn normalize_path_text(path: &PathBuf) -> String {
    path.to_string_lossy().replace('\\', "/").to_lowercase()
}

#[cfg(target_os = "windows")]
fn to_string(error: impl ToString) -> String {
    error.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn macos_relaunches_without_scheduling_data_cleanup() {
        assert_eq!(
            relaunch_strategy_for_os("macos"),
            UpdateRelaunchStrategy::Relaunch
        );
        assert_eq!(
            relaunch_strategy_for_os("windows"),
            UpdateRelaunchStrategy::Exit
        );
        assert_eq!(
            relaunch_strategy_for_os(std::env::consts::OS),
            if cfg!(target_os = "windows") {
                UpdateRelaunchStrategy::Exit
            } else {
                UpdateRelaunchStrategy::Relaunch
            }
        );
    }

    #[test]
    fn windows_cleanup_refuses_persistent_data_and_accepts_distinct_directories() {
        let persistent = PathBuf::from("C:/Users/Test/AppData/Roaming/NoteX");
        assert!(ensure_distinct_data_dirs(&persistent, &persistent).is_err());
        assert!(ensure_distinct_data_dirs(
            &PathBuf::from("c:\\users\\test\\appdata\\roaming\\notex"),
            &persistent,
        )
        .is_err());
        assert!(ensure_distinct_data_dirs(
            &PathBuf::from("C:/Users/Test/AppData/Local/NoteX"),
            &persistent,
        )
        .is_ok());
    }
}
