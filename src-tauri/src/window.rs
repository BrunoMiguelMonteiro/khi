use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Emitter, Listener, Manager};

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
    /// Built hidden and shown by the page once its theme is applied (no
    /// white flash), or by `show_when_ready`'s fallback.
    pub visible: bool,
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
        visible: false,
    }
}

/// Held from looking the Settings window up until it is built: two quick ⌘,
/// would otherwise both find no window and both build one. An async lock,
/// awaited by the async command: a sync lock held on the main thread would
/// block the event loop that `build()` waits on.
#[derive(Default)]
pub struct SettingsWindowLock(tauri::async_runtime::Mutex<()>);

/// The Reader the main window had open when it last opened Settings, read by
/// the page with `settings_reader` (never through the URL).
#[derive(Default)]
pub struct SettingsReader(std::sync::Mutex<Option<u32>>);

impl SettingsReader {
    pub fn set(&self, reader_id: Option<u32>) {
        *self.0.lock().unwrap_or_else(|e| e.into_inner()) = reader_id;
    }

    pub fn get(&self) -> Option<u32> {
        *self.0.lock().unwrap_or_else(|e| e.into_inner())
    }
}

/// The Reader to show in Settings; `None` means the last one opened (R5).
#[tauri::command]
#[specta::specta]
pub fn settings_reader(app: tauri::AppHandle) -> Option<u32> {
    app.state::<SettingsReader>().get()
}

/// Closing the main window (⌘W or the red button) quits Khi, Settings
/// included; closing Settings closes only Settings.
pub fn exits_app(label: &str, event: &tauri::WindowEvent) -> bool {
    label == "main" && matches!(event, tauri::WindowEvent::Destroyed)
}

/// The page shows its window once its theme is applied; if it has not after
/// 3 s, it is shown anyway, as the main window is.
fn show_when_ready(app: tauri::AppHandle, label: &'static str) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        // Closed meanwhile: nothing to show
        let Some(window) = app.get_webview_window(label) else { return };
        if !window.is_visible().unwrap_or(true) {
            log::warn!("[Window] Showing {} via fallback timer (3s)", label);
            if let Err(e) = window.show() {
                log::error!("[Window] Failed to show {} via fallback: {}", label, e);
            }
        }
    });
}

/// Brings the Settings window forward, or opens it: there is only ever one.
/// `reader_id` is the Reader the main window has open; an open Settings
/// window gets it as `settings-reader`.
/// Async, because a sync command that builds a window can deadlock.
#[tauri::command]
#[specta::specta]
pub async fn open_settings(
    app: tauri::AppHandle,
    title: String,
    reader_id: Option<u32>,
) -> Result<(), String> {
    let lock = app.state::<SettingsWindowLock>();
    let _opening = lock.0.lock().await;
    app.state::<SettingsReader>().set(reader_id);

    let spec = settings_window_spec(title);
    if let Some(window) = app.get_webview_window(spec.label) {
        if let Some(id) = reader_id {
            if let Err(e) = app.emit_to(spec.label, "settings-reader", id) {
                log::error!("[Window] Failed to send the Reader to Settings: {}", e);
            }
        }
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
    .visible(spec.visible)
    .center();
    #[cfg(target_os = "macos")]
    let builder = builder.title_bar_style(spec.title_bar_style);
    builder.build().map_err(|e| e.to_string())?;
    show_when_ready(app.clone(), spec.label);
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
        // Shown by the page once its theme is applied
        assert!(!spec.visible);
    }

    #[test]
    fn closing_main_exits_app() {
        use tauri::WindowEvent;
        assert!(super::exits_app("main", &WindowEvent::Destroyed));
        // Closing Settings closes only Settings
        assert!(!super::exits_app("settings", &WindowEvent::Destroyed));
        assert!(!super::exits_app("main", &WindowEvent::Focused(false)));
    }

    #[test]
    fn settings_reader_keeps_the_last_reader_sent() {
        let reader = super::SettingsReader::default();
        assert_eq!(reader.get(), None);
        reader.set(Some(2));
        assert_eq!(reader.get(), Some(2));
        reader.set(None);
        assert_eq!(reader.get(), None);
    }
}
