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

  it('renders progress percentage', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('renders date', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    // Date format may vary, check for year
    expect(screen.getByText(/2025/)).toBeInTheDocument();
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

  it('renders without progress when not provided', () => {
    const highlightWithoutProgress: Highlight = {
      ...mockHighlight,
      chapterProgress: undefined,
    };
    render(HighlightItem, { props: { highlight: highlightWithoutProgress } });
    expect(screen.queryByText('25%')).not.toBeInTheDocument();
  });
});
