import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as settingsStore from './settings.svelte';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('Settings Store - Theme Application', () => {
  // Mock matchMedia
  const matchMediaMock = vi.fn();
  
  beforeEach(() => {
    // Reset DOM
    document.documentElement.className = '';
    
    // Setup matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });
    
    matchMediaMock.mockImplementation(query => ({
      matches: false, // Default to light mode preference
      media: query,
      onchange: null,
      addListener: vi.fn(), // Deprecated
      removeListener: vi.fn(), // Deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    
    settingsStore.resetSettings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should apply light theme (remove dark class) when theme is "light"', () => {
    // Start with dark to verify removal
    document.documentElement.classList.add('dark');
    
    settingsStore.setTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should apply dark theme (add dark class) when theme is "dark"', () => {
    settingsStore.setTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should apply system light theme correctly', () => {
    // Mock system preferring light
    matchMediaMock.mockImplementation(query => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
    }));
    
    // Start with dark to verify removal
    document.documentElement.classList.add('dark');

    settingsStore.setTheme('system');
    
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('should apply system dark theme correctly', () => {
    // Mock system preferring dark
    matchMediaMock.mockImplementation(query => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
    }));
    
    settingsStore.setTheme('system');
    
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('should update theme when switching from specific to system (dark)', () => {
    // Start with light (no class)
    document.documentElement.classList.remove('dark');
    
    // Mock system preferring dark
    matchMediaMock.mockImplementation(query => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
    }));
    
    // Switch to system
    settingsStore.setTheme('system');
    
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
