import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

	describe('exportSelected', () => {
		it('should throw error if no books selected', async () => {
			library.activeReaderId = 1;
			library.setBooks(mockBooks);

			await expect(library.exportSelected()).rejects.toThrow('No books selected for export');
		});

		it('exports the selected ids of the active reader', async () => {
			library.activeReaderId = 9;
			library.setBooks(mockBooks);
			library.setSelectedBookIds([2]);
			answer({ export_library_books: ['/x/Book Two.md'] });

			const result = await library.exportSelected();

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
			library.setBooks([bookWith(hl('a', true, null))]);
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
			expect(invoke).toHaveBeenLastCalledWith('mark_book_opened', { readerId: 9, bookId: 1, seenSeq: 5 });
		});

		it('open_book_is_the_only_entry', () => {
			const dir = join(process.cwd(), 'src');
			const offenders = readdirSync(dir, { recursive: true, encoding: 'utf8' })
				.filter((f) => /\.(svelte|ts)$/.test(f) && !/\.(test|spec)\.ts$/.test(f))
				.filter((f) => !f.endsWith('library.svelte.ts'))
				.filter((f) => {
					const source = readFileSync(join(dir, f), 'utf8');
					// Neither the old setter nor a direct write may bypass openBook.
					return source.includes('setViewingBookId') || /viewingBookId\s*=(?!=)/.test(source);
				});
			expect(offenders).toEqual([]);
			expect((library as unknown as Record<string, unknown>).setViewingBookId).toBeUndefined();
		});
	});
});
