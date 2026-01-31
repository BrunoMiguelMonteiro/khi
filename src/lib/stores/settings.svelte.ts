/**
 * Settings Store - Svelte 5 runes-based store for application settings
 * 
 * Provides reactive state management for:
 * - Export configuration (path, metadata options, date format)
 * - UI preferences (theme, window size, view mode, sort)
 * - Last import record
 * 
 * Integrates with Tauri commands for persistence.
 */

import { invoke } from '@tauri-apps/api/core';
import type { 
  AppSettings, 
  ExportConfig, 
  UiPreferences, 
  ThemePreference, 
  ViewMode, 
  SortPreference,
  LastImportSettingsRecord 
} from '../types';

// ============================================
// State
// ============================================

let settings = $state<AppSettings>(getDefaultSettings());
let isLoading = $state(false);
let error = $state<string | null>(null);

// ============================================
// Default Values
// ============================================

function getDefaultSettings(): AppSettings {
  return {
    exportConfig: getDefaultExportConfig(),
    uiPreferences: getDefaultUiPreferences(),
    lastImport: undefined,
    version: '0.1.0',
  };
}

function getDefaultExportConfig(): ExportConfig {
  return {
    exportPath: '~/Documents/Kobo Highlights',
    metadata: {
      author: true,
      isbn: true,
      publisher: true,
      dateLastRead: true,
      language: true,
      description: false,
    },
    dateFormat: 'dd_month_yyyy',
  };
}

function getDefaultUiPreferences(): UiPreferences {
  return {
    theme: 'system',
    windowWidth: 1200,
    windowHeight: 800,
    isMaximized: false,
    showOnboarding: true,
    libraryViewMode: 'grid',
    librarySort: 'title',
  };
}

// ============================================
// Getters
// ============================================

export function getSettings(): AppSettings {
  return settings;
}

export function getExportConfig(): ExportConfig {
  return settings.exportConfig;
}

export function getUiPreferences(): UiPreferences {
  return settings.uiPreferences;
}

export function getIsLoading(): boolean {
  return isLoading;
}

export function getError(): string | null {
  return error;
}

// ============================================
// Actions - Settings Management
// ============================================

export function setSettings(newSettings: AppSettings): void {
  settings = newSettings;
}

export function updateSettings(updates: Partial<AppSettings>): void {
  settings = { ...settings, ...updates };
}

export function resetSettings(): void {
  settings = getDefaultSettings();
}

// ============================================
// Actions - Export Config
// ============================================

export function setExportPath(path: string): void {
  settings = {
    ...settings,
    exportConfig: {
      ...settings.exportConfig,
      exportPath: path,
    },
  };
}

export function setMetadataOption(
  option: keyof ExportConfig['metadata'],
  value: boolean
): void {
  settings = {
    ...settings,
    exportConfig: {
      ...settings.exportConfig,
      metadata: {
        ...settings.exportConfig.metadata,
        [option]: value,
      },
    },
  };
}

export function setDateFormat(format: ExportConfig['dateFormat']): void {
  settings = {
    ...settings,
    exportConfig: {
      ...settings.exportConfig,
      dateFormat: format,
    },
  };
}

export function updateExportConfig(config: Partial<ExportConfig>): void {
  settings = {
    ...settings,
    exportConfig: {
      ...settings.exportConfig,
      ...config,
    },
  };
}

// ============================================
// Actions - UI Preferences
// ============================================

export function setTheme(theme: ThemePreference): void {
  settings = {
    ...settings,
    uiPreferences: {
      ...settings.uiPreferences,
      theme,
    },
  };
  applyTheme(theme);
}

export function setViewMode(mode: ViewMode): void {
  settings = {
    ...settings,
    uiPreferences: {
      ...settings.uiPreferences,
      libraryViewMode: mode,
    },
  };
}

export function setSortPreference(sort: SortPreference): void {
  settings = {
    ...settings,
    uiPreferences: {
      ...settings.uiPreferences,
      librarySort: sort,
    },
  };
}

export function setWindowSize(width: number, height: number): void {
  settings = {
    ...settings,
    uiPreferences: {
      ...settings.uiPreferences,
      windowWidth: width,
      windowHeight: height,
    },
  };
}

export function setWindowMaximized(isMaximized: boolean): void {
  settings = {
    ...settings,
    uiPreferences: {
      ...settings.uiPreferences,
      isMaximized,
    },
  };
}

export function setShowOnboarding(show: boolean): void {
  settings = {
    ...settings,
    uiPreferences: {
      ...settings.uiPreferences,
      showOnboarding: show,
    },
  };
}

export function updateUiPreferences(prefs: Partial<UiPreferences>): void {
  settings = {
    ...settings,
    uiPreferences: {
      ...settings.uiPreferences,
      ...prefs,
    },
  };
}

// ============================================
// Actions - Last Import
// ============================================

export function setLastImport(record: LastImportSettingsRecord): void {
  settings = {
    ...settings,
    lastImport: record,
  };
}

export function clearLastImport(): void {
  settings = {
    ...settings,
    lastImport: undefined,
  };
}

// ============================================
// Tauri Integration
// ============================================

/**
 * Load settings from disk via Tauri
 */
export async function loadSettings(): Promise<void> {
  isLoading = true;
  error = null;
  
  try {
    const loadedSettings = await invoke<AppSettings>('load_settings');
    settings = loadedSettings;
    applyTheme(settings.uiPreferences.theme);
  } catch (err) {
    console.error('Failed to load settings:', err);
    error = err instanceof Error ? err.message : 'Failed to load settings';
    // Keep default settings on error
  } finally {
    isLoading = false;
  }
}

/**
 * Save settings to disk via Tauri
 */
export async function saveSettings(): Promise<void> {
  isLoading = true;
  error = null;
  
  try {
    await invoke('save_settings', { settings });
  } catch (err) {
    console.error('Failed to save settings:', err);
    error = err instanceof Error ? err.message : 'Failed to save settings';
    throw err;
  } finally {
    isLoading = false;
  }
}

/**
 * Reset settings to defaults and save
 */
export async function resetAndSaveSettings(): Promise<void> {
  resetSettings();
  await saveSettings();
}

// ============================================
// Helpers
// ============================================

/**
 * Apply theme to document
 */
function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  
  // Remove existing theme classes
  root.classList.remove('theme-light', 'theme-dark');
  
  if (theme === 'system') {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
  } else {
    root.classList.add(`theme-${theme}`);
  }
}

/**
 * Initialize settings on app startup
 */
export async function initializeSettings(): Promise<void> {
  await loadSettings();
  
  // Listen for system theme changes
  if (settings.uiPreferences.theme === 'system') {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      applyTheme('system');
    });
  }
}

/**
 * Get the display label for a sort preference
 */
export function getSortLabel(sort: SortPreference): string {
  const labels: Record<SortPreference, string> = {
    title: 'Title',
    author: 'Author',
    date_last_read: 'Date Read',
    highlight_count: 'Highlight Count',
  };
  return labels[sort];
}

/**
 * Get the display label for a view mode
 */
export function getViewModeLabel(mode: ViewMode): string {
  const labels: Record<ViewMode, string> = {
    grid: 'Grid',
    list: 'List',
  };
  return labels[mode];
}

/**
 * Get the display label for a theme preference
 */
export function getThemeLabel(theme: ThemePreference): string {
  const labels: Record<ThemePreference, string> = {
    system: 'System',
    light: 'Light',
    dark: 'Dark',
  };
  return labels[theme];
}

/**
 * Get the display label for a date format
 */
export function getDateFormatLabel(format: ExportConfig['dateFormat']): string {
  const labels: Record<string, string> = {
    'dd_mm_yyyy': 'DD/MM/YYYY (24/01/2025)',
    'dd_month_yyyy': '24 January 2025',
    'iso8601': 'ISO 8601 (2025-01-24)',
  };
  return labels[format] || format;
}
