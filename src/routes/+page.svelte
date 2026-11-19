<script lang="ts">
	import { onMount } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { events } from '$lib/bindings';
	import LibraryView from '$lib/components/LibraryView.svelte';
	import BookDetailsView from '$lib/components/BookDetailsView.svelte';
	import EmptyStateNoDevice from '$lib/components/EmptyStateNoDevice.svelte';
	import ImportingState from '$lib/components/ImportingState.svelte';
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

	// Local state
	/** A connected Kobo with no Reader yet: asked before any Sync (R7). */
	let unknownDevice = $state<KoboDevice | null>(null);
	/** A failed Sync, until the next one: the Library header's `erro` state. */
	let syncFailed = $state(false);
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
		if (syncFailed) return { kind: 'erro', message: '' };
		if (library.books.length === 0) return null;
		if (newHighlights > 0) {
			return { kind: 'novos', highlights: newHighlights, books: newBookIds.length, since: library.summary?.newSince };
		}
		return { kind: 'semNovidades', syncedAt: library.summary?.lastSyncAt };
	});
	/** The book on screen in the detail, never while a Sync replaces the content. */
	const detailBook = $derived(!library.isImporting && library.uiState === 'book-details' ? library.viewingBook : undefined);

	// Event unlisten functions for cleanup
	let unlistenDeviceDetected: UnlistenFn | undefined;
	let unlistenDeviceDisconnected: UnlistenFn | undefined;
	let unlistenCheckForUpdates: UnlistenFn | undefined;
	let unlistenSyncProgress: UnlistenFn | undefined;
	let unlistenSyncFinished: UnlistenFn | undefined;
	let unlistenReadersChanged: UnlistenFn | undefined;

	// Sort books based on selected option
	let sortedBooks = $derived(
		[...library.books].sort((a, b) => {
			switch (sortBy) {
				case 'title':
					return (a.title || '').localeCompare(b.title || '');
				case 'author':
					return (a.author || '').localeCompare(b.author || '');
				case 'date_last_read':
					return (b.dateLastRead || '').localeCompare(a.dateLastRead || '');
				case 'highlight_count':
					return (b.highlights?.length || 0) - (a.highlights?.length || 0);
				default:
					return 0;
			}
		})
	);

	// The native menu speaks the interface's language: rebuilt when it changes
	$effect(() => {
		const format = $_;
		const timer = setTimeout(() => createApplicationMenu(format, () => library.activeReaderId), 500);
		return () => clearTimeout(timer);
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
					library.openReader(event.payload.readerId).catch((e) => console.error(e));
				}
			});

			// The Library stays on screen without the Kobo (R17)
			unlistenDeviceDisconnected = await events.deviceDisconnected.listen(() => {
				console.log('Device disconnected');
				syncFailed = false;
				library.deviceDisconnected();
			});
		} catch (error) {
			console.error('Failed to setup device listeners:', error);
		}
	}

	/** Shows the Library when a Reader is open, the empty state otherwise. */
	function showLibraryOrEmpty() {
		library.setUiState(library.activeReaderId !== null ? 'library' : 'no-device');
	}

	/** A Kobo was connected: ask whose it is if unknown (R7), else sync
	 * when «Sincronizar ao ligar» is on (R6). */
	async function handleDeviceConnected(device: KoboDevice) {
		try {
			const outcome = await library.deviceConnected(device, settings.uiPreferences.syncOnConnect ?? true);
			if (outcome === 'unknown' && device.serialNumber) unknownDevice = device;
			if (outcome === 'synced') {
				syncFailed = false;
				exported = false;
			}
		} catch (error) {
			console.error('Sync on connect failed:', error);
			syncFailed = true;
		}
		showLibraryOrEmpty();
	}

	/** «Sincronizar» in the toolbar (R6). */
	async function handleSync() {
		syncFailed = false;
		exported = false;
		try {
			await library.sync();
		} catch (error) {
			console.error('Sync failed:', error);
			syncFailed = true;
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
		unknownDevice = null;
		try {
			await library.associateKobo(device.serialNumber, readerId);
		} catch (error) {
			console.error('Failed to associate the Kobo:', error);
			notify($_('notifications.associateKoboError'));
			showLibraryOrEmpty();
			return;
		}
		try {
			await library.openReader(readerId);
			await handleDeviceConnected(device);
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
		syncFailed = false;
		exported = false;
		openedBookId = null;
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

	/** The only way into a book: a click and Enter in the grid, and a click in the list. */
	function openBook(book: Book) {
		exported = false;
		openedBookId = book.id;
		library.openBook(book.id);
		library.setUiState('book-details');
	}

	function handleBookClick(book: Book, event: MouseEvent) {
		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		const isShift = event.shiftKey;

		if (!isCtrlOrCmd && !isShift) openBook(book);
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
		settings.persist({ librarySort: sort }).catch((error) => console.error('Failed to save the sort:', error));
	}

	function handleViewModeChange(mode: ViewMode) {
		settings.setViewMode(mode);
		settings.persist({ libraryViewMode: mode }).catch((error) => console.error('Failed to save the view:', error));
	}

	/** ⌘R, ⌘E, ⌘1 and ⌘2, the shortcuts of the bar's tooltips: not in the native menu until Phase 6. */
	function handleShortcut(event: KeyboardEvent) {
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
		if (library.isImporting) return;

		const inLibrary = library.uiState === 'library';
		// In a book only ⌘E works: it exports that book
		if (!inLibrary && !(detailBook && key === 'e')) return;
		event.preventDefault();

		if (key === 'r') {
			if (library.canSync) handleSync();
		} else if (key === 'e') {
			handleBarExport();
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
				onback={handleCloseBookDetails}
				exportCount={1}
				onexport={handleBarExport}
				canDelete={false}
			/>
		{:else}
			<WindowBar
				screen="library"
				readers={library.readers}
				activeReaderId={library.activeReaderId}
				onselectReader={(id) => handleSelectReader(Number(id))}
				view={viewMode}
				onview={handleViewModeChange}
				sort={sortBy}
				onsort={handleSortChange}
				syncing={library.isImporting}
				syncDisabledReason={library.canSync || library.isImporting ? undefined : $_('screens.library.syncDisabledReason')}
				onsync={handleSync}
				exportCount={library.selectedBookIds.length || library.books.length}
				onexport={handleBarExport}
			/>
		{/if}

		<main class="flex-1 relative overflow-hidden flex flex-col">
			{#if library.isImporting}
				<ImportingState progress={library.syncProgress} />
			{:else if library.uiState === 'no-device'}
				<EmptyStateNoDevice />
			{:else if library.uiState === 'book-details' && library.viewingBook}
				<BookDetailsView book={library.viewingBook} onClose={handleCloseBookDetails} onNotification={showNotification} />
			{:else if library.uiState === 'library'}
				<LibraryView
					books={sortedBooks}
					selectedBookIds={library.selectedBookIds}
					{viewMode}
					onSelectionChange={handleSelectionChange}
					onBookClick={handleBookClick}
					onBookOpen={openBook}
					initialActiveId={openedBookId}
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
		device={unknownDevice}
		readers={library.readers}
		onChoose={handleChooseReader}
		onCreate={handleCreateReader}
	/>
{/if}

<UpdateDialog {isBusy} />
