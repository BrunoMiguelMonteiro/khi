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

	async function handleDeviceConnected(device: KoboDevice) {
		library.setConnectedDevice(device);
		const autoImportEnabled = settings.uiPreferences.syncOnConnect ?? true;

		if (autoImportEnabled && library.shouldAutoImport(device)) {
			library.setUiState('importing');
			await handleAutoImport(device);
		} else {
			showLibraryOrEmpty();
		}
	}

	async function handleAutoImport(device: KoboDevice) {
		console.log('Auto-importing from device:', device);
		try {
			await handleImport();
			library.markImportComplete(device.serialNumber || 'unknown');
		} catch (error) {
			console.error('Auto-import failed:', error);
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

	async function handleImport() {
		return library.importHighlights();
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
		</div>
		<InlineNotification message={notification?.message ?? null} type={notification?.type ?? 'success'} />
	</header>

	<main class="flex-1 relative overflow-hidden flex flex-col">
		{#if library.uiState === 'no-device'}
			<EmptyStateNoDevice />
		{:else if library.uiState === 'importing'}
			<ImportingState />
		{:else if library.uiState === 'book-details' && library.viewingBook}
			<BookDetailsView book={library.viewingBook} onClose={handleCloseBookDetails} onNotification={showNotification} />
		{:else if library.uiState === 'library'}
			<!-- Toolbar -->
			<LibraryToolbar
				selectedCount={library.selectedBookIds.length}
				{viewMode}
				{sortBy}
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
				onBooksImport={handleImport}
				isImporting={library.isImporting}
				importProgress={library.importProgress}
			/>
		{/if}
	</main>
</div>

<!-- Settings Modal (overlay) -->
{#if showSettings}
	<Modal isOpen={showSettings} onClose={handleCloseSettings}>
		<SettingsPanel onClose={handleCloseSettings} />
	</Modal>
{/if}