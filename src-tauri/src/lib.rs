pub mod commands;
pub mod covers;
pub mod db;
pub mod device;
pub mod export;
pub mod library;
pub mod models;
pub mod settings;
pub mod utils;
pub mod window;

use device::monitor::DeviceMonitor;
use device::monitor::{DeviceDetectedEvent, DeviceDisconnectedEvent};
use tauri_specta::{collect_commands, collect_events, Builder};

/// Where the generated TypeScript bindings live, relative to `src-tauri/`.
pub const BINDINGS_PATH: &str = "../src/lib/bindings.ts";

/// Single source of truth for the commands and events shared with the frontend.
/// Used both to serve IPC calls and to generate `src/lib/bindings.ts`.
pub fn specta_builder() -> Builder<tauri::Wry> {
    Builder::<tauri::Wry>::new().commands(collect_commands![
        commands::scan_for_device,
        commands::import_highlights,
        commands::export_books,
        commands::get_export_preview,
        commands::get_default_export_path,
        commands::get_default_settings,
        commands::validate_export_path,
        commands::load_settings,
        commands::save_settings,
        commands::update_last_import,
        commands::reset_settings,
        commands::pick_export_folder,
        commands::clear_cover_cache,
    ])
    .events(collect_events![DeviceDetectedEvent, DeviceDisconnectedEvent])
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    if let Err(e) = utils::logger::init() {
        eprintln!("Failed to initialize logger: {}", e);
    }

    let builder = specta_builder();

    #[cfg(debug_assertions)]
    builder
        .export(specta_typescript::Typescript::default(), BINDINGS_PATH)
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            // Register typed events before anything emits them
            builder.mount_events(app);

            // Show window only after frontend signals ready (prevents white flash)
            window::setup_window_show(app);

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

#[cfg(test)]
mod bindings_tests {
    use super::*;
    use std::path::Path;

    /// Fails when `src/lib/bindings.ts` no longer matches the Rust commands and types.
    /// Regenerate with: `UPDATE_BINDINGS=1 cargo test bindings_are_up_to_date`
    #[test]
    fn bindings_are_up_to_date() {
        let committed = Path::new(env!("CARGO_MANIFEST_DIR")).join(BINDINGS_PATH);

        if std::env::var_os("UPDATE_BINDINGS").is_some() {
            specta_builder()
                .export(specta_typescript::Typescript::default(), &committed)
                .expect("Failed to export typescript bindings");
            return;
        }

        let dir = tempfile::TempDir::new().unwrap();
        let fresh = dir.path().join("bindings.ts");
        specta_builder()
            .export(specta_typescript::Typescript::default(), &fresh)
            .expect("Failed to export typescript bindings");

        let expected = std::fs::read_to_string(&fresh).unwrap();
        let actual = std::fs::read_to_string(&committed).unwrap_or_default();
        assert!(
            actual == expected,
            "src/lib/bindings.ts is out of date. Run: UPDATE_BINDINGS=1 cargo test bindings_are_up_to_date"
        );
    }
}
