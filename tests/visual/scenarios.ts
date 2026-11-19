/**
 * The states the harness captures, and how each one is reached.
 *
 * A capture is a Scenario (what is on screen) in a Variant (theme, contrast,
 * motion, language). Each one starts from a fresh browser context.
 */
import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { Language, ThemePreference, ViewMode } from '../../src/lib/bindings';
import type { MockConfig } from './mock-ipc';
import { APP_VERSION, HOME, availableUpdate, books, booksWithoutNews, defaultSettings, device, makeSettings, reader, summary } from './fixtures';

export type ThemeName = 'light' | 'dark-app' | 'system-dark';

export interface Variant {
	theme: ThemeName;
	language: Language;
	contrast?: 'more';
	reducedMotion?: 'reduce';
	/** The app window at its minimum size (`minWidth`/`minHeight` in tauri.conf.json). */
	size?: 'min';
}

/**
 * An interaction state recorded after the page capture: the target is hovered
 * with the real mouse, or focused with the keyboard (Alt+Tab, never
 * `element.focus()`), so `:hover`, `group-hover`, `:focus` and
 * `:focus-visible` all apply as they do for a user.
 */
export interface StateProbe {
	/** Unique within the scenario; names the screenshot `<capture>.state-<name>.png`. */
	name: string;
	kind: 'hover' | 'focus';
	/** The element brought into the state (the first match). */
	target(page: Page, text: Strings): Locator;
	/** Waits for what the state brings with it (a tooltip opens 500 ms after a hover), so the screenshot never catches it half-way. */
	ready?(page: Page): Promise<void>;
	/** CSS selector of the target's closest ancestor (or itself) that is recorded with its descendants and screenshotted. Defaults to the target. */
	root?: string;
}

export interface Scenario {
	name: string;
	description: string;
	viewMode?: ViewMode;
	/** Every book has been opened or exported: no highlight is new, so there is no header: the grid starts 24 px below the bar. */
	withoutNews?: boolean;
	/** The Kobo's Reader and its Library exist (all but `empty`). */
	withLibrary: boolean;
	/** `settings`: the Settings window, its own route (`/definicoes`) and size. Default: the main window. */
	window?: 'settings';
	update?: boolean;
	/** Records keyboard focus states by pressing Tab. */
	focusStops?: number;
	/** Hover and focus states recorded after the page. */
	states?: StateProbe[];
	/** Brings the page from the Library (or the empty state) to the state. */
	reach(page: Page, text: Strings, variant: Variant): Promise<void>;
}

export interface Strings {
	noKoboTitle: string;
	/** The bar's Sync button, which is disabled until the Reader's Kobo is connected. */
	sync: string;
	viewList: string;
	/** The checked radio of the view group: the only one the keyboard stops on. */
	viewGrid: string;
	sortBy: string;
	/** The bar's Export with two books selected. */
	export2: string;
	/** The header's button with news in two books. */
	exportNews: string;
	closeSettings: string;
	browseFolder: string;
	install: string;
	later: string;
	saveChanges: string;
	checkNow: string;
}

const STRINGS: Record<Language, Strings> = {
	pt: {
		noKoboTitle: 'Nenhum Kobo ligado',
		sync: 'Sincronizar com o Kobo',
		viewList: 'Ver em lista',
		viewGrid: 'Ver em grelha',
		sortBy: 'Ordenar por',
		export2: 'Exportar 2 livros',
		exportNews: 'Exportar 2 livros',
		closeSettings: 'Fechar definições',
		browseFolder: 'Escolher a pasta de exportação',
		install: 'Instalar e reiniciar',
		later: 'Mais tarde',
		saveChanges: 'Guardar alterações',
		checkNow: 'Procurar agora'
	},
	en: {
		noKoboTitle: 'No Kobo connected',
		sync: 'Sync with the Kobo',
		viewList: 'View as list',
		viewGrid: 'View as grid',
		sortBy: 'Sort by',
		export2: 'Export 2 books',
		exportNews: 'Export 2 books',
		closeSettings: 'Close settings',
		browseFolder: 'Browse for export folder',
		install: 'Install and Restart',
		later: 'Later',
		saveChanges: 'Save Changes',
		checkNow: 'Check Now'
	}
};
export const stringsFor = (language: Language) => STRINGS[language];

/** Theme chosen in the app's settings, and the OS's color scheme. */
export const THEMES: Record<ThemeName, { app: ThemePreference; os: 'light' | 'dark'; htmlClass: 'light' | 'dark' }> = {
	light: { app: 'light', os: 'light', htmlClass: 'light' },
	// Tailwind's dark variant must follow the `.dark` class, not the OS
	'dark-app': { app: 'dark', os: 'light', htmlClass: 'dark' },
	'system-dark': { app: 'system', os: 'dark', htmlClass: 'dark' }
};

/** Waits for the page to subscribe to `event`, then emits it like Rust. */
export async function emitWhenListening(page: Page, event: string, payload: unknown = null) {
	await page.waitForFunction((name) => (window.__KHI_MOCK__.listeners[name] ?? []).length > 0, event);
	await page.evaluate(([name, data]) => window.__KHI_MOCK__.emit(name as string, data), [event, payload] as const);
}

/** Connects the Kobo while the Library is on screen. */
async function connectKobo(page: Page, text: Strings) {
	await expect(page.getByTestId('books-grid').or(page.getByTestId('books-list'))).toBeVisible();
	// The last listener the page registers: all the others exist by now
	await page.waitForFunction(() => (window.__KHI_MOCK__.listeners['device-disconnected'] ?? []).length > 0);
	await emitWhenListening(page, 'device-detected', { device });
	// The bar's Sync is disabled until the Reader's Kobo is known
	await expect(page.getByRole('button', { name: text.sync, exact: true })).not.toHaveAttribute('aria-disabled', 'true');
}

async function library(page: Page, text: Strings) {
	await connectKobo(page, text);
	await expect(page.getByTestId('books-grid')).toBeVisible();
	await expect(page.getByTestId('book-card')).toHaveCount(books.length);
	await expect(page.getByRole('option', { name: books[0].title })).toBeVisible();
}

/** The Settings window, as Rust opens it: its route, with the Reader the main window has open. */
async function openSettings(page: Page) {
	await expect(page.locator('[aria-labelledby="settings-title"]')).toBeVisible();
	await expect(page.getByTestId('reader-name')).toHaveValue(reader.name);
	await expect(page.locator('#export-tab')).toHaveAttribute('aria-selected', 'true');
}

/** The computed `animation-name` of the first match. */
const animationName = (page: Page, selector: string) =>
	page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName);

/** Asserts an animation runs, or (with `prefers-reduced-motion: reduce`, when the app honours it) does not. */
async function expectAnimation(page: Page, selector: string, running: boolean) {
	if (running) await expect.poll(() => animationName(page, selector)).not.toBe('none');
	else await expect.poll(() => animationName(page, selector)).toBe('none');
}

const SETTINGS = '[aria-labelledby="settings-title"]';

/** The books selected in the `*-selected` scenarios: not adjacent, so a selected card sits next to an unselected one. */
const SELECTED = [0, 2];

/** The toolbar buttons and the view group show a tooltip: wait for it, or the screenshot races its 500 ms delay. */
const tooltipOpen = async (page: Page) => {
	await expect(page.locator('[data-slot="tooltip-content"]:not([data-state="closed"])')).toBeVisible();
};

const bar = (page: Page) => page.locator('[data-slot="window-bar"]');

/** Selects `SELECTED`: ⌘-click on a grid card (events, not mouse moves), the checkbox of a list row. The bar's Export then counts them. */
async function selectBooks(page: Page, text: Strings, view: 'grid' | 'list') {
	for (const index of SELECTED) {
		if (view === 'grid') {
			const card = page.getByTestId('book-card').nth(index);
			await card.dispatchEvent('click', { metaKey: true });
			await expect(card).toHaveAttribute('aria-selected', 'true');
		} else {
			const box = page.getByTestId('books-list').locator('[role="button"]').nth(index).locator('[role="checkbox"]');
			await box.dispatchEvent('click');
			await expect(box).toHaveAttribute('aria-checked', 'true');
		}
	}
	await expect(bar(page).getByRole('button', { name: text.export2, exact: true })).toBeVisible();
}

async function listView(page: Page, text: Strings) {
	await connectKobo(page, text);
	await expect(page.getByTestId('books-list')).toBeVisible();
	await expect(page.getByText(books[0].title).first()).toBeVisible();
}

export const SCENARIOS: Record<string, Scenario> = {
	empty: {
		name: 'empty',
		description: 'No Reader and no Kobo: the empty state',
		withLibrary: false,
		async reach(page, text) {
			await expect(page.getByText(text.noKoboTitle, { exact: true })).toBeVisible();
			await expect(page.getByTestId('books-grid')).toHaveCount(0);
		}
	},
	grid: {
		name: 'grid',
		description: 'Kobo connected, the Library as a grid: the bar, the header with news and the grid',
		withLibrary: true,
		// The view group, sort, sync, export, the header's export, and the grid's one tab stop
		focusStops: 6,
		states: [
			{ name: 'hover-book-card', kind: 'hover', target: (p) => p.getByTestId('book-card') },
			{ name: 'focus-book-card', kind: 'focus', target: (p) => p.getByTestId('book-card'), root: '[data-testid="book-card"]' },
			{ name: 'hover-sync-button', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.sync, exact: true }), ready: tooltipOpen },
			{ name: 'focus-sync-button', kind: 'focus', target: (p, t) => p.getByRole('button', { name: t.sync, exact: true }), ready: tooltipOpen },
			{ name: 'hover-sort-button', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.sortBy, exact: true }), ready: tooltipOpen },
			{ name: 'hover-view-toggle', kind: 'hover', target: (p, t) => p.getByRole('radio', { name: t.viewList, exact: true }), ready: tooltipOpen },
			{ name: 'focus-view-toggle', kind: 'focus', target: (p, t) => p.getByRole('radio', { name: t.viewGrid, exact: true }), ready: tooltipOpen },
			{
				name: 'hover-header-export',
				kind: 'hover',
				target: (p, t) => p.locator('[data-slot="library-header"]').getByRole('button', { name: t.exportNews, exact: true })
			},
			{
				name: 'focus-header-export',
				kind: 'focus',
				target: (p, t) => p.locator('[data-slot="library-header"]').getByRole('button', { name: t.exportNews, exact: true })
			}
		],
		reach: library
	},
	'grid-no-news': {
		name: 'grid-no-news',
		description: 'Kobo connected, nothing new: no header, the grid starts 24 px below the bar',
		withLibrary: true,
		withoutNews: true,
		reach: library
	},
	list: {
		name: 'list',
		description: 'Kobo connected, the Library as a list',
		withLibrary: true,
		viewMode: 'list',
		states: [
			{ name: 'hover-list-row', kind: 'hover', target: (p) => p.getByTestId('books-list').locator('[role="button"]') },
			{
				name: 'hover-checkbox',
				kind: 'hover',
				target: (p) => p.getByTestId('books-list').locator('[role="checkbox"]'),
				root: '[role="button"]'
			},
			{ name: 'focus-list-row', kind: 'focus', target: (p) => p.getByTestId('books-list').locator('[role="button"]') },
			{
				name: 'focus-checkbox',
				kind: 'focus',
				target: (p) => p.getByTestId('books-list').locator('[role="checkbox"]'),
				root: '[role="button"]'
			}
		],
		reach: listView
	},
	'grid-selected': {
		name: 'grid-selected',
		description: 'The grid with two books selected: the selection frames and the bar counting them',
		withLibrary: true,
		states: [
			{ name: 'hover-bar-export', kind: 'hover', target: (p, t) => bar(p).getByRole('button', { name: t.export2, exact: true }), ready: tooltipOpen },
			{
				name: 'hover-selected-card',
				kind: 'hover',
				target: (p) => p.getByRole('option', { name: books[SELECTED[0]].title })
			}
		],
		async reach(page, text) {
			await library(page, text);
			await selectBooks(page, text, 'grid');
		}
	},
	'list-selected': {
		name: 'list-selected',
		description: 'The list with two books selected: the bar counts them',
		withLibrary: true,
		viewMode: 'list',
		states: [
			{
				name: 'hover-selected-row',
				kind: 'hover',
				target: (p) => p.getByTestId('books-list').locator('[role="button"]').nth(SELECTED[0])
			}
		],
		async reach(page, text) {
			await listView(page, text);
			await selectBooks(page, text, 'list');
		}
	},
	detail: {
		name: 'detail',
		description: "A book's highlights",
		withLibrary: true,
		states: [
			// The row's background and its copy button (`group-hover:opacity-100`)
			{ name: 'hover-highlight', kind: 'hover', target: (p) => p.getByTestId('highlight-item') },
			{
				name: 'hover-highlight-copy',
				kind: 'hover',
				target: (p) => p.getByTestId('highlight-item').locator('blockquote button'),
				root: '[data-testid="highlight-item"]'
			},
			{
				name: 'focus-highlight-copy',
				kind: 'focus',
				target: (p) => p.getByTestId('highlight-item').locator('blockquote button'),
				root: '[data-testid="highlight-item"]'
			}
		],
		async reach(page, text) {
			await library(page, text);
			// Events, not mouse moves: hover states are recorded separately (`states`)
			await page.getByRole('option', { name: books[0].title }).dispatchEvent('click');
			const view = page.getByTestId('book-details-view');
			await expect(view).toBeVisible();
			await expect(view.getByText(books[0].title).first()).toBeVisible();
			await expect(view.getByTestId('highlight-item').first()).toBeVisible();
		}
	},
	settings: {
		name: 'settings',
		description: 'Settings open on the Export tab',
		withLibrary: true,
		window: 'settings',
		focusStops: 3,
		states: [
			// The focus ring (`focus:ring-2 focus:border-blue-500`)
			{ name: 'focus-text-input', kind: 'focus', target: (p) => p.locator('#export-path') },
			{ name: 'hover-tab', kind: 'hover', target: (p) => p.locator('#appearance-tab') },
			{ name: 'hover-icon-button', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.closeSettings, exact: true }) },
			{ name: 'hover-secondary-button', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.browseFolder, exact: true }) },
			{ name: 'focus-secondary-button', kind: 'focus', target: (p, t) => p.getByRole('button', { name: t.browseFolder, exact: true }) },
			{ name: 'hover-custom-checkbox', kind: 'hover', target: (p) => p.locator(`${SETTINGS} [role="checkbox"]`), root: 'label' },
			{ name: 'focus-custom-checkbox', kind: 'focus', target: (p) => p.locator(`${SETTINGS} [role="checkbox"]`), root: 'label' },
			{ name: 'hover-custom-radio', kind: 'hover', target: (p) => p.locator(`${SETTINGS} [role="radio"]`), root: 'label' },
			{ name: 'focus-custom-radio', kind: 'focus', target: (p) => p.locator(`${SETTINGS} [role="radio"]`), root: 'label' }
		],
		reach: openSettings
	},
	'settings-appearance': {
		name: 'settings-appearance',
		description: 'Settings open on the Appearance tab',
		withLibrary: true,
		window: 'settings',
		states: [
			{ name: 'hover-segmented', kind: 'hover', target: (p) => p.locator('#appearance-panel button[aria-pressed="false"]') },
			{ name: 'focus-segmented', kind: 'focus', target: (p) => p.locator('#appearance-panel button[aria-pressed="false"]') },
			{ name: 'hover-checkbox-row', kind: 'hover', target: (p) => p.locator('#appearance-panel label:has(input[type="checkbox"])') },
			{ name: 'focus-native-checkbox', kind: 'focus', target: (p) => p.locator('#appearance-panel input[type="checkbox"]'), root: 'label' }
		],
		async reach(page, text) {
			await openSettings(page);
			await page.locator('#appearance-tab').dispatchEvent('click');
			await expect(page.locator('#appearance-tab')).toHaveAttribute('aria-selected', 'true');
		}
	},
	'settings-updates': {
		name: 'settings-updates',
		description: 'Settings open on the Updates tab: the automatic-check switch',
		withLibrary: true,
		window: 'settings',
		states: [
			{ name: 'hover-switch-row', kind: 'hover', target: (p) => p.locator('#updates-panel label:has([data-testid="check-for-updates"])') },
			{ name: 'focus-switch', kind: 'focus', target: (p) => p.getByTestId('check-for-updates'), root: 'label' },
			{ name: 'hover-check-now', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.checkNow, exact: true }) }
		],
		async reach(page, text) {
			await openSettings(page);
			await page.locator('#updates-tab').dispatchEvent('click');
			await expect(page.locator('#updates-tab')).toHaveAttribute('aria-selected', 'true');
			await expect(page.getByTestId('check-for-updates')).toBeChecked();
			await expect(page.getByTestId('last-checked')).not.toBeEmpty();
		}
	},
	update: {
		name: 'update',
		description: 'The new-version dialog over the Library',
		withLibrary: true,
		update: true,
		states: [
			{ name: 'hover-primary-button', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.install, exact: true }) },
			{ name: 'focus-primary-button', kind: 'focus', target: (p, t) => p.getByRole('button', { name: t.install, exact: true }) },
			{ name: 'hover-secondary-button', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.later, exact: true }) },
			{ name: 'focus-scroll-region', kind: 'focus', target: (p) => p.getByTestId('release-notes') }
		],
		async reach(page, text) {
			await library(page, text);
			await expect(page.getByTestId('update-dialog')).toBeVisible();
			await expect(page.getByTestId('release-notes')).toBeVisible();
		}
	},
	importing: {
		name: 'importing',
		description: 'A Sync in progress: the pulsing Kobo icon (`motion-reduce:animate-none`)',
		withLibrary: true,
		async reach(page, text, variant) {
			await library(page, text);
			await page.evaluate(() => window.__KHI_MOCK__.hold('sync_kobo'));
			await page.getByRole('button', { name: text.sync, exact: true }).dispatchEvent('click');
			await page.waitForFunction(() => window.__KHI_MOCK__.held.includes('sync_kobo'));
			await expect(page.getByTestId('sync-progress')).toContainText('2');
			await expect(page.locator('.kobo-icon')).toBeVisible();
			await expectAnimation(page, '.kobo-icon', variant.reducedMotion !== 'reduce');
		}
	},
	'update-checking': {
		name: 'update-checking',
		description: 'A manual update check in progress: the pulsing progress bar',
		withLibrary: true,
		async reach(page, text) {
			await library(page, text);
			// The silent check at launch has answered: hold the manual one
			await page.waitForFunction(() => window.__KHI_MOCK__.calls.some((c) => c.cmd === 'plugin:updater|check'));
			await page.evaluate(() => window.__KHI_MOCK__.hold('plugin:updater|check'));
			await emitWhenListening(page, 'check-for-updates');
			await page.waitForFunction(() => window.__KHI_MOCK__.held.includes('plugin:updater|check'));
			const bar = page.getByTestId('update-dialog').getByRole('progressbar');
			await expect(bar).toBeVisible();
			// No `motion-reduce:` here: it pulses with reduced motion too
			await expectAnimation(page, '[data-testid="update-dialog"] [role="progressbar"] > div', true);
		}
	},
	'settings-saving': {
		name: 'settings-saving',
		description: 'Settings while saving: the primary button with its spinner',
		withLibrary: true,
		window: 'settings',
		async reach(page, text) {
			await openSettings(page);
			const radio = page.locator(`${SETTINGS} [role="radio"][aria-checked="false"]`).first();
			const value = await radio.getAttribute('data-value');
			await radio.dispatchEvent('click');
			await expect(page.locator(`${SETTINGS} [role="radio"][data-value="${value}"]`)).toHaveAttribute('aria-checked', 'true');
			const save = page.getByRole('button', { name: text.saveChanges, exact: true });
			await expect(save).toBeEnabled();
			await page.evaluate(() => window.__KHI_MOCK__.hold('update_settings'));
			await save.dispatchEvent('click');
			await page.waitForFunction(() => window.__KHI_MOCK__.held.includes('update_settings'));
			await expect(page.locator(`${SETTINGS} svg.animate-spin`)).toBeVisible();
			await expectAnimation(page, `${SETTINGS} svg.animate-spin`, true);
		}
	}
};

export interface Capture {
	id: string;
	scenario: Scenario;
	variant: Variant;
}

function captureId(scenario: string, v: Variant) {
	return [scenario, v.theme, v.contrast && 'hc', v.reducedMotion && 'rm', v.language !== 'pt' && v.language, v.size]
		.filter(Boolean)
		.join('--');
}

/** The matrix: every scenario in every theme, plus accessibility and English variants of the key ones. */
export function captures(): Capture[] {
	const out: Capture[] = [];
	const add = (scenario: string, variant: Variant) =>
		out.push({ id: captureId(scenario, variant), scenario: SCENARIOS[scenario], variant });
	const themes: ThemeName[] = ['light', 'dark-app', 'system-dark'];
	for (const scenario of Object.keys(SCENARIOS)) {
		for (const theme of themes) add(scenario, { theme, language: 'pt' });
	}
	for (const scenario of ['grid', 'settings']) {
		for (const theme of ['light', 'dark-app'] as const) {
			add(scenario, { theme, language: 'pt', contrast: 'more' });
			add(scenario, { theme, language: 'pt', reducedMotion: 'reduce' });
		}
		add(scenario, { theme: 'light', language: 'en' });
	}
	// Every animated state, with and without reduced motion
	for (const scenario of ['importing', 'update-checking', 'settings-saving']) {
		for (const theme of ['light', 'dark-app'] as const) add(scenario, { theme, language: 'pt', reducedMotion: 'reduce' });
	}
	// The smallest window the app allows
	for (const scenario of ['grid', 'list', 'detail', 'settings']) {
		for (const theme of ['light', 'dark-app'] as const) add(scenario, { theme, language: 'pt', size: 'min' });
	}
	return out;
}

export function mockConfigFor(scenario: Scenario, variant: Variant): MockConfig {
	const library = scenario.withoutNews ? booksWithoutNews : books;
	return {
		settings: makeSettings({ theme: THEMES[variant.theme].app, language: variant.language, viewMode: scenario.viewMode }),
		defaultSettings: defaultSettings(variant.language),
		defaultExportPath: `${HOME}/Documents/Kobo Highlights`,
		appVersion: APP_VERSION,
		readers: scenario.withLibrary ? [reader] : [],
		lastReader: scenario.withLibrary ? reader.id : null,
		deviceAtStartup: null,
		koboOwners: scenario.withLibrary ? { [device.serialNumber!]: reader.id } : {},
		library: scenario.withLibrary ? { [reader.id]: library } : {},
		summary,
		update: scenario.update ? availableUpdate : null,
		windowLabel: scenario.window ?? 'main'
	};
}
