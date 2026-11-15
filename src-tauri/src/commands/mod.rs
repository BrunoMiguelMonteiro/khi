pub mod library;

use crate::device::DeviceDetector;
use crate::covers::CoverExtractor;
use crate::models::KoboDevice;
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
