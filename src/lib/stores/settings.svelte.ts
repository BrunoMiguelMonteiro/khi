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
// Default Values
// ============================================

function getDefaultSettings(): AppSettings {
	return {
		exportConfig: getDefaultExportConfig(),
		uiPreferences: getDefaultUiPreferences(),
		lastImport: undefined,
		version: '0.1.0'
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
			description: false
		},
		dateFormat: 'dd_month_yyyy'
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
		autoImportOnConnect: true
	};
}

class SettingsStore {
	state = $state<AppSettings>(getDefaultSettings());
	isLoading = $state(false);
	error = $state<string | null>(null);

	// Derived state for easier access
	exportConfig = $derived(this.state.exportConfig);
	uiPreferences = $derived(this.state.uiPreferences);

	// ============================================
	// Actions - Settings Management
	// ============================================

	setSettings(newSettings: AppSettings) {
		this.state = newSettings;
	}

	updateSettings(updates: Partial<AppSettings>) {
		this.state = { ...this.state, ...updates };
	}

	resetSettings() {
		this.state = getDefaultSettings();
	}

	// ============================================
	// Actions - Export Config
	// ============================================

	setExportPath(path: string) {
		this.state.exportConfig.exportPath = path;
	}

	setMetadataOption(option: keyof ExportConfig['metadata'], value: boolean) {
		this.state.exportConfig.metadata[option] = value;
	}

	setDateFormat(format: ExportConfig['dateFormat']) {
		this.state.exportConfig.dateFormat = format;
	}

	updateExportConfig(config: Partial<ExportConfig>) {
		this.state.exportConfig = { ...this.state.exportConfig, ...config };
	}

	// ============================================
	// Actions - UI Preferences
	// ============================================

	async setTheme(theme: ThemePreference) {
		this.state.uiPreferences.theme = theme;
		await this.applyTheme(theme);
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
			const loadedSettings = await invoke<AppSettings>('load_settings');
			this.state = loadedSettings;
			await this.applyTheme(this.state.uiPreferences.theme);
		} catch (err) {
			console.error('Failed to load settings:', err);
			this.error = err instanceof Error ? err.message : 'Failed to load settings';
			// Keep default settings on error
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
			await invoke('save_settings', { settings: this.state });
		} catch (err) {
			console.error('Failed to save settings:', err);
			this.error = err instanceof Error ? err.message : 'Failed to save settings';
			throw err;
		} finally {
			this.isLoading = false;
		}
	}

	/**
	 * Reset settings to defaults and save
	 */
	async resetAndSave() {
		this.resetSettings();
		await this.save();
	}

	/**
	 * Initialize settings on app startup
	 */
	async initialize() {
		await this.load();

		// Listen for system theme changes
		// Always add listener, but only apply if theme is 'system'
		if (typeof window !== 'undefined') {
			const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
			mediaQuery.addEventListener('change', async () => {
				// Only react to system changes if theme preference is 'system'
				if (this.state.uiPreferences.theme === 'system') {
					await this.applyTheme('system');
				}
			});
		}
	}

	// ============================================
	// Helpers
	// ============================================

	/**
	 * Apply theme to document and macOS titlebar
	 */
	private async applyTheme(theme: ThemePreference) {
		if (typeof document === 'undefined') return;

		const root = document.documentElement;

		// Remove legacy theme classes
		root.classList.remove('theme-light', 'theme-dark');

		let isDark: boolean;

		if (theme === 'system') {
			// For 'system' theme, force window to sync with system then read back
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window');
				const appWindow = getCurrentWindow();

				// Force sync with system by setting to null
				await appWindow.setTheme(null);

				// Wait a bit for the system to update
				await new Promise((resolve) => setTimeout(resolve, 50));

				// Now read the theme
				const currentTheme = await appWindow.theme();
				isDark = currentTheme === 'dark';
			} catch (err) {
				// Fallback to media query if Tauri API fails
				console.warn('[THEME] Could not get theme from Tauri, using media query');
				isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
		} else {
			isDark = theme === 'dark';
		}

		if (isDark) {
			root.classList.add('dark');
		} else {
			root.classList.remove('dark');
		}

		// Sincronizar titlebar do macOS com Tauri Window API
		if (typeof window !== 'undefined') {
			try {
				const { getCurrentWindow } = await import('@tauri-apps/api/window');
				const appWindow = getCurrentWindow();
				await appWindow.setTheme(isDark ? 'dark' : 'light');
			} catch (err) {
				// Falhar silenciosamente se não estiver em ambiente Tauri
				console.debug('Tauri window theme not available:', err);
			}
		}
	}
}

export const settings = new SettingsStore();

// Export helper functions for UI labels (stateless)
export function getSortLabel(sort: SortPreference): string {
	const labels: Record<SortPreference, string> = {
		title: 'Title',
		author: 'Author',
		date_last_read: 'Date Read',
		highlight_count: 'Highlight Count'
	};
	return labels[sort];
}

export function getViewModeLabel(mode: ViewMode): string {
	const labels: Record<ViewMode, string> = {
		grid: 'Grid',
		list: 'List'
	};
	return labels[mode];
}

export function getThemeLabel(theme: ThemePreference): string {
	const labels: Record<ThemePreference, string> = {
		system: 'System',
		light: 'Light',
		dark: 'Dark'
	};
	return labels[theme];
}

export function getDateFormatLabel(format: ExportConfig['dateFormat']): string {
	const labels: Record<string, string> = {
		dd_mm_yyyy: 'DD/MM/YYYY (24/01/2025)',
		dd_month_yyyy: '24 January 2025',
		iso8601: 'ISO 8601 (2025-01-24)'
	};
	return labels[format] || format;
}