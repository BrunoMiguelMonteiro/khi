/**
 * Markdown export with i18n support
 * Generates Markdown content using translated labels
 */

import type { ExportBookData, ExportHighlightData } from '../types';
import { t } from '$lib/i18n';

export interface MarkdownExportOptions {
  includeMetadata: boolean;
}

/**
 * Generates markdown content for a single highlight
 */
function generateHighlightExportMarkdown(
  highlight: ExportHighlightData,
  _options: MarkdownExportOptions
): string {
  const lines: string[] = [];

  // Highlight text as blockquote
  lines.push(`> ${highlight.text}`);
  lines.push('');

  // Location info
  if (highlight.location) {
    const locationLabel = t('export.metadata.location');
    lines.push(`**${locationLabel}**: ${highlight.location}`);
  }

  // Date
  if (highlight.date) {
    const dateLabel = t('export.metadata.date');
    lines.push(`**${dateLabel}**: ${highlight.date}`);
  }

  // Personal note
  if (highlight.note) {
    lines.push('');
    lines.push(highlight.note);
  }

  return lines.join('\n');
}

/**
 * Groups highlights by chapter
 */
function groupHighlightsByChapter(highlights: ExportHighlightData[]): Map<string, ExportHighlightData[]> {
  const groups = new Map<string, ExportHighlightData[]>();

  for (const highlight of highlights) {
    const chapter = highlight.chapter || 'Untitled';
    if (!groups.has(chapter)) {
      groups.set(chapter, []);
    }
    groups.get(chapter)!.push(highlight);
  }

  return groups;
}

/**
 * Generates markdown content for a book with i18n labels
 */
export function generateMarkdown(
  book: ExportBookData,
  options: MarkdownExportOptions
): string {
  const lines: string[] = [];

  // Title
  lines.push(`# ${book.title}`);
  lines.push('');

  // Metadata section
  if (options.includeMetadata) {
    const metadata: string[] = [];

    if (book.author) {
      const authorLabel = t('export.metadata.author');
      metadata.push(`**${authorLabel}**: ${book.author}`);
    }

    if (book.isbn) {
      const isbnLabel = t('export.metadata.isbn');
      metadata.push(`**${isbnLabel}**: ${book.isbn}`);
    }

    if (book.publisher) {
      const publisherLabel = t('export.metadata.publisher');
      metadata.push(`**${publisherLabel}**: ${book.publisher}`);
    }

    if (book.language) {
      const languageLabel = t('export.metadata.language');
      metadata.push(`**${languageLabel}**: ${book.language}`);
    }

    if (book.readDate) {
      const dateReadLabel = t('export.metadata.dateLastRead');
      metadata.push(`**${dateReadLabel}**: ${book.readDate}`);
    }

    if (book.description) {
      metadata.push('');
      metadata.push(book.description);
    }

    if (metadata.length > 0) {
      lines.push(...metadata);
      lines.push('');
    }
  }

  // Highlights section
  if (book.highlights.length === 0) {
    return lines.join('\n');
  }

  lines.push('---');
  lines.push('');

  // Group by chapter
  const grouped = groupHighlightsByChapter(book.highlights);

  const chapters = Array.from(grouped.keys());
  for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
    const chapter = chapters[chapterIndex];
    const highlights = grouped.get(chapter)!;

    if (chapter !== 'Untitled') {
      lines.push(`## ${chapter}`);
      lines.push('');
    }

    for (let i = 0; i < highlights.length; i++) {
      lines.push(generateHighlightExportMarkdown(highlights[i], options));

      // Add separator between highlights, but not after the last one
      const isLastHighlight = i === highlights.length - 1;
      const isLastChapter = chapterIndex === chapters.length - 1;

      if (!isLastHighlight || !isLastChapter) {
        lines.push('');
        lines.push('---');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}
