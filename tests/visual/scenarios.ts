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
import { APP_VERSION, HOME, availableUpdate, books, booksAna, booksCoverTitles, booksDeletable, booksWithoutNews, defaultSettings, device, makeSettings, newSinceAna, reader, summary } from './fixtures';

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
	/** A Kobo nobody owns connects while Bruno's Library is open, and Ana is the other Reader: «De quem é este Kobo?». */
	unownedKobo?: boolean;
	/** Bruno and Ana both exist, the Kobo is Bruno's, and Ana's Library has her own books (Ecrã 10). */
	twoReaders?: boolean;
	/** The Reader exists with no books yet: the first Sync. */
	emptyLibrary?: boolean;
	/** `settings`: the Settings window, its own route (`/definicoes`) and size. Default: the main window. */
	window?: 'settings';
	/** `settings`: the window's height, that of its pane (Task 45). The page measures it and sets the size; the harness checks that it did. */
	windowHeight?: number;
	update?: boolean;
	/** The Library has «O Retorno» first, every highlight of it removed from the Kobo: the detail has the trash can (Ecrã 9). */
	deletableBook?: boolean;
	/** The Library is `booksCoverTitles`: the Q-N titles on covers with no image (Task 49). */
	coverTitles?: boolean;
	/** The export fails with `folderNotWritable` for `~/Documents/Kobo` (Ecrã 8). */
	exportFailure?: boolean;
	/** The updater fails: `check` (state 6) or the install after a download that worked (state 7). */
	updateFailure?: 'check' | 'install';
	/** `console.error`s the app logs on purpose (a failure it shows): each starts with `prefix` and is logged exactly `times` times; the others still fail the test. */
	expectedConsoleErrors?: { prefix: string; times: number }[];
	/** Records keyboard focus states by pressing Tab. */
	focusStops?: number;
	/** Hover and focus states recorded after the page. */
	states?: StateProbe[];
	/** Brings the page from the Library (or the empty state) to the state. */
	reach(page: Page, text: Strings, variant: Variant): Promise<void>;
}

export interface Strings {
	/** The first start's title (Ecrã 6). */
	noKoboTitle: string;
	/** «De quem é este Kobo?» and its controls. */
	whoseKoboTitle: string;
	choose: string;
	cancel: string;
	newReaderOption: string;
	readerName: string;
	/** The pop-up's row label. */
	readerLabel: string;
	createReader: string;
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
	/** The title of Bruno's and of Ana's Library (the Título-menu's button), and Ana's header. */
	titleBruno: string;
	titleAna: string;
	newsAna: string;
	/** The title of the first Sync's centred state, and its text at 12 of 42 books. */
	syncingTitle: string;
	syncingText: string;
	/** The Settings window's tabs. */
	tabExport: string;
	tabAppearance: string;
	tabKobo: string;
	tabUpdates: string;
	/** Export's «Escolher…» button and the Kobo pane's switch. */
	chooseFolder: string;
	syncOnConnect: string;
	install: string;
	later: string;
	checkNow: string;
	/** The updates switch, and the buttons of the update window's other phases. */
	autoUpdates: string;
	skip: string;
	ok: string;
	tryAgain: string;
	restartNow: string;
	checkingTitle: string;
	upToDateTitle: string;
	downloadingTitle: string;
	downloadingText: string;
	installedTitle: string;
	errorTitle: string;
	installErrorTitle: string;
	/** Ecrã 8: the header's button after an export, the toast's action, and the error with its action. */
	exportedLabel: string;
	showInFinder: string;
	exportErrorTitle: string;
	exportErrorDetail: string;
	chooseFolderAction: string;
	/** Ecrã 9: the bar's trash can and its tooltip, and the window's texts. */
	deleteBook: string;
	deleteTooltip: string;
	deleteTitle: string;
	deleteBody: string;
	deleteConfirm: string;
}

const STRINGS: Record<Language, Strings> = {
	pt: {
		noKoboTitle: 'Liga o teu Kobo',
		whoseKoboTitle: 'De quem é este Kobo?',
		choose: 'Escolher',
		cancel: 'Cancelar',
		newReaderOption: 'Novo leitor…',
		readerName: 'Nome',
		readerLabel: 'Leitor',
		createReader: 'Criar leitor',
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
		titleBruno: 'Biblioteca de Bruno',
		titleAna: 'Biblioteca de Ana',
		newsAna: '8 destaques novos em 2 livros',
		syncingTitle: 'A sincronizar com o Kobo',
		syncingText: '12 de 42 livros',
		tabExport: 'Exportação',
		tabAppearance: 'Aparência',
		tabKobo: 'Kobo',
		tabUpdates: 'Atualizações',
		chooseFolder: 'Escolher…',
		syncOnConnect: 'Sincronizar ao ligar',
		install: 'Instalar e reiniciar',
		later: 'Mais tarde',
		checkNow: 'Procurar agora',
		autoUpdates: 'Procurar atualizações automaticamente',
		skip: 'Saltar esta versão',
		ok: 'OK',
		tryAgain: 'Tentar outra vez',
		restartNow: 'Reiniciar agora',
		checkingTitle: 'A procurar atualizações…',
		upToDateTitle: 'Khi está atualizado.',
		downloadingTitle: 'A descarregar a versão Khi 2.0.0',
		downloadingText: '4,3 MB de 6,9 MB',
		installedTitle: 'Khi 2.0.0 está instalado.',
		errorTitle: 'Não foi possível procurar atualizações',
		installErrorTitle: 'Não foi possível instalar a atualização',
		exportedLabel: '✓ Exportado',
		showInFinder: 'Mostrar no Finder',
		exportErrorTitle: 'Não foi possível exportar.',
		exportErrorDetail: 'O Khi não consegue escrever em ~/Documents/Kobo. Escolhe outra pasta.',
		chooseFolderAction: 'Escolher pasta…',
		deleteBook: 'Apagar livro…',
		deleteTooltip: 'Apagar livro… ⌘⌫',
		deleteTitle: 'Apagar este livro?',
		deleteBody: 'Todos os destaques foram removidos do Kobo. O livro e os destaques saem da Biblioteca de vez.',
		deleteConfirm: 'Apagar'
	},
	en: {
		noKoboTitle: 'Connect your Kobo',
		whoseKoboTitle: 'Whose Kobo is this?',
		choose: 'Choose',
		cancel: 'Cancel',
		newReaderOption: 'New reader…',
		readerName: 'Name',
		readerLabel: 'Reader',
		createReader: 'Create reader',
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
		titleBruno: "Bruno's Library",
		titleAna: "Ana's Library",
		newsAna: '8 new highlights in 2 books',
		syncingTitle: 'Syncing with the Kobo',
		syncingText: '12 of 42 books',
		tabExport: 'Export',
		tabAppearance: 'Appearance',
		tabKobo: 'Kobo',
		tabUpdates: 'Updates',
		chooseFolder: 'Choose…',
		syncOnConnect: 'Sync on connect',
		install: 'Install and Restart',
		later: 'Later',
		checkNow: 'Check Now',
		autoUpdates: 'Automatically check for updates',
		skip: 'Skip This Version',
		ok: 'OK',
		tryAgain: 'Try Again',
		restartNow: 'Restart Now',
		checkingTitle: 'Checking for Updates…',
		upToDateTitle: 'Khi is up to date.',
		downloadingTitle: 'Downloading Khi 2.0.0',
		downloadingText: '4.3 MB of 6.9 MB',
		installedTitle: 'Khi 2.0.0 is installed.',
		errorTitle: 'Couldn’t Check for Updates',
		installErrorTitle: 'Couldn’t Install the Update',
		exportedLabel: '✓ Exported',
		showInFinder: 'Show in Finder',
		exportErrorTitle: 'Couldn’t export.',
		exportErrorDetail: 'Khi can’t write to ~/Documents/Kobo. Choose another folder.',
		chooseFolderAction: 'Choose folder…',
		deleteBook: 'Delete book…',
		deleteTooltip: 'Delete book… ⌘⌫',
		deleteTitle: 'Delete this book?',
		deleteBody: 'Its highlights were all removed from the Kobo. The book and its highlights leave the Library for good.',
		deleteConfirm: 'Delete'
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

async function libraryWithFirst(page: Page, text: Strings, firstTitle: string) {
	await connectKobo(page, text);
	await expect(page.getByTestId('books-grid')).toBeVisible();
	await expect(page.getByTestId('book-card')).toHaveCount(books.length);
	await expect(page.getByRole('option', { name: firstTitle })).toBeVisible();
}

// Not `libraryWithFirst` itself: scenarios pass this as `reach`, which hands it a third argument
async function library(page: Page, text: Strings) {
	await libraryWithFirst(page, text, books[0].title);
}

/** The first book, opened: events, not mouse moves, since hover states are recorded separately. */
async function openDetail(page: Page, text: Strings) {
	await library(page, text);
	await page.getByRole('option', { name: books[0].title }).dispatchEvent('click');
	const view = page.getByTestId('book-details-view');
	await expect(view).toBeVisible();
	await expect(view.getByRole('heading', { name: books[0].title })).toBeVisible();
	await expect(view.locator('[data-slot="highlight"]')).toHaveCount(books[0].highlights.length);
	// Figma: 48 from the Segmented to where the first highlight's line starts
	const group = await view.getByRole('radiogroup').boundingBox();
	const line = await view.locator('[data-slot="highlight-line"]').first().boundingBox();
	expect(line!.y - (group!.y + group!.height)).toBe(48);
	await page.mouse.move(0, 0);
}

/** «O Retorno», opened: its three highlights removed from the Kobo, so the bar has the trash can. */
async function openDeletableDetail(page: Page, text: Strings) {
	await libraryWithFirst(page, text, 'O Retorno');
	await page.getByRole('option', { name: 'O Retorno' }).dispatchEvent('click');
	const view = page.getByTestId('book-details-view');
	await expect(view.getByRole('heading', { name: 'O Retorno' })).toBeVisible();
	await expect(view.locator('[data-slot="highlight"]')).toHaveCount(3);
	await expect(view.locator('[data-slot="highlight-removed"]')).toHaveCount(3);
	await expect(bar(page).getByRole('button', { name: text.deleteBook, exact: true })).toBeVisible();
	await page.mouse.move(0, 0);
}

/** The Library of the last Reader with no Kobo connected: nothing emits `device-detected`. */
async function libraryWithoutKobo(page: Page, text: Strings) {
	await expect(page.getByTestId('books-grid')).toBeVisible();
	await expect(page.getByTestId('book-card')).toHaveCount(booksWithoutNews.length);
	await page.waitForFunction(() => (window.__KHI_MOCK__.listeners['device-disconnected'] ?? []).length > 0);
	await expect(page.getByRole('button', { name: text.sync, exact: true })).toBeVisible();
}

/** The Settings window, as Rust opens it: its route, on the pane it last had (Exportação), the page having sized and shown the window. */
async function openSettings(page: Page) {
	await expect(page.locator('[data-slot="settings-window"]')).toBeVisible();
	await page.waitForFunction(() => window.__KHI_MOCK__.calls.some((c) => c.cmd === 'plugin:window|show'));
}

/** Another tab, as the user clicks it; the page then sizes the window to that pane. */
async function openTab(page: Page, name: string) {
	await openSettings(page);
	await page.getByRole('tab', { name, exact: true }).click();
	await expect(page.getByRole('tab', { name, exact: true })).toHaveAttribute('aria-selected', 'true');
	await page.mouse.move(0, 0);
}

/** The computed `animation-name` of the first match. */
const animationName = (page: Page, selector: string) =>
	page.locator(selector).first().evaluate((el) => getComputedStyle(el).animationName);

/** Asserts an animation runs, or (with `prefers-reduced-motion: reduce`, when the app honours it) does not. */
async function expectAnimation(page: Page, selector: string, running: boolean) {
	if (running) await expect.poll(() => animationName(page, selector)).not.toBe('none');
	else await expect.poll(() => animationName(page, selector)).toBe('none');
}

/** The pane on show (Bits UI keeps the others in the page, `hidden`). */
const PANE = '[role="tabpanel"]:not([hidden])';

/** The books selected in the `*-selected` scenarios: not adjacent, so a selected card sits next to an unselected one. */
const SELECTED = [0, 2];

/** The toolbar buttons and the view group show a tooltip: wait for it, or the screenshot races its 500 ms delay. */
const tooltipOpen = async (page: Page) => {
	await expect(page.locator('[data-slot="tooltip-content"]:not([data-state="closed"])')).toBeVisible();
};

/**
 * Holds the page's timers of `ms` for good (12 days): the 2 s of «✓ Exportado» and the toast's 4 s hold
 * would otherwise run out while the harness waits for the IPC to go quiet, before the screenshot.
 */
async function holdTimers(page: Page, ...ms: number[]) {
	await page.evaluate((held) => {
		const original = window.setTimeout.bind(window);
		window.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) =>
			original(handler, held.includes(timeout ?? 0) ? 2 ** 30 : timeout, ...args)) as typeof window.setTimeout;
	}, ms);
}

/** The header's own export, as an event (the pointer stays off the button, so no hover state is captured). */
async function exportFromHeader(page: Page, text: Strings) {
	await page.locator('[data-slot="library-header"]').getByRole('button', { name: text.exportNews, exact: true }).dispatchEvent('click');
}

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

/** The update window's width, as its layout has it: the box a transform scales (the opening zoom) is not the width. */
const expectWindowWidth = (page: Page, width: number) =>
	expect.poll(() => page.getByTestId('update-dialog').evaluate((el) => (el as HTMLElement).offsetWidth)).toBe(width);

/** The silent check at launch has answered. */
async function launchCheckAnswered(page: Page) {
	await page.waitForFunction(() => window.__KHI_MOCK__.calls.some((c) => c.cmd === 'plugin:updater|check'));
}

/** «Procurar atualizações…» (the menu) or Settings' «Procurar agora»: the main window is asked to check. */
async function askForCheck(page: Page) {
	await launchCheckAnswered(page);
	await emitWhenListening(page, 'check-for-updates');
}

/** The manual check is held: the window stays on «A procurar…». */
async function holdCheck(page: Page) {
	await launchCheckAnswered(page);
	await page.evaluate(() => window.__KHI_MOCK__.hold('plugin:updater|check'));
	await emitWhenListening(page, 'check-for-updates');
	await page.waitForFunction(() => window.__KHI_MOCK__.held.includes('plugin:updater|check'));
}

export const SCENARIOS: Record<string, Scenario> = {
	'first-launch': {
		name: 'first-launch',
		description: 'The first start, no Reader and no Kobo (Ecrã 6, Figma 72:11425): «Liga o teu Kobo», and the bar with every control greyed',
		withLibrary: false,
		async reach(page, text) {
			await expect(page.getByText(text.noKoboTitle, { exact: true })).toBeVisible();
			await expect(page.getByTestId('books-grid')).toHaveCount(0);
			// Everything in view and nothing within reach: the view group, Sort, Sync and Export
			const controls = bar(page);
			for (const radio of await controls.getByRole('radio').all()) {
				await expect(radio).toBeDisabled();
				// Estado=Desativado for both: the selected one has no fill either (Figma 72:11425)
				await expect(radio).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			}
			for (const name of [text.sortBy, text.sync, /^(Exportar|Export) \d+ /]) {
				await expect(controls.getByRole('button', { name })).toHaveAttribute('aria-disabled', 'true');
			}
		}
	},
	'unknown-kobo': {
		name: 'unknown-kobo',
		description: 'A Kobo nobody owns connects with Bruno\'s Library open: «De quem é este Kobo?» with the pop-up on Bruno (Ecrã 6, Figma 58:6794)',
		withLibrary: true,
		withoutNews: true,
		unownedKobo: true,
		async reach(page, text) {
			await libraryWithoutKobo(page, text);
			await emitWhenListening(page, 'device-detected', { device });
			const dialog = page.getByRole('dialog', { name: text.whoseKoboTitle });
			await expect(dialog).toBeVisible();
			await expect(dialog.getByRole('combobox')).toHaveText(reader.name);
			// The 56 px label hugs the pop-up: right-aligned, 8 from it
			await expect(dialog.getByText(text.readerLabel, { exact: true })).toHaveCSS('text-align', 'right');
			await expect(dialog.getByRole('button', { name: text.choose, exact: true })).toBeVisible();
			await expect(dialog.getByRole('button', { name: text.cancel, exact: true })).toBeVisible();
			// 380 × 212, the Figma's Kobo novo · Com leitores
			// Layout size (the opening scale is still running); the height without the 1 px borders, which the Figma draws inside the frame
			expect(await dialog.evaluate((el) => [(el as HTMLElement).offsetWidth, (el as HTMLElement).clientHeight])).toEqual([380, 212]);
		}
	},
	'unknown-kobo-new-reader': {
		name: 'unknown-kobo-new-reader',
		description: 'The same, with «Novo leitor…» chosen and a name written (Ecrã 6, Figma 62:2147)',
		withLibrary: true,
		withoutNews: true,
		unownedKobo: true,
		async reach(page, text) {
			await libraryWithoutKobo(page, text);
			await emitWhenListening(page, 'device-detected', { device });
			const dialog = page.getByRole('dialog', { name: text.whoseKoboTitle });
			await expect(dialog).toBeVisible();
			await dialog.getByRole('combobox').click();
			await page.getByRole('option', { name: text.newReaderOption, exact: true }).click();
			const name = dialog.getByRole('textbox', { name: text.readerName, exact: true });
			await expect(name).toBeVisible();
			// Empty, and with the focus, as the pop-up gives it back
			await expect(name).toHaveValue('');
			await expect(name).toBeFocused();
			await name.fill('Marta');
			await expect(dialog.getByRole('button', { name: text.createReader, exact: true })).not.toHaveAttribute('aria-disabled', 'true');
			// Layout size (the opening scale is still running); the height without the 1 px borders, which the Figma draws inside the frame
			expect(await dialog.evaluate((el) => [(el as HTMLElement).offsetWidth, (el as HTMLElement).clientHeight])).toEqual([380, 248]);
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
	'cover-titles': {
		name: 'cover-titles',
		description: 'Covers with no image and the Q-N titles on the large cover (171) in the grid: non-breaking short words, and no hyphen where every word fits (Task 49, Figma 78:19221)',
		withLibrary: true,
		withoutNews: true,
		coverTitles: true,
		async reach(page, text) {
			await connectKobo(page, text);
			await expect(page.getByTestId('book-card')).toHaveCount(booksCoverTitles.length);
			const title = (name: string) => page.locator(`[data-testid="book-card"][aria-label^="${name},"] [data-slot="cover"] p`).first();
			await expect(title('O Retorno')).toHaveText('O\u00A0Retorno');
			await expect(title('O Desassossego')).toHaveText('O\u00A0Desassossego');
			await expect(title('Desassossego')).toHaveText('Desassossego');
			await page.evaluate(() => document.fonts.ready);
			await page.mouse.move(0, 0);
		}
	},
	// The small cover is the Detail's (96 px, `size="sm"`): the real path, one scenario per title.
	// «O Desassossego» starts out unbound on the small cover, so nothing here proves a new measure
	// when only the size changes: that is the unit test with the fixture (cover.test.ts).
	...Object.fromEntries(
		[
			{ key: 'retorno', title: 'O Retorno', shown: 'O\u00A0Retorno', hyphens: 'manual' },
			{ key: 'desassossego', title: 'Desassossego', shown: 'Desassossego', hyphens: 'auto' },
			{ key: 'o-desassossego', title: 'O Desassossego', shown: 'O Desassossego', hyphens: 'auto' },
			{ key: 'guarda-chuvas', title: 'Guarda-Chuvas', shown: 'Guarda-Chuvas', hyphens: 'auto' },
			{ key: 'ano-ricardo-reis', title: 'O Ano da Morte de Ricardo Reis', shown: 'O\u00A0Ano da\u00A0Morte de\u00A0Ricardo Reis', hyphens: 'manual' }
		].map(({ key, title, shown, hyphens }): [string, Scenario] => [
			`cover-titles-small-${key}`,
			{
				name: `cover-titles-small-${key}`,
				description: `The Detail of «${title}» (no cover image): the small cover, title 13/16, ${hyphens === 'auto' ? 'a word that does not fit may be hyphenated' : 'no hyphenation'} (Task 49, Figma 78:19221)`,
				withLibrary: true,
				withoutNews: true,
				coverTitles: true,
				async reach(page, text) {
					await connectKobo(page, text);
					await expect(page.getByTestId('book-card')).toHaveCount(booksCoverTitles.length);
					await page.locator(`[data-testid="book-card"][aria-label^="${title},"]`).dispatchEvent('click');
					const view = page.getByTestId('book-details-view');
					await expect(view.getByRole('heading', { name: title, exact: true })).toBeVisible();
					const cover = view.locator('[data-slot="cover"] p').first();
					await expect(cover).toHaveText(shown);
					await expect(cover).toHaveCSS('font-size', '13px');
					await expect(cover).toHaveCSS('line-height', '16px');
					await expect(cover).toHaveCSS('hyphens', hyphens);
					expect(await view.locator('[data-slot="cover"]').evaluate((el) => (el as HTMLElement).offsetWidth)).toBe(96);
					await page.evaluate(() => document.fonts.ready);
					await page.mouse.move(0, 0);
				}
			}
		])
	),
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
	'library-reader-menu': {
		name: 'library-reader-menu',
		description: 'Two Readers: the Título-menu «Biblioteca de Bruno ▾» is open with Bruno checked and Ana below (Ecrã 10, Figma 74:17138)',
		withLibrary: true,
		twoReaders: true,
		async reach(page, text) {
			await libraryWithoutKobo(page, text);
			await bar(page).getByRole('button', { name: text.titleBruno, exact: true }).click();
			await expect(page.getByRole('menuitemcheckbox', { name: 'Bruno', exact: true })).toBeVisible();
			await expect(page.getByRole('menuitemcheckbox', { name: 'Bruno', exact: true })).toHaveAttribute('aria-checked', 'true');
			await expect(page.getByRole('menuitemcheckbox', { name: 'Ana', exact: true })).toHaveAttribute('aria-checked', 'false');
			await page.mouse.move(0, 0);
		}
	},
	'library-other-reader': {
		name: 'library-other-reader',
		description: "Ana is chosen in the Título-menu: «Biblioteca de Ana», her six books, «8 destaques novos em 2 livros» and her Export (Ecrã 10, Figma 74:17252)",
		withLibrary: true,
		twoReaders: true,
		async reach(page, text) {
			await libraryWithoutKobo(page, text);
			await bar(page).getByRole('button', { name: text.titleBruno, exact: true }).click();
			await page.getByRole('menuitemcheckbox', { name: 'Ana', exact: true }).click();
			await expect(bar(page).getByRole('button', { name: text.titleAna, exact: true })).toBeVisible();
			await expect(page.getByTestId('book-card')).toHaveCount(booksAna.length);
			await expect(page.locator('[data-slot="library-header"]')).toContainText(text.newsAna);
			await expect(page.locator('[data-slot="library-header"]').getByRole('button', { name: text.exportNews, exact: true })).toBeVisible();
			await page.mouse.move(0, 0);
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
		description: "A book's highlights, none new: the one with a note, the removed one in place",
		withLibrary: true,
		withoutNews: true,
		states: [
			// The row's background (-16 on each side) and its copy button
			{ name: 'hover-highlight', kind: 'hover', target: (p) => p.locator('[data-slot="highlight"]').first(), root: '[data-slot="highlight"]' },
			{
				name: 'focus-highlight-copy',
				kind: 'focus',
				target: (p) => p.locator('[data-slot="highlight-copy"]').first(),
				root: '[data-slot="highlight"]'
			}
		],
		async reach(page, text) {
			await openDetail(page, text);
		}
	},
	'detail-new-removed': {
		name: 'detail-new-removed',
		description: "A book with new highlights, the one with a note and one removed from the Kobo",
		withLibrary: true,
		async reach(page, text) {
			await openDetail(page, text);
			await expect(page.getByTestId('book-details-view').locator('[data-slot="badge"]')).toHaveCount(2);
			await expect(page.locator('[data-slot="highlight-removed"]')).toHaveCount(1);
		}
	},
	'detail-delete': {
		name: 'detail-delete',
		description: 'A book whose highlights all left the Kobo, with the pointer on the trash can in the bar: «Apagar livro… ⌘⌫» (Ecrã 9, Figma 74:16535)',
		withLibrary: true,
		withoutNews: true,
		deletableBook: true,
		async reach(page, text) {
			await openDeletableDetail(page, text);
			const trash = bar(page).getByRole('button', { name: text.deleteBook, exact: true });
			// Before Export, in the same group
			const [trashBox, exportBox] = await Promise.all([trash.boundingBox(), bar(page).getByRole('button', { name: /^(Exportar|Export) 1 /i }).boundingBox()]);
			expect(trashBox!.width).toBe(32);
			expect(trashBox!.height).toBe(32);
			expect(exportBox!.x - (trashBox!.x + trashBox!.width)).toBe(4);
			await trash.hover();
			await tooltipOpen(page);
			const tooltip = page.locator('[data-slot="tooltip-content"]:not([data-state="closed"])');
			await expect(tooltip).toHaveText(text.deleteTooltip);
			// Figma: 134 × 24, 46 from the top of the window; the same ±1 the other tooltips' 47 gets (the half pixel is the text's width)
			const box = (await tooltip.boundingBox())!;
			expect(Math.abs(box.width - 134)).toBeLessThanOrEqual(1);
			expect(box.height).toBe(24);
			// To the half pixel, as the recorder rounds boxes: the opening scale is still settling
			expect(Math.abs(Math.round(box.y * 2) / 2 - 46)).toBeLessThanOrEqual(1);
		}
	},
	'detail-delete-confirm': {
		name: 'detail-delete-confirm',
		description: 'The trash can pressed: «Apagar este livro?» over the black at 15 %, 380 × 160 and centred, the focus on Cancelar (Ecrã 9, Figma 74:16868)',
		withLibrary: true,
		withoutNews: true,
		deletableBook: true,
		async reach(page, text) {
			await openDeletableDetail(page, text);
			await bar(page).getByRole('button', { name: text.deleteBook, exact: true }).dispatchEvent('click');
			const dialog = page.getByRole('alertdialog', { name: text.deleteTitle });
			await expect(dialog).toBeVisible();
			await expect(dialog).toContainText(text.deleteBody);
			// Q-E: no button takes the focus at entry, so no focus ring is drawn
			await expect(dialog).toBeFocused();
			await expect(dialog.getByRole('button', { name: text.deleteConfirm, exact: true })).toBeVisible();
			// 380 × 160, the Figma's Janela modal Apagar livro, without the 1 px borders the Figma draws inside the frame
			expect(await dialog.evaluate((el) => [(el as HTMLElement).offsetWidth, (el as HTMLElement).clientHeight])).toEqual([380, 160]);
		}
	},
	'settings-export': {
		name: 'settings-export',
		description: 'Settings on the Export pane: Ficheiros and the metadata, 540 × 377 (Figma 382)',
		withLibrary: true,
		window: 'settings',
		windowHeight: 377,
		focusStops: 3,
		states: [
			{ name: 'hover-tab', kind: 'hover', target: (p, t) => p.getByRole('tab', { name: t.tabAppearance, exact: true }) },
			{ name: 'hover-secondary-button', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.chooseFolder, exact: true }) },
			{ name: 'focus-secondary-button', kind: 'focus', target: (p, t) => p.getByRole('button', { name: t.chooseFolder, exact: true }) },
			{ name: 'hover-select', kind: 'hover', target: (p) => p.locator(`${PANE} [data-slot="select-trigger"]`) },
			{ name: 'focus-select', kind: 'focus', target: (p) => p.locator(`${PANE} [data-slot="select-trigger"]`) },
			{ name: 'hover-checkbox', kind: 'hover', target: (p) => p.locator(`${PANE} [role="checkbox"]`).first() },
			{ name: 'focus-checkbox', kind: 'focus', target: (p) => p.locator(`${PANE} [role="checkbox"]`).first() }
		],
		reach: openSettings
	},
	'settings-appearance': {
		name: 'settings-appearance',
		description: 'Settings on the Appearance pane: theme, accent colour and language, 540 × 285 (Figma 287)',
		withLibrary: true,
		window: 'settings',
		windowHeight: 285,
		states: [
			{ name: 'hover-select', kind: 'hover', target: (p) => p.locator(`${PANE} [data-slot="select-trigger"]`).first() },
			{ name: 'focus-select', kind: 'focus', target: (p) => p.locator(`${PANE} [data-slot="select-trigger"]`).first() },
			{ name: 'hover-swatch', kind: 'hover', target: (p) => p.locator(`${PANE} [role="radio"][aria-checked="false"]`).first() },
			{ name: 'focus-swatch', kind: 'focus', target: (p) => p.locator(`${PANE} [role="radio"][aria-checked="true"]`) }
		],
		async reach(page, text) {
			await openTab(page, text.tabAppearance);
		}
	},
	'settings-kobo': {
		name: 'settings-kobo',
		description: 'Settings on the Kobo pane with one Reader: its name and «Sincronizar ao ligar», 540 × 240 (Figma 243)',
		withLibrary: true,
		window: 'settings',
		windowHeight: 240,
		states: [
			{ name: 'focus-text-input', kind: 'focus', target: (p) => p.getByTestId('reader-name') },
			{ name: 'hover-switch', kind: 'hover', target: (p, t) => p.getByRole('switch', { name: t.syncOnConnect, exact: true }) },
			{ name: 'focus-switch', kind: 'focus', target: (p, t) => p.getByRole('switch', { name: t.syncOnConnect, exact: true }) }
		],
		async reach(page, text) {
			await openTab(page, text.tabKobo);
			await expect(page.getByTestId('reader-name')).toHaveValue(reader.name);
		}
	},
	'settings-kobo-readers': {
		name: 'settings-kobo-readers',
		description: 'Settings on the Kobo pane with two Readers (M2): «Leitor» and «Nome», then the switch for all, 540 × 315 (Figma 320)',
		withLibrary: true,
		otherReaderKobo: true,
		window: 'settings',
		windowHeight: 315,
		states: [
			{ name: 'hover-select', kind: 'hover', target: (p) => p.locator(`${PANE} [data-slot="select-trigger"]`) },
			{ name: 'focus-select', kind: 'focus', target: (p) => p.locator(`${PANE} [data-slot="select-trigger"]`) },
			{ name: 'focus-text-input', kind: 'focus', target: (p) => p.getByTestId('reader-name') }
		],
		async reach(page, text) {
			await openTab(page, text.tabKobo);
			await expect(page.getByRole('combobox', { name: text.readerLabel, exact: true })).toHaveText(reader.name);
			await expect(page.getByTestId('reader-name')).toHaveValue(reader.name);
		}
	},
	'settings-kobo-none': {
		name: 'settings-kobo-none',
		description: 'Settings on the Kobo pane with no Reader (the first start): only «Sincronizar ao ligar»',
		withLibrary: false,
		window: 'settings',
		windowHeight: 188,
		async reach(page, text) {
			await openTab(page, text.tabKobo);
			await expect(page.getByRole('switch', { name: text.syncOnConnect, exact: true })).toBeVisible();
			await expect(page.getByTestId('reader-name')).toHaveCount(0);
		}
	},
	'settings-updates': {
		name: 'settings-updates',
		description: 'Settings on the Updates pane (V2): no group heading, the automatic-check switch and «Versão» with «Procurar agora», 540 × 240 (Figma 243)',
		withLibrary: true,
		window: 'settings',
		windowHeight: 240,
		states: [
			{ name: 'hover-switch', kind: 'hover', target: (p, t) => p.getByRole('switch', { name: t.autoUpdates, exact: true }) },
			{ name: 'focus-switch', kind: 'focus', target: (p, t) => p.getByRole('switch', { name: t.autoUpdates, exact: true }) },
			{ name: 'hover-secondary-button', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.checkNow, exact: true }) },
			{ name: 'focus-secondary-button', kind: 'focus', target: (p, t) => p.getByRole('button', { name: t.checkNow, exact: true }) }
		],
		async reach(page, text) {
			await openTab(page, text.tabUpdates);
			await expect(page.getByRole('switch', { name: text.autoUpdates, exact: true })).toBeChecked();
			await expect(page.getByRole('button', { name: text.checkNow, exact: true })).toBeVisible();
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
			{ name: 'hover-link-button', kind: 'hover', target: (p, t) => p.getByRole('button', { name: t.skip, exact: true }) },
			{ name: 'focus-link-button', kind: 'focus', target: (p, t) => p.getByRole('button', { name: t.skip, exact: true }) },
			{ name: 'focus-scroll-region', kind: 'focus', target: (p) => p.getByTestId('release-notes') }
		],
		async reach(page, text) {
			await library(page, text);
			await expect(page.getByTestId('update-dialog')).toBeVisible();
			await expect(page.getByTestId('release-notes')).toBeVisible();
			// U3 (Figma 78:20401): 480 wide, the notes box 232 tall
			await expectWindowWidth(page, 480);
			await expect.poll(() => page.getByTestId('release-notes').evaluate((el) => (el as HTMLElement).offsetHeight)).toBe(232);
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
		description: 'A manual update check in progress (state 2): the bar slides a third of its length, and stands still in the middle with reduced motion',
		withLibrary: true,
		async reach(page, text, variant) {
			await library(page, text);
			await holdCheck(page);
			const dialog = page.getByTestId('update-dialog');
			await expect(dialog.getByRole('progressbar')).toBeVisible();
			await expect(dialog.getByRole('heading', { name: text.checkingTitle })).toBeVisible();
			await expectWindowWidth(page, 380);
			await expectAnimation(page, '[data-testid="update-dialog"] [role="progressbar"] > div', variant.reducedMotion !== 'reduce');
		}
	},
	'update-up-to-date': {
		name: 'update-up-to-date',
		description: 'A manual update check that finds nothing (state 3): «Khi está atualizado.» and OK',
		withLibrary: true,
		async reach(page, text) {
			await library(page, text);
			await askForCheck(page);
			const dialog = page.getByTestId('update-dialog');
			await expect(dialog.getByRole('heading', { name: text.upToDateTitle })).toBeVisible();
			await expect(dialog.getByRole('button', { name: text.ok, exact: true })).toBeVisible();
			await expectWindowWidth(page, 380);
		}
	},
	'update-downloading': {
		name: 'update-downloading',
		description: 'The download of the new version (state 4): the determinate bar and «4,3 MB de 6,9 MB»',
		withLibrary: true,
		update: true,
		async reach(page, text) {
			await library(page, text);
			await expect(page.getByTestId('update-dialog')).toBeVisible();
			await page.evaluate(() => window.__KHI_MOCK__.hold('plugin:updater|download'));
			await page.getByRole('button', { name: text.install, exact: true }).dispatchEvent('click');
			await page.waitForFunction(() => window.__KHI_MOCK__.held.includes('plugin:updater|download'));
			const dialog = page.getByTestId('update-dialog');
			await expect(dialog.getByRole('heading', { name: text.downloadingTitle })).toBeVisible();
			await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '62');
			await expect(dialog).toContainText(text.downloadingText);
			await expectWindowWidth(page, 380);
		}
	},
	'update-installed': {
		name: 'update-installed',
		description: 'The update installed while a Sync runs (state 5): Khi restarts when it ends; «Reiniciar agora» and OK',
		withLibrary: true,
		update: true,
		async reach(page, text) {
			await library(page, text);
			// Later, a Sync that stays running, and the update asked for again: the restart has to wait
			await page.getByRole('button', { name: text.later, exact: true }).dispatchEvent('click');
			await expect(page.getByTestId('update-dialog')).toHaveCount(0);
			await startSync(page, text);
			await askForCheck(page);
			await page.getByRole('button', { name: text.install, exact: true }).dispatchEvent('click');
			const dialog = page.getByTestId('update-dialog');
			await expect(dialog.getByRole('heading', { name: text.installedTitle })).toBeVisible();
			await expect(dialog.getByRole('button', { name: text.restartNow, exact: true })).toBeVisible();
			await expectWindowWidth(page, 380);
		}
	},
	'update-error': {
		name: 'update-error',
		description: 'A manual update check with no connection (state 6): Cancelar and «Tentar outra vez»',
		withLibrary: true,
		updateFailure: 'check',
		// Twice: the silent check on launch fails too (the mock refuses every check), and so does the one asked for
		expectedConsoleErrors: [{ prefix: 'Failed to check for updates:', times: 2 }],
		async reach(page, text) {
			await library(page, text);
			await askForCheck(page);
			const dialog = page.getByTestId('update-dialog');
			await expect(dialog.getByRole('heading', { name: text.errorTitle })).toBeVisible();
			await expect(dialog.getByRole('button', { name: text.tryAgain, exact: true })).toBeVisible();
			await expectWindowWidth(page, 380);
		}
	},
	'update-install-error': {
		name: 'update-install-error',
		description: 'The install of the new version fails (state 7): the text of the install, Cancelar and «Tentar outra vez»',
		withLibrary: true,
		update: true,
		updateFailure: 'install',
		expectedConsoleErrors: [{ prefix: 'Failed to install the update:', times: 1 }],
		async reach(page, text) {
			await library(page, text);
			await expect(page.getByTestId('update-dialog')).toBeVisible();
			await page.getByRole('button', { name: text.install, exact: true }).dispatchEvent('click');
			const dialog = page.getByTestId('update-dialog');
			await expect(dialog.getByRole('heading', { name: text.installErrorTitle })).toBeVisible();
			await expect(dialog.getByRole('button', { name: text.tryAgain, exact: true })).toBeVisible();
			await expectWindowWidth(page, 380);
		}
	},
	'export-done': {
		name: 'export-done',
		description: 'The header exported the books with news (0 to 2 s): the header stays with its Principal «✓ Exportado», the cards keep their «N novos» and the toast says «N livros exportados» with «Mostrar no Finder»',
		withLibrary: true,
		async reach(page, text) {
			await library(page, text);
			await holdTimers(page, 2000, 4000);
			await exportFromHeader(page, text);
			const header = page.locator('[data-slot="library-header"]');
			await expect(header.getByRole('button', { name: text.exportedLabel, exact: true })).toBeVisible();
			await expect(header).toHaveAttribute('data-state', 'novos');
			const toast = page.locator('[data-slot="toast"]');
			await expect(toast).toBeVisible();
			await expect(toast.getByRole('button', { name: text.showInFinder, exact: true })).toBeVisible();
			// The news are cleared meanwhile, but the cards keep their «N novos» until the header leaves
			await expect(page.locator('[data-slot="badge"]')).toHaveCount(2);
			await page.mouse.move(0, 0);
		}
	},
	'export-done-after': {
		name: 'export-done-after',
		description: 'After the 2 s: no header, the grid 24 px below the bar, the labels gone; the toast stays until 4 s',
		withLibrary: true,
		async reach(page, text) {
			await library(page, text);
			await holdTimers(page, 4000);
			await exportFromHeader(page, text);
			await expect(page.locator('[data-slot="library-header"]')).toHaveCount(0);
			await expect(page.locator('[data-slot="badge"]')).toHaveCount(0);
			const toast = page.locator('[data-slot="toast"]');
			await expect(toast).toBeVisible();
			await expect(toast.getByRole('button', { name: text.showInFinder, exact: true })).toBeVisible();
			await page.mouse.move(0, 0);
		}
	},
	'export-error': {
		name: 'export-error',
		description: 'The header\'s export fails because the folder cannot be written: the Erro header with «Escolher pasta…» as the Principal, the «N novos» labels stay',
		withLibrary: true,
		exportFailure: true,
		expectedConsoleErrors: [{ prefix: 'Export failed:', times: 1 }],
		async reach(page, text) {
			await library(page, text);
			await exportFromHeader(page, text);
			const header = page.locator('[data-slot="library-header"]');
			await expect(header).toHaveAttribute('data-state', 'erro');
			await expect(header.locator('[data-slot="library-header-message"]')).toHaveText(text.exportErrorTitle);
			await expect(header.locator('[data-slot="library-header-detail"]')).toHaveText(text.exportErrorDetail);
			await expect(header.getByRole('button', { name: text.chooseFolderAction, exact: true })).toBeVisible();
			// Nothing was exported, so the news are still there
			await expect(page.locator('[data-slot="badge"]')).toHaveCount(2);
			await expect(page.locator('[data-slot="toast"]')).toHaveCount(0);
			await page.mouse.move(0, 0);
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
	for (const scenario of ['grid', 'settings-export']) {
		for (const theme of ['light', 'dark-app'] as const) {
			add(scenario, { theme, language: 'pt', contrast: 'more' });
			add(scenario, { theme, language: 'pt', reducedMotion: 'reduce' });
		}
		add(scenario, { theme: 'light', language: 'en' });
	}
	// Every animated state, with and without reduced motion
	for (const scenario of ['library-syncing', 'library-empty-syncing', 'update-checking']) {
		for (const theme of ['light', 'dark-app'] as const) add(scenario, { theme, language: 'pt', reducedMotion: 'reduce' });
	}
	// The smallest window the app allows
	for (const scenario of ['grid', 'list', 'detail', 'settings-export', 'first-launch']) {
		for (const theme of ['light', 'dark-app'] as const) add(scenario, { theme, language: 'pt', size: 'min' });
	}
	return out;
}

export function mockConfigFor(scenario: Scenario, variant: Variant): MockConfig {
	const library = scenario.emptyLibrary ? [] : scenario.coverTitles ? booksCoverTitles : scenario.deletableBook ? booksDeletable : scenario.withoutNews ? booksWithoutNews : books;
	return {
		settings: makeSettings({ theme: THEMES[variant.theme].app, language: variant.language, viewMode: scenario.viewMode }),
		defaultSettings: defaultSettings(variant.language),
		defaultExportPath: `${HOME}/Documents/Kobo`,
		appVersion: APP_VERSION,
		readers: scenario.withLibrary ? (scenario.otherReaderKobo || scenario.unownedKobo || scenario.twoReaders ? [reader, otherReader] : [reader]) : [],
		lastReader: scenario.withLibrary ? reader.id : null,
		deviceAtStartup: null,
		koboOwners: scenario.withLibrary && !scenario.unownedKobo ? { [device.serialNumber!]: scenario.otherReaderKobo ? otherReader.id : reader.id } : {},
		library: scenario.withLibrary ? { [reader.id]: library, ...(scenario.twoReaders ? { [otherReader.id]: booksAna } : scenario.otherReaderKobo || scenario.unownedKobo ? { [otherReader.id]: [] } : {}) } : {},
		summary,
		newSinceByReader: scenario.twoReaders ? { [otherReader.id]: newSinceAna } : undefined,
		update: scenario.update ? availableUpdate : null,
		updateFailure: scenario.updateFailure,
		exportFailure: scenario.exportFailure ? { kind: 'folderNotWritable', folder: `${HOME}/Documents/Kobo` } : undefined,
		windowLabel: scenario.window ?? 'main'
	};
}
