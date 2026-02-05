import { invoke } from '@tauri-apps/api/core';
import type { Book, KoboDevice, ImportProgress, ExportConfig, UiState } from '../types';

class LibraryStore {
	books = $state<Book[]>([]);
	selectedBookIds = $state<string[]>([]);
	isImporting = $state(false);
	importProgress = $state<ImportProgress | undefined>(undefined);
	connectedDevice = $state<KoboDevice | undefined>(undefined);
	isScanning = $state(false);
	uiState = $state<UiState>('no-device');
	hasImportedInSession = $state(false);
	lastDeviceSerial = $state<string | null>(null);
	viewingBookId = $state<string | null>(null);

	// Derived state
	selectedBooks = $derived(this.books.filter((book) => this.selectedBookIds.includes(book.contentId)));
	viewingBook = $derived(this.viewingBookId ? this.books.find((b) => b.contentId === this.viewingBookId) : undefined);

	// Actions
	setBooks(newBooks: Book[]) {
		this.books = newBooks;
	}

	setSelectedBookIds(ids: string[]) {
		this.selectedBookIds = ids;
	}

	addBooks(newBooks: Book[]) {
		const existingIds = new Set(this.books.map((b) => b.contentId));
		const uniqueNewBooks = newBooks.filter((b) => !existingIds.has(b.contentId));
		this.books = [...this.books, ...uniqueNewBooks];
	}

	updateBook(updatedBook: Book) {
		this.books = this.books.map((book) => (book.contentId === updatedBook.contentId ? updatedBook : book));
	}

	removeBook(bookId: string) {
		this.books = this.books.filter((book) => book.contentId !== bookId);
		this.selectedBookIds = this.selectedBookIds.filter((id) => id !== bookId);
	}

	clearBooks() {
		this.books = [];
		this.selectedBookIds = [];
	}

	setUiState(state: UiState) {
		this.uiState = state;
	}

	setConnectedDevice(device: KoboDevice | undefined) {
		this.connectedDevice = device;
	}

	markImportComplete(deviceSerial: string) {
		this.uiState = 'library';
		this.hasImportedInSession = true;
		this.lastDeviceSerial = deviceSerial;
	}

	setViewingBookId(bookId: string | null) {
		this.viewingBookId = bookId;
	}

	shouldAutoImport(device: KoboDevice): boolean {
		if (!this.hasImportedInSession) return true;
		if (device.serialNumber && device.serialNumber !== this.lastDeviceSerial) return true;
		return false;
	}

	// Tauri commands
	async scanForDevice(): Promise<KoboDevice | null> {
		this.isScanning = true;
		try {
			const device = await invoke<KoboDevice | null>('scan_for_device');
			this.setConnectedDevice(device || undefined);
			return device;
		} catch (error) {
			console.error('Failed to scan for device:', error);
			this.setConnectedDevice(undefined);
			return null;
		} finally {
			this.isScanning = false;
		}
	}

	async importHighlights(): Promise<Book[]> {
		if (!this.connectedDevice) throw new Error('No device connected');

		this.isImporting = true;
		this.importProgress = {
			currentBook: 'Starting...',
			booksProcessed: 0,
			totalBooks: 0,
			highlightsFound: 0,
			percentage: 0
		};

		try {
			const importedBooks = await invoke<Book[]>('import_highlights', {
				device: this.connectedDevice
			});
			this.addBooks(importedBooks);
			return importedBooks;
		} catch (error) {
			console.error('Failed to import highlights:', error);
			throw error;
		} finally {
			this.isImporting = false;
			this.importProgress = undefined;
		}
	}

	async exportBooks(exportPath: string): Promise<string[]> {
		if (this.selectedBooks.length === 0) throw new Error('No books selected for export');

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
			dateFormat: 'dd_month_yyyy'
		};

		return this.exportBooksWithConfig(config);
	}

	async exportBooksWithConfig(config: ExportConfig): Promise<string[]> {
		if (this.selectedBooks.length === 0) throw new Error('No books selected for export');

		try {
			const exportedFiles = await invoke<string[]>('export_books', {
				books: this.selectedBooks,
				config
			});
			return exportedFiles;
		} catch (error) {
			console.error('Failed to export books:', error);
			throw error;
		}
	}
}

export const library = new LibraryStore();

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