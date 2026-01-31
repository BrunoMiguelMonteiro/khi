<script lang="ts">
  import { onMount } from 'svelte';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import AppLayout from '$lib/components/AppLayout.svelte';
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
    updateHighlight,
    scanForDevice,
    importHighlights,
    exportBooks
  } from '$lib/stores/library.svelte';
  import { getExportConfig, getSettings } from '$lib/stores/settings.svelte';
  import type { Book, Highlight, KoboDevice } from '$lib/types';

  // Local state for UI
  let books = $state<Book[]>([]);
  let selectedBookIds = $state<string[]>([]);
  let isImporting = $state(false);
  let importProgress = $state<{ currentBook: string; percentage: number } | undefined>(undefined);
  let connectedDevice = $state<{ name: string; path: string } | undefined>(undefined);
  let showDeviceNotification = $state(false);
  let viewingBook = $state<Book | undefined>(undefined);
  let showSettings = $state(false);
  let uiState = $state<'no-device' | 'importing' | 'library' | 'book-details'>('no-device');
  
  // Event unlisten functions for cleanup
  let unlistenDeviceDetected: UnlistenFn | undefined;
  let unlistenDeviceDisconnected: UnlistenFn | undefined;
  
  // Notification state for export
  let exportNotification = $state<{ message: string; type: 'success' | 'error'; visible: boolean } | null>(null);

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
      unlistenDeviceDetected = await listen<KoboDevice>('device-detected', (event) => {
        console.log('Device detected:', event.payload);
        const device = event.payload;
        setConnectedDevice(device);
        uiState = getUiState();
        connectedDevice = device;
        
        // Check if auto-import should happen
        const settings = getSettings();
        const autoImportEnabled = settings.uiPreferences.autoImportOnConnect ?? true;
        
        if (autoImportEnabled && shouldAutoImport(device)) {
          handleAutoImport(device);
        } else {
          showDeviceNotification = true;
          setTimeout(() => {
            showDeviceNotification = false;
          }, 5000);
        }
      });

      // Listen for device disconnected events
      unlistenDeviceDisconnected = await listen<void>('device-disconnected', () => {
        console.log('Device disconnected');
        setConnectedDevice(undefined);
        uiState = getUiState();
        connectedDevice = undefined;
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
      uiState = getUiState();
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
        uiState = getUiState();
      }
      
      return importedBooks;
    } catch (error) {
      console.error('Import failed:', error);
      // TODO: Show error notification
      throw error;
    }
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
      showNotification(`${exportedFiles.length} book${exportedFiles.length === 1 ? '' : 's'} exported successfully!`, 'success');
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

  function handleBookClick(book: Book, event: MouseEvent) {
    // If single click without modifiers, open book details
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;
    
    if (!isCtrlOrCmd && !isShift) {
      // Single selection - open book details
      setViewingBookId(book.contentId);
      viewingBook = getViewingBook();
      showSettings = false;
    }
  }

  function handleCloseBookDetails() {
    setViewingBookId(null);
    viewingBook = undefined;
  }

  function handleUpdateHighlight(bookId: string, highlightId: string, updates: Partial<Highlight>) {
    updateHighlight(bookId, highlightId, updates);
    // Refresh viewing book
    viewingBook = getViewingBook();
    // Also refresh books list to reflect changes
    books = getBooks();
  }

  function handleToggleSettings() {
    showSettings = !showSettings;
    if (showSettings) {
      // Don't clear viewingBook, just overlay or replace
      // If we want to replace, we can do:
      // viewingBook = undefined; 
      // But keeping it might be nice to return to context.
      // However, the current layout logic below is exclusive (if/else if/else).
      // So if showSettings is true, it takes precedence.
    }
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

<AppLayout>
  {#snippet headerActions()}
    <button 
      class="icon-button" 
      class:active={showSettings}
      onclick={handleToggleSettings} 
      aria-label={$_('settings.title')}
      aria-pressed={showSettings}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
      </svg>
    </button>
  {/snippet}

  {#if showDeviceNotification}
    <div class="device-notification" role="status" aria-live="polite">
      <div class="notification-content">
        <svg class="notification-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
        </svg>
        <span class="notification-text">{$_('notifications.deviceReady')}</span>
      </div>
      <button
        type="button"
        class="notification-close"
        onclick={() => showDeviceNotification = false}
        aria-label={$_('notifications.close')}
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  {/if}

  {#if exportNotification?.visible}
    <div class="export-notification {exportNotification.type}" role="status" aria-live="polite">
      <div class="notification-content">
        <svg class="notification-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          {#if exportNotification.type === 'success'}
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
          {:else}
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" fill="currentColor"/>
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
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
  {/if}

  <div class="page-content">
    {#if showSettings}
      <div class="settings-container">
        <SettingsPanel onClose={() => showSettings = false} />
      </div>
    {:else if uiState === 'book-details' && viewingBook}
      <BookDetailsView
        book={viewingBook}
        onClose={handleCloseBookDetails}
        onUpdateHighlight={handleUpdateHighlight}
      />
    {:else if uiState === 'no-device'}
      <EmptyStateNoDevice />
    {:else if uiState === 'importing'}
      <ImportingState />
    {:else}
      <LibraryView
        {books}
        {selectedBookIds}
        onSelectionChange={handleSelectionChange}
        onBookClick={handleBookClick}
        onBooksImport={handleImport}
        onBooksExport={handleExport}
        {isImporting}
        {importProgress}
      />
    {/if}
  </div>
</AppLayout>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  }

  .page-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: calc(100vh - var(--header-height, 64px) - 57px);
  }

  .settings-container {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: var(--space-6, 24px);
    background-color: var(--surface-secondary, #f9fafb);
  }

  .icon-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: 1px solid transparent;
    border-radius: var(--radius-md, 6px);
    background: transparent;
    color: var(--text-secondary, #6b7280);
    cursor: pointer;
    transition: all 0.2s;
  }

  .icon-button:hover {
    background: var(--surface-tertiary, #f3f4f6);
    color: var(--text-primary, #111827);
  }

  .icon-button.active {
    background: var(--primary-50, #eff6ff);
    color: var(--primary-600, #2563eb);
    border-color: var(--primary-200, #bfdbfe);
  }

  /* Device Notification */

  .device-notification {
    position: fixed;
    top: calc(var(--header-height, 64px) + var(--space-4, 16px));
    right: var(--space-4, 16px);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    background-color: var(--color-success-600, #16a34a);
    color: white;
    border-radius: var(--radius-lg, 8px);
    box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
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
    gap: var(--space-2, 8px);
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
    border-radius: var(--radius-md, 6px);
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

  /* Responsive */
  @media (max-width: 640px) {
    .device-notification {
      left: var(--space-4, 16px);
      right: var(--space-4, 16px);
    }
  }

  /* Export Notification */
  .export-notification {
    position: fixed;
    top: calc(var(--header-height, 64px) + var(--space-4, 16px));
    right: var(--space-4, 16px);
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: var(--space-3, 12px);
    padding: var(--space-3, 12px) var(--space-4, 16px);
    border-radius: var(--radius-lg, 8px);
    box-shadow: var(--shadow-lg, 0 10px 15px -3px rgba(0, 0, 0, 0.1));
    animation: slideIn 0.3s ease;
  }

  .export-notification.success {
    background-color: var(--color-success-600, #16a34a);
    color: white;
  }

  .export-notification.error {
    background-color: var(--color-error-600, #dc2626);
    color: white;
  }

  @media (max-width: 640px) {
    .export-notification {
      left: var(--space-4, 16px);
      right: var(--space-4, 16px);
    }
  }
</style>
