import type { Book, Highlight, ExportConfig } from '../types';
import { formatDate } from './date';

export interface MarkdownOptions {
  includeAuthor?: boolean;
  includeIsbn?: boolean;
  includePublisher?: boolean;
  includeDateLastRead?: boolean;
  includeLanguage?: boolean;
  includeDescription?: boolean;
  dateFormat?: ExportConfig['dateFormat'];
}

/**
 * Sanitizes a filename by removing invalid characters
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || filename.trim().length === 0) {
    return 'Untitled';
  }
  
  return filename
    .trim()
    .replace(/:/g, ' -')
    .replace(/[\/\\?*|"<>]/g, '-')
    .replace(/\s+/g, ' ');
}

/**
 * Generates a filename for the markdown export
 */
export function generateFilename(book: Book): string {
  const sanitizedTitle = sanitizeFilename(book.title);
  const sanitizedAuthor = sanitizeFilename(book.author);
  return `${sanitizedTitle} - ${sanitizedAuthor}.md`;
}

/**
 * Generates markdown content for a single highlight
 */
function generateHighlightMarkdown(highlight: Highlight, options: MarkdownOptions): string {
  const lines: string[] = [];
  
  // Highlight text as blockquote
  lines.push(`> ${highlight.text}`);
  lines.push('');
  
  // Location info
  const locationParts: string[] = [];
  if (highlight.chapterTitle) {
    locationParts.push(highlight.chapterTitle);
  }
  if (highlight.chapterProgress !== undefined) {
    locationParts.push(`${Math.round(highlight.chapterProgress * 100)}%`);
  }
  
  if (locationParts.length > 0) {
    lines.push(`**Localização**: ${locationParts.join(' · ')}`);
  }
  
  // Date
  if (highlight.dateCreated) {
    // Default to 'dd_month_yyyy' if not specified, to match previous behavior
    lines.push(`**Data**: ${formatDate(highlight.dateCreated, options.dateFormat || 'dd_month_yyyy')}`);
  }
  
  return lines.join('\n');
}

/**
 * Groups highlights by chapter
 */
function groupHighlightsByChapter(highlights: Highlight[]): Map<string, Highlight[]> {
  const groups = new Map<string, Highlight[]>();
  
  for (const highlight of highlights) {
    const chapter = highlight.chapterTitle || 'Sem Capítulo';
    if (!groups.has(chapter)) {
      groups.set(chapter, []);
    }
    groups.get(chapter)!.push(highlight);
  }
  
  return groups;
}

/**
 * Generates markdown content for a book
 */
export function generateMarkdown(book: Book, options: MarkdownOptions): string {
  const lines: string[] = [];
  
  // Title
  lines.push(`# ${book.title}`);
  lines.push('');
  
  // Metadata
  const metadata: string[] = [];
  
  if (options.includeAuthor && book.author) {
    metadata.push(`**Autor**: ${book.author}`);
  }
  if (options.includeIsbn && book.isbn) {
    metadata.push(`**ISBN**: ${book.isbn}`);
  }
  if (options.includePublisher && book.publisher) {
    metadata.push(`**Publisher**: ${book.publisher}`);
  }
  if (options.includeDateLastRead && book.dateLastRead) {
    metadata.push(`**Data de Leitura**: ${formatDate(book.dateLastRead, options.dateFormat || 'dd_month_yyyy')}`);
  }
  if (options.includeLanguage && book.language) {
    metadata.push(`**Idioma**: ${book.language}`);
  }
  if (options.includeDescription && book.description) {
    metadata.push('');
    metadata.push(book.description);
  }
  
  if (metadata.length > 0) {
    lines.push(...metadata);
    lines.push('');
  }
  
  if (book.highlights.length === 0) {
    return lines.join('\n');
  }
  
  lines.push('---');
  lines.push('');
  
  // Group by chapter
  const grouped = groupHighlightsByChapter(book.highlights);
  
  for (const [chapter, highlights] of grouped) {
    if (chapter !== 'Sem Capítulo') {
      lines.push(`## ${chapter}`);
      lines.push('');
    }
    
    for (let i = 0; i < highlights.length; i++) {
      lines.push(generateHighlightMarkdown(highlights[i], options));
      
      // Add separator between highlights, but not after the last one
      if (i < highlights.length - 1 || chapter !== Array.from(grouped.keys()).pop()) {
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }
  }
  
  return lines.join('\n');
}
