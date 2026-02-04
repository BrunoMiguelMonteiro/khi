import { useState, useEffect } from 'react';
import { NoKoboScreen } from '@/app/components/NoKoboScreen';
import { ImportingScreen } from '@/app/components/ImportingScreen';
import { BooksLibrary } from '@/app/components/BooksLibrary';
import { BookHighlights } from '@/app/components/BookHighlights';

type Screen = 'no-kobo' | 'importing' | 'library' | 'highlights';

export interface Highlight {
  id: string;
  text: string;
  page: number;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  gradient: string;
  highlightCount: number;
  highlights: Highlight[];
}

// Mock data
const mockBooks: Book[] = [
  {
    id: '1',
    title: 'The Design of Everyday Things',
    author: 'Don Norman',
    gradient: 'from-blue-400 to-blue-600',
    highlightCount: 12,
    highlights: [
      { id: '1-1', text: 'Good design is actually a lot harder to notice than poor design, in part because good designs fit our needs so well that the design is invisible.', page: 23 },
      { id: '1-2', text: 'The design of everyday things is in great danger of becoming the design of superfluous things.', page: 45 },
      { id: '1-3', text: 'Two of the most important characteristics of good design are discoverability and understanding.', page: 67 },
    ]
  },
  {
    id: '2',
    title: 'Atomic Habits',
    author: 'James Clear',
    gradient: 'from-green-400 to-green-600',
    highlightCount: 8,
    highlights: [
      { id: '2-1', text: 'You do not rise to the level of your goals. You fall to the level of your systems.', page: 12 },
      { id: '2-2', text: 'Every action you take is a vote for the type of person you wish to become.', page: 34 },
    ]
  },
  {
    id: '3',
    title: 'Thinking, Fast and Slow',
    author: 'Daniel Kahneman',
    gradient: 'from-purple-400 to-purple-600',
    highlightCount: 15,
    highlights: [
      { id: '3-1', text: 'Nothing in life is as important as you think it is while you are thinking about it.', page: 89 },
    ]
  },
  {
    id: '4',
    title: 'Deep Work',
    author: 'Cal Newport',
    gradient: 'from-red-400 to-red-600',
    highlightCount: 10,
    highlights: [
      { id: '4-1', text: 'To produce at your peak level you need to work for extended periods with full concentration on a single task free from distraction.', page: 56 },
    ]
  },
  {
    id: '5',
    title: 'The Pragmatic Programmer',
    author: 'David Thomas & Andrew Hunt',
    gradient: 'from-orange-400 to-orange-600',
    highlightCount: 18,
    highlights: [
      { id: '5-1', text: 'Care about your craft. There is no point in developing software unless you care about doing it well.', page: 78 },
    ]
  },
  {
    id: '6',
    title: 'Sapiens',
    author: 'Yuval Noah Harari',
    gradient: 'from-teal-400 to-teal-600',
    highlightCount: 22,
    highlights: [
      { id: '6-1', text: 'Biology enables, Culture forbids.', page: 145 },
    ]
  },
];

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('no-kobo');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

  // Apply theme to document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const handleViewBook = (book: Book) => {
    setSelectedBook(book);
    setCurrentScreen('highlights');
  };

  const handleBackToLibrary = () => {
    setCurrentScreen('library');
    setSelectedBook(null);
  };

  // Simulate Kobo connection flow
  const handleConnectKobo = () => {
    setCurrentScreen('importing');
    // Simulate import taking 3 seconds
    setTimeout(() => {
      setCurrentScreen('library');
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      {/* Dev Navigation Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-neutral-100 dark:bg-neutral-900 border-b border-neutral-300 dark:border-neutral-700 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setCurrentScreen('no-kobo')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                currentScreen === 'no-kobo'
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              No Kobo
            </button>
            <button
              onClick={() => setCurrentScreen('importing')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                currentScreen === 'importing'
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              Importing
            </button>
            <button
              onClick={() => setCurrentScreen('library')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                currentScreen === 'library'
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              Library
            </button>
            <button
              onClick={() => {
                setSelectedBook(mockBooks[0]);
                setCurrentScreen('highlights');
              }}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                currentScreen === 'highlights'
                  ? 'bg-black dark:bg-white text-white dark:text-black'
                  : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700'
              }`}
            >
              Highlights
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">Theme:</span>
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="px-3 py-1 text-sm bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded transition-colors"
            >
              {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pt-12">
        {currentScreen === 'no-kobo' && (
          <NoKoboScreen onConnect={handleConnectKobo} />
        )}
        
        {currentScreen === 'importing' && (
          <ImportingScreen />
        )}
        
        {currentScreen === 'library' && (
          <BooksLibrary
            books={mockBooks}
            onViewBook={handleViewBook}
          />
        )}
        
        {currentScreen === 'highlights' && selectedBook && (
          <BookHighlights
            book={selectedBook}
            onBack={handleBackToLibrary}
          />
        )}
      </div>
    </div>
  );
}
