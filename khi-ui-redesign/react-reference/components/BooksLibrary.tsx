import { useState } from 'react';
import { Download, Settings, Grid3x3, List, X, ArrowUpDown, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/app/components/ui/checkbox';
import { SettingsModal } from '@/app/components/SettingsModal';
import type { Book } from '@/app/App';

type SortOption = 'title-asc' | 'title-desc' | 'author-asc' | 'highlights-desc' | 'highlights-asc';

interface BooksLibraryProps {
  books: Book[];
  onViewBook: (book: Book) => void;
}

export function BooksLibrary({ books, onViewBook }: BooksLibraryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('title-asc');
  const [isSortOpen, setIsSortOpen] = useState(false);

  const sortOptions = [
    { value: 'title-asc' as SortOption, label: 'Title (A-Z)' },
    { value: 'title-desc' as SortOption, label: 'Title (Z-A)' },
    { value: 'author-asc' as SortOption, label: 'Author (A-Z)' },
    { value: 'highlights-desc' as SortOption, label: 'Most Highlights' },
    { value: 'highlights-asc' as SortOption, label: 'Least Highlights' },
  ];

  const sortedBooks = [...books].sort((a, b) => {
    switch (sortBy) {
      case 'title-asc':
        return a.title.localeCompare(b.title);
      case 'title-desc':
        return b.title.localeCompare(a.title);
      case 'author-asc':
        return a.author.localeCompare(b.author);
      case 'highlights-desc':
        return b.highlightCount - a.highlightCount;
      case 'highlights-asc':
        return a.highlightCount - b.highlightCount;
      default:
        return 0;
    }
  });

  const currentSortLabel = sortOptions.find(opt => opt.value === sortBy)?.label || 'Title (A-Z)';

  const toggleBookSelection = (bookId: string) => {
    const newSelected = new Set(selectedBooks);
    if (newSelected.has(bookId)) {
      newSelected.delete(bookId);
    } else {
      newSelected.add(bookId);
    }
    setSelectedBooks(newSelected);
  };

  const clearSelection = () => {
    setSelectedBooks(new Set());
  };

  const exportAll = () => {
    console.log('Exporting all books');
  };

  const exportSelected = () => {
    console.log('Exporting selected books:', Array.from(selectedBooks));
  };

  return (
    <div className="min-h-screen">
      {/* Header with App Name */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-bold text-2xl tracking-tight">khi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={exportAll}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                title="Export All"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Export All</span>
              </button>
              <button
                onClick={exportSelected}
                disabled={selectedBooks.size === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Export Selected"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm">Export Selected</span>
              </button>
              {selectedBooks.size > 0 && (
                <button
                  onClick={clearSelection}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                  title="Clear Selection"
                >
                  <X className="w-4 h-4" />
                  <span className="text-sm">Clear Selection</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Sort Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsSortOpen(!isSortOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950"
                  title="Sort books"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  <span className="text-sm">{currentSortLabel}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>

                {isSortOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsSortOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-lg shadow-lg z-20 overflow-hidden">
                      {sortOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setIsSortOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors ${
                            sortBy === option.value
                              ? 'bg-neutral-100 dark:bg-neutral-800 font-medium'
                              : ''
                          }`}
                        >
                          {sortBy === option.value && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-neutral-900 dark:bg-neutral-100 mr-2" />
                          )}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1 bg-white dark:bg-neutral-950 rounded-lg p-1 border border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${
                    viewMode === 'grid'
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                  title="Grid View"
                >
                  <Grid3x3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${
                    viewMode === 'list'
                      ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-black'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-900'
                  }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Books Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {sortedBooks.map((book) => (
              <div key={book.id} className="space-y-3">
                <div className="relative group">
                  <div
                    onClick={() => onViewBook(book)}
                    className={`aspect-[2/3] rounded-lg bg-gradient-to-br ${book.gradient} cursor-pointer transition-transform hover:scale-105`}
                  />
                  <div className="absolute top-2 left-2">
                    <Checkbox
                      checked={selectedBooks.has(book.id)}
                      onCheckedChange={() => toggleBookSelection(book.id)}
                      className="bg-white dark:bg-neutral-900 border-2"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm leading-tight line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500">
                    {book.author}
                  </p>
                  <p className="text-xs text-neutral-400 dark:text-neutral-600">
                    {book.highlightCount} {book.highlightCount === 1 ? 'highlight' : 'highlights'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedBooks.map((book) => (
              <div
                key={book.id}
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors"
              >
                <Checkbox
                  checked={selectedBooks.has(book.id)}
                  onCheckedChange={() => toggleBookSelection(book.id)}
                  className="border-2"
                />
                <div
                  onClick={() => onViewBook(book)}
                  className={`w-8 h-12 rounded bg-gradient-to-br ${book.gradient} cursor-pointer flex-shrink-0`}
                />
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{book.title}</h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-500 truncate">
                    {book.author}
                  </p>
                </div>
                <div className="text-xs text-neutral-400 dark:text-neutral-600 flex-shrink-0">
                  {book.highlightCount} {book.highlightCount === 1 ? 'highlight' : 'highlights'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}