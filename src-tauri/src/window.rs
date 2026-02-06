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
