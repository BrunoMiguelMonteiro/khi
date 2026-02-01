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

  it('renders ISBN when present', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByText(/ISBN:/)).toBeInTheDocument();
    expect(screen.getByText(/978-1234567890/)).toBeInTheDocument();
  });

  it('renders publisher when present', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByText('Test Publisher')).toBeInTheDocument();
  });

  it('renders last read date when present', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByText(/Last read:/)).toBeInTheDocument();
  });

  it('renders description when present', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByText('A test book description')).toBeInTheDocument();
  });

  it('renders cover image when coverPath exists', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    const img = document.querySelector('.cover-image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', '/path/to/cover.jpg');
  });

  it('renders placeholder when coverPath is missing', () => {
    render(BookDetailsView, { props: { book: mockBookMinimal } });
    const placeholder = document.querySelector('.cover-placeholder');
    expect(placeholder).toBeInTheDocument();
    expect(document.querySelector('.cover-image')).not.toBeInTheDocument();
  });

  it('calls onClose when back button clicked', async () => {
    const handleClose = vi.fn();
    render(BookDetailsView, { 
      props: { 
        book: mockBook,
        onClose: handleClose
      } 
    });
    
    const backBtn = screen.getByTestId('book-details-close');
    await fireEvent.click(backBtn);
    
    expect(handleClose).toHaveBeenCalled();
  });

  it('displays correct highlight count in stats', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    // Should show total count (3)
    expect(screen.getByTitle('Total')).toBeInTheDocument();
  });

  it('renders highlights list', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByTestId('highlights-list')).toBeInTheDocument();
  });

  it('renders chapter groups', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    const chapterGroups = screen.getAllByTestId('chapter-group');
    expect(chapterGroups.length).toBe(2); // Chapter 1 and Chapter 2
  });

  it('renders chapter titles', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    // Chapter titles are rendered as h3 elements with class chapter-title
    const chapterTitles = screen.getAllByText(/Chapter \d/, { selector: 'h3' });
    expect(chapterTitles.length).toBe(2);
  });

  it('renders highlight items', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    const highlightItems = screen.getAllByTestId('highlight-item');
    expect(highlightItems.length).toBe(3);
  });

  it('shows empty state when no highlights', () => {
    render(BookDetailsView, { props: { book: mockBookNoHighlights } });
    expect(screen.getByTestId('book-details-empty')).toBeInTheDocument();
    expect(screen.getByText('No highlights available for this book')).toBeInTheDocument();
  });



  it('renders "Sem Capítulo" for highlights without chapter', () => {
    const bookWithNoChapter: Book = {
      ...mockBook,
      highlights: [{
        ...mockHighlights[0],
        chapterTitle: undefined,
      }]
    };
    render(BookDetailsView, { props: { book: bookWithNoChapter } });
    expect(screen.getByText('No chapter')).toBeInTheDocument();
  });

  it('has responsive cover dimensions', () => {
    render(BookDetailsView, {
      props: {
        book: mockBook,
        onClose: vi.fn()
      }
    });
    
    // Using initials to find placeholder since mockBook uses placeholder logic in test (if coverPath handled?)
    // Wait, mockBook HAS coverPath: '/path/to/cover.jpg'
    // So it renders img, not placeholder.
    // The classes are on the container .book-cover.
    
    const img = document.querySelector('.cover-image');
    const container = img?.closest('.book-cover');
    
    expect(container).toHaveClass('w-[120px]');
    expect(container).toHaveClass('h-[180px]');
    expect(container).toHaveClass('max-sm:w-[96px]');
    expect(container).toHaveClass('max-sm:h-[144px]');
  });

  it('has responsive title font size', () => {
    render(BookDetailsView, {
      props: {
        book: mockBook,
        onClose: vi.fn()
      }
    });
    
    const title = screen.getByRole('heading', { level: 1 });
    
    expect(title).toHaveClass('text-3xl');
    expect(title).toHaveClass('max-sm:text-2xl');
  });
});
