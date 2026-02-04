import { ArrowLeft, FileDown } from 'lucide-react';
import type { Book } from '@/app/App';

interface BookHighlightsProps {
  book: Book;
  onBack: () => void;
}

export function BookHighlights({ book, onBack }: BookHighlightsProps) {
  const exportToMarkdown = () => {
    console.log('Exporting to markdown:', book.title);
  };

  return (
    <div className="min-h-screen">
      {/* Header with App Name */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="font-bold text-2xl tracking-tight">khi</div>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
        <div className="max-w-4xl mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              title="Back to Library"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>

            <button
              onClick={exportToMarkdown}
              className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
              title="Export to Markdown"
            >
              <FileDown className="w-4 h-4" />
              <span className="text-sm">Export to Markdown</span>
            </button>
          </div>
        </div>
      </div>

      {/* Book Info & Highlights */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Book Header */}
        <div className="flex items-start gap-6 mb-12">
          <div className={`w-32 h-48 rounded-lg bg-gradient-to-br ${book.gradient} flex-shrink-0`} />
          <div className="flex-1 pt-2">
            <h1 className="text-3xl font-semibold mb-2">{book.title}</h1>
            <p className="text-lg text-neutral-500 dark:text-neutral-500 mb-4">{book.author}</p>
            <p className="text-sm text-neutral-400 dark:text-neutral-600">
              {book.highlightCount} {book.highlightCount === 1 ? 'highlight' : 'highlights'}
            </p>
          </div>
        </div>

        {/* Highlights List */}
        <div className="space-y-8">
          {book.highlights.length > 0 ? (
            book.highlights.map((highlight) => (
              <div key={highlight.id} className="space-y-2">
                <blockquote className="text-base leading-relaxed border-l-4 border-neutral-300 dark:border-neutral-700 pl-4 py-1">
                  {highlight.text}
                </blockquote>
                <p className="text-xs text-neutral-400 dark:text-neutral-600 pl-4">
                  Page {highlight.page}
                </p>
              </div>
            ))
          ) : (
            <div className="text-center py-16 text-neutral-400 dark:text-neutral-600">
              No highlights available for this book.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
