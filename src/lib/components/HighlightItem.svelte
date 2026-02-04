<script lang="ts">
  import type { Highlight } from '../types';

  interface Props {
    highlight: Highlight;
  }

  let {
    highlight
  }: Props = $props();

  /**
   * Formata chapter titles técnicos (paths EPUB) em títulos legíveis
   * Exemplos:
   *   "OEBPS/Text/Section0001.html" → "Section 1"
   *   "file:///mnt/onboard/Book/xhtml/chapter01.xhtml#intro" → "Intro"
   *   "content/chapter-3.html" → "Chapter 3"
   */
  function formatChapterTitle(rawTitle: string | undefined): string {
    if (!rawTitle) return '';

    let cleaned = rawTitle;

    // Remove file:// protocol
    cleaned = cleaned.replace(/^file:\/\/\/mnt\/onboard\//, '');

    // Remove common EPUB internal paths
    cleaned = cleaned.replace(/.*\/(OEBPS|Text|xhtml|html|content)\//, '');

    // Remove file extensions
    cleaned = cleaned.replace(/\.(xhtml|html|htm|xml).*$/, '');

    // Extract hash anchor if present (e.g., Section0001.html#chapter_1 → chapter_1)
    const anchorMatch = cleaned.match(/#(.+)$/);
    if (anchorMatch) {
      cleaned = anchorMatch[1];
    }

    // Clean up common patterns
    cleaned = cleaned
      .replace(/Section\d+/gi, '') // Remove "Section001"
      .replace(/chapter[-_]?(\d+)/gi, 'Chapter $1') // chapter-1 → Chapter 1
      .replace(/part[-_]?(\d+)/gi, 'Part $1') // part_2 → Part 2
      .replace(/[-_]/g, ' ') // Replace hyphens/underscores with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    // Capitalize first letter of each word
    cleaned = cleaned
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');

    return cleaned || 'Unknown Location';
  }
</script>

<div
  class="highlight-item"
  data-testid="highlight-item"
  data-highlight-id={highlight.id}
>
  <blockquote class="highlight-text">
    {highlight.text}
  </blockquote>
  {#if highlight.chapterTitle}
    <p class="location-label">{formatChapterTitle(highlight.chapterTitle)}</p>
  {/if}
</div>

<style>
  .highlight-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-2); /* 8px gap between quote and location */
  }

  .highlight-text {
    margin: 0;
    padding: 4px var(--space-4); /* 4px vertical, 16px horizontal */
    border-left: 4px solid var(--color-neutral-300);
    font-size: var(--text-base); /* 16px */
    line-height: var(--leading-relaxed); /* 1.625 */
    color: var(--text-primary);
  }

  :global(.dark) .highlight-text {
    border-left-color: var(--color-neutral-400);
  }

  .location-label {
    margin: 0;
    padding-left: var(--space-4); /* Aligned with quote */
    font-size: var(--text-xs); /* 12px */
    color: var(--text-tertiary);
  }
</style>
