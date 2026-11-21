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
			checkForUpdates: true,
			settingsPane: 'export',
			accentColor: 'system'
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
			// Rust emits the file under its lock, to every window, the writer included
			handlers.get('settings-changed')?.({ payload: structuredClone(file) });
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
				'uiPreferences.accentColor',
				'uiPreferences.settingsPane',
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
	});

	it('the main window takes the accent and the pane Settings saved', async () => {
		await openIn('main');

		const saved = onDisk();
		saved.uiPreferences.accentColor = 'turquesa';
		saved.uiPreferences.settingsPane = 'kobo';
		settingsChanged(saved);

		expect(settings.uiPreferences.accentColor).toBe('turquesa');
		expect(settings.uiPreferences.settingsPane).toBe('kobo');
	});

	it('the view mode is the main window\'s: Settings no longer edits it', async () => {
		await openIn('main');

		// Not a field of the Settings window: an event with another one does not change it
		const saved = onDisk();
		saved.uiPreferences.libraryViewMode = 'list';
		settingsChanged(saved);

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

	it('commit_writes_only_the_fields_it_names_and_keeps_main_changes', async () => {
		const file = onDisk();
		await openIn('settings', file);
		settings.setTheme('dark');

		// Meanwhile the main window saved its sort: its own patch, through Rust
		await commands.updateSettings({ librarySort: 'author' });
		mockedInvoke.mockClear();

		await settings.commit(['uiPreferences.theme']);

		// One call, no load before: two would race the main window
		expect(mockedInvoke.mock.calls.map(([cmd]) => cmd)).toEqual(['update_settings']);
		const { patch } = mockedInvoke.mock.calls[0][1] as { patch: Record<string, unknown> };
		expect(patch).toEqual({ theme: 'dark' });
		// Both survive, in the file and in this window
		expect(file.uiPreferences.librarySort).toBe('author');
		expect(file.uiPreferences.theme).toBe('dark');
		expect(settings.uiPreferences.librarySort).toBe('author');
		expect(settings.uiPreferences.theme).toBe('dark');
	});

	it('two_quick_commits_of_one_field_lose_neither', async () => {
		const file = onDisk();
		await openIn('settings', file);
		// Rust answers each patch only when told to, in the order they were sent
		const answers: (() => void)[] = [];
		const real = mockedInvoke.getMockImplementation()!;
		mockedInvoke.mockImplementation((cmd: string, args?: unknown) => {
			if (cmd !== 'update_settings') return real(cmd, args as never);
			return new Promise((resolve) => answers.push(() => resolve(real(cmd, args as never))));
		});

		// Two boxes ticked before the first write is answered
		settings.setMetadataOption('author', false);
		const first = settings.commit(['exportConfig.metadata']);
		settings.setMetadataOption('isbn', false);
		const second = settings.commit(['exportConfig.metadata']);

		const patches = mockedInvoke.mock.calls
			.filter(([cmd]) => cmd === 'update_settings')
			.map(([, args]) => (args as { patch: { metadata: Record<string, boolean> } }).patch.metadata);
		// The second patch carries both
		expect(patches[1]).toMatchObject({ author: false, isbn: false });
		answers.forEach((answer) => answer());
		await Promise.all([first, second]);

		expect(settings.exportConfig.metadata).toMatchObject({ author: false, isbn: false });
		expect(file.exportConfig.metadata).toMatchObject({ author: false, isbn: false });
	});

	it('an answer to the first write does not undo the second choice', async () => {
		const file = onDisk();
		await openIn('settings', file);
		const answers: (() => void)[] = [];
		const real = mockedInvoke.getMockImplementation()!;
		mockedInvoke.mockImplementation((cmd: string, args?: unknown) => {
			if (cmd !== 'update_settings') return real(cmd, args as never);
			// The answer is the file as it was when the patch arrived
			const answer = real(cmd, args as never);
			return new Promise((resolve) => answers.push(() => resolve(answer)));
		});

		settings.setTheme('dark');
		const first = settings.commit(['uiPreferences.theme']);
		settings.setTheme('light');
		const second = settings.commit(['uiPreferences.theme']);
		// Only the first has been answered: «dark», while «light» is chosen
		answers[0]();
		await first;
		expect(settings.uiPreferences.theme).toBe('light');
		answers[1]();
		await second;
		expect(settings.uiPreferences.theme).toBe('light');
	});

	it('a settings-changed from the main window meanwhile does not undo a choice being written', async () => {
		const file = onDisk();
		await openIn('settings', file);
		mockedInvoke.mockImplementation((cmd: string) =>
			cmd === 'update_settings' ? new Promise(() => {}) : Promise.resolve(structuredClone(file))
		);

		settings.setTheme('dark');
		void settings.commit(['uiPreferences.theme']);
		const saved = onDisk();
		saved.uiPreferences.librarySort = 'author';
		settingsChanged(saved);

		expect(settings.uiPreferences.theme).toBe('dark');
		expect(settings.uiPreferences.librarySort).toBe('author');
	});

	it('a commit Rust refuses puts the field back and says so', async () => {
		const file = onDisk();
		await openIn('settings', file);
		const real = mockedInvoke.getMockImplementation()!;
		mockedInvoke.mockImplementation((cmd: string, args?: unknown) =>
			cmd === 'update_settings' ? Promise.reject('disk full') : real(cmd, args as never)
		);

		settings.setTheme('dark');
		await expect(settings.commit(['uiPreferences.theme'])).rejects.toBe('disk full');

		expect(settings.uiPreferences.theme).toBe('system');
		expect(settings.error).toBe('disk full');
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

	it('main: the answer to a late write does not undo the theme the last event carried', async () => {
		const file = onDisk();
		await openIn('main', file);
		const real = mockedInvoke.getMockImplementation()!;
		let answer!: () => void;
		mockedInvoke.mockImplementation((cmd: string, args?: unknown) => {
			if (cmd !== 'update_settings') return real(cmd, args as never);
			// The main window's write (the sort) is answered with the file as it was then: theme «system»
			const asItWas = structuredClone(file);
			asItWas.uiPreferences.librarySort = 'author';
			return new Promise((resolve) => (answer = () => resolve(asItWas)));
		});

		const writing = settings.persist({ librarySort: 'author' });
		// Settings saves «dark», then «light»; both events reach the main window before that answer
		const dark = structuredClone(file);
		dark.uiPreferences.librarySort = 'author';
		dark.uiPreferences.theme = 'dark';
		settingsChanged(dark);
		const light = structuredClone(dark);
		light.uiPreferences.theme = 'light';
		settingsChanged(light);
		expect(settings.uiPreferences.theme).toBe('light');

		answer();
		await writing;

		expect(settings.uiPreferences.theme).toBe('light');
	});

	it('settings: system, dark, system, delivered as E1, R2, E2, R1, ends on system', async () => {
		const file = onDisk();
		await openIn('settings', file);
		const answers: (() => void)[] = [];
		const answerOf: AppSettings[] = [];
		mockedInvoke.mockImplementation((cmd: string) => {
			if (cmd !== 'update_settings') return Promise.resolve(structuredClone(file));
			const n = answers.length;
			return new Promise((resolve) => answers.push(() => resolve(answerOf[n])));
		});
		const asFile = (theme: 'system' | 'dark') => {
			const saved = onDisk();
			saved.uiPreferences.theme = theme;
			return saved;
		};

		settings.setTheme('dark');
		const first = settings.commit(['uiPreferences.theme']);
		settings.setTheme('system');
		const second = settings.commit(['uiPreferences.theme']);

		// Rust wrote «dark» (E1, R1), then «system» (E2, R2); they arrive as E1, R2, E2, R1
		answerOf.push(asFile('dark'), asFile('system'));
		settingsChanged(asFile('dark'));
		answers[1]();
		await second;
		settingsChanged(asFile('system'));
		answers[0]();
		await first;

		expect(settings.uiPreferences.theme).toBe('system');
	});
});
