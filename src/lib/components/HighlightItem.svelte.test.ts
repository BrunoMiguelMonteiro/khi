import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import HighlightItem from './HighlightItem.svelte';
import type { Highlight } from '../types';

const mockHighlight: Highlight = {
  id: 'hl1',
  text: 'This is the highlight text',
  chapterTitle: 'Chapter 1',
  chapterProgress: 0.25,
  dateCreated: '2025-01-24',
};

describe('HighlightItem', () => {
  it('renders highlight text', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    expect(screen.getByText('This is the highlight text')).toBeInTheDocument();
  });

  it('renders chapter title', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    expect(screen.getByText('Chapter 1')).toBeInTheDocument();
  });

  it('has correct data attributes', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    const item = screen.getByTestId('highlight-item');
    expect(item).toHaveAttribute('data-highlight-id', 'hl1');
  });

  it('renders without chapter title when not provided', () => {
    const highlightWithoutChapter: Highlight = {
      ...mockHighlight,
      chapterTitle: undefined,
    };
    render(HighlightItem, { props: { highlight: highlightWithoutChapter } });
    expect(screen.queryByText('Chapter 1')).not.toBeInTheDocument();
  });

  it('formats technical EPUB paths to "Unknown Location"', () => {
    const highlightWithTechnicalTitle: Highlight = {
      ...mockHighlight,
      chapterTitle: 'OEBPS/Text/Section0001.html',
    };
    render(HighlightItem, { props: { highlight: highlightWithTechnicalTitle } });
    // Section numbers are stripped, leaving empty string -> "Unknown Location"
    expect(screen.getByText('Unknown Location')).toBeInTheDocument();
  });

  it('formats chapter-number patterns correctly', () => {
    const highlightWithChapterNumber: Highlight = {
      ...mockHighlight,
      chapterTitle: 'OEBPS/Text/chapter-3.xhtml',
    };
    render(HighlightItem, { props: { highlight: highlightWithChapterNumber } });
    // Should format to "Chapter 3" (OEBPS/Text/ path is stripped)
    expect(screen.getByText('Chapter 3')).toBeInTheDocument();
  });

  it('does not render location label for empty chapter titles', () => {
    const highlightWithEmptyTitle: Highlight = {
      ...mockHighlight,
      chapterTitle: '',
    };
    render(HighlightItem, { props: { highlight: highlightWithEmptyTitle } });
    // Empty string is falsy in Svelte's {#if}, so no label is rendered
    expect(screen.queryByText('Unknown Location')).not.toBeInTheDocument();
  });
});
