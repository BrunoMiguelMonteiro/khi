import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBooks,
  getSelectedBookIds,
  getIsImporting,
  getImportProgress,
  getConnectedDevice,
  getIsScanning,
  getSelectedBooks,
  setBooks,
  setSelectedBookIds,
  addBooks,
  updateBook,
  removeBook,
  clearBooks,
  scanForDevice,
  importHighlights,
  exportBooks,
  getDefaultExportPath,
  validateExportPath
} from './library.svelte';
import type { Book, KoboDevice } from '../types';

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
    isSelected: false,
  },
  {
    contentId: 'book-2',
    title: 'Book Two',
    author: 'Author Two',
    highlights: [],
    isSelected: false,
  },
];

describe('Library Store', () => {
  beforeEach(() => {
    clearBooks();
    vi.clearAllMocks();
  });

  describe('State getters/setters', () => {
    it('should set and get books', () => {
      setBooks(mockBooks);
      expect(getBooks()).toEqual(mockBooks);
    });

    it('should set and get selected book IDs', () => {
      setSelectedBookIds(['book-1', 'book-2']);
      expect(getSelectedBookIds()).toEqual(['book-1', 'book-2']);
    });

    it('should get selected books', () => {
      setBooks(mockBooks);
      setSelectedBookIds(['book-1']);
      expect(getSelectedBooks()).toEqual([mockBooks[0]]);
    });

    it('should add books without duplicates', () => {
      setBooks([mockBooks[0]]);
      addBooks([mockBooks[0], mockBooks[1]]); // book-1 is duplicate
      expect(getBooks()).toEqual(mockBooks);
    });

    it('should update a book', () => {
      setBooks(mockBooks);
      const updatedBook = { ...mockBooks[0], title: 'Updated Title' };
      updateBook(updatedBook);
      expect(getBooks()[0].title).toBe('Updated Title');
    });

    it('should remove a book and its selection', () => {
      setBooks(mockBooks);
      setSelectedBookIds(['book-1', 'book-2']);
      removeBook('book-1');
      expect(getBooks()).toEqual([mockBooks[1]]);
      expect(getSelectedBookIds()).toEqual(['book-2']);
    });

    it('should clear all books and selections', () => {
      setBooks(mockBooks);
      setSelectedBookIds(['book-1']);
      clearBooks();
      expect(getBooks()).toEqual([]);
      expect(getSelectedBookIds()).toEqual([]);
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

        const result = await scanForDevice();

        expect(invoke).toHaveBeenCalledWith('scan_for_device');
        expect(result).toEqual(mockDevice);
        expect(getConnectedDevice()).toEqual(mockDevice);
        expect(getIsScanning()).toBe(false);
      });

      it('should handle null device response', async () => {
        vi.mocked(invoke).mockResolvedValueOnce(null);

        const result = await scanForDevice();

        expect(result).toBeNull();
        expect(getConnectedDevice()).toBeUndefined();
      });

      it('should handle scan errors', async () => {
        vi.mocked(invoke).mockRejectedValueOnce(new Error('Scan failed'));

        const result = await scanForDevice();

        expect(result).toBeNull();
        expect(getConnectedDevice()).toBeUndefined();
      });
    });

    describe('importHighlights', () => {
      it('should throw error if no device connected', async () => {
        await expect(importHighlights()).rejects.toThrow('No device connected');
      });

      it('should import highlights and add books', async () => {
        const mockDevice: KoboDevice = {
          name: 'Kobo Clara',
          path: '/Volumes/KOBOeReader',
          isValid: true
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockDevice);
        await scanForDevice();

        const importedBooks: Book[] = [
          { contentId: 'new-1', title: 'New Book', author: 'Author', highlights: [], isSelected: false }
        ];
        vi.mocked(invoke).mockResolvedValueOnce(importedBooks);

        const result = await importHighlights();

        expect(invoke).toHaveBeenCalledWith('import_highlights', { device: mockDevice });
        expect(result).toEqual(importedBooks);
        expect(getBooks()).toEqual(importedBooks);
      });

      it('should set importing state during import', async () => {
        const mockDevice: KoboDevice = {
          name: 'Kobo Clara',
          path: '/Volumes/KOBOeReader',
          isValid: true
        };
        vi.mocked(invoke).mockResolvedValueOnce(mockDevice);
        await scanForDevice();

        vi.mocked(invoke).mockImplementationOnce(() => 
          new Promise(resolve => setTimeout(() => resolve([]), 10))
        );

        const importPromise = importHighlights();
        expect(getIsImporting()).toBe(true);
        expect(getImportProgress()).toBeDefined();

        await importPromise;
        expect(getIsImporting()).toBe(false);
        expect(getImportProgress()).toBeUndefined();
      });
    });

    describe('exportBooks', () => {
      it('should throw error if no books selected', async () => {
        setBooks(mockBooks);
        setSelectedBookIds([]);

        await expect(exportBooks('/path/to/export')).rejects.toThrow('No books selected for export');
      });

      it('should export selected books', async () => {
        setBooks(mockBooks);
        setSelectedBookIds(['book-1']);

        const exportedFiles = ['/path/to/export/Book One - Author One.md'];
        vi.mocked(invoke).mockResolvedValueOnce(exportedFiles);

        const result = await exportBooks('/path/to/export');

        expect(invoke).toHaveBeenCalledWith('export_books', {
          books: [mockBooks[0]],
          config: expect.objectContaining({
            exportPath: '/path/to/export',
            metadata: expect.any(Object)
          })
        });
        expect(result).toEqual(exportedFiles);
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
