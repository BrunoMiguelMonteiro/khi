pub mod library;

use crate::db::kobo::KoboDatabase;
use crate::device::DeviceDetector;
use crate::export::MarkdownExporter;
use crate::covers::CoverExtractor;
use crate::models::{Book, ExportConfig, KoboDevice};
use crate::settings::{AppSettings, SettingsManager};
use std::path::PathBuf;
use tauri::Manager;

/// Scan for connected Kobo devices
#[tauri::command]
#[specta::specta]
pub fn scan_for_device() -> Result<Option<KoboDevice>, String> {
    // On macOS, volumes are mounted under /Volumes
    let volumes_path = PathBuf::from("/Volumes");
    let detector = DeviceDetector::new(volumes_path);

    match detector.scan_for_kobo() {
        Ok(device) => Ok(device),
        Err(e) => Err(format!("Failed to scan for devices: {}", e)),
    }
}

/// Import highlights from a connected Kobo device
#[tauri::command]
#[specta::specta]
pub fn import_highlights(app_handle: tauri::AppHandle, device: KoboDevice) -> Result<Vec<Book>, String> {
    // Get the database path from the device
    let volumes_path = PathBuf::from("/Volumes");
    let detector = DeviceDetector::new(volumes_path);

    log::info!("Importing highlights from device: {:?}", device);

    let db_path = detector.get_database_path(&device).ok_or_else(|| {
        log::error!("Could not find Kobo database at path: {}", device.path);
        "Could not find Kobo database".to_string()
    })?;

    log::info!("Database path: {:?}", db_path);

    // Open the database and extract books
    let db = KoboDatabase::open_read_only(&db_path).map_err(|e| {
        log::error!("Failed to open database: {}", e);
        format!("Failed to open database: {}", e)
    })?;

    log::info!("Database opened successfully");

    let started = std::time::Instant::now();
    let snapshot = db.read_snapshot().map_err(|e| {
        log::error!("Failed to extract highlights: {}", e);
        format!("Failed to extract highlights: {}", e)
    })?;
    log::info!(
        "Read Kobo snapshot in {} ms",
        started.elapsed().as_millis()
    );

    let mut books: Vec<Book> = snapshot.books.into_iter().map(Book::from).collect();
    books.sort_by(|a, b| a.title.cmp(&b.title));

    log::info!("Extracted {} books with highlights", books.len());

    // Extract covers
    let cache_dir = app_handle.path().app_cache_dir().map_err(|e| e.to_string())?;
    let extractor = CoverExtractor::new(cache_dir);

    for book in &mut books {
        if let Some(file_path) = &book.file_path {
            let epub_path = PathBuf::from(&device.path).join(file_path);
            
            if epub_path.exists() {
                if let Ok(Some(cover_path)) = extractor.extract_cover(&epub_path) {
                    book.cover_path = Some(cover_path.to_string_lossy().to_string());
                }
            }
        }
    }

    Ok(books)
}

/// Export books to markdown files
#[tauri::command]
#[specta::specta]
pub fn export_books(books: Vec<Book>, config: ExportConfig) -> Result<Vec<String>, String> {
    log::info!("[EXPORT RUST] ==========================================");
    log::info!("[EXPORT RUST] Comando export_books invocado");
    log::info!("[EXPORT RUST] Número de livros recebidos: {}", books.len());

    // Log detalhes de cada livro recebido
    for (i, book) in books.iter().enumerate() {
        log::info!(
            "[EXPORT RUST] Livro {}/{}: '{}' ({} highlights)",
            i + 1,
            books.len(),
            book.title,
            book.highlights.len()
        );
        log::info!("[EXPORT RUST]   - content_id: {}", book.content_id);
        log::info!("[EXPORT RUST]   - author: {}", book.author);
    }

    // Log config recebida
    log::info!("[EXPORT RUST] Config recebida:");
    log::info!("[EXPORT RUST]   - export_path: {}", config.export_path);
    log::info!("[EXPORT RUST]   - date_format: {:?}", config.date_format);
    log::info!(
        "[EXPORT RUST]   - metadata.author: {}",
        config.metadata.author
    );
    log::info!("[EXPORT RUST]   - metadata.isbn: {}", config.metadata.isbn);

    log::info!("[EXPORT RUST] A criar PathBuf...");
    let export_path = PathBuf::from(&config.export_path);
    log::info!("[EXPORT RUST] PathBuf criado: {:?}", export_path);

    log::info!("[EXPORT RUST] A criar MarkdownExporter...");
    let exporter = MarkdownExporter::new(export_path);
    log::info!("[EXPORT RUST] MarkdownExporter criado com sucesso");

    log::info!("[EXPORT RUST] A chamar exporter.export_books()...");
    let results = exporter.export_books(&books, &config);
    log::info!(
        "[EXPORT RUST] exporter.export_books() concluído - {} resultados",
        results.len()
    );

    let mut exported_files = Vec::new();
    for (i, result) in results.iter().enumerate() {
        match result {
            Ok(path) => {
                let path_str = path.to_string_lossy().to_string();
                log::info!("[EXPORT RUST] ✅ Livro {} exportado: {}", i, path_str);
                exported_files.push(path_str);
            }
            Err(e) => {
                log::error!("[EXPORT RUST] ❌ Erro no livro {}: {}", i, e);
                return Err(format!("Export failed: {}", e));
            }
        }
    }

    log::info!(
        "[EXPORT RUST] ✅ Exportação concluída com sucesso - {} ficheiros",
        exported_files.len()
    );
    log::info!("[EXPORT RUST] ==========================================");
    Ok(exported_files)
}

/// Get a preview of the markdown export for a single book
#[tauri::command]
#[specta::specta]
pub fn get_export_preview(book: Book, config: ExportConfig) -> Result<String, String> {
    let export_path = PathBuf::from(&config.export_path);
    let exporter = MarkdownExporter::new(export_path);

    // Generate the markdown content
    let markdown = exporter
        .export_book(&book, &config)
        .map_err(|e| format!("Failed to generate preview: {}", e))?;

    // Read the generated file
    let content =
        std::fs::read_to_string(&markdown).map_err(|e| format!("Failed to read preview: {}", e))?;

    // Clean up the temporary file
    let _ = std::fs::remove_file(&markdown);

    Ok(content)
}

/// Get the default export path
#[tauri::command]
#[specta::specta]
pub fn get_default_export_path() -> String {
    // Default to ~/Documents/Kobo Highlights
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    format!("{}/Documents/Kobo Highlights", home)
}

/// Validate if a path is valid for export
#[tauri::command]
#[specta::specta]
pub fn validate_export_path(path: String) -> Result<bool, String> {
    let path = PathBuf::from(path);

    // Check if parent directory exists
    if let Some(parent) = path.parent() {
        if !parent.exists() {
            return Ok(false);
        }
    }

    // Check if we can write to the directory
    match std::fs::metadata(&path) {
        Ok(metadata) => Ok(metadata.is_dir()),
        Err(_) => {
            // Path doesn't exist, check if we can create it
            if let Some(parent) = path.parent() {
                Ok(parent.exists())
            } else {
                Ok(false)
            }
        }
    }
}

fn settings_manager() -> Result<SettingsManager, String> {
    SettingsManager::new().map_err(|e| format!("Failed to initialize settings manager: {}", e))
}

/// Load application settings from disk
#[tauri::command]
#[specta::specta]
pub fn load_settings() -> Result<AppSettings, String> {
    let manager = SettingsManager::new().map_err(|e| format!("Failed to load settings: {}", e))?;

    Ok(manager.get().clone())
}

/// Get the default application settings
#[tauri::command]
#[specta::specta]
pub fn get_default_settings() -> AppSettings {
    AppSettings::default()
}

/// Save application settings to disk
#[tauri::command]
#[specta::specta]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    save_settings_with(settings_manager()?, settings)
}

fn save_settings_with(mut manager: SettingsManager, settings: AppSettings) -> Result<(), String> {
    // Update all settings fields
    *manager.get_mut() = settings;

    manager
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;

    Ok(())
}

/// Reset settings to defaults
#[tauri::command]
#[specta::specta]
pub fn reset_settings() -> Result<AppSettings, String> {
    reset_settings_with(settings_manager()?)
}

fn reset_settings_with(mut manager: SettingsManager) -> Result<AppSettings, String> {
    manager
        .reset_to_defaults()
        .map_err(|e| format!("Failed to reset settings: {}", e))?;

    Ok(manager.get().clone())
}

/// Open a folder picker dialog to select export directory
#[tauri::command]
#[specta::specta]
pub async fn pick_export_folder(app_handle: tauri::AppHandle, default_path: Option<String>) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    
    // Create the folder picker dialog
    let mut folder_dialog = app_handle.dialog().file();
    
    // Set it to pick a folder instead of a file
    folder_dialog = folder_dialog.set_can_create_directories(true);
    
    // Set starting directory if provided
    if let Some(path) = default_path {
        folder_dialog = folder_dialog.set_directory(std::path::PathBuf::from(path));
    }
    
    // Open the dialog and wait for user selection
    let result = folder_dialog.blocking_pick_folder();
    
    // Convert the result to a string path
    match result {
        Some(folder_path) => {
            let path_str = folder_path.as_path()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();
            Ok(Some(path_str))
        },
        None => Ok(None),
    }
}

/// Clear the application cover cache
#[tauri::command]
#[specta::specta]
pub fn clear_cover_cache(app_handle: tauri::AppHandle) -> Result<(), String> {
    let cache_dir = app_handle.path().app_cache_dir().map_err(|e| e.to_string())?;
    let extractor = CoverExtractor::new(cache_dir);
    
    extractor.clear_cache().map_err(|e| format!("Failed to clear cache: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{Book, DateFormat, ExportConfig, Highlight, MetadataConfig};

    fn create_test_book() -> Book {
        Book {
            content_id: "book1".to_string(),
            title: "Test Book".to_string(),
            author: "Test Author".to_string(),
            isbn: None,
            publisher: None,
            language: None,
            date_last_read: None,
            description: None,
            file_path: None,
            cover_path: None,
            highlights: vec![Highlight {
                id: "hl1".to_string(),
                text: "Test highlight".to_string(),
                annotation: None,
                chapter_title: None,
                chapter_progress: None,
                container_path: None,
                date_created: "2025-01-24".to_string(),
                color: None,
            }],
        }
    }

    fn create_test_config() -> ExportConfig {
        ExportConfig {
            export_path: "/tmp/test_export".to_string(),
            metadata: MetadataConfig {
                author: true,
                isbn: false,
                publisher: false,
                date_last_read: false,
                language: false,
                description: false,
            },
            date_format: DateFormat::DdMonthYyyy,
        }
    }

    #[test]
    fn test_get_default_export_path() {
        let path = get_default_export_path();
        assert!(path.contains("Documents"));
        assert!(path.contains("Kobo Highlights"));
    }

    #[test]
    fn test_validate_export_path_valid() {
        // Use temp directory which should always exist
        let temp_dir = std::env::temp_dir();
        let result = validate_export_path(temp_dir.to_string_lossy().to_string());
        assert!(result.is_ok());
        assert!(result.unwrap());
    }

    #[test]
    fn test_validate_export_path_invalid() {
        // Use a path that doesn't exist
        let result = validate_export_path("/nonexistent/path/that/does/not/exist".to_string());
        assert!(result.is_ok());
        assert!(!result.unwrap());
    }

    // Settings commands are tested through the `*_with` helpers so that no test
    // ever touches the real settings file in ~/Library/Application Support.
    fn temp_manager(dir: &tempfile::TempDir) -> SettingsManager {
        SettingsManager::with_path(dir.path().join("settings.json")).unwrap()
    }

    #[test]
    fn test_save_settings_roundtrip() {
        let dir = tempfile::TempDir::new().unwrap();
        let mut settings = AppSettings::default();
        settings.export_config.metadata.author = false;
        settings.ui_preferences.theme = crate::settings::ThemePreference::Dark;

        save_settings_with(temp_manager(&dir), settings.clone()).unwrap();

        assert_eq!(temp_manager(&dir).get(), &settings);
    }

    #[test]
    fn test_reset_settings() {
        let dir = tempfile::TempDir::new().unwrap();
        let mut changed = AppSettings::default();
        changed.ui_preferences.theme = crate::settings::ThemePreference::Dark;
        save_settings_with(temp_manager(&dir), changed).unwrap();

        let settings = reset_settings_with(temp_manager(&dir)).unwrap();

        assert_eq!(settings, AppSettings::default());
        assert_eq!(temp_manager(&dir).get(), &AppSettings::default());
    }
}
