import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import HighlightItem from './HighlightItem.svelte';
import type { Highlight } from '../types';
import { makeHighlight } from '../test-fixtures';
import * as clipboardUtils from '../utils/clipboard';

// Mock clipboard utility
vi.mock('../utils/clipboard', () => ({
  copyToClipboard: vi.fn()
}));

const mockHighlight: Highlight = makeHighlight({
  id: 'hl1',
  text: 'This is the highlight text',
  chapterTitle: 'Chapter 1',
  chapterProgress: 0.25,
  dateCreated: '2025-01-24',
});

describe('HighlightItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
      chapterTitle: null,
    };
    render(HighlightItem, { props: { highlight: highlightWithoutChapter } });
    expect(screen.queryByText('Chapter 1')).not.toBeInTheDocument();
  });

  it('renders clean chapter title from backend as-is', () => {
    const highlight: Highlight = {
      ...mockHighlight,
      chapterTitle: 'Chapter 3: Connect Your Notes',
    };
    render(HighlightItem, { props: { highlight } });
    expect(screen.getByText('Chapter 3: Connect Your Notes')).toBeInTheDocument();
  });

  it('filters out filenames with extensions (safety net)', () => {
    const highlight: Highlight = {
      ...mockHighlight,
      chapterTitle: 'Text/011.xhtml',
    };
    const { container } = render(HighlightItem, { props: { highlight } });
    // Filename should be filtered — no <p> chapter label rendered
    const chapterLabel = container.querySelector('p');
    expect(chapterLabel).toBeNull();
  });

  it('filters out paths with slashes (safety net)', () => {
    const highlight: Highlight = {
      ...mockHighlight,
      chapterTitle: 'OEBPS/Text/Section0001',
    };
    const { container } = render(HighlightItem, { props: { highlight } });
    // Path with slashes should be filtered — no <p> chapter label rendered
    const chapterLabel = container.querySelector('p');
    expect(chapterLabel).toBeNull();
  });

  it('does not render location label for empty chapter titles', () => {
    const highlightWithEmptyTitle: Highlight = {
      ...mockHighlight,
      chapterTitle: '',
    };
    const { container } = render(HighlightItem, { props: { highlight: highlightWithEmptyTitle } });
    // Empty string should result in no <p> chapter label rendered
    const chapterLabel = container.querySelector('p');
    expect(chapterLabel).toBeNull();
  });

  describe('Copy to Clipboard', () => {
    it('renders copy button', () => {
      render(HighlightItem, { props: { highlight: mockHighlight } });
      const copyButton = screen.getByRole('button', { name: /copy quote/i });
      expect(copyButton).toBeInTheDocument();
    });

    it('calls copyToClipboard with highlight text when clicked', async () => {
      const mockCopy = vi.mocked(clipboardUtils.copyToClipboard);
      mockCopy.mockResolvedValue(true);

      render(HighlightItem, { props: { highlight: mockHighlight } });
      const copyButton = screen.getByRole('button', { name: /copy quote/i });

      await fireEvent.click(copyButton);

      expect(mockCopy).toHaveBeenCalledWith('This is the highlight text');
      expect(mockCopy).toHaveBeenCalledTimes(1);
    });

    it('shows success feedback after successful copy', async () => {
      const mockCopy = vi.mocked(clipboardUtils.copyToClipboard);
      mockCopy.mockResolvedValue(true);

      render(HighlightItem, { props: { highlight: mockHighlight } });
      const copyButton = screen.getByRole('button', { name: /copy quote/i });

      await fireEvent.click(copyButton);

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label', 'Copied!');
      });
    });

    it('hides feedback after 2 seconds', async () => {
      vi.useFakeTimers();
      const mockCopy = vi.mocked(clipboardUtils.copyToClipboard);
      mockCopy.mockResolvedValue(true);

      render(HighlightItem, { props: { highlight: mockHighlight } });
      const copyButton = screen.getByRole('button', { name: /copy quote/i });

      await fireEvent.click(copyButton);

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label', 'Copied!');
      });

      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label', 'Copy quote');
      });

      vi.useRealTimers();
    });

    it('shows error message if copyToClipboard fails', async () => {
      const mockCopy = vi.mocked(clipboardUtils.copyToClipboard);
      mockCopy.mockResolvedValue(false);

      render(HighlightItem, { props: { highlight: mockHighlight } });
      const copyButton = screen.getByRole('button', { name: /copy quote/i });

      await fireEvent.click(copyButton);

      await waitFor(() => {
        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-label', 'Copy failed');
      });
    });

    it('prevents multiple simultaneous clicks', async () => {
      const mockCopy = vi.mocked(clipboardUtils.copyToClipboard);
      mockCopy.mockResolvedValue(true);

      render(HighlightItem, { props: { highlight: mockHighlight } });
      const copyButton = screen.getByRole('button', { name: /copy quote/i });

      await fireEvent.click(copyButton);
      await fireEvent.click(copyButton);
      await fireEvent.click(copyButton);

      expect(mockCopy).toHaveBeenCalledTimes(1);
    });

    it('preserves line breaks when copying multiline text', async () => {
      const multilineHighlight: Highlight = {
        ...mockHighlight,
        text: 'Linha 1\nLinha 2\nLinha 3'
      };
      const mockCopy = vi.mocked(clipboardUtils.copyToClipboard);
      mockCopy.mockResolvedValue(true);

      render(HighlightItem, { props: { highlight: multilineHighlight } });
      const copyButton = screen.getByRole('button', { name: /copy quote/i });

      await fireEvent.click(copyButton);

      expect(mockCopy).toHaveBeenCalledWith('Linha 1\nLinha 2\nLinha 3');
    });

    it('disables button while copyFeedback is not idle', async () => {
      const mockCopy = vi.mocked(clipboardUtils.copyToClipboard);
      mockCopy.mockResolvedValue(true);

      render(HighlightItem, { props: { highlight: mockHighlight } });
      const copyButton = screen.getByRole('button', { name: /copy quote/i });

      await fireEvent.click(copyButton);

      await waitFor(() => {
        expect(copyButton).toBeDisabled();
      });
    });
  });

  it('removed highlight shows mark', () => {
    render(HighlightItem, { props: { highlight: { ...mockHighlight, removedAt: '2026-11-01T10:00:00Z' } } });
    expect(screen.getByTestId('removed-mark')).toHaveTextContent('Removed from Kobo');
  });

  it('live highlight has no removed mark', () => {
    render(HighlightItem, { props: { highlight: mockHighlight } });
    expect(screen.queryByTestId('removed-mark')).toBeNull();
  });
  describe('note (Kobo annotation)', () => {
    it('shows the note under the quote', () => {
      render(HighlightItem, { props: { highlight: { ...mockHighlight, annotation: 'My own thought' } } });
      const note = screen.getByTestId('highlight-note');
      expect(note).toHaveTextContent('Note: My own thought');
      const quote = screen.getByText('This is the highlight text');
      // The note follows the quote in document order.
      expect(quote.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('shows no note when annotation is null', () => {
      render(HighlightItem, { props: { highlight: mockHighlight } });
      expect(screen.queryByTestId('highlight-note')).toBeNull();
    });

    it('shows no note when Kobo stores an empty string', () => {
      render(HighlightItem, { props: { highlight: { ...mockHighlight, annotation: '' } } });
      expect(screen.queryByTestId('highlight-note')).toBeNull();
    });

    it('shows no note when annotation is only whitespace', () => {
      render(HighlightItem, { props: { highlight: { ...mockHighlight, annotation: '  \n\t ' } } });
      expect(screen.queryByTestId('highlight-note')).toBeNull();
    });
  });
});
