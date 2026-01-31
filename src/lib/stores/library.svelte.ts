import { invoke } from '@tauri-apps/api/core';
import type { Book, Highlight, KoboDevice, ImportProgress } from '../types';

// State
let books = $state<Book[]>([]);
let selectedBookIds = $state<string[]>([]);
let isImporting = $state(false);
let importProgress = $state<ImportProgress | undefined>(undefined);
let connectedDevice = $state<KoboDevice | undefined>(undefined);
let isScanning = $state(false);

// Getters
export function getBooks(): Book[] {
  return books;
}

export function getSelectedBookIds(): string[] {
  return selectedBookIds;
}

export function getIsImporting(): boolean {
  return isImporting;
}

export function getImportProgress(): ImportProgress | undefined {
  return importProgress;
}

export function getConnectedDevice(): KoboDevice | undefined {
  return connectedDevice;
}

export function getIsScanning(): boolean {
  return isScanning;
}

export function getSelectedBooks(): Book[] {
  return books.filter(book => selectedBookIds.includes(book.contentId));
}

// Actions
export function setBooks(newBooks: Book[]): void {
  books = newBooks;
}

export function setSelectedBookIds(ids: string[]): void {
  selectedBookIds = ids;
}

export function addBooks(newBooks: Book[]): void {
  // Merge with existing books, avoiding duplicates
  const existingIds = new Set(books.map(b => b.contentId));
  const uniqueNewBooks = newBooks.filter(b => !existingIds.has(b.contentId));
  books = [...books, ...uniqueNewBooks];
}

export function updateBook(updatedBook: Book): void {
  books = books.map(book => 
    book.contentId === updatedBook.contentId ? updatedBook : book
  );
}

export function removeBook(bookId: string): void {
  books = books.filter(book => book.contentId !== bookId);
  selectedBookIds = selectedBookIds.filter(id => id !== bookId);
}

export function clearBooks(): void {
  books = [];
  selectedBookIds = [];
}

// Tauri command wrappers
export async function scanForDevice(): Promise<KoboDevice | null> {
  isScanning = true;
  try {
    const device = await invoke<KoboDevice | null>('scan_for_device');
    connectedDevice = device || undefined;
    return device;
  } catch (error) {
    console.error('Failed to scan for device:', error);
    connectedDevice = undefined;
    return null;
  } finally {
    isScanning = false;
  }
}

export async function importHighlights(): Promise<Book[]> {
  if (!connectedDevice) {
    throw new Error('No device connected');
  }

  isImporting = true;
  importProgress = {
    currentBook: 'Starting...',
    booksProcessed: 0,
    totalBooks: 0,
    highlightsFound: 0,
    percentage: 0
  };

  try {
    console.log('Starting import from device:', connectedDevice);
    const importedBooks = await invoke<Book[]>('import_highlights', { 
      device: connectedDevice 
    });
    
    console.log(`Imported ${importedBooks.length} books`);
    
    // Merge with existing books
    addBooks(importedBooks);
    
    return importedBooks;
  } catch (error) {
    console.error('Failed to import highlights:', error);
    throw error;
  } finally {
    isImporting = false;
    importProgress = undefined;
  }
}

export async function exportBooks(exportPath: string): Promise<string[]> {
  const selectedBooks = getSelectedBooks();
  
  if (selectedBooks.length === 0) {
    throw new Error('No books selected for export');
  }

  try {
    const exportedFiles = await invoke<string[]>('export_books', {
      books: selectedBooks,
      config: {
        exportPath,
        metadata: {
          author: true,
          isbn: true,
          publisher: true,
          dateLastRead: true,
          language: true,
          description: true
        },
        dateFormat: 'DD Mês YYYY'
      }
    });
    
    return exportedFiles;
  } catch (error) {
    console.error('Failed to export books:', error);
    throw error;
  }
}

export async function getDefaultExportPath(): Promise<string> {
  try {
    return await invoke<string>('get_default_export_path');
  } catch (error) {
    console.error('Failed to get default export path:', error);
    // Fallback to Documents folder
    return '~/Documents/Kobo Highlights';
  }
}

export async function validateExportPath(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>('validate_export_path', { path });
  } catch (error) {
    console.error('Failed to validate export path:', error);
    return false;
  }
}

// Progress simulation for UI feedback
export function simulateImportProgress(totalBooks: number): void {
  let processed = 0;
  const interval = setInterval(() => {
    processed += 1;
    if (processed > totalBooks) {
      clearInterval(interval);
      return;
    }
    
    importProgress = {
      currentBook: `Processing book ${processed} of ${totalBooks}...`,
      booksProcessed: processed,
      totalBooks,
      highlightsFound: processed * 5, // Simulated
      percentage: Math.round((processed / totalBooks) * 100)
    };
  }, 100);
}

// Highlight editing actions
export function updateHighlight(bookId: string, highlightId: string, updates: Partial<Highlight>): void {
  books = books.map(book => {
    if (book.contentId !== bookId) return book;
    
    return {
      ...book,
      highlights: book.highlights.map(highlight =>
        highlight.id === highlightId ? { ...highlight, ...updates } : highlight
      )
    };
  });
}

export function toggleHighlightExclude(bookId: string, highlightId: string, excluded: boolean): void {
  updateHighlight(bookId, highlightId, { isExcluded: excluded });
}

export function editHighlightText(bookId: string, highlightId: string, editedText: string): void {
  updateHighlight(bookId, highlightId, { editedText });
}

export function addHighlightNote(bookId: string, highlightId: string, note: string): void {
  updateHighlight(bookId, highlightId, { personalNote: note });
}

// Get a single book by ID
export function getBookById(bookId: string): Book | undefined {
  return books.find(book => book.contentId === bookId);
}

// View state for book details
let viewingBookId = $state<string | null>(null);

export function getViewingBookId(): string | null {
  return viewingBookId;
}

export function setViewingBookId(bookId: string | null): void {
  viewingBookId = bookId;
}

export function getViewingBook(): Book | undefined {
  return viewingBookId ? getBookById(viewingBookId) : undefined;
}
