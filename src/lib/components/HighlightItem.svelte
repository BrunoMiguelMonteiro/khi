<script lang="ts">
  import type { Highlight } from '../types';
  import { formatDate } from '../utils/date';
  import { getExportConfig } from '../stores/settings.svelte';
  import { _ } from '$lib/i18n';

  interface Props {
    highlight: Highlight;
  }

  let {
    highlight
  }: Props = $props();

  function formatProgress(progress: number | undefined): string {
    if (progress === undefined) return '';
    return `${Math.round(progress * 100)}%`;
  }
</script>

<div 
  class="highlight-item"
  data-testid="highlight-item"
  data-highlight-id={highlight.id}
>
  <div class="highlight-content">
    <blockquote class="highlight-text">
      {highlight.text}
    </blockquote>
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

  .highlight-meta {
    display: flex;
    justify-content: flex-start;
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
