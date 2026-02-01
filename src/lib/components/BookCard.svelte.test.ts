import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import BookCard from './BookCard.svelte';
import type { Book } from '../types';

// Mock i18n
vi.mock('$lib/i18n', () => ({
  _: {
    subscribe: (fn: (val: any) => void) => {
      fn((key: string, params: any) => {
        if (key === 'book.highlightsCount') return `${params.count} highlights`;
        if (key === 'book.noHighlights') return 'No highlights available for this book';
        if (key === 'screens.bookDetails.unknownAuthor') return 'Unknown author';
        if (key === 'screens.bookDetails.highlights') return 'Highlights';
        return key;
      });
      return () => {};
    }
  }
}));

const mockBook: Book = {
  contentId: 'book-1',
  title: 'Test Book Title',
  author: 'Test Author',
  isbn: '978-1234567890',
  highlights: [
    {
      id: 'hl1',
      text: 'Highlight 1',
      dateCreated: '2025-01-15',
    },
    {
      id: 'hl2',
      text: 'Highlight 2',
      dateCreated: '2025-01-16',
    },
  ],
  isSelected: false,
  dateLastRead: '2025-01-20T10:30:00Z',
  coverPath: '/path/to/cover.jpg',
};

const mockBookNoCover: Book = {
  contentId: 'book-2',
  title: 'Book Without Cover',
  author: 'Another Author',
  highlights: [],
  isSelected: false,
};

const mockBookLongTitle: Book = {
  contentId: 'book-3',
  title: 'A Very Long Book Title That Should Be Truncated When Displayed In The Card',
  author: 'Some Author With A Very Long Name',
  highlights: [{ id: 'hl1', text: 'Test', dateCreated: '2025-01-15' }],
  isSelected: false,
  dateLastRead: '2025-01-10T08:00:00Z',
};

describe('BookCard', () => {
  it('renders book title', () => {
    render(BookCard, { props: { book: mockBook } });
    expect(screen.getByText('Test Book Title')).toBeInTheDocument();
  });

  it('renders book author', () => {
    render(BookCard, { props: { book: mockBook } });
    expect(screen.getByText('Test Author')).toBeInTheDocument();
  });

  it('shows "Unknown author" when author is empty', () => {
    const bookWithoutAuthor = { ...mockBook, author: '' };
    render(BookCard, { props: { book: bookWithoutAuthor } });
    expect(screen.getByText('Unknown author')).toBeInTheDocument();
  });

  it('renders cover image when coverPath exists', () => {
    render(BookCard, { props: { book: mockBook } });
    const img = document.querySelector('.cover-image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/path/to/cover.jpg');
  });

  it('renders placeholder when coverPath is missing', () => {
    render(BookCard, { props: { book: mockBookNoCover } });
    expect(screen.getByText('BW')).toBeInTheDocument();
    expect(document.querySelector('.cover-image')).not.toBeInTheDocument();
  });

  it('displays correct highlight count for multiple highlights', () => {
    render(BookCard, { props: { book: mockBook } });
    expect(screen.getByText('2 highlights')).toBeInTheDocument();
  });

  it('displays "No highlights" when no highlights', () => {
    render(BookCard, { props: { book: mockBookNoCover } });
    expect(screen.getByText('No highlights available for this book')).toBeInTheDocument();
  });

  it('displays formatted modification date', () => {
    render(BookCard, { props: { book: mockBook } });
    expect(screen.getByText(/2025/)).toBeInTheDocument();
  });

  it('applies selected class when isSelected is true', () => {
    render(BookCard, { props: { book: mockBook, isSelected: true } });
    const card = screen.getByTestId('book-card');
    expect(card).toHaveClass('selected');
  });

  it('calls onClick when content is clicked', async () => {
    const handleClick = vi.fn();
    render(BookCard, { props: { book: mockBook, onClick: handleClick } });
    
    const title = screen.getByText('Test Book Title');
    const contentBtn = title.closest('button');
    expect(contentBtn).not.toBeNull();
    await fireEvent.click(contentBtn!);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleSelection when selection button is clicked', async () => {
    const handleToggle = vi.fn();
    render(BookCard, { props: { book: mockBook, onToggleSelection: handleToggle } });
    
    // Find selection button by aria-label 'Select' (since isSelected is false)
    const selectionBtn = screen.getByLabelText('Select');
    await fireEvent.click(selectionBtn);
    
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('renders as a div element with buttons inside', () => {
    render(BookCard, { props: { book: mockBook } });
    const card = screen.getByTestId('book-card');
    expect(card.tagName).toBe('DIV');
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('truncates long titles with ellipsis', () => {
    render(BookCard, { props: { book: mockBookLongTitle } });
    const title = screen.getByText(/A Very Long Book Title/);
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass('book-title');
  });
});
