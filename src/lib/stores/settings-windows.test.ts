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
import { commands } from '../bindings';
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
			librarySortReversed: false,
			syncOnConnect: true,
			checkForUpdates: true
		},
		language: 'en',
		version: '1.3.0'
	};
}

/** settings.json as Rust keeps it: `update_settings` writes each patch over
 * it, leaf by leaf (`theme` is `uiPreferences.theme`), and answers the file. */
function rustKeeps(file: AppSettings) {
	mockedInvoke.mockImplementation((cmd: string, args?: unknown) => {
		if (cmd === 'load_settings') return Promise.resolve(structuredClone(file));
		if (cmd === 'get_default_settings') return Promise.resolve(onDisk());
		if (cmd === 'update_settings') {
			const { patch } = args as { patch: Record<string, unknown> };
			for (const [leaf, value] of Object.entries(patch)) {
				const parent: Record<string, unknown> =
					leaf in file.exportConfig ? file.exportConfig : leaf in file.uiPreferences ? file.uiPreferences : (file as never);
				parent[leaf] = structuredClone(value);
			}
			return Promise.resolve(structuredClone(file));
		}
		return Promise.resolve(null);
	});
}

/** Starts the store in `label`'s window, with `file` as settings.json. */
async function openIn(label: 'main' | 'settings', file: AppSettings = onDisk()) {
	win.label = label;
	rustKeeps(file);
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
		const file = onDisk();
		await openIn('settings', file);
		settings.setTheme('dark');
		settings.setLanguage('pt');

		// Meanwhile the main window saved its sort: its own patch, through Rust
		await commands.updateSettings({ librarySort: 'author' });
		mockedInvoke.mockClear();

		await settings.save();

		// One call, no load before: two would race the main window
		expect(mockedInvoke.mock.calls.map(([cmd]) => cmd)).toEqual(['update_settings']);
		const { patch } = mockedInvoke.mock.calls[0][1] as { patch: Record<string, unknown> };
		expect(Object.keys(patch).sort()).toEqual(SETTINGS_WINDOW_FIELDS.map((path) => path.split('.').pop()).sort());
		expect(patch).not.toHaveProperty('librarySort');
		expect(patch).toMatchObject({ theme: 'dark', language: 'pt' });
		// Both survive, in the file and in this window
		expect(file.uiPreferences.librarySort).toBe('author');
		expect(file.uiPreferences.theme).toBe('dark');
		expect(file.language).toBe('pt');
		expect(settings.uiPreferences.librarySort).toBe('author');
		expect(settings.uiPreferences.theme).toBe('dark');
	});

	it('reset_keeps_main_fields', async () => {
		const file = onDisk();
		file.uiPreferences.theme = 'dark';
		file.uiPreferences.librarySort = 'author';
		file.uiPreferences.windowWidth = 1440;
		await openIn('settings', file);
		mockedInvoke.mockClear();

		await settings.resetAndSave();

		const update = mockedInvoke.mock.calls.find(([cmd]) => cmd === 'update_settings');
		const { patch } = update![1] as { patch: Record<string, unknown> };
		expect(patch).toMatchObject({ theme: 'system' });
		expect(patch).not.toHaveProperty('librarySort');
		expect(patch).not.toHaveProperty('windowWidth');
		// Settings' fields are the defaults again; the main window's stay
		expect(file.uiPreferences.theme).toBe('system');
		expect(file.uiPreferences.librarySort).toBe('author');
		expect(file.uiPreferences.windowWidth).toBe(1440);
		expect(settings.uiPreferences.theme).toBe('system');
		expect(settings.uiPreferences.librarySort).toBe('author');
		expect(settings.uiPreferences.windowWidth).toBe(1440);
	});

	it('main_persist_applies_settings_saved_meanwhile', async () => {
		const file = onDisk();
		await openIn('main', file);
		const before = structuredClone(file);

		// Settings saved the theme; its settings-changed has not reached the
		// main window when the main window's own patch answers with the file
		file.uiPreferences.theme = 'dark';
		await settings.persist({ librarySort: 'author' });
		expect(settings.uiPreferences.theme).toBe('dark');

		// The late event changes nothing more, and the main window's sort stays
		const late = structuredClone(before);
		late.uiPreferences.theme = 'dark';
		settingsChanged(late);
		expect(settings.uiPreferences.theme).toBe('dark');
	});
});
