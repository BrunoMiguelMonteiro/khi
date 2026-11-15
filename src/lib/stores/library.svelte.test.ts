import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	library,
	getDefaultExportPath,
	validateExportPath
} from './library.svelte';
import type { Book, KoboDevice } from '../types';
import { makeBook, makeDevice } from '../test-fixtures';

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

		it('an unknown kobo is reported and never synced', async () => {
			answer({ reader_for_kobo: null });

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
});
