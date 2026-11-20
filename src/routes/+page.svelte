<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { commands, events } from '$lib/bindings';
	import LibraryView from '$lib/components/LibraryView.svelte';
	import BookDetailsView from '$lib/components/BookDetailsView.svelte';
	import EmptyStateNoDevice from '$lib/components/EmptyStateNoDevice.svelte';
	import EmptyStateSyncing from '$lib/components/EmptyStateSyncing.svelte';
	import UnknownKoboDialog from '$lib/components/UnknownKoboDialog.svelte';
	import { LibraryHeader, type LibraryHeaderState } from '$lib/components/ui/library-header';
	import { notify, Toaster } from '$lib/components/ui/toast';
	import { TooltipProvider } from '$lib/components/ui/tooltip';
	import { WindowBar } from '$lib/components/ui/window-bar';
	import { _ } from '$lib/i18n';
	import { exportErrorMessage } from '$lib/errors';
	import { library, newHighlightCount } from '$lib/stores/library.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { Book, KoboDevice, SortPreference, ViewMode } from '$lib/types';
	import { createApplicationMenu } from '$lib/menu';
	import UpdateDialog from '$lib/components/UpdateDialog.svelte';
	import { updater } from '$lib/stores/updater.svelte';

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
	/** The header's own export finished well: its button reads «✓ Exportado». Cleared when the Library is left or a Sync starts. */
	let exported = $state(false);
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

	// Event unlisten functions for cleanup
	let unlistenDeviceDetected: UnlistenFn | undefined;
	let unlistenDeviceDisconnected: UnlistenFn | undefined;
	let unlistenCheckForUpdates: UnlistenFn | undefined;
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

	// The native menu speaks the interface's language: rebuilt when it changes
	$effect(() => {
		const format = $_;
		const timer = setTimeout(() => createApplicationMenu(format, () => library.activeReaderId), 500);
		return () => clearTimeout(timer);
	});

	// Any Sync, from the button or on connect, ends the header's «✓ Exportado» as it starts, not when it ends
	$effect.pre(() => {
		if (library.isImporting) exported = false;
	});

	/** An installed update waits for exports and Syncs before restarting. */
	const isBusy = () => library.isImporting || library.isExporting;

	$effect(() => {
		updater.restartWhenIdle(isBusy());
	});

	// Sync with store on mount
	onMount(() => {
		// Setup event listeners for device monitoring
		setupDeviceListeners();

		// The traffic lights' room in the bar: measured now; a resize only checks for full screen
		let destroyed = false;
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
			unlistenDeviceDetected?.();
			unlistenDeviceDisconnected?.();
			unlistenCheckForUpdates?.();
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
			// the dialog is in this window, so it comes in front of Settings
			unlistenCheckForUpdates = await listen('check-for-updates', () => {
				getCurrentWindow()
					.setFocus()
					.catch((error) => console.error('Failed to focus the main window:', error));
				updater.checkNow();
			});

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
		exported = false;
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
		exported = false;
		try {
			await library.openReader(readerId);
		} catch (error) {
			console.error('Failed to open the reader:', error);
			notify($_('notifications.openReaderError'));
		}
		showLibraryOrEmpty();
	}

	/** Exports `bookIds` (the selection when none are given). The books stop being new (D1). Whether it worked. */
	async function handleExport(bookIds?: number[]): Promise<boolean> {
		// One export at a time: a held key or a second click must not start another
		if (library.isExporting) return false;
		const count = bookIds?.length ?? library.selectedBookIds.length;
		exported = false;
		try {
			if (bookIds) await library.exportIds(bookIds);
			else await library.exportSelected();
			notify($_('notifications.booksExported', { count }));
			return true;
		} catch (error) {
			console.error('Export failed:', error);
			notify(exportErrorMessage(error));
			return false;
		}
	}

	/** «Exportar M livros» of the header: the books with news. The user's selection stays as it is. */
	async function handleExportNew() {
		exported = await handleExport(newBookIds);
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
		exported = false;
		openedBookId = book.id;
		library.openBook(book.id);
		library.setUiState('book-details');
	}

	function handleCloseBookDetails() {
		library.closeBook();
		library.setUiState('library');
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
		if (unknownDevice || (updater.state !== 'idle' && updater.state !== 'restartPending')) return;
		if (event.key === 'Escape') {
			if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
		} else if (event.code !== 'BracketLeft' || !event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
			return;
		}
		event.preventDefault();
		handleCloseBookDetails();
	}

	/** ⌘R, ⌘E, ⌘1 and ⌘2, the shortcuts of the bar's tooltips: not in the native menu until Phase 6. */
	function handleShortcut(event: KeyboardEvent) {
		handleBackKey(event);
		if (!event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
		// The physical key: Caps Lock or another layout changes `key`, never `code`
		const key = { KeyR: 'r', KeyE: 'e', Digit1: '1', Digit2: '2' }[event.code];
		if (!key) return;
		// A held key repeats; none of these is meant to
		if (event.repeat) return;
		const target = event.target instanceof Element ? event.target : null;
		// A text field keeps its keys; a modal window owns the keyboard
		if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
		if (unknownDevice || (updater.state !== 'idle' && updater.state !== 'restartPending')) return;

		const inLibrary = library.uiState === 'library';
		// In a book only ⌘E works: it exports that book
		// With no Library open, ⌘R still asks about a Kobo that was declined
		const asksAgain = key === 'r' && library.uiState === 'no-device' && library.declinedKobo;
		if (!inLibrary && !(detailBook && key === 'e') && !asksAgain) return;
		event.preventDefault();

		// While a Sync runs only the views switch: Sync and Export wait for its end
		if (key === 'r') {
			if (library.canSync && !library.isImporting) handleSync();
		} else if (key === 'e') {
			if (!library.isImporting) handleBarExport();
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
				canDelete={false}
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
					books={sortedBooks}
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

<UpdateDialog {isBusy} />

<div aria-live="polite" class="sr-only" data-testid="sync-announcer">{syncAnnouncement}</div>
