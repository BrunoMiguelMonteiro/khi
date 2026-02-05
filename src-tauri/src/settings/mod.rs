//! Settings management module for Khi
//!
//! This module provides persistent storage for user preferences including:
//! - Export configuration (path, metadata options, date format)
//! - UI preferences (theme, window size/position)
//! - Last import/export records

use crate::models::{DateFormat, ExportConfig, MetadataConfig};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Application settings structure
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Export configuration
    #[serde(alias = "export_config")]
    pub export_config: ExportConfig,
    /// UI preferences
    #[serde(alias = "ui_preferences")]
    pub ui_preferences: UiPreferences,
    /// Last import record
    #[serde(default, alias = "last_import")]
    pub last_import: Option<LastImportRecord>,
    /// Version for migration support
    pub version: String,
}

/// UI preferences
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct UiPreferences {
    /// Theme preference
    pub theme: ThemePreference,
    /// Window width
    #[serde(alias = "window_width")]
    pub window_width: u32,
    /// Window height
    #[serde(alias = "window_height")]
    pub window_height: u32,
    /// Whether window is maximized
    #[serde(alias = "is_maximized")]
    pub is_maximized: bool,
    /// Whether to show onboarding on startup
    #[serde(alias = "show_onboarding")]
    pub show_onboarding: bool,
    /// Library view mode (grid or list)
    #[serde(alias = "library_view_mode")]
    pub library_view_mode: ViewMode,
    /// Sort preference for library
    #[serde(alias = "library_sort")]
    pub library_sort: SortPreference,
}

/// Theme preference
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ThemePreference {
    #[default]
    System,
    #[serde(alias = "light")]
    Light,
    #[serde(alias = "dark")]
    Dark,
}

/// View mode for library
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ViewMode {
    #[default]
    #[serde(alias = "grid")]
    Grid,
    #[serde(alias = "list")]
    List,
}

/// Sort preference for library
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "snake_case")]
pub enum SortPreference {
    #[default]
    #[serde(alias = "title")]
    Title,
    #[serde(alias = "author")]
    Author,
    #[serde(alias = "date_last_read")]
    DateLastRead,
    #[serde(alias = "highlight_count")]
    HighlightCount,
}

/// Last import record
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LastImportRecord {
    /// Timestamp of the import
    pub timestamp: String,
    /// Device ID (if available)
    #[serde(alias = "device_id")]
    pub device_id: Option<String>,
    /// Number of books imported
    #[serde(alias = "books_count")]
    pub books_count: usize,
    /// Number of highlights imported
    #[serde(alias = "highlights_count")]
    pub highlights_count: usize,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            export_config: ExportConfig::default(),
            ui_preferences: UiPreferences::default(),
            last_import: None,
            version: env!("CARGO_PKG_VERSION").to_string(),
        }
    }
}

impl Default for UiPreferences {
    fn default() -> Self {
        Self {
            theme: ThemePreference::System,
            window_width: 1200,
            window_height: 800,
            is_maximized: false,
            show_onboarding: true,
            library_view_mode: ViewMode::Grid,
            library_sort: SortPreference::Title,
        }
    }
}

impl Default for ExportConfig {
    fn default() -> Self {
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        Self {
            export_path: format!("{}/Documents/Kobo Highlights", home),
            metadata: MetadataConfig::default(),
            date_format: DateFormat::DdMonthYyyy,
        }
    }
}

impl Default for MetadataConfig {
    fn default() -> Self {
        Self {
            author: true,
            isbn: true,
            publisher: true,
            date_last_read: true,
            language: true,
            description: false,
        }
    }
}

/// Settings manager for loading, saving, and accessing settings
pub struct SettingsManager {
    pub settings: AppSettings,
    config_path: PathBuf,
}

impl SettingsManager {
    /// Create a new SettingsManager with the default config path
    pub fn new() -> Result<Self, SettingsError> {
        let config_dir = Self::get_config_dir()?;
        let config_path = config_dir.join("settings.json");
        Self::with_path(config_path)
    }

    /// Create a SettingsManager with a custom config path (useful for testing)
    pub fn with_path(config_path: PathBuf) -> Result<Self, SettingsError> {
        let settings = if config_path.exists() {
            // Use fallback to handle corrupted settings gracefully
            Self::load_with_fallback(&config_path)?
        } else {
            AppSettings::default()
        };

        Ok(Self {
            settings,
            config_path,
        })
    }

    /// Get the configuration directory path
    fn get_config_dir() -> Result<PathBuf, SettingsError> {
        let home = std::env::var("HOME").map_err(|_| SettingsError::HomeNotFound)?;
        let config_dir =
            PathBuf::from(home).join("Library/Application Support/KoboHighlightsExporter");

        // Create directory if it doesn't exist
        if !config_dir.exists() {
            fs::create_dir_all(&config_dir).map_err(SettingsError::IoError)?;
        }

        Ok(config_dir)
    }

    /// Load settings from a file
    /// If parsing fails, returns error with path information for debugging
    fn load_from_file(path: &Path) -> Result<AppSettings, SettingsError> {
        let content = fs::read_to_string(path).map_err(SettingsError::IoError)?;

        let settings: AppSettings =
            serde_json::from_str(&content).map_err(SettingsError::ParseError)?;

        Ok(settings)
    }

    /// Load settings with fallback to defaults on parse error
    /// Logs the error and path for debugging, but allows app to continue
    fn load_with_fallback(path: &Path) -> Result<AppSettings, SettingsError> {
        let content = fs::read_to_string(path).map_err(SettingsError::IoError)?;

        match serde_json::from_str::<AppSettings>(&content) {
            Ok(settings) => Ok(settings),
            Err(e) => {
                eprintln!(
                    "Warning: Failed to parse settings file at {}: {}. Using defaults.",
                    path.display(),
                    e
                );
                // Backup the corrupted file for inspection
                let backup_path = path.with_extension("json.corrupted");
                let _ = fs::copy(path, &backup_path);
                Ok(AppSettings::default())
            }
        }
    }

    /// Save settings to disk with multiple layers of protection against corruption
    ///
    /// Protection layers:
    /// 1. Pre-validation: Verify JSON is valid before writing
    /// 2. Backup: Keep previous version before overwrite
    /// 3. Atomic write: Write to temp file, then rename (prevents partial writes)
    /// 4. Post-validation: Read back and verify integrity
    /// 5. Retry with backoff: If write fails, retry up to 3 times
    pub fn save(&self) -> Result<(), SettingsError> {
        let content =
            serde_json::to_string_pretty(&self.settings).map_err(SettingsError::SerializeError)?;

        // Layer 1: Pre-validation - verify the JSON we're about to write is valid
        if let Err(e) = serde_json::from_str::<AppSettings>(&content) {
            log::error!("Settings serialization produced invalid JSON: {}", e);
            return Err(SettingsError::SerializeError(e));
        }

        // Layer 2: Backup previous version (if exists and is valid)
        if self.config_path.exists() {
            let backup_path = self.config_path.with_extension("json.backup");
            if let Err(e) = fs::copy(&self.config_path, &backup_path) {
                log::warn!("Failed to create settings backup: {}", e);
            }
        }

        // Layer 3 & 5: Atomic write with retry
        let temp_path = self.config_path.with_extension("json.tmp");
        let mut last_error = None;

        for attempt in 1..=3 {
            // Write to temp file
            if let Err(e) = fs::write(&temp_path, &content) {
                log::warn!("Settings write attempt {} failed: {}", attempt, e);
                last_error = Some(e);
                if attempt < 3 {
                    std::thread::sleep(std::time::Duration::from_millis(100 * attempt as u64));
                    continue;
                }
                break;
            }

            // Atomic rename
            if let Err(e) = fs::rename(&temp_path, &self.config_path) {
                log::warn!("Settings rename attempt {} failed: {}", attempt, e);
                last_error = Some(e);
                if attempt < 3 {
                    std::thread::sleep(std::time::Duration::from_millis(100 * attempt as u64));
                    continue;
                }
                break;
            }

            // Layer 4: Post-validation - verify what we wrote is readable
            match Self::load_from_file(&self.config_path) {
                Ok(verified_settings) => {
                    if verified_settings.version == self.settings.version {
                        log::debug!(
                            "Settings saved and verified successfully (attempt {})",
                            attempt
                        );
                        return Ok(());
                    } else {
                        log::warn!(
                            "Settings verification failed: version mismatch on attempt {}",
                            attempt
                        );
                    }
                }
                Err(e) => {
                    log::warn!(
                        "Settings verification read failed on attempt {}: {}",
                        attempt,
                        e
                    );
                }
            }

            if attempt < 3 {
                std::thread::sleep(std::time::Duration::from_millis(100 * attempt as u64));
            }
        }

        // All attempts failed - restore from backup if available
        log::error!(
            "All 3 attempts to save settings failed. Last error: {:?}",
            last_error
        );

        let backup_path = self.config_path.with_extension("json.backup");
        if backup_path.exists() {
            log::info!("Attempting to restore settings from backup...");
            if let Err(e) = fs::copy(&backup_path, &self.config_path) {
                log::error!("Failed to restore from backup: {}", e);
            }
        }

        Err(SettingsError::IoError(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("Failed to save settings after 3 attempts: {:?}", last_error),
        )))
    }

    /// Get a reference to the current settings
    pub fn get(&self) -> &AppSettings {
        &self.settings
    }

    /// Get a mutable reference to the current settings
    pub fn get_mut(&mut self) -> &mut AppSettings {
        &mut self.settings
    }

    /// Update the export configuration
    pub fn set_export_config(&mut self, config: ExportConfig) -> Result<(), SettingsError> {
        self.settings.export_config = config;
        self.save()
    }

    /// Update UI preferences
    pub fn set_ui_preferences(&mut self, prefs: UiPreferences) -> Result<(), SettingsError> {
        self.settings.ui_preferences = prefs;
        self.save()
    }

    /// Update the last import record
    pub fn set_last_import(&mut self, record: LastImportRecord) -> Result<(), SettingsError> {
        self.settings.last_import = Some(record);
        self.save()
    }

    /// Reset settings to defaults
    pub fn reset_to_defaults(&mut self) -> Result<(), SettingsError> {
        self.settings = AppSettings::default();
        self.save()
    }

    /// Get the config file path
    pub fn config_path(&self) -> &Path {
        &self.config_path
    }
}

/// Settings-related errors
#[derive(Debug)]
pub enum SettingsError {
    /// Home directory not found
    HomeNotFound,
    /// IO error
    IoError(std::io::Error),
    /// Parse error
    ParseError(serde_json::Error),
    /// Serialize error
    SerializeError(serde_json::Error),
}

impl std::fmt::Display for SettingsError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SettingsError::HomeNotFound => write!(f, "Home directory not found"),
            SettingsError::IoError(e) => write!(f, "IO error: {}", e),
            SettingsError::ParseError(e) => write!(f, "Parse error: {}", e),
            SettingsError::SerializeError(e) => write!(f, "Serialize error: {}", e),
        }
    }
}

impl std::error::Error for SettingsError {}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_default_app_settings() {
        let settings = AppSettings::default();

        assert!(!settings.export_config.export_path.is_empty());
        assert!(settings.export_config.metadata.author);
        assert!(settings.ui_preferences.show_onboarding);
        assert_eq!(settings.ui_preferences.theme, ThemePreference::System);
        assert_eq!(settings.ui_preferences.library_view_mode, ViewMode::Grid);
        assert!(settings.last_import.is_none());
    }

    #[test]
    fn test_settings_manager_with_custom_path() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        let manager = SettingsManager::with_path(config_path.clone()).unwrap();

        assert_eq!(manager.config_path(), config_path);
        assert!(manager.get().export_config.metadata.author);
    }

    #[test]
    fn test_settings_save_and_load() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        // Create and save settings
        {
            let mut manager = SettingsManager::with_path(config_path.clone()).unwrap();
            manager.settings.export_config.metadata.author = false;
            manager.settings.ui_preferences.theme = ThemePreference::Dark;
            manager.save().unwrap();
        }

        // Load settings
        {
            let manager = SettingsManager::with_path(config_path).unwrap();
            assert!(!manager.get().export_config.metadata.author);
            assert_eq!(manager.get().ui_preferences.theme, ThemePreference::Dark);
        }
    }

    #[test]
    fn test_set_export_config() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        let mut manager = SettingsManager::with_path(config_path).unwrap();

        let new_config = ExportConfig {
            export_path: "/custom/path".to_string(),
            metadata: MetadataConfig {
                author: false,
                isbn: true,
                publisher: false,
                date_last_read: false,
                language: false,
                description: true,
            },
            date_format: DateFormat::Iso8601,
        };

        manager.set_export_config(new_config.clone()).unwrap();

        assert_eq!(manager.get().export_config.export_path, "/custom/path");
        assert!(!manager.get().export_config.metadata.author);
        assert!(manager.get().export_config.metadata.description);
    }

    #[test]
    fn test_set_ui_preferences() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        let mut manager = SettingsManager::with_path(config_path).unwrap();

        let new_prefs = UiPreferences {
            theme: ThemePreference::Light,
            window_width: 1920,
            window_height: 1080,
            is_maximized: true,
            show_onboarding: false,
            library_view_mode: ViewMode::List,
            library_sort: SortPreference::Author,
        };

        manager.set_ui_preferences(new_prefs).unwrap();

        assert_eq!(manager.get().ui_preferences.theme, ThemePreference::Light);
        assert_eq!(manager.get().ui_preferences.window_width, 1920);
        assert!(manager.get().ui_preferences.is_maximized);
        assert!(!manager.get().ui_preferences.show_onboarding);
        assert_eq!(
            manager.get().ui_preferences.library_view_mode,
            ViewMode::List
        );
    }

    #[test]
    fn test_set_last_import() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        let mut manager = SettingsManager::with_path(config_path).unwrap();

        let record = LastImportRecord {
            timestamp: "2025-01-29T14:00:00Z".to_string(),
            device_id: Some("Kobo123".to_string()),
            books_count: 5,
            highlights_count: 42,
        };

        manager.set_last_import(record.clone()).unwrap();

        let saved_record = manager.get().last_import.as_ref().unwrap();
        assert_eq!(saved_record.timestamp, "2025-01-29T14:00:00Z");
        assert_eq!(saved_record.device_id, Some("Kobo123".to_string()));
        assert_eq!(saved_record.books_count, 5);
        assert_eq!(saved_record.highlights_count, 42);
    }

    #[test]
    fn test_reset_to_defaults() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        let mut manager = SettingsManager::with_path(config_path).unwrap();

        // Modify settings
        manager.settings.export_config.metadata.author = false;
        manager.settings.ui_preferences.theme = ThemePreference::Dark;
        manager.settings.last_import = Some(LastImportRecord {
            timestamp: "2025-01-29".to_string(),
            device_id: None,
            books_count: 1,
            highlights_count: 1,
        });

        // Reset
        manager.reset_to_defaults().unwrap();

        // Verify defaults restored
        assert!(manager.get().export_config.metadata.author);
        assert_eq!(manager.get().ui_preferences.theme, ThemePreference::System);
        assert!(manager.get().last_import.is_none());
    }

    #[test]
    fn test_theme_preference_serialization() {
        let theme = ThemePreference::Dark;
        let json = serde_json::to_string(&theme).unwrap();
        assert_eq!(json, "\"dark\"");

        let deserialized: ThemePreference = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, ThemePreference::Dark);
    }

    #[test]
    fn test_view_mode_serialization() {
        let view_mode = ViewMode::List;
        let json = serde_json::to_string(&view_mode).unwrap();
        assert_eq!(json, "\"list\"");

        let deserialized: ViewMode = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, ViewMode::List);
    }

    #[test]
    fn test_sort_preference_serialization() {
        let sort = SortPreference::HighlightCount;
        let json = serde_json::to_string(&sort).unwrap();
        assert_eq!(json, "\"highlight_count\"");

        let deserialized: SortPreference = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized, SortPreference::HighlightCount);
    }

    #[test]
    fn test_full_settings_serialization() {
        let settings = AppSettings::default();
        let json = serde_json::to_string_pretty(&settings).unwrap();

        // Verify it can be deserialized back
        let deserialized: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(settings, deserialized);
    }

    #[test]
    fn test_invalid_json_recovery() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        // Write invalid JSON
        fs::write(&config_path, "not valid json").unwrap();

        // With 5-layer protection, invalid JSON should be automatically recovered
        // Returns default settings instead of error
        let result = SettingsManager::with_path(config_path);
        assert!(result.is_ok());

        let settings_manager = result.unwrap();
        // Verify we got default settings
        assert_eq!(
            settings_manager.settings.ui_preferences.theme,
            ThemePreference::System
        );
        assert!(settings_manager.settings.ui_preferences.show_onboarding);
    }

    #[test]
    fn test_metadata_config_default() {
        let config = MetadataConfig::default();

        assert!(config.author);
        assert!(config.isbn);
        assert!(config.publisher);
        assert!(config.date_last_read);
        assert!(config.language);
        assert!(!config.description);
    }

    #[test]
    fn test_export_config_default() {
        let config = ExportConfig::default();

        assert!(config.export_path.contains("Documents"));
        assert!(config.export_path.contains("Kobo Highlights"));
        assert!(config.metadata.author);
        assert_eq!(config.date_format, DateFormat::DdMonthYyyy);
    }

    #[test]
    fn test_frontend_payload_deserialization() {
        // This JSON represents exactly what the Frontend sends (based on our analysis)
        let json_payload = r#"{
            "exportConfig": {
                "exportPath": "~/Documents/Kobo Highlights",
                "metadata": {
                    "author": true,
                    "isbn": true,
                    "publisher": true,
                    "dateLastRead": true,
                    "language": true,
                    "description": false
                },
                "dateFormat": "dd_month_yyyy"
            },
            "uiPreferences": {
                "theme": "system",
                "windowWidth": 1200,
                "windowHeight": 800,
                "isMaximized": false,
                "showOnboarding": true,
                "libraryViewMode": "grid",
                "librarySort": "date_last_read"
            },
            "version": "0.1.0"
        }"#;

        // Try to deserialize
        let result: Result<AppSettings, _> = serde_json::from_str(json_payload);

        match result {
            Ok(_) => println!("Deserialization successful!"),
            Err(e) => panic!("Deserialization failed: {}", e),
        }
    }
}
