pub mod models;
pub mod db;
pub mod covers;
pub mod device;
pub mod export;
pub mod commands;
pub mod settings;
pub mod utils;

use commands::{scan_for_device, import_highlights, export_books, get_export_preview, get_default_export_path, validate_export_path, load_settings, save_settings, update_last_import, reset_settings};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    if let Err(e) = utils::logger::init() {
        eprintln!("Failed to initialize logger: {}", e);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
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
            reset_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
