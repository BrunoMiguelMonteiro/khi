/**
 * TypeScript type definitions for Khi
 * Mirrors the Rust models for IPC communication
 */

export interface Book {
  contentId: string;
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  language?: string;
  dateLastRead?: string;
  description?: string;
  coverPath?: string;
  highlights: Highlight[];
  isSelected: boolean;
}

export interface Highlight {
  id: string;
  text: string;
  annotation?: string;
  chapterTitle?: string;
  chapterProgress?: number;
  containerPath?: string;
  dateCreated: string;
  color?: string;
}

export interface KoboDevice {
  name: string;
  path: string;
  isValid: boolean;
  serialNumber?: string;
}

export interface ImportProgress {
  currentBook: string;
  booksProcessed: number;
  totalBooks: number;
  highlightsFound: number;
  percentage: number;
}

export interface ExportConfig {
  exportPath: string;
  metadata: {
    author: boolean;
    isbn: boolean;
    publisher: boolean;
    dateLastRead: boolean;
    language: boolean;
    description: boolean;
  };
  dateFormat: 'dd_mm_yyyy' | 'dd_month_yyyy' | 'iso8601';
}

export interface AppState {
  books: Book[];
  selectedBooks: string[];
  isImporting: boolean;
  importProgress?: ImportProgress;
  connectedDevice?: KoboDevice;
  settings: ExportConfig;
}

export interface LastImportRecord {
  lastImportDate: string;
  deviceId: string;
  booksImported: BookImportRecord[];
}

export interface BookImportRecord {
  isbn?: string;
  title: string;
  author: string;
  highlightsCount: number;
  exportedTo: string;
}

// ============================================
// Export Types (i18n Refactor)
// ============================================

/** Export data for a single highlight */
export interface ExportHighlightData {
  id: string;
  text: string;
  chapter: string | null;
  location: string;
  date: string;
}

/** Export data for a book with highlights */
export interface ExportBookData {
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  language: string | null;
  readDate: string | null;
  description: string | null;
  highlights: ExportHighlightData[];
}

// ============================================
// Settings Types (Fase 9)
// ============================================

/** Application settings structure */
export interface AppSettings {
  /** Export configuration */
  exportConfig: ExportConfig;
  /** UI preferences */
  uiPreferences: UiPreferences;
  /** Last import record */
  lastImport?: LastImportSettingsRecord;
  /** Version for migration support */
  version: string;
}

/** UI preferences */
export interface UiPreferences {
  /** Theme preference */
  theme: ThemePreference;
  /** Window width */
  windowWidth: number;
  /** Window height */
  windowHeight: number;
  /** Whether window is maximized */
  isMaximized: boolean;
  /** Whether to show onboarding on startup */
  showOnboarding: boolean;
  /** Library view mode (grid or list) */
  libraryViewMode: ViewMode;
  /** Sort preference for library */
  librarySort: SortPreference;
  /** Whether to auto-import when device is detected */
  autoImportOnConnect: boolean;
}

/** Theme preference */
export type ThemePreference = 'system' | 'light' | 'dark';

/** View mode for library */
export type ViewMode = 'grid' | 'list';

/** Sort preference for library */
export type SortPreference = 'title' | 'author' | 'date_last_read' | 'highlight_count';

/** Last import record for settings */
export interface LastImportSettingsRecord {
  /** Timestamp of the import */
  timestamp: string;
  /** Device ID (if available) */
  deviceId?: string;
  /** Number of books imported */
  booksCount: number;
  /** Number of highlights imported */
  highlightsCount: number;
}
