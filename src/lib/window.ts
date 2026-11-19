import { getCurrentWindow } from '@tauri-apps/api/window';

/** This webview's window, `main` or `settings`; outside Tauri (tests), `main`. */
export function currentWindowLabel(): string {
  try {
    return getCurrentWindow().label ?? 'main';
  } catch {
    return 'main';
  }
}
