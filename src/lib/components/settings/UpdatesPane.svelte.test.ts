import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { library } from '$lib/stores/library.svelte';
import UpdatesPane from './UpdatesPane.svelte';
import { rustKeeps, openStores, type Rust } from './test-support';

let rust: Rust;
const onerror = vi.fn();
const onCheckNow = vi.fn();

type Props = { lastChecked?: Date | null; busy?: boolean; version?: string };

async function show({ lastChecked = null, busy = false, version = '1.3.0' }: Props = {}) {
	rust = rustKeeps();
	await openStores(rust);
	const user = userEvent.setup();
	const view = render(UpdatesPane, { onerror, onCheckNow, lastChecked, busy, version });
	return { user, ...view };
}
const checkNow = () => screen.getByRole('button', { name: 'Check Now' });

describe('UpdatesPane', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		library.readers = [];
		library.activeReaderId = null;
	});

	it('is one group with no heading and two rows: the switch, and the version', async () => {
		await show();

		expect(screen.queryByRole('heading')).toBeNull();
		expect(document.querySelectorAll('[data-slot="form-group"]')).toHaveLength(1);
		expect(document.querySelectorAll('[data-slot="form-row"]')).toHaveLength(2);
		expect(screen.getByText('Automatically check for updates')).toBeInTheDocument();
		expect(screen.getByText('Once a day, when Khi opens.')).toBeInTheDocument();
		expect(screen.getByRole('switch', { name: 'Automatically check for updates' })).toBeChecked();
		expect(screen.getByText('Version 1.3.0')).toBeInTheDocument();
	});

	it('the switch is saved at the moment, with settings.commit', async () => {
		const { user } = await show();

		await user.click(screen.getByRole('switch', { name: 'Automatically check for updates' }));

		await waitFor(() => expect(rust.patches).toEqual([{ checkForUpdates: false }]));
		expect(screen.getByRole('switch', { name: 'Automatically check for updates' })).not.toBeChecked();
	});

	it('a failed save shows the error, and the next change clears it', async () => {
		const { user } = await show();
		const real = vi.mocked((await import('@tauri-apps/api/core')).invoke).getMockImplementation()!;
		vi.mocked((await import('@tauri-apps/api/core')).invoke).mockImplementation((cmd: string, args?: unknown) =>
			cmd === 'update_settings' ? Promise.reject('disk full') : real(cmd, args as never)
		);

		await user.click(screen.getByRole('switch', { name: 'Automatically check for updates' }));

		await waitFor(() => expect(onerror).toHaveBeenLastCalledWith('Error saving settings'));
		expect(onerror).toHaveBeenCalledWith(null);
	});

	it('says «Checked today at 5:10 PM.» when it was today', async () => {
		const at = new Date();
		at.setHours(17, 10, 0, 0);
		await show({ lastChecked: at });

		const time = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(at);
		expect(screen.getByText(`Checked today at ${time}.`)).toBeInTheDocument();
	});

	it('says the date when it was another day, and «Not checked yet.» when never', async () => {
		const before = new Date('2026-01-05T09:00:00');
		const { rerender } = await show({ lastChecked: before });
		const date = new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(before);
		expect(screen.getByText(`Checked on ${date}.`)).toBeInTheDocument();

		await rerender({ onerror, onCheckNow, lastChecked: null, busy: false, version: '1.3.0' });
		expect(screen.getByText('Not checked yet.')).toBeInTheDocument();
	});

	it('follows a new lastChecked, as the main window reports it', async () => {
		const { rerender } = await show({ lastChecked: null });
		expect(screen.getByText('Not checked yet.')).toBeInTheDocument();

		const at = new Date();
		await rerender({ onerror, onCheckNow, lastChecked: at, busy: false, version: '1.3.0' });

		expect(screen.queryByText('Not checked yet.')).toBeNull();
		expect(screen.getByText(/^Checked today at /)).toBeInTheDocument();
	});

	it('«Check Now» is a Secundário button that asks for a check', async () => {
		const { user } = await show();

		expect(checkNow().className).toContain('border-input-strong');
		await user.click(checkNow());

		expect(onCheckNow).toHaveBeenCalledOnce();
	});

	it('«Check Now» waits while the main window checks or installs, and a click then asks for nothing', async () => {
		const { user } = await show({ busy: true });

		expect(checkNow()).toHaveAttribute('aria-disabled', 'true');
		await user.click(checkNow());

		expect(onCheckNow).not.toHaveBeenCalled();
	});
});
