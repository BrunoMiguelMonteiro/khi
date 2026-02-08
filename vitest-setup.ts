import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock svelte-i18n store
const mockT = vi.fn((key: string, params?: Record<string, string | number>) => {
  // Simple translations map for common keys (supports full keys and last part)
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
    'importingTitle': 'Importing highlights...',
    'importProgress': 'Import progress',
    'selectAll': 'Select All',
    'selectAllTitle': 'Select all (Ctrl+A)',
    'clear': 'Clear',
    'clearTitle': 'Clear selection',
    'invert': 'Invert',
    'invertTitle': 'Invert selection',
    'exportSelected': 'Export Selected',
    'deviceReady': 'Kobo detected! Ready to import.',
    'close': 'Close notification',
    'settings': 'Settings',
    'name': 'Khi',
    'appTitle': 'Khi - Kobo Highlights Exporter',
    'lastRead': 'Last read',
    'highlight.copy': 'Copy quote',
    'highlight.copied': 'Copied!',
    'highlight.copyError': 'Copy failed',
    'copy': 'Copy quote',
    'copied': 'Copied!',
    'copyError': 'Copy failed',
  };

  // Try full key first, then last part of key
  const parts = key.split('.');
  const lastPart = parts[parts.length - 1];
  let result = translations[key] || translations[lastPart] || key;
  
  // Replace parameters
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      result = result.replace(`{${k}}`, String(v));
    });
  }
  
  return result;
});

// Create a mock store that svelte can subscribe to
const createMockStore = (value: any) => ({
  subscribe: (fn: (v: any) => void) => {
    fn(value);
    return { unsubscribe: () => {} };
  }
});

// Mock $lib/i18n module
vi.mock('$lib/i18n', () => ({
  t: Object.assign(mockT, {
    subscribe: (fn: (v: typeof mockT) => void) => {
      fn(mockT);
      return { unsubscribe: () => {} };
    }
  }),
  _: Object.assign(mockT, {
    subscribe: (fn: (v: typeof mockT) => void) => {
      fn(mockT);
      return { unsubscribe: () => {} };
    }
  }),
  locale: createMockStore('en'),
  config: { fallbackLocale: 'en', initialLocale: 'en', locales: ['en', 'pt'] }
}));

// Also mock svelte-i18n directly for any imports from there
vi.mock('svelte-i18n', () => ({
  t: Object.assign(mockT, {
    subscribe: (fn: (v: typeof mockT) => void) => {
      fn(mockT);
      return { unsubscribe: () => {} };
    }
  }),
  locale: createMockStore('en'),
  register: vi.fn(),
  init: vi.fn(),
  getLocaleFromNavigator: vi.fn(() => 'en')
}));

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((src) => src)
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setTheme: vi.fn().mockResolvedValue(undefined)
  }))
}));

// jsdom does not implement matchMedia — provide a minimal stub so that
// module-level code (e.g. the settings store $effect) doesn't throw.
// Individual tests can override this with a more detailed mock.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}
