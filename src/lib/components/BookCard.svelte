<script lang="ts">
  import type { Book } from '../types';
  import { _ } from '$lib/i18n';

  interface Props {
    book: Book;
    gradient?: string;
    isSelected?: boolean;
    isHovered?: boolean;
    onClick?: (event: MouseEvent) => void;
    onToggleSelection?: () => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
  }

  let {
    book,
    gradient = 'from-blue-400 to-blue-600',
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
        <div class="cover-placeholder bg-gradient-to-br {gradient}">
          <span class="placeholder-text">{getInitials(book.title)}</span>
        </div>
      {/if}
    </div>
    
    <div class="book-info">
      <h3 class="book-title" title={book.title}>{book.title}</h3>
      <p class="book-author">{book.author || $_('screens.bookDetails.unknownAuthor')}</p>
      
      <div class="book-meta">
        <span class="meta-item highlight-count">
          {formatHighlightCount(book.highlights.length)}
        </span>
      </div>
    </div>
  </button>
</div>

<style>
  .book-card {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    border: 2px solid transparent;
    text-align: left;
    width: 100%;
    transition: all var(--transition-fast);
    position: relative;
  }

  .content-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0;
    padding: 0;
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
    top: 8px;
    left: 8px;
    width: 24px;
    height: 24px;
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
    width: 100%;
    height: 0;
    padding-bottom: 150%; /* 2:3 aspect ratio */
    position: relative;
    border-radius: var(--radius-lg);
    overflow: hidden;
    box-shadow: var(--shadow-sm);
  }

  .cover-image {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform var(--transition-base);
  }

  .book-card:hover .cover-image {
    transform: scale(1.05);
  }

  .cover-placeholder {
    position: absolute;
    inset: 0;
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
    padding: var(--space-3);
    margin-top: var(--space-3);
  }

  .book-title {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    line-height: var(--leading-snug);
    color: var(--text-primary);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: normal;
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
    margin-top: var(--space-1);
  }

  .meta-item {
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  }

  /* Responsive */
  @media (max-width: 640px) {
    .book-info {
      padding: var(--space-2);
    }
  }
</style>
