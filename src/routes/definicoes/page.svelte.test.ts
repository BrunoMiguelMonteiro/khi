import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

const appWindow = vi.hoisted(() => ({
	label: 'settings',
	closeRequested: null as null | ((event: { preventDefault(): void }) => unknown),
	close: vi.fn(() => Promise.resolve()),
	setTitle: vi.fn(() => Promise.resolve()),
	setTheme: vi.fn(() => Promise.resolve()),
	onCloseRequested: vi.fn(async (handler: (event: { preventDefault(): void }) => unknown) => {
		appWindow.closeRequested = handler;
		return () => {};
	})
}));

const handlers = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => void>());

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => appWindow }));
vi.mock('@tauri-apps/api/event', () => ({
	emit: vi.fn(() => Promise.resolve()),
	listen: vi.fn((event: string, handler: (event: { payload: unknown }) => void) => {
		handlers.set(event, handler);
		return Promise.resolve(() => {});
	})
}));
// The real translations: the window title has to follow a language change
vi.mock('$lib/i18n', async () => await vi.importActual('$lib/i18n'));

import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { flushSync } from 'svelte';
import { locale } from '$lib/i18n';
import { library } from '$lib/stores/library.svelte';
import { settings } from '$lib/stores/settings.svelte';
import { updater } from '$lib/stores/updater.svelte';
import Page from './+page.svelte';

const reader = { id: 1, name: 'Bruno', exportPath: null };
const other = { id: 2, name: 'Ana', exportPath: null };

/** What `settings_reader` answers: the Reader the main window sent. */
let sentReader: number | null = null;

describe('/definicoes', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		handlers.clear();
		appWindow.closeRequested = null;
		sentReader = null;
		library.activeReaderId = null;
		locale.set('en');
		vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
			if (cmd === 'list_readers') return Promise.resolve([reader, other]);
			if (cmd === 'settings_reader') return Promise.resolve(sentReader);
			if (cmd === 'last_reader') return Promise.resolve(reader.id);
			if (cmd === 'load_settings') return Promise.resolve(structuredClone(onDisk));
			if (cmd === 'update_settings') {
				const { patch } = args as { patch: Record<string, unknown> };
				return Promise.resolve({ ...structuredClone(onDisk), language: patch.language ?? onDisk.language });
			}
			return Promise.resolve(null);
		});
		// The layout loads the settings before the page is used
		await settings.load();
		flushSync();
	});

	it('shows the last Reader when the main window sent none', async () => {
		render(Page);
		expect(await screen.findByTestId('reader-name')).toHaveValue('Bruno');
	});

	it('shows the Reader the main window has open', async () => {
		sentReader = other.id;
		render(Page);
		expect(await screen.findByTestId('reader-name')).toHaveValue('Ana');
		expect(invoke).not.toHaveBeenCalledWith('last_reader');
	});

	it('settings_reader_switches_without_draft', async () => {
		render(Page);
		expect(await screen.findByTestId('reader-name')).toHaveValue('Bruno');
		await waitFor(() => expect(handlers.has('settings-reader')).toBe(true));

		// ⌘, again, from the main window now showing Ana
		handlers.get('settings-reader')!({ payload: other.id });

		await waitFor(() => expect(screen.getByTestId('reader-name')).toHaveValue('Ana'));
		expect(library.activeReaderId).toBe(other.id);
	});

	it('settings_reader_keeps_a_name_draft', async () => {
		render(Page);
		const name = await screen.findByTestId('reader-name');
		await waitFor(() => expect(handlers.has('settings-reader')).toBe(true));
		await fireEvent.input(name, { target: { value: 'Bruno M.' } });

		handlers.get('settings-reader')!({ payload: other.id });
		await new Promise((resolve) => setTimeout(resolve, 0));

		// The half-typed name stays on its own Reader
		expect(library.activeReaderId).toBe(reader.id);
		expect(screen.getByTestId('reader-name')).toHaveValue('Bruno M.');
	});

	it('settings_reader_keeps_a_folder_draft', async () => {
		render(Page);
		await screen.findByTestId('reader-name');
		await waitFor(() => expect(handlers.has('settings-reader')).toBe(true));
		await fireEvent.input(screen.getByLabelText('Path'), { target: { value: '/Volumes/Notes' } });

		handlers.get('settings-reader')!({ payload: other.id });
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(library.activeReaderId).toBe(reader.id);
		expect(screen.getByLabelText('Path')).toHaveValue('/Volumes/Notes');
	});

	it('Esc closes the window', async () => {
		render(Page);
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(appWindow.close).toHaveBeenCalled();
	});

	it('close_without_save_reverts_language', async () => {
		render(Page);
		await waitFor(() => expect(appWindow.closeRequested).not.toBeNull());
		settings.setLanguage('pt');

		appWindow.closeRequested!({ preventDefault: vi.fn() });

		expect(settings.language).toBe('en');
		// settings-changed only comes from Rust after update_settings
		expect(invoke).not.toHaveBeenCalledWith('update_settings', expect.anything());
		expect(emit).not.toHaveBeenCalled();
	});

	it('saved_language_updates_window_title', async () => {
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: /Appearance/ }));
		// English → Portuguese: the window speaks the new language once saved
		await fireEvent.click(screen.getByRole('button', { name: 'Português' }));
		flushSync();
		expect(appWindow.setTitle).not.toHaveBeenCalled();

		await fireEvent.click(screen.getByRole('button', { name: 'Guardar alterações' }));

		await waitFor(() => expect(appWindow.setTitle).toHaveBeenCalledWith('Definições'));
		expect(appWindow.setTitle).not.toHaveBeenCalledWith('Settings');
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: expect.objectContaining({ language: 'pt' }) });
	});

	it('Check Now asks the main window, which has the updater', async () => {
		const checkNow = vi.spyOn(updater, 'checkNow');
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: /Updates/ }));

		await fireEvent.click(screen.getByRole('button', { name: 'Check Now' }));

		expect(emit).toHaveBeenCalledWith('check-for-updates');
		expect(checkNow).not.toHaveBeenCalled();
	});
});

const onDisk = {
	exportConfig: {
		exportPath: '/Users/test/Documents/Kobo Highlights',
		metadata: { author: true, isbn: true, publisher: true, dateLastRead: true, language: true, description: false },
		dateFormat: 'iso8601'
	},
	uiPreferences: {
		theme: 'light',
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
