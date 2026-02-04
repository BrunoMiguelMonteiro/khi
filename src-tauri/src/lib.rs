pub mod commands;
pub mod covers;
pub mod db;
pub mod device;
pub mod export;
pub mod models;
pub mod settings;
pub mod utils;

use commands::{
    export_books, get_default_export_path, get_export_preview, import_highlights, load_settings,
    pick_export_folder, reset_settings, save_settings, scan_for_device, update_last_import,
    validate_export_path,
};

use device::monitor::DeviceMonitor;

#[cfg(target_os = "macos")]
#[tauri::command]
fn show_about(_app: tauri::AppHandle) {
    use dispatch2::Queue;
    use objc2::msg_send;
    use objc2_app_kit::NSApplication;
    use objc2_foundation::MainThreadMarker;

    // Dispatch to main thread to safely interact with AppKit
    Queue::main().exec_async(|| {
        unsafe {
            // We are on the main thread, so we can create the marker unchecked safely
            let mtm = MainThreadMarker::new_unchecked();
            let app = NSApplication::sharedApplication(mtm);
            let _: () = msg_send![&app, orderFrontStandardAboutPanel: &*app];
        }
    });
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn show_about(_app: tauri::AppHandle) {
    // No-op on other platforms or show a custom dialog
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    if let Err(e) = utils::logger::init() {
        eprintln!("Failed to initialize logger: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_for_device,
            import_highlights,
            export_books,
            get_export_preview,
            get_default_export_path,
            validate_export_path,
            load_settings,
            save_settings,
            update_last_import,
            reset_settings,
            pick_export_folder,
            show_about
        ])
        .setup(|app| {
            // Start device monitoring
            let app_handle = app.handle().clone();
            let monitor = DeviceMonitor::new(app_handle);
            monitor.start_monitoring();
            
            log::info!("Application started with device monitoring enabled");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
