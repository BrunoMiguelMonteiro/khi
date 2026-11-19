/**
 * The settings in two windows: the main one and Settings. The file is the
 * source; `settings-changed` (emitted by Rust after a save) carries it.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AppSettings } from '../types';

const win = vi.hoisted(() => ({ label: 'main' }));
const handlers = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => void>());

vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => ({ label: win.label, setTheme: vi.fn(() => Promise.resolve()) })
}));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn(async (event: string, handler: (event: { payload: unknown }) => void) => {
		handlers.set(event, handler);
		return () => handlers.delete(event);
	})
}));

import { invoke } from '@tauri-apps/api/core';
import { settings, SETTINGS_WINDOW_FIELDS } from './settings.svelte';

const mockedInvoke = vi.mocked(invoke);

function onDisk(): AppSettings {
	return {
		exportConfig: {
			exportPath: '/Users/test/Documents/Kobo Highlights',
			metadata: { author: true, isbn: true, publisher: true, dateLastRead: true, language: true, description: false },
			dateFormat: 'iso8601'
		},
		uiPreferences: {
			theme: 'system',
			windowWidth: 1200,
			windowHeight: 800,
			isMaximized: false,
			showOnboarding: true,
			libraryViewMode: 'grid',
			librarySort: 'title',
			syncOnConnect: true,
			checkForUpdates: true
		},
		language: 'en',
		version: '1.3.0'
	};
}

/** Starts the store in `label`'s window, with `file` as settings.json. */
async function openIn(label: 'main' | 'settings', file: AppSettings = onDisk()) {
	win.label = label;
	mockedInvoke.mockImplementation((cmd: string) => {
		if (cmd === 'load_settings') return Promise.resolve(structuredClone(file));
		return Promise.resolve(null);
	});
	await settings.initialize();
}

/** What Rust emits after a save. */
function settingsChanged(saved: AppSettings) {
	const handler = handlers.get('settings-changed');
	expect(handler, 'listening to settings-changed').toBeDefined();
	handler!({ payload: structuredClone(saved) });
}

describe('settings in two windows', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		handlers.clear();
	});

	it('lists what the Settings panel edits, by leaf', () => {
		expect([...SETTINGS_WINDOW_FIELDS].sort()).toEqual(
			[
				'exportConfig.exportPath',
				'exportConfig.metadata',
				'exportConfig.dateFormat',
				'language',
				'uiPreferences.theme',
				'uiPreferences.libraryViewMode',
				'uiPreferences.syncOnConnect',
				'uiPreferences.checkForUpdates'
			].sort()
		);
	});

	it('settings_changed_updates_only_settings_fields_in_main', async () => {
		await openIn('main');
		// The main window's own, unsaved, choice
		settings.setSortPreference('author');

		const saved = onDisk();
		saved.uiPreferences.theme = 'dark';
		saved.language = 'pt';
		saved.exportConfig.dateFormat = 'dd_mm_yyyy';
		saved.uiPreferences.librarySort = 'highlight_count';
		saved.uiPreferences.windowWidth = 999;
		settingsChanged(saved);

		expect(settings.uiPreferences.theme).toBe('dark');
		expect(settings.language).toBe('pt');
		expect(settings.exportConfig.dateFormat).toBe('dd_mm_yyyy');
		expect(settings.uiPreferences.librarySort).toBe('author');
		expect(settings.uiPreferences.windowWidth).toBe(1200);
		// The saved language is now Portuguese: nothing to put back
		settings.revertUnsavedLanguage();
		expect(settings.language).toBe('pt');
	});

	it('main keeps its view mode when Settings saved without changing it', async () => {
		await openIn('main');
		settings.setViewMode('list');

		const saved = onDisk();
		saved.uiPreferences.theme = 'dark';
		settingsChanged(saved);

		expect(settings.uiPreferences.libraryViewMode).toBe('list');

		// Changed in Settings and saved: the main window follows
		const again = structuredClone(saved);
		again.uiPreferences.libraryViewMode = 'list';
		settingsChanged(again);
		again.uiPreferences.libraryViewMode = 'grid';
		settingsChanged(again);
		expect(settings.uiPreferences.libraryViewMode).toBe('grid');
	});

	it('event_keeps_unsaved_draft', async () => {
		await openIn('settings');
		settings.setTheme('dark');

		const saved = onDisk();
		saved.uiPreferences.theme = 'light';
		saved.language = 'pt';
		saved.uiPreferences.librarySort = 'author';
		settingsChanged(saved);

		// The draft stays; what was not touched follows the file
		expect(settings.uiPreferences.theme).toBe('dark');
		expect(settings.language).toBe('pt');
		expect(settings.uiPreferences.librarySort).toBe('author');
	});

	it('settings_save_keeps_main_changes', async () => {
		await openIn('settings');
		settings.setTheme('dark');
		settings.setLanguage('pt');

		// Meanwhile the main window wrote its own fields
		const now = onDisk();
		now.uiPreferences.librarySort = 'author';
		now.uiPreferences.windowWidth = 1440;
		mockedInvoke.mockClear();
		mockedInvoke.mockImplementation((cmd: string) =>
			Promise.resolve(cmd === 'load_settings' ? structuredClone(now) : null)
		);

		await settings.save();

		const commandsCalled = mockedInvoke.mock.calls.map(([cmd]) => cmd);
		expect(commandsCalled).toEqual(['load_settings', 'save_settings']);
		const written = (mockedInvoke.mock.calls[1][1] as { settings: AppSettings }).settings;
		expect(written.uiPreferences.librarySort).toBe('author');
		expect(written.uiPreferences.windowWidth).toBe(1440);
		expect(written.uiPreferences.theme).toBe('dark');
		expect(written.language).toBe('pt');
	});
});
