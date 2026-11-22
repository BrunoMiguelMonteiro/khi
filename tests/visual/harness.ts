/**
 * Opens the production build with the mocked Tauri runtime, brings it to a
 * Capture's state and records it: computed styles, boxes, keyboard focus
 * states and screenshots.
 */
import type { Browser, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { installTauriMock } from './mock-ipc';
import type { IpcCall } from './mock-ipc';
import { recordDom } from './recorder';
import type { DomRecord, FocusRecord, RecordedElement } from './recorder';
import { THEMES, mockConfigFor, stringsFor } from './scenarios';
import type { Capture, StateProbe, Strings } from './scenarios';

/** Where `serve.ts` serves the production build. */
export const PORT = 4791;
export const BASE_URL = `http://127.0.0.1:${PORT}`;
/** The main window: tauri.conf.json's 1000 × 700. With `titleBarStyle: Overlay` the webview has no title bar above it. */
export const VIEWPORT = { width: 1000, height: 700 };
/**
 * The window at tauri.conf.json's `minWidth` × `minHeight`: the webview fills
 * it (Overlay), so there is no title bar to take off.
 */
export const MIN_VIEWPORT = minViewport();

function minViewport() {
	const conf = JSON.parse(readFileSync(new URL('../../src-tauri/tauri.conf.json', import.meta.url), 'utf8'));
	const window = conf.app.windows[0];
	return { width: window.minWidth as number, height: (window.minHeight as number) - (window.height - VIEWPORT.height) };
}
/**
 * The Settings window: 540 wide (`settings_window_spec` in src-tauri/src/window.rs), as tall as the
 * pane on show. The page measures the pane and sets the size (`setSize`), so each scenario names the
 * height of its pane and `capture` checks that the page asked for exactly that. The window is not
 * resizable, so `--min` captures of it use the same size.
 */
export const SETTINGS_WIDTH = 540;
/** Every capture happens at this instant: dates and «last checked» labels never move. */
export const NOW = new Date('2026-11-15T10:00:00Z');

/** A hover or focus state (`StateProbe`): its root and descendants, styles stored like `dom.elements`. */
export interface StateRecord {
	name: string;
	kind: StateProbe['kind'];
	/** Key of the hovered or focused element. */
	target: string;
	elements: RecordedElement[];
}

export interface Snapshot {
	id: string;
	dom: DomRecord;
	focus: FocusRecord[];
	states: StateRecord[];
	/** Each infinite animation's target at 25%, 50% and 75% of its cycle (full styles). */
	phases: FocusRecord[];
}

export interface CaptureResult {
	snapshot: Snapshot;
	screenshot: Buffer;
	focusShots: Buffer[];
	/** One clip per state, in `snapshot.states` order. */
	stateShots: Buffer[];
	/** States that could not be brought about (left out of `snapshot.states`, so the comparison reports them missing). */
	unreachable: string[];
	calls: IpcCall[];
	/** Unknown IPC calls, page errors and `console.error`s: each one fails the test. */
	problems: string[];
}

export interface CaptureOptions {
	/** Extra CSS added before recording: the control test's deliberate change. */
	injectCss?: string;
}

/** How long one image may take to load (or fail) before the capture fails. */
const IMAGE_TIMEOUT_MS = 5000;

/** Waits for fonts, images and finite animations (including CSS transitions). */
async function settle(page: Page) {
	await page.evaluate(async (imageTimeout) => {
		await document.fonts.ready;
		// Images fire `load` or `error` (never `loadend`); `complete` is checked
		// again after listening, in case it finished in between
		await Promise.all(
			Array.from(document.images).map((img) =>
				img.complete
					? null
					: new Promise<void>((resolve, reject) => {
							const timer = setTimeout(
								() => reject(new Error(`image not loaded after ${imageTimeout} ms: ${img.currentSrc || img.src}`)),
								imageTimeout
							);
							const done = () => {
								clearTimeout(timer);
								resolve();
							};
							img.addEventListener('load', done, { once: true });
							img.addEventListener('error', done, { once: true });
							if (img.complete) done();
						})
			)
		);
		for (let round = 0; round < 5; round++) {
			const running = document
				.getAnimations()
				.filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().iterations !== Infinity);
			if (!running.length) break;
			await Promise.all(running.map((a) => a.finished.catch(() => null)));
		}
		// Scrolling (smooth or not) has settled once no scroll position moves for 5 frames
		const positions = () =>
			[document.scrollingElement, ...document.querySelectorAll('*')]
				.filter((el): el is Element => !!el && (el.scrollTop !== 0 || el.scrollLeft !== 0))
				.map((el) => `${el.scrollTop},${el.scrollLeft}`)
				.join(';');
		const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
		let last = positions();
		for (let still = 0, frames = 0; still < 5 && frames < 300; frames++) {
			await frame();
			const now = positions();
			still = now === last ? still + 1 : 0;
			last = now;
		}
		await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
	}, IMAGE_TIMEOUT_MS);
}

type Box = [number, number, number, number];

/** A screenshot of `box` with an 8px margin, inside the viewport. */
async function clipShot(page: Page, [x, y, w, h]: Box): Promise<Buffer> {
	const pad = 8;
	const left = Math.max(0, x - pad);
	const top = Math.max(0, y - pad);
	const viewport = page.viewportSize()!;
	const clip = {
		x: left,
		y: top,
		width: Math.min(viewport.width, x + w + pad) - left,
		height: Math.min(viewport.height, y + h + pad) - top
	};
	if (clip.width <= 0 || clip.height <= 0) throw new Error(`nothing of box ${[x, y, w, h]} is in the viewport`);
	return page.screenshot({ clip, animations: 'disabled', caret: 'hide', scale: 'device' });
}

/** Stores full style records like `dom.elements`: only what differs from the page's `common`. */
function compactRecords(common: Record<string, string>, records: FocusRecord[]): RecordedElement[] {
	return records.map((r) => {
		const s: Record<string, string> = {};
		for (const [prop, value] of Object.entries(r.s)) if (value !== common[prop]) s[prop] = value;
		const out: RecordedElement = { k: r.k, b: r.b, s };
		if (r.p) out.p = r.p;
		return out;
	});
}

/**
 * Puts every scroll position where revealing `el` from the top leaves it, in
 * whole pixels. Focus scrolls the focused element into view, but where depends
 * on the path the keyboard took and on fractional layout: WebKit landed the
 * settings panel at 140 or 141px for the same focus. Starting again from 0 and
 * writing back each position as an integer makes it the same every run.
 */
async function revealDeterministically(page: Page, target: Locator) {
	await target.evaluate((el) => {
		const all = () => [document.scrollingElement, ...document.querySelectorAll('*')].filter((e): e is Element => !!e);
		for (const e of all()) if (e.scrollTop || e.scrollLeft) e.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
		for (const e of all()) {
			if (!e.scrollTop && !e.scrollLeft) continue;
			e.scrollTo({ top: Math.round(e.scrollTop), left: Math.round(e.scrollLeft), behavior: 'instant' });
		}
	});
	await settle(page);
}

/** A state whose target the keyboard cannot reach: reported as a missing state, not a crash. */
class StateUnreachable extends Error {}

/** Presses Alt+Tab (Tab that also stops on buttons, as in Safari) until `target` has focus. */
async function focusWithKeyboard(page: Page, target: Locator, name: string) {
	for (let press = 0; press < 80; press++) {
		await page.keyboard.press('Alt+Tab');
		if (await target.evaluate((el) => el === document.activeElement)) {
			const visible = await target.evaluate((el) => el.matches(':focus-visible'));
			if (!visible) throw new Error(`state ${name}: the target has focus but not :focus-visible`);
			return;
		}
	}
	throw new StateUnreachable(`state ${name}: the keyboard never reached the target`);
}

/** Brings one probe's target into its state and records it. */
async function recordState(page: Page, probe: StateProbe, text: Strings, common: Record<string, string>) {
	// Each state starts from no hover and no focus
	// … and from the same scroll positions, whatever the previous state scrolled into view
	await page.mouse.move(1, 1);
	await page.evaluate(() => {
		(document.activeElement as HTMLElement | null)?.blur?.();
		for (const el of [document.scrollingElement, ...document.querySelectorAll('*')]) {
			if (el && (el.scrollTop || el.scrollLeft)) el.scrollTo({ top: 0, left: 0, behavior: 'instant' });
		}
	});
	await settle(page);

	const target = probe.target(page, text).first();
	await expect(target, `state ${probe.name}: target`).toBeAttached();
	if (probe.kind === 'hover') {
		// Scrolled into view first, so the hover itself has nothing to scroll
		await revealDeterministically(page, target);
		await target.hover();
		await expect.poll(() => target.evaluate((el) => el.matches(':hover')), `state ${probe.name}: :hover`).toBe(true);
	} else {
		await focusWithKeyboard(page, target, probe.name);
		await revealDeterministically(page, target);
	}
	await probe.ready?.(page);
	await settle(page);

	const root = await target.evaluateHandle((el, selector) => (selector ? el.closest(selector) : el) ?? el, probe.root ?? null);
	const handle = await target.elementHandle();
	// Element handles inside the argument arrive as the elements themselves
	const options = { mode: 'subtree', root, target: handle } as unknown as Parameters<typeof recordDom>[0];
	const evaluate = page.evaluate.bind(page) as (fn: typeof recordDom, arg: typeof options) => Promise<ReturnType<typeof recordDom>>;
	const { subtree, targetKey } = await evaluate(recordDom, options);
	await root.dispose();
	await handle?.dispose();
	const record: StateRecord = {
		name: probe.name,
		kind: probe.kind,
		target: targetKey!,
		elements: compactRecords(common, subtree!)
	};
	return { record, shot: await clipShot(page, subtree![0].b) };
}

/** Waits until the app stops talking to the backend: the native menu is built (by the main window only) and nothing is pending. */
async function waitForIpcQuiet(page: Page, withMenu: boolean) {
	await page.waitForFunction(
		(menu) => {
			const mock = window.__KHI_MOCK__;
			return (
				(!menu || mock.calls.some((c) => c.cmd === 'plugin:menu|set_as_app_menu')) &&
				mock.pending === 0 &&
				performance.now() - mock.lastCallAt > 700
			);
		},
		withMenu,
		{ polling: 100 }
	);
}

/**
 * What the page asked of the Settings window: the height of its pane (the Figma's, since the viewport is
 * that high), and the window shown only after it was sized.
 */
function settingsWindowProblems(calls: { cmd: string; args: unknown }[], expected: number): string[] {
	const sizes = calls.filter((c) => c.cmd === 'plugin:window|set_size');
	const height = (call: { args: unknown }) => {
		const value = (call.args as { value: { Logical?: { height: number; width: number } } }).value.Logical;
		return value ? [value.width, value.height] : null;
	};
	const problems: string[] = [];
	const last = sizes.at(-1);
	if (!last) return ['the Settings page never sized its window'];
	const [width, measured] = height(last) ?? [0, 0];
	if (width !== SETTINGS_WIDTH) problems.push(`the window was sized ${width} wide, not ${SETTINGS_WIDTH}`);
	if (measured !== expected) problems.push(`the pane measures ${measured}, the scenario's window is ${expected}`);
	const firstShow = calls.findIndex((c) => c.cmd === 'plugin:window|show');
	const firstSize = calls.findIndex((c) => c.cmd === 'plugin:window|set_size');
	if (firstShow === -1) problems.push('the Settings page never showed its window');
	else if (firstSize === -1 || firstSize > firstShow) problems.push('the window was shown before it was sized');
	return problems;
}

export async function capture(browser: Browser, { id, scenario, variant }: Capture, options: CaptureOptions = {}): Promise<CaptureResult> {
	const theme = THEMES[variant.theme];
	const inSettings = scenario.window === 'settings';
	const context = await browser.newContext({
		viewport: inSettings ? { width: SETTINGS_WIDTH, height: scenario.windowHeight || 400 } : variant.size === 'min' ? MIN_VIEWPORT : VIEWPORT,
		deviceScaleFactor: 2,
		locale: variant.language === 'pt' ? 'pt-PT' : 'en-US',
		timezoneId: 'Europe/Lisbon',
		colorScheme: theme.os,
		contrast: variant.contrast ?? 'no-preference',
		reducedMotion: variant.reducedMotion ?? 'no-preference',
		serviceWorkers: 'block'
	});
	// Only the local build: any other request is a bug in the harness
	await context.route((url) => url.origin !== BASE_URL, (route) => route.abort());
	const page = await context.newPage();
	const problems: string[] = [];
	const expectedSeen = new Map<string, number>();
	page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() !== 'error') return;
		// The app logs a failure it shows: the scenario names it, and it has to happen
		const expected = scenario.expectedConsoleErrors?.find((entry) => message.text().startsWith(entry.prefix));
		if (expected) expectedSeen.set(expected.prefix, (expectedSeen.get(expected.prefix) ?? 0) + 1);
		else problems.push(`console.error: ${message.text()}`);
	});

	try {
		await page.clock.setFixedTime(NOW);
		await page.addInitScript(installTauriMock, mockConfigFor(scenario, variant));
		await page.goto(`${BASE_URL}${inSettings ? '/definicoes' : '/'}`);

		// Settings are applied once `app-ready` is emitted (even if they failed:
		// then the expected theme and texts below catch it). The Settings window
		// never emits it: there, the settings have been read.
		if (inSettings) await page.waitForFunction(() => window.__KHI_MOCK__.calls.some((c) => c.cmd === 'load_settings'));
		else await page.waitForFunction(() => window.__KHI_MOCK__.emitted.includes('app-ready'));
		const text = stringsFor(variant.language);
		await scenario.reach(page, text, variant);
		await waitForIpcQuiet(page, !inSettings);
		const html = page.locator('html');
		await expect(html).toHaveClass(new RegExp(`(^|\\s)${theme.htmlClass}(\\s|$)`));
		await expect(html).not.toHaveClass(new RegExp(`(^|\\s)${theme.htmlClass === 'dark' ? 'light' : 'dark'}(\\s|$)`));
		if (options.injectCss) await page.addStyleTag({ content: options.injectCss });
		await settle(page);

		// Computed styles first, with transitions and animations as the app has them
		const { dom } = await page.evaluate(recordDom, { mode: 'page' as const });
		// Then the pixels, with motion and the caret frozen
		const screenshot = await page.screenshot({ animations: 'disabled', caret: 'hide', scale: 'device' });

		const focus: FocusRecord[] = [];
		const focusShots: Buffer[] = [];
		for (let stop = 0; stop < (scenario.focusStops ?? 0); stop++) {
			// WebKit on macOS skips buttons on Tab unless Option is held (as in Safari)
			await page.keyboard.press('Alt+Tab');
			await settle(page);
			const focused = page.locator(':focus');
			if (await focused.count()) await revealDeterministically(page, focused.first());
			const { focus: record } = await page.evaluate(recordDom, { mode: 'focus' as const });
			if (!record) break;
			focus.push(record);
			focusShots.push(await clipShot(page, record.b));
		}

		const states: StateRecord[] = [];
		const stateShots: Buffer[] = [];
		const unreachable: string[] = [];
		for (const probe of scenario.states ?? []) {
			let recorded: Awaited<ReturnType<typeof recordState>>;
			try {
				recorded = await recordState(page, probe, text, dom!.common);
			} catch (error) {
				if (!(error instanceof StateUnreachable)) throw error;
				unreachable.push(error.message);
				continue;
			}
			const { record, shot } = recorded;
			states.push(record);
			stateShots.push(shot);
		}

		const { phases } = await page.evaluate(recordDom, { mode: 'phases' as const });

		const mock = await page.evaluate(() => ({ calls: window.__KHI_MOCK__.calls, unknown: window.__KHI_MOCK__.unknown }));
		if (inSettings) problems.push(...settingsWindowProblems(mock.calls, scenario.windowHeight ?? 0));
		// Exactly as many times as named: one fewer is a failure that was not shown, one more is a retry or a loop
		for (const { prefix, times } of scenario.expectedConsoleErrors ?? []) {
			const seen = expectedSeen.get(prefix) ?? 0;
			if (seen !== times) problems.push(`console.error «${prefix}» logged ${seen} time(s), expected ${times}`);
		}
		for (const call of mock.unknown) problems.push(`unknown IPC call: ${call.cmd} ${JSON.stringify(call.args)}`);
		return { snapshot: { id, dom: dom!, focus, states, phases: phases! }, screenshot, focusShots, stateShots, unreachable, calls: mock.calls, problems };
	} finally {
		await context.close();
	}
}
