/**
 * Settings Store - Svelte 5 runes-based store for application settings
 *
 * Provides reactive state management for:
 * - Export configuration (path, metadata options, date format)
 * - UI preferences (theme, window size, view mode, sort)
 * - Last import record
 *
 * Integrates with Tauri commands for persistence.
 * This store uses the Backend (Rust) as the Single Source of Truth for defaults.
 */

import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  ExportConfig,
  UiPreferences,
  ThemePreference,
  ViewMode,
  SortPreference,
  LastImportSettingsRecord,
} from "../types";

/**
 * Initial empty state to satisfy TypeScript before Rust provides actual values.
 * Values here are placeholders and should be overwritten by initialize() or load().
 */
function createInitialState(): AppSettings {
  return {
    exportConfig: {
      exportPath: "",
      metadata: {
        author: true,
        isbn: true,
        publisher: true,
        dateLastRead: true,
        language: true,
        description: false,
      },
      dateFormat: "iso8601",
    },
    uiPreferences: {
      theme: "system",
      windowWidth: 1200,
      windowHeight: 800,
      isMaximized: false,
      showOnboarding: true,
      libraryViewMode: "grid",
      librarySort: "title",
      autoImportOnConnect: true,
    },
    version: "0.1.0",
  };
}

/** Sync macOS native titlebar theme (fire-and-forget). Pass null to follow system. */
function syncTitlebar(theme: "light" | "dark" | null) {
  import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(theme))
    .catch(() => {});
}

/**
 * Apply theme to the document root and configure system theme listener if needed.
 * Extracted as a standalone function so it can be tested independently of Svelte's
 * effect scheduler.
 *
 * Returns a cleanup function that removes the matchMedia listener (if one was added).
 */
export function applyTheme(
  theme: ThemePreference,
  root: HTMLElement = document.documentElement,
): (() => void) | void {
  root.classList.remove("light", "dark");

  if (theme === "system") {
    // syncTitlebar(null) is fire-and-forget: the Tauri setTheme(null) may
    // not take effect before the matchMedia read below. In practice this is
    // fine because matchMedia reflects the OS preference independently of
    // Tauri's window theme, and the listener corrects any mismatch later.
    syncTitlebar(null);

    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";
    root.classList.add(systemTheme);

    // Local listener + cleanup — mirrors the astro-editor pattern
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const newTheme = mediaQuery.matches ? "dark" : "light";
      if (root.classList.contains(newTheme)) return;
      root.classList.remove("light", "dark");
      root.classList.add(newTheme);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  } else {
    root.classList.add(theme);
    syncTitlebar(theme);
  }
}

class SettingsStore {
  state = $state<AppSettings>(createInitialState());
  isLoading = $state(false);
  error = $state<string | null>(null);

  // Derived state for easier access
  exportConfig = $derived(this.state.exportConfig);
  uiPreferences = $derived(this.state.uiPreferences);

  constructor() {
    // $effect.root() needed because this class is instantiated at module scope,
    // outside any Svelte component initialization context
    $effect.root(() => {
      $effect(() => {
        if (typeof window === "undefined") return;
        const theme = this.state.uiPreferences?.theme;
        if (!theme) return;
        return applyTheme(theme);
      });
    });
  }

  // ============================================
  // Actions - Settings Management
  // ============================================

  setSettings(newSettings: AppSettings) {
    this.state = newSettings;
  }

  updateSettings(updates: Partial<AppSettings>) {
    this.state = { ...this.state, ...updates };
  }

  /**
   * Pede ao Rust os valores por defeito e atualiza o estado local.
   */
  async resetSettings() {
    this.isLoading = true;
    try {
      const defaults = await invoke<AppSettings>("get_default_settings");
      this.state = defaults;
    } catch (err) {
      console.error("Failed to fetch default settings:", err);
    } finally {
      this.isLoading = false;
    }
  }

  // ============================================
  // Actions - Export Config
  // ============================================

  setExportPath(path: string) {
    this.state.exportConfig.exportPath = path;
  }

  setMetadataOption(option: keyof ExportConfig["metadata"], value: boolean) {
    this.state.exportConfig.metadata[option] = value;
  }

  setDateFormat(format: ExportConfig["dateFormat"]) {
    this.state.exportConfig.dateFormat = format;
  }

  updateExportConfig(config: Partial<ExportConfig>) {
    this.state.exportConfig = { ...this.state.exportConfig, ...config };
  }

  // ============================================
  // Actions - UI Preferences
  // ============================================

  setTheme(theme: ThemePreference) {
    this.state.uiPreferences.theme = theme;
  }

  setViewMode(mode: ViewMode) {
    this.state.uiPreferences.libraryViewMode = mode;
  }

  setSortPreference(sort: SortPreference) {
    this.state.uiPreferences.librarySort = sort;
  }

  setWindowSize(width: number, height: number) {
    this.state.uiPreferences.windowWidth = width;
    this.state.uiPreferences.windowHeight = height;
  }

  setWindowMaximized(isMaximized: boolean) {
    this.state.uiPreferences.isMaximized = isMaximized;
  }

  setShowOnboarding(show: boolean) {
    this.state.uiPreferences.showOnboarding = show;
  }

  setAutoImportOnConnect(enabled: boolean) {
    this.state.uiPreferences.autoImportOnConnect = enabled;
  }

  updateUiPreferences(prefs: Partial<UiPreferences>) {
    this.state.uiPreferences = { ...this.state.uiPreferences, ...prefs };
  }

  // ============================================
  // Actions - Last Import
  // ============================================

  setLastImport(record: LastImportSettingsRecord) {
    this.state.lastImport = record;
  }

  clearLastImport() {
    this.state.lastImport = undefined;
  }

  // ============================================
  // Tauri Integration
  // ============================================

  /**
   * Load settings from disk via Tauri
   */
  async load() {
    this.isLoading = true;
    this.error = null;

    try {
      const loadedSettings = await invoke<AppSettings>("load_settings");
      this.state = loadedSettings;
      // $effect will apply theme automatically when state changes
    } catch (err) {
      console.error("Failed to load settings:", err);
      this.error =
        err instanceof Error ? err.message : "Failed to load settings";
      // Fallback to defaults from Rust if load fails
      await this.resetSettings();
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Save settings to disk via Tauri
   */
  async save() {
    this.isLoading = true;
    this.error = null;

    try {
      await invoke("save_settings", { settings: this.state });
    } catch (err) {
      console.error("Failed to save settings:", err);
      this.error =
        err instanceof Error ? err.message : "Failed to save settings";
      throw err;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Reset settings to defaults and save
   */
  async resetAndSave() {
    await this.resetSettings();
    await this.save();
  }

  /**
   * Initialize settings on app startup
   */
  async initialize() {
    await this.load();
    // $effect in constructor will handle theme setup automatically
  }

}

export const settings = new SettingsStore();

// Export helper functions for UI labels (stateless)
export function getSortLabel(sort: SortPreference): string {
  const labels: Record<SortPreference, string> = {
    title: "Title",
    author: "Author",
    date_last_read: "Date Read",
    highlight_count: "Highlight Count",
  };
  return labels[sort];
}

export function getViewModeLabel(mode: ViewMode): string {
  const labels: Record<ViewMode, string> = {
    grid: "Grid",
    list: "List",
  };
  return labels[mode];
}

export function getThemeLabel(theme: ThemePreference): string {
  const labels: Record<ThemePreference, string> = {
    system: "System",
    light: "Light",
    dark: "Dark",
  };
  return labels[theme];
}

export function getDateFormatLabel(format: ExportConfig["dateFormat"]): string {
  const labels: Record<string, string> = {
    dd_mm_yyyy: "DD/MM/YYYY (24/01/2025)",
    dd_month_yyyy: "24 January 2025",
    iso8601: "ISO 8601 (2025-01-24)",
  };
  return labels[format] || format;
}
