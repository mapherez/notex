use std::process::Command;

#[tauri::command]
pub fn notex_open_external_url(url: String) -> Result<(), String> {
    let trimmed = url.trim();
    if !is_allowed_external_url(trimmed) {
        return Err("Only http, https, and mailto links can be opened externally".to_string());
    }

    open_url(trimmed)
}

fn is_allowed_external_url(url: &str) -> bool {
    let lowered = url.to_ascii_lowercase();
    lowered.starts_with("https://")
        || lowered.starts_with("http://")
        || lowered.starts_with("mailto:")
}

#[cfg(target_os = "windows")]
fn open_url(url: &str) -> Result<(), String> {
    Command::new("explorer")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(target_os = "macos")]
fn open_url(url: &str) -> Result<(), String> {
    Command::new("open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn open_url(url: &str) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(url)
        .spawn()
        .map(|_| ())
        .map_err(|error| error.to_string())
}
