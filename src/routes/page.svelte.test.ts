import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
import { makeBook, makeDevice, makeHighlight } from '$lib/test-fixtures';
import { updater } from '$lib/stores/updater.svelte';
import Page from './+page.svelte';

// jsdom has no pointer capture, which Bits UI's triggers release on pointerdown
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

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
playAnimationsOnTimers();

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
		librarySortReversed: false,
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
	/** What the file says of the view and the sort. */
	ui?: Partial<typeof onDisk.uiPreferences>;
	/** A thrown error is a rejected command. */
	overrides?: Record<string, (args: unknown) => unknown>;
};

/** Reader 1 open; `update_settings` answers the store's settings. */
async function mockLibrary({ list = readers, books = [], summary, device = null, lastReader = 1, syncOnConnect = false, ui = {}, overrides = {} }: Options = {}) {
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
			Object.assign(saved.uiPreferences, ui);
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
	library.lastSyncFailed = false;
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
const calls = (cmd: string) => vi.mocked(invoke).mock.calls.filter(([c]) => c === cmd);

describe('+page', () => {
	beforeEach(() => {
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
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { librarySort: 'author', librarySortReversed: false } });
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
		// The Library stays on screen while it syncs (Task 38): no importing state in its place
		expect(options()).toHaveLength(3);
		expect(screen.queryByTestId('sync-progress')).toBeNull();
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

	it('no_news_shows_no_header_in_list', async () => {
		const read = newBooks().map((b) => ({ ...b, highlights: b.highlights.map((h) => ({ ...h, isNew: false })) }));
		await mockLibrary({ books: read, summary: { newSince: '2026-11-09T10:00:00Z', lastSyncAt: '2026-11-19T10:42:00Z' }, device: kobo });
		settings.uiPreferences.libraryViewMode = 'list';
		render(Page);
		const list = await screen.findByTestId('books-list');
		expect(header()).toBeNull();
		expect(screen.queryByText('No new highlights')).toBeNull();
		expect(list.parentElement!.firstElementChild).toBe(list);
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

describe('+page · screen 2 · syncing', () => {
	const report = { added: 0, updated: 0, removed: 0, restored: 0, books: 3 };
	/** Ends the Sync a test left running: the store keeps it in flight, so it would reach the next test. */
	let pending: (() => void) | null = null;
	/** A `sync_kobo` that waits until `release`, as Rust does while it reads the Kobo. */
	function heldSync() {
		let release!: () => void;
		const held = new Promise((resolve) => (release = () => resolve(report)));
		pending = release;
		return { sync_kobo: () => held, release };
	}
	const settle = async () => {
		for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
		await tick();
	};
	const syncButton = () => within(bar()!).getByRole('button', { name: 'Sync with the Kobo' });
	const press = (key: string) => fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}`, metaKey: true });
	const message = () => header()!.querySelector('[data-slot="library-header-message"]')!.textContent!.trim();
	const detail = () => header()!.querySelector('[data-slot="library-header-detail"]')?.textContent?.trim();
	/**
	 * Every state the header holds, in order, even for a microtask: each change is a mutation record
	 * with the value it replaced, and a header that leaves keeps its last one through its fade.
	 * Also whether «✓ Exported» was ever on screen in it.
	 */
	function recordHeader() {
		const states: string[] = [];
		let exportedShown = false;
		const push = (state: string | null | undefined) => {
			if (state && states.at(-1) !== state) states.push(state);
		};
		const isHeader = (node: Node): node is HTMLElement => node instanceof HTMLElement && node.dataset.slot === 'library-header';
		push(header()?.dataset.state);
		const observer = new MutationObserver((records) => {
			for (const record of records) {
				if (record.type === 'attributes' && isHeader(record.target)) push(record.oldValue);
				for (const node of record.removedNodes) if (isHeader(node)) push(node.dataset.state);
			}
			if (header()?.textContent?.includes('✓ Exported')) exportedShown = true;
		});
		observer.observe(document.body, {
			subtree: true,
			childList: true,
			characterData: true,
			attributes: true,
			attributeFilter: ['data-state'],
			attributeOldValue: true
		});
		return {
			stop: () => {
				for (const record of observer.takeRecords()) {
					if (record.type === 'attributes' && isHeader(record.target)) push(record.oldValue);
					for (const node of record.removedNodes) if (isHeader(node)) push(node.dataset.state);
				}
				observer.disconnect();
				push(header()?.dataset.state);
				return { states, exportedShown };
			}
		};
	}

	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		handlers.clear();
		resetLibrary();
	});

	afterEach(async () => {
		pending?.();
		pending = null;
		await waitFor(() => expect(library.isImporting).toBe(false));
		await settle();
	});

	it('library_stays_on_screen_while_syncing', async () => {
		const user = userEvent.setup();
		const { sync_kobo } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));

		// The grid stays, with no ImportingState in its place
		expect(options()).toHaveLength(3);
		expect(screen.queryByTestId('sync-progress')).toBeNull();
		expect(library.uiState).toBe('library');
	});

	it('header_shows_sync_progress', async () => {
		const user = userEvent.setup();
		const { sync_kobo } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));
		handlers.get('sync-progress')!({ payload: { done: 12, total: 42 } });

		// The books have news, but the Sync wins: no «novos» header with its buttons
		await waitFor(() => expect(header()?.dataset.state).toBe('aSincronizar'));
		expect(message()).toBe('Syncing with the Kobo');
		expect(detail()).toBe('· 12 of 42 books');
		expect(within(header()!).queryByRole('button')).toBeNull();
	});

	it('syncing_wins_over_previous_error', async () => {
		const user = userEvent.setup();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await mockLibrary({
			books: newBooks(),
			device: kobo,
			overrides: {
				sync_kobo: () => {
					throw 'disk is full';
				}
			}
		});
		render(Page);
		await syncReady();
		await user.click(syncButton());
		await waitFor(() => expect(header()?.dataset.state).toBe('erro'));

		// A Sync that does not clear the error before it ends, like the one on connect
		library.syncProgress = { done: 1, total: 3 };
		library.isImporting = true;
		await tick();

		try {
			expect(header()?.dataset.state).toBe('aSincronizar');
			expect(detail()).toBe('· 1 of 3 books');
		} finally {
			// Set by hand, so no Sync in flight ends it: a failure here must not reach the next test
			library.isImporting = false;
			library.syncProgress = null;
			vi.mocked(console.error).mockRestore();
		}
	});

	it('detail_stays_open_through_sync', async () => {
		const user = userEvent.setup();
		const books = newBooks();
		let sync = heldSync();
		await mockLibrary({ books, device: kobo, overrides: { sync_kobo: () => sync.sync_kobo() } });
		render(Page);
		await syncReady();

		// A book opened while the Sync runs stays open when it ends
		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));
		await user.click(options()[1]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		expect(within(bar()!).getByRole('button', { name: 'Back' })).toBeInTheDocument();
		sync.release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await settle();
		expect(library.uiState).toBe('book-details');
		expect(screen.getByTestId('book-details-view')).toBeInTheDocument();
		expect(library.viewingBookId).toBe(2);

		// The open book is gone from the Library the Sync wrote: back to the grid
		await user.click(within(bar()!).getByRole('button', { name: 'Back' }));
		await waitFor(() => expect(options()).toHaveLength(3));
		sync = heldSync();
		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));
		await user.click(options()[1]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		books.splice(1, 1);
		sync.release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await waitFor(() => expect(library.uiState).toBe('library'));
		expect(options()).toHaveLength(2);
	});

	it('detail_stays_open_when_the_kobo_syncs_on_connect', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		// No Kobo at start: it is connected while a book is open
		await mockLibrary({ books: newBooks(), syncOnConnect: true, overrides: { sync_kobo, reader_for_kobo: () => 1 } });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		await waitFor(() => expect(handlers.has('device-detected')).toBe(true));
		await user.click(options()[0]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());

		handlers.get('device-detected')!({ payload: { device: kobo } });
		await waitFor(() => expect(library.isImporting).toBe(true));
		// The detail does not give way to the Sync
		expect(screen.getByTestId('book-details-view')).toBeInTheDocument();

		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await settle();
		expect(library.uiState).toBe('book-details');
		expect(screen.getByTestId('book-details-view')).toBeInTheDocument();
	});

	it('switch_on_connect_never_leaves_main_empty', async () => {
		const user = userEvent.setup();
		const { sync_kobo } = heldSync();
		const anas = [makeBook({ id: 7, title: 'Delta', author: 'D', highlights: [hl('d1')] })];
		let readAnas: (() => void) | undefined;
		await mockLibrary({
			books: newBooks(),
			syncOnConnect: true,
			overrides: {
				sync_kobo,
				reader_for_kobo: () => 2,
				get_library: (args) =>
					(args as { readerId: number }).readerId !== 2
						? newBooks()
						: readAnas
							? structuredClone(anas)
							: new Promise((resolve) => (readAnas = () => resolve(structuredClone(anas))))
			}
		});
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		await waitFor(() => expect(handlers.has('device-detected')).toBe(true));
		await user.click(options()[0]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());

		// Every state <main> passes through, even for a microtask
		const main = document.querySelector('main')!;
		let emptied = false;
		const observer = new MutationObserver(() => {
			if (main.children.length === 0) emptied = true;
		});
		observer.observe(main, { childList: true, subtree: true });
		try {
			handlers.get('device-detected')!({ payload: { device: kobo } });
			// Ana's Library takes a while: Bruno's book stays, and nothing of his can be acted on
			await waitFor(() => expect(readAnas).toBeTypeOf('function'));
			await settle();
			expect(screen.getByTestId('book-details-view')).toBeInTheDocument();
			expect(within(bar()!).getByRole('button', { name: 'Export 1 book' })).toHaveAttribute('aria-disabled', 'true');

			readAnas!();
			await waitFor(() => expect(library.activeReaderId).toBe(2));
			await settle();
			expect(screen.queryByTestId('book-details-view')).toBeNull();
			expect(options().map((o) => o.textContent)).toEqual([expect.stringContaining('Delta')]);
			expect(emptied).toBe(false);
		} finally {
			observer.disconnect();
		}
	});

	it('another_readers_kobo_switches_the_library_on_connect', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		const anas = [makeBook({ id: 7, title: 'Delta', author: 'D', highlights: [hl('d1')] })];
		// Bruno's Library on screen, no Kobo yet: Ana's is connected, «Sincronizar ao ligar» on
		await mockLibrary({
			books: newBooks(),
			syncOnConnect: true,
			overrides: {
				sync_kobo,
				reader_for_kobo: () => 2,
				get_library: (args) => ((args as { readerId: number }).readerId === 2 ? structuredClone(anas) : newBooks())
			}
		});
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		await waitFor(() => expect(handlers.has('device-detected')).toBe(true));
		await user.keyboard('{Meta>}');
		await user.click(options()[2]);
		await user.keyboard('{/Meta}');
		await user.click(options()[0]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		expect(library.selectedBookIds).not.toEqual([]);

		handlers.get('device-detected')!({ payload: { device: kobo } });
		await waitFor(() => expect(library.isImporting).toBe(true));

		// Ana's Library is on screen while it syncs: Bruno's book and selection do not come along
		expect(library.activeReaderId).toBe(2);
		expect(library.uiState).toBe('library');
		expect(screen.queryByTestId('book-details-view')).toBeNull();
		expect(library.viewingBookId).toBeNull();
		expect(library.selectedBookIds).toEqual([]);
		expect(await screen.findByRole('button', { name: "Ana's Library" })).toBeInTheDocument();
		await waitFor(() => expect(header()?.dataset.state).toBe('aSincronizar'));
		expect(options().map((o) => o.textContent)).toEqual([expect.stringContaining('Delta')]);

		// The Sync fills her Library, the one on screen
		anas.push(makeBook({ id: 8, title: 'Epsilon', author: 'E', highlights: [hl('e1', { isNew: true, syncedSeq: 1 })] }));
		handlers.get('sync-finished')!({ payload: { readerId: 2, report } });
		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await settle();

		expect(library.activeReaderId).toBe(2);
		expect(library.uiState).toBe('library');
		expect(options()).toHaveLength(2);
		expect(library.selectedBookIds).toEqual([]);
		expect(library.canSync).toBe(true);
	});

	it('another_readers_kobo_connecting_forgets_the_opened_book_of_the_previous_reader', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		// Ana's Library has a book with the id of the one opened in Bruno's
		const anas = [makeBook({ id: 1, title: 'Delta', author: 'D', highlights: [hl('d1')] })];
		await mockLibrary({
			books: newBooks(),
			syncOnConnect: true,
			overrides: {
				sync_kobo,
				reader_for_kobo: () => 2,
				get_library: (args) => ((args as { readerId: number }).readerId === 2 ? structuredClone(anas) : newBooks())
			}
		});
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		await waitFor(() => expect(handlers.has('device-detected')).toBe(true));
		await user.click(options()[0]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());

		handlers.get('device-detected')!({ payload: { device: kobo } });
		await waitFor(() => expect(library.activeReaderId).toBe(2));
		await waitFor(() => expect(options()).toHaveLength(1));
		await settle();

		// Ana's grid does not take the focus «back» to a book of Bruno's
		expect(document.activeElement).not.toBe(options()[0]);
		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
	});

	it('selection_survives_sync', async () => {
		const user = userEvent.setup();
		const books = newBooks();
		const { sync_kobo, release } = heldSync();
		await mockLibrary({ books, device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));
		// Selected in the Library on screen, mid-Sync: Alpha and Gamma
		await user.keyboard('{Meta>}');
		await user.click(options()[0]);
		await user.click(options()[2]);
		await user.keyboard('{/Meta}');
		expect(library.selectedBookIds).toEqual([1, 3]);

		// Gamma is gone from the Kobo. Rust says the Sync finished before `sync_kobo` answers
		books.splice(2, 1);
		handlers.get('sync-finished')!({ payload: { readerId: 1, report } });
		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await settle();

		expect(library.selectedBookIds).toEqual([1]);
		expect(options()).toHaveLength(2);
		expect(options()[0]).toHaveAttribute('aria-selected', 'true');
	});

	it('switching_reader_still_clears_selection', async () => {
		const user = userEvent.setup();
		await mockLibrary({ books: newBooks() });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		await user.keyboard('{Meta>}');
		await user.click(options()[0]);
		await user.keyboard('{/Meta}');
		expect(library.selectedBookIds).toEqual([1]);

		// Ana's books happen to have the same ids: the selection is still not hers
		await user.click(await screen.findByRole('button', { name: "Bruno's Library" }));
		await user.click(await menuItem('Ana'));

		await waitFor(() => expect(library.activeReaderId).toBe(2));
		expect(library.selectedBookIds).toEqual([]);
	});

	it.each([true, false])('reader_chosen_for_an_unknown_kobo_mid_sync_waits_for_it (sync on connect %s)', async (syncOnConnect) => {
		const user = userEvent.setup();
		const unknown = makeDevice({ name: 'Kobo Clara', path: '/Volumes/KOBO2', isValid: true, serialNumber: 'C123' });
		const anas = [makeBook({ id: 7, title: 'Delta', author: 'D', highlights: [hl('d1')] })];
		const syncs: Array<{ serial: string; release: () => void }> = [];
		pending = () => syncs.forEach((s) => s.release());
		let owner: number | null = null;
		await mockLibrary({
			books: newBooks(),
			device: kobo,
			syncOnConnect,
			overrides: {
				sync_kobo: (args) =>
					new Promise((resolve) =>
						syncs.push({ serial: (args as { device: typeof kobo }).device.serialNumber!, release: () => resolve(report) })
					),
				reader_for_kobo: (args) => ((args as { serial: string }).serial === 'N418' ? 1 : owner),
				associate_kobo: (args) => {
					owner = (args as { readerId: number }).readerId;
					return null;
				},
				get_library: (args) => ((args as { readerId: number }).readerId === 2 ? structuredClone(anas) : newBooks())
			}
		});
		render(Page);
		await syncReady();
		await user.click(syncButton());
		await waitFor(() => expect(syncs).toHaveLength(1));
		// A book of Bruno's open mid-Sync
		await user.click(options()[0]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		const main = document.querySelector('main')!;
		let emptied = false;
		const observer = new MutationObserver(() => {
			if (main.children.length === 0) emptied = true;
		});
		observer.observe(main, { childList: true, subtree: true });

		// Another Kobo, unknown, while Bruno's syncs: it is Ana's
		handlers.get('device-detected')!({ payload: { device: unknown } });
		const dialog = await screen.findByTestId('unknown-kobo-dialog');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Ana' }));
		await settle();

		// Bruno's Sync is not interrupted by her Library
		expect(library.activeReaderId).toBe(1);
		expect(calls('get_library').some(([, args]) => (args as { readerId: number }).readerId === 2)).toBe(false);

		// It ends on Bruno's Library; only then Ana's shows, and syncs if the setting says so
		syncs[0].release();
		await waitFor(() => expect(library.activeReaderId).toBe(2));
		if (syncOnConnect) {
			await waitFor(() => expect(syncs).toHaveLength(2));
			expect(syncs[1].serial).toBe('C123');
			// The Sync on connect shows her Library in one step: Bruno's book until it arrives
			expect(emptied).toBe(false);
		} else {
			await settle();
			expect(syncs).toHaveLength(1);
		}
		observer.disconnect();
		expect(library.uiState).toBe('library');
		expect(options().map((o) => o.textContent)).toEqual([expect.stringContaining('Delta')]);
		const readers = calls('get_library').map(([, args]) => (args as { readerId: number }).readerId);
		expect(readers.slice(readers.indexOf(2))).not.toContain(1);
	});

	it('first_sync_shows_library_not_no_device', async () => {
		const { sync_kobo } = heldSync();
		let owner: number | null = null;
		await mockLibrary({
			books: newBooks(),
			device: kobo,
			lastReader: null,
			syncOnConnect: true,
			overrides: {
				sync_kobo,
				reader_for_kobo: () => owner,
				associate_kobo: (args) => {
					owner = (args as { readerId: number }).readerId;
					return null;
				}
			}
		});
		render(Page);

		// Whose Kobo is it? Ana's: her Library is on screen while it syncs
		const dialog = await screen.findByTestId('unknown-kobo-dialog');
		expect(library.uiState).toBe('no-device');
		await fireEvent.click(within(dialog).getByRole('button', { name: 'Ana' }));
		await waitFor(() => expect(library.isImporting).toBe(true));

		expect(library.uiState).toBe('library');
		expect(library.activeReaderId).toBe(2);
		expect(screen.queryByText('No Kobo connected')).toBeNull();
	});

	it('first_kobo_ever_shows_library_not_no_device', async () => {
		const { sync_kobo } = heldSync();
		let list: typeof readers = [];
		await mockLibrary({
			list: [],
			books: newBooks(),
			device: kobo,
			lastReader: null,
			syncOnConnect: true,
			overrides: {
				sync_kobo,
				list_readers: () => structuredClone(list),
				reader_for_kobo: () => null,
				create_reader: () => {
					list = [{ id: 1, name: 'Kobo Libra', exportPath: null }];
					return list[0];
				}
			}
		});
		render(Page);

		// No Reader yet: one is made for the Kobo, and its Library is what the Sync fills
		await waitFor(() => expect(library.isImporting).toBe(true));
		expect(library.uiState).toBe('library');
		expect(screen.queryByText('No Kobo connected')).toBeNull();
	});

	it('sync_click_while_syncing_does_nothing', async () => {
		const user = userEvent.setup();
		const { sync_kobo } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		const sync = vi.spyOn(library, 'sync');
		render(Page);
		await syncReady();

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));
		// Sync stays enabled while it turns; a second click is not a second Sync
		expect(syncButton()).not.toHaveAttribute('aria-disabled', 'true');
		const stateBefore = header()!.dataset.state;
		const headerBefore = header()!.textContent;
		await user.click(syncButton());
		await press('r');

		expect(sync).toHaveBeenCalledTimes(1);
		expect(calls('sync_kobo')).toHaveLength(1);
		// Nothing else moved: no «Exported», no failed Sync, the header still syncing
		expect(library.lastSyncFailed).toBe(false);
		expect(document.querySelector('[role="alert"]')!.textContent!.trim()).toBe('');
		expect(header()!.dataset.state).toBe(stateBefore);
		expect(header()!.textContent).toBe(headerBefore);
		expect(header()!.textContent).not.toContain('Exported');
		expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
		sync.mockRestore();
	});

	const announcer = () => screen.getByTestId('sync-announcer');
	/** Every text the page's announcer takes, in order. */
	function recordAnnouncer() {
		const el = announcer();
		const seen: string[] = [];
		const observer = new MutationObserver(() => seen.push(el.textContent ?? ''));
		observer.observe(el, { childList: true, characterData: true, subtree: true });
		return { seen, stop: () => observer.disconnect() };
	}

	it('page_announcer_is_always_mounted_polite_and_announces_start_and_end', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		// Mounted before any Sync, empty, and outside the header
		expect(announcer()).toHaveAttribute('aria-live', 'polite');
		expect(announcer()).toHaveClass('sr-only');
		expect(announcer().textContent!.trim()).toBe('');
		const rec = recordAnnouncer();

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));
		await settle();
		expect(announcer().textContent!.trim()).toBe('Syncing with the Kobo');
		// The header keeps no polite region of its own: one source of truth
		expect(document.querySelector('main')!.querySelectorAll('[aria-live], [role="status"]')).toHaveLength(0);
		for (const done of [1, 2, 3]) await progress(done, 3);
		await settle();
		expect(rec.seen).toEqual(['Syncing with the Kobo']);

		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await settle();
		expect(announcer().textContent!.trim()).toBe('3 new highlights in 2 books');
		expect(rec.seen).toEqual(['Syncing with the Kobo', '3 new highlights in 2 books']);
		rec.stop();
	});

	it('page_announcer_announces_the_first_sync_of_an_empty_library_and_its_end', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		await mockLibrary({ books: [], device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		const el = announcer();

		await user.click(syncButton());
		await waitFor(() => expect(syncingState()).not.toBeNull());
		await settle();
		// The same node, mounted before: the W2 state brings no region of its own
		expect(announcer()).toBe(el);
		expect(el.textContent!.trim()).toBe('Syncing with the Kobo');
		expect(document.querySelector('main')!.querySelectorAll('[aria-live], [role="status"]')).toHaveLength(0);
		await progress(12, 42);
		expect(el.textContent!.trim()).toBe('Syncing with the Kobo');

		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await settle();
		expect(el.textContent!.trim()).toBe('No new highlights');
	});

	it('page_announcer_stays_silent_on_a_failed_sync', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const user = userEvent.setup();
		await mockLibrary({
			books: newBooks(),
			device: kobo,
			overrides: { sync_kobo: () => Promise.reject(new Error('boom')) }
		});
		render(Page);
		await syncReady();

		await user.click(syncButton());
		await waitFor(() => expect(library.lastSyncFailed).toBe(true));
		await settle();
		// The error is the alert's; the polite region does not repeat it or announce an outcome
		expect(announcer().textContent!.trim()).toBe('');
		expect(document.querySelector('[role="alert"]')!.textContent).toContain('Could not sync the Kobo');
		vi.mocked(console.error).mockRestore();
	});

	it('title_menu_disabled_while_syncing', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		const title = () => within(bar()!).getByRole('button', { name: "Bruno's Library" });
		expect(title()).not.toHaveAttribute('aria-disabled', 'true');

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));

		// The Sync ends by opening the Kobo's Reader: another one chosen now would be undone
		expect(title()).toHaveAttribute('aria-disabled', 'true');
		// aria-disabled, like the bar's buttons: it keeps its place in the Tab order
		expect(title()).not.toBeDisabled();
		await user.click(title());
		title().focus();
		expect(document.activeElement).toBe(title());
		await user.keyboard('{Enter}');
		await user.keyboard(' ');
		await user.keyboard('{ArrowDown}');
		expect(menuItems()).toHaveLength(0);
		expect(library.activeReaderId).toBe(1);

		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await waitFor(() => expect(title()).not.toHaveAttribute('aria-disabled', 'true'));
	});

	const progress = async (done: number, total: number) => {
		handlers.get('sync-progress')!({ payload: { done, total } });
		await tick();
	};
	const syncingState = () => document.querySelector<HTMLElement>('[data-testid="syncing-state"]');
	const filledLines = () => syncingState()!.querySelectorAll('svg line[data-filled]').length;
	const badges = () => document.querySelectorAll('[data-slot="badge"]');
	const exportButton = () => within(bar()!).getByRole('button', { name: /^Export \d+ books?$/ });

	it('header_hides_count_before_total_known', async () => {
		const user = userEvent.setup();
		const { sync_kobo } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();

		// The first state of a Sync is { done: 0, total: 0 }: Rust has not counted the books yet
		await user.click(syncButton());
		await waitFor(() => expect(header()?.dataset.state).toBe('aSincronizar'));

		expect(message()).toBe('Syncing with the Kobo');
		expect(detail()).toBeUndefined();
		expect(header()!.textContent).not.toContain('0 of 0');
	});

	it('empty_library_while_syncing_shows_centered_state', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		await mockLibrary({ books: [], device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		// Before the Sync: the Library's own empty state, with its header and no centered state
		expect(screen.getByTestId('empty-state')).toBeInTheDocument();
		expect(syncingState()).toBeNull();

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));
		await progress(12, 42);

		// No header and no «No books found»: only the centered state
		expect(header()).toBeNull();
		expect(screen.queryByTestId('empty-state')).toBeNull();
		const state = syncingState()!;
		// Announced by the page's own always-mounted region, not by a region that mounts with its text
		expect(state).not.toHaveAttribute('role');
		expect(state.closest('[aria-live]')).toBeNull();
		expect(within(state).getByRole('heading', { name: 'Syncing with the Kobo' })).toBeInTheDocument();
		const count = screen.getByText('12 of 42 books');
		expect(count.tagName).toBe('P');
		expect(state.contains(count)).toBe(true);
		expect(count.closest('[aria-live], [role="status"]')).toBeNull();
		expect(count).toHaveClass('text-body', 'text-muted-foreground');
		expect(state.textContent).not.toContain('appear here');
		// The illustration is decoration, and a solid Kobo, not the dashed one of the first start
		expect(state.querySelector('.kobo-icon')).toHaveAttribute('aria-hidden', 'true');
		expect(state.querySelector('.kobo-icon')).not.toHaveAttribute('role');
		expect(state.querySelectorAll('[stroke-dasharray]')).toHaveLength(0);
		// The Figma's L1: token background, a 96 wide Kobo, a 320 wide text block of Title 3 and Body
		expect(state).toHaveClass('bg-background', 'gap-6');
		expect(state.querySelector('.kobo-icon')).toHaveStyle('width: 96px');
		expect(within(state).getByRole('heading')).toHaveClass('text-title-3', 'text-foreground');
		expect(state.querySelector('.w-\\[320px\\]')).not.toBeNull();

		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await settle();
		expect(syncingState()).toBeNull();
		expect(screen.getByTestId('empty-state')).toBeInTheDocument();
	});

	it('empty_library_syncing_shows_only_the_title_before_the_total', async () => {
		const user = userEvent.setup();
		const { sync_kobo } = heldSync();
		await mockLibrary({ books: [], device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();

		await user.click(syncButton());
		await waitFor(() => expect(syncingState()).not.toBeNull());

		// No paragraph at all, and the old sentence never comes back
		expect(within(syncingState()!).getByRole('heading', { name: 'Syncing with the Kobo' })).toBeInTheDocument();
		expect(syncingState()!.querySelector('p')).toBeNull();
		expect(syncingState()!.textContent).not.toContain('appear here');
		expect(syncingState()!.textContent).not.toMatch(/\d+ of \d+ book/);
		expect(filledLines()).toBe(0);
	});

	it('sync_illustration_fills_lines_with_progress', async () => {
		const user = userEvent.setup();
		const { sync_kobo } = heldSync();
		await mockLibrary({ books: [], device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		await user.click(syncButton());
		await waitFor(() => expect(syncingState()).not.toBeNull());
		expect(syncingState()!.querySelectorAll('svg line')).toHaveLength(7);

		// floor(7 × done / total): 1/42 and 41/42 tell floor from ceil and round
		for (const [done, total, lines] of [
			[0, 42, 0],
			[1, 42, 0],
			[12, 42, 2],
			[30, 42, 5],
			[41, 42, 6],
			[42, 42, 7],
			[0, 0, 0]
		]) {
			await progress(done, total);
			expect(filledLines(), `${done}/${total}`).toBe(lines);
		}
	});

	it('view_shortcuts_work_while_syncing', async () => {
		const { sync_kobo } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		await press('r');
		await waitFor(() => expect(library.isImporting).toBe(true));
		vi.mocked(invoke).mockClear();

		await fireEvent.keyDown(window, { key: '2', code: 'Digit2', metaKey: true });
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { libraryViewMode: 'list' } });
		expect(settings.uiPreferences.libraryViewMode).toBe('list');
		await fireEvent.keyDown(window, { key: '1', code: 'Digit1', metaKey: true });
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { libraryViewMode: 'grid' } });
		expect(settings.uiPreferences.libraryViewMode).toBe('grid');
	});

	it('export_and_sync_shortcuts_blocked_while_syncing', async () => {
		const { sync_kobo } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		await press('r');
		await waitFor(() => expect(library.isImporting).toBe(true));
		vi.mocked(invoke).mockClear();

		await press('r');
		await press('e');

		expect(calls('sync_kobo')).toHaveLength(0);
		expect(calls('export_library_books')).toHaveLength(0);
	});

	it('export_is_disabled_with_a_reason_while_syncing', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		expect(exportButton()).not.toHaveAttribute('aria-disabled', 'true');

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));

		// In the Library, Sync turns and Export waits for the end
		expect(exportButton()).toHaveAttribute('aria-disabled', 'true');
		await user.click(exportButton());
		expect(calls('export_library_books')).toHaveLength(0);

		// ...and in a book too
		await user.click(options()[1]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		const detailExport = within(bar()!).getByRole('button', { name: 'Export 1 book' });
		expect(detailExport).toHaveAttribute('aria-disabled', 'true');
		await user.click(detailExport);
		expect(calls('export_library_books')).toHaveLength(0);

		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await settle();
		expect(within(bar()!).getByRole('button', { name: 'Export 1 book' })).not.toHaveAttribute('aria-disabled', 'true');
	});

	it('new_badges_are_hidden_while_syncing_and_come_back_after', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		expect(badges()).toHaveLength(2);

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));
		// The badge fades out for 150 ms, then it is gone
		await waitFor(() => expect(badges()).toHaveLength(0));

		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await waitFor(() => expect(badges()).toHaveLength(2));
		expect(header()?.dataset.state).toBe('novos');
	});

	it('reader_menu_open_when_the_sync_starts_closes', async () => {
		const user = userEvent.setup();
		const { sync_kobo, release } = heldSync();
		await mockLibrary({ books: newBooks(), device: kobo, overrides: { sync_kobo } });
		render(Page);
		await syncReady();
		const title = () => within(bar()!).getByRole('button', { name: "Bruno's Library" });

		// The menu was open when the Sync on connect began: it closes, so no reader can be chosen in it
		await user.click(title());
		await menuItem('Ana');
		void library.sync();
		await waitFor(() => expect(library.isImporting).toBe(true));
		await waitFor(() => expect(menuItems()).toHaveLength(0));
		// The focus goes back to the title, not to the page
		await waitFor(() => expect(document.activeElement).toBe(title()));

		expect(calls('get_library').filter(([, args]) => (args as { readerId: number }).readerId === 2)).toHaveLength(0);
		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		expect(library.activeReaderId).toBe(1);
		// It opens again after the Sync, and only then
		await user.click(title());
		expect(await menuItem('Ana')).toBeInTheDocument();
	});

	it('book_opened_mid_sync_is_marked_after_it', async () => {
		const user = userEvent.setup();
		const books = newBooks();
		let busy = true;
		const { sync_kobo, release } = heldSync();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		await mockLibrary({
			books,
			device: kobo,
			overrides: {
				sync_kobo,
				// Rust's Sync holds an IMMEDIATE transaction, and the mark does not wait for it
				mark_book_opened: () => {
					if (busy) throw 'database is locked';
					return null;
				}
			}
		});
		render(Page);
		await syncReady();
		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));

		// Alpha opened mid-Sync: a1 and a2 are new, and the detail marks them so
		await user.click(options()[0]);
		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
		await settle();
		expect(library.viewingNewIds).toEqual(new Set(['a1', 'a2']));

		// The Sync brings a3 to Alpha
		books[0].highlights.push(makeHighlight(hl('a3', { isNew: true, syncedSeq: 5 })));
		busy = false;
		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await waitFor(() => expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 1, bookId: 1, seenSeq: 3 }));
		await settle();

		// What was new when it was opened is seen; what the Sync brought stays new (D1)
		const alpha = () => library.books.find((b) => b.id === 1)!;
		expect(alpha().highlights.filter((h) => h.isNew).map((h) => h.id)).toEqual(['a3']);
		expect(library.viewingNewIds).toEqual(new Set(['a1', 'a2']));
		vi.mocked(console.error).mockRestore();
	});

	it('sync_after_a_failure_never_shows_the_error', async () => {
		const user = userEvent.setup();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const read = newBooks().map((b) => ({ ...b, highlights: b.highlights.map((h) => ({ ...h, isNew: false })) }));
		let fail = true;
		let release!: () => void;
		await mockLibrary({
			books: read,
			device: kobo,
			overrides: {
				sync_kobo: () => {
					if (fail) throw 'disk is full';
					return new Promise((resolve) => (release = pending = () => resolve(report)));
				}
			}
		});
		render(Page);
		await syncReady();
		await user.click(syncButton());
		await waitFor(() => expect(header()?.dataset.state).toBe('erro'));

		// The Kobo is reported again (the monitor), and syncs on connect: it works this time
		fail = false;
		settings.uiPreferences.syncOnConnect = true;
		library.connectedReaderId = null;
		const recording = recordHeader();
		handlers.get('device-detected')!({ payload: { device: kobo } });
		await waitFor(() => expect(library.isImporting).toBe(true));
		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		// Past the header's 150 ms fade
		await new Promise((resolve) => setTimeout(resolve, 200));
		await settle();
		const { states } = recording.stop();

		expect(states[0]).toBe('erro');
		expect(states.slice(1)).toEqual(['aSincronizar']);
		expect(header()).toBeNull();
		expect(screen.queryAllByRole('alert').some((a) => a.textContent?.includes('Could not sync the Kobo'))).toBe(false);
		vi.mocked(console.error).mockRestore();
	});

	it('failed_sync_never_shows_the_news', async () => {
		const user = userEvent.setup();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		let fail!: () => void;
		await mockLibrary({
			books: newBooks(),
			device: kobo,
			overrides: { sync_kobo: () => new Promise((_, reject) => (fail = pending = () => reject('disk is full'))) }
		});
		render(Page);
		await syncReady();
		await waitFor(() => expect(header()?.dataset.state).toBe('novos'));
		const recording = recordHeader();

		await user.click(syncButton());
		await waitFor(() => expect(library.isImporting).toBe(true));
		fail();
		await waitFor(() => expect(header()?.dataset.state).toBe('erro'));
		await settle();

		// Straight from syncing to the error: «3 new highlights» is never shown nor announced in between
		expect(recording.stop().states).toEqual(['novos', 'aSincronizar', 'erro']);
		vi.mocked(console.error).mockRestore();
	});

	it('exported_mark_is_cleared_when_a_sync_on_connect_starts', async () => {
		const user = userEvent.setup();
		const books = newBooks();
		const { sync_kobo, release } = heldSync();
		// No Kobo at start: it is connected right after the header's export
		await mockLibrary({
			books,
			syncOnConnect: true,
			summary: { newSince: '2026-11-09T10:00:00Z', lastSyncAt: null },
			overrides: { sync_kobo, reader_for_kobo: () => 1, export_library_books: () => ['/x/Alpha.md', '/x/Gamma.md'] }
		});
		render(Page);
		await waitFor(() => expect(header()?.dataset.state).toBe('novos'));
		await waitFor(() => expect(handlers.has('device-detected')).toBe(true));
		await user.click(within(header()!).getByRole('button', { name: 'Export 2 books' }));
		await waitFor(() => expect(calls('mark_book_opened')).toHaveLength(2));

		const recording = recordHeader();
		handlers.get('device-detected')!({ payload: { device: kobo } });
		await waitFor(() => expect(library.isImporting).toBe(true));
		// The export marked Alpha and Gamma seen; the Sync brings news to Beta
		for (const book of books) for (const h of book.highlights) h.isNew = false;
		books[1].highlights.push(makeHighlight(hl('b2', { isNew: true, syncedSeq: 6 })));
		release();
		await waitFor(() => expect(library.isImporting).toBe(false));
		await waitFor(() => expect(header()?.dataset.state).toBe('novos'));
		await settle();

		// The header of the new news offers their export, never «✓ Exported» of the old one
		expect(recording.stop().exportedShown).toBe(false);
		expect(within(header()!).getByRole('button', { name: 'Export 1 book' })).toBeInTheDocument();
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

describe('+page · screen 3 · no Kobo', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		handlers.clear();
		resetLibrary();
	});

	const settle = async () => {
		for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
		await tick();
	};
	const syncButton = () => within(bar()!).getByRole('button', { name: 'Sync with the Kobo' });
	const exportButton = () => within(bar()!).getByRole('button', { name: /^Export \d+ books?$/ });
	const press = (key: string) => fireEvent.keyDown(window, { key, code: `Key${key.toUpperCase()}`, metaKey: true });
	/** The reason a disabled Sync gives: it is in aria-describedby once the button has focus. */
	const syncReason = async () => {
		syncButton().focus();
		await waitFor(() => expect(syncButton().getAttribute('aria-describedby')).toBeTruthy());
		return (syncButton().getAttribute('aria-describedby') ?? '')
			.split(/\s+/)
			.map((id) => document.getElementById(id)?.textContent ?? '')
			.join(' ')
			.trim();
	};
	const otherReadersKobo = async (list = readers) => {
		await mockLibrary({ list, books: newBooks(), overrides: { reader_for_kobo: () => 2 } });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		await waitFor(() => expect(handlers.has('device-detected')).toBe(true));
		handlers.get('device-detected')!({ payload: { device: kobo } });
		await waitFor(() => expect(library.connectedReaderId).toBe(2));
	};

	it('sync_disabled_without_kobo', async () => {
		await mockLibrary({ books: [makeBook({ id: 2, title: 'Beta', author: 'B', highlights: [hl('b1')] })] });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(1));

		expect(syncButton()).toHaveAttribute('aria-disabled', 'true');
		expect(await syncReason()).toBe('Connect your Kobo to sync');
		expect(header()).toBeNull();
	});

	it('sync_disabled_with_other_readers_kobo', async () => {
		await otherReadersKobo();

		expect(library.activeReaderId).toBe(1);
		expect(syncButton()).toHaveAttribute('aria-disabled', 'true');
		expect(await syncReason()).toBe('The connected Kobo belongs to Ana');
	});

	it('sync_reason_falls_back_without_reader_name', async () => {
		await otherReadersKobo([readers[0]]);

		expect(syncButton()).toHaveAttribute('aria-disabled', 'true');
		expect(await syncReason()).toBe('Connect your Kobo to sync');
	});

	it('sync_shortcut_does_nothing_without_kobo', async () => {
		await mockLibrary({ books: newBooks() });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));

		await press('r');
		await settle();

		expect(calls('sync_kobo')).toHaveLength(0);
		expect(library.lastSyncFailed).toBe(false);
		expect(library.isImporting).toBe(false);
	});

	it('export_works_without_kobo', async () => {
		const user = userEvent.setup();
		await mockLibrary({ books: newBooks() });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(3));
		expect(exportButton()).not.toHaveAttribute('aria-disabled', 'true');

		await user.click(exportButton());
		await waitFor(() => expect(calls('export_library_books')).toHaveLength(1));
		expect(invoke).toHaveBeenCalledWith('export_library_books', { readerId: 1, bookIds: [1, 2, 3] });

		vi.mocked(invoke).mockClear();
		await press('e');
		await waitFor(() => expect(calls('export_library_books')).toHaveLength(1));
	});

	it('sync_enables_on_reconnect', async () => {
		await mockLibrary({ books: newBooks(), device: kobo });
		render(Page);
		await syncReady();

		handlers.get('device-disconnected')!({ payload: null });
		await waitFor(() => expect(syncButton()).toHaveAttribute('aria-disabled', 'true'));

		handlers.get('device-detected')!({ payload: { device: kobo } });
		await syncReady();
		expect(calls('sync_kobo')).toHaveLength(0);
	});
});

describe('+page · screen 4 · list', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		handlers.clear();
		resetLibrary();
	});

	const sortBooks = () => [
		makeBook({ id: 1, title: 'Beta', author: 'Zed', dateLastRead: '2026-03-01T10:00:00Z', highlights: [hl('a')] }),
		makeBook({ id: 2, title: 'Alpha', author: null as unknown as string, dateLastRead: null, highlights: [hl('b'), hl('c')] }),
		makeBook({ id: 3, title: 'Gamma', author: 'Ana', dateLastRead: '2026-05-01T10:00:00Z', highlights: [] }),
		makeBook({ id: 4, title: 'Delta', author: '', dateLastRead: '2026-01-01T10:00:00Z', highlights: [hl('d'), hl('e'), hl('f')] })
	];
	const titles = () => [...document.querySelectorAll('[data-slot="book-row-title-text"]')].map((el) => el.textContent?.trim());
	const cardTitles = () => options().map((o) => o.getAttribute('aria-label')!.split(',')[0]);
	const openList = async (ui: Partial<typeof onDisk.uiPreferences>) => {
		await mockLibrary({ books: sortBooks(), ui: { libraryViewMode: 'list', ...ui } });
		render(Page);
		await waitFor(() => expect(titles()).toHaveLength(4));
	};
	const columnButton = (name: string) => screen.getByRole('button', { name });

	it('header_click_reverses_active_sort', async () => {
		await openList({ librarySort: 'title' });
		expect(titles()).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
		expect(screen.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('aria-sort', 'ascending');

		await fireEvent.click(columnButton('Title'));

		expect(titles()).toEqual(['Gamma', 'Delta', 'Beta', 'Alpha']);
		expect(screen.getByRole('columnheader', { name: 'Title' })).toHaveAttribute('aria-sort', 'descending');
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { librarySortReversed: true } });
		expect(settings.uiPreferences.librarySortReversed).toBe(true);

		await fireEvent.click(columnButton('Title'));
		expect(titles()).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
		expect(invoke).toHaveBeenLastCalledWith('update_settings', { patch: { librarySortReversed: false } });
	});

	it('header_click_other_column_resets_direction', async () => {
		await openList({ librarySort: 'title', librarySortReversed: true });

		await fireEvent.click(columnButton('Highlights'));

		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { librarySort: 'highlight_count', librarySortReversed: false } });
		expect(settings.uiPreferences.librarySort).toBe('highlight_count');
		expect(settings.uiPreferences.librarySortReversed).toBe(false);
		expect(titles()).toEqual(['Delta', 'Alpha', 'Beta', 'Gamma']);
	});

	it('menu_sort_resets_direction', async () => {
		await openList({ librarySort: 'title', librarySortReversed: true });
		const user = userEvent.setup();

		await user.click(await screen.findByRole('button', { name: 'Sort by' }));
		await user.click(await menuItem('Title (A-Z)'));

		expect(settings.uiPreferences.librarySortReversed).toBe(false);
		expect(titles()).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
		expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { librarySort: 'title', librarySortReversed: false } });
	});

	it('missing_date_stays_last_both_directions', async () => {
		await openList({ librarySort: 'date_last_read' });
		expect(titles()).toEqual(['Gamma', 'Beta', 'Delta', 'Alpha']);

		await fireEvent.click(columnButton('Last read'));

		expect(titles()).toEqual(['Delta', 'Beta', 'Gamma', 'Alpha']);
	});

	it('missing_author_stays_last_both_directions', async () => {
		await openList({ librarySort: 'author' });
		// Ana, Zed, then the two without an author, in a stable order
		expect(titles().slice(0, 2)).toEqual(['Gamma', 'Beta']);

		await fireEvent.click(columnButton('Author'));

		expect(titles().slice(0, 2)).toEqual(['Beta', 'Gamma']);
		expect(new Set(titles().slice(2))).toEqual(new Set(['Alpha', 'Delta']));
	});

	it('reversed_applies_to_grid_too', async () => {
		await mockLibrary({ books: sortBooks(), ui: { libraryViewMode: 'grid', librarySort: 'title', librarySortReversed: true } });
		render(Page);
		await waitFor(() => expect(options()).toHaveLength(4));

		expect(cardTitles()).toEqual(['Gamma', 'Delta', 'Beta', 'Alpha']);
	});

	it('list_click_on_a_row_opens_the_book', async () => {
		await openList({ librarySort: 'title' });

		await fireEvent.click(document.querySelectorAll('[data-slot="book-row"]')[0]);

		await waitFor(() => expect(screen.getByTestId('book-details-view')).toBeInTheDocument());
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
		mainWindow.onFocusChanged.mockClear();
		mainWindow.onResized.mockClear();
		mainWindow.isFullscreen.mockReset();
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

	it('bar_measures_once_without_waiting_for_focus', async () => {
		// Rust gives the lights' edge as tao will leave them, drawn or not: the mount's answer stands
		await mockLibrary({ books: newBooks(), overrides: { traffic_lights_max_x: () => 76 } });
		const page = render(Page);
		await waitFor(() => expect(block()?.style.width).toBe('60px'));
		await settle();
		expect(mainWindow.onFocusChanged).not.toHaveBeenCalled();
		expect(calls('traffic_lights_max_x')).toHaveLength(1);

		page.unmount();
		expect(windowUnlisten.resized).toHaveBeenCalled();
	});

	it('live_resize_checks_full_screen_without_measuring', async () => {
		await mockLibrary({ books: newBooks(), overrides: { traffic_lights_max_x: () => 76 } });
		render(Page);
		await waitFor(() => expect(block()?.style.width).toBe('60px'));
		await settle();
		mainWindow.isFullscreen.mockClear();

		// A live resize: one event per frame
		for (let i = 0; i < 20; i++) windowEvents.get('resized')!({ payload: { width: 1000 + i, height: 700 } });
		await settle();

		// One check, and one more for the events that came while it ran; the span is not measured again
		expect(mainWindow.isFullscreen.mock.calls.length).toBeLessThanOrEqual(2);
		expect(mainWindow.isFullscreen).toHaveBeenCalled();
		expect(calls('traffic_lights_max_x')).toHaveLength(1);
		expect(block()?.style.width).toBe('60px');
	});

	it('leaving_full_screen_restores_the_last_measurement', async () => {
		let answer: () => number | null = () => 76;
		await mockLibrary({ books: newBooks(), overrides: { traffic_lights_max_x: () => answer() } });
		render(Page);
		await waitFor(() => expect(block()?.style.width).toBe('60px'));

		// Measuring would fail from now on
		answer = () => {
			throw 'no NSWindow';
		};
		mainWindow.isFullscreen.mockImplementation(() => Promise.resolve(true));
		windowEvents.get('resized')!({ payload: { width: 2000, height: 1400 } });
		await waitFor(() => expect(block()).toBeNull());

		mainWindow.isFullscreen.mockImplementation(() => Promise.resolve(false));
		windowEvents.get('resized')!({ payload: { width: 1000, height: 700 } });
		await settle();
		// The 60 measured at mount, not the Figma's 52
		expect(block()?.style.width).toBe('60px');
	});

	it('a_resize_during_a_check_is_checked_again', async () => {
		await mockLibrary({ books: newBooks(), overrides: { traffic_lights_max_x: () => 76 } });
		render(Page);
		await waitFor(() => expect(block()?.style.width).toBe('60px'));
		await settle();

		// Entering full screen: the check is slow, and answers what it saw when it started (not yet)
		let answerFirst!: (fullscreen: boolean) => void;
		mainWindow.isFullscreen.mockImplementationOnce(() => new Promise((resolve) => (answerFirst = resolve)));
		mainWindow.isFullscreen.mockImplementation(() => Promise.resolve(true));
		windowEvents.get('resized')!({ payload: { width: 1500, height: 1000 } });
		// The last resize of the transition comes while that check runs
		windowEvents.get('resized')!({ payload: { width: 2000, height: 1400 } });
		answerFirst(false);
		await settle();

		// The late resize is checked after the stale answer, so full screen wins
		expect(block()).toBeNull();
	});

	it('a_listener_that_registers_after_destroy_is_removed', async () => {
		const late = vi.fn();
		let register!: (unlisten: typeof late) => void;
		mainWindow.onResized.mockImplementationOnce(() => new Promise((resolve) => (register = resolve)));
		await mockLibrary({ books: newBooks(), overrides: { traffic_lights_max_x: () => 76 } });
		const page = render(Page);
		await waitFor(() => expect(mainWindow.onResized).toHaveBeenCalled());

		page.unmount();
		register(late);
		await settle();
		expect(late).toHaveBeenCalledTimes(1);
	});
});
