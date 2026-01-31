<script lang="ts">
  import type { Book, Highlight } from '../types';
  import HighlightItem from './HighlightItem.svelte';
  import { formatDate } from '../utils/date';
  import { getExportConfig } from '../stores/settings.svelte';
  import { _ } from '$lib/i18n';

  interface Props {
    book: Book;
    onClose?: () => void;
    onUpdateHighlight?: (bookId: string, highlightId: string, updates: Partial<Highlight>) => void;
  }

  let {
    book,
    onClose,
    onUpdateHighlight
  }: Props = $props();

  function handleToggleExclude(highlightId: string, excluded: boolean) {
    onUpdateHighlight?.(book.contentId, highlightId, { isExcluded: excluded });
  }

  function handleEdit(highlightId: string, editedText: string) {
    onUpdateHighlight?.(book.contentId, highlightId, { editedText });
  }

  function handleAddNote(highlightId: string, note: string) {
    onUpdateHighlight?.(book.contentId, highlightId, { personalNote: note });
  }

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
    const excluded = book.highlights.filter(h => h.isExcluded).length;
    const edited = book.highlights.filter(h => h.editedText).length;
    const withNotes = book.highlights.filter(h => h.personalNote).length;
    return { total, excluded, edited, withNotes, active: total - excluded };
  });

  // Generate a consistent gradient based on book title
  function generatePlaceholderGradient(title: string): string {
    const gradients = [
      'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
      'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
      'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    ];
    
    let hash = 0;
    for (let i = 0; i < title.length; i++) {
      hash = title.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % gradients.length;
    return gradients[index];
  }

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
    <div class="book-cover">
      {#if book.coverPath}
        <img 
          src={book.coverPath} 
          alt="" 
          class="cover-image"
        />
      {:else}
        <div 
          class="cover-placeholder"
          style="background: {generatePlaceholderGradient(book.title)}"
        >
          <span class="placeholder-text">{getInitials(book.title)}</span>
        </div>
      {/if}
    </div>

    <div class="book-meta">
      <h1 class="book-title">{book.title}</h1>
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
        <span class="stat active" title={$_('screens.bookDetails.active')}>
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
          </svg>
          {stats().active}
        </span>
        {#if stats().excluded > 0}
          <span class="stat excluded" title={$_('screens.bookDetails.excluded')}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {stats().excluded}
          </span>
        {/if}
        {#if stats().edited > 0}
          <span class="stat edited" title={$_('screens.bookDetails.edited')}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {stats().edited}
          </span>
        {/if}
        {#if stats().withNotes > 0}
          <span class="stat notes" title={$_('screens.bookDetails.withNotes')}>
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M14 2v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 13H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M16 17H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            {stats().withNotes}
          </span>
        {/if}
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
                <HighlightItem
                  {highlight}
                  onToggleExclude={handleToggleExclude}
                  onEdit={handleEdit}
                  onAddNote={handleAddNote}
                />
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
    width: 120px;
    height: 180px;
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
    font-size: var(--text-2xl);
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

  .stat.active {
    background: var(--color-success-100);
    color: var(--color-success-700);
  }

  .stat.excluded {
    background: var(--color-error-100);
    color: var(--color-error-700);
  }

  .stat.edited {
    background: var(--color-warning-100);
    color: var(--color-warning-700);
  }

  .stat.notes {
    background: var(--color-info-100);
    color: var(--color-info-700);
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

    .book-cover {
      width: 100px;
      height: 150px;
    }

    .book-title {
      font-size: var(--text-xl);
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
