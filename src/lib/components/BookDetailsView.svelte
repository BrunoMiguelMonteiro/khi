<script lang="ts">
  import type { Book, Highlight } from '../types';
  import HighlightItem from './HighlightItem.svelte';
  import { formatDate } from '../utils/date';
  import { getExportConfig } from '../stores/settings.svelte';
  import { _ } from '$lib/i18n';
  import { getBookGradient } from '$lib/utils/gradients';

  interface Props {
    book: Book;
    onClose?: () => void;
  }

  let {
    book,
    onClose
  }: Props = $props();

  // Group highlights by chapter
  const groupedHighlights = $derived(() => {
    const groups = new Map<string, Highlight[]>();
    
    for (const highlight of book.highlights) {
      const chapter = highlight.chapterTitle || $_('screens.bookDetails.noChapter');
      if (!groups.has(chapter)) {
        groups.set(chapter, []);
      }
      groups.get(chapter)!.push(highlight);
    }
    
    // Sort chapters by first highlight's progress
    const sortedGroups = new Map([...groups.entries()].sort((a, b) => {
      const aProgress = a[1][0]?.chapterProgress ?? 0;
      const bProgress = b[1][0]?.chapterProgress ?? 0;
      return aProgress - bProgress;
    }));
    
    return sortedGroups;
  });

  // Calculate stats
  const stats = $derived(() => {
    const total = book.highlights.length;
    return { total };
  });

  function getInitials(title: string): string {
    return title
      .split(' ')
      .slice(0, 2)
      .map(word => word.charAt(0).toUpperCase())
      .join('');
  }
</script>

<div class="book-details-view" data-testid="book-details-view">
  <header class="details-header">
    <button 
      type="button" 
      class="back-btn"
      onclick={onClose}
      data-testid="book-details-close"
    >
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M19 12H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>{$_('screens.bookDetails.back')}</span>
    </button>
  </header>

  <div class="book-info-section">
    <div class="book-cover w-[120px] h-[180px] max-sm:w-[96px] max-sm:h-[144px]">
      {#if book.coverPath}
        <img 
          src={book.coverPath} 
          alt="" 
          class="cover-image"
        />
      {:else}
        <div class="cover-placeholder bg-gradient-to-br {getBookGradient(book.contentId)}">
          <span class="placeholder-text">{getInitials(book.title)}</span>
        </div>
      {/if}
    </div>

    <div class="book-meta">
      <h1 class="book-title text-3xl max-sm:text-2xl">{book.title}</h1>
      <p class="book-author">{book.author || $_('screens.bookDetails.unknownAuthor')}</p>
      
      {#if book.isbn}
        <p class="book-isbn">ISBN: {book.isbn}</p>
      {/if}
      
      {#if book.publisher}
        <p class="book-publisher">{book.publisher}</p>
      {/if}
      
      {#if book.dateLastRead}
        <p class="book-date">{$_('screens.bookDetails.lastRead')}: {formatDate(book.dateLastRead, getExportConfig().dateFormat)}</p>
      {/if}

      {#if book.description}
        <p class="book-description">{book.description}</p>
      {/if}
    </div>
  </div>

  <div class="highlights-section">
    <div class="highlights-header">
      <h2 class="section-title">{$_('screens.bookDetails.highlights')}</h2>
      <div class="stats">
        <span class="stat total" title="Total">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          {stats().total}
        </span>
      </div>
    </div>

    {#if book.highlights.length === 0}
      <div class="empty-state" data-testid="book-details-empty">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M7 7h10M7 12h10M7 17h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p>{$_('screens.bookDetails.noHighlights')}</p>
      </div>
    {:else}
      <div class="highlights-list" data-testid="highlights-list">
        {#each [...groupedHighlights()] as [chapter, highlights]}
          <div class="chapter-group" data-testid="chapter-group">
            <h3 class="chapter-title">{chapter}</h3>
            <div class="chapter-highlights">
              {#each highlights as highlight (highlight.id)}
                <HighlightItem {highlight} />
              {/each}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .book-details-view {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    background: var(--surface-secondary);
  }

  /* Header */
  .details-header {
    position: sticky;
    top: 0;
    z-index: var(--z-sticky);
    padding: var(--space-4) var(--space-6);
    background: var(--surface-elevated);
    border-bottom: 1px solid var(--border-default);
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    color: var(--text-secondary);
    background: var(--surface-tertiary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .back-btn:hover {
    background: var(--surface-secondary);
    color: var(--text-primary);
  }

  .back-btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .back-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Book Info Section */
  .book-info-section {
    display: flex;
    gap: var(--space-6);
    padding: var(--space-6);
    background: var(--surface-elevated);
    border-bottom: 1px solid var(--border-default);
  }

  .book-cover {
    flex-shrink: 0;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-md);
  }

  .cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder-text {
    font-size: var(--text-3xl);
    font-weight: var(--font-bold);
    color: var(--text-inverse);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .book-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .book-title {
    margin: 0;
    font-weight: var(--font-bold);
    color: var(--text-primary);
    line-height: var(--leading-tight);
  }

  .book-author {
    margin: 0;
    font-size: var(--text-lg);
    color: var(--text-secondary);
  }

  .book-isbn,
  .book-publisher,
  .book-date {
    margin: 0;
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  .book-description {
    margin: var(--space-3) 0 0;
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: var(--leading-relaxed);
  }

  /* Highlights Section */
  .highlights-section {
    flex: 1;
    padding: var(--space-6);
  }

  .highlights-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-4);
    margin-bottom: var(--space-6);
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--border-default);
  }

  .section-title {
    margin: 0;
    font-size: var(--text-xl);
    font-weight: var(--font-semibold);
    color: var(--text-primary);
  }

  .stats {
    display: flex;
    gap: var(--space-3);
  }

  .stat {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    border-radius: var(--radius-full);
  }

  .stat svg {
    width: 14px;
    height: 14px;
  }

  .stat.total {
    background: var(--color-success-100);
    color: var(--color-success-700);
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-16);
    text-align: center;
    color: var(--text-tertiary);
  }

  .empty-icon {
    width: 48px;
    height: 48px;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: var(--text-base);
  }

  /* Highlights List */
  .highlights-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-6);
  }

  .chapter-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .chapter-title {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: var(--tracking-wide);
    background: var(--surface-tertiary);
    border-radius: var(--radius-md);
    display: inline-block;
    align-self: flex-start;
  }

  .chapter-highlights {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .book-info-section {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .highlights-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .stats {
      flex-wrap: wrap;
    }
  }
</style>
