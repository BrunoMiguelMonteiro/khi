import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	library,
	getDefaultExportPath,
	validateExportPath
} from './library.svelte';
import type { Book, KoboDevice } from '../types';
import { makeBook, makeDevice, makeHighlight } from '../test-fixtures';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';

const mockBooks: Book[] = [
	{ id: 1, title: 'Book One', author: 'Author One' },
	{ id: 2, title: 'Book Two', author: 'Author Two' }
].map(makeBook);

const kobo: KoboDevice = makeDevice({
	name: 'Kobo Libra',
	path: '/Volumes/KOBOeReader',
	isValid: true,
	serialNumber: 'N4181B5025147'
});

/** Routes each Tauri command to a canned answer. */
function answer(responses: Record<string, unknown>) {
	vi.mocked(invoke).mockImplementation((cmd: string) =>
		cmd in responses ? Promise.resolve(responses[cmd]) : Promise.reject(new Error(`unexpected ${cmd}`))
	);
}

describe('Library Store', () => {
	beforeEach(() => {
		library.clearBooks();
		library.deviceDisconnected();
		library.activeReaderId = null;
		library.setUiState('library');
		vi.clearAllMocks();
	});

	describe('State getters/setters', () => {
		it('should set and get books', () => {
			library.setBooks(mockBooks);
			expect(library.books).toEqual(mockBooks);
		});

		it('should set and get selected book IDs', () => {
			library.setSelectedBookIds([1, 2]);
			expect(library.selectedBookIds).toEqual([1, 2]);
		});

		it('should get selected books', () => {
			library.setBooks(mockBooks);
			library.setSelectedBookIds([1]);
			expect(library.selectedBooks).toEqual([mockBooks[0]]);
		});

		it('should update a book', () => {
			library.setBooks(mockBooks);
			library.updateBook({ ...mockBooks[0], title: 'Updated Title' });
			expect(library.books[0].title).toBe('Updated Title');
		});

		it('should remove a book and its selection', () => {
			library.setBooks(mockBooks);
			library.setSelectedBookIds([1, 2]);
			library.removeBook(1);
			expect(library.books).toEqual([mockBooks[1]]);
			expect(library.selectedBookIds).toEqual([2]);
		});

		it('should clear all books and selections', () => {
			library.setBooks(mockBooks);
			library.setSelectedBookIds([1]);
			library.clearBooks();
			expect(library.books).toEqual([]);
			expect(library.selectedBookIds).toEqual([]);
		});
	});

	describe('Readers', () => {
		it('opens the reader of the connected kobo', async () => {
			answer({ reader_for_kobo: 7, last_reader: 3 });

			const readerId = await library.initialReader('N4181B5025147');

			expect(readerId).toBe(7);
			expect(invoke).toHaveBeenCalledWith('reader_for_kobo', { serial: 'N4181B5025147' });
			expect(invoke).not.toHaveBeenCalledWith('last_reader');
		});

		it('falls back to last reader', async () => {
			answer({ reader_for_kobo: null, last_reader: 3 });

			expect(await library.initialReader('UNKNOWN')).toBe(3);
			expect(await library.initialReader()).toBe(3);
		});

		it('openReader loads that reader\'s library from Rust', async () => {
			answer({ get_library: mockBooks });

			await library.openReader(4);

			expect(invoke).toHaveBeenCalledWith('get_library', { readerId: 4 });
			expect(library.activeReaderId).toBe(4);
			expect(library.books).toEqual(mockBooks);
		});

		it('openReader clears the selection by default', async () => {
			library.activeReaderId = 4;
			library.setBooks(mockBooks);
			library.setSelectedBookIds([1, 2]);
			answer({ get_library: mockBooks });

			await library.openReader(4);

			expect(library.selectedBookIds).toEqual([]);
		});

		it('keep_selection_keeps_the_ids_still_in_the_library', async () => {
			library.activeReaderId = 4;
			library.setBooks(mockBooks);
			library.setSelectedBookIds([1, 2]);
			// Book 2 is gone from the reload
			answer({ get_library: [mockBooks[0]] });

			await library.openReader(4, { keepSelection: true });

			expect(library.selectedBookIds).toEqual([1]);
		});

		it('keep_selection_keeps_a_selection_made_while_loading', async () => {
			library.activeReaderId = 4;
			library.setBooks(mockBooks);
			let resolve!: (books: Book[]) => void;
			vi.mocked(invoke).mockImplementation((cmd: string) =>
				cmd === 'get_library' ? new Promise((r) => (resolve = r)) : Promise.reject(new Error(`unexpected ${cmd}`))
			);

			const opening = library.openReader(4, { keepSelection: true });
			// Selected while Rust reads the Library
			library.setSelectedBookIds([2]);
			resolve(mockBooks);
			await opening;

			expect(library.selectedBookIds).toEqual([2]);
		});

		it('keep_selection_never_keeps_another_readers_ids', async () => {
			library.activeReaderId = 4;
			library.setBooks(mockBooks);
			library.setSelectedBookIds([1, 2]);
			// Reader 9 happens to have books with the same ids
			answer({ get_library: mockBooks });

			await library.openReader(9, { keepSelection: true });

			expect(library.activeReaderId).toBe(9);
			expect(library.selectedBookIds).toEqual([]);
		});

		it('sync_keeps_the_selection_present_after_it', async () => {
			library.activeReaderId = 5;
			library.setBooks(mockBooks);
			library.setSelectedBookIds([1, 2]);
			answer({ reader_for_kobo: 5, sync_kobo: { added: 0 }, get_library: [mockBooks[1]] });

			await library.deviceConnected(kobo, true);

			expect(library.selectedBookIds).toEqual([2]);
		});

		it('loadReaders fills readers', async () => {
			const readers = [{ id: 1, name: 'Bruno', exportPath: null }];
			answer({ list_readers: readers });

			await library.loadReaders();

			expect(library.readers).toEqual(readers);
		});
	});

	describe('Device', () => {
		it('disconnect keeps books visible', () => {
			library.setBooks(mockBooks);
			library.setConnectedDevice(kobo);
			library.setUiState('library');

			library.deviceDisconnected();

			expect(library.connectedDevice).toBeUndefined();
			expect(library.uiState).toBe('library');
			expect(library.books).toEqual(mockBooks);
		});

		it('should scan for device and update connectedDevice', async () => {
			vi.mocked(invoke).mockResolvedValueOnce(kobo);

			const result = await library.scanForDevice();

			expect(invoke).toHaveBeenCalledWith('scan_for_device');
			expect(result).toEqual(kobo);
			expect(library.connectedDevice).toEqual(kobo);
			expect(library.isScanning).toBe(false);
		});

		it('should handle null device response', async () => {
			vi.mocked(invoke).mockResolvedValueOnce(null);

			expect(await library.scanForDevice()).toBeNull();
			expect(library.connectedDevice).toBeUndefined();
		});

		it('should handle scan errors', async () => {
			vi.mocked(invoke).mockRejectedValueOnce(new Error('Scan failed'));

			expect(await library.scanForDevice()).toBeNull();
			expect(library.connectedDevice).toBeUndefined();
		});
	});

	describe('Sync', () => {
		it('known kobo syncs on connect when enabled', async () => {
			answer({ reader_for_kobo: 5, sync_kobo: { added: 2 }, get_library: mockBooks });

			const outcome = await library.deviceConnected(kobo, true);

			expect(outcome).toBe('synced');
			expect(invoke).toHaveBeenCalledWith('sync_kobo', { device: kobo });
			expect(invoke).toHaveBeenCalledWith('get_library', { readerId: 5 });
			expect(library.books).toEqual(mockBooks);
			expect(library.isImporting).toBe(false);
		});

		it('does not sync when syncOnConnect is off', async () => {
			library.activeReaderId = 5;
			answer({ reader_for_kobo: 5, get_library: mockBooks });

			const outcome = await library.deviceConnected(kobo, false);

			expect(outcome).toBe('idle');
			expect(invoke).not.toHaveBeenCalledWith('sync_kobo', expect.anything());
			expect(library.connectedDevice).toEqual(kobo);
		});

		it('first kobo with no readers creates a reader named after it and syncs', async () => {
			const created = { id: 1, name: 'Kobo Libra', exportPath: null };
			answer({
				reader_for_kobo: null,
				list_readers: [],
				create_reader: created,
				associate_kobo: null,
				sync_kobo: { added: 3 },
				get_library: mockBooks
			});

			const outcome = await library.deviceConnected(kobo, true);

			expect(outcome).toBe('synced');
			expect(invoke).toHaveBeenCalledWith('create_reader', { name: 'Kobo Libra' });
			expect(invoke).toHaveBeenCalledWith('associate_kobo', { serial: 'N4181B5025147', readerId: 1 });
			expect(invoke).toHaveBeenCalledWith('sync_kobo', { device: kobo });
			expect(library.activeReaderId).toBe(1);
		});

		it('first kobo with sync on connect off still gets a reader and opens it', async () => {
			answer({
				reader_for_kobo: null,
				list_readers: [],
				create_reader: { id: 1, name: 'Kobo Libra', exportPath: null },
				associate_kobo: null,
				get_library: []
			});

			expect(await library.deviceConnected(kobo, false)).toBe('idle');
			expect(library.activeReaderId).toBe(1);
			expect(invoke).not.toHaveBeenCalledWith('sync_kobo', expect.anything());
		});

		it('first_kobo_opens_its_reader_before_syncing', async () => {
			const order: string[] = [];
			vi.mocked(invoke).mockImplementation((cmd: string) => {
				order.push(cmd);
				if (cmd === 'reader_for_kobo') return Promise.resolve(null);
				if (cmd === 'list_readers') return Promise.resolve([]);
				if (cmd === 'create_reader') return Promise.resolve({ id: 1, name: 'Kobo Libra', exportPath: null });
				if (cmd === 'sync_kobo') return Promise.reject('disk is full');
				if (cmd === 'get_library') return Promise.resolve(mockBooks);
				return Promise.resolve(null);
			});

			await expect(library.deviceConnected(kobo, true)).rejects.toBe('disk is full');

			// The Library is on screen when the Sync fails, and Sync works again
			expect(order.indexOf('get_library')).toBeGreaterThan(-1);
			expect(order.indexOf('get_library')).toBeLessThan(order.indexOf('sync_kobo'));
			expect(library.activeReaderId).toBe(1);
			expect(library.books).toEqual(mockBooks);
			expect(library.canSync).toBe(true);
		});

		it('last_sync_failed_follows_the_last_sync', async () => {
			const log = vi.spyOn(console, 'error').mockImplementation(() => {});
			library.setConnectedDevice(kobo);
			library.connectedReaderId = 5;
			library.activeReaderId = 5;
			let fail = true;
			vi.mocked(invoke).mockImplementation((cmd: string) => {
				if (cmd === 'sync_kobo') return fail ? Promise.reject('disk is full') : Promise.resolve({ added: 0 });
				if (cmd === 'get_library') return Promise.resolve(mockBooks);
				return Promise.resolve(null);
			});

			// It fails: the store remembers it (the order against isImporting is the page's test)
			const failing = library.sync();
			expect(library.lastSyncFailed).toBe(false);
			await expect(failing).rejects.toBe('disk is full');
			expect(library.isImporting).toBe(false);
			expect(library.lastSyncFailed).toBe(true);

			// The next one clears it as soon as it starts, not when it ends
			fail = false;
			const next = library.sync();
			expect(library.isImporting).toBe(true);
			expect(library.lastSyncFailed).toBe(false);
			await next;
			expect(library.lastSyncFailed).toBe(false);
			log.mockRestore();
		});

		it('first_kobo_shows_its_library_while_syncing', async () => {
			library.setUiState('no-device');
			let screenDuringSync: string | undefined;
			vi.mocked(invoke).mockImplementation((cmd: string) => {
				if (cmd === 'reader_for_kobo') return Promise.resolve(null);
				if (cmd === 'list_readers') return Promise.resolve([]);
				if (cmd === 'create_reader') return Promise.resolve({ id: 1, name: 'Kobo Libra', exportPath: null });
				if (cmd === 'sync_kobo') {
					screenDuringSync = library.uiState;
					return Promise.resolve({ added: 3 });
				}
				if (cmd === 'get_library') return Promise.resolve(mockBooks);
				return Promise.resolve(null);
			});

			await library.deviceConnected(kobo, true);

			// No ImportingState any more: the new Reader's Library is what the Sync fills
			expect(screenDuringSync).toBe('library');
		});

		it('another_readers_kobo_switches_the_library_before_syncing', async () => {
			// Reader 7's Library on screen, a book open and one selected
			library.activeReaderId = 7;
			library.setBooks(mockBooks);
			library.setSelectedBookIds([2]);
			const theirs = [makeBook({ id: 9, title: 'Ana Book', author: 'Ana' })];
			let during: Record<string, unknown> = {};
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
				if (cmd === 'reader_for_kobo') return Promise.resolve(5);
				if (cmd === 'sync_kobo') {
					during = {
						activeReaderId: library.activeReaderId,
						uiState: library.uiState,
						selected: [...library.selectedBookIds],
						viewing: library.viewingBookId,
						books: library.books.map((b) => b.id)
					};
					return Promise.resolve({ added: 1 });
				}
				if (cmd === 'get_library') return Promise.resolve((args as { readerId: number }).readerId === 5 ? theirs : mockBooks);
				return Promise.resolve(null);
			});
			await library.openBook(1);
			library.setUiState('book-details');

			expect(await library.deviceConnected(kobo, true)).toBe('synced');

			// Reader 5's Library is what the Sync fills; nothing of reader 7's stays
			expect(during).toEqual({ activeReaderId: 5, uiState: 'library', selected: [], viewing: null, books: [9] });
			expect(library.activeReaderId).toBe(5);
			expect(library.books).toEqual(theirs);
			expect(library.canSync).toBe(true);
		});

		it('another_readers_kobo_with_sync_on_connect_off_leaves_the_library', async () => {
			library.activeReaderId = 7;
			library.setBooks(mockBooks);
			answer({ reader_for_kobo: 5, library_summary: null });

			expect(await library.deviceConnected(kobo, false)).toBe('idle');

			expect(library.activeReaderId).toBe(7);
			expect(library.books).toEqual(mockBooks);
			expect(invoke).not.toHaveBeenCalledWith('get_library', expect.anything());
		});

		it('another_readers_kobo_mid_sync_waits_then_switches_and_syncs', async () => {
			library.setConnectedDevice(kobo);
			library.connectedReaderId = 7;
			library.activeReaderId = 7;
			const other = makeDevice({ ...kobo, serialNumber: 'OTHER' });
			const theirs = [makeBook({ id: 9, title: 'Ana Book', author: 'Ana' })];
			const syncs: Array<{ device: KoboDevice; finish: (r: unknown) => void }> = [];
			const order: string[] = [];
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
				if (cmd === 'reader_for_kobo') return Promise.resolve(5);
				if (cmd === 'sync_kobo') {
					const { device } = args as { device: KoboDevice };
					order.push(`sync ${device.serialNumber}`);
					return new Promise((finish) => syncs.push({ device, finish }));
				}
				if (cmd === 'get_library') {
					const { readerId } = args as { readerId: number };
					order.push(`library ${readerId}`);
					return Promise.resolve(readerId === 5 ? theirs : mockBooks);
				}
				return Promise.resolve(null);
			});
			const running = library.sync();
			await vi.waitFor(() => expect(syncs).toHaveLength(1));

			let outcome: string | undefined;
			const connecting = library.deviceConnected(other, true).then((o) => (outcome = o));
			try {
				// Reader 7's Sync is not reader 5's: the connect waits for it, on reader 7's Library
				await new Promise((r) => setTimeout(r, 0));
				expect(library.activeReaderId).toBe(7);
				expect(syncs).toHaveLength(1);

				// Its end lands first, then reader 5's Library shows and syncs
				syncs[0].finish({ added: 0 });
				await running;
				await vi.waitFor(() => expect(syncs).toHaveLength(2));
				expect(order).toEqual(['sync N4181B5025147', 'library 7', 'library 5', 'sync OTHER']);
				expect(syncs[1].device).toEqual(other);
				expect(library.activeReaderId).toBe(5);
				expect(library.books).toEqual(theirs);
				expect(outcome).toBeUndefined();

				syncs[1].finish({ added: 1 });
				await connecting;
				expect(outcome).toBe('synced');
				expect(library.canSync).toBe(true);
			} finally {
				// A Sync left running would reach the next tests
				for (const sync of syncs) sync.finish({ added: 0 });
				await running.catch(() => {});
				await connecting;
			}
		});

		it.each([
			['unplugged', () => library.deviceDisconnected()],
			['replaced by another kobo', () => library.deviceConnected(makeDevice({ ...kobo, serialNumber: 'THIRD' }), false)]
		])('a_kobo_waiting_for_a_sync_and_%s_is_never_synced', async (_, meanwhile) => {
			library.setConnectedDevice(kobo);
			library.connectedReaderId = 7;
			library.activeReaderId = 7;
			const other = makeDevice({ ...kobo, serialNumber: 'OTHER' });
			const synced: Array<string | null> = [];
			let finish!: (r: unknown) => void;
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
				if (cmd === 'reader_for_kobo') return Promise.resolve((args as { serial: string }).serial === 'OTHER' ? 5 : 3);
				if (cmd === 'sync_kobo') {
					synced.push((args as { device: KoboDevice }).device.serialNumber);
					return synced.length === 1 ? new Promise((resolve) => (finish = resolve)) : Promise.resolve({ added: 0 });
				}
				if (cmd === 'get_library') return Promise.resolve(mockBooks);
				return Promise.resolve(null);
			});
			const running = library.sync();
			await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
			const connecting = library.deviceConnected(other, true);
			try {
				await new Promise((r) => setTimeout(r, 0));
				// Reader 5's Kobo goes while it waits for reader 7's Sync
				await meanwhile();
			} finally {
				finish({ added: 0 });
				await running;
			}

			expect(await connecting).toBe('idle');
			expect(synced).toEqual(['N4181B5025147']);
			expect(library.activeReaderId).toBe(7);
		});

		it('a_switch_whose_library_cannot_be_read_fails_on_that_library', async () => {
			const log = vi.spyOn(console, 'error').mockImplementation(() => {});
			// Reader 7's book open; reader 5's Library cannot be read
			library.activeReaderId = 7;
			library.setBooks(mockBooks);
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
				if (cmd === 'reader_for_kobo') return Promise.resolve(5);
				if (cmd === 'get_library' && (args as { readerId: number }).readerId === 5) return Promise.reject('disk is full');
				if (cmd === 'get_library') return Promise.resolve(mockBooks);
				return Promise.resolve(null);
			});
			await library.openBook(1);
			library.setUiState('book-details');

			await expect(library.deviceConnected(kobo, true)).rejects.toBe('disk is full');

			// The error is reader 5's, on reader 5's Library, where Sync works again
			expect(library.activeReaderId).toBe(5);
			expect(library.uiState).toBe('library');
			expect(library.viewingBookId).toBeNull();
			expect(library.books).toEqual([]);
			expect(library.summary).toBeNull();
			expect(library.lastSyncFailed).toBe(true);
			expect(library.canSync).toBe(true);
			expect(invoke).not.toHaveBeenCalledWith('sync_kobo', expect.anything());
			log.mockRestore();
		});

		it('same_readers_other_kobo_mid_sync_joins_the_running_sync', async () => {
			library.setConnectedDevice(kobo);
			library.connectedReaderId = 7;
			library.activeReaderId = 7;
			let finish!: (r: unknown) => void;
			vi.mocked(invoke).mockImplementation((cmd: string) => {
				if (cmd === 'reader_for_kobo') return Promise.resolve(7);
				if (cmd === 'sync_kobo') return new Promise((resolve) => (finish = resolve));
				if (cmd === 'get_library') return Promise.resolve(mockBooks);
				return Promise.resolve(null);
			});
			const running = library.sync();
			await vi.waitFor(() => expect(finish).toBeTypeOf('function'));

			const connecting = library.deviceConnected(makeDevice({ ...kobo, serialNumber: 'OTHER' }), true);
			await new Promise((r) => setTimeout(r, 0));
			finish({ added: 0 });

			expect(await connecting).toBe('synced');
			await running;
			expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'sync_kobo')).toHaveLength(1);
		});

		it('switch_shows_the_new_library_in_one_step', async () => {
			// Reader 7's book open; reader 5's Library takes a while to read
			library.activeReaderId = 7;
			library.setBooks(mockBooks);
			const theirs = [makeBook({ id: 9, title: 'Ana Book', author: 'Ana' })];
			let readTheirs: ((books: Book[]) => void) | undefined;
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
				if (cmd === 'reader_for_kobo') return Promise.resolve(5);
				if (cmd === 'sync_kobo') return Promise.resolve({ added: 0 });
				// Only the first read is slow: the Sync's own reload answers at once
				if (cmd === 'get_library' && (args as { readerId: number }).readerId === 5)
					return readTheirs ? Promise.resolve(theirs) : new Promise((resolve) => (readTheirs = resolve));
				if (cmd === 'get_library') return Promise.resolve(mockBooks);
				return Promise.resolve(null);
			});
			await library.openBook(1);
			library.setUiState('book-details');

			const connecting = library.deviceConnected(kobo, true);
			await vi.waitFor(() => expect(readTheirs).toBeTypeOf('function'));
			// Until it arrives the book stays, and the Sync has begun: nothing of reader 7 can be acted on
			expect(library.uiState).toBe('book-details');
			expect(library.viewingBook).toEqual(mockBooks[0]);
			expect(library.isImporting).toBe(true);

			readTheirs!(theirs);
			await vi.waitFor(() => expect(library.activeReaderId).toBe(5));
			expect(library.uiState).toBe('library');
			expect(library.viewingBookId).toBeNull();
			expect(library.books).toEqual(theirs);
			expect(await connecting).toBe('synced');
		});

		it('a_reader_opened_before_the_switch_does_not_land_over_it', async () => {
			library.activeReaderId = 7;
			let readThird!: (books: Book[]) => void;
			let finish!: (r: unknown) => void;
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
				if (cmd === 'reader_for_kobo') return Promise.resolve(5);
				if (cmd === 'sync_kobo') return new Promise((resolve) => (finish = resolve));
				if (cmd === 'get_library' && (args as { readerId: number }).readerId === 3)
					return new Promise((resolve) => (readThird = resolve));
				if (cmd === 'get_library') return Promise.resolve([]);
				return Promise.resolve(null);
			});
			// Reader 3 picked in the title menu just before the Kobo of reader 5 arrives
			const picked = library.openReader(3);
			await vi.waitFor(() => expect(readThird).toBeTypeOf('function'));
			const connecting = library.deviceConnected(kobo, true);
			try {
				await vi.waitFor(() => expect(finish).toBeTypeOf('function'));

				// Reader 3's Library arrives while reader 5's syncs: the Sync's Library stays
				readThird(mockBooks);
				await picked;
				expect(library.activeReaderId).toBe(5);
				expect(library.books).toEqual([]);
			} finally {
				finish({ added: 0 });
				await connecting;
			}
		});

		it('an unknown kobo is reported and never synced', async () => {
			answer({ reader_for_kobo: null, list_readers: [{ id: 3, name: 'Ana', exportPath: null }] });

			const outcome = await library.deviceConnected(kobo, true);

			expect(outcome).toBe('unknown');
			expect(invoke).not.toHaveBeenCalledWith('sync_kobo', expect.anything());
		});

		it('sync button disabled without the reader\'s kobo', async () => {
			answer({ reader_for_kobo: 5, get_library: mockBooks });
			expect(library.canSync).toBe(false);

			library.activeReaderId = 7;
			await library.deviceConnected(kobo, false);
			expect(library.canSync).toBe(false);

			library.activeReaderId = 5;
			expect(library.canSync).toBe(true);

			library.deviceDisconnected();
			expect(library.canSync).toBe(false);
		});

		it('a second connect while syncing reuses the running sync', async () => {
			let finish!: (r: unknown) => void;
			vi.mocked(invoke).mockImplementation((cmd: string) => {
				if (cmd === 'reader_for_kobo') return Promise.resolve(5);
				if (cmd === 'get_library') return Promise.resolve(mockBooks);
				if (cmd === 'sync_kobo') return new Promise((resolve) => (finish = resolve));
				return Promise.reject(new Error(`unexpected ${cmd}`));
			});

			// Startup scan and the monitor's first device-detected, 2 s apart
			const first = library.deviceConnected(kobo, true);
			await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('sync_kobo', { device: kobo }));
			const second = library.deviceConnected(kobo, true);
			await new Promise((r) => setTimeout(r, 0));
			finish({ added: 1 });

			expect(await first).toBe('synced');
			expect(await second).toBe('synced');
			expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'sync_kobo')).toHaveLength(1);
		});

		it('the same kobo reported again after its sync does not sync twice', async () => {
			answer({ reader_for_kobo: 5, sync_kobo: { added: 1 }, get_library: mockBooks });

			// Startup sync ends in under 2 s; then the monitor reports the same Kobo
			expect(await library.deviceConnected(kobo, true)).toBe('synced');
			expect(await library.deviceConnected(kobo, true)).toBe('idle');

			expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'sync_kobo')).toHaveLength(1);
		});

		it('reconnecting the kobo syncs again', async () => {
			answer({ reader_for_kobo: 5, sync_kobo: { added: 1 }, get_library: mockBooks });

			await library.deviceConnected(kobo, true);
			library.deviceDisconnected();
			await library.deviceConnected(kobo, true);

			expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'sync_kobo')).toHaveLength(2);
		});

		it('sync without a known connected kobo throws', async () => {
			await expect(library.sync()).rejects.toThrow('No known Kobo connected');
		});
	});

	describe('exportIds', () => {
		it('should throw error if no books are given', async () => {
			library.activeReaderId = 1;
			library.setBooks(mockBooks);

			await expect(library.exportIds([])).rejects.toThrow('No books selected for export');
		});

		it('exports the ids of the active reader', async () => {
			library.activeReaderId = 9;
			library.setBooks(mockBooks);
			answer({ export_library_books: ['/x/Book Two.md'] });

			const result = await library.exportIds([2]);

			expect(invoke).toHaveBeenCalledWith('export_library_books', { readerId: 9, bookIds: [2] });
			expect(result).toEqual(['/x/Book Two.md']);
		});
	});

	describe('getDefaultExportPath', () => {
		it('should return default export path from Tauri', async () => {
			vi.mocked(invoke).mockResolvedValueOnce('/Users/test/Documents/Kobo Highlights');

			const result = await getDefaultExportPath();

			expect(invoke).toHaveBeenCalledWith('get_default_export_path');
			expect(result).toBe('/Users/test/Documents/Kobo Highlights');
		});

		it('should return fallback on error', async () => {
			vi.mocked(invoke).mockRejectedValueOnce(new Error('Failed'));

			expect(await getDefaultExportPath()).toBe('~/Documents/Kobo Highlights');
		});
	});

	describe('validateExportPath', () => {
		it('should return true for valid path', async () => {
			vi.mocked(invoke).mockResolvedValueOnce(true);

			const result = await validateExportPath('/valid/path');

			expect(invoke).toHaveBeenCalledWith('validate_export_path', { path: '/valid/path' });
			expect(result).toBe(true);
		});

		it('should return false for invalid path', async () => {
			vi.mocked(invoke).mockResolvedValueOnce(false);
			expect(await validateExportPath('/invalid/path')).toBe(false);
		});

		it('should return false on error', async () => {
			vi.mocked(invoke).mockRejectedValueOnce(new Error('Validation failed'));
			expect(await validateExportPath('/path')).toBe(false);
		});
	});

	describe('Exporting clears the news (Task 36)', () => {
		const hl = (id: string, isNew: boolean, syncedSeq: number | null) =>
			makeHighlight({ id, text: id, dateCreated: '2026-01-01', isNew, syncedSeq });
		const bookOf = (id: number, ...highlights: ReturnType<typeof hl>[]) =>
			makeBook({ id, title: `B${id}`, author: 'A', highlights });
		const isNewOf = (bookId: number, id: string) =>
			library.books.find((b) => b.id === bookId)?.highlights.find((h) => h.id === id)?.isNew;

		beforeEach(() => {
			library.closeBook();
			library.activeReaderId = 9;
		});

		it('export_clears_new_of_exported_books', async () => {
			library.setBooks([
				bookOf(1, hl('a', true, 2), hl('b', false, 1), hl('c', true, 3)),
				bookOf(2, hl('x', true, 4))
			]);
			answer({ export_library_books: ['/x/B1.md'], mark_book_opened: null });

			const result = await library.exportIds([1]);

			expect(result).toEqual(['/x/B1.md']);
			expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 9, bookId: 1, seenSeq: 3 });
			expect(isNewOf(1, 'a')).toBe(false);
			expect(isNewOf(1, 'c')).toBe(false);
			// A book that was not exported stays new
			expect(isNewOf(2, 'x')).toBe(true);
			expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'mark_book_opened')).toHaveLength(1);
			// The open book's snapshot belongs to openBook alone
			expect(library.viewingNewIds.size).toBe(0);
		});

		it('export_keeps_new_that_arrived_during_export', async () => {
			library.setBooks([bookOf(1, hl('a', true, 2))]);
			let finishExport!: () => void;
			vi.mocked(invoke).mockImplementation((cmd: string) => {
				if (cmd === 'export_library_books') return new Promise((r) => (finishExport = () => r(['/x/B1.md'])));
				if (cmd === 'get_library') return Promise.resolve([bookOf(1, hl('a', true, 2), hl('z', true, 5))]);
				if (cmd === 'mark_book_opened') return Promise.resolve(null);
				return Promise.reject(new Error(`unexpected ${cmd}`));
			});

			const exporting = library.exportIds([1]);
			// A Sync reloads the Library mid-export and brings a new highlight
			await library.openReader(9);
			finishExport();
			await exporting;

			expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 9, bookId: 1, seenSeq: 2 });
			expect(isNewOf(1, 'a')).toBe(false);
			expect(isNewOf(1, 'z')).toBe(true);
		});

		it('export_remembers_the_files_of_the_last_export_for_the_session', async () => {
			library.setBooks([bookOf(1, hl('a', true, 2))]);
			library.lastExport = [];
			answer({ export_library_books: ['/x/B1.md', '/x/B2.md'], mark_book_opened: null });

			await library.exportIds([1]);
			expect(library.lastExport).toEqual(['/x/B1.md', '/x/B2.md']);

			// A failed export leaves the last good one as it was
			vi.mocked(invoke).mockImplementation(() => Promise.reject('boom'));
			await expect(library.exportIds([1])).rejects.toBe('boom');
			expect(library.lastExport).toEqual(['/x/B1.md', '/x/B2.md']);
		});

		it('failed_export_keeps_new', async () => {
			library.setBooks([bookOf(1, hl('a', true, 2))]);
			vi.mocked(invoke).mockImplementation((cmd: string) =>
				cmd === 'export_library_books' ? Promise.reject('boom') : Promise.reject(new Error(`unexpected ${cmd}`))
			);

			await expect(library.exportIds([1])).rejects.toBe('boom');

			expect(isNewOf(1, 'a')).toBe(true);
			expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'mark_book_opened')).toHaveLength(0);
			expect(library.isExporting).toBe(false);
		});

		it('mark_failure_does_not_undo_the_export', async () => {
			library.setBooks([bookOf(1, hl('a', true, 2)), bookOf(2, hl('x', true, 4))]);
			const log = vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
				if (cmd === 'export_library_books') return Promise.resolve(['/x/B1.md', '/x/B2.md']);
				if (cmd === 'mark_book_opened')
					return (args as { bookId: number }).bookId === 1 ? Promise.reject('boom') : Promise.resolve(null);
				return Promise.reject(new Error(`unexpected ${cmd}`));
			});

			await expect(library.exportIds([1, 2])).resolves.toEqual(['/x/B1.md', '/x/B2.md']);

			// The book whose mark failed stays new; the other one is cleared
			expect(isNewOf(1, 'a')).toBe(true);
			expect(isNewOf(2, 'x')).toBe(false);
			expect(log).toHaveBeenCalled();
			log.mockRestore();
		});
	});

	describe('Library summary (Task 36)', () => {
		it('open_reader_loads_the_summary_of_the_connected_kobo', async () => {
			library.setConnectedDevice(kobo);
			answer({
				get_library: mockBooks,
				library_summary: { newSince: '2026-11-09T10:00:00Z', lastSyncAt: '2026-11-19T10:42:00Z' }
			});

			await library.openReader(4);

			expect(invoke).toHaveBeenCalledWith('library_summary', { readerId: 4, koboSerial: 'N4181B5025147' });
			expect(library.summary).toEqual({ newSince: '2026-11-09T10:00:00Z', lastSyncAt: '2026-11-19T10:42:00Z' });
		});

		it('summary_failure_does_not_break_open_reader', async () => {
			const log = vi.spyOn(console, 'error').mockImplementation(() => {});
			answer({ get_library: mockBooks });

			await expect(library.openReader(4)).resolves.toBeUndefined();

			expect(library.books).toEqual(mockBooks);
			expect(library.summary).toBeNull();
			log.mockRestore();
		});

		it('disconnecting_the_kobo_reloads_the_summary_without_it', async () => {
			library.activeReaderId = 4;
			library.setConnectedDevice(kobo);
			answer({ library_summary: { newSince: null, lastSyncAt: null } });

			library.deviceDisconnected();
			await vi.waitFor(() =>
				expect(invoke).toHaveBeenCalledWith('library_summary', { readerId: 4, koboSerial: null })
			);
		});
	});

	describe('Review fixes (Task 36)', () => {
		const hl = (id: string, isNew: boolean, syncedSeq: number | null) =>
			makeHighlight({ id, text: id, dateCreated: '2026-01-01', isNew, syncedSeq });
		const bookOf = (id: number, ...highlights: ReturnType<typeof hl>[]) =>
			makeBook({ id, title: `B${id}`, author: 'A', highlights });

		beforeEach(() => {
			library.closeBook();
			library.activeReaderId = 9;
			library.summary = null;
		});

		it('is_exporting_stays_true_until_marks_finish', async () => {
			library.setBooks([bookOf(1, hl('a', true, 2))]);
			let finishMark!: () => void;
			vi.mocked(invoke).mockImplementation((cmd: string) => {
				if (cmd === 'export_library_books') return Promise.resolve(['/x/B1.md']);
				if (cmd === 'mark_book_opened') return new Promise((r) => (finishMark = () => r(null)));
				return Promise.resolve(null);
			});

			const exporting = library.exportIds([1]);
			await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('mark_book_opened', expect.anything()));
			expect(library.isExporting).toBe(true);
			finishMark();
			await exporting;
			expect(library.isExporting).toBe(false);
		});

		it('export_skips_mark_for_books_without_news', async () => {
			library.setBooks([bookOf(1, hl('a', false, 2)), bookOf(2, hl('b', true, 3))]);
			answer({ export_library_books: ['x'], mark_book_opened: null, library_summary: null });

			await library.exportIds([1, 2]);

			const marks = vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'mark_book_opened');
			expect(marks).toEqual([['mark_book_opened', { readerId: 9, bookId: 2, seenSeq: 3 }]]);
		});

		it('summary_is_cleared_at_once_on_reader_switch_and_disconnect', async () => {
			library.setConnectedDevice(kobo);
			library.summary = { newSince: '2026-11-09T10:00:00Z', lastSyncAt: '2026-11-19T10:42:00Z' };
			// A disconnect drops the sync time right away, before the reload answers
			vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));
			library.deviceDisconnected();
			expect(library.summary?.lastSyncAt).toBeNull();

			library.summary = { newSince: '2026-11-09T10:00:00Z', lastSyncAt: '2026-11-19T10:42:00Z' };
			vi.mocked(invoke).mockImplementation((cmd: string) =>
				cmd === 'get_library' ? Promise.resolve([]) : new Promise(() => {})
			);
			void library.openReader(4);
			await vi.waitFor(() => expect(library.activeReaderId).toBe(4));
			expect(library.summary).toBeNull();
		});

		it('summary_is_reloaded_after_the_marks_of_open_and_export', async () => {
			library.setBooks([bookOf(1, hl('a', true, 2))]);
			answer({ mark_book_opened: null, export_library_books: ['x'], library_summary: { newSince: null, lastSyncAt: null } });

			await library.openBook(1);
			expect(invoke).toHaveBeenCalledWith('library_summary', { readerId: 9, koboSerial: null });

			library.setBooks([bookOf(1, hl('b', true, 3))]);
			vi.mocked(invoke).mockClear();
			await library.exportIds([1]);
			const cmds = vi.mocked(invoke).mock.calls.map(([cmd]) => cmd);
			expect(cmds.indexOf('library_summary')).toBeGreaterThan(cmds.indexOf('mark_book_opened'));
		});

		it('stale_summary_response_does_not_win', async () => {
			const resolvers: Array<(v: unknown) => void> = [];
			vi.mocked(invoke).mockImplementation((cmd: string) =>
				cmd === 'library_summary' ? new Promise((r) => resolvers.push(r)) : Promise.resolve(null)
			);

			const older = library.loadSummary();
			const newer = library.loadSummary();
			resolvers[1]({ newSince: 'new', lastSyncAt: null });
			await newer;
			resolvers[0]({ newSince: 'old', lastSyncAt: null });
			await older;

			expect(library.summary?.newSince).toBe('new');
		});
	});

	describe('Opening a book (D1)', () => {
		const hl = (id: string, isNew: boolean, syncedSeq: number | null) =>
			makeHighlight({ id, text: id, dateCreated: '2026-01-01', isNew, syncedSeq });
		const bookWith = (...highlights: ReturnType<typeof hl>[]) =>
			makeBook({ id: 1, title: 'B', author: 'A', highlights });
		const isNewOf = (id: string) =>
			library.books.find((b) => b.id === 1)?.highlights.find((h) => h.id === id)?.isNew;

		beforeEach(() => {
			library.closeBook();
			library.activeReaderId = 9;
		});

		it('snapshot_taken_before_mark', async () => {
			library.setBooks([bookWith(hl('a', true, 2), hl('b', false, 1), hl('c', true, 3))]);
			let seen: Set<string> | undefined;
			vi.mocked(invoke).mockImplementation((cmd: string) => {
				if (cmd === 'mark_book_opened') seen = new Set(library.viewingNewIds);
				return Promise.resolve(null);
			});

			await library.openBook(1);

			expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 9, bookId: 1, seenSeq: 3 });
			expect(seen).toEqual(new Set(['a', 'c']));
			expect(library.viewingBookId).toBe(1);
		});

		it('uses seenSeq 0 when nothing carries a syncedSeq', async () => {
			// isNew implies a syncedSeq in what the backend returns; here the
			// book has only a non-new, first-sync highlight.
			library.setBooks([bookWith(hl('a', false, null))]);
			answer({ mark_book_opened: null });

			await library.openBook(1);

			expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 9, bookId: 1, seenSeq: 0 });
		});

		it('snapshot_survives_sync_reload', async () => {
			library.setBooks([bookWith(hl('a', true, 2))]);
			answer({ mark_book_opened: null });
			await library.openBook(1);

			answer({ get_library: [bookWith(hl('a', false, 2), hl('z', true, 5))] });
			await library.openReader(9);

			expect(library.viewingNewIds).toEqual(new Set(['a']));
		});

		it('mark_clears_only_snapshot_ids', async () => {
			library.setBooks([bookWith(hl('a', true, 2), hl('b', false, 1))]);
			let resolveMark!: () => void;
			vi.mocked(invoke).mockImplementation((cmd: string) => {
				if (cmd === 'mark_book_opened') return new Promise((r) => (resolveMark = () => r(null)));
				if (cmd === 'get_library')
					return Promise.resolve([bookWith(hl('a', true, 2), hl('b', false, 1), hl('z', true, 5))]);
				return Promise.reject(new Error(`unexpected ${cmd}`));
			});

			const opening = library.openBook(1);
			await library.openReader(9);
			resolveMark();
			await opening;

			expect(isNewOf('a')).toBe(false);
			expect(isNewOf('z')).toBe(true);
			expect(library.viewingNewIds).toEqual(new Set(['a']));
		});

		it('mark_failure_keeps_new', async () => {
			library.setBooks([bookWith(hl('a', true, 2))]);
			const log = vi.spyOn(console, 'error').mockImplementation(() => {});
			vi.mocked(invoke).mockRejectedValue(new Error('boom'));

			await expect(library.openBook(1)).resolves.toBeUndefined();

			expect(isNewOf('a')).toBe(true);
			expect(library.viewingNewIds).toEqual(new Set(['a']));
			expect(log).toHaveBeenCalled();
			log.mockRestore();
		});

		it('reopen_takes_fresh_snapshot', async () => {
			library.setBooks([bookWith(hl('a', true, 2))]);
			answer({ mark_book_opened: null });
			await library.openBook(1);
			expect(isNewOf('a')).toBe(false);

			library.setBooks([bookWith(hl('a', false, 2), hl('z', true, 5))]);
			await library.openBook(1);

			expect(library.viewingNewIds).toEqual(new Set(['z']));
			// (the summary is read again after the mark, so the mark is the last mark call, not the last call)
			expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'mark_book_opened').at(-1)).toEqual([
				'mark_book_opened',
				{ readerId: 9, bookId: 1, seenSeq: 5 }
			]);
		});

		describe('while a Sync runs (Task 38)', () => {
			/** The store keeps a Sync in flight: one a failed test left held would reach the next test. */
			let pending: (() => void) | null = null;
			let inFlight: Promise<unknown> | null = null;
			afterEach(async () => {
				pending?.();
				await inFlight?.catch(() => {});
				pending = inFlight = null;
			});

			/** The Kobo of `koboReader` (reader 9's unless said) syncs until `release`; the database is busy meanwhile, as with Rust's IMMEDIATE transaction. */
			function syncing(afterSync: Book[], koboReader = 9) {
				let busy = true;
				let release!: () => void;
				const held = new Promise((resolve) => (release = pending = () => ((busy = false), resolve({ added: 1 }))));
				vi.mocked(invoke).mockImplementation((cmd: string) => {
					if (cmd === 'sync_kobo') return held;
					if (cmd === 'mark_book_opened') return busy ? Promise.reject('database is locked') : Promise.resolve(null);
					if (cmd === 'get_library') return Promise.resolve(structuredClone(afterSync));
					return Promise.resolve(null);
				});
				library.setConnectedDevice(kobo);
				library.connectedReaderId = koboReader;
				const sync = library.sync();
				inFlight = sync;
				return { release, sync };
			}
			const marks = () => vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'mark_book_opened');

			it('book_opened_mid_sync_is_marked_after_it', async () => {
				library.setBooks([bookWith(hl('a', true, 2), hl('b', false, 1))]);
				// The Sync brings `z` to the open book: it stays new
				const { release, sync } = syncing([bookWith(hl('a', true, 2), hl('b', false, 1), hl('z', true, 5))]);

				const opening = library.openBook(1);
				await new Promise((r) => setTimeout(r, 0));
				// Not while the database is busy: the mark would fail and the book stay new
				expect(marks()).toHaveLength(0);
				release();
				await sync;
				await opening;

				expect(marks()).toEqual([['mark_book_opened', { readerId: 9, bookId: 1, seenSeq: 2 }]]);
				expect(isNewOf('a')).toBe(false);
				expect(isNewOf('z')).toBe(true);
				expect(library.viewingNewIds).toEqual(new Set(['a']));
			});

			it('book_closed_before_the_sync_ends_is_still_marked', async () => {
				const book2 = makeBook({ id: 2, title: 'C', author: 'A', highlights: [hl('x', true, 4)] });
				library.setBooks([bookWith(hl('a', true, 2)), book2]);
				const { release, sync } = syncing([bookWith(hl('a', true, 2)), book2]);

				const first = library.openBook(1);
				library.closeBook();
				const second = library.openBook(2);
				release();
				await sync;
				await Promise.all([first, second]);

				// Each mark is the book that was opened, with what was new then
				expect(marks()).toHaveLength(2);
				expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 9, bookId: 1, seenSeq: 2 });
				expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 9, bookId: 2, seenSeq: 4 });
				// ...and each one worked, after the Sync let go of the database
				expect(isNewOf('a')).toBe(false);
				expect(library.books.find((b) => b.id === 2)!.highlights[0].isNew).toBe(false);
				expect(library.viewingBookId).toBe(2);
				expect(library.viewingNewIds).toEqual(new Set(['x']));
			});

			it('deferred_mark_never_clears_another_readers_book', async () => {
				// Reader 9's Alpha is open; the Kobo connected is reader 5's, whose Library opens at the end
				library.setBooks([bookWith(hl('a', true, 2))]);
				const { release, sync } = syncing([bookWith(hl('a', true, 2))], 5);

				const opening = library.openBook(1);
				release();
				await sync.catch(() => {});
				await opening;

				// The mark is reader 9's; reader 5's book 1 on screen keeps its news
				expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 9, bookId: 1, seenSeq: 2 });
				expect(library.activeReaderId).toBe(5);
				expect(isNewOf('a')).toBe(true);
			});

			it('a_failed_sync_still_lets_the_mark_through', async () => {
				library.setBooks([bookWith(hl('a', true, 2))]);
				const log = vi.spyOn(console, 'error').mockImplementation(() => {});
				let busy = true;
				let fail!: () => void;
				const held = new Promise((_, reject) => (fail = pending = () => ((busy = false), reject('disk is full'))));
				vi.mocked(invoke).mockImplementation((cmd: string) => {
					if (cmd === 'sync_kobo') return held;
					if (cmd === 'mark_book_opened') return busy ? Promise.reject('database is locked') : Promise.resolve(null);
					return Promise.resolve(null);
				});
				library.setConnectedDevice(kobo);
				library.connectedReaderId = 9;
				const sync = library.sync().catch(() => {});
				inFlight = sync;

				const opening = library.openBook(1);
				fail();
				await sync;
				await opening;

				expect(marks()).toHaveLength(1);
				expect(isNewOf('a')).toBe(false);
				log.mockRestore();
			});
		});

		it('open_without_active_reader_skips_mark', async () => {
			library.activeReaderId = null;
			library.setBooks([bookWith(hl('a', true, 2))]);

			await library.openBook(1);

			expect(library.viewingNewIds).toEqual(new Set(['a']));
			expect(library.viewingBookId).toBe(1);
			expect(vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'mark_book_opened')).toHaveLength(0);
		});

		it('open_unknown_book_marks_with_zero', async () => {
			library.setBooks([bookWith(hl('a', true, 2))]);
			answer({ mark_book_opened: null });

			await library.openBook(99);

			expect(library.viewingNewIds.size).toBe(0);
			expect(invoke).toHaveBeenCalledWith('mark_book_opened', { readerId: 9, bookId: 99, seenSeq: 0 });
		});

		it('late_mark_response_keeps_current_snapshot', async () => {
			const book2 = (...highlights: ReturnType<typeof hl>[]) =>
				makeBook({ id: 2, title: 'C', author: 'A', highlights });
			library.setBooks([bookWith(hl('a', true, 2)), book2(hl('x', true, 4))]);
			const resolvers: Record<number, () => void> = {};
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
				if (cmd !== 'mark_book_opened') return Promise.reject(new Error(`unexpected ${cmd}`));
				const { bookId } = args as { bookId: number };
				return new Promise((r) => (resolvers[bookId] = () => r(null)));
			});

			const openingA = library.openBook(1);
			const openingB = library.openBook(2);
			resolvers[1]();
			await openingA;

			expect(library.viewingBookId).toBe(2);
			expect(library.viewingNewIds).toEqual(new Set(['x']));
			const hlOf = (bookId: number, id: string) =>
				library.books.find((b) => b.id === bookId)?.highlights.find((h) => h.id === id)?.isNew;
			expect(hlOf(1, 'a')).toBe(false);
			expect(hlOf(2, 'x')).toBe(true);

			resolvers[2]();
			await openingB;
			expect(hlOf(2, 'x')).toBe(false);
		});

		it('open_book_is_the_only_entry', () => {
			const dir = join(process.cwd(), 'src');
			const store = join('lib', 'stores', 'library.svelte.ts');
			const offenders = readdirSync(dir, { recursive: true, encoding: 'utf8' })
				.filter((f) => /\.(svelte|ts|js)$/.test(f) && !/\.(test|spec)\.(ts|js)$/.test(f))
				.filter((f) => f !== store)
				.filter((f) => {
					const source = readFileSync(join(dir, f), 'utf8');
					// Neither the old setter nor a direct write may bypass openBook.
					return (
						source.includes('setViewingBookId') ||
						/viewingBookId\s*=(?!=)/.test(source) ||
						/bind:[\w:]*(=\s*\{[^}]*)?viewingBookId/.test(source) ||
						/\[\s*['"]viewingBookId['"]\s*\]/.test(source)
					);
				});
			expect(offenders).toEqual([]);
			expect((library as unknown as Record<string, unknown>).setViewingBookId).toBeUndefined();
		});
	});
});
