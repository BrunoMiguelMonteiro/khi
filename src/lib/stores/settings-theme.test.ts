import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ── matchMedia mock ──────────────────────────────────────────────────
type ChangeHandler = (e: { matches: boolean }) => void;

let darkModeMatches = false;
let mediaChangeHandlers: ChangeHandler[] = [];

function createMockMediaQueryList(query: string): MediaQueryList {
	return {
		get matches() { return darkModeMatches; },
		media: query,
		onchange: null,
		addEventListener: (_event: string, handler: ChangeHandler) => {
			mediaChangeHandlers.push(handler);
		},
		removeEventListener: (_event: string, handler: ChangeHandler) => {
			mediaChangeHandlers = mediaChangeHandlers.filter(h => h !== handler);
		},
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn()
	};
}

// Install matchMedia mock before any import
window.matchMedia = vi.fn().mockImplementation(createMockMediaQueryList);

/** Simulate OS theme change */
function simulateSystemThemeChange(dark: boolean) {
	darkModeMatches = dark;
	for (const handler of [...mediaChangeHandlers]) {
		handler({ matches: dark });
	}
}

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
	invoke: vi.fn(),
	convertFileSrc: vi.fn((src) => src)
}));

const mockSetTheme = vi.fn().mockResolvedValue(undefined);
vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => ({
		setTheme: mockSetTheme
	})
}));

// Import applyTheme AFTER all mocks are installed
import { applyTheme } from './settings.svelte';

describe('applyTheme - Theme Class Application', () => {
	let root: HTMLElement;

	beforeEach(() => {
		root = document.createElement('div');
		darkModeMatches = false;
		mediaChangeHandlers = [];
		mockSetTheme.mockClear();
	});

	it('should apply "light" class when theme is "light"', () => {
		root.classList.add('dark');

		applyTheme('light', root);

		expect(root.classList.contains('light')).toBe(true);
		expect(root.classList.contains('dark')).toBe(false);
	});

	it('should apply "dark" class when theme is "dark"', () => {
		applyTheme('dark', root);

		expect(root.classList.contains('dark')).toBe(true);
		expect(root.classList.contains('light')).toBe(false);
	});

	it('should apply system light theme via matchMedia', () => {
		darkModeMatches = false;

		applyTheme('system', root);

		expect(root.classList.contains('light')).toBe(true);
		expect(root.classList.contains('dark')).toBe(false);
	});

	it('should apply system dark theme via matchMedia', () => {
		darkModeMatches = true;

		applyTheme('system', root);

		expect(root.classList.contains('dark')).toBe(true);
		expect(root.classList.contains('light')).toBe(false);
	});

	it('should remove previous theme class before applying new one', () => {
		applyTheme('dark', root);
		expect(root.classList.contains('dark')).toBe(true);

		applyTheme('light', root);
		expect(root.classList.contains('light')).toBe(true);
		expect(root.classList.contains('dark')).toBe(false);
	});

	it('should update classes when system theme changes at runtime', () => {
		darkModeMatches = false;

		applyTheme('system', root);
		expect(root.classList.contains('light')).toBe(true);

		simulateSystemThemeChange(true);

		expect(root.classList.contains('dark')).toBe(true);
		expect(root.classList.contains('light')).toBe(false);
	});

	it('should correctly transition from light to system (dark)', () => {
		applyTheme('light', root);
		expect(root.classList.contains('light')).toBe(true);

		darkModeMatches = true;

		applyTheme('system', root);

		expect(root.classList.contains('dark')).toBe(true);
		expect(root.classList.contains('light')).toBe(false);
	});
});

describe('applyTheme - Listener Management', () => {
	let root: HTMLElement;

	beforeEach(() => {
		root = document.createElement('div');
		darkModeMatches = false;
		mediaChangeHandlers = [];
		mockSetTheme.mockClear();
	});

	it('should add matchMedia listener when theme is "system"', () => {
		applyTheme('system', root);

		expect(mediaChangeHandlers.length).toBe(1);
	});

	it('should not add listener for manual themes', () => {
		applyTheme('dark', root);

		expect(mediaChangeHandlers.length).toBe(0);
	});

	it('should return cleanup function for "system" theme', () => {
		const cleanup = applyTheme('system', root);

		expect(typeof cleanup).toBe('function');
	});

	it('should not return cleanup function for manual themes', () => {
		const cleanup = applyTheme('dark', root);

		expect(cleanup).toBeUndefined();
	});

	it('should remove listener when cleanup is called', () => {
		const cleanup = applyTheme('system', root);
		expect(mediaChangeHandlers.length).toBe(1);

		cleanup!();

		expect(mediaChangeHandlers.length).toBe(0);
	});

	it('should not accumulate listeners across apply/cleanup cycles', () => {
		const cleanup1 = applyTheme('system', root);
		expect(mediaChangeHandlers.length).toBe(1);

		cleanup1!();

		const cleanup2 = applyTheme('system', root);
		expect(mediaChangeHandlers.length).toBe(1);

		cleanup2!();
		expect(mediaChangeHandlers.length).toBe(0);
	});

	it('should stop responding to system changes after cleanup', () => {
		darkModeMatches = false;
		const cleanup = applyTheme('system', root);
		expect(root.classList.contains('light')).toBe(true);

		cleanup!();

		// Simulate theme change after cleanup — should NOT update classes
		simulateSystemThemeChange(true);
		expect(root.classList.contains('light')).toBe(true);
		expect(root.classList.contains('dark')).toBe(false);
	});
});

describe('applyTheme - Titlebar Sync', () => {
	let root: HTMLElement;

	beforeEach(() => {
		root = document.createElement('div');
		darkModeMatches = false;
		mediaChangeHandlers = [];
		mockSetTheme.mockClear();
	});

	it('should call syncTitlebar(null) when theme is "system"', async () => {
		applyTheme('system', root);

		// syncTitlebar uses dynamic import, so wait for the promise chain
		await new Promise(r => setTimeout(r, 0));

		expect(mockSetTheme).toHaveBeenCalledWith(null);
	});

	it('should call syncTitlebar("dark") for dark theme', async () => {
		applyTheme('dark', root);

		await new Promise(r => setTimeout(r, 0));

		expect(mockSetTheme).toHaveBeenCalledWith('dark');
	});

	it('should call syncTitlebar("light") for light theme', async () => {
		applyTheme('light', root);

		await new Promise(r => setTimeout(r, 0));

		expect(mockSetTheme).toHaveBeenCalledWith('light');
	});
});
