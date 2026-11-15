/**
 * TypeScript type definitions for Khi.
 *
 * Types that cross the IPC boundary come from `./bindings`, which is generated
 * from the Rust structs by tauri-specta (see `src-tauri/src/lib.rs`).
 * Do not redeclare them here: change the Rust struct and regenerate instead.
 * The `_Serialize` variants are what Rust sends to the frontend.
 */
import type {
  AppSettings_Serialize,
  DateFormat,
  ExportConfig_Serialize,
  KoboDevice_Serialize,
  LibraryBook_Serialize,
  LibraryHighlight_Serialize,
  Reader_Serialize,
  SyncReport,
  SortPreference_Serialize,
  ThemePreference_Serialize,
  UiPreferences_Serialize,
  ViewMode_Serialize
} from './bindings';

export type { DateFormat, SyncReport };

/**
 * A book of the persistent Library (`id` is the Library's, not the Kobo's).
 * Selection state lives in `library.selectedBookIds`, not on the book.
 */
export type Book = LibraryBook_Serialize;
export type Highlight = LibraryHighlight_Serialize;
export type Reader = Reader_Serialize;
export type KoboDevice = KoboDevice_Serialize;
export type ExportConfig = ExportConfig_Serialize;

export interface ImportProgress {
  currentBook: string;
  booksProcessed: number;
  totalBooks: number;
  highlightsFound: number;
  percentage: number;
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

export type AppSettings = AppSettings_Serialize;
export type UiPreferences = UiPreferences_Serialize;
export type ThemePreference = ThemePreference_Serialize;
export type ViewMode = ViewMode_Serialize;
export type SortPreference = SortPreference_Serialize;

export type UiState = 'no-device' | 'scanning' | 'importing' | 'library' | 'book-details';
