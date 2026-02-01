import { invoke } from '@tauri-apps/api/core';
import type { Book, Highlight, KoboDevice, ImportProgress, ExportConfig } from '../types';

// UI State Machine
type UiState = 'no-device' | 'importing' | 'library' | 'book-details';

// State
let books = $state<Book[]>([]);
let selectedBookIds = $state<string[]>([]);
let isImporting = $state(false);
let importProgress = $state<ImportProgress | undefined>(undefined);
let connectedDevice = $state<KoboDevice | undefined>(undefined);
let isScanning = $state(false);

// UI State Machine State
let uiState = $state<UiState>('no-device');
let hasImportedInSession = $state(false);
let lastDeviceSerial = $state<string | null>(null);

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

export function getUiState(): UiState {
  return uiState;
}

export function getHasImportedInSession(): boolean {
  return hasImportedInSession;
}

export function getLastDeviceSerial(): string | null {
  return lastDeviceSerial;
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

// UI State Machine Actions
export function setUiState(state: UiState): void {
  uiState = state;
}

export function setConnectedDevice(device: KoboDevice | undefined): void {
  connectedDevice = device;
  if (device) {
    uiState = 'importing';
  } else {
    uiState = 'no-device';
  }
}

export function markImportComplete(deviceSerial: string): void {
  uiState = 'library';
  hasImportedInSession = true;
  lastDeviceSerial = deviceSerial;
}

export function shouldAutoImport(device: KoboDevice): boolean {
  // Auto-import if we haven't imported yet OR if it's a different device
  if (!hasImportedInSession) {
    return true;
  }
  if (device.serialNumber && device.serialNumber !== lastDeviceSerial) {
    return true;
  }
  return false;
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
  console.log('[EXPORT STORE] ==========================================');
  console.log('[EXPORT STORE] exportBooks() iniciado');
  console.log('[EXPORT STORE] Export path recebido:', exportPath);
  
  const selectedBooks = getSelectedBooks();
  console.log('[EXPORT STORE] Número de livros selecionados:', selectedBooks.length);
  
  if (selectedBooks.length === 0) {
    console.error('[EXPORT STORE] ❌ Nenhum livro selecionado - lançando erro');
    throw new Error('No books selected for export');
  }

  // Log detalhes de cada livro
  selectedBooks.forEach((book, i) => {
    console.log(`[EXPORT STORE] Livro ${i + 1}: "${book.title}" (${book.highlights.length} highlights)`);
    console.log(`[EXPORT STORE]   - contentId: ${book.contentId}`);
    console.log(`[EXPORT STORE]   - author: ${book.author}`);
  });

  // Default config with snake_case values for Rust compatibility
  const config: ExportConfig = {
    exportPath,
    metadata: {
      author: true,
      isbn: true,
      publisher: true,
      dateLastRead: true,
      language: true,
      description: true
    },
    dateFormat: 'dd_month_yyyy' // snake_case for Rust enum compatibility
  };
  
  console.log('[EXPORT STORE] Config a enviar para Rust:', JSON.stringify(config, null, 2));
  console.log('[EXPORT STORE] A chamar exportBooksWithConfig()...');

  return exportBooksWithConfig(config);
}

export async function exportBooksWithConfig(config: ExportConfig): Promise<string[]> {
  console.log('[EXPORT STORE] exportBooksWithConfig() iniciado');
  
  const selectedBooks = getSelectedBooks();
  console.log('[EXPORT STORE] Verificando livros selecionados:', selectedBooks.length);
  
  if (selectedBooks.length === 0) {
    console.error('[EXPORT STORE] ❌ Nenhum livro selecionado');
    throw new Error('No books selected for export');
  }

  try {
    console.log('[EXPORT STORE] A invocar Tauri command "export_books"...');
    console.log('[EXPORT STORE] Payload:', { 
      booksCount: selectedBooks.length, 
      config: config 
    });
    
    const exportedFiles = await invoke<string[]>('export_books', {
      books: selectedBooks,
      config
    });
    
    console.log('[EXPORT STORE] ✅ Resposta Tauri recebida:', exportedFiles);
    console.log('[EXPORT STORE] ==========================================');
    return exportedFiles;
  } catch (error) {
    console.error('[EXPORT STORE] ❌ Erro na invocação Tauri:', error);
    console.error('[EXPORT STORE] Tipo do erro:', typeof error);
    if (error instanceof Error) {
      console.error('[EXPORT STORE] Message:', error.message);
    }
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
