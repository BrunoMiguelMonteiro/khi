use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Listener, Manager};

pub fn setup_window_show(app: &tauri::App) {
    let window = app
        .get_webview_window("main")
        .expect("main window not found");

    let shown = Arc::new(AtomicBool::new(false));
    let shown_clone = shown.clone();
    let window_clone = window.clone();

    // Listen for app-ready event from frontend
    app.listen("app-ready", move |_| {
        if !shown_clone.swap(true, Ordering::SeqCst) {
            log::info!("[Window] Showing window (app-ready received)");
            if let Err(e) = window_clone.show() {
                log::error!("[Window] Failed to show window: {}", e);
            }
        } else {
            log::info!("[Window] Window already shown, ignoring duplicate show");
        }
    });

    // Fallback: show after 3 seconds if frontend doesn't emit event
    let shown_fallback = shown.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        if !shown_fallback.swap(true, Ordering::SeqCst) {
            log::warn!("[Window] Showing window via fallback timer (3s)");
            if let Err(e) = window.show() {
                log::error!("[Window] Failed to show window via fallback: {}", e);
            }
        }
    });

    log::info!("[Window] Window show listener registered, fallback timer started (3s)");
}

/// How the Settings window is built: one window, opened from the menu (⌘,).
#[derive(Debug, Clone, PartialEq)]
pub struct SettingsWindowSpec {
    pub label: &'static str,
    /// The SvelteKit route, served through the adapter-static fallback.
    pub url_path: &'static str,
    /// Translated by the frontend: Rust has no i18n.
    pub title: String,
    pub resizable: bool,
    pub width: f64,
    pub height: f64,
    pub title_bar_style: tauri::TitleBarStyle,
}

/// The size is the Settings panel's box in the old modal (700 × 535 at the
/// 1000 × 700 main window), so its content lays out as before.
pub fn settings_window_spec(title: String) -> SettingsWindowSpec {
    SettingsWindowSpec {
        label: "settings",
        url_path: "definicoes",
        title,
        resizable: false,
        width: 700.0,
        height: 540.0,
        // The macOS convention for settings windows: the normal title bar
        title_bar_style: tauri::TitleBarStyle::Visible,
    }
}

/// Brings the Settings window forward, or opens it: there is only ever one.
/// Async, because a sync command that builds a window can deadlock.
#[tauri::command]
#[specta::specta]
pub async fn open_settings(app: tauri::AppHandle, title: String) -> Result<(), String> {
    let spec = settings_window_spec(title);
    if let Some(window) = app.get_webview_window(spec.label) {
        window.unminimize().map_err(|e| e.to_string())?;
        window.show().map_err(|e| e.to_string())?;
        return window.set_focus().map_err(|e| e.to_string());
    }

    let builder = tauri::WebviewWindowBuilder::new(
        &app,
        spec.label,
        tauri::WebviewUrl::App(spec.url_path.into()),
    )
    .title(spec.title)
    .resizable(spec.resizable)
    .inner_size(spec.width, spec.height)
    .center();
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(spec.title_bar_style);
    builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    #[test]
    fn settings_window_spec() {
        let spec = super::settings_window_spec("Definições".to_string());
        assert_eq!(spec.label, "settings");
        assert_eq!(spec.url_path, "definicoes");
        assert_eq!(spec.title, "Definições");
        assert!(!spec.resizable);
        assert_eq!((spec.width, spec.height), (700.0, 540.0));
        // The normal macOS bar: settings windows have no Overlay
        assert_eq!(spec.title_bar_style, tauri::TitleBarStyle::Visible);
    }
}
