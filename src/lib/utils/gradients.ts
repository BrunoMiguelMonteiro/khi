/**
 * Shared gradient utilities for book covers
 * Ensures consistent gradient assignment across all components
 */

export const bookGradients = [
  'from-blue-400 to-blue-600',
  'from-green-400 to-green-600',
  'from-purple-400 to-purple-600',
  'from-red-400 to-red-600',
  'from-orange-400 to-orange-600',
  'from-teal-400 to-teal-600',
  'from-pink-400 to-pink-600',
  'from-indigo-400 to-indigo-600',
];

/**
 * Get a consistent gradient for a book based on its content ID
 * @param contentId - The unique book content ID
 * @returns Tailwind gradient class string
 */
export function getBookGradient(contentId: string): string {
  const hash = contentId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return bookGradients[hash % bookGradients.length];
}
