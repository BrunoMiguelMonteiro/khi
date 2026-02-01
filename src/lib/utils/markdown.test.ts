import { describe, it, expect } from 'vitest';
import { generateMarkdown, sanitizeFilename } from './markdown';
import type { Book, Highlight } from '../types';

describe('sanitizeFilename', () => {
  it('should remove invalid characters', () => {
    expect(sanitizeFilename('Book: Title')).toBe('Book - Title');
    expect(sanitizeFilename('Book/Title')).toBe('Book-Title');
    expect(sanitizeFilename('Book?')).toBe('Book-');
    expect(sanitizeFilename('Book|Test')).toBe('Book-Test');
  });

  it('should handle empty strings', () => {
    expect(sanitizeFilename('')).toBe('Untitled');
  });

  it('should trim whitespace', () => {
    expect(sanitizeFilename('  Book Title  ')).toBe('Book Title');
  });
});

describe('generateMarkdown', () => {
  const mockHighlight: Highlight = {
    id: 'hl1',
    text: 'This is a highlight',
    chapterTitle: 'Chapter 1',
    chapterProgress: 0.25,
    dateCreated: '2025-01-24',
  };

  const mockBook: Book = {
    contentId: '123',
    title: 'Test Book',
    author: 'Test Author',
    isbn: '978-1234567890',
    highlights: [mockHighlight],
    isSelected: true,
  };

  it('should generate markdown with title', () => {
    const md = generateMarkdown(mockBook, { includeAuthor: true, includeIsbn: true });
    expect(md).toContain('# Test Book');
  });

  it('should include author when specified', () => {
    const md = generateMarkdown(mockBook, { includeAuthor: true, includeIsbn: false });
    expect(md).toContain('**Autor**: Test Author');
  });

  it('should include ISBN when specified', () => {
    const md = generateMarkdown(mockBook, { includeAuthor: false, includeIsbn: true });
    expect(md).toContain('**ISBN**: 978-1234567890');
  });

  it('should include highlight as blockquote', () => {
    const md = generateMarkdown(mockBook, {});
    expect(md).toContain('> This is a highlight');
  });

  it('should include chapter information', () => {
    const md = generateMarkdown(mockBook, {});
    expect(md).toContain('Chapter 1');
  });

  it('should handle books without highlights', () => {
    const bookWithoutHighlights = { ...mockBook, highlights: [] };
    const md = generateMarkdown(bookWithoutHighlights, {});
    expect(md).toContain('# Test Book');
    expect(md).not.toContain('---');
  });
});
