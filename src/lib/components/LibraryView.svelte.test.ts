import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import LibraryView from './LibraryView.svelte';
import type { Book } from '../types';

// Mock i18n
vi.mock('$lib/i18n', () => ({
  _: {
    subscribe: (fn: (val: any) => void) => {
      fn((key: string, params: any) => {
        if (key === 'screens.library.booksCount') return `${params.count} books`;
        if (key === 'screens.library.selectedCount') return `${params.count} selected`;
        if (key === 'screens.library.noBooks') return 'No books found';
        if (key === 'screens.library.import') return 'Import';
        if (key === 'screens.library.exportSelected') return 'Export Selected';
        if (key === 'book.highlightsCount') return 'Highlights'; 
        return key;
      });
      return () => {};
    }
  }
}));

const mockBooks: Book[] = [
  {
    contentId: 'book-1',
    title: 'Book One',
    author: 'Author One',
    highlights: [{ id: 'h1', text: 'Highlight 1', dateCreated: '2025-01-15' }],
    isSelected: false,
  },
  {
    contentId: 'book-2',
    title: 'Book Two',
    author: 'Author Two',
    highlights: [],
    isSelected: false,
  },
  {
    contentId: 'book-3',
    title: 'Book Three',
    author: 'Author Three',
    highlights: [
      { id: 'h2', text: 'Highlight 2', dateCreated: '2025-01-16' },
      { id: 'h3', text: 'Highlight 3', dateCreated: '2025-01-17' },
    ],
    isSelected: false,
  },
];

async function clickBookContent(card: HTMLElement, options?: any) {
  const btn = card.querySelector('.content-btn');
  if (!btn) throw new Error('Content button not found inside card');
  await fireEvent.click(btn, options);
}

describe('LibraryView', () => {
  it('renders library view', () => {
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: [],
        onSelectionChange: vi.fn()
      }
    });
    
    expect(screen.getByTestId('library-view')).toBeInTheDocument();
  });

  it('displays book count', () => {
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: [],
        onSelectionChange: vi.fn()
      }
    });
    
    expect(screen.getByText('3 books')).toBeInTheDocument();
  });

  it('displays selection count', () => {
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: ['book-1', 'book-2'],
        onSelectionChange: vi.fn()
      }
    });
    
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('renders all books in grid', () => {
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: [],
        onSelectionChange: vi.fn()
      }
    });
    
    const bookCards = screen.getAllByTestId('book-card');
    expect(bookCards.length).toBe(3);
  });

  it('renders empty state when no books', () => {
    render(LibraryView, {
      props: {
        books: [],
        selectedBookIds: [],
        onSelectionChange: vi.fn()
      }
    });
    
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No books found')).toBeInTheDocument();
  });

  it('calls onSelectionChange when book is clicked', async () => {
    const handleSelectionChange = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: [],
        onSelectionChange: handleSelectionChange
      }
    });
    
    const bookCards = screen.getAllByTestId('book-card');
    await clickBookContent(bookCards[0]);
    
    expect(handleSelectionChange).toHaveBeenCalledWith(['book-1']);
  });

  it('selects multiple books with Ctrl+click', async () => {
    const handleSelectionChange = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: ['book-1'],
        onSelectionChange: handleSelectionChange
      }
    });
    
    const bookCards = screen.getAllByTestId('book-card');
    await clickBookContent(bookCards[1], { ctrlKey: true });
    
    expect(handleSelectionChange).toHaveBeenCalledWith(['book-1', 'book-2']);
  });

  it('deselects book with Ctrl+click when already selected', async () => {
    const handleSelectionChange = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: ['book-1', 'book-2'],
        onSelectionChange: handleSelectionChange
      }
    });
    
    const bookCards = screen.getAllByTestId('book-card');
    await clickBookContent(bookCards[0], { ctrlKey: true });
    
    expect(handleSelectionChange).toHaveBeenCalledWith(['book-2']);
  });

  it('selects range with Shift+click', async () => {
    const handleSelectionChange = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: ['book-1'],
        onSelectionChange: handleSelectionChange
      }
    });
    
    const bookCards = screen.getAllByTestId('book-card');
    // First click book-1 to set lastSelectedIndex
    await clickBookContent(bookCards[0]);
    // Then shift-click book-3
    await clickBookContent(bookCards[2], { shiftKey: true });
    
    // Shift+click without Ctrl replaces selection with range
    expect(handleSelectionChange).toHaveBeenLastCalledWith(['book-1', 'book-2', 'book-3']);
  });

  it('selects all books when clicking "Selecionar todos"', async () => {
    const handleSelectionChange = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: [],
        onSelectionChange: handleSelectionChange
      }
    });
    
    // Find button by title since text now includes icon
    const selectAllBtn = screen.getByTitle('screens.library.selectAllTitle'); // i18n mock returns key if unknown
    // Actually the i18n mock returns "Select all (Ctrl+A)" only if I map it.
    // The component uses $_('screens.library.selectAllTitle')
    // My mock doesn't map 'screens.library.selectAllTitle', so it returns the key.
    // I should update the query or the mock.
    // Let's update the mock above to include it, or query by key.
    // I updated the mock above to return key by default.
    // So looking for title="screens.library.selectAllTitle" should work.
    
    const selectAllBtnFound = screen.getByTitle('screens.library.selectAllTitle');
    await fireEvent.click(selectAllBtnFound);
    
    expect(handleSelectionChange).toHaveBeenCalledWith(['book-1', 'book-2', 'book-3']);
  });

  it('deselects all books when clicking "Limpar"', async () => {
    const handleSelectionChange = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: ['book-1', 'book-2'],
        onSelectionChange: handleSelectionChange
      }
    });
    
    // Using key because of mock
    const deselectBtn = screen.getByText('screens.library.clear');
    await fireEvent.click(deselectBtn);
    
    expect(handleSelectionChange).toHaveBeenCalledWith([]);
  });

  it('inverts selection when clicking "Inverter"', async () => {
    const handleSelectionChange = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: ['book-1', 'book-2'],
        onSelectionChange: handleSelectionChange
      }
    });
    
    // Using key because of mock
    const invertBtn = screen.getByText('screens.library.invert');
    await fireEvent.click(invertBtn);
    
    expect(handleSelectionChange).toHaveBeenCalledWith(['book-3']);
  });

  it('calls onBooksImport when import button clicked', async () => {
    const handleImport = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: [],
        onSelectionChange: vi.fn(),
        onBooksImport: handleImport
      }
    });
    
    const importBtn = screen.getByText('Import');
    await fireEvent.click(importBtn);
    
    expect(handleImport).toHaveBeenCalled();
  });

  it('calls onBooksExport when export button clicked', async () => {
    const handleExport = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: ['book-1'],
        onSelectionChange: vi.fn(),
        onBooksExport: handleExport
      }
    });
    
    const exportBtn = screen.getByText('Export Selected (1)');
    await fireEvent.click(exportBtn);
    
    expect(handleExport).toHaveBeenCalled();
  });

  it('disables export button when no books selected', () => {
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: [],
        onSelectionChange: vi.fn(),
        onBooksExport: vi.fn()
      }
    });
    
    const exportBtn = screen.getByText('Export Selected (0)');
    expect(exportBtn).toBeDisabled();
  });

  it('shows import progress when isImporting is true', () => {
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: [],
        onSelectionChange: vi.fn(),
        isImporting: true,
        importProgress: {
          currentBook: 'Importing Book One',
          percentage: 50
        }
      }
    });
    
    expect(screen.getByTestId('import-progress')).toBeInTheDocument();
    expect(screen.getByText('Importing Book One')).toBeInTheDocument();
  });

  it('disables buttons during import', () => {
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: [],
        onSelectionChange: vi.fn(),
        onBooksImport: vi.fn(),
        isImporting: true
      }
    });
    
    expect(screen.getByTitle('screens.library.selectAllTitle')).toBeDisabled();
    expect(screen.getByTitle('screens.library.clearTitle')).toBeDisabled();
    expect(screen.getByTitle('screens.library.invertTitle')).toBeDisabled();
  });

  it('shows import button in empty state when onBooksImport provided', () => {
    render(LibraryView, {
      props: {
        books: [],
        selectedBookIds: [],
        onSelectionChange: vi.fn(),
        onBooksImport: vi.fn()
      }
    });
    
    expect(screen.getByText('screens.library.importTitle')).toBeInTheDocument();
  });

  it('uses Cmd+click on macOS for multi-selection', async () => {
    const handleSelectionChange = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: ['book-1'],
        onSelectionChange: handleSelectionChange
      }
    });
    
    const bookCards = screen.getAllByTestId('book-card');
    await clickBookContent(bookCards[1], { metaKey: true });
    
    expect(handleSelectionChange).toHaveBeenCalledWith(['book-1', 'book-2']);
  });

  it('combines Ctrl+Shift for range addition', async () => {
    const handleSelectionChange = vi.fn();
    render(LibraryView, {
      props: {
        books: mockBooks,
        selectedBookIds: ['book-1'],
        onSelectionChange: handleSelectionChange
      }
    });
    
    const bookCards = screen.getAllByTestId('book-card');
    // First click book-1
    await clickBookContent(bookCards[0]);
    // Then Ctrl+Shift+click book-3
    await clickBookContent(bookCards[2], { ctrlKey: true, shiftKey: true });
    
    expect(handleSelectionChange).toHaveBeenLastCalledWith(['book-1', 'book-2', 'book-3']);
  });
});
