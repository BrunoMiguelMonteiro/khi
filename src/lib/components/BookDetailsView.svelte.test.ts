import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BookDetailsView from './BookDetailsView.svelte';
import type { Book, Highlight } from '../types';

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
];

const mockBook: Book = {
  contentId: 'book-1',
  title: 'Test Book Title',
  author: 'Test Author',
  isbn: '978-1234567890',
  publisher: 'Test Publisher',
  dateLastRead: '2025-01-20T10:30:00Z',
  description: 'A test book description',
  highlights: mockHighlights,
  isSelected: true,
  coverPath: '/path/to/cover.jpg',
};

const mockBookNoHighlights: Book = {
  contentId: 'book-2',
  title: 'Empty Book',
  author: 'Author',
  highlights: [],
  isSelected: false,
};

const mockBookMinimal: Book = {
  contentId: 'book-3',
  title: 'Minimal Book',
  author: '',
  highlights: [mockHighlights[0]],
  isSelected: false,
};

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
});
