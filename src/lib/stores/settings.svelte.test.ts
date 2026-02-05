/**
 * Tests for Settings Store
 *
 * TDD approach: Test the reactive state management and actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
	settings,
	getSortLabel,
	getViewModeLabel,
	getThemeLabel,
	getDateFormatLabel
} from './settings.svelte';
import type { AppSettings, ThemePreference, ViewMode, SortPreference } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
  convertFileSrc: vi.fn((src) => src)
}));

import { invoke } from '@tauri-apps/api/core';
const mockedInvoke = vi.mocked(invoke);

const MOCK_DEFAULTS: AppSettings = {
  exportConfig: {
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
  },
  uiPreferences: {
    theme: 'system',
    windowWidth: 1200,
    windowHeight: 800,
    isMaximized: false,
    showOnboarding: true,
    libraryViewMode: 'grid',
    librarySort: 'title',
    autoImportOnConnect: true
  },
  lastImport: undefined,
  version: '0.1.0'
};

describe('Settings Store - Actions', () => {
	beforeEach(async () => {
    mockedInvoke.mockClear();
    mockedInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_default_settings') return Promise.resolve(MOCK_DEFAULTS);
      return Promise.resolve({});
    });
		await settings.resetSettings();
	});

	it('should update export path', () => {
		settings.setExportPath('/custom/path');
		expect(settings.exportConfig.exportPath).toBe('/custom/path');
	});

	it('should update metadata options', () => {
		settings.setMetadataOption('author', false);
		expect(settings.exportConfig.metadata.author).toBe(false);

		settings.setMetadataOption('isbn', false);
		expect(settings.exportConfig.metadata.isbn).toBe(false);

		settings.setMetadataOption('description', true);
		expect(settings.exportConfig.metadata.description).toBe(true);
	});

	it('should update date format', () => {
		settings.setDateFormat('iso8601');
		expect(settings.exportConfig.dateFormat).toBe('iso8601');

		settings.setDateFormat('dd_mm_yyyy');
		expect(settings.exportConfig.dateFormat).toBe('dd_mm_yyyy');
	});

	it('should update entire export config', () => {
		settings.updateExportConfig({
			exportPath: '/new/path',
			dateFormat: 'iso8601'
		});

		const config = settings.exportConfig;
		expect(config.exportPath).toBe('/new/path');
		expect(config.dateFormat).toBe('iso8601');
		// Other fields should remain unchanged
		expect(config.metadata.author).toBe(true);
	});
});

describe('Settings Store - UI Preferences Actions', () => {
	beforeEach(async () => {
    mockedInvoke.mockClear();
    mockedInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_default_settings') return Promise.resolve(MOCK_DEFAULTS);
      return Promise.resolve({});
    });
		await settings.resetSettings();
	});

	it('should update theme', async () => {
		await settings.setTheme('dark');
		expect(settings.uiPreferences.theme).toBe('dark');

		await settings.setTheme('light');
		expect(settings.uiPreferences.theme).toBe('light');
	});

	it('should update view mode', () => {
		settings.setViewMode('list');
		expect(settings.uiPreferences.libraryViewMode).toBe('list');
	});

	it('should update sort preference', () => {
		settings.setSortPreference('author');
		expect(settings.uiPreferences.librarySort).toBe('author');

		settings.setSortPreference('highlight_count');
		expect(settings.uiPreferences.librarySort).toBe('highlight_count');
	});

	it('should update window size', () => {
		settings.setWindowSize(1920, 1080);

		const prefs = settings.uiPreferences;
		expect(prefs.windowWidth).toBe(1920);
		expect(prefs.windowHeight).toBe(1080);
	});

	it('should update window maximized state', () => {
		settings.setWindowMaximized(true);
		expect(settings.uiPreferences.isMaximized).toBe(true);
	});

	it('should update onboarding preference', () => {
		settings.setShowOnboarding(false);
		expect(settings.uiPreferences.showOnboarding).toBe(false);
	});

	it('should update multiple UI preferences at once', () => {
		settings.updateUiPreferences({
			theme: 'dark',
			windowWidth: 1400
		});

		const prefs = settings.uiPreferences;
		expect(prefs.theme).toBe('dark');
		expect(prefs.windowWidth).toBe(1400);
		expect(prefs.windowHeight).toBe(800); // Unchanged
	});
});

describe('Settings Store - Last Import Actions', () => {
	beforeEach(async () => {
    mockedInvoke.mockClear();
    mockedInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_default_settings') return Promise.resolve(MOCK_DEFAULTS);
      return Promise.resolve({});
    });
		await settings.resetSettings();
	});

	it('should set last import record', () => {
		const record = {
			timestamp: '2025-01-29T14:00:00Z',
			deviceId: 'Kobo123',
			booksCount: 5,
			highlightsCount: 42
		};

		settings.setLastImport(record);

		expect(settings.state.lastImport).toEqual(record);
	});

	it('should clear last import record', () => {
		settings.setLastImport({
			timestamp: '2025-01-29T14:00:00Z',
			booksCount: 1,
			highlightsCount: 1
		});

		settings.clearLastImport();

		expect(settings.state.lastImport).toBeUndefined();
	});
});

describe('Settings Store - Settings Management', () => {
	beforeEach(async () => {
    mockedInvoke.mockClear();
    mockedInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_default_settings') return Promise.resolve(MOCK_DEFAULTS);
      return Promise.resolve({});
    });
		await settings.resetSettings();
	});

	it('should update entire settings', () => {
		const newSettings: AppSettings = {
			exportConfig: {
				exportPath: '/new/path',
				metadata: {
					author: false,
					isbn: false,
					publisher: false,
					dateLastRead: false,
					language: false,
					description: true
				},
				dateFormat: 'iso8601'
			},
			uiPreferences: {
				theme: 'dark' as ThemePreference,
				windowWidth: 1920,
				windowHeight: 1080,
				isMaximized: true,
				showOnboarding: false,
				libraryViewMode: 'list' as ViewMode,
				librarySort: 'author' as SortPreference,
				autoImportOnConnect: true
			},
			lastImport: {
				timestamp: '2025-01-29T14:00:00Z',
				deviceId: 'Kobo123',
				booksCount: 5,
				highlightsCount: 42
			},
			version: '0.1.0'
		};

		settings.setSettings(newSettings);

		expect(settings.state).toEqual(newSettings);
	});

	it('should partially update settings', () => {
		settings.updateSettings({
			version: '0.2.0'
		});

		expect(settings.state.version).toBe('0.2.0');
		expect(settings.exportConfig.exportPath).toBe('~/Documents/Kobo Highlights');
	});

	it('should reset to defaults', async () => {
		// Modify settings
		await settings.setTheme('dark');
		settings.setExportPath('/custom/path');

		// Reset
		await settings.resetSettings();

		// Verify defaults
		expect(settings.uiPreferences.theme).toBe('system');
		expect(settings.exportConfig.exportPath).toBe('~/Documents/Kobo Highlights');
	});
});

describe('Settings Store - Tauri Integration', () => {
	beforeEach(async () => {
    mockedInvoke.mockClear();
    mockedInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_default_settings') return Promise.resolve(MOCK_DEFAULTS);
      return Promise.resolve({});
    });
		await settings.resetSettings();
	});

	it('should load settings from Tauri', async () => {
		const mockSettings: AppSettings = {
			exportConfig: {
				exportPath: '/loaded/path',
				metadata: {
					author: true,
					isbn: true,
					publisher: true,
					dateLastRead: true,
					language: true,
					description: false
				},
				dateFormat: 'iso8601'
			},
			uiPreferences: {
				theme: 'dark',
				windowWidth: 1400,
				windowHeight: 900,
				isMaximized: false,
				showOnboarding: false,
				libraryViewMode: 'list',
				librarySort: 'author',
				autoImportOnConnect: false
			},
			lastImport: undefined,
			version: '0.1.0'
		};

		mockedInvoke.mockResolvedValueOnce(mockSettings);

		await settings.load();

		expect(mockedInvoke).toHaveBeenCalledWith('load_settings');
		expect(settings.exportConfig.exportPath).toBe('/loaded/path');
		expect(settings.uiPreferences.theme).toBe('dark');
	});

	it('should handle load settings error and fallback to defaults', async () => {
		mockedInvoke.mockImplementation((cmd) => {
      if (cmd === 'load_settings') return Promise.reject(new Error('Failed to load'));
      if (cmd === 'get_default_settings') return Promise.resolve(MOCK_DEFAULTS);
      return Promise.resolve({});
    });

		await settings.load();

		expect(settings.error).toBe('Failed to load');
		// Should have fallen back to defaults
		expect(settings.exportConfig.exportPath).toBe('~/Documents/Kobo Highlights');
	});

	it('should save settings to Tauri', async () => {
		mockedInvoke.mockResolvedValueOnce(undefined);

		await settings.save();

		expect(mockedInvoke).toHaveBeenCalledWith('save_settings', {
			settings: expect.any(Object)
		});
	});

	it('should handle save settings error', async () => {
		mockedInvoke.mockRejectedValueOnce(new Error('Failed to save'));

		await expect(settings.save()).rejects.toThrow('Failed to save');
		expect(settings.error).toBe('Failed to save');
	});

	it('should reset and save settings', async () => {
		mockedInvoke.mockClear();
    mockedInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_default_settings') return Promise.resolve(MOCK_DEFAULTS);
      if (cmd === 'save_settings') return Promise.resolve(undefined);
      return Promise.resolve({});
    });

		// Modify settings first
		await settings.setTheme('dark');

		await settings.resetAndSave();

		// Should be reset to defaults
		expect(settings.uiPreferences.theme).toBe('system');
		expect(mockedInvoke).toHaveBeenCalledWith('save_settings', {
			settings: expect.any(Object)
		});
	});
});

describe('Settings Store - Helper Functions', () => {
	it('should return correct sort labels', () => {
		expect(getSortLabel('title')).toBe('Title');
		expect(getSortLabel('author')).toBe('Author');
		expect(getSortLabel('date_last_read')).toBe('Date Read');
		expect(getSortLabel('highlight_count')).toBe('Highlight Count');
	});

	it('should return correct view mode labels', () => {
		expect(getViewModeLabel('grid')).toBe('Grid');
		expect(getViewModeLabel('list')).toBe('List');
	});

	it('should return correct theme labels', () => {
		expect(getThemeLabel('system')).toBe('System');
		expect(getThemeLabel('light')).toBe('Light');
		expect(getThemeLabel('dark')).toBe('Dark');
	});

	it('should return correct date format labels', () => {
		expect(getDateFormatLabel('dd_mm_yyyy')).toBe('DD/MM/YYYY (24/01/2025)');
		expect(getDateFormatLabel('dd_month_yyyy')).toBe('24 January 2025');
		expect(getDateFormatLabel('iso8601')).toBe('ISO 8601 (2025-01-24)');
	});
});

describe('Settings Store - Loading State', () => {
	beforeEach(() => {
		mockedInvoke.mockClear();
	});

	it('should set loading state during load', async () => {
		mockedInvoke.mockImplementation(
			(cmd) =>
				new Promise((resolve) => {
          if (cmd === 'get_default_settings') resolve(MOCK_DEFAULTS);
					// Check loading is true during the call
					expect(settings.isLoading).toBe(true);
					setTimeout(() => resolve({}), 10);
				})
		);

		const promise = settings.load();
		await promise;

		expect(settings.isLoading).toBe(false);
	});

	it('should set loading state during save', async () => {
		mockedInvoke.mockResolvedValueOnce(undefined);

		const promise = settings.save();

		expect(settings.isLoading).toBe(true);

		await promise;

		expect(settings.isLoading).toBe(false);
	});
});
