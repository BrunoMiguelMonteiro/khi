<script lang="ts">
  import type { Highlight } from '../types';
  import { formatDate } from '../utils/date';
  import { getExportConfig } from '../stores/settings.svelte';
  import { _ } from '$lib/i18n';

  interface Props {
    highlight: Highlight;
    onToggleExclude?: (id: string, excluded: boolean) => void;
    onEdit?: (id: string, editedText: string) => void;
    onAddNote?: (id: string, note: string) => void;
  }

  let {
    highlight,
    onToggleExclude,
    onEdit,
    onAddNote
  }: Props = $props();

  let isEditing = $state(false);
  let isAddingNote = $state(false);
  let editText = $state('');
  let noteText = $state('');
  let editInputRef = $state<HTMLTextAreaElement | null>(null);
  let noteInputRef = $state<HTMLTextAreaElement | null>(null);

  // Initialize edit text when entering edit mode
  $effect(() => {
    if (isEditing) {
      editText = highlight.editedText || highlight.text;
      // Focus and select all text after a brief delay to allow rendering
      setTimeout(() => {
        editInputRef?.focus();
        editInputRef?.select();
      }, 0);
    }
  });

  // Initialize note text when entering note mode
  $effect(() => {
    if (isAddingNote) {
      noteText = highlight.personalNote || '';
      setTimeout(() => {
        noteInputRef?.focus();
      }, 0);
    }
  });

  function handleStartEdit() {
    if (highlight.isExcluded) return;
    isEditing = true;
  }

  function handleSaveEdit() {
    if (editText.trim() && editText.trim() !== highlight.text) {
      onEdit?.(highlight.id, editText.trim());
    }
    isEditing = false;
  }

  function handleCancelEdit() {
    isEditing = false;
    editText = '';
  }

  function handleStartAddNote() {
    isAddingNote = true;
  }

  function handleSaveNote() {
    onAddNote?.(highlight.id, noteText.trim());
    isAddingNote = false;
  }

  function handleCancelNote() {
    isAddingNote = false;
    noteText = '';
  }

  function handleToggleExclude() {
    onToggleExclude?.(highlight.id, !highlight.isExcluded);
    // Cancel editing if excluded
    if (!highlight.isExcluded && isEditing) {
      isEditing = false;
    }
  }

  function handleKeyDownEdit(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSaveEdit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelEdit();
    }
  }

  function handleKeyDownNote(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      handleSaveNote();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      handleCancelNote();
    }
  }

  function formatProgress(progress: number | undefined): string {
    if (progress === undefined) return '';
    return `${Math.round(progress * 100)}%`;
  }

  const displayText = $derived(highlight.editedText || highlight.text);
</script>

<div 
  class="highlight-item"
  class:excluded={highlight.isExcluded}
  data-testid="highlight-item"
  data-highlight-id={highlight.id}
>
  <div class="highlight-content">
    {#if isEditing}
      <div class="edit-mode">
        <textarea
          bind:this={editInputRef}
          bind:value={editText}
          class="edit-textarea"
          rows="3"
          onkeydown={handleKeyDownEdit}
          data-testid="highlight-edit-textarea"
        ></textarea>
        <div class="edit-actions">
          <button 
            type="button" 
            class="btn btn-primary"
            onclick={handleSaveEdit}
            data-testid="highlight-save-edit"
          >
            {$_('highlight.save')}
          </button>
          <button 
            type="button" 
            class="btn btn-secondary"
            onclick={handleCancelEdit}
            data-testid="highlight-cancel-edit"
          >
            {$_('highlight.cancel')}
          </button>
        </div>
      </div>
    {:else}
      <blockquote class="highlight-text" class:edited={!!highlight.editedText}>
        {displayText}
        {#if highlight.editedText}
          <span class="edited-badge" title={$_('highlight.editedTitle')}>({$_('highlight.edited')})</span>
        {/if}
      </blockquote>
    {/if}

    {#if highlight.personalNote && !isAddingNote}
      <div class="personal-note">
        <span class="note-label">{$_('highlight.noteLabel')}</span>
        {highlight.personalNote}
      </div>
    {/if}

    {#if isAddingNote}
      <div class="note-edit-mode">
        <textarea
          bind:this={noteInputRef}
          bind:value={noteText}
          class="note-textarea"
          rows="2"
          placeholder={$_('highlight.addNote')}
          onkeydown={handleKeyDownNote}
          data-testid="highlight-note-textarea"
        ></textarea>
        <div class="edit-actions">
          <button 
            type="button" 
            class="btn btn-primary"
            onclick={handleSaveNote}
            data-testid="highlight-save-note"
          >
            {$_('highlight.saveNote')}
          </button>
          <button 
            type="button" 
            class="btn btn-secondary"
            onclick={handleCancelNote}
            data-testid="highlight-cancel-note"
          >
            {$_('highlight.cancel')}
          </button>
        </div>
      </div>
    {/if}
  </div>

  <div class="highlight-meta">
    <div class="meta-info">
      {#if highlight.chapterTitle}
        <span class="chapter-title">{highlight.chapterTitle}</span>
      {/if}
      {#if highlight.chapterProgress !== undefined}
        <span class="progress">{formatProgress(highlight.chapterProgress)}</span>
      {/if}
      <span class="date">{formatDate(highlight.dateCreated, getExportConfig().dateFormat)}</span>
    </div>

    <div class="highlight-actions">
      <button
        type="button"
        class="action-btn"
        class:active={isEditing}
        onclick={handleStartEdit}
        disabled={highlight.isExcluded}
        title={$_('highlight.editTitle')}
        data-testid="highlight-edit-btn"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <button
        type="button"
        class="action-btn"
        class:active={isAddingNote || !!highlight.personalNote}
        onclick={handleStartAddNote}
        title={highlight.personalNote ? $_('highlight.edit') : $_('highlight.addNote')}
        data-testid="highlight-note-btn"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M14 2v6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 13H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M16 17H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <button
        type="button"
        class="action-btn exclude-btn"
        class:active={highlight.isExcluded}
        onclick={handleToggleExclude}
        title={highlight.isExcluded ? $_('highlight.includeTitle') : $_('highlight.excludeTitle')}
        data-testid="highlight-exclude-btn"
      >
        {#if highlight.isExcluded}
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {:else}
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M1 1l22 22" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
      </button>
    </div>
  </div>
</div>

<style>
  .highlight-item {
    padding: var(--space-4);
    background: var(--surface-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    transition: all var(--transition-fast);
  }

  .highlight-item:hover {
    border-color: var(--border-hover);
    box-shadow: var(--shadow-sm);
  }

  .highlight-item.excluded {
    opacity: 0.6;
    background: var(--surface-secondary);
  }

  .highlight-item.excluded .highlight-text {
    text-decoration: line-through;
    color: var(--text-tertiary);
  }

  .highlight-content {
    margin-bottom: var(--space-3);
  }

  .highlight-text {
    margin: 0;
    padding: var(--space-3);
    padding-left: var(--space-4);
    border-left: 3px solid var(--color-primary-500);
    background: var(--surface-secondary);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    color: var(--text-primary);
    font-style: italic;
  }

  .highlight-text.edited {
    border-left-color: var(--color-warning-500);
  }

  .edited-badge {
    display: inline-block;
    margin-left: var(--space-2);
    padding: var(--space-0) var(--space-2);
    background: var(--color-warning-100);
    color: var(--color-warning-700);
    font-size: var(--text-xs);
    font-style: normal;
    font-weight: var(--font-medium);
    border-radius: var(--radius-sm);
  }

  .personal-note {
    margin-top: var(--space-3);
    padding: var(--space-3);
    background: var(--color-info-50);
    border: 1px solid var(--color-info-200);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-secondary);
  }

  .note-label {
    font-weight: var(--font-semibold);
    color: var(--color-info-700);
    margin-right: var(--space-1);
  }

  .edit-mode,
  .note-edit-mode {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .edit-textarea,
  .note-textarea {
    width: 100%;
    padding: var(--space-3);
    border: 2px solid var(--border-default);
    border-radius: var(--radius-md);
    font-family: var(--font-sans);
    font-size: var(--text-base);
    line-height: var(--leading-relaxed);
    resize: vertical;
    transition: border-color var(--transition-fast);
  }

  .edit-textarea:focus,
  .note-textarea:focus {
    outline: none;
    border-color: var(--color-primary-500);
    box-shadow: var(--shadow-focus);
  }

  .edit-actions {
    display: flex;
    gap: var(--space-2);
  }

  .btn {
    padding: var(--space-2) var(--space-4);
    font-size: var(--text-sm);
    font-weight: var(--font-medium);
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-primary {
    background: var(--color-primary-600);
    color: var(--text-inverse);
  }

  .btn-primary:hover {
    background: var(--color-primary-700);
  }

  .btn-secondary {
    background: var(--surface-tertiary);
    color: var(--text-secondary);
  }

  .btn-secondary:hover {
    background: var(--border-hover);
    color: var(--text-primary);
  }

  .highlight-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-3);
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-default);
  }

  .meta-info {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    font-size: var(--text-sm);
    color: var(--text-tertiary);
  }

  .chapter-title {
    font-weight: var(--font-medium);
    color: var(--text-secondary);
  }

  .progress {
    padding: var(--space-0) var(--space-2);
    background: var(--surface-tertiary);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
  }

  .highlight-actions {
    display: flex;
    gap: var(--space-2);
  }

  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: var(--surface-tertiary);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    color: var(--text-tertiary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .action-btn:hover:not(:disabled) {
    background: var(--surface-secondary);
    border-color: var(--border-hover);
    color: var(--text-primary);
  }

  .action-btn:focus-visible {
    outline: none;
    box-shadow: var(--shadow-focus);
  }

  .action-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .action-btn.active {
    background: var(--color-primary-100);
    border-color: var(--color-primary-500);
    color: var(--color-primary-600);
  }

  .action-btn.exclude-btn.active {
    background: var(--color-error-100);
    border-color: var(--color-error-500);
    color: var(--color-error-600);
  }

  .action-btn svg {
    width: 16px;
    height: 16px;
  }

  /* Responsive */
  @media (max-width: 640px) {
    .highlight-item {
      padding: var(--space-3);
    }

    .highlight-meta {
      flex-direction: column;
      align-items: flex-start;
    }

    .meta-info {
      flex-wrap: wrap;
    }
  }
</style>
