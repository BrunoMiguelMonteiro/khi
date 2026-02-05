import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { settings } from './settings.svelte';
import type { AppSettings } from '../types';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
  convertFileSrc: vi.fn((src) => src)
}));

import { invoke } from '@tauri-apps/api/core';
const mockedInvoke = vi.mocked(invoke);

// Mock Tauri window — getCurrentWindow throws so applyTheme falls back to matchMedia
vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => {
		throw new Error('Not in Tauri');
	}
}));

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

describe('Settings Store - Theme Application', () => {
	// Mock matchMedia
	const matchMediaMock = vi.fn();

	beforeEach(async () => {
		// Reset DOM
		document.documentElement.className = '';

		// Setup matchMedia mock
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			value: matchMediaMock
		});

		matchMediaMock.mockImplementation((query) => ({
			matches: false, // Default to light mode preference
			media: query,
			onchange: null,
			addListener: vi.fn(), // Deprecated
			removeListener: vi.fn(), // Deprecated
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn()
		}));

    mockedInvoke.mockClear();
    mockedInvoke.mockImplementation((cmd) => {
      if (cmd === 'get_default_settings') return Promise.resolve(MOCK_DEFAULTS);
      return Promise.resolve({});
    });

		await settings.resetSettings();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('should apply light theme (remove dark class) when theme is "light"', async () => {
		// Start with dark to verify removal
		document.documentElement.classList.add('dark');

		await settings.setTheme('light');
		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('should apply dark theme (add dark class) when theme is "dark"', async () => {
		await settings.setTheme('dark');
		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('should apply system light theme correctly', async () => {
		// Mock system preferring light
		matchMediaMock.mockImplementation((query) => ({
			matches: false,
			media: query,
			addEventListener: vi.fn()
		}));

		// Start with dark to verify removal
		document.documentElement.classList.add('dark');

		await settings.setTheme('system');

		expect(document.documentElement.classList.contains('dark')).toBe(false);
	});

	it('should apply system dark theme correctly', async () => {
		// Mock system preferring dark
		matchMediaMock.mockImplementation((query) => ({
			matches: true,
			media: query,
			addEventListener: vi.fn()
		}));

		await settings.setTheme('system');

		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});

	it('should update theme when switching from specific to system (dark)', async () => {
		// Start with light (no class)
		document.documentElement.classList.remove('dark');

		// Mock system preferring dark
		matchMediaMock.mockImplementation((query) => ({
			matches: true,
			media: query,
			addEventListener: vi.fn()
		}));

		// Switch to system
		await settings.setTheme('system');

		expect(document.documentElement.classList.contains('dark')).toBe(true);
	});
});
