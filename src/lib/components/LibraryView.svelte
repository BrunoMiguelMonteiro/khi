<script lang="ts">
  import type { Book } from '../types';
  import BookCard from './BookCard.svelte';
  import { _ } from '$lib/i18n';

  interface Props {
    books: Book[];
    selectedBookIds: string[];
    onSelectionChange: (selectedIds: string[]) => void;
    onBookClick?: (book: Book, event: MouseEvent) => void;
    onBooksImport?: () => void;
    onBooksExport?: () => void;
    isImporting?: boolean;
    importProgress?: { currentBook: string; percentage: number };
  }

  let {
    books,
    selectedBookIds,
    onSelectionChange,
    onBookClick,
    onBooksImport,
    onBooksExport,
    isImporting = false,
    importProgress
  }: Props = $props();

  let lastSelectedIndex = $state(-1);
  let hoveredBookId = $state<string | null>(null);

  function isSelected(bookId: string): boolean {
    return selectedBookIds.includes(bookId);
  }

  function handleBookClick(book: Book, index: number, event: MouseEvent) {
    event.preventDefault();
    
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    const isShift = event.shiftKey;

    if (isShift && lastSelectedIndex !== -1) {
      // Range selection
      const start = Math.min(lastSelectedIndex, index);
      const end = Math.max(lastSelectedIndex, index);
      const rangeIds = books.slice(start, end + 1).map(b => b.contentId);
      
      // Merge with existing selection if Ctrl/Cmd is held
      if (isCtrlOrCmd) {
        const newSelection = [...new Set([...selectedBookIds, ...rangeIds])];
        onSelectionChange(newSelection);
      } else {
        onSelectionChange(rangeIds);
      }
    } else if (isCtrlOrCmd) {
      // Toggle selection
      toggleSelection(book, index);
    } else {
      // Single selection / Open details
      if (onBookClick) {
        onBookClick(book, event);
      } else {
        onSelectionChange([book.contentId]);
      }
      lastSelectedIndex = index;
    }
  }

  function toggleSelection(book: Book, index: number) {
    if (isSelected(book.contentId)) {
      onSelectionChange(selectedBookIds.filter(id => id !== book.contentId));
    } else {
      onSelectionChange([...selectedBookIds, book.contentId]);
    }
    lastSelectedIndex = index;
  }

  function selectAll() {
    onSelectionChange(books.map(b => b.contentId));
  }

  function deselectAll() {
    onSelectionChange([]);
    lastSelectedIndex = -1;
  }

  function invertSelection() {
    const allIds = books.map(b => b.contentId);
    const inverted = allIds.filter(id => !selectedBookIds.includes(id));
    onSelectionChange(inverted);
  }

  let selectedCount = $derived(selectedBookIds.length);
  let totalCount = $derived(books.length);
</script>

<div class="library-view" data-testid="library-view">
  <header class="library-header">
    <div class="header-main">
      <div class="header-title-group">
        <h2 class="library-title">{$_('screens.library.title')}</h2>
        <span class="book-count">{$_('screens.library.booksCount', { count: totalCount })}</span>
      </div>
      
      <div class="selection-controls">
        <span class="selection-count" aria-live="polite" aria-atomic="true">
          {$_('screens.library.selectedCount', { count: selectedCount })}
        </span>
        <div class="control-group">
          <button 
            type="button" 
            class="control-btn" 
            onclick={selectAll} 
            disabled={isImporting || totalCount === 0}
            title={$_('screens.library.selectAllTitle')}
          >
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
              <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {$_('screens.library.selectAll')}
          </button>
          <button 
            type="button" 
            class="control-btn" 
            onclick={deselectAll} 
            disabled={isImporting || selectedCount === 0}
            title={$_('screens.library.clearTitle')}
          >
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/>
            </svg>
            {$_('screens.library.clear')}
          </button>
          <button 
            type="button" 
            class="control-btn" 
            onclick={invertSelection} 
            disabled={isImporting || totalCount === 0}
            title={$_('screens.library.invertTitle')}
          >
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {$_('screens.library.invert')}
          </button>
        </div>
      </div>
    </div>

    <div class="header-actions">
      {#if onBooksImport}
        <button 
          type="button" 
          class="action-btn import" 
          onclick={onBooksImport} 
          disabled={isImporting}
        >
          {#if isImporting}
            <svg class="btn-icon spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            {$_('screens.importing.title')}
          {:else}
            <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {$_('screens.library.import')}
          {/if}
        </button>
      {/if}
      {#if onBooksExport}
        <button
          type="button"
          class="action-btn export"
          onclick={onBooksExport}
          disabled={isImporting || selectedCount === 0}
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" transform="rotate(180 12 12)"/>
          </svg>
          {$_('screens.library.exportSelected')} ({selectedCount})
        </button>
      {/if}
    </div>
  </header>

  {#if isImporting && importProgress}
    <div class="progress-container" role="status" aria-live="polite" aria-label={$_('screens.library.importProgress')}>
      <div class="progress-bar" data-testid="import-progress">
        <div 
          class="progress-fill" 
          style="width: {importProgress.percentage}%"
          aria-hidden="true"
        ></div>
      </div>
      <span class="progress-text">{importProgress.currentBook}</span>
      <span class="progress-percentage">{importProgress.percentage}%</span>
    </div>
  {/if}

  <div class="books-grid" data-testid="books-grid" role="list" aria-label="Lista de livros">
    {#each books as book, index (book.contentId)}
      <div role="listitem">
        <BookCard
          {book}
          isSelected={isSelected(book.contentId)}
          isHovered={hoveredBookId === book.contentId}
          onClick={(e) => handleBookClick(book, index, e)}
          onToggleSelection={() => toggleSelection(book, index)}
          onMouseEnter={() => hoveredBookId = book.contentId}
          onMouseLeave={() => hoveredBookId = null}
        />
      </div>
    {/each}
  </div>

  {#if books.length === 0}
    <div class="empty-state" data-testid="empty-state">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <h3 class="empty-title">{$_('screens.library.noBooks')}</h3>
      <p class="empty-description">{$_('screens.library.noBooksSubtitle')}</p>
      {#if onBooksImport}
        <button type="button" class="action-btn import" onclick={onBooksImport}>
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {$_('screens.library.importTitle')}
        </button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .library-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    padding: var(--space-6);
    gap: var(--space-6);
    background-color: var(--surface-secondary);
  }

  /* Header Styles */
  .library-header {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-4);
    background-color: var(--surface-elevated);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-sm);
  }

  .header-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .header-title-group {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .library-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
    letter-spacing: var(--tracking-tight);
  }

  .book-count {
    padding: var(--space-1) var(--space-2);
    background-color: var(--surface-tertiary);
    border-radius: var(--radius-full);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-weight: var(--font-medium);
  }

  /* Selection Controls */
  .selection-controls {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .selection-count {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    font-weight: var(--font-medium);
    min-width: 100px;
  }

  .control-group {
    display: flex;
    gap: var(--space-2);
  }

  .control-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    background-color: var(--surface-tertiary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .control-btn:hover:not(:disabled) {
    background-color: var(--surface-secondary);
    border-color: var(--border-hover);
    color: var(--text-primary);
  }

  .control-btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .control-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Header Actions */
  .header-actions {
    display: flex;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--border-default);
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    border: none;
    border-radius: var(--radius-lg);
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 120px;
  }

  .action-btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.import {
    background-color: var(--color-primary-600);
    color: var(--text-inverse);
  }

  .action-btn.import:hover:not(:disabled) {
    background-color: var(--color-primary-700);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  .action-btn.export {
    background-color: var(--color-success-600);
    color: var(--text-inverse);
  }

  .action-btn.export:hover:not(:disabled) {
    background-color: var(--color-success-700);
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
  }

  /* Button Icon */
  .btn-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
  }

  .btn-icon.spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Progress Bar */
  .progress-container {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    background-color: var(--color-primary-50);
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-primary-200);
  }

  .progress-bar {
    flex: 1;
    height: 8px;
    background-color: var(--color-primary-200);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-primary-500) 0%, var(--color-primary-600) 100%);
    border-radius: var(--radius-full);
    transition: width var(--transition-base);
  }

  .progress-text {
    font-size: var(--text-sm);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .progress-percentage {
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--color-primary-700);
    min-width: 40px;
    text-align: right;
  }

  /* Books Grid */
  .books-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: var(--space-4);
    overflow-y: auto;
    flex: 1;
    padding: var(--space-2);
    margin: calc(-1 * var(--space-2));
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-16) var(--space-8);
    text-align: center;
    flex: 1;
  }

  .empty-icon {
    width: 64px;
    height: 64px;
    color: var(--text-tertiary);
  }

  .empty-icon svg {
    width: 100%;
    height: 100%;
  }

  .empty-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .empty-description {
    margin: 0;
    font-size: var(--text-base);
    color: var(--text-secondary);
    max-width: 400px;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .library-view {
      padding: var(--space-4);
      gap: var(--space-4);
    }

    .library-header {
      padding: var(--space-3);
    }

    .header-main {
      flex-direction: column;
      align-items: stretch;
    }

    .selection-controls {
      justify-content: space-between;
    }

    .books-grid {
      grid-template-columns: 1fr;
    }

    .action-btn {
      flex: 1;
      min-width: auto;
    }
  }

  @media (max-width: 480px) {
    .control-group {
      width: 100%;
    }

    .control-btn {
      flex: 1;
    }

    .header-actions {
      flex-direction: column;
    }
  }
</style>
