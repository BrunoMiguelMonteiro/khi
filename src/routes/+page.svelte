<script lang="ts">
	import { onMount } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import { commands, events } from '$lib/bindings';
	import LibraryToolbar from '$lib/components/LibraryToolbar.svelte';
	import LibraryView from '$lib/components/LibraryView.svelte';
	import BookDetailsView from '$lib/components/BookDetailsView.svelte';
	import EmptyStateNoDevice from '$lib/components/EmptyStateNoDevice.svelte';
	import ImportingState from '$lib/components/ImportingState.svelte';
	import InlineNotification from '$lib/components/InlineNotification.svelte';
	import UnknownKoboDialog from '$lib/components/UnknownKoboDialog.svelte';
	import ReaderPicker from '$lib/components/ReaderPicker.svelte';
	import { _ } from '$lib/i18n';
	import { exportErrorMessage } from '$lib/errors';
	import { library } from '$lib/stores/library.svelte';
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
	let notification = $state<{ message: string; type: 'success' | 'error' } | null>(null);
	let notificationTimer: ReturnType<typeof setTimeout> | undefined;

	function showNotification(message: string, type: 'success' | 'error') {
		notification = { message, type };
		clearTimeout(notificationTimer);
		notificationTimer = setTimeout(() => { notification = null; }, 4000);
	}

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
		} catch (error) {
			console.error('Sync on connect failed:', error);
			showNotification($_('notifications.syncError'), 'error');
		}
		showLibraryOrEmpty();
	}

	/** «Sincronizar» in the toolbar (R6). */
	async function handleSync() {
		try {
			await library.sync();
		} catch (error) {
			console.error('Sync failed:', error);
			showNotification($_('notifications.syncError'), 'error');
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
			showNotification($_('notifications.associateKoboError'), 'error');
			showLibraryOrEmpty();
			return;
		}
		try {
			await library.openReader(readerId);
			await handleDeviceConnected(device);
		} catch (error) {
			console.error('Failed to open the reader:', error);
			showNotification($_('notifications.openReaderError'), 'error');
			showLibraryOrEmpty();
		}
	}

	async function handleCreateReader(name: string) {
		try {
			const reader = await library.createReader(name);
			await handleChooseReader(reader.id);
		} catch (error) {
			console.error('Failed to create the reader:', error);
			showNotification($_('notifications.createReaderError'), 'error');
		}
	}

	async function handleSelectReader(readerId: number) {
		try {
			await library.openReader(readerId);
		} catch (error) {
			console.error('Failed to open the reader:', error);
			showNotification($_('notifications.openReaderError'), 'error');
		}
		showLibraryOrEmpty();
	}

	async function handleExportAll() {
		library.setSelectedBookIds(library.books.map((b) => b.id));
		await handleExport();
	}

	async function handleExportSelected() {
		await handleExport();
	}

	async function handleExport() {
		try {
			await library.exportSelected();
			showNotification($_('notifications.exportSuccess'), 'success');
		} catch (error) {
			console.error('Export failed:', error);
			showNotification(exportErrorMessage(error), 'error');
		}
	}

	function handleSelectionChange(newSelection: number[]) {
		library.setSelectedBookIds(newSelection);
	}

	function handleClearSelection() {
		library.setSelectedBookIds([]);
	}

	function handleBookClick(book: Book, event: MouseEvent) {
		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		const isShift = event.shiftKey;

		if (!isCtrlOrCmd && !isShift) {
			library.openBook(book.id);
			library.setUiState('book-details');
		}
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

	/** The gear opens the Settings window, like ⌘, in the menu. */
	function handleOpenSettings() {
		commands.openSettings($_('settings.windowTitle'), library.activeReaderId).catch((error) =>
			console.error('Failed to open settings:', error)
		);
	}

</script>

<!-- Conteúdo principal -->
<div class="flex flex-col h-screen bg-white dark:bg-neutral-900 overflow-hidden">
	<!-- Header ÚNICO e GLOBAL -->
	<header class="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-900 z-30">
		<div class="flex items-center gap-3">
			<h1 class="m-0 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-['Geist']">khi</h1>
			<span class="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400" data-testid="kobo-indicator">
				<span
					class="w-2 h-2 rounded-full {library.connectedDevice ? 'bg-green-500' : 'bg-neutral-300 dark:bg-neutral-600'}"
					aria-hidden="true"
				></span>
				{library.connectedDevice ? $_('screens.library.koboConnected') : $_('screens.library.koboDisconnected')}
			</span>
			<ReaderPicker readers={library.readers} activeReaderId={library.activeReaderId} onSelect={handleSelectReader} />
		</div>
		<InlineNotification message={notification?.message ?? null} type={notification?.type ?? 'success'} />
	</header>

	<main class="flex-1 relative overflow-hidden flex flex-col">
		{#if library.isImporting}
			<ImportingState progress={library.syncProgress} />
		{:else if library.uiState === 'no-device'}
			<EmptyStateNoDevice />
		{:else if library.uiState === 'book-details' && library.viewingBook}
			<BookDetailsView book={library.viewingBook} onClose={handleCloseBookDetails} onNotification={showNotification} />
		{:else if library.uiState === 'library'}
			<!-- Toolbar -->
			<LibraryToolbar
				selectedCount={library.selectedBookIds.length}
				{viewMode}
				{sortBy}
				canSync={library.canSync}
				onSync={handleSync}
				onExportAll={handleExportAll}
				onExportSelected={handleExportSelected}
				onClearSelection={handleClearSelection}
				onSortChange={(sort) => handleSortChange(sort as SortPreference)}
				onViewModeChange={handleViewModeChange}
				onOpenSettings={handleOpenSettings}
			/>

			<!-- Content -->
			<LibraryView
				books={sortedBooks}
				selectedBookIds={library.selectedBookIds}
				{viewMode}
				onSelectionChange={handleSelectionChange}
				onBookClick={handleBookClick}
				onBooksImport={library.canSync ? handleSync : undefined}
			/>
		{/if}
	</main>
</div>

{#if unknownDevice}
	<UnknownKoboDialog
		device={unknownDevice}
		readers={library.readers}
		onChoose={handleChooseReader}
		onCreate={handleCreateReader}
	/>
{/if}

<UpdateDialog {isBusy} />
