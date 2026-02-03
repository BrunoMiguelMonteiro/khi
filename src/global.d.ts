/**
 * Global type declarations for Tauri
 */

interface Window {
  /**
   * Tauri runtime global - present when running in Tauri environment
   */
  __TAURI__?: unknown;
}
