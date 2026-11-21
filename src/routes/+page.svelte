<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import { emit, listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { homeDir } from '@tauri-apps/api/path';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { revealItemInDir } from '@tauri-apps/plugin-opener';
	import { commands, events } from '$lib/bindings';
	import LibraryView from '$lib/components/LibraryView.svelte';
	import BookDetailsView from '$lib/components/BookDetailsView.svelte';
	import EmptyStateNoDevice from '$lib/components/EmptyStateNoDevice.svelte';
	import EmptyStateSyncing from '$lib/components/EmptyStateSyncing.svelte';
	import DeleteBookDialog from '$lib/components/DeleteBookDialog.svelte';
	import UnknownKoboDialog from '$lib/components/UnknownKoboDialog.svelte';
	import { LibraryHeader, type LibraryHeaderState } from '$lib/components/ui/library-header';
	import { dismiss, notify, Toaster } from '$lib/components/ui/toast';
	import { TooltipProvider } from '$lib/components/ui/tooltip';
	import { WindowBar } from '$lib/components/ui/window-bar';
	import { _ } from '$lib/i18n';
	import { exportErrorView, type ExportErrorView } from '$lib/errors';
	import { chooseExportFolder } from '$lib/export-folder';
	import { library, newHighlightCount } from '$lib/stores/library.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { Book, KoboDevice, SortPreference, ViewMode } from '$lib/types';
	import { createApplicationMenu, setRevealLastExportEnabled } from '$lib/menu';
	import UpdateDialog from '$lib/components/UpdateDialog.svelte';
	import { UPDATES_STATE_EVENT, UPDATES_STATE_REQUEST_EVENT, updater } from '$lib/stores/updater.svelte';

	// Sync with store
	let viewMode = $derived(settings.uiPreferences.libraryViewMode);
	let sortBy = $derived(settings.uiPreferences.librarySort);
	let reversed = $derived(settings.uiPreferences.librarySortReversed);

	// Local state
	/** A connected Kobo with no Reader yet: asked before any Sync (R7). */
	let unknownDevice = $state<KoboDevice | null>(null);
	/** The Reader of the last session: the pop-up's choice when no Library is open (Q3). */
	let askedLastReaderId = $state<number | null>(null);
	/** The window was opened by Sync (a request), not by the Kobo connecting: choosing then syncs, whatever «Sincronizar ao ligar» says. */
	let askedBySync = false;
	/** The header's own export finished well: its button reads «✓ Exportado» for 2 s (Y1). Cleared when the Library is left or a Sync starts. */
	let exported = $state(false);
	/**
	 * The header's state from before its own export: it stays on screen while the export runs and for the 2 s of
	 * «✓ Exportado», since the export clears the news that made the header (Y1). Then the header leaves.
	 */
	let heldHeader = $state<LibraryHeaderState | null>(null);
	/** The new highlights (book and id) of that same moment: the cards keep their «N novos» labels as long as the header is held. */
	let heldNew = $state<ReadonlySet<string> | null>(null);
	let exportedTimer: ReturnType<typeof setTimeout> | undefined;
	/** What was exported, to repeat it: the books, and the header's state when the header's button asked for it. */
	type ExportAttempt = { ids: number[]; held: LibraryHeaderState | null; readerId: number | null };
	/** Bumped when a Sync starts or the Reader changes: an export that was running then is another Library's, and its end shows nothing. */
	let exportGeneration = 0;
	/** The Detail's failure notice, closed when the Library it was about goes away. */
	let failureToastId: number | null = null;
	/** The Library's last export failed (the header's error, from any of its exports); the Detail's failure is a toast. */
	let exportFailure = $state<{ error: unknown; attempt: ExportAttempt } | null>(null);
	/** The home folder, written «~» in the error; read once, and the full path if there is none. */
	let home = $state<string | null>(null);
	/** The book last opened: its option takes focus when the detail closes. */
	let openedBookId = $state<number | null>(null);

	/** Notices of the screens that have no place of their own for them: a neutral toast. */
	function showNotification(message: string, _type?: 'success' | 'error') {
		notify(message);
	}

	// The Library header, from the books (reactive: opening or exporting a book changes them) and the summary
	const newBookIds = $derived(library.books.filter((book) => newHighlightCount(book) > 0).map((book) => book.id));
	const newHighlights = $derived(library.books.reduce((total, book) => total + newHighlightCount(book), 0));
	const headerState = $derived.by<LibraryHeaderState | null>(() => {
		// First: it wins over an error the store has not cleared yet, and the first Sync has no books yet
		if (library.isImporting) {
			return { kind: 'aSincronizar', done: library.syncProgress?.done ?? 0, total: library.syncProgress?.total ?? 0 };
		}
		if (library.lastSyncFailed) return { kind: 'erro', message: '' };
		if (exportFailure) {
			const { error, attempt } = exportFailure;
			const view = exportErrorView(error, home, $_);
			return {
				kind: 'erro',
				title: view.title,
				message: view.detail,
				action: {
					label: exportActionLabel(view),
					variant: view.action === 'chooseFolder' ? 'principal' : 'secundario',
					onclick: () => recoverExport(view, attempt)
				}
			};
		}
		if (heldHeader) return heldHeader;
		if (library.books.length === 0) return null;
		if (newHighlights > 0) {
			return { kind: 'novos', highlights: newHighlights, books: newBookIds.length, since: library.summary?.newSince };
		}
		// Nothing new: no header at all (Plano 0002, «Sem novidades, sem cabeçalho»)
		return null;
	});
	/** The start and the end of a Sync, for a screen reader: a region that mounts with its text is not reliably announced, so this one is always mounted. */
	let syncAnnouncement = $state('');
	let wasImporting = false;
	$effect(() => {
		const importing = library.isImporting;
		if (importing === wasImporting) return;
		wasImporting = importing;
		untrack(() => {
			if (importing) syncAnnouncement = $_('screens.library.header.syncing');
			// A failure is the header's alert, not repeated here
			else if (library.lastSyncFailed) syncAnnouncement = '';
			else if (headerState?.kind === 'novos') {
				syncAnnouncement = `${$_('screens.library.header.newHighlights', { count: headerState.highlights })} ${$_('screens.library.header.inBooks', { count: headerState.books })}`;
			} else syncAnnouncement = $_('screens.library.header.noNews');
		});
	});

	// The book opened in another Reader's Library is not this one's: a Reader switch, by the menu or by a connecting Kobo, forgets it
	let lastReaderId = library.activeReaderId;
	$effect.pre(() => {
		const readerId = library.activeReaderId;
		if (readerId === lastReaderId) return;
		lastReaderId = readerId;
		openedBookId = null;
		leaveExportLibrary();
	});

	/** Export waits for the end of a Sync, in the Library and in a book. */
	const exportDisabledReason = $derived(library.isImporting ? $_('screens.library.exportDisabledReason') : undefined);
	/** Why Sync is off: the connected Kobo is another Reader's (named by its owner, not the open Reader), else no Kobo. */
	const syncDisabledReason = $derived.by(() => {
		if (library.canSync || library.isImporting) return undefined;
		const ownerId = library.connectedReaderId;
		if (library.connectedDevice && ownerId !== null && ownerId !== library.activeReaderId) {
			const owner = library.readers.find((reader) => reader.id === ownerId);
			if (owner) return $_('screens.library.syncOtherReaderReason', { reader: owner.name });
		}
		return $_('screens.library.syncDisabledReason');
	});
	/** The book on screen in the detail; it stays open while a Sync runs (Task 38). */
	const detailBook = $derived(library.uiState === 'book-details' ? library.viewingBook : undefined);

	/** The book «Apagar este livro?» is about, and the Reader it was open in; the window is mounted while this is set. */
	let deleting = $state<{ bookId: number; readerId: number } | null>(null);
	/** One delete at a time, whatever the window does. */
	let deleteInFlight = false;
	/** Apagar is for a book whose highlights all left the Kobo: at least one, and none alive (Detalhe 5; Rust only asks for no live ones). */
	const canDelete = $derived(!!detailBook && detailBook.highlights.length > 0 && detailBook.highlights.every((h) => h.removedAt));
	/** A Sync or an export has the Library in use: Apagar waits, as Export does. */
	const deleteBusy = $derived(library.isImporting || library.isExporting);
	// The window closes, deleting nothing, once what it asked about is no longer so: a Sync began, the book came back to life, the book or the Reader changed
	$effect.pre(() => {
		if (!deleting || deleteInFlight) return;
		if (library.isImporting || !canDelete || detailBook?.id !== deleting.bookId || library.activeReaderId !== deleting.readerId) deleting = null;
		// Another modal window on top would stack two: «De quem é este Kobo?» and the updater's win
		else if (unknownDevice || (updater.state !== 'idle' && updater.state !== 'restartPending')) deleting = null;
	});

	// Event unlisten functions for cleanup
	let unlistenDeviceDetected: UnlistenFn | undefined;
	let unlistenDeviceDisconnected: UnlistenFn | undefined;
	let unlistenCheckForUpdates: UnlistenFn | undefined;
	let unlistenUpdatesStateRequest: UnlistenFn | undefined;
	/** The page is gone: a listener that registers after that is removed at once. */
	let destroyed = false;
	let unlistenSyncProgress: UnlistenFn | undefined;
	let unlistenSyncFinished: UnlistenFn | undefined;
	let unlistenReadersChanged: UnlistenFn | undefined;
	let unlistenResized: UnlistenFn | undefined;

	/** The traffic lights' room in the bar: their right edge less the bar's px-4 (Task 36b); 52, the Figma's, until measured. */
	let measuredTrafficLights = $state<number | null>(null);
	/** No traffic lights in full screen. */
	let fullscreen = $state(false);
	const trafficLightsWidth = $derived(fullscreen ? 0 : (measuredTrafficLights ?? 52));

	/** Measured once: Rust gives the edge tao leaves them at, drawn or not, and a resize does not move them. */
	async function measureTrafficLights() {
		try {
			const maxX = await commands.trafficLightsMaxX();
			if (typeof maxX === 'number' && Number.isFinite(maxX)) measuredTrafficLights = Math.max(0, maxX - 16);
		} catch (error) {
			console.error('Failed to measure the traffic lights:', error);
		}
	}

	/** Resizes come one per frame: one check at a time, and one more for the events that came while it ran. */
	let checkingFullscreen = false;
	let fullscreenChangedSinceCheck = false;
	async function checkFullscreen() {
		if (checkingFullscreen) {
			fullscreenChangedSinceCheck = true;
			return;
		}
		checkingFullscreen = true;
		try {
			do {
				fullscreenChangedSinceCheck = false;
				fullscreen = await getCurrentWindow()
					.isFullscreen()
					.catch(() => fullscreen);
			} while (fullscreenChangedSinceCheck);
		} finally {
			checkingFullscreen = false;
		}
	}

	/** The natural direction of each criterion; `reversed` runs against it. A missing value stays last either way. */
	let sortedBooks = $derived.by(() => {
		const sign = reversed ? -1 : 1;
		const missing = (book: Book) => (sortBy === 'date_last_read' ? !book.dateLastRead : sortBy === 'author' ? !book.author?.trim() : false);
		return [...library.books].sort((a, b) => {
			const gap = Number(missing(a)) - Number(missing(b));
			if (gap !== 0) return gap;
			switch (sortBy) {
				case 'title':
					return sign * (a.title || '').localeCompare(b.title || '');
				case 'author':
					return sign * (a.author || '').localeCompare(b.author || '');
				case 'date_last_read':
					return sign * (b.dateLastRead || '').localeCompare(a.dateLastRead || '');
				case 'highlight_count':
					return sign * ((b.highlights?.length || 0) - (a.highlights?.length || 0));
				default:
					return 0;
			}
		});
	});

	const newHighlightKeys = () =>
		new Set(library.books.flatMap((book) => book.highlights.filter((h) => h.isNew && !h.removedAt).map((h) => `${book.id}/${h.id}`)));
	/** The books as the grid shows them: while the header is held, with the news the export cleared still marked, so the labels leave with the header. */
	const shownBooks = $derived.by(() => {
		const held = heldNew;
		if (!held) return sortedBooks;
		return sortedBooks.map((book) =>
			book.highlights.some((h) => !h.isNew && held.has(`${book.id}/${h.id}`))
				? { ...book, highlights: book.highlights.map((h) => (held.has(`${book.id}/${h.id}`) ? { ...h, isNew: true } : h)) }
				: book
		);
	});

	// The native menu speaks the interface's language: rebuilt when it changes
	$effect(() => {
		const format = $_;
		const timer = setTimeout(() => createApplicationMenu(format, () => library.activeReaderId, () => library.lastExport), 500);
		return () => clearTimeout(timer);
	});

	// File › «Mostrar última exportação no Finder» works from the first export of the session
	$effect(() => {
		setRevealLastExportEnabled(library.lastExport.length > 0);
	});

	// Any Sync, from the button or on connect, ends the header's «✓ Exportado» and an export error as it starts, not when it ends
	$effect.pre(() => {
		if (library.isImporting) leaveExportLibrary();
	});

	/** An installed update waits for exports and Syncs before restarting. */
	const isBusy = () => library.isImporting || library.isExporting;

	$effect(() => {
		updater.restartWhenIdle(isBusy());
	});

	// The Settings window shows the last check and waits while this one checks: it is told after every change
	$effect(() => {
		emit(UPDATES_STATE_EVENT, updater.snapshot()).catch((error) => console.error('Failed to report the updater state:', error));
	});

	// Sync with store on mount
	onMount(() => {
		homeDir()
			.then((path) => (home = typeof path === 'string' ? path : null))
			.catch(() => (home = null));

		// Setup event listeners for device monitoring
		setupDeviceListeners();

		// The traffic lights' room in the bar: measured now; a resize only checks for full screen
		measureTrafficLights();
		checkFullscreen();
		getCurrentWindow()
			.onResized(() => checkFullscreen())
			.then((unlisten) => (destroyed ? unlisten() : (unlistenResized = unlisten)))
			.catch((error) => console.error('Failed to listen for resizes:', error));

		// Open the Library, then look for a Kobo
		handleStartup();

		// Cleanup on unmount
		return () => {
			clearTimeout(exportedTimer);
			unlistenDeviceDetected?.();
			unlistenDeviceDisconnected?.();
			unlistenCheckForUpdates?.();
			unlistenUpdatesStateRequest?.();
			unlistenSyncProgress?.();
			unlistenSyncFinished?.();
			unlistenReadersChanged?.();
			destroyed = true;
			unlistenResized?.();
		};
	});

	async function setupDeviceListeners() {
		try {
			// «Procurar atualizações…» in the native menu, or Settings' «Check Now»:
			// the dialog is in this window, so it comes in front of Settings, minimized or not.
			// Each step may be refused: the check goes on
			unlistenCheckForUpdates = await listen('check-for-updates', async () => {
				const win = getCurrentWindow();
				for (const [step, bringForward] of [
					['unminimize', () => win.unminimize()],
					['show', () => win.show()],
					['focus', () => win.setFocus()]
				] as const) {
					try {
						await bringForward();
					} catch (error) {
						console.error(`Failed to ${step} the main window:`, error);
					}
				}
				updater.checkNow();
			});

			// Settings opened after a check: it asks where the updater stands
			const unlistenRequest = await listen(UPDATES_STATE_REQUEST_EVENT, () => {
				emit(UPDATES_STATE_EVENT, updater.snapshot()).catch((error) => console.error('Failed to report the updater state:', error));
			});
			if (destroyed) unlistenRequest();
			else unlistenUpdatesStateRequest = unlistenRequest;

			// A Reader renamed, or given another folder, in Settings
			unlistenReadersChanged = await listen('readers-changed', () => {
				library.loadReaders().catch((error) => console.error('Failed to reload the readers:', error));
			});

			// Listen for device detected events
			unlistenDeviceDetected = await events.deviceDetected.listen((event) => {
				console.log('Device detected:', event.payload);
				handleDeviceConnected(event.payload.device);
			});

			// «N de M livros» while a Sync runs (R16)
			unlistenSyncProgress = await events.syncProgress.listen((event) => {
				library.syncProgress = event.payload;
			});

			// Reload the Library the Sync wrote to, if it is on screen
			unlistenSyncFinished = await events.syncFinished.listen((event) => {
				if (event.payload.readerId === library.activeReaderId) {
					// Rust says so before `sync_kobo` answers: the selection made during the Sync stays here too
					library.openReader(event.payload.readerId, { keepSelection: true }).catch((e) => console.error(e));
				}
			});

			// The Library stays on screen without the Kobo (R17)
			unlistenDeviceDisconnected = await events.deviceDisconnected.listen(() => {
				console.log('Device disconnected');
				library.lastSyncFailed = false;
				// «De quem é este Kobo?» is moot with the Kobo gone: closed, nothing chosen or created
				unknownDevice = null;
				library.deviceDisconnected();
			});
		} catch (error) {
			console.error('Failed to setup device listeners:', error);
		}
	}

	/** Shows the Library when a Reader is open, the empty state otherwise. An open
	 * book stays open (a Sync ends without a jump), unless it is gone from the Library. */
	function showLibraryOrEmpty() {
		if (library.uiState === 'book-details') {
			if (library.viewingBook) return;
			library.closeBook();
		}
		library.setUiState(library.activeReaderId !== null ? 'library' : 'no-device');
	}

	/** A Kobo was connected: ask whose it is if unknown (R7), else sync
	 * when «Sincronizar ao ligar» is on (R6). */
	async function handleDeviceConnected(device: KoboDevice) {
		try {
			const outcome = await library.deviceConnected(device, settings.uiPreferences.syncOnConnect ?? true);
			if (outcome === 'unknown' && device.serialNumber) await askWhoseKobo(device);
		} catch (error) {
			console.error('Sync on connect failed:', error);
			// The store set it if the Sync itself failed; a connect that failed before it is shown the same
			library.lastSyncFailed = true;
		}
		showLibraryOrEmpty();
	}

	/** Opens «De quem é este Kobo?» for a Kobo that is still connected. */
	async function askWhoseKobo(device: KoboDevice) {
		const last = await library.lastReaderId();
		// Unplugged while the last Reader was read: there is no Kobo to ask about
		if (library.connectedDevice?.serialNumber !== device.serialNumber) return;
		// Cancelled, or answered, while the last Reader was read: not asked again
		if (library.declinedKobo || library.connectedReaderId !== null) return;
		askedLastReaderId = last;
		unknownDevice = device;
	}

	/** Esc, ⌘. or Cancelar: the Library stays as it is, and this connection of the Kobo is not asked about again (Q2). */
	function handleCancelUnknownKobo() {
		askedBySync = false;
		const serial = unknownDevice?.serialNumber;
		unknownDevice = null;
		if (serial) library.declineKobo(serial);
	}

	/** «Sincronizar» in the toolbar (R6). */
	async function handleSync() {
		// Sync stays enabled while it turns: a click then is not a second Sync, and changes nothing
		if (library.isImporting) return;
		// A Kobo without an owner that was declined: Sync asks again, it does not sync the open Library
		const declined = library.declinedKobo ? library.connectedDevice : undefined;
		if (declined) {
			library.forgetDeclinedKobo();
			askedBySync = true;
			await askWhoseKobo(declined);
			return;
		}
		// The store clears the error as the Sync starts
		leaveExportLibrary();
		try {
			await library.sync();
		} catch (error) {
			console.error('Sync failed:', error);
			// Also a Sync that could not start (no known Kobo)
			library.lastSyncFailed = true;
		}
		showLibraryOrEmpty();
	}

	/** On start: open the Library of the connected Kobo's Reader, else the
	 * last Reader (R5), with or without a Kobo (R17). */
	async function handleStartup() {
		let device: KoboDevice | null = null;
		try {
			await library.loadReaders();
			device = await library.scanForDevice();
			const readerId = await library.initialReader(device?.serialNumber);
			if (readerId !== null) await library.openReader(readerId);
		} catch (error) {
			console.error('Failed to open the Library:', error);
		}
		showLibraryOrEmpty();
		if (device) await handleDeviceConnected(device);
	}

	/** The user said whose Kobo it is: remember it, show that Library and
	 * only then sync (R1, R7). */
	async function handleChooseReader(readerId: number) {
		const device = unknownDevice;
		if (!device?.serialNumber) return;
		const requested = askedBySync;
		askedBySync = false;
		unknownDevice = null;
		try {
			await library.associateKobo(device.serialNumber, readerId);
		} catch (error) {
			console.error('Failed to associate the Kobo:', error);
			notify($_('notifications.associateKoboError'));
			showLibraryOrEmpty();
			return;
		}
		// Mid-Sync, the Library would be undone by the Sync's end: the Sync on connect
		// shows it once that one ends; without it, it opens after the end
		if (library.isImporting) {
			if (settings.uiPreferences.syncOnConnect ?? true) {
				await handleDeviceConnected(device);
				return;
			}
			await library.syncEnded();
		}
		try {
			await library.openReader(readerId);
			// The Library is on screen while it syncs, not the empty state (Task 38, I1)
			showLibraryOrEmpty();
			await handleDeviceConnected(device);
			// Sync asked: it syncs even with «Sincronizar ao ligar» off (with it on, the connect did)
			if (requested && !(settings.uiPreferences.syncOnConnect ?? true) && library.canSync) await handleSync();
		} catch (error) {
			console.error('Failed to open the reader:', error);
			notify($_('notifications.openReaderError'));
			showLibraryOrEmpty();
		}
	}

	async function handleCreateReader(name: string) {
		try {
			const reader = await library.createReader(name);
			await handleChooseReader(reader.id);
		} catch (error) {
			console.error('Failed to create the reader:', error);
			notify($_('notifications.createReaderError'));
		}
	}

	async function handleSelectReader(readerId: number) {
		// The Sync ends by opening its Kobo's Reader: a menu left open must not switch now
		if (library.isImporting) return;
		library.lastSyncFailed = false;
		leaveExportLibrary();
		try {
			await library.openReader(readerId);
		} catch (error) {
			console.error('Failed to open the reader:', error);
			notify($_('notifications.openReaderError'));
		}
		showLibraryOrEmpty();
	}

	/** The header's «✓ Exportado» is over (2 s, a Sync, another Reader or a book): the header goes back to what the books say. */
	function endExported() {
		clearTimeout(exportedTimer);
		exported = false;
		heldHeader = null;
		heldNew = null;
	}

	/** The export's feedback in the Library ends with it: «✓ Exportado» and the error. */
	function leaveExportFeedback() {
		endExported();
		exportFailure = null;
	}

	/** A Sync starts or the Reader changes: the feedback goes, and an export still running is not heard from any more. */
	function leaveExportLibrary() {
		exportGeneration++;
		leaveExportFeedback();
		if (failureToastId !== null) dismiss(failureToastId);
		failureToastId = null;
	}

	/** The files of an export, selected in the Finder. */
	function showInFinder(paths: string[]) {
		revealItemInDir(paths).catch((error) => {
			console.error('Failed to show the export in the Finder:', error);
			notify($_('notifications.showInFinderError'));
		});
	}

	/** Exports `bookIds` (the selection when none are given). The books stop being new (D1). `held` is the header's state when its own button asked. Whether it worked. */
	async function handleExport(bookIds?: number[], held: LibraryHeaderState | null = null): Promise<boolean> {
		// One export at a time: a held key or a second click must not start another; none while a Sync runs
		if (library.isExporting || library.isImporting) return false;
		const attempt: ExportAttempt = { ids: bookIds ?? [...library.selectedBookIds], held, readerId: library.activeReaderId };
		// Nothing to export (the news were just cleared): not an error
		if (attempt.ids.length === 0) return false;
		const generation = exportGeneration;
		const focusWasInHeader = !!document.querySelector('[data-slot="library-header"]')?.contains(document.activeElement);
		endExported();
		exportFailure = null;
		// The export clears the news that made the header: it is kept until the «✓ Exportado» is over
		heldHeader = held;
		heldNew = held ? newHighlightKeys() : null;
		try {
			await library.exportIds(attempt.ids);
			const paths = library.lastExport;
			notify(
				$_('notifications.booksExported', { count: attempt.ids.length }),
				paths.length > 0 ? { action: { label: $_('notifications.showInFinder'), onClick: () => showInFinder(paths) } } : {}
			);
			// Only while the header is still held: a Sync, another Reader or a book ended it, and the check would be about another screen
			if (held && generation === exportGeneration && heldHeader !== null) {
				exported = true;
				exportedTimer = setTimeout(endExported, 2000);
			}
			return true;
		} catch (error) {
			console.error('Export failed:', error);
			// The Library it was about is gone (a Sync, another Reader): nothing to say about it here
			if (generation !== exportGeneration) return false;
			const headerWasThere = headerState !== null;
			heldHeader = null;
			heldNew = null;
			const view = exportErrorView(error, home, $_);
			if (detailBook || library.lastSyncFailed) {
				// A book has no header, and the Sync's error holds the header: the failure is a notice with the same action
				failureToastId = notify(view.toast, {
					icon: 'error',
					action: { label: exportActionLabel(view), onClick: () => recoverExport(view, attempt) }
				});
			} else {
				exportFailure = { error, attempt };
				// A header that mounts with its text is not reliably announced: the page's own region says it
				if (!headerWasThere) syncAnnouncement = `${view.title} ${view.detail}`.trim();
				// The button that was pressed is gone with the strip it was in: the focus follows to the error's action
				if (focusWasInHeader) {
					await tick();
					document.querySelector<HTMLElement>('[data-slot="library-header"] button')?.focus();
				}
			}
			return false;
		}
	}

	const exportActionLabel = (view: ExportErrorView) =>
		view.action === 'chooseFolder' ? $_('screens.library.header.chooseFolder') : $_('screens.library.header.retry');

	/** The action of a failed export: another folder first when the folder is the problem, then the same export again. Cancelling the picker changes nothing. */
	async function recoverExport(view: ExportErrorView, attempt: ExportAttempt) {
		// The error was about another Reader's books: not repeated here
		const stale = () => attempt.readerId !== library.activeReaderId;
		if (stale()) {
			exportFailure = null;
			return;
		}
		if (view.action === 'chooseFolder') {
			try {
				if (!(await chooseExportFolder(view.folder, library.activeReaderId))) return;
			} catch (error) {
				console.error('Failed to choose the folder:', error);
				notify($_('settings.errors.save'));
				return;
			}
			// The picker was open while the Reader changed: the folder went to the one that was open, the export is not repeated
			if (stale()) return;
		}
		await handleExport(attempt.ids, attempt.held);
	}

	/** «Exportar M livros» of the header: the books with news. The user's selection stays as it is. */
	async function handleExportNew() {
		// «✓ Exportado» is not a button for another export
		if (exported) return;
		const before = headerState?.kind === 'novos' ? headerState : null;
		await handleExport(newBookIds, before);
	}

	/** The bar's Export, and ⌘E: the open book, else the selection, else every book (without selecting them). */
	async function handleBarExport() {
		if (library.isImporting || library.isExporting) return;
		if (detailBook) await handleExport([detailBook.id]);
		else if (library.selectedBookIds.length > 0) await handleExport();
		else if (library.books.length > 0) await handleExport(library.books.map((b) => b.id));
	}

	function handleSelectionChange(newSelection: number[]) {
		library.setSelectedBookIds(newSelection);
	}

	/** The only way into a book: a click or Enter, in the grid and in the list. */
	function openBook(book: Book) {
		leaveExportFeedback();
		openedBookId = book.id;
		library.openBook(book.id);
		library.setUiState('book-details');
	}

	function handleCloseBookDetails() {
		library.closeBook();
		library.setUiState('library');
	}

	/** The caixote and ⌘⌫: asks before deleting the open book. */
	function openDeleteDialog() {
		if (!detailBook || !canDelete || deleteBusy || deleting || library.activeReaderId === null) return;
		deleting = { bookId: detailBook.id, readerId: library.activeReaderId };
	}

	/** «Apagar» in the window: checks again, deletes, and goes back to the Library. A failure reads the Library again to know what happened. */
	async function confirmDelete() {
		const target = deleting;
		if (!target || deleteInFlight) return;
		if (deleteBusy || !canDelete || detailBook?.id !== target.bookId || library.activeReaderId !== target.readerId) {
			deleting = null;
			return;
		}
		deleteInFlight = true;
		// The book that takes its place in the grid or the list, as the Library shows them: the next one, else the previous
		const order = sortedBooks.map((book) => book.id);
		const at = order.indexOf(target.bookId);
		const neighbour = order[at + 1] ?? order[at - 1] ?? null;
		/** Back to the Library, the focus on the neighbour (it is the card or the row that was in the deleted one's place). */
		const leave = () => {
			openedBookId = neighbour;
			handleCloseBookDetails();
		};
		// Another Reader or another book on screen by the time Rust answers: this delete is no longer the screen's business
		const stale = () => library.activeReaderId !== target.readerId || library.viewingBookId !== target.bookId || library.uiState !== 'book-details';
		try {
			await library.deleteBook(target.bookId);
			deleting = null;
			if (!stale()) leave();
		} catch (error) {
			console.error('Failed to delete the book:', error);
			if (stale()) {
				deleting = null;
				return;
			}
			let overtaken = false;
			try {
				overtaken = !(await library.openReader(target.readerId, { keepSelection: true }));
			} catch (reloadError) {
				console.error('Failed to reload the Library:', reloadError);
			}
			deleting = null;
			// Overtaken by a later reload: that one decides what is on screen
			if (stale() || overtaken) return;
			// Gone already (deleted elsewhere): the same as deleted, with nothing to say
			if (!library.books.some((book) => book.id === target.bookId)) leave();
			else notify($_('screens.bookDetails.deleteBookError'), { icon: 'error' });
		} finally {
			deleteInFlight = false;
		}
	}

	/** The main window's own choices, saved straight from the click so they
	 * come back next launch. Never from an $effect: applying settings-changed
	 * changes the state, and the effect would save again. */
	function handleSortChange(sort: SortPreference) {
		settings.setSortPreference(sort);
		settings.persist({ librarySort: sort, librarySortReversed: false }).catch((error) => console.error('Failed to save the sort:', error));
	}

	/** A column header: the active column flips the direction, another one sorts by it, in its natural direction. */
	function handleColumnSort(sort: SortPreference) {
		if (sort !== sortBy) return handleSortChange(sort);
		settings.setSortReversed(!reversed);
		settings.persist({ librarySortReversed: reversed }).catch((error) => console.error('Failed to save the sort:', error));
	}

	function handleViewModeChange(mode: ViewMode) {
		settings.setViewMode(mode);
		settings.persist({ libraryViewMode: mode }).catch((error) => console.error('Failed to save the view:', error));
	}

	/** The book names the window while it is open; the title from before comes back with the Library. */
	let titleBeforeDetail: string | undefined;
	$effect(() => {
		const title = detailBook?.title;
		if (title === undefined) return;
		(async () => {
			const win = getCurrentWindow();
			titleBeforeDetail ??= await win.title();
			// Closed while the title was being read: nothing to name
			if (detailBook?.title === undefined) return;
			await win.setTitle(title);
		})().catch((error) => console.error('Failed to set the window title:', error));
	});
	$effect(() => {
		if (detailBook || titleBeforeDetail === undefined) return;
		const previous = titleBeforeDetail;
		titleBeforeDetail = undefined;
		getCurrentWindow()
			.setTitle(previous)
			.catch((error) => console.error('Failed to restore the window title:', error));
	});

	/** ⌘[ and Esc: back to the Library, without the Back button's fade (Movimento 1). Esc only when nothing consumed it. */
	function handleBackKey(event: KeyboardEvent) {
		if (!detailBook || event.repeat) return;
		const target = event.target instanceof Element ? event.target : null;
		if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
		if (unknownDevice || deleting || (updater.state !== 'idle' && updater.state !== 'restartPending')) return;
		if (event.key === 'Escape') {
			if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
		} else if (event.code !== 'BracketLeft' || !event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
			return;
		}
		event.preventDefault();
		handleCloseBookDetails();
	}

	/** ⌘R, ⌘E, ⌘1, ⌘2 and ⌘⌫, the shortcuts of the bar's tooltips: not in the native menu until Phase 6. */
	function handleShortcut(event: KeyboardEvent) {
		handleBackKey(event);
		if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
		// The physical key: Caps Lock or another layout changes `key`, never `code`
		const key = { KeyR: 'r', KeyE: 'e', Digit1: '1', Digit2: '2', Backspace: 'delete' }[event.code];
		if (!key) return;
		// A held key repeats; none of these is meant to
		if (event.repeat) return;
		const target = event.target instanceof Element ? event.target : null;
		// A text field keeps its keys; a modal window owns the keyboard
		if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
		if (unknownDevice || deleting || (updater.state !== 'idle' && updater.state !== 'restartPending')) return;

		const inLibrary = library.uiState === 'library';
		// ⌘⌫ is the book's alone
		if (key === 'delete' && !detailBook) return;
		// In a book only ⌘E and ⌘⌫ work: they export and delete that book
		// With no Library open, ⌘R still asks about a Kobo that was declined
		const asksAgain = key === 'r' && library.uiState === 'no-device' && library.declinedKobo;
		if (!inLibrary && !(detailBook && (key === 'e' || key === 'delete')) && !asksAgain) return;
		event.preventDefault();

		// While a Sync runs only the views switch: Sync and Export wait for its end
		if (key === 'r') {
			if (library.canSync && !library.isImporting) handleSync();
		} else if (key === 'e') {
			if (!library.isImporting) handleBarExport();
		} else if (key === 'delete') {
			openDeleteDialog();
		} else {
			const mode: ViewMode = key === '1' ? 'grid' : 'list';
			if (mode !== viewMode) handleViewModeChange(mode);
		}
	}
</script>

<svelte:window onkeydown={handleShortcut} />

<TooltipProvider>
	<div class="flex flex-col h-screen bg-background overflow-hidden">
		<!-- The bar is always on screen, so the traffic lights never sit over stale content -->
		{#if detailBook}
			<WindowBar
				screen="detail"
				{trafficLightsWidth}
				onback={handleCloseBookDetails}
				exportCount={1}
				{exportDisabledReason}
				onexport={handleBarExport}
				{canDelete}
				deleteDisabled={deleteBusy}
				deleteDisabledReason={exportDisabledReason}
				ondelete={openDeleteDialog}
			/>
		{:else}
			<WindowBar
				screen="library"
				{trafficLightsWidth}
				readers={library.readers}
				activeReaderId={library.activeReaderId}
				onselectReader={(id) => handleSelectReader(Number(id))}
				titleMenuDisabled={library.isImporting}
				disabled={library.activeReaderId === null}
				syncExempt={library.declinedKobo}
				view={viewMode}
				onview={handleViewModeChange}
				sort={sortBy}
				onsort={handleSortChange}
				syncing={library.isImporting}
				syncProgress={library.syncProgress}
				{syncDisabledReason}
				onsync={handleSync}
				exportCount={library.selectedBookIds.length || library.books.length}
				{exportDisabledReason}
				onexport={handleBarExport}
			/>
		{/if}

		<main class="flex-1 relative overflow-hidden flex flex-col">
			{#if library.uiState === 'no-device'}
				<EmptyStateNoDevice />
			{:else if library.uiState === 'library' && library.isImporting && library.books.length === 0}
				<!-- The first Sync: no header, no «Sem livros»; the centred state counts the books -->
				<EmptyStateSyncing progress={library.syncProgress} />
			{:else if library.uiState === 'book-details' && library.viewingBook}
				<BookDetailsView book={library.viewingBook} />
			{:else if library.uiState === 'library'}
				<LibraryView
					books={shownBooks}
					selectedBookIds={library.selectedBookIds}
					{viewMode}
					onSelectionChange={handleSelectionChange}
					sort={sortBy}
					{reversed}
					onSortChange={handleColumnSort}
					onBookOpen={openBook}
					initialActiveId={openedBookId}
					hideNew={library.isImporting}
					onBooksImport={library.canSync ? handleSync : undefined}
				>
					{#snippet header()}
						{#if headerState}
							<LibraryHeader
								state={headerState}
								onExport={handleExportNew}
								onRetry={library.canSync ? handleSync : undefined}
								exporting={library.isExporting}
								{exported}
							/>
						{/if}
					{/snippet}
				</LibraryView>
			{/if}
		</main>
	</div>

	<Toaster />
</TooltipProvider>

{#if unknownDevice}
	<UnknownKoboDialog
		readers={library.readers}
		activeReaderId={library.activeReaderId}
		lastReaderId={askedLastReaderId}
		onChoose={handleChooseReader}
		onCreate={handleCreateReader}
		onCancel={handleCancelUnknownKobo}
	/>
{/if}

{#if deleting}
	<DeleteBookDialog onConfirm={confirmDelete} onCancel={() => (deleting = null)} />
{/if}

<UpdateDialog {isBusy} />

<div aria-live="polite" class="sr-only" data-testid="sync-announcer">{syncAnnouncement}</div>
