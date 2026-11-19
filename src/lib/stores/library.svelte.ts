import { commands } from '../bindings';
import type { Book, KoboDevice, Reader, SyncReport, UiState } from '../types';

export type ConnectOutcome = 'unknown' | 'idle' | 'synced';

class LibraryStore {
	books = $state<Book[]>([]);
	selectedBookIds = $state<number[]>([]);
	/** The Reader whose Library is on screen (R5). */
	activeReaderId = $state<number | null>(null);
	readers = $state<Reader[]>([]);
	/** A Sync is running. */
	isImporting = $state(false);
	isExporting = $state(false);
	/** Books processed so far in the running Sync (R16). */
	syncProgress = $state<{ done: number; total: number } | null>(null);
	connectedDevice = $state<KoboDevice | undefined>(undefined);
	isScanning = $state(false);
	uiState = $state<UiState>('no-device');
	/** The Reader that owns the connected Kobo, when it is known. */
	connectedReaderId = $state<number | null>(null);
	#viewingBookId = $state<number | null>(null);
	#viewingNewIds = $state<ReadonlySet<string>>(new Set());

	// Derived state
	selectedBooks = $derived(this.books.filter((book) => this.selectedBookIds.includes(book.id)));
	/** «Sincronizar» works only with the active Reader's Kobo connected. */
	canSync = $derived(
		this.connectedDevice !== undefined &&
			this.connectedReaderId !== null &&
			this.connectedReaderId === this.activeReaderId &&
			!this.isImporting
	);
	viewingBook = $derived(this.#viewingBookId ? this.books.find((b) => b.id === this.#viewingBookId) : undefined);

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
		this.connectedReaderId = null;
	}

	/** The open book; set only by `openBook` and `closeBook`. */
	get viewingBookId(): number | null {
		return this.#viewingBookId;
	}

	/** The ids of the open book's highlights that were new when it was opened.
	 * Changes only in `openBook`, so a reload mid-reading leaves it alone (D1). */
	get viewingNewIds(): ReadonlySet<string> {
		return this.#viewingNewIds;
	}

	/** The only way to open a book. The snapshot of its new highlights is
	 * taken before the book is marked as seen, and only those ids are cleared
	 * afterwards: a reload while the mark is in flight may bring others, which
	 * stay new. A failed mark is logged and leaves everything as it was. */
	async openBook(bookId: number): Promise<void> {
		const highlights = this.books.find((b) => b.id === bookId)?.highlights ?? [];
		const snapshot = new Set(highlights.filter((h) => h.isNew).map((h) => h.id));
		const seenSeq = Math.max(0, ...highlights.map((h) => h.syncedSeq ?? 0));
		this.#viewingNewIds = snapshot;
		this.#viewingBookId = bookId;
		if (this.activeReaderId === null) return;

		try {
			await commands.markBookOpened(this.activeReaderId, bookId, seenSeq);
		} catch (error) {
			console.error('Failed to mark the book as opened:', error);
			return;
		}
		// Read this.books now: openReader may have replaced it while waiting.
		this.books = this.books.map((book) =>
			book.id === bookId
				? {
						...book,
						highlights: book.highlights.map((h) =>
							snapshot.has(h.id) ? { ...h, isNew: false } : h
						)
					}
				: book
		);
	}

	closeBook() {
		this.#viewingBookId = null;
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

	async readerForKobo(serial: string): Promise<number | null> {
		return commands.readerForKobo(serial);
	}

	/** Remembers whose Kobo this is (R1). */
	async associateKobo(serial: string, readerId: number): Promise<void> {
		await commands.associateKobo(serial, readerId);
	}

	async createReader(name: string): Promise<Reader> {
		const reader = await commands.createReader(name);
		await this.loadReaders();
		return reader;
	}

	/** Readers are renamed, never deleted (R3). */
	async renameReader(readerId: number, name: string): Promise<void> {
		await commands.renameReader(readerId, name);
		await this.loadReaders();
	}

	/** Where this Reader's books are exported; null means the default (R21). */
	async setReaderExportPath(readerId: number, path: string | null): Promise<void> {
		await commands.setReaderExportPath(readerId, path);
		await this.loadReaders();
	}

	/** Deletes a book whose highlights were all removed from the Kobo (R19). */
	async deleteBook(bookId: number): Promise<void> {
		if (this.activeReaderId === null) throw new Error('No reader open');
		await commands.deleteBook(this.activeReaderId, bookId);
		this.removeBook(bookId);
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
	 * A Kobo was connected. A Kobo with no Reader is reported, never synced
	 * (R7). A known one syncs when «Sincronizar ao ligar» is on (R6), every
	 * time it is connected, not once per session.
	 */
	async deviceConnected(device: KoboDevice, syncOnConnect: boolean): Promise<ConnectOutcome> {
		// Already handled since it was plugged in: at startup the scan and the
		// monitor's first device-detected (2 s later) report the same Kobo.
		// Keyed on connectedReaderId, which only a handled connect sets and
		// deviceDisconnected clears; the scan sets connectedDevice alone.
		const handled =
			this.connectedReaderId !== null &&
			device.serialNumber !== null &&
			this.connectedDevice?.serialNumber === device.serialNumber;
		if (handled) {
			if (!this.running) return 'idle';
			await this.running;
			return 'synced';
		}

		this.connectedDevice = device;
		this.connectedReaderId = device.serialNumber
			? await commands.readerForKobo(device.serialNumber)
			: null;
		if (this.connectedReaderId === null && device.serialNumber) {
			// With no Reader yet there is only one answer, so don't ask (R1)
			if ((await this.loadReaders()).length > 0) return 'unknown';
			const reader = await this.createReader(device.name);
			await this.associateKobo(device.serialNumber, reader.id);
			this.connectedReaderId = reader.id;
		}
		if (this.connectedReaderId === null) return 'unknown';

		if (syncOnConnect) {
			await this.sync();
			return 'synced';
		}
		if (this.activeReaderId === null) await this.openReader(this.connectedReaderId);
		return 'idle';
	}

	/** The Sync in flight, shared by every caller until it ends. */
	private running: Promise<SyncReport> | null = null;

	/** Syncs the connected Kobo into its Reader's Library and shows it (R16).
	 * A call while a Sync runs gets that Sync: at startup the scan and the
	 * monitor's first device-detected both arrive for the same Kobo. */
	sync(): Promise<SyncReport> {
		if (this.running) return this.running;
		const device = this.connectedDevice;
		const readerId = this.connectedReaderId;
		if (!device || readerId === null) return Promise.reject(new Error('No known Kobo connected'));

		this.running = this.runSync(device, readerId).finally(() => {
			this.running = null;
		});
		return this.running;
	}

	private async runSync(device: KoboDevice, readerId: number): Promise<SyncReport> {
		this.isImporting = true;
		this.syncProgress = { done: 0, total: 0 };
		try {
			const report = await commands.syncKobo(device);
			await this.openReader(readerId);
			return report;
		} catch (error) {
			console.error('Failed to sync the Kobo:', error);
			throw error;
		} finally {
			this.isImporting = false;
			this.syncProgress = null;
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
		this.isExporting = true;
		try {
			return await commands.exportLibraryBooks(this.activeReaderId, bookIds);
		} finally {
			this.isExporting = false;
		}
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