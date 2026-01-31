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
    isExcluded: false,
    isEditing: false,
  },
  {
    id: 'hl2',
    text: 'Second highlight',
    chapterTitle: 'Chapter 1',
    chapterProgress: 0.2,
    dateCreated: '2025-01-25',
    isExcluded: false,
    isEditing: false,
    personalNote: 'My note',
  },
  {
    id: 'hl3',
    text: 'Third highlight',
    chapterTitle: 'Chapter 2',
    chapterProgress: 0.5,
    dateCreated: '2025-01-26',
    isExcluded: true,
    isEditing: false,
    editedText: 'Edited text',
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
    // Should show 2 active (3 total - 1 excluded)
    // The stats are in the title attributes
    expect(screen.getByTitle('Active')).toBeInTheDocument();
  });

  it('shows excluded count when there are excluded highlights', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByTitle('Excluded')).toBeInTheDocument();
  });

  it('shows edited count when there are edited highlights', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByTitle('Edited')).toBeInTheDocument();
  });

  it('shows notes count when there are highlights with notes', () => {
    render(BookDetailsView, { props: { book: mockBook } });
    expect(screen.getByTitle('With notes')).toBeInTheDocument();
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

  it('calls onUpdateHighlight when toggle exclude', async () => {
    const handleUpdate = vi.fn();
    render(BookDetailsView, { 
      props: { 
        book: mockBook,
        onUpdateHighlight: handleUpdate
      } 
    });
    
    const excludeBtns = screen.getAllByTestId('highlight-exclude-btn');
    await fireEvent.click(excludeBtns[0]);
    
    expect(handleUpdate).toHaveBeenCalledWith('book-1', 'hl1', { isExcluded: true });
  });

  it('calls onUpdateHighlight when edit highlight', async () => {
    const handleUpdate = vi.fn();
    render(BookDetailsView, { 
      props: { 
        book: mockBook,
        onUpdateHighlight: handleUpdate
      } 
    });
    
    // Click edit button
    const editBtns = screen.getAllByTestId('highlight-edit-btn');
    await fireEvent.click(editBtns[0]);
    
    // Type new text
    const textarea = screen.getByTestId('highlight-edit-textarea');
    await fireEvent.input(textarea, { target: { value: 'New edited text' } });
    
    // Save
    const saveBtn = screen.getByTestId('highlight-save-edit');
    await fireEvent.click(saveBtn);
    
    expect(handleUpdate).toHaveBeenCalledWith('book-1', 'hl1', { editedText: 'New edited text' });
  });

  it('calls onUpdateHighlight when add note', async () => {
    const handleUpdate = vi.fn();
    render(BookDetailsView, { 
      props: { 
        book: mockBook,
        onUpdateHighlight: handleUpdate
      } 
    });
    
    // Click note button
    const noteBtns = screen.getAllByTestId('highlight-note-btn');
    await fireEvent.click(noteBtns[0]);
    
    // Type note
    const textarea = screen.getByTestId('highlight-note-textarea');
    await fireEvent.input(textarea, { target: { value: 'My new note' } });
    
    // Save
    const saveBtn = screen.getByTestId('highlight-save-note');
    await fireEvent.click(saveBtn);
    
    expect(handleUpdate).toHaveBeenCalledWith('book-1', 'hl1', { personalNote: 'My new note' });
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
});
