/**
 * Tests for Settings Store
 * 
 * TDD approach: Test the reactive state management and actions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as settingsStore from './settings.svelte';
import type { AppSettings, ThemePreference, ViewMode, SortPreference } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

import { invoke } from '@tauri-apps/api/core';
const mockedInvoke = vi.mocked(invoke);

describe('Settings Store - Default Values', () => {
  it('should have correct default export config', () => {
    const config = settingsStore.getExportConfig();
    
    expect(config.exportPath).toBe('~/Documents/Kobo Highlights');
    expect(config.metadata.author).toBe(true);
    expect(config.metadata.isbn).toBe(true);
    expect(config.metadata.publisher).toBe(true);
    expect(config.metadata.dateLastRead).toBe(true);
    expect(config.metadata.language).toBe(true);
    expect(config.metadata.description).toBe(false);
    expect(config.dateFormat).toBe('dd_month_yyyy');
  });

  it('should have correct default UI preferences', () => {
    const prefs = settingsStore.getUiPreferences();
    
    expect(prefs.theme).toBe('system');
    expect(prefs.windowWidth).toBe(1200);
    expect(prefs.windowHeight).toBe(800);
    expect(prefs.isMaximized).toBe(false);
    expect(prefs.showOnboarding).toBe(true);
    expect(prefs.libraryViewMode).toBe('grid');
    expect(prefs.librarySort).toBe('title');
  });

  it('should have no last import by default', () => {
    const settings = settingsStore.getSettings();
    expect(settings.lastImport).toBeUndefined();
  });
});

describe('Settings Store - Export Config Actions', () => {
  beforeEach(() => {
    settingsStore.resetSettings();
  });

  it('should update export path', () => {
    settingsStore.setExportPath('/custom/path');
    
    expect(settingsStore.getExportConfig().exportPath).toBe('/custom/path');
  });

  it('should update metadata options', () => {
    settingsStore.setMetadataOption('author', false);
    expect(settingsStore.getExportConfig().metadata.author).toBe(false);
    
    settingsStore.setMetadataOption('isbn', false);
    expect(settingsStore.getExportConfig().metadata.isbn).toBe(false);
    
    settingsStore.setMetadataOption('description', true);
    expect(settingsStore.getExportConfig().metadata.description).toBe(true);
  });

  it('should update date format', () => {
    settingsStore.setDateFormat('ISO8601');
    expect(settingsStore.getExportConfig().dateFormat).toBe('ISO8601');
    
    settingsStore.setDateFormat('DD/MM/YYYY');
    expect(settingsStore.getExportConfig().dateFormat).toBe('DD/MM/YYYY');
  });

  it('should update entire export config', () => {
    settingsStore.updateExportConfig({
      exportPath: '/new/path',
      dateFormat: 'ISO8601',
    });
    
    const config = settingsStore.getExportConfig();
    expect(config.exportPath).toBe('/new/path');
    expect(config.dateFormat).toBe('ISO8601');
    // Other fields should remain unchanged
    expect(config.metadata.author).toBe(true);
  });
});

describe('Settings Store - UI Preferences Actions', () => {
  beforeEach(() => {
    settingsStore.resetSettings();
  });

  it('should update theme', () => {
    settingsStore.setTheme('dark');
    expect(settingsStore.getUiPreferences().theme).toBe('dark');
    
    settingsStore.setTheme('light');
    expect(settingsStore.getUiPreferences().theme).toBe('light');
  });

  it('should update view mode', () => {
    settingsStore.setViewMode('list');
    expect(settingsStore.getUiPreferences().libraryViewMode).toBe('list');
  });

  it('should update sort preference', () => {
    settingsStore.setSortPreference('author');
    expect(settingsStore.getUiPreferences().librarySort).toBe('author');
    
    settingsStore.setSortPreference('highlightCount');
    expect(settingsStore.getUiPreferences().librarySort).toBe('highlightCount');
  });

  it('should update window size', () => {
    settingsStore.setWindowSize(1920, 1080);
    
    const prefs = settingsStore.getUiPreferences();
    expect(prefs.windowWidth).toBe(1920);
    expect(prefs.windowHeight).toBe(1080);
  });

  it('should update window maximized state', () => {
    settingsStore.setWindowMaximized(true);
    expect(settingsStore.getUiPreferences().isMaximized).toBe(true);
  });

  it('should update onboarding preference', () => {
    settingsStore.setShowOnboarding(false);
    expect(settingsStore.getUiPreferences().showOnboarding).toBe(false);
  });

  it('should update multiple UI preferences at once', () => {
    settingsStore.updateUiPreferences({
      theme: 'dark',
      windowWidth: 1400,
    });
    
    const prefs = settingsStore.getUiPreferences();
    expect(prefs.theme).toBe('dark');
    expect(prefs.windowWidth).toBe(1400);
    expect(prefs.windowHeight).toBe(800); // Unchanged
  });
});

describe('Settings Store - Last Import Actions', () => {
  beforeEach(() => {
    settingsStore.resetSettings();
  });

  it('should set last import record', () => {
    const record = {
      timestamp: '2025-01-29T14:00:00Z',
      deviceId: 'Kobo123',
      booksCount: 5,
      highlightsCount: 42,
    };
    
    settingsStore.setLastImport(record);
    
    expect(settingsStore.getSettings().lastImport).toEqual(record);
  });

  it('should clear last import record', () => {
    settingsStore.setLastImport({
      timestamp: '2025-01-29T14:00:00Z',
      booksCount: 1,
      highlightsCount: 1,
    });
    
    settingsStore.clearLastImport();
    
    expect(settingsStore.getSettings().lastImport).toBeUndefined();
  });
});

describe('Settings Store - Settings Management', () => {
  beforeEach(() => {
    settingsStore.resetSettings();
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
          description: true,
        },
        dateFormat: 'ISO8601',
      },
      uiPreferences: {
        theme: 'dark' as ThemePreference,
        windowWidth: 1920,
        windowHeight: 1080,
        isMaximized: true,
        showOnboarding: false,
        libraryViewMode: 'list' as ViewMode,
        librarySort: 'author' as SortPreference,
      },
      lastImport: {
        timestamp: '2025-01-29T14:00:00Z',
        deviceId: 'Kobo123',
        booksCount: 5,
        highlightsCount: 42,
      },
      version: '0.1.0',
    };
    
    settingsStore.setSettings(newSettings);
    
    expect(settingsStore.getSettings()).toEqual(newSettings);
  });

  it('should partially update settings', () => {
    settingsStore.updateSettings({
      version: '0.2.0',
    });
    
    expect(settingsStore.getSettings().version).toBe('0.2.0');
    expect(settingsStore.getExportConfig().exportPath).toBe('~/Documents/Kobo Highlights');
  });

  it('should reset to defaults', () => {
    // Modify settings
    settingsStore.setTheme('dark');
    settingsStore.setExportPath('/custom/path');
    
    // Reset
    settingsStore.resetSettings();
    
    // Verify defaults
    expect(settingsStore.getUiPreferences().theme).toBe('system');
    expect(settingsStore.getExportConfig().exportPath).toBe('~/Documents/Kobo Highlights');
  });
});

describe('Settings Store - Tauri Integration', () => {
  beforeEach(() => {
    settingsStore.resetSettings();
    mockedInvoke.mockClear();
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
          description: false,
        },
        dateFormat: 'ISO8601',
      },
      uiPreferences: {
        theme: 'dark',
        windowWidth: 1400,
        windowHeight: 900,
        isMaximized: false,
        showOnboarding: false,
        libraryViewMode: 'list',
        librarySort: 'author',
      },
      lastImport: undefined,
      version: '0.1.0',
    };
    
    mockedInvoke.mockResolvedValueOnce(mockSettings);
    
    await settingsStore.loadSettings();
    
    expect(mockedInvoke).toHaveBeenCalledWith('load_settings');
    expect(settingsStore.getSettings().exportConfig.exportPath).toBe('/loaded/path');
    expect(settingsStore.getUiPreferences().theme).toBe('dark');
  });

  it('should handle load settings error', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('Failed to load'));
    
    await settingsStore.loadSettings();
    
    expect(settingsStore.getError()).toBe('Failed to load');
    // Should keep default settings
    expect(settingsStore.getExportConfig().exportPath).toBe('~/Documents/Kobo Highlights');
  });

  it('should save settings to Tauri', async () => {
    mockedInvoke.mockResolvedValueOnce(undefined);
    
    await settingsStore.saveSettings();
    
    expect(mockedInvoke).toHaveBeenCalledWith('save_settings', {
      settings: expect.any(Object),
    });
  });

  it('should handle save settings error', async () => {
    mockedInvoke.mockRejectedValueOnce(new Error('Failed to save'));
    
    await expect(settingsStore.saveSettings()).rejects.toThrow('Failed to save');
    expect(settingsStore.getError()).toBe('Failed to save');
  });

  it('should reset and save settings', async () => {
    mockedInvoke.mockResolvedValueOnce(undefined);
    
    // Modify settings first
    settingsStore.setTheme('dark');
    
    await settingsStore.resetAndSaveSettings();
    
    // Should be reset to defaults
    expect(settingsStore.getUiPreferences().theme).toBe('system');
    expect(mockedInvoke).toHaveBeenCalledWith('save_settings', {
      settings: expect.any(Object),
    });
  });
});

describe('Settings Store - Helper Functions', () => {
  it('should return correct sort labels', () => {
    expect(settingsStore.getSortLabel('title')).toBe('Title');
    expect(settingsStore.getSortLabel('author')).toBe('Author');
    expect(settingsStore.getSortLabel('date_last_read')).toBe('Date Read');
    expect(settingsStore.getSortLabel('highlight_count')).toBe('Highlight Count');
  });

  it('should return correct view mode labels', () => {
    expect(settingsStore.getViewModeLabel('grid')).toBe('Grid');
    expect(settingsStore.getViewModeLabel('list')).toBe('List');
  });

  it('should return correct theme labels', () => {
    expect(settingsStore.getThemeLabel('system')).toBe('System');
    expect(settingsStore.getThemeLabel('light')).toBe('Light');
    expect(settingsStore.getThemeLabel('dark')).toBe('Dark');
  });

  it('should return correct date format labels', () => {
    expect(settingsStore.getDateFormatLabel('dd_mm_yyyy')).toBe('DD/MM/YYYY (24/01/2025)');
    expect(settingsStore.getDateFormatLabel('dd_month_yyyy')).toBe('24 January 2025');
    expect(settingsStore.getDateFormatLabel('iso8601')).toBe('ISO 8601 (2025-01-24)');
  });
});

describe('Settings Store - Loading State', () => {
  beforeEach(() => {
    mockedInvoke.mockClear();
  });

  it('should set loading state during load', async () => {
    mockedInvoke.mockImplementation(() => new Promise(resolve => {
      // Check loading is true during the call
      expect(settingsStore.getIsLoading()).toBe(true);
      setTimeout(() => resolve({}), 10);
    }));
    
    const promise = settingsStore.loadSettings();
    await promise;
    
    expect(settingsStore.getIsLoading()).toBe(false);
  });

  it('should set loading state during save', async () => {
    mockedInvoke.mockResolvedValueOnce(undefined);
    
    const promise = settingsStore.saveSettings();
    
    expect(settingsStore.getIsLoading()).toBe(true);
    
    await promise;
    
    expect(settingsStore.getIsLoading()).toBe(false);
  });
});
