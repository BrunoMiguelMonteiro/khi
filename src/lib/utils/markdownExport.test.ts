import { describe, it, expect, beforeEach } from 'vitest';
import { generateMarkdown } from './markdownExport';
import type { ExportBookData, ExportHighlightData } from '../types';

// Mock the i18n module
vi.mock('$lib/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'export.metadata.author': 'Author',
      'export.metadata.isbn': 'ISBN',
      'export.metadata.publisher': 'Publisher',
      'export.metadata.language': 'Language',
      'export.metadata.dateLastRead': 'Date last read',
      'export.metadata.location': 'Location',
      'export.metadata.date': 'Date'
    };
    return translations[key] || key;
  }
}));

describe('generateMarkdown (i18n)', () => {
  const mockHighlight: ExportHighlightData = {
    id: 'hl1',
    text: 'This is a highlight',
    chapter: 'Chapter 1',
    location: 'Chapter 1 · 25%',
    date: '2025-01-24',
    note: 'My personal note',
    isEdited: false
  };

  const mockBook: ExportBookData = {
    title: 'Test Book',
    author: 'Test Author',
    isbn: '978-1234567890',
    publisher: 'Test Publisher',
    language: 'en',
    readDate: '2025-01-20',
    description: 'A test book description',
    highlights: [mockHighlight]
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate markdown with title', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('# Test Book');
  });

  it('should include author with English label when metadata is enabled', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('**Author**: Test Author');
  });

  it('should include ISBN with English label when metadata is enabled', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('**ISBN**: 978-1234567890');
  });

  it('should include publisher with English label when metadata is enabled', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('**Publisher**: Test Publisher');
  });

  it('should include language with English label when metadata is enabled', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('**Language**: en');
  });

  it('should include read date with English label when metadata is enabled', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('**Date last read**: 2025-01-20');
  });

  it('should include description when metadata is enabled', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('A test book description');
  });

  it('should not include metadata when includeMetadata is false', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: false });
    expect(md).not.toContain('**Author**');
    expect(md).not.toContain('**ISBN**');
    expect(md).not.toContain('Test Author');
  });

  it('should include highlight as blockquote', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('> This is a highlight');
  });

  it('should include location with English label', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('**Location**: Chapter 1 · 25%');
  });

  it('should include date with English label', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('**Date**: 2025-01-24');
  });

  it('should include personal note', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('My personal note');
  });

  it('should include chapter heading for grouped highlights', () => {
    const md = generateMarkdown(mockBook, { includeMetadata: true });
    expect(md).toContain('## Chapter 1');
  });

  it('should handle books without highlights', () => {
    const bookWithoutHighlights = { ...mockBook, highlights: [] };
    const md = generateMarkdown(bookWithoutHighlights, { includeMetadata: true });
    expect(md).toContain('# Test Book');
    expect(md).not.toContain('---');
  });

  it('should handle highlights without chapter', () => {
    const highlightWithoutChapter: ExportHighlightData = {
      ...mockHighlight,
      chapter: null
    };
    const book = { ...mockBook, highlights: [highlightWithoutChapter] };
    const md = generateMarkdown(book, { includeMetadata: true });
    expect(md).toContain('> This is a highlight');
    // Should not have chapter heading for untitled chapters
    expect(md).not.toContain('## Untitled');
  });

  it('should handle null metadata fields gracefully', () => {
    const bookWithNullFields: ExportBookData = {
      ...mockBook,
      isbn: null,
      publisher: null,
      language: null,
      readDate: null,
      description: null
    };
    const md = generateMarkdown(bookWithNullFields, { includeMetadata: true });
    expect(md).toContain('**Author**: Test Author');
    expect(md).not.toContain('ISBN');
    expect(md).not.toContain('Publisher');
    expect(md).not.toContain('Language');
    expect(md).not.toContain('Date last read');
  });

  it('should handle multiple highlights with separators', () => {
    const secondHighlight: ExportHighlightData = {
      id: 'hl2',
      text: 'Second highlight',
      chapter: 'Chapter 1',
      location: 'Chapter 1 · 50%',
      date: '2025-01-25',
      note: null,
      isEdited: false
    };
    const book = { ...mockBook, highlights: [mockHighlight, secondHighlight] };
    const md = generateMarkdown(book, { includeMetadata: true });

    // Should have both highlights
    expect(md).toContain('> This is a highlight');
    expect(md).toContain('> Second highlight');

    // Should have separator between highlights
    const separatorCount = (md.match(/---/g) || []).length;
    expect(separatorCount).toBeGreaterThanOrEqual(2); // One after metadata, one between highlights
  });

  it('should handle highlights without notes', () => {
    const highlightWithoutNote: ExportHighlightData = {
      ...mockHighlight,
      note: null
    };
    const book = { ...mockBook, highlights: [highlightWithoutNote] };
    const md = generateMarkdown(book, { includeMetadata: true });
    expect(md).toContain('> This is a highlight');
    expect(md).not.toContain('My personal note');
  });
});
