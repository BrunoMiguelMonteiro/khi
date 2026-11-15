<script lang="ts">
	import { onMount } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import { events } from '$lib/bindings';
	import LibraryToolbar from '$lib/components/LibraryToolbar.svelte';
	import LibraryView from '$lib/components/LibraryView.svelte';
	import BookDetailsView from '$lib/components/BookDetailsView.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyStateNoDevice from '$lib/components/EmptyStateNoDevice.svelte';
	import ImportingState from '$lib/components/ImportingState.svelte';
	import InlineNotification from '$lib/components/InlineNotification.svelte';
	import UnknownKoboDialog from '$lib/components/UnknownKoboDialog.svelte';
	import ReaderPicker from '$lib/components/ReaderPicker.svelte';
	import { _ } from '$lib/i18n';
	import { library } from '$lib/stores/library.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { Book, KoboDevice } from '$lib/types';
	import { createApplicationMenu } from '$lib/menu';

	// Sync with store
	let viewMode = $derived(settings.uiPreferences.libraryViewMode);
	let sortBy = $derived(settings.uiPreferences.librarySort);

	// Local state
	let showSettings = $state(false);
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
	let unlistenSettings: UnlistenFn | undefined;
	let unlistenSyncProgress: UnlistenFn | undefined;
	let unlistenSyncFinished: UnlistenFn | undefined;

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

	// Sync with store on mount
	onMount(() => {
		// Initialize application menu with current locale
		setTimeout(() => {
			createApplicationMenu($_);
		}, 500);

		// Setup event listeners for device monitoring
		setupDeviceListeners();

		// Open the Library, then look for a Kobo
		handleStartup();

		// Cleanup on unmount
		return () => {
			unlistenDeviceDetected?.();
			unlistenDeviceDisconnected?.();
			unlistenSettings?.();
			unlistenSyncProgress?.();
			unlistenSyncFinished?.();
		};
	});

	async function setupDeviceListeners() {
		try {
			// Listen for settings event from native menu
			unlistenSettings = await listen('open-settings', () => {
				showSettings = true;
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
			await library.openReader(readerId);
			await handleDeviceConnected(device);
		} catch (error) {
			console.error('Failed to associate the Kobo:', error);
			showNotification($_('notifications.syncError'), 'error');
			showLibraryOrEmpty();
		}
	}

	async function handleCreateReader(name: string) {
		try {
			const reader = await library.createReader(name);
			await handleChooseReader(reader.id);
		} catch (error) {
			console.error('Failed to create the reader:', error);
			showNotification($_('notifications.syncError'), 'error');
		}
	}

	async function handleSelectReader(readerId: number) {
		await library.openReader(readerId);
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
			const errorMessage = error instanceof Error ? error.message : 'Export failed';
			showNotification(`Export failed: ${errorMessage}`, 'error');
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
			library.setViewingBookId(book.id);
			library.setUiState('book-details');
			showSettings = false;
		}
	}

	function handleCloseBookDetails() {
		library.setViewingBookId(null);
		library.setUiState('library');
	}

	function handleOpenSettings() {
		showSettings = true;
	}

	function handleCloseSettings() {
		showSettings = false;
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
				onSortChange={(sort) => settings.setSortPreference(sort as any)}
				onViewModeChange={(mode) => settings.setViewMode(mode)}
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

<!-- Settings Modal (overlay) -->
{#if showSettings}
	<Modal isOpen={showSettings} onClose={handleCloseSettings}>
		<SettingsPanel onClose={handleCloseSettings} />
	</Modal>
{/if}