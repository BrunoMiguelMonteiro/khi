import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
	library,
	getDefaultExportPath,
	validateExportPath
} from './library.svelte';
import type { Book, KoboDevice, ExportConfig } from '../types';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';

const mockBooks: Book[] = [
	{
		contentId: 'book-1',
		title: 'Book One',
		author: 'Author One',
		highlights: [],
		isSelected: false
	},
	{
		contentId: 'book-2',
		title: 'Book Two',
		author: 'Author Two',
		highlights: [],
		isSelected: false
	}
];

describe('Library Store', () => {
	beforeEach(() => {
		library.clearBooks();
		vi.clearAllMocks();
	});

	describe('State getters/setters', () => {
		it('should set and get books', () => {
			library.setBooks(mockBooks);
			expect(library.books).toEqual(mockBooks);
		});

		it('should set and get selected book IDs', () => {
			library.setSelectedBookIds(['book-1', 'book-2']);
			expect(library.selectedBookIds).toEqual(['book-1', 'book-2']);
		});

		it('should get selected books', () => {
			library.setBooks(mockBooks);
			library.setSelectedBookIds(['book-1']);
			expect(library.selectedBooks).toEqual([mockBooks[0]]);
		});

		it('should add books without duplicates', () => {
			library.setBooks([mockBooks[0]]);
			library.addBooks([mockBooks[0], mockBooks[1]]); // book-1 is duplicate
			expect(library.books).toEqual(mockBooks);
		});

		it('should update a book', () => {
			library.setBooks(mockBooks);
			const updatedBook = { ...mockBooks[0], title: 'Updated Title' };
			library.updateBook(updatedBook);
			expect(library.books[0].title).toBe('Updated Title');
		});

		it('should remove a book and its selection', () => {
			library.setBooks(mockBooks);
			library.setSelectedBookIds(['book-1', 'book-2']);
			library.removeBook('book-1');
			expect(library.books).toEqual([mockBooks[1]]);
			expect(library.selectedBookIds).toEqual(['book-2']);
		});

		it('should clear all books and selections', () => {
			library.setBooks(mockBooks);
			library.setSelectedBookIds(['book-1']);
			library.clearBooks();
			expect(library.books).toEqual([]);
			expect(library.selectedBookIds).toEqual([]);
		});
	});

	describe('Tauri command wrappers', () => {
		describe('scanForDevice', () => {
			it('should scan for device and update connectedDevice', async () => {
				const mockDevice: KoboDevice = {
					name: 'Kobo Clara',
					path: '/Volumes/KOBOeReader',
					isValid: true,
					serialNumber: '12345'
				};
				vi.mocked(invoke).mockResolvedValueOnce(mockDevice);

				const result = await library.scanForDevice();

				expect(invoke).toHaveBeenCalledWith('scan_for_device');
				expect(result).toEqual(mockDevice);
				expect(library.connectedDevice).toEqual(mockDevice);
				expect(library.isScanning).toBe(false);
			});

			it('should handle null device response', async () => {
				vi.mocked(invoke).mockResolvedValueOnce(null);

				const result = await library.scanForDevice();

				expect(result).toBeNull();
				expect(library.connectedDevice).toBeUndefined();
			});

			it('should handle scan errors', async () => {
				vi.mocked(invoke).mockRejectedValueOnce(new Error('Scan failed'));

				const result = await library.scanForDevice();

				expect(result).toBeNull();
				expect(library.connectedDevice).toBeUndefined();
			});
		});

		describe('importHighlights', () => {
			it('should throw error if no device connected', async () => {
				await expect(library.importHighlights()).rejects.toThrow('No device connected');
			});

			it('should import highlights and add books', async () => {
				const mockDevice: KoboDevice = {
					name: 'Kobo Clara',
					path: '/Volumes/KOBOeReader',
					isValid: true
				};
				vi.mocked(invoke).mockResolvedValueOnce(mockDevice);
				await library.scanForDevice();

				const importedBooks: Book[] = [
					{
						contentId: 'new-1',
						title: 'New Book',
						author: 'Author',
						highlights: [],
						isSelected: false
					}
				];
				vi.mocked(invoke).mockResolvedValueOnce(importedBooks);

				const result = await library.importHighlights();

				expect(invoke).toHaveBeenCalledWith('import_highlights', { device: mockDevice });
				expect(result).toEqual(importedBooks);
				expect(library.books).toEqual(importedBooks);
			});

			it('should set importing state during import', async () => {
				const mockDevice: KoboDevice = {
					name: 'Kobo Clara',
					path: '/Volumes/KOBOeReader',
					isValid: true
				};
				vi.mocked(invoke).mockResolvedValueOnce(mockDevice);
				await library.scanForDevice();

				vi.mocked(invoke).mockImplementationOnce(
					() => new Promise((resolve) => setTimeout(() => resolve([]), 10))
				);

				const importPromise = library.importHighlights();
				expect(library.isImporting).toBe(true);
				expect(library.importProgress).toBeDefined();

				await importPromise;
				expect(library.isImporting).toBe(false);
				expect(library.importProgress).toBeUndefined();
			});
		});

		describe('exportBooks', () => {
			it('should throw error if no books selected', async () => {
				library.setBooks(mockBooks);
				library.setSelectedBookIds([]);

				await expect(library.exportBooks('/path/to/export')).rejects.toThrow(
					'No books selected for export'
				);
			});

			it('should export selected books', async () => {
				library.setBooks(mockBooks);
				library.setSelectedBookIds(['book-1']);

				const exportedFiles = ['/path/to/export/Book One - Author One.md'];
				vi.mocked(invoke).mockResolvedValueOnce(exportedFiles);

				const result = await library.exportBooks('/path/to/export');

				expect(invoke).toHaveBeenCalledWith('export_books', {
					books: [mockBooks[0]],
					config: expect.objectContaining({
						exportPath: '/path/to/export',
						metadata: expect.any(Object)
					})
				});
				expect(result).toEqual(exportedFiles);
			});

			it('should use snake_case dateFormat for Rust compatibility', async () => {
				library.setBooks(mockBooks);
				library.setSelectedBookIds(['book-1']);
				vi.mocked(invoke).mockResolvedValueOnce(['/path/to/file.md']);

				await library.exportBooks('/path/to/export');

				const callArgs = vi.mocked(invoke).mock.calls[0];
				const config = (callArgs[1] as { config: ExportConfig }).config;

				// DateFormat must be snake_case for Rust enum compatibility
				expect(config.dateFormat).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
				expect(['dd_mm_yyyy', 'dd_month_yyyy', 'iso8601']).toContain(config.dateFormat);
			});
		});

		describe('exportBooksWithConfig', () => {
			it('should use provided config instead of hardcoded values', async () => {
				library.setBooks(mockBooks);
				library.setSelectedBookIds(['book-1']);
				vi.mocked(invoke).mockResolvedValueOnce(['/path/to/file.md']);

				const customConfig: ExportConfig = {
					exportPath: '/custom/path',
					metadata: {
						author: false,
						isbn: true,
						publisher: false,
						dateLastRead: true,
						language: false,
						description: true
					},
					dateFormat: 'iso8601'
				};

				await library.exportBooksWithConfig(customConfig);

				expect(invoke).toHaveBeenCalledWith('export_books', {
					books: [mockBooks[0]],
					config: customConfig
				});
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

				const result = await getDefaultExportPath();

				expect(result).toBe('~/Documents/Kobo Highlights');
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

				const result = await validateExportPath('/invalid/path');

				expect(result).toBe(false);
			});

			it('should return false on error', async () => {
				vi.mocked(invoke).mockRejectedValueOnce(new Error('Validation failed'));

				const result = await validateExportPath('/path');

				expect(result).toBe(false);
			});
		});
	});
});