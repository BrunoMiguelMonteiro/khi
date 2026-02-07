import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import HighlightItem from './HighlightItem.svelte';
import type { Highlight } from '../types';
import * as clipboardUtils from '../utils/clipboard';

// Mock clipboard utility
vi.mock('../utils/clipboard', () => ({
  copyToClipboard: vi.fn()
}));

const mockHighlight: Highlight = {
  id: 'hl1',
  text: 'This is the highlight text',
  chapterTitle: 'Chapter 1',
  chapterProgress: 0.25,
  dateCreated: '2025-01-24',
};

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
        expect(screen.getByText('Copied!')).toBeInTheDocument();
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
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
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
        expect(screen.getByText('Copy failed')).toBeInTheDocument();
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
});
