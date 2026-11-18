import '@testing-library/jest-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import BookDetailsView from './BookDetailsView.svelte';
import type { Book, Highlight } from '../types';
import { makeBook, makeHighlight } from '../test-fixtures';
import { library } from '../stores/library.svelte';
import { _ } from '$lib/i18n';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
  convertFileSrc: vi.fn((src: string) => src)
}));

import { invoke } from '@tauri-apps/api/core';

const mockHighlights: Highlight[] = [
  {
    id: 'hl1',
    text: 'First highlight',
    chapterTitle: 'Chapter 1',
    chapterProgress: 0.1,
    dateCreated: '2025-01-24',
  },
  {
    id: 'hl2',
    text: 'Second highlight',
    chapterTitle: 'Chapter 1',
    chapterProgress: 0.2,
    dateCreated: '2025-01-25',
  },
  {
    id: 'hl3',
    text: 'Third highlight',
    chapterTitle: 'Chapter 2',
    chapterProgress: 0.5,
    dateCreated: '2025-01-26',
  },
].map(makeHighlight);

const mockBook: Book = makeBook({
  id: 1,
  title: 'Test Book Title',
  author: 'Test Author',
  isbn: '978-1234567890',
  publisher: 'Test Publisher',
  dateLastRead: '2025-01-20T10:30:00Z',
  description: 'A test book description',
  highlights: mockHighlights,
  coverPath: '/path/to/cover.jpg',
});

const mockBookNoHighlights: Book = makeBook({
  id: 2,
  title: 'Empty Book',
  author: 'Author',
  highlights: [],
});

const mockBookMinimal: Book = makeBook({
  id: 3,
  title: 'Minimal Book',
  author: '',
  highlights: [mockHighlights[0]],
});

describe('BookDetailsView', () => {
  it('renders book details view', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByTestId('book-details-view')).toBeInTheDocument();
  });

  it('renders book title', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByText('Test Book Title')).toBeInTheDocument();
  });

  it('renders book author', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByText('Test Author')).toBeInTheDocument();
  });

  it('shows "Unknown author" when author is empty', () => {
    render(BookDetailsView, { props: { book: mockBookMinimal } });
    expect(screen.getByText('Unknown author')).toBeInTheDocument();
  });

  it('renders cover image when coverPath exists', () => {
    const { container } = render(BookDetailsView, { props: { book: mockBook } });
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/path/to/cover.jpg');
    expect(img).toHaveAttribute('alt', '');
  });

  it('renders placeholder when coverPath is missing', () => {
    render(BookDetailsView, { props: { book: mockBookMinimal } });
    expect(screen.getByText('MB')).toBeInTheDocument();
  });

  it('the highlight count is translated and plural', () => {
    render(BookDetailsView, { props: { book: mockBookMinimal } });
    expect(screen.getByText('1 highlight')).toBeInTheDocument();
    expect(_).toHaveBeenCalledWith('book.highlightsCount', { count: 1 });
  });

  it('calls onClose when back button clicked', async () => {
    const handleClose = vi.fn();
    render(BookDetailsView, { props: { book: mockBook, onClose: handleClose } });
    const backButton = screen.getByLabelText('Back');
    await fireEvent.click(backButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders highlights list', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    const list = screen.getByTestId('highlights-list');
    expect(list).toBeInTheDocument();
  });

  it('renders highlight items', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByText('First highlight')).toBeInTheDocument();
    expect(screen.getByText('Second highlight')).toBeInTheDocument();
    expect(screen.getByText('Third highlight')).toBeInTheDocument();
  });

  it('shows empty state when no highlights', () => {
    render(BookDetailsView, { props: { book: mockBookNoHighlights } });
    expect(screen.getByText(/no highlights/i)).toBeInTheDocument();
  });

  describe('removed highlights and delete', () => {
    const removed = (h: Highlight): Highlight => ({ ...h, removedAt: '2026-11-01T10:00:00Z' });
    const mixedBook = makeBook({ id: 4, title: 'Mixed', author: 'A', highlights: [mockHighlights[0], removed(mockHighlights[1])] });
    const goneBook = makeBook({ id: 5, title: 'Gone', author: 'A', highlights: mockHighlights.map(removed) });

    beforeEach(() => {
      vi.clearAllMocks();
      library.activeReaderId = 9;
      // jsdom has no Web Animations; the Modal's transitions need one
      Element.prototype.animate ??= vi.fn(() => ({ cancel: vi.fn(), finished: Promise.resolve(), onfinish: null })) as never;
    });

    it('show removed is on by default', () => {
      render(BookDetailsView, { props: { book: mixedBook } });
      expect(screen.getByTestId('show-removed')).toBeChecked();
      expect(screen.getAllByTestId('highlight-item')).toHaveLength(2);
    });

    it('filter hides removed', async () => {
      render(BookDetailsView, { props: { book: mixedBook } });
      await fireEvent.click(screen.getByTestId('show-removed'));
      expect(screen.getAllByTestId('highlight-item')).toHaveLength(1);
      expect(screen.getByText('First highlight')).toBeInTheDocument();
    });

    it('no filter without removed highlights', () => {
      render(BookDetailsView, { props: { book: mockBook } });
      expect(screen.queryByTestId('show-removed')).toBeNull();
    });

    it('delete hidden while a highlight is live', () => {
      render(BookDetailsView, { props: { book: mixedBook } });
      expect(screen.queryByRole('button', { name: /delete book/i })).toBeNull();
    });

    it('delete asks to confirm, then deletes the book', async () => {
      const onClose = vi.fn();
      library.setBooks([goneBook]);
      render(BookDetailsView, { props: { book: goneBook, onClose } });

      await fireEvent.click(screen.getByRole('button', { name: /delete book/i }));
      expect(invoke).not.toHaveBeenCalledWith('delete_book', expect.anything());

      await fireEvent.click(within(screen.getByTestId('confirm-delete-book')).getByRole('button'));

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('delete_book', { readerId: 9, bookId: 5 });
        expect(library.books).toEqual([]);
        expect(onClose).toHaveBeenCalled();
      });
    });

    it('a failed export says why in the user’s language, not in Rust’s', async () => {
      vi.mocked(invoke).mockRejectedValueOnce({ kind: 'diskFull' });
      const onNotification = vi.fn();
      render(BookDetailsView, { props: { book: mockBook, onNotification } });

      await fireEvent.click(screen.getByRole('button', { name: /export to markdown/i }));

      await waitFor(() => expect(onNotification).toHaveBeenCalledWith('Couldn’t export: the disk is full.', 'error'));
    });

    it('a raw error from Rust never reaches the screen', async () => {
      vi.mocked(invoke).mockRejectedValueOnce('Library IO error: Permission denied (os error 13)');
      const onNotification = vi.fn();
      render(BookDetailsView, { props: { book: mockBook, onNotification } });

      await fireEvent.click(screen.getByRole('button', { name: /export to markdown/i }));

      await waitFor(() => expect(onNotification).toHaveBeenCalledWith('Error exporting highlights', 'error'));
    });

    it('toolbar and details export call the same command with the same ids', async () => {
      render(BookDetailsView, { props: { book: mockBook } });
      await fireEvent.click(screen.getByRole('button', { name: /export to markdown/i }));
      await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
      const fromDetails = vi.mocked(invoke).mock.calls[0];

      vi.clearAllMocks();
      library.setBooks([mockBook]);
      library.setSelectedBookIds([mockBook.id]);
      await library.exportSelected();
      const fromToolbar = vi.mocked(invoke).mock.calls[0];

      expect(fromDetails).toEqual(['export_library_books', { readerId: 9, bookIds: [1] }]);
      expect(fromToolbar).toEqual(fromDetails);
    });
  });
});
