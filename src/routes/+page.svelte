<script lang="ts">
	import { onMount } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import LibraryToolbar from '$lib/components/LibraryToolbar.svelte';
	import LibraryView from '$lib/components/LibraryView.svelte';
	import BookDetailsView from '$lib/components/BookDetailsView.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyStateNoDevice from '$lib/components/EmptyStateNoDevice.svelte';
	import ImportingState from '$lib/components/ImportingState.svelte';
	import { _ } from '$lib/i18n';
	import { library } from '$lib/stores/library.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { Book, KoboDevice } from '$lib/types';
	import { createApplicationMenu } from '$lib/menu';

	// Local state for UI components
	let showSettings = $state(false);
	let viewMode = $state<'grid' | 'list'>('grid');
	let sortBy = $state('title-asc');

	// Event unlisten functions for cleanup
	let unlistenDeviceDetected: UnlistenFn | undefined;
	let unlistenDeviceDisconnected: UnlistenFn | undefined;
	let unlistenSettings: UnlistenFn | undefined;

	// Notification state for export
	let exportNotification = $state<{
		message: string;
		type: 'success' | 'error';
		visible: boolean;
	} | null>(null);

	// Sort books based on selected option
	let sortedBooks = $derived(
		[...library.books].sort((a, b) => {
			switch (sortBy) {
				case 'title-asc':
					return (a.title || '').localeCompare(b.title || '');
				case 'title-desc':
					return (b.title || '').localeCompare(a.title || '');
				case 'author-asc':
					return (a.author || '').localeCompare(b.author || '');
				case 'author-desc':
					return (b.author || '').localeCompare(a.author || '');
				case 'recent':
					return (b.dateLastRead || '').localeCompare(a.dateLastRead || '');
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

		// Initial device scan
		handleScanForDevice();

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
			unlistenDeviceDetected = await listen<{ device: KoboDevice }>(
				'device-detected',
				(event) => {
					console.log('Device detected:', event.payload);
					const device = event.payload.device;
					library.setConnectedDevice(device);

					// Check if auto-import should happen
					const autoImportEnabled = settings.uiPreferences.autoImportOnConnect ?? true;

					if (autoImportEnabled && library.shouldAutoImport(device)) {
						library.setUiState('importing');
						handleAutoImport(device);
					} else {
						library.setUiState('library');
					}
				}
			);

			// Listen for device disconnected events
			unlistenDeviceDisconnected = await listen<void>('device-disconnected', () => {
				console.log('Device disconnected');
				library.setConnectedDevice(undefined);
				library.setUiState('no-device');
			});
		} catch (error) {
			console.error('Failed to setup device listeners:', error);
		}
	}

	async function handleAutoImport(device: KoboDevice) {
		console.log('Auto-importing from device:', device);
		try {
			await handleImport();
			library.markImportComplete(device.serialNumber || 'unknown');
			library.setUiState('library');
		} catch (error) {
			console.error('Auto-import failed:', error);
			library.setUiState('no-device');
		}
	}

	async function handleScanForDevice() {
		const device = await library.scanForDevice();
		if (device) {
			const autoImportEnabled = settings.uiPreferences.autoImportOnConnect ?? true;

			if (autoImportEnabled && library.shouldAutoImport(device)) {
				library.setUiState('importing');
				await handleAutoImport(device);
			} else {
				library.setUiState('library');
			}
		}
	}

	async function handleImport() {
		try {
			const importedBooks = await library.importHighlights();
			if (library.connectedDevice) {
				library.markImportComplete(library.connectedDevice.serialNumber || 'unknown');
			}
			return importedBooks;
		} catch (error) {
			console.error('Import failed:', error);
			throw error;
		}
	}

	async function handleExportAll() {
		library.setSelectedBookIds(library.books.map((b) => b.contentId));
		await handleExport();
	}

	async function handleExportSelected() {
		await handleExport();
	}

	async function handleExport() {
		try {
			const exportPath = settings.exportConfig.exportPath;
			await library.exportBooks(exportPath);
			showNotification($_('notifications.exportSuccess'), 'success');
		} catch (error) {
			console.error('Export failed:', error);
			const errorMessage = error instanceof Error ? error.message : 'Export failed';
			showNotification(`Export failed: ${errorMessage}`, 'error');
		}
	}

	function handleSelectionChange(newSelection: string[]) {
		library.setSelectedBookIds(newSelection);
	}

	function handleClearSelection() {
		library.setSelectedBookIds([]);
	}

	function handleBookClick(book: Book, event: MouseEvent) {
		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		const isShift = event.shiftKey;

		if (!isCtrlOrCmd && !isShift) {
			library.setViewingBookId(book.contentId);
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

	function showNotification(message: string, type: 'success' | 'error') {
		exportNotification = { message, type, visible: true };
		setTimeout(() => {
			if (exportNotification) {
				exportNotification.visible = false;
			}
		}, 5000);
	}
</script>

<!-- Notificações globais -->
{#if exportNotification?.visible}
	<div 
		class="fixed top-4 right-4 z-[1000] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg animate-in fade-in slide-in-from-right duration-300 max-sm:left-4 {exportNotification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}" 
		role="status" 
		aria-live="polite"
	>
		<div class="flex items-center gap-2">
			<svg
				class="w-5 h-5 shrink-0"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				{#if exportNotification.type === 'success'}
					<path
						d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
						fill="currentColor"
					/>
				{:else}
					<path
						d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
						fill="currentColor"
					/>
				{/if}
			</svg>
			<span class="text-sm font-medium">{exportNotification.message}</span>
		</div>
		<button
			type="button"
			class="flex items-center justify-center w-6 h-6 p-0 bg-white/20 hover:bg-white/30 border-none rounded-md color-white cursor-pointer transition-colors"
			onclick={() => exportNotification && (exportNotification.visible = false)}
			aria-label="Close notification"
		>
			<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
				<path
					d="M18 6L6 18M6 6l12 12"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
				/>
			</svg>
		</button>
	</div>
{/if}

<!-- Conteúdo principal -->
<div class="flex flex-col h-screen bg-white dark:bg-neutral-900 overflow-hidden">
	<!-- Header ÚNICO e GLOBAL -->
	<header class="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 shrink-0 bg-white dark:bg-neutral-900 z-30">
		<h1 class="m-0 text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 font-['Geist']">khi</h1>
	</header>

	<main class="flex-1 relative overflow-hidden flex flex-col">
		{#if library.uiState === 'no-device'}
			<EmptyStateNoDevice />
		{:else if library.uiState === 'importing'}
			<ImportingState />
		{:else if library.uiState === 'book-details' && library.viewingBook}
			<BookDetailsView book={library.viewingBook} onClose={handleCloseBookDetails} />
		{:else if library.uiState === 'library'}
			<!-- Toolbar -->
			<LibraryToolbar
				selectedCount={library.selectedBookIds.length}
				{viewMode}
				{sortBy}
				onExportAll={handleExportAll}
				onExportSelected={handleExportSelected}
				onClearSelection={handleClearSelection}
				onSortChange={(sort) => (sortBy = sort)}
				onViewModeChange={(mode) => (viewMode = mode)}
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