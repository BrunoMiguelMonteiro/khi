import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { flushSync, tick } from 'svelte';

const handlers = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => void>());
const mainWindow = vi.hoisted(() => ({
	label: 'main',
	setTheme: vi.fn(() => Promise.resolve()),
	setFocus: vi.fn(() => Promise.resolve())
}));

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/event', () => ({
	listen: vi.fn((event: string, handler: (event: { payload: unknown }) => void) => {
		handlers.set(event, handler);
		return Promise.resolve(() => {});
	}),
	emit: vi.fn()
}));
vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => mainWindow }));
vi.mock('$lib/menu', () => ({ createApplicationMenu: vi.fn() }));

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { settings } from '$lib/stores/settings.svelte';
import { updater } from '$lib/stores/updater.svelte';
import Page from './+page.svelte';

const readers = [
	{ id: 1, name: 'Bruno', exportPath: null },
	{ id: 2, name: 'Ana', exportPath: null }
];

const onDisk = {
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

/** Reader 1 open, with an empty Library; `update_settings` answers the store's settings. */
function mockLibrary(list = readers) {
	vi.mocked(invoke).mockImplementation((cmd: string) => {
		if (cmd === 'list_readers') return Promise.resolve(structuredClone(list));
		if (cmd === 'last_reader') return Promise.resolve(1);
		if (cmd === 'get_library') return Promise.resolve([]);
		if (cmd === 'load_settings') return Promise.resolve(structuredClone(onDisk));
		if (cmd === 'update_settings') return Promise.resolve(structuredClone(settings.state));
		return Promise.resolve(null);
	});
}

describe('+page', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		handlers.clear();
		mainWindow.setFocus.mockClear();
	});

	it('shows an error when the chosen reader cannot be opened', async () => {
		// jsdom has no Web Animations; the notification fades in
		Element.prototype.animate ??= vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve(), onfinish: null })) as never;
		vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
			if (cmd === 'list_readers') return Promise.resolve(readers);
			if (cmd === 'last_reader') return Promise.resolve(1);
			if (cmd === 'get_library') {
				const { readerId } = args as { readerId: number };
				return readerId === 1 ? Promise.resolve([]) : Promise.reject('database is locked');
			}
			return Promise.resolve(null);
		});
		render(Page);
		const picker = await screen.findByTestId('reader-picker');

		await fireEvent.change(picker, { target: { value: '2' } });

		expect(await screen.findByText("Could not open this reader's Library")).toBeInTheDocument();
	});

	it('page_has_no_settings_modal', async () => {
		mockLibrary();
		render(Page);
		const gear = await screen.findByRole('button', { name: 'Settings' });

		await fireEvent.click(gear);

		// The gear opens the Settings window (Rust), never a panel in this one,
		// with the Reader on screen
		expect(invoke).toHaveBeenCalledWith('open_settings', { title: 'Settings', readerId: 1 });
		expect(document.querySelector('[aria-labelledby="settings-title"]')).toBeNull();
		expect(vi.mocked(listen).mock.calls.map(([event]) => event)).not.toContain('open-settings');
	});

	it('main_sort_change_persists', async () => {
		mockLibrary();
		render(Page);
		const sort = (await screen.findByRole('option', { name: 'Author (A-Z)' })).closest('select')!;

		await fireEvent.change(sort, { target: { value: 'author' } });

		// Only the sort: the rest of the file is not this window's to write
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { librarySort: 'author' } });
		expect(settings.uiPreferences.librarySort).toBe('author');
	});

	it('main_view_change_persists', async () => {
		mockLibrary();
		render(Page);
		const other = settings.uiPreferences.libraryViewMode === 'list' ? 'grid' : 'list';

		await fireEvent.click(await screen.findByRole('button', { name: other === 'list' ? 'List view' : 'Grid view' }));

		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { libraryViewMode: other } });
		expect(settings.uiPreferences.libraryViewMode).toBe(other);
	});

	it('applying_event_does_not_save_again', async () => {
		mockLibrary();
		// The layout listens for settings-changed
		await settings.initialize();
		render(Page);
		await screen.findByTestId('reader-picker');
		vi.mocked(invoke).mockClear();

		// Settings saved another view mode and theme: the main window follows
		const saved = structuredClone(onDisk);
		saved.uiPreferences.libraryViewMode = settings.uiPreferences.libraryViewMode === 'list' ? 'grid' : 'list';
		saved.uiPreferences.theme = 'dark';
		handlers.get('settings-changed')!({ payload: saved });
		flushSync();
		await tick();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(settings.uiPreferences.libraryViewMode).toBe(saved.uiPreferences.libraryViewMode);
		expect(invoke).not.toHaveBeenCalledWith('update_settings', expect.anything());
	});

	it('check_for_updates_brings_main_forward', async () => {
		const checkNow = vi.spyOn(updater, 'checkNow').mockResolvedValue();
		mockLibrary();
		render(Page);
		await waitFor(() => expect(handlers.has('check-for-updates')).toBe(true));

		// Sent by Settings' «Check Now»: the dialog shows here, so this window comes first
		handlers.get('check-for-updates')!({ payload: null });

		expect(mainWindow.setFocus).toHaveBeenCalled();
		expect(checkNow).toHaveBeenCalled();
		checkNow.mockRestore();
	});

	it('reloads the readers when Settings renamed one', async () => {
		const list = structuredClone(readers);
		mockLibrary(list);
		render(Page);
		await screen.findByRole('option', { name: 'Bruno' });
		await waitFor(() => expect(handlers.has('readers-changed')).toBe(true));

		list[0].name = 'Bruno M.';
		handlers.get('readers-changed')!({ payload: null });

		expect(await screen.findByRole('option', { name: 'Bruno M.' })).toBeInTheDocument();
	});
});
