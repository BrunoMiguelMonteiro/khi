/**
 * The accent colour chosen in Settings, applied in every window: Sistema follows macOS, the
 * swatches are fixed, and Claro / Escuro choose the set of tones.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import table from '../../../design/accent-tones.json';
import type { AppSettings } from '../types';

const os = vi.hoisted(() => ({ dark: false, listeners: new Set<(e: { matches: boolean }) => void>() }));
vi.hoisted(() => {
window.matchMedia = vi.fn().mockImplementation((query: string) => ({
	get matches() {
		return query.includes('dark') ? os.dark : false;
	},
	media: query,
	addEventListener: (_: string, handler: (e: { matches: boolean }) => void) => os.listeners.add(handler),
	removeEventListener: (_: string, handler: (e: { matches: boolean }) => void) => os.listeners.delete(handler),
	addListener: vi.fn(),
	removeListener: vi.fn(),
	dispatchEvent: vi.fn()
})) as never;
});

const emitted = vi.hoisted(() => ({ system: null as null | ((accent: unknown) => void) }));
vi.mock('$lib/bindings', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/bindings')>();
	return {
		...actual,
		events: {
			...actual.events,
			systemAccentChanged: {
				listen: vi.fn(async (handler: (event: { payload: unknown }) => void) => {
					emitted.system = (accent) => handler({ payload: accent });
					return () => {};
				})
			}
		}
	};
});
vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => ({ label: 'main', setTheme: vi.fn(() => Promise.resolve()) })
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => () => {}) }));

import { invoke } from '@tauri-apps/api/core';
import { settings } from './settings.svelte';

const tones = table as unknown as Record<string, Record<string, Record<string, Record<string, { value: string }>>>>;
const primary = () => document.documentElement.style.getPropertyValue('--primary');

function file(accentColor: string, theme: string): AppSettings {
	return {
		exportConfig: {
			exportPath: '/x',
			metadata: { author: true, isbn: true, publisher: true, dateLastRead: true, language: true, description: false },
			dateFormat: 'iso8601'
		},
		uiPreferences: {
			theme,
			windowWidth: 1200,
			windowHeight: 800,
			isMaximized: false,
			showOnboarding: true,
			libraryViewMode: 'grid',
			librarySort: 'title',
			librarySortReversed: false,
			syncOnConnect: true,
			checkForUpdates: true,
			settingsPane: 'export',
			accentColor
		},
		language: 'en',
		version: '1.3.0'
	} as AppSettings;
}

let system: unknown = { name: 'verde', light: '#34C759', dark: '#30D158' };
async function start(accentColor: string, theme: string) {
	vi.mocked(invoke).mockImplementation((cmd: string) => {
		if (cmd === 'load_settings') return Promise.resolve(file(accentColor, theme));
		if (cmd === 'get_system_accent') return Promise.resolve(system);
		return Promise.resolve(null);
	});
	await settings.initialize();
	flushSync();
}

describe('accent colour', () => {
	beforeEach(() => {
		os.dark = false;
		document.documentElement.removeAttribute('style');
		system = { name: 'verde', light: '#34C759', dark: '#30D158' };
	});
	afterEach(() => document.documentElement.removeAttribute('style'));

	it('a swatch sets its tones for the light theme', async () => {
		await start('turquesa', 'light');
		expect(primary()).toBe(tones.amostras.turquesa.claro.primary.value);
	});

	it('the dark theme takes the dark tones, and the change of theme applies them again', async () => {
		await start('turquesa', 'light');

		settings.setTheme('dark');
		flushSync();

		expect(primary()).toBe(tones.amostras.turquesa.escuro.primary.value);
	});

	it('Sistema follows the macOS accent, and a new one from macOS', async () => {
		await start('system', 'light');
		expect(primary()).toBe(tones.sistema.verde.claro.primary.value);

		emitted.system!({ name: 'roxo', light: '#AF52DE', dark: '#BF5AF2' });
		flushSync();

		expect(primary()).toBe(tones.sistema.roxo.claro.primary.value);
	});

	it('Sistema with the theme following the OS: dark when the OS is dark, and when it turns', async () => {
		await start('system', 'system');
		expect(primary()).toBe(tones.sistema.verde.claro.primary.value);

		os.dark = true;
		os.listeners.forEach((listener) => listener({ matches: true }));
		flushSync();

		expect(primary()).toBe(tones.sistema.verde.escuro.primary.value);
	});

	it('choosing a swatch applies it before Rust answers', () => {
		settings.setAccentColor('laranja');
		flushSync();

		expect(primary()).toBe(tones.amostras.laranja.claro.primary.value);
	});

	it('knows when its settings were loaded', async () => {
		vi.mocked(invoke).mockImplementation(() => Promise.resolve(file('system', 'light')));
		await settings.load();
		expect(settings.loaded).toBe(true);
	});
});
