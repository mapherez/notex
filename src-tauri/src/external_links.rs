#[cfg(not(target_os = "windows"))]
use std::process::Command;

#[tauri::command]
pub fn notex_open_external_url(url: String) -> Result<(), String> {
    open_external_url(&url)
}

pub(crate) fn open_external_url(url: &str) -> Result<(), String> {
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
    use windows_sys::Win32::{
        Foundation::RPC_E_CHANGED_MODE,
        System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED, COINIT_DISABLE_OLE1DDE},
        UI::{Shell::ShellExecuteW, WindowsAndMessaging::SW_SHOWNORMAL},
    };

    if url.contains('\0') {
        return Err("External URL contains a null character".to_string());
    }
    let url: Vec<u16> = url.encode_utf16().chain(std::iter::once(0)).collect();
    let operation: Vec<u16> = "open".encode_utf16().chain(std::iter::once(0)).collect();
    // ShellExecute passes the entire URL to its registered browser, without
    // Explorer's argument parsing or a command shell interpreting the query.
    unsafe {
        let initialized = CoInitializeEx(
            std::ptr::null(),
            (COINIT_APARTMENTTHREADED | COINIT_DISABLE_OLE1DDE) as u32,
        );
        if initialized < 0 && initialized != RPC_E_CHANGED_MODE {
            return Err(format!("Could not initialize URL opener: {initialized:#x}"));
        }
        let result = ShellExecuteW(
            std::ptr::null_mut(),
            operation.as_ptr(),
            url.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            SW_SHOWNORMAL,
        ) as isize;
        if initialized >= 0 {
            CoUninitialize();
        }
        if result > 32 {
            Ok(())
        } else {
            Err(format!("Could not open external URL: Windows error {result}"))
        }
    }
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
