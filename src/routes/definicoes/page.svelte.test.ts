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

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => appWindow }));
vi.mock('@tauri-apps/api/event', () => ({
	emit: vi.fn(() => Promise.resolve()),
	listen: vi.fn(() => Promise.resolve(() => {}))
}));

import { invoke } from '@tauri-apps/api/core';
import { emit } from '@tauri-apps/api/event';
import { settings } from '$lib/stores/settings.svelte';
import { updater } from '$lib/stores/updater.svelte';
import Page from './+page.svelte';

const reader = { id: 1, name: 'Bruno', exportPath: null };

describe('/definicoes', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		appWindow.closeRequested = null;
		vi.mocked(invoke).mockImplementation((cmd: string) => {
			if (cmd === 'list_readers') return Promise.resolve([reader]);
			if (cmd === 'last_reader') return Promise.resolve(reader.id);
			if (cmd === 'load_settings') return Promise.resolve(structuredClone(onDisk));
			return Promise.resolve(null);
		});
		// The layout loads the settings before the page is used
		await settings.load();
	});

	it('shows the Reader the main window has open', async () => {
		render(Page);
		expect(await screen.findByTestId('reader-name')).toHaveValue('Bruno');
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
		// settings-changed only comes from Rust after save_settings
		expect(invoke).not.toHaveBeenCalledWith('save_settings', expect.anything());
		expect(emit).not.toHaveBeenCalled();
	});

	it('saved_language_updates_window_title', async () => {
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: /Appearance/ }));
		await fireEvent.click(screen.getByRole('button', { name: 'Português' }));
		expect(appWindow.setTitle).not.toHaveBeenCalled();

		await fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

		await waitFor(() => expect(appWindow.setTitle).toHaveBeenCalledWith('Settings'));
		expect(invoke).toHaveBeenCalledWith('save_settings', expect.anything());
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
