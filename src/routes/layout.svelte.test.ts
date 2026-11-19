import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

const label = vi.hoisted(() => ({ current: 'main' }));
const show = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => ({ label: label.current, show })
}));
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn(() => Promise.resolve()) }));
vi.mock('$lib/stores/settings.svelte', () => ({
	settings: {
		initialize: vi.fn(() => Promise.resolve()),
		uiPreferences: { checkForUpdates: true }
	}
}));
vi.mock('$lib/stores/updater.svelte', () => ({
	updater: {
		loadVersion: vi.fn(() => Promise.resolve()),
		checkOnLaunch: vi.fn(() => Promise.resolve())
	}
}));

import { emit } from '@tauri-apps/api/event';
import { settings } from '$lib/stores/settings.svelte';
import { updater } from '$lib/stores/updater.svelte';
import Layout from './+layout.svelte';

const children = createRawSnippet(() => ({ render: () => '<p>page</p>' }));

describe('+layout', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'log').mockImplementation(() => {});
	});

	it('in the main window: signals app-ready and checks for updates', async () => {
		label.current = 'main';
		render(Layout, { children });

		await waitFor(() => expect(updater.checkOnLaunch).toHaveBeenCalledWith(true));
		expect(emit).toHaveBeenCalledWith('app-ready');
		// Rust shows the main window on app-ready
		expect(show).not.toHaveBeenCalled();
	});

	it('settings_window_shows_itself_once_initialized', async () => {
		label.current = 'settings';
		let initialized = false;
		vi.mocked(settings.initialize).mockImplementationOnce(async () => {
			await Promise.resolve();
			initialized = true;
		});
		let initializedWhenShown: boolean | null = null;
		show.mockImplementationOnce(() => {
			initializedWhenShown = initialized;
			return Promise.resolve();
		});
		render(Layout, { children });

		await waitFor(() => expect(show).toHaveBeenCalledTimes(1));
		// Built hidden: shown only with its theme and language applied
		expect(initializedWhenShown).toBe(true);
	});

	it('layout_skips_app_ready_and_updater_outside_main', async () => {
		label.current = 'settings';
		render(Layout, { children });

		// The settings, the theme and the version (shown in Updates) still load
		await waitFor(() => expect(updater.loadVersion).toHaveBeenCalled());
		expect(settings.initialize).toHaveBeenCalled();
		expect(emit).not.toHaveBeenCalledWith('app-ready');
		expect(updater.checkOnLaunch).not.toHaveBeenCalled();
	});
});
