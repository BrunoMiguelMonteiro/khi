import { readable } from 'svelte/store';

// Mock translation function that returns the key or a default value
export function t(key: string, params?: Record<string, string | number>): string {
  // Simple mock that returns the last part of the key or a formatted string
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1];
  
  // Return specific translations for common keys
  const translations: Record<string, string> = {
    'unknownAuthor': 'Unknown author',
    'back': 'Back',
    'highlights': 'Highlights',
    'noHighlights': 'No highlights available for this book',
    'active': 'Active',
    'excluded': 'Excluded',
    'withNotes': 'With notes',
    'noChapter': 'No chapter',
    'title': 'Library',
    'booksCount': '{count} books',
    'selectedCount': '{count} selected',
    'noBooks': 'No books found',
    'noBooksSubtitle': 'Connect your Kobo and import your highlights',
    'import': 'Import',
    'importTitle': 'Import from Kobo',
    'importProgress': 'Import progress',
    'selectAll': 'Select All',
    'clear': 'Clear',
    'invert': 'Invert',
    'exportSelected': 'Export Selected',
    'deviceReady': 'Kobo detected! Ready to import.',
    'close': 'Close notification',
    'settings': 'Settings',
  };
  
  let result = translations[lastPart] || lastPart;
  
  // Replace parameters
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      result = result.replace(`{${k}}`, String(v));
    });
  }
  
  return result;
}

// Export the store version for $t syntax
export const _t = readable(t);
