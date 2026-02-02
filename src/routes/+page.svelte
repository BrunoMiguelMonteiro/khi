<script lang="ts">
	import { onMount } from 'svelte';
	import { listen, type UnlistenFn } from '@tauri-apps/api/event';
	import LibraryToolbar from '$lib/components/LibraryToolbar.svelte';
	import LibraryView from '$lib/components/LibraryView.svelte';
	import BookDetailsView from '$lib/components/BookDetailsView.svelte';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import EmptyStateNoDevice from '$lib/components/EmptyStateNoDevice.svelte';
	import ImportingState from '$lib/components/ImportingState.svelte';
	import { _ } from '$lib/i18n';
	import {
		getBooks,
		getSelectedBookIds,
		getIsImporting,
		getImportProgress,
		getConnectedDevice,
		getViewingBook,
		getViewingBookId,
		getUiState,
		setSelectedBookIds,
		setViewingBookId,
		setConnectedDevice,
		setUiState,
		markImportComplete,
		shouldAutoImport,
		scanForDevice,
		importHighlights,
		exportBooks
	} from '$lib/stores/library.svelte';
	import { getExportConfig, getSettings } from '$lib/stores/settings.svelte';
	import type { Book, KoboDevice } from '$lib/types';

	// Local state for UI
	let books = $state<Book[]>([]);
	let selectedBookIds = $state<string[]>([]);
	let isImporting = $state(false);
	let importProgress = $state<{ currentBook: string; percentage: number } | undefined>(undefined);
	let connectedDevice = $state<{ name: string; path: string } | undefined>(undefined);
	let showDeviceNotification = $state(false);
	let viewingBook = $state<Book | undefined>(undefined);
	let showSettings = $state(false);
	let viewMode = $state<'grid' | 'list'>('grid');
	let sortBy = $state('title-asc');

	// Local UI state
	let uiState = $state<'no-device' | 'importing' | 'library' | 'book-details'>('no-device');

	// Event unlisten functions for cleanup
	let unlistenDeviceDetected: UnlistenFn | undefined;
	let unlistenDeviceDisconnected: UnlistenFn | undefined;

	// Notification state for export
	let exportNotification = $state<{
		message: string;
		type: 'success' | 'error';
		visible: boolean;
	} | null>(null);

	// Sort books based on selected option
	let sortedBooks = $derived(
		[...books].sort((a, b) => {
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
		books = getBooks();
		selectedBookIds = getSelectedBookIds();
		isImporting = getIsImporting();
		importProgress = getImportProgress();
		connectedDevice = getConnectedDevice();
		viewingBook = getViewingBook();
		uiState = getUiState();

		// Setup event listeners for device monitoring
		setupDeviceListeners();

		// Initial device scan
		handleScanForDevice();

		// Cleanup on unmount
		return () => {
			unlistenDeviceDetected?.();
			unlistenDeviceDisconnected?.();
		};
	});

	async function setupDeviceListeners() {
		try {
			// Listen for device detected events
			unlistenDeviceDetected = await listen<{ device: KoboDevice }>(
				'device-detected',
				(event) => {
					console.log('Device detected:', event.payload);
					const device = event.payload.device;
					setConnectedDevice(device);
					connectedDevice = device;

					// Check if auto-import should happen
					const settings = getSettings();
					const autoImportEnabled = settings.uiPreferences.autoImportOnConnect ?? true;

					if (autoImportEnabled && shouldAutoImport(device)) {
						// Will auto-import: set UI to importing state
						setUiState('importing');
						uiState = 'importing';
						handleAutoImport(device);
					} else {
						// Won't auto-import: go directly to library view
						setUiState('library');
						uiState = 'library';
						showDeviceNotification = true;
						setTimeout(() => {
							showDeviceNotification = false;
						}, 5000);
					}
				}
			);

			// Listen for device disconnected events
			unlistenDeviceDisconnected = await listen<void>('device-disconnected', () => {
				console.log('Device disconnected');
				setConnectedDevice(undefined);
				connectedDevice = undefined;
				// When device disconnects, return to no-device state
				setUiState('no-device');
				uiState = 'no-device';
			});
		} catch (error) {
			console.error('Failed to setup device listeners:', error);
		}
	}

	async function handleAutoImport(device: KoboDevice) {
		console.log('Auto-importing from device:', device);
		try {
			await handleImport();
			// Mark import complete with device serial if available
			markImportComplete(device.serialNumber || 'unknown');
		} catch (error) {
			console.error('Auto-import failed:', error);
			// Reset to no-device state on failure
			setUiState('no-device');
			uiState = 'no-device';
		}
	}

	async function handleScanForDevice() {
		const device = await scanForDevice();
		if (device) {
			showDeviceNotification = true;
			setTimeout(() => {
				showDeviceNotification = false;
			}, 5000);
		}
	}

	async function handleImport() {
		try {
			const importedBooks = await importHighlights();
			// Refresh books after import
			books = getBooks();
			isImporting = getIsImporting();
			importProgress = getImportProgress();

			// Mark import as complete
			const device = getConnectedDevice();
			if (device) {
				markImportComplete(device.serialNumber || 'unknown');
			}

			return importedBooks;
		} catch (error) {
			console.error('Import failed:', error);
			throw error;
		}
	}

	async function handleExportAll() {
		console.log('[EXPORT] Exportando todos os livros');
		selectedBookIds = books.map((b) => b.contentId);
		setSelectedBookIds(selectedBookIds);
		await handleExport();
	}

	async function handleExportSelected() {
		console.log('[EXPORT] Exportando livros selecionados:', selectedBookIds.length);
		await handleExport();
	}

	async function handleExport() {
		console.log('[EXPORT FRONTEND] ==========================================');
		console.log('[EXPORT FRONTEND] Botão Export clicado');
		console.log('[EXPORT FRONTEND] Livros selecionados:', selectedBookIds.length);
		console.log('[EXPORT FRONTEND] IDs selecionados:', selectedBookIds);

		try {
			console.log('[EXPORT FRONTEND] A obter export path das settings...');
			const exportConfig = getExportConfig();
			const exportPath = exportConfig.exportPath;
			console.log('[EXPORT FRONTEND] ✅ Path obtido das settings:', exportPath);

			console.log('[EXPORT FRONTEND] A chamar exportBooks()...');
			const exportedFiles = await exportBooks(exportPath);
			console.log('[EXPORT FRONTEND] ✅ Sucesso! Ficheiros exportados:', exportedFiles);
			console.log('[EXPORT FRONTEND] ==========================================');
			showNotification(
				`${exportedFiles.length} book${exportedFiles.length === 1 ? '' : 's'} exported successfully!`,
				'success'
			);
		} catch (error) {
			console.error('[EXPORT FRONTEND] ❌ ERRO CAPTURADO:', error);
			console.error('[EXPORT FRONTEND] Tipo do erro:', typeof error);
			if (error instanceof Error) {
				console.error('[EXPORT FRONTEND] Message:', error.message);
				console.error('[EXPORT FRONTEND] Stack:', error.stack);
			}
			console.error('[EXPORT FRONTEND] ==========================================');
			const errorMessage = error instanceof Error ? error.message : 'Export failed';
			showNotification(`Export failed: ${errorMessage}`, 'error');
		}
	}

	function handleSelectionChange(newSelection: string[]) {
		selectedBookIds = newSelection;
		setSelectedBookIds(newSelection);
	}

	function handleClearSelection() {
		selectedBookIds = [];
		setSelectedBookIds([]);
	}

	function handleBookClick(book: Book, event: MouseEvent) {
		// If single click without modifiers, open book details
		const isCtrlOrCmd = event.ctrlKey || event.metaKey;
		const isShift = event.shiftKey;

		if (!isCtrlOrCmd && !isShift) {
			// Single selection - open book details
			setViewingBookId(book.contentId);
			viewingBook = getViewingBook();
			setUiState('book-details');
			uiState = 'book-details';
			showSettings = false;
		}
	}

	function handleCloseBookDetails() {
		setViewingBookId(null);
		viewingBook = undefined;
		setUiState('library');
		uiState = 'library';
	}

	function handleOpenSettings() {
		showSettings = true;
	}

	function handleCloseSettings() {
		showSettings = false;
	}

	// Notification helper function
	function showNotification(message: string, type: 'success' | 'error') {
		exportNotification = { message, type, visible: true };
		// Auto-hide after 5 seconds
		setTimeout(() => {
			if (exportNotification) {
				exportNotification.visible = false;
			}
		}, 5000);
	}
</script>

<!-- Notificações globais -->
{#if showDeviceNotification}
	<div class="device-notification" role="status" aria-live="polite">
		<div class="notification-content">
			<svg
				class="notification-icon"
				viewBox="0 0 24 24"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				aria-hidden="true"
			>
				<path
					d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
					fill="currentColor"
				/>
			</svg>
			<span class="notification-text">{$_('notifications.deviceReady')}</span>
		</div>
		<button
			type="button"
			class="notification-close"
			onclick={() => (showDeviceNotification = false)}
			aria-label={$_('notifications.close')}
		>
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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

{#if exportNotification?.visible}
	<div class="export-notification {exportNotification.type}" role="status" aria-live="polite">
		<div class="notification-content">
			<svg
				class="notification-icon"
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
			<span class="notification-text">{exportNotification.message}</span>
		</div>
		<button
			type="button"
			class="notification-close"
			onclick={() => exportNotification && (exportNotification.visible = false)}
			aria-label="Close notification"
		>
			<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
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
{#if uiState === 'no-device'}
	<EmptyStateNoDevice />
{:else if uiState === 'importing'}
	<ImportingState />
{:else if uiState === 'book-details' && viewingBook}
	<BookDetailsView book={viewingBook} onClose={handleCloseBookDetails} />
{:else if uiState === 'library'}
	<!-- Books Library Screen -->
	<div class="screen">
		<!-- Header -->
		<header class="library-header">
			<h1 class="brand">khi</h1>
		</header>

		<!-- Toolbar -->
		<LibraryToolbar
			selectedCount={selectedBookIds.length}
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
			{selectedBookIds}
			{viewMode}
			onSelectionChange={handleSelectionChange}
			onBookClick={handleBookClick}
			onBooksImport={handleImport}
			{isImporting}
			{importProgress}
		/>
	</div>
{/if}

<!-- Settings Modal (overlay) -->
{#if showSettings}
	<SettingsPanel onClose={handleCloseSettings} />
{/if}

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: var(
			--font-sans,
			-apple-system,
			BlinkMacSystemFont,
			'Segoe UI',
			Roboto,
			sans-serif
		);
	}

	.screen {
		min-height: 100vh;
		background-color: var(--surface-primary);
		display: flex;
		flex-direction: column;
	}

	.library-header {
		padding: 16px 24px;
		border-bottom: 1px solid var(--border-default);
		background-color: var(--surface-primary);
	}

	.brand {
		font-size: 24px;
		font-weight: 700;
		letter-spacing: -0.025em;
		color: var(--text-primary);
		margin: 0;
	}

	/* Device Notification */
	.device-notification {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background-color: #16a34a;
		color: white;
		border-radius: 8px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
		animation: slideIn 0.3s ease;
	}

	@keyframes slideIn {
		from {
			transform: translateX(100%);
			opacity: 0;
		}
		to {
			transform: translateX(0);
			opacity: 1;
		}
	}

	.notification-content {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.notification-icon {
		width: 20px;
		height: 20px;
		flex-shrink: 0;
	}

	.notification-text {
		font-size: 14px;
		font-weight: 500;
	}

	.notification-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		padding: 0;
		background: rgba(255, 255, 255, 0.2);
		border: none;
		border-radius: 6px;
		color: white;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.notification-close:hover {
		background: rgba(255, 255, 255, 0.3);
	}

	.notification-close svg {
		width: 16px;
		height: 16px;
	}

	/* Export Notification */
	.export-notification {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		border-radius: 8px;
		box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
		animation: slideIn 0.3s ease;
	}

	.export-notification.success {
		background-color: #16a34a;
		color: white;
	}

	.export-notification.error {
		background-color: #dc2626;
		color: white;
	}

	/* Responsive */
	@media (max-width: 640px) {
		.device-notification,
		.export-notification {
			left: 16px;
			right: 16px;
		}

		.library-header {
			padding: 16px;
		}
	}
</style>
