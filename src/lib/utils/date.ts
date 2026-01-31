import type { ExportConfig } from '../types';

/**
 * Format a date string according to the specified format preference
 */
export function formatDate(dateStr: string | undefined, format: ExportConfig['dateFormat']): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  switch (format) {
    case 'dd_mm_yyyy':
      // 24/01/2025
      return date.toLocaleDateString('en-US', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    
    case 'iso8601':
      // 2025-01-24
      // toISOString returns YYYY-MM-DDTHH:mm:ss.sssZ, we just want the date part
      return date.toISOString().split('T')[0];
    
    case 'dd_month_yyyy':
    default:
      // 24 January 2025
      return date.toLocaleDateString('en-US', { 
        day: '2-digit', 
        month: 'long', 
        year: 'numeric' 
      });
  }
}
