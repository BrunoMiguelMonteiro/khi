import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'svelte';

vi.mock('@tauri-apps/plugin-updater', () => ({ check: vi.fn() }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: vi.fn() }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn() }));
// The real translations, to try the language
vi.mock('$lib/i18n', async () => await vi.importActual('$lib/i18n'));

import { locale } from '$lib/i18n';
import UpdateDialog from './UpdateDialog.svelte';
import { updater } from '../stores/updater.svelte';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const release = (version: string, date: string) => ({
	version,
	date,
	notes: {
		en: { whats_new: [`New in ${version}`], bug_fixes: [`Fixed in ${version}`] },
		pt: { whats_new: [`Novo na ${version}`], bug_fixes: [`Corrigido na ${version}`] }
	}
});

function updateWith(newer: number) {
	const versions = ['1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0', '2.0.0', '2.1.0', '2.2.0', '2.3.0'].slice(0, newer);
	return {
		version: versions[versions.length - 1] ?? '1.1.0',
		currentVersion: '1.1.0',
		rawJson: {
			khi_releases: [
				release('1.1.0', '2026-01-20'),
				...versions.map((version, i) => release(version, `2026-02-${String(7 + i).padStart(2, '0')}`))
			]
		},
		close: vi.fn().mockResolvedValue(undefined)
	};
}
const update = updateWith(2);

const windowEl = () => screen.getByTestId('update-dialog');
const button = (name: string) => screen.getByRole('button', { name });

function show(phase: typeof updater.state, extra: { busy?: boolean; newer?: number } = {}) {
	updater.update = updateWith(extra.newer ?? 2) as never;
	updater.state = phase;
	return render(UpdateDialog, { isBusy: () => extra.busy ?? false });
}

describe('UpdateDialog', () => {
	beforeEach(() => {
		updater.close();
		updater.progress = { done: 0, total: null };
		updater.errorKind = 'check';
		locale.set('en');
	});
	afterEach(() => vi.restoreAllMocks());

	describe('the U3 window', () => {
		it('shows the notes of every version since the installed one', async () => {
			show('available');

			expect(await screen.findByText('Khi 1.3.0')).toBeInTheDocument();
			expect(screen.getByText('Khi 1.2.0')).toBeInTheDocument();
			expect(screen.queryByText('Khi 1.1.0')).not.toBeInTheDocument();
			expect(screen.getByText('New in 1.3.0')).toBeInTheDocument();
		});

		it('has the title, the sentence, and the three buttons: Skip on the left, Later and Install on the right', async () => {
			show('available');

			expect(await screen.findByRole('heading', { name: 'Khi 1.3.0 is available.' })).toBeInTheDocument();
			const footer = windowEl().querySelector('[data-slot="dialog-footer"]')!;
			expect([...footer.querySelectorAll('button')].map((b) => b.textContent?.trim())).toEqual(['Skip This Version', 'Later', 'Install and Restart']);
			expect(footer).toHaveClass('justify-between');
			expect(button('Skip This Version').className).toContain('text-link');
			expect(button('Later').className).toContain('border-input-strong');
			expect(button('Install and Restart')).toHaveAttribute('data-dialog-default');
			expect(button('Install and Restart').className).toContain('bg-primary');
		});

		it('writes the number of versions out: «Two versions…», and one in the singular', async () => {
			const { unmount } = show('available', { newer: 2 });
			await screen.findByTestId('update-dialog');
			expect(await screen.findByText('Version 1.1.0 is installed. Two versions have been released since. Khi restarts after installing.')).toBeInTheDocument();
			unmount();
			updater.close();

			show('available', { newer: 1 });
			expect(await screen.findByText('Version 1.1.0 is installed. One version has been released since. Khi restarts after installing.')).toBeInTheDocument();
		});

		it('writes the number in Portuguese, feminine, and in digits from eleven', async () => {
			locale.set('pt');
			const { unmount } = show('available', { newer: 3 });
			expect(await screen.findByText('Está instalada a versão 1.1.0. Desde então saíram três versões. Khi reinicia-se depois de instalar.')).toBeInTheDocument();
			unmount();
			updater.close();

			show('available', { newer: 11 });
			expect(await screen.findByText('Está instalada a versão 1.1.0. Desde então saíram 11 versões. Khi reinicia-se depois de instalar.')).toBeInTheDocument();
		});

		it('the notes box is 232 px tall, scrolls, takes focus and is a named region, with the date in full', async () => {
			show('available');

			const notes = await screen.findByTestId('release-notes');
			expect(notes).toHaveClass('h-58', 'overflow-y-auto', 'bg-muted');
			expect(notes).toHaveAttribute('tabindex', '0');
			expect(notes).toHaveAttribute('role', 'region');
			expect(notes).toHaveAccessibleName('Release notes');
			expect(within(notes).getByText(new Intl.DateTimeFormat('en', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date('2026-02-08T00:00:00')))).toBeInTheDocument();
		});

		it('the items are native lists with a hanging indent, under «What’s new» and «Bug fixes»', async () => {
			show('available');

			const notes = await screen.findByTestId('release-notes');
			const lists = notes.querySelectorAll('ul');
			expect(lists).toHaveLength(4);
			for (const list of lists) expect(list).toHaveClass('list-outside', 'list-disc');
			expect(within(notes).getAllByText('What’s new')).toHaveLength(2);
			expect(within(notes).getAllByText('Bug fixes')).toHaveLength(2);
			expect(within(lists[0]).getByRole('listitem')).toHaveTextContent('New in 1.3.0');
		});
	});

	describe('one window for the whole flow (Q1)', () => {
		it('is 480 wide in the U3 and 380 in every other phase', async () => {
			show('available');
			expect(await screen.findByTestId('update-dialog')).toHaveClass('w-120');
			expect(windowEl()).not.toHaveClass('w-95');

			for (const phase of ['checking', 'upToDate', 'downloading', 'installed', 'error'] as const) {
				updater.state = phase;
				await waitFor(() => expect(windowEl()).toHaveClass('w-95'));
				expect(windowEl()).not.toHaveClass('w-120');
			}
			updater.state = 'available';
			await waitFor(() => expect(windowEl()).toHaveClass('w-120'));
		});

		it('keeps the same window, open, from «Checking» to «Up to date»: no closing and opening again', async () => {
			show('checking');
			const first = await screen.findByTestId('update-dialog');
			expect(first).toHaveAttribute('data-state', 'open');

			updater.update = null;
			updater.state = 'upToDate';
			await screen.findByRole('heading', { name: 'Khi is up to date.' });

			expect(screen.getByTestId('update-dialog')).toBe(first);
			expect(first).toHaveAttribute('data-state', 'open');
			expect(document.querySelectorAll('[data-slot="dialog-content"]')).toHaveLength(1);
		});

		it('changes the content with no animation of its own', async () => {
			show('checking');
			await screen.findByRole('heading', { name: 'Checking for updates…' });

			updater.state = 'upToDate';
			await screen.findByRole('heading', { name: 'Khi is up to date.' });

			// Only the bar's own loop (and the width of the determinate one) moves; nothing fades or zooms the content
			const classes = [...windowEl().querySelectorAll('*')].flatMap((el) => [...el.classList]);
			expect(classes.filter((c) => /(^|:)(animate-|fade-|zoom-|slide-)/.test(c) && !c.includes('animate-indeterminate') && !c.includes('animate-none'))).toEqual([]);
		});

		it('leaves the page when it has closed, and a new flow opens it again', async () => {
			show('upToDate');
			await screen.findByTestId('update-dialog');

			updater.close();
			await waitFor(() => expect(screen.queryByTestId('update-dialog')).toBeNull());
			expect(document.querySelector('[data-slot="dialog-content"]')).toBeNull();

			updater.update = null;
			updater.state = 'checking';
			expect(await screen.findByRole('heading', { name: 'Checking for updates…' })).toBeInTheDocument();
		});

		it('while it fades out it keeps the phase it had: the U3 stays 480 wide with its title', async () => {
			// An animation that never finishes by itself, as the fade-out is: the test ends it
			let finish: () => void = () => {};
			const finished = new Promise<void>((resolve) => (finish = resolve));
			const getAnimations = vi.fn(() => [{ finished, pending: false, playState: 'running' }]);
			Object.defineProperty(Element.prototype, 'getAnimations', { configurable: true, value: getAnimations });
			try {
				show('available');
				await screen.findByTestId('update-dialog');
				getAnimations.mockClear();

				updater.close();
				await waitFor(() => expect(windowEl()).toHaveAttribute('data-state', 'closed'));

				// The updater is idle and has no update, and the window still shows the U3
				expect(updater.update).toBeNull();
				expect(windowEl()).toHaveClass('w-120');
				expect(windowEl()).not.toHaveClass('w-95');
				expect(within(windowEl()).getByRole('heading', { name: 'Khi 1.3.0 is available.' })).toBeInTheDocument();
				expect(within(windowEl()).getByText('Khi 1.2.0')).toBeInTheDocument();

				finish();
				await waitFor(() => expect(screen.queryByTestId('update-dialog')).toBeNull());
			} finally {
				delete (Element.prototype as { getAnimations?: unknown }).getAnimations;
			}
		});

		it('renders nothing while idle or waiting to restart', () => {
			render(UpdateDialog, { isBusy: () => false });
			expect(screen.queryByTestId('update-dialog')).toBeNull();

			updater.state = 'restartPending';
			flushSync();
			expect(screen.queryByTestId('update-dialog')).toBeNull();
		});
	});

	describe('the phases', () => {
		it('2 · Checking: a bar with no value, and Cancel', async () => {
			show('checking');

			await screen.findByRole('heading', { name: 'Checking for updates…' });
			const bar = screen.getByRole('progressbar');
			expect(bar).not.toHaveAttribute('aria-valuenow');
			// The Figma «Espaço» (4 px, with 8 px on each side) puts the bar 12 px lower than the window's gap does
			expect(bar).toHaveClass('mt-3');
			expect(button('Cancel')).toBeInTheDocument();
			expect(windowEl().querySelector('[data-dialog-default]')).toBeNull();
		});

		it('3 · Up to date: the sentence and OK', async () => {
			updater.currentVersion = '1.3.0';
			show('upToDate');

			expect(await screen.findByText('Version 1.3.0 is the latest version.')).toBeInTheDocument();
			expect(button('OK')).toHaveAttribute('data-dialog-default');
		});

		it('4 · Downloading: a determinate bar with its value, «4.3 MB of 6.9 MB» and Cancel', async () => {
			updater.progress = { done: 4_300_000, total: 6_900_000 };
			show('downloading');

			await screen.findByRole('heading', { name: 'Downloading Khi 1.3.0' });
			const bar = screen.getByRole('progressbar');
			expect(bar).toHaveAttribute('aria-valuenow', '62');
			expect(bar).toHaveClass('mt-3');
			expect(screen.getByText('4.3 MB of 6.9 MB')).toBeInTheDocument();
			expect(button('Cancel')).not.toHaveAttribute('aria-disabled', 'true');
		});

		it('4 · Downloading without a known size: the bar has no value and the text counts what came', async () => {
			updater.progress = { done: 1_500_000, total: null };
			show('downloading');

			await screen.findByRole('heading', { name: 'Downloading Khi 1.3.0' });
			expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');
			expect(screen.getByText('1.5 MB')).toBeInTheDocument();
		});

		it('installing: «Installing…» and Cancel is disabled', async () => {
			updater.progress = { done: 6_900_000, total: 6_900_000 };
			show('installing');

			expect(await screen.findByText('Installing…')).toBeInTheDocument();
			expect(button('Cancel')).toHaveAttribute('aria-disabled', 'true');
		});

		it('5 · Installed: Restart Now (Secundário) and OK (Principal), with the text for a sync or an export', async () => {
			show('installed', { busy: true });

			expect(await screen.findByText('Khi restarts on its own when the current sync or export finishes.')).toBeInTheDocument();
			expect(button('Restart Now').className).toContain('border-input-strong');
			expect(button('Restart Now')).not.toHaveAttribute('data-dialog-default');
			expect(button('OK')).toHaveAttribute('data-dialog-default');
		});

		it('6 · No connection: the check’s text, Cancel and Try Again', async () => {
			show('error');

			expect(await screen.findByRole('heading', { name: 'Couldn’t check for updates.' })).toBeInTheDocument();
			expect(screen.getByText('Check your internet connection and try again.')).toBeInTheDocument();
			expect(button('Try Again')).toHaveAttribute('data-dialog-default');
			expect(button('Cancel')).not.toHaveAttribute('data-dialog-default');
		});

		it('7 · A failed install names the version instead of talking about checking', async () => {
			updater.errorKind = 'install';
			show('error');

			expect(await screen.findByText('Couldn’t install the update.')).toBeInTheDocument();
			expect(screen.getByText('Khi 1.3.0 wasn’t installed. Check your internet connection and try again.')).toBeInTheDocument();
			expect(screen.queryByText('Couldn’t check for updates.')).not.toBeInTheDocument();
		});
	});

	describe('buttons', () => {
		it('Skip skips the version, Later closes, Install installs', async () => {
			const user = userEvent.setup();
			const skip = vi.spyOn(updater, 'skip').mockImplementation(() => {});
			const close = vi.spyOn(updater, 'close');
			const install = vi.spyOn(updater, 'install').mockResolvedValue(undefined);
			show('available');

			await user.click(await screen.findByRole('button', { name: 'Skip This Version' }));
			expect(skip).toHaveBeenCalledOnce();
			await user.click(button('Install and Restart'));
			expect(install).toHaveBeenCalledOnce();
			close.mockClear();
			await user.click(button('Later'));
			expect(close).toHaveBeenCalledOnce();
		});

		it('Restart Now restarts, OK dismisses «Installed»', async () => {
			const user = userEvent.setup();
			const restartNow = vi.spyOn(updater, 'restartNow').mockResolvedValue(undefined as never);
			const dismiss = vi.spyOn(updater, 'dismissInstalled').mockImplementation(() => {});
			show('installed', { busy: true });

			await user.click(await screen.findByRole('button', { name: 'Restart Now' }));
			expect(restartNow).toHaveBeenCalledOnce();
			await user.click(button('OK'));
			expect(dismiss).toHaveBeenCalledOnce();
		});

		it('Try Again retries, Cancel closes', async () => {
			const user = userEvent.setup();
			const retry = vi.spyOn(updater, 'retry').mockResolvedValue(undefined);
			const close = vi.spyOn(updater, 'close');
			show('error');

			await user.click(await screen.findByRole('button', { name: 'Try Again' }));
			expect(retry).toHaveBeenCalledOnce();
			close.mockClear();
			await user.click(button('Cancel'));
			expect(close).toHaveBeenCalledOnce();
		});

		it('OK in «Up to date» closes', async () => {
			const user = userEvent.setup();
			const close = vi.spyOn(updater, 'close');
			show('upToDate');

			await user.click(await screen.findByRole('button', { name: 'OK' }));

			expect(close).toHaveBeenCalledOnce();
		});
	});

	describe('focus and keys', () => {
		it('focuses the window itself, not a button (macOS: buttons only with Tab)', async () => {
			show('available');

			const dialog = await screen.findByTestId('update-dialog');
			await waitFor(() => expect(dialog).toHaveFocus());
			expect(button('Install and Restart')).not.toHaveFocus();
		});

		it('gets the focus back when a phase takes away the button that had it', async () => {
			const user = userEvent.setup();
			show('checking');
			await screen.findByRole('heading', { name: 'Checking for updates…' });
			await user.tab();
			expect(button('Cancel')).toHaveFocus();

			updater.update = null;
			updater.state = 'upToDate';
			await screen.findByRole('heading', { name: 'Khi is up to date.' });

			await waitFor(() => expect(windowEl().contains(document.activeElement)).toBe(true));
			await waitFor(() => expect(windowEl()).toHaveFocus());
		});

		it('Return on the window presses the default button of each phase', async () => {
			const install = vi.spyOn(updater, 'install').mockResolvedValue(undefined);
			const close = vi.spyOn(updater, 'close');
			const dismiss = vi.spyOn(updater, 'dismissInstalled').mockImplementation(() => {});
			const retry = vi.spyOn(updater, 'retry').mockResolvedValue(undefined);
			show('available');
			await screen.findByTestId('update-dialog');

			await fireEvent.keyDown(windowEl(), { key: 'Enter' });
			expect(install).toHaveBeenCalledOnce();

			updater.state = 'upToDate';
			await screen.findByRole('heading', { name: 'Khi is up to date.' });
			close.mockClear();
			await fireEvent.keyDown(windowEl(), { key: 'Enter' });
			expect(close).toHaveBeenCalledOnce();

			updater.update = updateWith(2) as never;
			updater.state = 'installed';
			await screen.findByRole('heading', { name: /is installed\./ });
			await fireEvent.keyDown(windowEl(), { key: 'Enter' });
			expect(dismiss).toHaveBeenCalledOnce();

			updater.state = 'error';
			await screen.findByRole('heading', { name: 'Couldn’t check for updates.' });
			await fireEvent.keyDown(windowEl(), { key: 'Enter' });
			expect(retry).toHaveBeenCalledOnce();
			vi.restoreAllMocks();
		});

		it('Return in «Checking» and «Downloading» presses nothing', async () => {
			const close = vi.spyOn(updater, 'close');
			show('checking');
			await screen.findByTestId('update-dialog');
			close.mockClear();

			await fireEvent.keyDown(windowEl(), { key: 'Enter' });
			updater.state = 'downloading';
			await screen.findByRole('heading', { name: 'Downloading Khi 1.3.0' });
			await fireEvent.keyDown(windowEl(), { key: 'Enter' });

			expect(close).not.toHaveBeenCalled();
			vi.restoreAllMocks();
		});

		it('Return with the focus in the notes box presses Install: the box only scrolls', async () => {
			const install = vi.spyOn(updater, 'install').mockResolvedValue(undefined);
			show('available');
			const notes = await screen.findByTestId('release-notes');
			notes.focus();
			expect(notes).toHaveFocus();

			await fireEvent.keyDown(notes, { key: 'Enter' });

			expect(install).toHaveBeenCalledOnce();
		});

		it('Return on another focused button leaves the default button alone', async () => {
			const install = vi.spyOn(updater, 'install').mockResolvedValue(undefined);
			show('available');
			const later = await screen.findByRole('button', { name: 'Later' });
			later.focus();

			await fireEvent.keyDown(later, { key: 'Enter' });

			expect(install).not.toHaveBeenCalled();
			install.mockRestore();
		});

		for (const phase of ['available', 'checking', 'upToDate', 'downloading', 'error'] as const) {
			it(`Esc and ⌘. close the window as Cancel or Later do, in «${phase}»`, async () => {
				const user = userEvent.setup();
				// close does nothing here, so the window is still open and in the same phase for ⌘.
				const close = vi.spyOn(updater, 'close').mockImplementation(() => {});
				show(phase);
				const dialog = await screen.findByTestId('update-dialog');
				await waitFor(() => expect(dialog).toHaveFocus());
				close.mockClear();

				await user.keyboard('{Escape}');
				expect(close).toHaveBeenCalledOnce();
				expect(updater.state).toBe(phase);

				close.mockClear();
				await fireEvent.keyDown(dialog, { key: '.', metaKey: true });
				expect(close).toHaveBeenCalledOnce();
			});
		}

		it('Esc and ⌘. answer «Installed» as OK does', async () => {
			const user = userEvent.setup();
			const dismiss = vi.spyOn(updater, 'dismissInstalled').mockImplementation(() => {});
			show('installed');
			const dialog = await screen.findByTestId('update-dialog');
			await waitFor(() => expect(dialog).toHaveFocus());

			await user.keyboard('{Escape}');
			expect(dismiss).toHaveBeenCalledOnce();
			dismiss.mockClear();
			await fireEvent.keyDown(dialog, { key: '.', metaKey: true });
			expect(dismiss).toHaveBeenCalledOnce();
		});

		it('Esc and ⌘. do nothing while it installs', async () => {
			const user = userEvent.setup();
			const close = vi.spyOn(updater, 'close');
			const dismiss = vi.spyOn(updater, 'dismissInstalled');
			updater.progress = { done: 1, total: 1 };
			show('installing');
			const dialog = await screen.findByTestId('update-dialog');
			await waitFor(() => expect(dialog).toHaveFocus());
			close.mockClear();

			await user.keyboard('{Escape}');
			await fireEvent.keyDown(dialog, { key: '.', metaKey: true });

			expect(close).not.toHaveBeenCalled();
			expect(dismiss).not.toHaveBeenCalled();
			expect(updater.state).toBe('installing');
			expect(screen.getByTestId('update-dialog')).toBeInTheDocument();
			close.mockRestore();
			dismiss.mockRestore();
		});

		it('a click outside the window does not close it', async () => {
			const close = vi.spyOn(updater, 'close');
			show('available');
			await screen.findByTestId('update-dialog');
			close.mockClear();
			// Bits' dismissible layer arms itself ~20 ms after mounting
			await new Promise((resolve) => setTimeout(resolve, 60));

			// What Bits UI's dismissible layer listens for: a pointer pressed outside the window's box (jsdom boxes are 0x0, hence the coordinates)
			for (const target of [document.querySelector('[data-slot="dialog-overlay"]') ?? document.body, document.body]) {
				// jsdom has no PointerEvent: a MouseEvent named pointerdown carries the coordinates Bits reads
				const down = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0, clientX: 5, clientY: 5 });
				Object.defineProperty(down, 'pointerType', { value: 'mouse' });
				target.dispatchEvent(down);
				await fireEvent.click(target);
			}
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(close).not.toHaveBeenCalled();
			expect(updater.state).toBe('available');
			expect(screen.getByTestId('update-dialog')).toHaveAttribute('data-state', 'open');
		});
	});
});
