import { commands } from '../bindings';
import type { Book, KoboDevice, ImportProgress, Reader, UiState } from '../types';

class LibraryStore {
	books = $state<Book[]>([]);
	selectedBookIds = $state<number[]>([]);
	/** The Reader whose Library is on screen (R5). */
	activeReaderId = $state<number | null>(null);
	readers = $state<Reader[]>([]);
	isImporting = $state(false);
	importProgress = $state<ImportProgress | undefined>(undefined);
	connectedDevice = $state<KoboDevice | undefined>(undefined);
	isScanning = $state(false);
	uiState = $state<UiState>('no-device');
	hasImportedInSession = $state(false);
	lastDeviceSerial = $state<string | null>(null);
	viewingBookId = $state<number | null>(null);

	// Derived state
	selectedBooks = $derived(this.books.filter((book) => this.selectedBookIds.includes(book.id)));
	viewingBook = $derived(this.viewingBookId ? this.books.find((b) => b.id === this.viewingBookId) : undefined);

	// Actions
	setBooks(newBooks: Book[]) {
		this.books = newBooks;
	}

	setSelectedBookIds(ids: number[]) {
		this.selectedBookIds = ids;
	}

	updateBook(updatedBook: Book) {
		this.books = this.books.map((book) => (book.id === updatedBook.id ? updatedBook : book));
	}

	removeBook(bookId: number) {
		this.books = this.books.filter((book) => book.id !== bookId);
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

	/** The Library stays on screen without the Kobo (R17); only the
	 * connection indicator changes. */
	deviceDisconnected() {
		this.connectedDevice = undefined;
	}

	markImportComplete(deviceSerial: string) {
		this.uiState = 'library';
		this.hasImportedInSession = true;
		this.lastDeviceSerial = deviceSerial;
	}

	setViewingBookId(bookId: number | null) {
		this.viewingBookId = bookId;
	}

	shouldAutoImport(device: KoboDevice): boolean {
		if (!this.hasImportedInSession) return true;
		if (device.serialNumber && device.serialNumber !== this.lastDeviceSerial) return true;
		return false;
	}

	// Readers
	async loadReaders(): Promise<Reader[]> {
		this.readers = await commands.listReaders();
		return this.readers;
	}

	/** Shows the Reader's Library, read from Rust; no Kobo needed (R17). */
	async openReader(readerId: number): Promise<void> {
		const books = await commands.getLibrary(readerId);
		this.activeReaderId = readerId;
		this.books = books;
		this.selectedBookIds = [];
	}

	/** The connected Kobo's Reader if it is known, else the last one (R5). */
	async initialReader(connectedSerial?: string | null): Promise<number | null> {
		if (connectedSerial) {
			const owner = await commands.readerForKobo(connectedSerial);
			if (owner !== null) return owner;
		}
		return commands.lastReader();
	}

	// Tauri commands
	async scanForDevice(): Promise<KoboDevice | null> {
		this.isScanning = true;
		try {
			const device = await commands.scanForDevice();
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

	/**
	 * Syncs the connected Kobo into its Reader's Library and shows it.
	 * A Kobo with no Reader yet is left alone (association comes first, R7).
	 */
	async importHighlights(): Promise<Book[]> {
		if (!this.connectedDevice) throw new Error('No device connected');
		const device = this.connectedDevice;
		const readerId = device.serialNumber ? await commands.readerForKobo(device.serialNumber) : null;
		if (readerId === null) return this.books;

		this.isImporting = true;
		this.importProgress = {
			currentBook: 'Starting...',
			booksProcessed: 0,
			totalBooks: 0,
			highlightsFound: 0,
			percentage: 0
		};

		try {
			await commands.syncKobo(device);
			await this.openReader(readerId);
			return this.books;
		} catch (error) {
			console.error('Failed to sync the Kobo:', error);
			throw error;
		} finally {
			this.isImporting = false;
			this.importProgress = undefined;
		}
	}

	/** Exports the selected books of the active Reader with the Export
	 * settings, which Rust reads itself (R22). */
	async exportSelected(): Promise<string[]> {
		return this.exportIds(this.selectedBookIds);
	}

	async exportIds(bookIds: number[]): Promise<string[]> {
		if (bookIds.length === 0) throw new Error('No books selected for export');
		if (this.activeReaderId === null) throw new Error('No reader open');
		return commands.exportLibraryBooks(this.activeReaderId, bookIds);
	}
}

export const library = new LibraryStore();

export async function getDefaultExportPath(): Promise<string> {
	try {
		return await commands.getDefaultExportPath();
	} catch (error) {
		console.error('Failed to get default export path:', error);
		// Fallback to Documents folder
		return '~/Documents/Kobo Highlights';
	}
}

export async function validateExportPath(path: string): Promise<boolean> {
	try {
		return await commands.validateExportPath(path);
	} catch (error) {
		console.error('Failed to validate export path:', error);
		return false;
	}
}