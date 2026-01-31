<script lang="ts">
  import type { Book } from '../types';
  import { formatDate } from '../utils/date';
  import { getExportConfig } from '../stores/settings.svelte';
  import { _ } from '$lib/i18n';

  interface Props {
    book: Book;
    isSelected?: boolean;
    isHovered?: boolean;
    onClick?: (event: MouseEvent) => void;
    onToggleSelection?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }

  let {
    book,
    isSelected = false,
    isHovered = false,
    onClick,
    onToggleSelection,
    onMouseEnter,
    onMouseLeave
  }: Props = $props();

  function formatHighlightCount(count: number): string {
    if (count === 0) return $_('book.noHighlights');
    return $_('book.highlightsCount', { count });
  }

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

<div
  class="book-card"
  class:selected={isSelected}
  class:hovered={isHovered}
  onmouseenter={onMouseEnter}
  onmouseleave={onMouseLeave}
  data-testid="book-card"
  role="group"
  aria-label={book.title}
>
  <button 
    type="button"
    class="selection-btn"
    onclick={(e) => {
      e.stopPropagation();
      onToggleSelection?.();
    }}
    aria-label={isSelected ? "Deselect" : "Select"}
  >
    <div class="selection-indicator" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
        {#if isSelected}
          <circle cx="12" cy="12" r="6" fill="currentColor"/>
        {/if}
      </svg>
    </div>
  </button>

  <button
    type="button"
    class="content-btn"
    onclick={onClick}
  >
    <div class="cover-container">
      {#if book.coverPath}
        <img 
          src={book.coverPath} 
          alt="" 
          class="cover-image"
          loading="lazy"
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
    
    <div class="book-info">
      <h3 class="book-title" title={book.title}>{book.title}</h3>
      <p class="book-author">{book.author || $_('screens.bookDetails.unknownAuthor')}</p>
      
      <div class="book-meta">
        <span class="meta-item highlight-count">
          <svg class="meta-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M7 7h10M7 12h10M7 17h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          {formatHighlightCount(book.highlights.length)}
        </span>
        {#if book.dateLastRead}
          <span class="meta-item modification-date">
            <svg class="meta-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            {formatDate(book.dateLastRead, getExportConfig().dateFormat)}
          </span>
        {/if}
      </div>
    </div>
  </button>
</div>

<style>
  .book-card {
    display: flex;
    align-items: flex-start;
    border: 2px solid transparent;
    border-radius: var(--radius-lg);
    background: var(--surface-elevated);
    text-align: left;
    width: 100%;
    transition: all var(--transition-fast);
    position: relative;
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .content-btn {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    padding: var(--space-3);
    width: 100%;
    height: 100%;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: inherit;
    margin: 0;
  }

  .book-card:hover,
  .book-card.hovered {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--border-hover);
  }

  .book-card.selected {
    border-color: var(--color-primary-500);
    background: var(--color-primary-50);
    box-shadow: 0 0 0 1px var(--color-primary-500), var(--shadow-md);
  }

  .content-btn:focus-visible {
    outline: none;
  }

  .book-card:has(.content-btn:focus-visible) {
    box-shadow: var(--shadow-focus);
    border-color: var(--color-primary-500);
  }

  /* Selection Button */
  .selection-btn {
    position: absolute;
    top: 0;
    right: 0;
    width: 44px;
    height: 44px;
    background: transparent;
    border: none;
    cursor: pointer;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }

  .selection-btn:focus-visible {
    outline: none;
  }

  .selection-btn:focus-visible .selection-indicator {
    opacity: 1;
    transform: scale(1.1);
  }

  /* Selection Indicator */
  .selection-indicator {
    width: 20px;
    height: 20px;
    color: var(--color-primary-500);
    opacity: 0;
    transition: all var(--transition-fast);
    /* Position adjustments for visual alignment inside 44px button */
    margin-bottom: 8px; 
    margin-left: 8px;
  }

  .book-card:hover .selection-indicator,
  .book-card.selected .selection-indicator,
  .selection-btn:focus-visible .selection-indicator,
  .selection-btn:hover .selection-indicator {
    opacity: 1;
  }

  .selection-indicator svg {
    width: 100%;
    height: 100%;
  }

  /* Cover Styles */
  .cover-container {
    flex-shrink: 0;
    width: 60px;
    height: 90px;
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .cover-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--transition-base);
  }

  .book-card:hover .cover-image {
    transform: scale(1.05);
  }

  .cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .placeholder-text {
    font-size: var(--text-xl);
    font-weight: var(--font-bold);
    color: var(--text-inverse);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  /* Book Info */
  .book-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-right: var(--space-6);
  }

  .book-title {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    line-height: var(--leading-snug);
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .book-author {
    margin: 0;
    font-size: var(--text-xs);
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Meta Info */
  .book-meta {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding-top: var(--space-2);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  .meta-icon {
    width: 12px;
    height: 12px;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .content-btn {
      padding: var(--space-2);
    }

    .cover-container {
      width: 48px;
      height: 72px;
    }

    .placeholder-text {
      font-size: var(--text-lg);
    }
  }
</style>
