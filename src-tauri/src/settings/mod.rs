//! Settings management module for Khi
//!
//! This module provides persistent storage for user preferences including:
//! - Export configuration (path, metadata options, date format)
//! - UI preferences (theme, window size/position)
//! - Last import/export records

use crate::models::{DateFormat, ExportConfig, Language, MetadataConfig};
use serde::{Deserialize, Deserializer, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

/// Application settings structure
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    /// Export configuration
    #[serde(alias = "export_config")]
    pub export_config: ExportConfig,
    /// UI preferences
    #[serde(alias = "ui_preferences")]
    pub ui_preferences: UiPreferences,
    /// Language of the interface and of the exported Markdown. A file
    /// without it, from before this setting, follows the system.
    #[serde(default = "system_language", deserialize_with = "language_or_system")]
    #[specta(type = Language)]
    pub language: Language,
    /// Version for migration support
    pub version: String,
}

/// UI preferences
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase")]
pub struct UiPreferences {
    /// Theme preference
    #[serde(deserialize_with = "or_default")]
    #[specta(type = ThemePreference)]
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
    #[serde(alias = "library_view_mode", deserialize_with = "or_default")]
    #[specta(type = ViewMode)]
    pub library_view_mode: ViewMode,
    /// Sort preference for library
    #[serde(
        alias = "library_sort",
        deserialize_with = "sort_or_default"
    )]
    #[specta(type = SortPreference)]
    pub library_sort: SortPreference,
    /// The sort runs against its natural direction (the column header was clicked on the active column)
    #[serde(default, alias = "library_sort_reversed")]
    pub library_sort_reversed: bool,
    /// Whether to sync automatically when a known Kobo is connected (R23).
    /// Old files stored it as `autoImportOnConnect`.
    #[serde(
        default = "default_true",
        alias = "autoImportOnConnect",
        alias = "auto_import_on_connect",
        alias = "sync_on_connect"
    )]
    pub sync_on_connect: bool,
    /// Whether to look for a new version once a day, when Khi opens.
    #[serde(default = "default_true")]
    pub check_for_updates: bool,
    /// The Settings pane that was open last, reopened with the window.
    #[serde(default, deserialize_with = "or_default")]
    #[specta(type = SettingsPane)]
    pub settings_pane: SettingsPane,
    /// The accent colour: the macOS one (`system`) or one of the seven swatches.
    #[serde(default, deserialize_with = "or_default")]
    #[specta(type = AccentChoice)]
    pub accent_color: AccentChoice,
}

/// A pane of the Settings window.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum SettingsPane {
    /// The first tab: where the window opens when no pane was stored.
    #[default]
    Kobo,
    Appearance,
    Export,
    Updates,
}

/// The accent colour chosen in Settings: Sistema follows macOS; the others are the swatches of
/// `design/accent-tones.json`, named as `SwatchName` in `src/lib/accent/accent.ts`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default, specta::Type)]
#[serde(rename_all = "kebab-case")]
pub enum AccentChoice {
    #[default]
    System,
    AzulTinta,
    VerdeFolha,
    Turquesa,
    Laranja,
    Amarelo,
    Rosa,
    Violeta,
}

fn default_true() -> bool {
    true
}

/// Reads a value, and takes the type's default when it is not one this build knows (a newer
/// build's name, a hand edit). A name nobody knows must not make the whole file unreadable: the
/// next save would then write the defaults over the export folder and everything else.
pub(crate) fn or_default<'de, D, T>(deserializer: D) -> Result<T, D::Error>
where
    D: Deserializer<'de>,
    T: serde::de::DeserializeOwned + Default,
{
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(serde_json::from_value(value).unwrap_or_default())
}

fn default_library_sort() -> SortPreference {
    SortPreference::DateLastRead
}

fn sort_or_default<'de, D: Deserializer<'de>>(deserializer: D) -> Result<SortPreference, D::Error> {
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(serde_json::from_value(value).unwrap_or_else(|_| default_library_sort()))
}

fn language_or_system<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Language, D::Error> {
    let value = serde_json::Value::deserialize(deserializer)?;
    Ok(serde_json::from_value(value).unwrap_or_else(|_| system_language()))
}

/// Theme preference
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, specta::Type)]
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
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, specta::Type)]
#[serde(rename_all = "snake_case")]
pub enum ViewMode {
    #[default]
    #[serde(alias = "grid")]
    Grid,
    #[serde(alias = "list")]
    List,
}

/// Sort preference for library
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default, specta::Type)]
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

/// What one window changes in the settings file: a field per leaf it edits,
/// left out when it is not changed. The rest of the file stays as it is, so
/// the main window (sort, view) and Settings never undo each other's saves.
///
/// Flat, named after the leaf (`theme` for `uiPreferences.theme`): every
/// leaf name is unique in `AppSettings`, and the bindings stay one level deep.
#[derive(Debug, Clone, Default, Deserialize, PartialEq, specta::Type)]
#[serde(rename_all = "camelCase", default)]
pub struct SettingsPatch {
    /// `exportConfig.exportPath`
    #[specta(optional)]
    pub export_path: Option<String>,
    /// `exportConfig.metadata`, the whole object
    #[specta(optional)]
    pub metadata: Option<MetadataConfig>,
    /// `exportConfig.dateFormat`
    #[specta(optional)]
    pub date_format: Option<DateFormat>,
    #[specta(optional)]
    pub language: Option<Language>,
    /// `uiPreferences.theme`
    #[specta(optional)]
    pub theme: Option<ThemePreference>,
    /// `uiPreferences.libraryViewMode`
    #[specta(optional)]
    pub library_view_mode: Option<ViewMode>,
    /// `uiPreferences.librarySort`
    #[specta(optional)]
    pub library_sort: Option<SortPreference>,
    /// `uiPreferences.librarySortReversed`
    #[specta(optional)]
    pub library_sort_reversed: Option<bool>,
    /// `uiPreferences.syncOnConnect`
    #[specta(optional)]
    pub sync_on_connect: Option<bool>,
    /// `uiPreferences.checkForUpdates`
    #[specta(optional)]
    pub check_for_updates: Option<bool>,
    /// `uiPreferences.settingsPane`
    #[specta(optional)]
    pub settings_pane: Option<SettingsPane>,
    /// `uiPreferences.accentColor`
    #[specta(optional)]
    pub accent_color: Option<AccentChoice>,
}

impl SettingsPatch {
    /// Writes the fields that are set over `settings`; the others are kept.
    pub fn apply_to(self, settings: &mut AppSettings) {
        let export = &mut settings.export_config;
        if let Some(path) = self.export_path {
            export.export_path = path;
        }
        if let Some(metadata) = self.metadata {
            export.metadata = metadata;
        }
        if let Some(format) = self.date_format {
            export.date_format = format;
        }
        if let Some(language) = self.language {
            settings.language = language;
        }
        let ui = &mut settings.ui_preferences;
        if let Some(theme) = self.theme {
            ui.theme = theme;
        }
        if let Some(mode) = self.library_view_mode {
            ui.library_view_mode = mode;
        }
        if let Some(sort) = self.library_sort {
            ui.library_sort = sort;
        }
        if let Some(reversed) = self.library_sort_reversed {
            ui.library_sort_reversed = reversed;
        }
        if let Some(enabled) = self.sync_on_connect {
            ui.sync_on_connect = enabled;
        }
        if let Some(enabled) = self.check_for_updates {
            ui.check_for_updates = enabled;
        }
        if let Some(pane) = self.settings_pane {
            ui.settings_pane = pane;
        }
        if let Some(accent) = self.accent_color {
            ui.accent_color = accent;
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            export_config: ExportConfig::default(),
            ui_preferences: UiPreferences::default(),
            language: system_language(),
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
            library_sort: SortPreference::DateLastRead,
            library_sort_reversed: false,
            sync_on_connect: true,
            check_for_updates: true,
            settings_pane: SettingsPane::default(),
            accent_color: AccentChoice::default(),
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

/// The Mac's first preferred language, if it is one Khi speaks; else English.
fn system_language() -> Language {
    std::process::Command::new("defaults")
        .args(["read", "-g", "AppleLanguages"])
        .output()
        .map(|out| language_from_apple_languages(&String::from_utf8_lossy(&out.stdout)))
        .unwrap_or(Language::En)
}

/// Reads the first entry of `defaults read -g AppleLanguages`, e.g.
/// `("en-US", "pt-PT")`, one entry per line.
fn language_from_apple_languages(output: &str) -> Language {
    let first = output
        .lines()
        .map(|line| line.trim().trim_matches(|c| c == '"' || c == ','))
        .find(|entry| !entry.is_empty() && *entry != "(" && *entry != ")");
    match first {
        Some(tag) => match tag.to_ascii_lowercase().get(..2) {
            Some("pt") => Language::Pt,
            Some("es") => Language::Es,
            Some("fr") => Language::Fr,
            _ => Language::En,
        },
        None => Language::En,
    }
}

/// The app identifier from the Tauri config, set once in `setup`.
static APP_IDENTIFIER: std::sync::OnceLock<String> = std::sync::OnceLock::new();

/// Records the app identifier; `data_dir` fails until this has run.
pub fn set_app_identifier(identifier: &str) {
    let _ = APP_IDENTIFIER.set(identifier.to_string());
}

/// Where `data_dir` lives under `home`. The `.dev` identifier (`npm run
/// dev:app` and the Khi Dev build) gets its own folder, so development never
/// touches the installed Khi's settings or Library. Without an identifier,
/// or in a debug build without the `.dev` one, there is no answer: it never
/// falls back to the real folder.
fn data_dir_for(home: &Path, identifier: Option<&str>, debug: bool) -> Result<PathBuf, SettingsError> {
    let identifier = identifier.ok_or(SettingsError::IdentifierUnknown)?;
    let folder = if identifier.ends_with(".dev") {
        "KoboHighlightsExporter Dev"
    } else if debug {
        return Err(SettingsError::DebugBuildNeedsDevIdentifier);
    } else {
        "KoboHighlightsExporter"
    };
    Ok(home.join("Library/Application Support").join(folder))
}

/// The Khi's data folder (`settings.json`, `library.sqlite`, `covers/`),
/// created if missing.
pub fn data_dir() -> Result<PathBuf, SettingsError> {
    let home = std::env::var("HOME").map_err(|_| SettingsError::HomeNotFound)?;
    let dir = data_dir_for(
        Path::new(&home),
        APP_IDENTIFIER.get().map(String::as_str),
        cfg!(debug_assertions),
    )?;
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(SettingsError::IoError)?;
    }
    Ok(dir)
}

/// The v2 settings file in `dir`. v1 writes `settings.json` in the same
/// folder and drops what it does not know, so v2 keeps its own file. On
/// the first v2 run it starts from a copy of v1's; v1's is never written.
fn settings_path_in(dir: &Path) -> PathBuf {
    let path = dir.join("settings-v2.json");
    let v1 = dir.join("settings.json");
    if !path.exists() && v1.exists() {
        if let Err(e) = fs::copy(&v1, &path) {
            log::warn!("Could not start from the v1 settings: {}", e);
        }
    }
    path
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
        Self::with_path(settings_path_in(&config_dir))
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
        data_dir()
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
    /// The app identifier was not recorded before asking for the data folder
    IdentifierUnknown,
    /// A debug build ran with the real identifier, which would open the real folder
    DebugBuildNeedsDevIdentifier,
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
            SettingsError::IdentifierUnknown => write!(f, "App identifier not known"),
            SettingsError::DebugBuildNeedsDevIdentifier => write!(
                f,
                "A debug build must run with the dev config so it never opens the real data folder: use `npm run dev:app`"
            ),
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

    fn settings_with_path(path: &str) -> AppSettings {
        let mut s = AppSettings::default();
        s.export_config.export_path = path.to_string();
        s
    }

    fn write(path: &Path, settings: &AppSettings) {
        fs::write(path, serde_json::to_string_pretty(settings).unwrap()).unwrap();
    }

    #[test]
    fn settings_without_language_keep_their_values() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings-v2.json");
        let mut old = serde_json::to_value(settings_with_path("/mine")).unwrap();
        old["uiPreferences"]["syncOnConnect"] = serde_json::json!(false);
        old.as_object_mut().unwrap().remove("language");
        fs::write(&path, serde_json::to_string_pretty(&old).unwrap()).unwrap();

        let manager = SettingsManager::with_path(path.clone()).unwrap();

        assert_eq!(manager.settings.export_config.export_path, "/mine");
        assert!(!manager.settings.ui_preferences.sync_on_connect);
        assert!(!path.with_extension("json.corrupted").exists());
    }

    #[test]
    fn chosen_language_survives_save() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("settings-v2.json");
        let mut manager = SettingsManager::with_path(path.clone()).unwrap();
        manager.settings.language = Language::Pt;
        manager.save().unwrap();

        assert_eq!(SettingsManager::with_path(path).unwrap().settings.language, Language::Pt);
    }

    #[test]
    fn system_language_is_the_first_preferred_language() {
        let en_first = "(\n    \"en-US\",\n    \"pt-PT\"\n)\n";
        let pt_first = "(\n    \"pt-PT\",\n    \"en-US\"\n)\n";
        assert_eq!(language_from_apple_languages(en_first), Language::En);
        assert_eq!(language_from_apple_languages(pt_first), Language::Pt);
        assert_eq!(language_from_apple_languages("(\n    pt,\n    en\n)\n"), Language::Pt);
        assert_eq!(language_from_apple_languages("(\n    \"pt-BR\"\n)\n"), Language::Pt);
        assert_eq!(language_from_apple_languages("(\n    \"fr-FR\",\n    \"pt-PT\"\n)\n"), Language::Fr);
        assert_eq!(language_from_apple_languages("(\n    \"fr-CA\"\n)\n"), Language::Fr);
        assert_eq!(language_from_apple_languages("(\n    \"es-ES\",\n    \"en-US\"\n)\n"), Language::Es);
        assert_eq!(language_from_apple_languages("(\n    \"es-419\"\n)\n"), Language::Es);
        // A language Khi does not speak: English
        assert_eq!(language_from_apple_languages("(\n    \"de-DE\",\n    \"pt-PT\"\n)\n"), Language::En);
        assert_eq!(language_from_apple_languages(""), Language::En);
    }

    #[test]
    fn v2_does_not_use_v1_settings_file() {
        let dir = TempDir::new().unwrap();

        let path = settings_path_in(dir.path());

        assert_eq!(path, dir.path().join("settings-v2.json"));
        assert!(!path.exists(), "nothing to copy, nothing written");
    }

    #[test]
    fn first_v2_run_starts_from_v1_settings() {
        let dir = TempDir::new().unwrap();
        let v1 = dir.path().join("settings.json");
        write(&v1, &settings_with_path("/v1/export"));
        let v1_before = fs::read(&v1).unwrap();

        let path = settings_path_in(dir.path());
        let mut manager = SettingsManager::with_path(path).unwrap();
        assert_eq!(manager.settings.export_config.export_path, "/v1/export");
        manager.settings.export_config.export_path = "/v2/export".to_string();
        manager.save().unwrap();

        assert_eq!(fs::read(&v1).unwrap(), v1_before, "v1's file is never written");
    }

    #[test]
    fn existing_v2_settings_are_not_replaced_by_v1() {
        let dir = TempDir::new().unwrap();
        write(&dir.path().join("settings.json"), &settings_with_path("/v1/export"));
        write(&dir.path().join("settings-v2.json"), &settings_with_path("/v2/export"));

        let manager = SettingsManager::with_path(settings_path_in(dir.path())).unwrap();

        assert_eq!(manager.settings.export_config.export_path, "/v2/export");
    }

    const DEV: Option<&str> = Some("com.bruno.khi.dev");
    const REAL: Option<&str> = Some("com.bruno.khi");
    const SUPPORT: &str = "/h/Library/Application Support/";

    #[test]
    fn dev_identifier_uses_the_dev_data_folder_in_any_build() {
        for debug in [true, false] {
            let dir = data_dir_for(Path::new("/h"), DEV, debug).unwrap();
            assert_eq!(dir, PathBuf::from(format!("{SUPPORT}KoboHighlightsExporter Dev")));
        }
    }

    #[test]
    fn release_build_with_the_real_identifier_uses_the_real_folder() {
        let dir = data_dir_for(Path::new("/h"), REAL, false).unwrap();
        assert_eq!(dir, PathBuf::from(format!("{SUPPORT}KoboHighlightsExporter")));
    }

    #[test]
    fn debug_build_without_the_dev_identifier_is_an_error_never_the_real_folder() {
        let result = data_dir_for(Path::new("/h"), REAL, true);
        assert!(matches!(result, Err(SettingsError::DebugBuildNeedsDevIdentifier)));
        assert!(result.unwrap_err().to_string().contains("npm run dev:app"));
    }

    #[test]
    fn unknown_identifier_is_an_error_never_the_real_folder() {
        for debug in [true, false] {
            assert!(matches!(
                data_dir_for(Path::new("/h"), None, debug),
                Err(SettingsError::IdentifierUnknown)
            ));
        }
        // Nothing in the test binary sets the identifier
        assert!(matches!(data_dir(), Err(SettingsError::IdentifierUnknown)));
    }

    use tempfile::TempDir;

    #[test]
    fn test_default_app_settings() {
        let settings = AppSettings::default();

        assert!(!settings.export_config.export_path.is_empty());
        assert!(settings.export_config.metadata.author);
        assert!(settings.ui_preferences.show_onboarding);
        assert_eq!(settings.ui_preferences.theme, ThemePreference::System);
        assert_eq!(settings.ui_preferences.library_view_mode, ViewMode::Grid);
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
            library_sort_reversed: false,
            sync_on_connect: false,
            check_for_updates: false,
            settings_pane: SettingsPane::Export,
            accent_color: AccentChoice::System,
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
    fn test_reset_to_defaults() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        let mut manager = SettingsManager::with_path(config_path).unwrap();

        // Modify settings
        manager.settings.export_config.metadata.author = false;
        manager.settings.ui_preferences.theme = ThemePreference::Dark;

        // Reset
        manager.reset_to_defaults().unwrap();

        // Verify defaults restored
        assert!(manager.get().export_config.metadata.author);
        assert_eq!(manager.get().ui_preferences.theme, ThemePreference::System);
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
    fn library_sort_reversed_defaults_false() {
        assert!(!UiPreferences::default().library_sort_reversed);
    }

    #[test]
    fn old_settings_without_reversed_load() {
        let json = r#"{
            "theme": "system",
            "windowWidth": 1200,
            "windowHeight": 800,
            "isMaximized": false,
            "showOnboarding": true,
            "libraryViewMode": "grid",
            "librarySort": "date_last_read"
        }"#;

        let prefs: UiPreferences = serde_json::from_str(json).unwrap();

        assert!(!prefs.library_sort_reversed);
    }

    #[test]
    fn patch_sets_reversed() {
        let mut settings = AppSettings::default();
        let patch: SettingsPatch = serde_json::from_str(r#"{"librarySortReversed": true}"#).unwrap();

        patch.apply_to(&mut settings);
        assert!(settings.ui_preferences.library_sort_reversed);

        SettingsPatch::default().apply_to(&mut settings);
        assert!(settings.ui_preferences.library_sort_reversed);
    }

    #[test]
    fn old_file_without_settings_pane_opens_on_kobo() {
        // A file from before the Settings window remembered its pane: it opens on the first tab, Kobo
        let json = r#"{
            "theme": "system",
            "windowWidth": 1200,
            "windowHeight": 800,
            "isMaximized": false,
            "showOnboarding": true,
            "libraryViewMode": "grid",
            "librarySort": "date_last_read"
        }"#;

        let prefs: UiPreferences = serde_json::from_str(json).unwrap();

        assert_eq!(prefs.settings_pane, SettingsPane::Kobo);
        assert_eq!(prefs.accent_color, AccentChoice::System);
        assert_eq!(UiPreferences::default().settings_pane, SettingsPane::Kobo);
    }

    #[test]
    fn unknown_enum_values_fall_back_without_losing_the_rest_of_the_file() {
        // A newer or hand-edited file: every enum holds a name this build does not know
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");
        fs::write(
            &config_path,
            r#"{
                "exportConfig": {
                    "exportPath": "/Volumes/Livros/Kobo",
                    "metadata": {"author": false, "isbn": true, "publisher": true, "dateLastRead": true, "language": true, "description": true},
                    "dateFormat": "sideways"
                },
                "uiPreferences": {
                    "theme": "sepia",
                    "windowWidth": 1111,
                    "windowHeight": 777,
                    "isMaximized": false,
                    "showOnboarding": false,
                    "libraryViewMode": "cover-flow",
                    "librarySort": "mood",
                    "settingsPane": "general",
                    "accentColor": "magenta"
                },
                "language": "fr",
                "version": "9.9.9"
            }"#,
        )
        .unwrap();

        let manager = SettingsManager::with_path(config_path.clone()).unwrap();
        let settings = manager.get();

        // The unknown names take the default; everything else stays
        assert_eq!(settings.export_config.export_path, "/Volumes/Livros/Kobo");
        assert!(!settings.export_config.metadata.author);
        assert!(settings.export_config.metadata.description);
        assert_eq!(settings.export_config.date_format, DateFormat::DdMonthYyyy);
        assert_eq!(settings.ui_preferences.theme, ThemePreference::System);
        assert_eq!(settings.ui_preferences.window_width, 1111);
        assert!(!settings.ui_preferences.show_onboarding);
        assert_eq!(settings.ui_preferences.library_view_mode, ViewMode::Grid);
        assert_eq!(settings.ui_preferences.library_sort, SortPreference::DateLastRead);
        assert_eq!(settings.ui_preferences.settings_pane, SettingsPane::Kobo);
        assert_eq!(settings.ui_preferences.accent_color, AccentChoice::System);
        assert_eq!(settings.version, "9.9.9");
        // No "corrupted" backup: the file was read, not discarded
        assert!(!config_path.with_extension("json.corrupted").exists());
    }

    #[test]
    fn settings_pane_and_accent_are_stored_by_name_and_survive_save() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        let mut manager = SettingsManager::with_path(config_path.clone()).unwrap();
        manager.settings.ui_preferences.settings_pane = SettingsPane::Kobo;
        manager.settings.ui_preferences.accent_color = AccentChoice::VerdeFolha;
        manager.save().unwrap();

        let saved = fs::read_to_string(&config_path).unwrap();
        assert!(saved.contains("\"settingsPane\": \"kobo\""), "{saved}");
        assert!(saved.contains("\"accentColor\": \"verde-folha\""), "{saved}");
        let reloaded = SettingsManager::with_path(config_path).unwrap();
        assert_eq!(reloaded.get().ui_preferences.settings_pane, SettingsPane::Kobo);
        assert_eq!(reloaded.get().ui_preferences.accent_color, AccentChoice::VerdeFolha);
    }

    #[test]
    fn patch_sets_settings_pane_and_accent_and_keeps_them_when_absent() {
        let mut settings = AppSettings::default();
        let patch: SettingsPatch =
            serde_json::from_str(r#"{"settingsPane": "appearance", "accentColor": "azul-tinta"}"#)
                .unwrap();

        patch.apply_to(&mut settings);
        assert_eq!(settings.ui_preferences.settings_pane, SettingsPane::Appearance);
        assert_eq!(settings.ui_preferences.accent_color, AccentChoice::AzulTinta);

        SettingsPatch::default().apply_to(&mut settings);
        assert_eq!(settings.ui_preferences.settings_pane, SettingsPane::Appearance);
        assert_eq!(settings.ui_preferences.accent_color, AccentChoice::AzulTinta);
    }

    #[test]
    fn old_file_auto_import_false_maps_to_sync_on_connect_false() {
        let json = r#"{
            "theme": "system",
            "windowWidth": 1200,
            "windowHeight": 800,
            "isMaximized": false,
            "showOnboarding": true,
            "libraryViewMode": "grid",
            "librarySort": "date_last_read",
            "autoImportOnConnect": false
        }"#;

        let prefs: UiPreferences = serde_json::from_str(json).unwrap();

        assert!(!prefs.sync_on_connect);
        let saved = serde_json::to_string(&prefs).unwrap();
        assert!(saved.contains("\"syncOnConnect\":false"));
        assert!(!saved.contains("autoImport"));
    }

    #[test]
    fn old_file_with_last_import_still_loads() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");
        let mut old = serde_json::to_value(AppSettings::default()).unwrap();
        old["lastImport"] = serde_json::json!({
            "timestamp": "2025-01-29T14:00:00Z",
            "deviceId": "Kobo123",
            "booksCount": 5,
            "highlightsCount": 42
        });
        old["uiPreferences"]["theme"] = serde_json::json!("dark");
        fs::write(&config_path, serde_json::to_string(&old).unwrap()).unwrap();

        let manager = SettingsManager::with_path(config_path).unwrap();

        assert_eq!(manager.get().ui_preferences.theme, ThemePreference::Dark);
    }

    #[test]
    fn test_sync_on_connect_defaults_to_true_for_old_files() {
        let json = r#"{
            "theme": "system",
            "windowWidth": 1200,
            "windowHeight": 800,
            "isMaximized": false,
            "showOnboarding": true,
            "libraryViewMode": "grid",
            "librarySort": "date_last_read"
        }"#;

        let prefs: UiPreferences = serde_json::from_str(json).unwrap();

        assert!(prefs.sync_on_connect);
        assert!(prefs.check_for_updates);
    }

    #[test]
    fn test_sync_on_connect_disabled_survives_save() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("settings.json");

        let mut manager = SettingsManager::with_path(config_path.clone()).unwrap();
        manager.settings.ui_preferences.sync_on_connect = false;
        manager.save().unwrap();

        let reloaded = SettingsManager::with_path(config_path).unwrap();
        assert!(!reloaded.get().ui_preferences.sync_on_connect);
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
