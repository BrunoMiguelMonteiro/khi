import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn() }));

import UpdateDialog from './UpdateDialog.svelte';
import { updater } from '../stores/updater.svelte';

const update = {
	version: '1.3.0',
	currentVersion: '1.1.0',
	rawJson: {
		khi_releases: [
			{ version: '1.3.0', date: '2026-02-09', notes: { en: { whats_new: ['Chapters from the Kobo table of contents'], bug_fixes: ['Notification layout'] } } },
			{ version: '1.2.0', date: '2026-02-07', notes: { en: { whats_new: ['Copy citation'], bug_fixes: [] } } },
			{ version: '1.1.0', date: '2026-01-20', notes: { en: { whats_new: ['Already installed'], bug_fixes: [] } } }
		]
	},
	close: vi.fn().mockResolvedValue(undefined)
};

describe('UpdateDialog', () => {
	beforeEach(() => {
		updater.close();
	});

	it('shows the notes of every version since the installed one', () => {
		updater.update = update as never;
		updater.state = 'available';
		render(UpdateDialog, { isBusy: () => false });

		expect(screen.getByText('Khi 1.3.0')).toBeInTheDocument();
		expect(screen.getByText('Khi 1.2.0')).toBeInTheDocument();
		expect(screen.queryByText('Khi 1.1.0')).not.toBeInTheDocument();
		expect(screen.getByText('Chapters from the Kobo table of contents')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Install and Restart' })).toHaveFocus();
	});

	it('a failed install names the version instead of talking about checking', () => {
		updater.update = update as never;
		updater.state = 'error';
		updater.errorKind = 'install';
		render(UpdateDialog, { isBusy: () => false });

		expect(screen.getByText('Couldn’t Install the Update')).toBeInTheDocument();
		expect(screen.getByText('Khi 1.3.0 wasn’t installed. Check your internet connection and try again.')).toBeInTheDocument();
		expect(screen.queryByText('Couldn’t Check for Updates')).not.toBeInTheDocument();
	});

	it('the installed message fits a sync as well as an export', () => {
		updater.update = update as never;
		updater.state = 'installed';
		render(UpdateDialog, { isBusy: () => true });

		expect(screen.getByText('Khi restarts on its own when the current sync or export finishes.')).toBeInTheDocument();
	});

	it('Escape closes the dialog', async () => {
		updater.state = 'upToDate';
		render(UpdateDialog, { isBusy: () => false });
		expect(screen.getByTestId('update-dialog')).toBeInTheDocument();

		await fireEvent.keyDown(window, { key: 'Escape' });

		expect(updater.state).toBe('idle');
		expect(screen.queryByTestId('update-dialog')).not.toBeInTheDocument();
	});
});
