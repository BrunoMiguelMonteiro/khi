pub mod commands;
pub mod covers;
pub mod db;
pub mod device;
pub mod export;
pub mod models;
pub mod settings;
pub mod utils;

use commands::{
    clear_cover_cache, export_books, get_default_export_path, get_default_settings,
    get_export_preview, import_highlights, load_settings, pick_export_folder, reset_settings,
    save_settings, scan_for_device, update_last_import, validate_export_path,
};

use device::monitor::DeviceMonitor;

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
            get_default_settings,
            validate_export_path,
            load_settings,
            save_settings,
            update_last_import,
            reset_settings,
            pick_export_folder,
            clear_cover_cache
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
