import { commands, type LibrarySummary_Serialize } from '../bindings';
import type { Book, KoboDevice, Reader, SyncReport, UiState } from '../types';

export type ConnectOutcome = 'unknown' | 'idle' | 'synced';

/** The book's new highlights that are still on the Kobo (D1). */
export function newHighlightCount(book: Book): number {
	return book.highlights.filter((h) => h.isNew && !h.removedAt).length;
}

class LibraryStore {
	books = $state<Book[]>([]);
	selectedBookIds = $state<number[]>([]);
	/** The Reader whose Library is on screen (R5). */
	activeReaderId = $state<number | null>(null);
	readers = $state<Reader[]>([]);
	/** A Sync is running. */
	isImporting = $state(false);
	/** The last Sync failed: the Library header's `erro`. Cleared when a Sync starts, set before
	 * `isImporting` turns false, so the header never shows a stale state in between (Task 38). */
	lastSyncFailed = $state(false);
	isExporting = $state(false);
	/** The files of the last export that worked in this session (not kept across launches): «Mostrar no Finder» and the File menu. */
	lastExport = $state<string[]>([]);
	/** Books processed so far in the running Sync (R16). */
	syncProgress = $state<{ done: number; total: number } | null>(null);
	connectedDevice = $state<KoboDevice | undefined>(undefined);
	isScanning = $state(false);
	uiState = $state<UiState>('no-device');
	/** The Reader that owns the connected Kobo, when it is known. */
	connectedReaderId = $state<number | null>(null);
	/** New highlights since when, and the connected Kobo's last sync: what the
	 * Library header says. Null until read, and when it cannot be. */
	summary = $state<LibrarySummary_Serialize | null>(null);
	#summaryRequest = 0;
	/** The serial of the connected Kobo whose owner the user declined to say (Task 44): not asked about again
	 * until it is unplugged. A serial, not a flag, so another Kobo is asked about. */
	#declinedSerial = $state<string | null>(null);
	#viewingBookId = $state<number | null>(null);
	#viewingNewIds = $state<ReadonlySet<string>>(new Set());

	// Derived state
	selectedBooks = $derived(this.books.filter((book) => this.selectedBookIds.includes(book.id)));
	/** The connected Kobo has no Reader and the user said not now: Sync asks again instead of syncing. */
	declinedKobo = $derived(
		this.connectedDevice !== undefined &&
			this.connectedReaderId === null &&
			this.#declinedSerial !== null &&
			this.connectedDevice.serialNumber === this.#declinedSerial
	);
	/** «Sincronizar» works with the active Reader's Kobo connected, or with a Kobo that is still to be asked about. */
	canSync = $derived(
		this.connectedDevice !== undefined &&
			!this.isImporting &&
			((this.connectedReaderId !== null && this.connectedReaderId === this.activeReaderId) || this.declinedKobo)
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
		this.#declinedSerial = null;
		// The sync time is only shown with the Kobo connected: drop it before the reload answers
		if (this.summary) this.summary = { ...this.summary, lastSyncAt: null };
		void this.loadSummary();
	}

	/** «Cancelar» in «De quem é este Kobo?»: this connection of the Kobo is not asked about again (Q2). */
	declineKobo(serial: string) {
		this.#declinedSerial = serial;
	}

	/** The question is open again (Sync, or the Kobo reconnected): the refusal no longer holds. */
	forgetDeclinedKobo() {
		this.#declinedSerial = null;
	}

	/** The Reader of the last session, for the pop-up's first choice (Q3); null when there is none or it cannot be read. */
	async lastReaderId(): Promise<number | null> {
		try {
			return await commands.lastReader();
		} catch (error) {
			console.error('Failed to read the last reader:', error);
			return null;
		}
	}

	/** Reads the header's summary for the active Reader and the connected Kobo.
	 * It never throws: without a summary the header just has no dates. */
	async loadSummary(): Promise<void> {
		const readerId = this.activeReaderId;
		const request = ++this.#summaryRequest;
		if (readerId === null) {
			this.summary = null;
			return;
		}
		try {
			const summary = await commands.librarySummary(readerId, this.connectedDevice?.serialNumber ?? null);
			// A later call (another Reader, or the Kobo coming or going) wins
			if (request === this.#summaryRequest) this.summary = summary ?? null;
		} catch (error) {
			console.error('Failed to read the library summary:', error);
			if (request === this.#summaryRequest) this.summary = null;
		}
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
	 * stay new. A failed mark is logged and leaves everything as it was.
	 * While a Sync runs, Rust's database is busy and the mark would fail: it
	 * waits for the end, with the snapshot of now, even if the book is closed
	 * meanwhile (Task 38). */
	async openBook(bookId: number): Promise<void> {
		const { snapshot, seenSeq } = this.#newSnapshot(bookId);
		this.#viewingNewIds = snapshot;
		this.#viewingBookId = bookId;
		if (this.activeReaderId === null) return;
		// The book's own Reader: a Sync on connect may show another one before it ends
		const readerId = this.activeReaderId;
		if (this.running) await this.running.catch(() => {});

		if (await this.#markSeen(readerId, bookId, snapshot, seenSeq)) await this.loadSummary();
	}

	/** The ids of the book's new highlights now, and the highest `syncedSeq` loaded. */
	#newSnapshot(bookId: number): { snapshot: Set<string>; seenSeq: number } {
		const highlights = this.books.find((b) => b.id === bookId)?.highlights ?? [];
		return {
			snapshot: new Set(highlights.filter((h) => h.isNew).map((h) => h.id)),
			seenSeq: Math.max(0, ...highlights.map((h) => h.syncedSeq ?? 0))
		};
	}

	/** Marks the book seen up to `seenSeq` and clears `isNew` only on the
	 * snapshot's highlights. A failed mark is logged and leaves them new.
	 * Whether the mark worked. */
	async #markSeen(readerId: number, bookId: number, snapshot: ReadonlySet<string>, seenSeq: number): Promise<boolean> {
		try {
			await commands.markBookOpened(readerId, bookId, seenSeq);
		} catch (error) {
			console.error('Failed to mark the book as opened:', error);
			return false;
		}
		// A mark that waited for a Sync may find another Reader's Library on screen: its books are not this one
		if (this.activeReaderId === readerId) this.#clearNew(new Map([[bookId, snapshot]]));
		return true;
	}

	/** Clears `isNew` on the given highlights of the given books, in one assignment.
	 * Reads this.books now: openReader may have replaced it while waiting. */
	#clearNew(cleared: ReadonlyMap<number, ReadonlySet<string>>) {
		this.books = this.books.map((book) => {
			const ids = cleared.get(book.id);
			return ids
				? { ...book, highlights: book.highlights.map((h) => (ids.has(h.id) ? { ...h, isNew: false } : h)) }
				: book;
		});
	}

	closeBook() {
		this.#viewingBookId = null;
	}

	// Readers
	async loadReaders(): Promise<Reader[]> {
		this.readers = await commands.listReaders();
		return this.readers;
	}

	/** Shows the Reader's Library, read from Rust; no Kobo needed (R17).
	 * `keepSelection` (a reload after a Sync) keeps the selected ids still in
	 * the Library; another Reader's never stay. Whether this Library was the
	 * one shown: false when a later request overtook it. */
	async openReader(readerId: number, { keepSelection = false }: { keepSelection?: boolean } = {}): Promise<boolean> {
		const request = ++this.#openRequest;
		const books = await commands.getLibrary(readerId);
		// A Library shown since (another Reader, or a Kobo's on connect) wins
		if (request !== this.#openRequest) return false;
		this.#showLibrary(readerId, books, keepSelection);
		await this.loadSummary();
		return true;
	}

	#openRequest = 0;

	/** Puts the Library on screen in one synchronous step. */
	#showLibrary(readerId: number, books: Book[], keepSelection: boolean) {
		// Read after the wait: a selection made while Rust read the Library stays
		const keep = keepSelection && readerId === this.activeReaderId;
		// Another Reader's dates are not this one's: nothing until its summary arrives
		if (readerId !== this.activeReaderId) this.summary = null;
		this.activeReaderId = readerId;
		this.books = books;
		if (keep) {
			const present = new Set(books.map((book) => book.id));
			this.selectedBookIds = this.selectedBookIds.filter((id) => present.has(id));
		} else {
			this.selectedBookIds = [];
		}
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
		const readerId = this.activeReaderId;
		if (readerId === null) throw new Error('No reader open');
		await commands.deleteBook(readerId, bookId);
		// Another Reader's Library may be on screen by now: its book with the same id is not this one
		if (this.activeReaderId === readerId) this.removeBook(bookId);
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
		if (device.serialNumber === null || device.serialNumber !== this.#declinedSerial) this.#declinedSerial = null;
		// Declined: the same Kobo, still unowned, reported again by the monitor
		if (this.#declinedSerial !== null && this.connectedReaderId === null) {
			this.connectedDevice = device;
			return 'idle';
		}
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

		const readerId = this.connectedReaderId;
		// Another Reader's Sync ends by reopening its own Library: this one waits for it (M3)
		while (syncOnConnect && this.running && this.#runningReaderId !== readerId) await this.running.catch(() => {});
		// Unplugged, or another Kobo connected, while it waited
		if (this.connectedReaderId !== readerId) return 'idle';

		// Show the Reader's Library first, so a Sync that fails lands on it (as in handleChooseReader),
		// and the Sync fills the Library on screen, not the empty state (Task 38)
		if (this.activeReaderId === null) {
			await this.openReader(readerId);
			this.setUiState('library');
		} else if (!syncOnConnect) await this.loadSummary();
		if (syncOnConnect) {
			// Another Reader's Kobo: the Sync shows its Library first, with no book or selection of the other (M3)
			await this.sync({ show: this.activeReaderId !== readerId });
			return 'synced';
		}
		return 'idle';
	}

	/** Resolves once no Sync runs, whether it worked or not. */
	async syncEnded(): Promise<void> {
		while (this.running) await this.running.catch(() => {});
	}

	/** The Sync in flight, shared by every caller until it ends. */
	private running: Promise<SyncReport> | null = null;
	#runningReaderId: number | null = null;

	/** Syncs the connected Kobo into its Reader's Library and shows it (R16).
	 * A call while a Sync runs gets that Sync: at startup the scan and the
	 * monitor's first device-detected both arrive for the same Kobo.
	 * `show` puts the Kobo's Reader on screen first, as part of the Sync. */
	sync({ show = false }: { show?: boolean } = {}): Promise<SyncReport> {
		if (this.running) return this.running;
		const device = this.connectedDevice;
		const readerId = this.connectedReaderId;
		if (!device || readerId === null) return Promise.reject(new Error('No known Kobo connected'));

		this.#runningReaderId = readerId;
		this.running = this.runSync(device, readerId, show).finally(() => {
			this.running = null;
			this.#runningReaderId = null;
		});
		return this.running;
	}

	private async runSync(device: KoboDevice, readerId: number, show: boolean): Promise<SyncReport> {
		this.isImporting = true;
		this.lastSyncFailed = false;
		this.syncProgress = { done: 0, total: 0 };
		try {
			if (show) {
				// The other Reader's book stays until this Library arrives; the Sync has begun, so it cannot be acted on
				let books: Book[] = [];
				let readFailure: { error: unknown } | null = null;
				try {
					books = await commands.getLibrary(readerId);
				} catch (error) {
					// Shown anyway, empty: the failure is this Reader's and lands on its Library
					readFailure = { error };
				}
				++this.#openRequest;
				this.closeBook();
				this.#showLibrary(readerId, books, false);
				this.setUiState('library');
				if (readFailure) throw readFailure.error;
				await this.loadSummary();
			}
			const report = await commands.syncKobo(device);
			// The Library was on screen all along: what was selected in it stays (Task 38)
			await this.openReader(readerId, { keepSelection: true });
			return report;
		} catch (error) {
			console.error('Failed to sync the Kobo:', error);
			this.lastSyncFailed = true;
			throw error;
		} finally {
			this.isImporting = false;
			this.syncProgress = null;
		}
	}

	/** Exports the books, and a book that is exported stops being new, as when
	 * it is opened (D1): the snapshot is taken before the export, so a
	 * highlight that arrives meanwhile stays new. A failed export touches
	 * nothing; a failed mark is logged and leaves that book new. The marks
	 * wait for a running Sync, as `openBook` does, without holding the export
	 * back: see `marksSettled`. */
	async exportIds(bookIds: number[]): Promise<string[]> {
		if (bookIds.length === 0) throw new Error('No books selected for export');
		if (this.activeReaderId === null) throw new Error('No reader open');
		const readerId = this.activeReaderId;
		// Only books with news have anything to mark
		const seen = bookIds
			.map((bookId) => ({ bookId, ...this.#newSnapshot(bookId) }))
			.filter(({ snapshot }) => snapshot.size > 0);
		this.isExporting = true;
		try {
			const exported = await commands.exportLibraryBooks(readerId, bookIds);
			// Rust answers the files; a stand-in that answers nothing leaves none
			this.lastExport = exported ?? [];
			this.#marks = this.#markExported(readerId, seen);
			return exported;
		} finally {
			this.isExporting = false;
		}
	}

	/** The marks of the last export, which wait for a running Sync; they never reject. */
	#marks: Promise<void> = Promise.resolve();

	/** Resolves once the marks of the last export are done. */
	marksSettled(): Promise<void> {
		return this.#marks;
	}

	async #markExported(
		readerId: number,
		seen: Array<{ bookId: number; snapshot: Set<string>; seenSeq: number }>
	): Promise<void> {
		// Rust's database is busy during a Sync: the mark waits for its end
		await this.syncEnded();
		const marked = await Promise.all(
			seen.map(async ({ bookId, snapshot, seenSeq }) => {
				try {
					await commands.markBookOpened(readerId, bookId, seenSeq);
					return [bookId, snapshot] as const;
				} catch (error) {
					console.error('Failed to mark the book as opened:', error);
					return null;
				}
			})
		);
		const cleared = new Map(marked.filter((m) => m !== null));
		if (cleared.size > 0) {
			this.#clearNew(cleared);
			await this.loadSummary();
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