import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync, tick } from 'svelte';

const handlers = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => void>());
/** The window's own listeners (`onResized`, `onFocusChanged`), by name, and what ends them. */
const windowEvents = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => void>());
const windowUnlisten = vi.hoisted(() => ({ resized: vi.fn(), focus: vi.fn() }));
const mainWindow = vi.hoisted(() => ({
	label: 'main',
	setTheme: vi.fn(() => Promise.resolve()),
	setFocus: vi.fn(() => Promise.resolve()),
	isFullscreen: vi.fn(() => Promise.resolve(false)),
	onResized: vi.fn((handler: (event: { payload: unknown }) => void) => {
		windowEvents.set('resized', handler);
		return Promise.resolve(windowUnlisten.resized);
	}),
	onFocusChanged: vi.fn((handler: (event: { payload: unknown }) => void) => {
		windowEvents.set('focus', handler);
		return Promise.resolve(windowUnlisten.focus);
	})
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
import { library } from '$lib/stores/library.svelte';
import { makeBook, makeDevice } from '$lib/test-fixtures';
import { updater } from '$lib/stores/updater.svelte';
import Page from './+page.svelte';

// jsdom has no pointer capture, which Bits UI's triggers release on pointerdown
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
// jsdom has no Web Animations; the toast and the header fade
Element.prototype.animate ??= vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve(), onfinish: null })) as never;

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
		// Off, so a connected Kobo shows the Library without a Sync
		syncOnConnect: false,
		checkForUpdates: true
	},
	language: 'en',
	version: '1.3.0'
};

const kobo = makeDevice({ name: 'Kobo Libra', path: '/Volumes/KOBO', isValid: true, serialNumber: 'N418' });

const hl = (id: string, extra: Record<string, unknown> = {}) => ({ id, text: id, dateCreated: '2026-01-01', ...extra });
/** Three books: two with new highlights (3 in all), one without. Titles sort A, B, C. */
const newBooks = () => [
	makeBook({ id: 1, title: 'Alpha', author: 'A', highlights: [hl('a1', { isNew: true, syncedSeq: 2 }), hl('a2', { isNew: true, syncedSeq: 3 })] }),
	makeBook({ id: 2, title: 'Beta', author: 'B', highlights: [hl('b1')] }),
	makeBook({ id: 3, title: 'Gamma', author: 'C', highlights: [hl('c1', { isNew: true, syncedSeq: 4 }), hl('c2', { removedAt: '2026-02-01', isNew: true, syncedSeq: 4 })] })
];

type Options = {
	list?: typeof readers;
	books?: ReturnType<typeof newBooks>;
	/** Rust answers lastSyncAt only when a Kobo's serial is passed. */
	summary?: { newSince: string | null; lastSyncAt: string | null };
	device?: typeof kobo | null;
	lastReader?: number | null;
	syncOnConnect?: boolean;
	/** A thrown error is a rejected command. */
	overrides?: Record<string, (args: unknown) => unknown>;
};

/** Reader 1 open; `update_settings` answers the store's settings. */
async function mockLibrary({ list = readers, books = [], summary, device = null, lastReader = 1, syncOnConnect = false, overrides = {} }: Options = {}) {
	vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
		if (cmd in overrides) return Promise.resolve().then(() => overrides[cmd](args));
		if (cmd === 'list_readers') return Promise.resolve(structuredClone(list));
		if (cmd === 'last_reader') return Promise.resolve(lastReader);
		if (cmd === 'get_library') return Promise.resolve(structuredClone(books));
		if (cmd === 'scan_for_device') return Promise.resolve(device);
		if (cmd === 'reader_for_kobo') return Promise.resolve(device ? 1 : null);
		if (cmd === 'library_summary') {
			const { koboSerial } = args as { koboSerial: string | null };
			return Promise.resolve(summary ? { ...summary, lastSyncAt: koboSerial ? summary.lastSyncAt : null } : { newSince: null, lastSyncAt: null });
		}
		if (cmd === 'load_settings') {
			const saved = structuredClone(onDisk);
			saved.uiPreferences.syncOnConnect = syncOnConnect;
			return Promise.resolve(saved);
		}
		if (cmd === 'update_settings') return Promise.resolve($state.snapshot(settings.state));
		return Promise.resolve(null);
	});
	await settings.initialize();
}

function resetLibrary() {
	library.clearBooks();
	library.deviceDisconnected();
	library.closeBook();
	library.activeReaderId = null;
	library.readers = [];
	library.isImporting = false;
	library.isExporting = false;
	library.summary = null;
	library.setUiState('no-device');
}

const bar = () => document.querySelector<HTMLElement>('[data-slot="window-bar"]');
const header = () => document.querySelector<HTMLElement>('[data-slot="library-header"]');
const options = () => screen.queryAllByRole('option');
const menuItem = async (name: string) => {
	await waitFor(() => expect(menuItems().some((i) => i.textContent?.trim() === name)).toBe(true));
	return menuItems().find((i) => i.textContent?.trim() === name)!;
};
const menuItems = () => [...document.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"]')];
/** The Sync button is disabled with aria-disabled, so the Kobo is known once it is not. */
const syncReady = () =>
	waitFor(() =>
		expect(within(bar()!).getByRole('button', { name: 'Sync with the Kobo' })).not.toHaveAttribute('aria-disabled', 'true')
	);
/**
 * jsdom has no Web Animations: Svelte's outros (the header's 150 ms fade) would never finish.
 * This runs each animation for its `duration` on a timer, then fires `onfinish`.
 */
function playAnimationsOnTimers() {
	const proto = Element.prototype as unknown as Record<string, unknown>;
	proto.getAnimations = () => [];
	proto.animate = function (_keyframes: unknown, options: { duration?: number } | number) {
		const duration = typeof options === 'number' ? options : (options?.duration ?? 0);
		const animation = {
			onfinish: null as null | (() => void),
			cancel: () => clearTimeout(timer),
			finish: () => animation.onfinish?.()
		};
		const timer = setTimeout(() => animation.onfinish?.(), duration);
		return animation;
	};
}

const calls = (cmd: string) => vi.mocked(invoke).mock.calls.filter(([c]) => c === cmd);

describe('+page', () => {
	beforeEach(() => {
		playAnimationsOnTimers();
		vi.mocked(invoke).mockReset();
		handlers.clear();
		mainWindow.setFocus.mockClear();
		resetLibrary();
	});

	it('shows an error when the chosen reader cannot be opened', async () => {
		vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
			if (cmd === 'list_readers') return Promise.resolve(readers);
			if (cmd === 'last_reader') return Promise.resolve(1);
			if (cmd === 'get_library') {
				const { readerId } = args as { readerId: number };
				return readerId === 1 ? Promise.resolve([]) : Promise.reject('database is locked');
			}
			return Promise.resolve(null);
		});
		const user = userEvent.setup();
		render(Page);

		// The readers live in the Title menu of the bar, no longer in a select
		await user.click(await screen.findByRole('button', { name: "Bruno's Library" }));
		await user.click(await menuItem('Ana'));

		// The error is a toast, no longer the inline notification
		const toast = await screen.findByText("Could not open this reader's Library");
		expect(toast.closest('[data-slot="toaster"]')).not.toBeNull();
	});

	it('page_has_no_settings_modal', async () => {
		await mockLibrary();
		render(Page);
		await waitFor(() => expect(bar()).not.toBeNull());

		// The gear is gone: Settings open with ⌘, (Rust), never as a panel in this window
		expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
		expect(invoke).not.toHaveBeenCalledWith('open_settings', expect.anything());
		expect(document.querySelector('[aria-labelledby="settings-title"]')).toBeNull();
		expect(vi.mocked(listen).mock.calls.map(([event]) => event)).not.toContain('open-settings');
	});

	it('main_sort_change_persists', async () => {
		await mockLibrary();
		const user = userEvent.setup();
		render(Page);

		await user.click(await screen.findByRole('button', { name: 'Sort by' }));
		await user.click(await menuItem('Author (A-Z)'));

		// Only the sort: the rest of the file is not this window's to write
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { librarySort: 'author' } });
		expect(settings.uiPreferences.librarySort).toBe('author');
	});

	it('main_view_change_persists', async () => {
		await mockLibrary();
		render(Page);
		const other = settings.uiPreferences.libraryViewMode === 'list' ? 'grid' : 'list';

		await fireEvent.click(await screen.findByRole('radio', { name: other === 'list' ? 'View as list' : 'View as grid' }));

		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { libraryViewMode: other } });
		expect(settings.uiPreferences.libraryViewMode).toBe(other);
	});

	it('applying_event_does_not_save_again', async () => {
		await mockLibrary();
		render(Page);
		await screen.findByRole('radiogroup', { name: 'View' });
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
		await mockLibrary();
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
		await mockLibrary({ list });
		render(Page);
		await screen.findByRole('button', { name: "Bruno's Library" });
		await waitFor(() => expect(handlers.has('readers-changed')).toBe(true));

		list[0].name = 'Bruno M.';
		handlers.get('readers-changed')!({ payload: null });

		expect(await screen.findByRole('button', { name: "Bruno M.'s Library" })).toBeInTheDocument();
	});
});

describe('+page · screen 1', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		handlers.clear();
		resetLibrary();
	});

	it('window_bar_is_mounted_in_every_state', async () => {
		const user = userEvent.setup();
		// no-device: no Reader at all
		await mockLibrary({ list: [], lastReader: null });
		const empty = render(Page);
		await screen.findByText('No Kobo connected');
		expect(bar()).not.toBeNull();
		expect(bar()!.querySelector('h1')).not.toBeNull();
		empty.unmount();

		// library
		resetLibrary();
		await mockLibrary({ books: newBooks() });
		const view = render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		expect(bar()).not.toBeNull();
		expect(within(bar()!).getByRole('button', { name: 'Sync with the Kobo' })).toBeInTheDocument();

		// importing: the bar stays, with the library controls
		library.isImporting = true;
		await tick();
		// The Library gives way to the importing state
		expect(options()).toHaveLength(0);
		expect(bar()).not.toBeNull();
		expect(within(bar()!).getByRole('radiogroup', { name: 'View' })).toBeInTheDocument();
		library.isImporting = false;
		await tick();

		// book-details: the bar of the detail, with Back and Export
		await user.click(options()[0]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		expect(bar()).not.toBeNull();
		expect(within(bar()!).getByRole('button', { name: 'Back' })).toBeInTheDocument();
		expect(within(bar()!).getByRole('button', { name: 'Export 1 book' })).toBeInTheDocument();
		// Not the library's controls
		expect(within(bar()!).queryByRole('radiogroup', { name: 'View' })).toBeNull();
		// The bar is outside <main>, so the traffic lights never sit over stale content
		expect(bar()!.closest('main')).toBeNull();
		view.unmount();
	});

	it('opening_a_book_goes_through_open_book', async () => {
		const user = userEvent.setup();
		await mockLibrary({ books: newBooks() });
		const open = vi.spyOn(library, 'openBook');
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));

		await user.click(options()[1]);

		expect(open).toHaveBeenCalledTimes(1);
		expect(open).toHaveBeenLastCalledWith(2);
		expect(library.uiState).toBe('book-details');
		expect(library.viewingBookId).toBe(2);
		expect(calls('mark_book_opened')).toHaveLength(1);

		await user.click(within(bar()!).getByRole('button', { name: 'Back' }));
		await waitFor(() => expect(options()).toHaveLength(3));

		options()[2].focus();
		await user.keyboard('{Enter}');

		expect(open).toHaveBeenCalledTimes(2);
		expect(open).toHaveBeenLastCalledWith(3);
		expect(library.uiState).toBe('book-details');
		expect(library.viewingBookId).toBe(3);
		open.mockRestore();
	});

	it('header_state_follows_counts_and_summary', async () => {
		const summary = { newSince: '2026-11-09T10:00:00Z', lastSyncAt: '2026-11-19T10:42:00Z' };
		const message = () => header()!.querySelector('[data-slot="library-header-message"]')!.textContent!.trim();
		const detail = () => header()!.querySelector('[data-slot="library-header-detail"]')?.textContent?.trim();

		// New highlights (removed ones do not count), a Kobo connected
		await mockLibrary({ books: newBooks(), summary, device: kobo });
		let view = render(Page);
		await waitFor(() => expect(header()).not.toBeNull());
		await waitFor(() => expect(header()!.dataset.state).toBe('novos'));
		expect(message()).toBe('3 new highlights in 2 books');
		expect(detail()).toBe('since Nov 9');
		expect(screen.getByRole('button', { name: 'Export 2 books' })).toBeInTheDocument();
		// «Show only these» waits for its design: the page passes no handler
		expect(screen.queryByRole('button', { name: 'Show only these' })).toBeNull();
		view.unmount();

		// New highlights but no `newSince`: no date
		resetLibrary();
		await mockLibrary({ books: newBooks(), summary: { newSince: null, lastSyncAt: null } });
		view = render(Page);
		await waitFor(() => expect(header()?.dataset.state).toBe('novos'));
		expect(detail()).toBeUndefined();
		view.unmount();

		// Nothing new, Kobo connected: no header at all
		resetLibrary();
		const read = newBooks().map((b) => ({ ...b, highlights: b.highlights.map((h) => ({ ...h, isNew: false })) }));
		await mockLibrary({ books: read, summary, device: kobo });
		view = render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		expect(header()).toBeNull();
		view.unmount();

		// Nothing new, no Kobo: no header either
		resetLibrary();
		await mockLibrary({ books: read, summary });
		view = render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		expect(header()).toBeNull();
		view.unmount();

		// No books: no header (the empty state is screen 6's)
		resetLibrary();
		await mockLibrary({ books: [], summary });
		view = render(Page);
		await screen.findByTestId('empty-state');
		expect(header()).toBeNull();
		view.unmount();
	});

	it('no_news_shows_no_header', async () => {
		const read = newBooks().map((b) => ({ ...b, highlights: b.highlights.map((h) => ({ ...h, isNew: false })) }));
		await mockLibrary({ books: read, summary: { newSince: '2026-11-09T10:00:00Z', lastSyncAt: '2026-11-19T10:42:00Z' }, device: kobo });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		expect(header()).toBeNull();
		expect(screen.queryByText('No new highlights')).toBeNull();
		expect(screen.queryByText(/synced at/)).toBeNull();
		// Nothing is left in the grid's place: the grid is the content's first child
		expect(screen.getByRole('listbox').parentElement!.firstElementChild).toBe(screen.getByRole('listbox'));
	});

	it('header_leaves_after_export_clears_news', async () => {
		const user = userEvent.setup();
		await mockLibrary({
			books: newBooks(),
			summary: { newSince: '2026-11-09T10:00:00Z', lastSyncAt: null },
			overrides: { export_library_books: () => ['/x/Alpha.md', '/x/Gamma.md'] }
		});
		render(Page);
		await waitFor(() => expect(header()?.dataset.state).toBe('novos'));

		await user.click(within(header()!).getByRole('button', { name: 'Export 2 books' }));

		await waitFor(() => expect(calls('mark_book_opened')).toHaveLength(2));
		// The header leaves, and nothing takes its place
		await waitFor(() => expect(header()).toBeNull());
		expect(screen.queryByText('No new highlights')).toBeNull();
	});

	it('header_follows_a_book_being_opened', async () => {
		const user = userEvent.setup();
		await mockLibrary({ books: newBooks(), summary: { newSince: '2026-11-09T10:00:00Z', lastSyncAt: null } });
		render(Page);
		await waitFor(() => expect(header()?.dataset.state).toBe('novos'));

		// Opening Alpha clears its new highlights: the count is reactive
		await user.click(options()[0]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		await user.click(within(bar()!).getByRole('button', { name: 'Back' }));

		await waitFor(() => expect(header()?.querySelector('[data-slot="library-header-message"]')?.textContent?.trim()).toBe('1 new highlight in 1 book'));
	});

	it('header_export_exports_books_with_news', async () => {
		const user = userEvent.setup();
		await mockLibrary({
			books: newBooks(),
			summary: { newSince: '2026-11-09T10:00:00Z', lastSyncAt: null },
			overrides: { export_library_books: () => ['/x/Alpha.md', '/x/Gamma.md'] }
		});
		render(Page);
		await waitFor(() => expect(header()?.dataset.state).toBe('novos'));
		// A selection that exists stays: the header exports the books with news without replacing it
		await user.keyboard('{Meta>}');
		await user.click(options()[1]);
		await user.keyboard('{/Meta}');

		await user.click(within(header()!).getByRole('button', { name: 'Export 2 books' }));

		await waitFor(() => expect(invoke).toHaveBeenCalledWith('export_library_books', { readerId: 1, bookIds: [1, 3] }));
		// The user's own selection is not touched by it
		expect(library.selectedBookIds).toEqual([2]);
		// The neutral toast, and the news are cleared
		expect(await screen.findByText('2 books exported')).toBeInTheDocument();
		await waitFor(() => expect(calls('mark_book_opened')).toHaveLength(2));
		expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 1, bookId: 1, seenSeq: 3 });
		expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 1, bookId: 3, seenSeq: 4 });
		await waitFor(() => expect(header()).toBeNull());
	});

	it('exported_mark_belongs_to_the_header_export_alone', async () => {
		const user = userEvent.setup();
		await mockLibrary({
			books: newBooks(),
			summary: { newSince: '2026-11-09T10:00:00Z', lastSyncAt: null },
			overrides: { export_library_books: () => ['/x/Alpha.md'] }
		});
		render(Page);
		await waitFor(() => expect(header()?.dataset.state).toBe('novos'));

		// ⌘E inside a book exports that book only: Gamma still has news
		await user.click(options()[0]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		await fireEvent.keyDown(window, { key: 'e', code: 'KeyE', metaKey: true });
		await waitFor(() => expect(invoke).toHaveBeenCalledWith('export_library_books', { readerId: 1, bookIds: [1] }));
		await screen.findByText('1 book exported');
		await user.click(within(bar()!).getByRole('button', { name: 'Back' }));

		// The header comes back with the news that are left, not with «✓ Exported»
		await waitFor(() => expect(header()?.dataset.state).toBe('novos'));
		expect(within(header()!).getByRole('button', { name: 'Export 1 book' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: '✓ Exported' })).toBeNull();
	});

	it('sync_error_shows_header_error_and_retry_syncs', async () => {
		const user = userEvent.setup();
		let attempts = 0;
		await mockLibrary({
			books: newBooks(),
			device: kobo,
			overrides: {
				sync_kobo: () => {
					if (++attempts === 1) throw 'disk is full';
					return { added: 0, updated: 0, removed: 0, restored: 0, books: 3 };
				}
			}
		});
		render(Page);
		await syncReady();

		await user.click(within(bar()!).getByRole('button', { name: 'Sync with the Kobo' }));

		await waitFor(() => expect(header()?.dataset.state).toBe('erro'));
		expect(screen.getAllByRole('alert').some((a) => a.textContent?.includes('Could not sync the Kobo'))).toBe(true);
		// The error is the header's: no toast for it
		expect(document.querySelector('[data-slot="toaster"]')?.textContent?.trim()).toBe('');

		await user.click(screen.getByRole('button', { name: 'Try again' }));

		await waitFor(() => expect(attempts).toBe(2));
		await waitFor(() => expect(header()?.dataset.state).not.toBe('erro'));
	});
});

describe('+page · review fixes', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		handlers.clear();
		resetLibrary();
	});

	const press = (key: string, init: KeyboardEventInit = { metaKey: true }) =>
		fireEvent.keyDown(window, { key, code: /^\d$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`, ...init });
	const never = () => new Promise(() => {});

	it('export_all_keeps_selection_empty', async () => {
		await mockLibrary({ books: newBooks(), overrides: { export_library_books: () => ['x'] } });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));

		await press('e');

		await waitFor(() => expect(invoke).toHaveBeenCalledWith('export_library_books', { readerId: 1, bookIds: [1, 2, 3] }));
		expect(library.selectedBookIds).toEqual([]);
	});

	it('held_cmd_e_exports_once', async () => {
		await mockLibrary({ books: newBooks(), overrides: { export_library_books: () => ['x'] } });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));

		await press('e');
		await press('e', { metaKey: true, repeat: true });
		await press('e', { metaKey: true, repeat: true });

		await waitFor(() => expect(calls('export_library_books')).toHaveLength(1));
		await new Promise((r) => setTimeout(r, 20));
		expect(calls('export_library_books')).toHaveLength(1);
	});

	it('second_export_while_exporting_is_ignored', async () => {
		const user = userEvent.setup();
		await mockLibrary({ books: newBooks(), overrides: { export_library_books: never } });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));

		await press('e');
		await waitFor(() => expect(library.isExporting).toBe(true));
		await press('e');
		await user.click(within(bar()!).getByRole('button', { name: 'Export 3 books' }));

		expect(calls('export_library_books')).toHaveLength(1);
	});

	it('export_ignored_while_importing', async () => {
		const user = userEvent.setup();
		await mockLibrary({ books: newBooks() });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		library.isImporting = true;
		await tick();

		await user.click(within(bar()!).getByRole('button', { name: 'Export 3 books' }));
		await press('e');

		expect(calls('export_library_books')).toHaveLength(0);
	});

	it('caps_lock_does_not_break_shortcuts', async () => {
		await mockLibrary({ books: newBooks(), overrides: { export_library_books: () => ['x'] } });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));

		// Caps Lock: `key` is «E», the physical key is still KeyE
		await fireEvent.keyDown(window, { key: 'E', code: 'KeyE', metaKey: true });

		await waitFor(() => expect(calls('export_library_books')).toHaveLength(1));
	});

	describe('a failed sync', () => {
		const failing = () => {
			let fail = true;
			return {
				sync_kobo: () => {
					if (fail) throw 'disk is full';
					return { added: 0, updated: 0, removed: 0, restored: 0, books: 3 };
				},
				heal: () => (fail = false)
			};
		};

		async function failedSync() {
			const user = userEvent.setup();
			const { sync_kobo } = failing();
			await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
			vi.spyOn(console, 'error').mockImplementation(() => {});
			render(Page);
			await syncReady();
			await user.click(within(bar()!).getByRole('button', { name: 'Sync with the Kobo' }));
			await waitFor(() => expect(header()?.dataset.state).toBe('erro'));
			return user;
		}

		it('error_resets_when_the_kobo_disconnects', async () => {
			await failedSync();
			expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

			handlers.get('device-disconnected')!({ payload: null });

			await waitFor(() => expect(header()?.dataset.state).not.toBe('erro'));
		});

		it('error_resets_when_another_reader_opens', async () => {
			const user = await failedSync();

			await user.click(await screen.findByRole('button', { name: "Bruno's Library" }));
			await user.click(await menuItem('Ana'));

			await waitFor(() => expect(header()?.dataset.state).not.toBe('erro'));
		});

		it('retry_needs_a_kobo_that_can_sync', async () => {
			await failedSync();
			expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

			// The Reader's Kobo is no longer the one connected: Sync is disabled, so there is nothing to retry
			library.connectedReaderId = 2;
			await tick();

			expect(header()?.dataset.state).toBe('erro');
			expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
		});
	});

	it('first_kobo_failed_sync_lands_on_the_library_with_error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await mockLibrary({
			list: [],
			lastReader: null,
			books: newBooks(),
			device: kobo,
			syncOnConnect: true,
			overrides: {
				list_readers: () => [],
				reader_for_kobo: () => null,
				create_reader: () => ({ id: 1, name: 'Kobo Libra', exportPath: null }),
				sync_kobo: () => {
					throw 'disk is full';
				}
			}
		});
		render(Page);

		await waitFor(() => expect(header()?.dataset.state).toBe('erro'));
		expect(options().length).toBeGreaterThan(0);
		expect(library.canSync).toBe(true);
		expect(within(bar()!).getByRole('button', { name: 'Sync with the Kobo' })).not.toHaveAttribute('aria-disabled', 'true');
	});

	it('back_returns_focus_to_opened_book', async () => {
		const user = userEvent.setup();
		await mockLibrary({ books: newBooks() });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));

		await user.click(options()[1]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		await user.click(within(bar()!).getByRole('button', { name: 'Back' }));

		await waitFor(() => expect(options()).toHaveLength(3));
		await waitFor(() => expect(document.activeElement).toBe(options()[1]));
		expect(options()[1]).toHaveAttribute('tabindex', '0');
	});
});

describe('+page · sync on connect', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		handlers.clear();
		resetLibrary();
	});

	it('sync_on_connect_error_shows_header_error', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await mockLibrary({
			books: newBooks(),
			device: kobo,
			syncOnConnect: true,
			overrides: {
				sync_kobo: () => {
					throw 'disk is full';
				}
			}
		});
		render(Page);

		await waitFor(() => expect(header()?.dataset.state).toBe('erro'));
		expect(screen.getAllByRole('alert').some((a) => a.textContent?.includes('Could not sync the Kobo'))).toBe(true);
		expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
		vi.mocked(console.error).mockRestore();
	});
});

describe('+page · shortcuts', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		handlers.clear();
		resetLibrary();
	});

	// `code` is the physical key, as in a real keydown: Caps Lock changes `key`, never `code`
	const codeOf = (key: string) => (/^\d$/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`);
	const press = (key: string, init: KeyboardEventInit = { metaKey: true }, target: Element | Window = window) =>
		fireEvent.keyDown(target, { key, code: codeOf(key), ...init });

	it('shortcuts_sync_export_and_switch_view', async () => {
		await mockLibrary({ books: newBooks(), device: kobo });
		render(Page);
		await syncReady();

		// ⌘R syncs: the Kobo is connected
		await press('r');
		await waitFor(() => expect(calls('sync_kobo')).toHaveLength(1));

		// ⌘2 and ⌘1 switch the view and save it, like the click
		await waitFor(() => expect(options()).toHaveLength(3));
		await press('2');
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { libraryViewMode: 'list' } });
		expect(settings.uiPreferences.libraryViewMode).toBe('list');
		await press('1');
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { libraryViewMode: 'grid' } });
		expect(settings.uiPreferences.libraryViewMode).toBe('grid');

		// ⌘E does what the bar's Export does: with no selection, every book
		await waitFor(() => expect(options()).toHaveLength(3));
		await press('e');
		await waitFor(() => expect(invoke).toHaveBeenCalledWith('export_library_books', { readerId: 1, bookIds: [1, 2, 3] }));

		// In a book, ⌘E exports that book alone
		vi.mocked(invoke).mockClear();
		await userEvent.setup().click(options()[1]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		await press('e');
		await waitFor(() => expect(invoke).toHaveBeenCalledWith('export_library_books', { readerId: 1, bookIds: [2] }));
		// ...and the library's other shortcuts do nothing there
		vi.mocked(invoke).mockClear();
		await press('2');
		await press('r');
		expect(calls('update_settings')).toHaveLength(0);
		expect(calls('sync_kobo')).toHaveLength(0);
	});

	it('shortcuts_need_the_command_key_and_a_connected_kobo', async () => {
		await mockLibrary({ books: newBooks() });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));

		// No Kobo: ⌘R does nothing (the Sync button is disabled)
		await press('r');
		// Other modifiers: not ours
		await press('2', { ctrlKey: true });
		await press('2', { metaKey: true, shiftKey: true });
		await press('e', { metaKey: true, altKey: true });
		await press('e', {});

		expect(calls('sync_kobo')).toHaveLength(0);
		expect(calls('update_settings')).toHaveLength(0);
		expect(calls('export_library_books')).toHaveLength(0);
		expect(within(bar()!).getByRole('button', { name: 'Sync with the Kobo' })).toHaveAttribute('aria-disabled', 'true');
	});

	it('shortcuts_ignored_in_text_field_and_modal', async () => {
		await mockLibrary({ books: newBooks(), device: kobo });
		const first = render(Page);
		await syncReady();
		vi.mocked(invoke).mockClear();

		// A text field has the focus
		const input = document.body.appendChild(document.createElement('input'));
		input.focus();
		await press('r', { metaKey: true }, input);
		await press('e', { metaKey: true }, input);
		await press('2', { metaKey: true }, input);
		input.remove();
		expect(calls('sync_kobo')).toHaveLength(0);
		expect(calls('export_library_books')).toHaveLength(0);
		expect(calls('update_settings')).toHaveLength(0);

		// The update dialog is open
		updater.state = 'available';
		await tick();
		await press('r');
		await press('e');
		await press('2');
		updater.state = 'idle';
		await tick();
		expect(calls('sync_kobo')).toHaveLength(0);
		expect(calls('export_library_books')).toHaveLength(0);
		expect(calls('update_settings')).toHaveLength(0);

		// «Whose Kobo is this?» is open
		first.unmount();
		resetLibrary();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { reader_for_kobo: () => null } });
		render(Page);
		await screen.findByTestId('unknown-kobo-dialog');
		vi.mocked(invoke).mockClear();
		await press('r');
		await press('e');
		await press('2');
		expect(calls('sync_kobo')).toHaveLength(0);
		expect(calls('export_library_books')).toHaveLength(0);
		expect(calls('update_settings')).toHaveLength(0);
	});
});

describe('+page · traffic lights', () => {
	const block = () => bar()?.querySelector<HTMLElement>('[data-traffic-lights]') ?? null;
	/** Lets the rejected or answered measurement reach the bar. */
	const settle = async () => {
		for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
		await tick();
	};

	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		handlers.clear();
		windowEvents.clear();
		windowUnlisten.resized.mockClear();
		windowUnlisten.focus.mockClear();
		mainWindow.isFullscreen.mockImplementation(() => Promise.resolve(false));
		resetLibrary();
	});

	it('bar_reserves_measured_traffic_lights', async () => {
		await mockLibrary({ books: newBooks(), overrides: { traffic_lights_max_x: () => 76 } });
		render(Page);

		// The zoom button ends at x = 76 (14 pt lights, 23 pt apart); the bar's px-4 gives the first 16
		await waitFor(() => expect(block()?.style.width).toBe('60px'));
		expect(block()!.classList.contains('shrink-0')).toBe(true);
	});

	it('bar_keeps_52_when_measure_fails', async () => {
		await mockLibrary({
			books: newBooks(),
			overrides: {
				traffic_lights_max_x: () => {
					throw 'no NSWindow';
				}
			}
		});
		const failed = render(Page);
		await waitFor(() => expect(calls('traffic_lights_max_x')).toHaveLength(1));
		await settle();
		expect(block()?.style.width).toBe('52px');
		failed.unmount();

		// No zoom button, or not macOS: `null`, and the 52 stay too
		resetLibrary();
		await mockLibrary({ books: newBooks(), overrides: { traffic_lights_max_x: () => null } });
		render(Page);
		await waitFor(() => expect(calls('traffic_lights_max_x')).toHaveLength(2));
		await settle();
		expect(block()?.style.width).toBe('52px');
	});

	it('fullscreen_reserves_no_traffic_light_space', async () => {
		mainWindow.isFullscreen.mockImplementation(() => Promise.resolve(true));
		await mockLibrary({ books: newBooks(), overrides: { traffic_lights_max_x: () => 76 } });
		render(Page);
		await screen.findByRole('button', { name: "Bruno's Library" });

		// No traffic lights in full screen: the title starts at the bar's px-4, with no gap before it
		await waitFor(() => expect(block()).toBeNull());
		expect(within(bar()!.firstElementChild as HTMLElement).getByRole('button', { name: "Bruno's Library" })).toBeInTheDocument();

		// Leaving full screen resizes the window, which measures again
		mainWindow.isFullscreen.mockImplementation(() => Promise.resolve(false));
		expect(windowEvents.has('resized')).toBe(true);
		windowEvents.get('resized')!({ payload: { width: 2000, height: 1400 } });
		await waitFor(() => expect(block()?.style.width).toBe('60px'));
	});

	it('bar_remeasures_when_the_window_is_shown', async () => {
		// The window is still hidden at mount, and tao moves the buttons on its first draw
		let maxX = 67;
		await mockLibrary({ books: newBooks(), overrides: { traffic_lights_max_x: () => maxX } });
		const page = render(Page);
		await waitFor(() => expect(block()?.style.width).toBe('51px'));

		// Shown, and so focused: measured again
		maxX = 76;
		expect(windowEvents.has('focus')).toBe(true);
		windowEvents.get('focus')!({ payload: true });
		await waitFor(() => expect(block()?.style.width).toBe('60px'));

		// Both listeners end with the page
		page.unmount();
		expect(windowUnlisten.resized).toHaveBeenCalled();
		expect(windowUnlisten.focus).toHaveBeenCalled();
	});
});
