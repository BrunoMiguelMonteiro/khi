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

/** The second Reader of `otherReaderKobo`: the name the tooltip gives. */
const otherReader = { id: 2, name: 'Ana', exportPath: null };

export interface Scenario {
	name: string;
	description: string;
	viewMode?: ViewMode;
	/** Every book has been opened or exported: no highlight is new, so there is no header: the grid starts 24 px below the bar. */
	withoutNews?: boolean;
	/** The Kobo's Reader and its Library exist (all but `empty`). */
	withLibrary: boolean;
	/** The Kobo that connects belongs to a second Reader, Ana, while Bruno's Library is open (Sync on connect off). */
	otherReaderKobo?: boolean;
	/** The Reader exists with no books yet: the first Sync. */
	emptyLibrary?: boolean;
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
	/** The bar's Export with nothing selected: every book. */
	exportAll: string;
	/** The Sync button's tooltip while it syncs, at 12 of 42 books. */
	syncTooltip: string;
	/** Why the Export waits. */
	exportDisabledReason: string;
	syncDisabledReason: string;
	syncOtherReaderReason: string;
	/** The title of the first Sync's centred state, and its text at 12 of 42 books. */
	syncingTitle: string;
	syncingText: string;
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
		exportAll: 'Exportar 5 livros',
		syncTooltip: 'A sincronizar · 12 de 42 livros',
		exportDisabledReason: 'Espera pelo fim da sincronização',
		syncDisabledReason: 'Liga o Kobo para sincronizar',
		syncOtherReaderReason: 'O Kobo ligado é de Ana',
		syncingTitle: 'A sincronizar com o Kobo',
		syncingText: '12 de 42 livros',
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
		exportAll: 'Export 5 books',
		syncTooltip: 'Syncing · 12 of 42 books',
		exportDisabledReason: 'Wait for the sync to finish',
		syncDisabledReason: 'Connect your Kobo to sync',
		syncOtherReaderReason: 'The connected Kobo belongs to Ana',
		syncingTitle: 'Syncing with the Kobo',
		syncingText: '12 of 42 books',
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

/** The Library of the last Reader with no Kobo connected: nothing emits `device-detected`. */
async function libraryWithoutKobo(page: Page, text: Strings) {
	await expect(page.getByTestId('books-grid')).toBeVisible();
	await expect(page.getByTestId('book-card')).toHaveCount(booksWithoutNews.length);
	await page.waitForFunction(() => (window.__KHI_MOCK__.listeners['device-disconnected'] ?? []).length > 0);
	await expect(page.getByRole('button', { name: text.sync, exact: true })).toBeVisible();
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

/** The bar's Sync button, whose icon turns while a Sync runs (`motion-reduce:` stops it). */
const syncIcon = (page: Page, text: Strings) => bar(page).getByRole('button', { name: text.sync, exact: true }).locator('svg');

/** Asserts the Sync icon turns (`spin`), or does not. */
async function expectSpin(page: Page, text: Strings, turning: boolean) {
	const name = () => syncIcon(page, text).evaluate((el) => getComputedStyle(el).animationName);
	if (turning) await expect.poll(name).toBe('spin');
	else await expect.poll(name).toBe('none');
}

/**
 * A Sync that stays running: `sync_kobo` is held until the scenario releases it, and Rust has counted
 * 42 books and read 12 (the Figma's «12 de 42 livros»).
 */
async function startSync(page: Page, text: Strings) {
	await page.evaluate(() => window.__KHI_MOCK__.hold('sync_kobo'));
	await page.getByRole('button', { name: text.sync, exact: true }).dispatchEvent('click');
	await page.waitForFunction(() => window.__KHI_MOCK__.held.includes('sync_kobo'));
	await emitWhenListening(page, 'sync-progress', { done: 12, total: 42 });
}

/** Selects `SELECTED`: ⌘-click on a grid card (events, not mouse moves), the selection box of a list row. The bar's Export then counts them. */
async function selectBooks(page: Page, text: Strings, view: 'grid' | 'list') {
	for (const index of SELECTED) {
		if (view === 'grid') {
			const card = page.getByTestId('book-card').nth(index);
			await card.dispatchEvent('click', { metaKey: true });
			await expect(card).toHaveAttribute('aria-selected', 'true');
		} else {
			const row = page.getByTestId('book-row').nth(index);
			await row.locator('[data-slot="selection-box"]').dispatchEvent('click');
			await expect(row).toHaveAttribute('aria-selected', 'true');
		}
	}
	await expect(bar(page).getByRole('button', { name: text.export2, exact: true })).toBeVisible();
}

async function listView(page: Page, text: Strings) {
	await connectKobo(page, text);
	await expect(page.getByTestId('books-list')).toBeVisible();
	await expect(page.getByText(books[0].title).first()).toBeVisible();
	// Task 42: a 1 px border under the header row; 44 days ago (2 Oct, now 15 Nov) reads as a short date, 5 days ago stays relative
	await expect(page.getByTestId('books-list').getByRole('row').first()).toHaveCSS('border-bottom-width', '1px');
	const lastRead = page.locator('[data-slot="book-row-last-read"]');
	// The Last read column is gone below 900 px, and the order depends on the scenario's sort
	if ((await lastRead.count()) > 0) {
		await expect(lastRead.filter({ hasText: /^(2 out\.|Oct 2)$/ })).toHaveCount(1);
		await expect(lastRead.filter({ hasText: /^(Há 5 dias|5 days ago)$/ })).toHaveCount(1);
	}
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
	'library-disconnected': {
		name: 'library-disconnected',
		description: 'No Kobo, nothing new: no header, Sync disabled, Export enabled because the highlights are stored',
		withLibrary: true,
		withoutNews: true,
		async reach(page, text) {
			await libraryWithoutKobo(page, text);
			await expect(page.locator('[data-slot="library-header"]')).toHaveCount(0);
			await expect(bar(page).getByRole('button', { name: text.sync, exact: true })).toHaveAttribute('aria-disabled', 'true');
			await expect(bar(page).getByRole('button', { name: text.exportAll, exact: true })).not.toHaveAttribute('aria-disabled', 'true');
		}
	},
	'library-disconnected-tooltip': {
		name: 'library-disconnected-tooltip',
		description: 'Hover on the disabled Sync with no Kobo: the tooltip says «Liga o Kobo para sincronizar»',
		withLibrary: true,
		withoutNews: true,
		async reach(page, text) {
			await libraryWithoutKobo(page, text);
			const sync = bar(page).getByRole('button', { name: text.sync, exact: true });
			await expect(sync).toHaveAttribute('aria-disabled', 'true');
			await sync.hover();
			await tooltipOpen(page);
			await expect(page.locator('[data-slot="tooltip-content"]:not([data-state="closed"])')).toHaveText(text.syncDisabledReason);
		}
	},
	'library-other-reader-tooltip': {
		name: 'library-other-reader-tooltip',
		description: "Another Reader's Kobo is connected: Sync is disabled and the tooltip says whose Kobo it is",
		withLibrary: true,
		withoutNews: true,
		otherReaderKobo: true,
		async reach(page, text) {
			await libraryWithoutKobo(page, text);
			await emitWhenListening(page, 'device-detected', { device });
			const sync = bar(page).getByRole('button', { name: text.sync, exact: true });
			await sync.hover();
			await tooltipOpen(page);
			await expect(page.locator('[data-slot="tooltip-content"]:not([data-state="closed"])')).toHaveText(text.syncOtherReaderReason);
			await expect(sync).toHaveAttribute('aria-disabled', 'true');
		}
	},
	list: {
		name: 'list',
		description: 'Kobo connected, the Library as a list',
		withLibrary: true,
		viewMode: 'list',
		states: [
			{ name: 'hover-list-row', kind: 'hover', target: (p) => p.getByTestId('book-row') },
			{
				name: 'hover-box',
				kind: 'hover',
				target: (p) => p.getByTestId('book-row'),
				// The pointer on the box itself, which turns the outline to its hover value
				ready: async (p) => {
					const box = p.getByTestId('book-row').first().locator('[data-slot="selection-box"]');
					await box.hover();
					await expect.poll(() => box.evaluate((el) => el.matches(':hover'))).toBe(true);
				}
			},
			{ name: 'focus-list-row', kind: 'focus', target: (p) => p.getByTestId('book-row'), root: '[data-testid="book-row"]' }
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
	'select-by-box': {
		name: 'select-by-box',
		description: 'One book selected through its selection box with the real pointer: it selects without opening, and the other covers show their box',
		withLibrary: true,
		async reach(page, text) {
			await library(page, text);
			const card = page.getByTestId('book-card').nth(SELECTED[0]);
			const box = card.locator('[data-slot="selection-box"]');
			// Hidden and click-through at rest: the hover shows it, and the click then lands on the box, not on the cover
			await expect(box).toHaveCSS('pointer-events', 'none');
			await card.hover();
			await expect(box).toHaveCSS('pointer-events', 'auto');
			await expect(box).toHaveCSS('opacity', '1');
			await box.click();
			await expect(card).toHaveAttribute('aria-selected', 'true');
			// Selecting, not opening: still the grid, and the bar counts the book
			await expect(page.getByTestId('books-grid')).toBeVisible();
			const others = page.getByTestId('book-card').filter({ hasNot: page.locator('[data-state="checked"]') });
			await expect(others).toHaveCount(books.length - 1);
			for (const other of await others.all()) {
				await expect(other).toHaveAttribute('data-selecting', '');
				await expect(other.locator('[data-slot="selection-box"]')).toHaveCSS('opacity', '1');
				await expect(other.locator('[data-slot="selection-box"]')).toHaveCSS('pointer-events', 'auto');
			}
			// Park the pointer off the cards, so the capture shows the selecting state, not a hover
			await page.mouse.move(0, 0);
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
				target: (p) => p.getByTestId('book-row').nth(SELECTED[0])
			},
			// The selected and focused row: the 2 px primary-foreground ring, recessed 2 px
			{
				name: 'focus-selected-row',
				kind: 'focus',
				target: (p) => p.getByTestId('book-row').nth(SELECTED[0]),
				root: '[data-testid="book-row"]'
			}
		],
		async reach(page, text) {
			await listView(page, text);
			await selectBooks(page, text, 'list');
		}
	},
	'list-selecting': {
		name: 'list-selecting',
		description: 'One book selected through its selection box: the other rows keep their empty box',
		withLibrary: true,
		viewMode: 'list',
		async reach(page, text) {
			await listView(page, text);
			const row = page.getByTestId('book-row').nth(SELECTED[0]);
			await row.locator('[data-slot="selection-box"]').dispatchEvent('click');
			await expect(row).toHaveAttribute('aria-selected', 'true');
			await expect(page.getByTestId('books-list')).toBeVisible();
			await expect(page.getByTestId('book-row').nth(1)).toHaveAttribute('aria-selected', 'false');
			const box = page.getByTestId('book-row').nth(1).locator('[data-slot="selection-box"]');
			await expect(box).toBeVisible();
			await expect(box.locator(':scope > span')).toHaveCSS('border-top-color', 'rgb(142, 142, 146)');
			await page.mouse.move(0, 0);
		}
	},
	'list-reversed': {
		name: 'list-reversed',
		description: 'The active column header clicked twice: the order flips and the arrow points up',
		withLibrary: true,
		viewMode: 'list',
		async reach(page, text) {
			await listView(page, text);
			// The last column: the first click makes it the sort, the second reverses it
			const header = page.locator('[data-slot="column-header"]').last();
			await header.getByRole('button').dispatchEvent('click');
			await header.getByRole('button').dispatchEvent('click');
			await expect(header).toHaveAttribute('aria-sort', 'ascending');
			await page.mouse.move(0, 0);
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
	'library-syncing': {
		name: 'library-syncing',
		description: 'A Sync in progress, the Library on screen: the header counts the books, no card has its «N novos» badge, Sync turns and Export waits',
		withLibrary: true,
		async reach(page, text, variant) {
			await library(page, text);
			await startSync(page, text);
			const header = page.locator('[data-slot="library-header"]');
			await expect(header).toHaveAttribute('data-state', 'aSincronizar');
			await expect(header).toContainText('12 de 42 livros');
			await expect(page.getByTestId('book-card')).toHaveCount(books.length);
			// The badges fade out in 150 ms and leave the DOM
			await expect(page.locator('[data-slot="badge"]')).toHaveCount(0);
			await expect(bar(page).getByRole('button', { name: text.exportAll, exact: true })).toHaveAttribute('aria-disabled', 'true');
			await expectSpin(page, text, variant.reducedMotion !== 'reduce');
		}
	},
	'library-syncing-tooltip': {
		name: 'library-syncing-tooltip',
		description: "Hover on Sync while it syncs: the tooltip says «A sincronizar · 12 de 42 livros», without the shortcut",
		withLibrary: true,
		async reach(page, text) {
			await library(page, text);
			await startSync(page, text);
			const sync = bar(page).getByRole('button', { name: text.sync, exact: true });
			// Sync stays enabled while it turns
			await expect(sync).not.toHaveAttribute('aria-disabled', 'true');
			await sync.hover();
			await tooltipOpen(page);
			await expect(page.locator('[data-slot="tooltip-content"]:not([data-state="closed"])')).toHaveText(text.syncTooltip);
		}
	},
	'library-syncing-export-disabled': {
		name: 'library-syncing-export-disabled',
		description: 'Hover on Export while it syncs: it is disabled and the tooltip says why',
		withLibrary: true,
		async reach(page, text) {
			await library(page, text);
			await startSync(page, text);
			const exportButton = bar(page).getByRole('button', { name: text.exportAll, exact: true });
			await expect(exportButton).toHaveAttribute('aria-disabled', 'true');
			await exportButton.hover();
			await tooltipOpen(page);
			await expect(page.locator('[data-slot="tooltip-content"]:not([data-state="closed"])')).toHaveText(text.exportDisabledReason);
		}
	},
	'library-empty-syncing': {
		name: 'library-empty-syncing',
		description: 'The first Sync, with no books yet: the centred state, with the solid Kobo whose 7 lines fill with the progress (12 of 42: 2 lines)',
		withLibrary: true,
		emptyLibrary: true,
		async reach(page, text, variant) {
			await expect(page.getByTestId('empty-state')).toBeVisible();
			await page.waitForFunction(() => (window.__KHI_MOCK__.listeners['device-disconnected'] ?? []).length > 0);
			await emitWhenListening(page, 'device-detected', { device });
			await expect(page.getByRole('button', { name: text.sync, exact: true })).not.toHaveAttribute('aria-disabled', 'true');
			await startSync(page, text);
			const state = page.getByTestId('syncing-state');
			await expect(state).toBeVisible();
			await expect(state.getByRole('heading', { name: text.syncingTitle })).toBeVisible();
			await expect(state).toContainText(text.syncingText);
			// No header and no «Sem livros»: only the centred state
			await expect(page.locator('[data-slot="library-header"]')).toHaveCount(0);
			await expect(page.getByTestId('empty-state')).toHaveCount(0);
			// floor(7 × 12 / 42) = 2 lines, the same with reduced motion (the change is colour only)
			await expect(state.locator('svg line')).toHaveCount(7);
			await expect(state.locator('svg line[data-filled]')).toHaveCount(2);
			await expectSpin(page, text, variant.reducedMotion !== 'reduce');
		}
	},
	'sync-finished-enters': {
		name: 'sync-finished-enters',
		description: 'The end of a Sync: the «novos» header and the badges came in together, Sync stopped and Export is back',
		withLibrary: true,
		async reach(page, text) {
			await library(page, text);
			await startSync(page, text);
			await expect(page.locator('[data-slot="library-header"]')).toHaveAttribute('data-state', 'aSincronizar');
			await expect(page.locator('[data-slot="badge"]')).toHaveCount(0);

			await page.evaluate(() => window.__KHI_MOCK__.release('sync_kobo'));
			const header = page.locator('[data-slot="library-header"]');
			await expect(header).toHaveAttribute('data-state', 'novos');
			await expect(header).toHaveCount(1);
			await expect(page.locator('[data-slot="badge"]')).toHaveCount(2);
			await expect(bar(page).getByRole('button', { name: text.exportAll, exact: true })).not.toHaveAttribute('aria-disabled', 'true');
			// The icon finishes its lap and stops
			await expectSpin(page, text, false);
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
	for (const scenario of ['library-syncing', 'library-empty-syncing', 'update-checking', 'settings-saving']) {
		for (const theme of ['light', 'dark-app'] as const) add(scenario, { theme, language: 'pt', reducedMotion: 'reduce' });
	}
	// The smallest window the app allows
	for (const scenario of ['grid', 'list', 'detail', 'settings']) {
		for (const theme of ['light', 'dark-app'] as const) add(scenario, { theme, language: 'pt', size: 'min' });
	}
	return out;
}

export function mockConfigFor(scenario: Scenario, variant: Variant): MockConfig {
	const library = scenario.emptyLibrary ? [] : scenario.withoutNews ? booksWithoutNews : books;
	return {
		settings: makeSettings({ theme: THEMES[variant.theme].app, language: variant.language, viewMode: scenario.viewMode }),
		defaultSettings: defaultSettings(variant.language),
		defaultExportPath: `${HOME}/Documents/Kobo Highlights`,
		appVersion: APP_VERSION,
		readers: scenario.withLibrary ? (scenario.otherReaderKobo ? [reader, otherReader] : [reader]) : [],
		lastReader: scenario.withLibrary ? reader.id : null,
		deviceAtStartup: null,
		koboOwners: scenario.withLibrary ? { [device.serialNumber!]: scenario.otherReaderKobo ? otherReader.id : reader.id } : {},
		library: scenario.withLibrary ? { [reader.id]: library, ...(scenario.otherReaderKobo ? { [otherReader.id]: [] } : {}) } : {},
		summary,
		update: scenario.update ? availableUpdate : null,
		windowLabel: scenario.window ?? 'main'
	};
}
