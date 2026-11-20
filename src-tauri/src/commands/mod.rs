pub mod library;

use crate::device::DeviceDetector;
use crate::covers::CoverExtractor;
use crate::models::KoboDevice;
use crate::settings::{AppSettings, SettingsManager, SettingsPatch};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

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

/// One write of the settings file at a time: each reads the file, applies
/// its patch and saves it, so two windows saving together keep both changes.
static SETTINGS_WRITE: Mutex<()> = Mutex::new(());

/// Writes `patch` over the settings file as it is now and returns the result.
/// Every window follows it through `settings-changed` (the main one and Settings).
#[tauri::command]
#[specta::specta]
pub async fn update_settings(
    app: tauri::AppHandle,
    patch: SettingsPatch,
) -> Result<AppSettings, String> {
    // Off the main thread: a save can retry for a few hundred ms
    tauri::async_runtime::spawn_blocking(move || {
        update_settings_with(settings_manager, patch, |saved| {
            if let Err(e) = app.emit("settings-changed", saved) {
                log::error!("Failed to emit settings-changed: {}", e);
            }
        })
    })
    .await
    .map_err(|e| format!("Settings task failed: {}", e))?
}

/// Under the lock: opens the file, applies `patch`, saves, then calls
/// `notify` with what was saved. A failed save notifies nothing.
fn update_settings_with(
    open: impl FnOnce() -> Result<SettingsManager, String>,
    patch: SettingsPatch,
    notify: impl FnOnce(&AppSettings),
) -> Result<AppSettings, String> {
    let _write = SETTINGS_WRITE.lock().unwrap_or_else(|e| e.into_inner());
    let mut manager = open()?;
    patch.apply_to(manager.get_mut());
    manager
        .save()
        .map_err(|e| format!("Failed to save settings: {}", e))?;
    let saved = manager.get().clone();
    // Still under the lock: the events arrive in the order of the writes
    notify(&saved);
    Ok(saved)
}

/// Reset settings to defaults
#[tauri::command]
#[specta::specta]
pub fn reset_settings() -> Result<AppSettings, String> {
    let _write = SETTINGS_WRITE.lock().unwrap_or_else(|e| e.into_inner());
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
    fn patches_from_both_windows_survive() {
        let dir = tempfile::TempDir::new().unwrap();
        let open = || Ok(temp_manager(&dir));

        // The main window changes the sort, then Settings the theme
        let sort = SettingsPatch {
            library_sort: Some(crate::settings::SortPreference::Author),
            ..Default::default()
        };
        update_settings_with(open, sort, |_| {}).unwrap();
        let theme = SettingsPatch {
            theme: Some(crate::settings::ThemePreference::Dark),
            ..Default::default()
        };
        let saved = update_settings_with(open, theme, |_| {}).unwrap();

        let file = temp_manager(&dir).get().clone();
        assert_eq!(file, saved);
        assert_eq!(file.ui_preferences.library_sort, crate::settings::SortPreference::Author);
        assert_eq!(file.ui_preferences.theme, crate::settings::ThemePreference::Dark);
        // What no patch named is the file's, untouched
        let mut expected = AppSettings::default();
        expected.ui_preferences.library_sort = crate::settings::SortPreference::Author;
        expected.ui_preferences.theme = crate::settings::ThemePreference::Dark;
        expected.language = file.language;
        assert_eq!(file, expected);
    }

    #[test]
    fn patch_sets_every_leaf_it_names() {
        let mut settings = AppSettings::default();
        let metadata = crate::models::MetadataConfig {
            author: false,
            isbn: false,
            publisher: false,
            date_last_read: false,
            language: false,
            description: true,
        };
        SettingsPatch {
            export_path: Some("/tmp/out".into()),
            metadata: Some(metadata.clone()),
            date_format: Some(crate::models::DateFormat::Iso8601),
            language: Some(crate::models::Language::Pt),
            theme: Some(crate::settings::ThemePreference::Light),
            library_view_mode: Some(crate::settings::ViewMode::List),
            library_sort: Some(crate::settings::SortPreference::HighlightCount),
            library_sort_reversed: Some(true),
            sync_on_connect: Some(false),
            check_for_updates: Some(false),
        }
        .apply_to(&mut settings);

        assert_eq!(settings.export_config.export_path, "/tmp/out");
        assert_eq!(settings.export_config.metadata, metadata);
        assert_eq!(settings.export_config.date_format, crate::models::DateFormat::Iso8601);
        assert_eq!(settings.language, crate::models::Language::Pt);
        assert_eq!(settings.ui_preferences.theme, crate::settings::ThemePreference::Light);
        assert_eq!(settings.ui_preferences.library_view_mode, crate::settings::ViewMode::List);
        assert!(settings.ui_preferences.library_sort_reversed);
        assert_eq!(
            settings.ui_preferences.library_sort,
            crate::settings::SortPreference::HighlightCount
        );
        assert!(!settings.ui_preferences.sync_on_connect);
        assert!(!settings.ui_preferences.check_for_updates);
        // Window size is never in a patch
        assert_eq!(settings.ui_preferences.window_width, AppSettings::default().ui_preferences.window_width);
    }

    #[test]
    fn failed_patch_does_not_notify() {
        let dir = tempfile::TempDir::new().unwrap();
        let theme = SettingsPatch {
            theme: Some(crate::settings::ThemePreference::Dark),
            ..Default::default()
        };

        let mut announced = Vec::new();
        update_settings_with(|| Ok(temp_manager(&dir)), theme.clone(), |saved| {
            // Saved by now: the event never runs ahead of the file
            assert_eq!(temp_manager(&dir).get(), saved);
            announced.push(saved.clone());
        })
        .unwrap();
        assert_eq!(announced.len(), 1);
        assert_eq!(announced[0].ui_preferences.theme, crate::settings::ThemePreference::Dark);

        // A folder that cannot be created (its parent is a file): no event
        let blocker = dir.path().join("not-a-folder");
        std::fs::write(&blocker, "").unwrap();
        let broken = || Ok(SettingsManager::with_path(blocker.join("settings.json")).unwrap());
        let mut failed = 0;
        let result = update_settings_with(broken, theme, |_| failed += 1);
        assert!(result.is_err());
        assert_eq!(failed, 0);
    }

    #[test]
    fn test_reset_settings() {
        let dir = tempfile::TempDir::new().unwrap();
        let mut changed = temp_manager(&dir);
        changed.get_mut().ui_preferences.theme = crate::settings::ThemePreference::Dark;
        changed.save().unwrap();

        let settings = reset_settings_with(temp_manager(&dir)).unwrap();

        assert_eq!(settings, AppSettings::default());
        assert_eq!(temp_manager(&dir).get(), &AppSettings::default());
    }
}
