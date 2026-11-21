/**
 * Judges the judge: deliberate changes that the comparator must catch, each
 * through the same capture and `compareWithBaseline` path as the real
 * captures. Runs with every `npm run test:visual`.
 */
import { test, expect } from '@playwright/test';
import { cpSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { capture } from './harness';
import type { CaptureOptions, CaptureResult } from './harness';
import { captures } from './scenarios';
import { BASELINE_DIR, OUTPUT_DIR, compareWithBaseline } from './baseline-store';
import type { AllowEntry, Diff } from './compare';

test.beforeEach(({}, testInfo) => {
	test.skip(testInfo.config.updateSnapshots === 'all', 'Needs a baseline to compare with');
});

async function captureOf(browser: Parameters<typeof capture>[0], id: string, options?: CaptureOptions): Promise<CaptureResult> {
	const item = captures().find((c) => c.id === id);
	if (!item) throw new Error(`no capture ${id}`);
	const result = await capture(browser, item, options);
	expect(result.problems).toEqual([]);
	return result;
}

const has = (diffs: Diff[], element: RegExp, property: string | RegExp) =>
	diffs.some((d) => element.test(d.element) && (typeof property === 'string' ? d.property === property : property.test(d.property)));

test('control: a 1px padding and a near-identical colour are detected', async ({ browser }) => {
	const result = await captureOf(browser, 'grid--light', {
		injectCss: [
			// One step off the card title's real colour, rgb(29, 29, 31): invisible to the eye, not to the judge
			'[data-slot="book-card-title"] { color: rgb(30, 29, 31) !important; }',
			'[data-testid="books-grid"] { padding-top: 1px !important; }'
		].join('\n')
	});
	const { blocked } = compareWithBaseline(result, { outputName: 'control--grid--light' });
	expect(has(blocked, /\[data-testid="book-card"\].* > div:2 > p\{"Ensaio sobre a Cegueira"\}$/, 'color'), 'colour change reported').toBe(true);
	expect(has(blocked, /\[data-testid="books-grid"\]/, 'padding-top'), 'padding change reported').toBe(true);
	// The padding moves every card down by 1px
	expect(has(blocked, /\[data-testid="book-card"\]/, 'box'), 'moved boxes reported').toBe(true);
	expect(has(blocked, /^screenshot grid--light\.png$/, 'pixels'), 'pixel difference reported').toBe(true);
});

test('control: a lost focus ring on the name field is detected', async ({ browser }) => {
	const result = await captureOf(browser, 'settings-kobo--light', {
		injectCss: '[data-testid="reader-name"]:focus-visible { outline: none !important; }'
	});
	const { blocked } = compareWithBaseline(result, { outputName: 'control--focus-ring' });
	expect(has(blocked, /^state focus-text-input: .*\[data-testid="reader-name"\]/, 'outline-style'), 'focused outline reported').toBe(true);
	expect(has(blocked, /^screenshot settings-kobo--light\.state-focus-text-input\.png$/, 'pixels'), 'state pixels reported').toBe(true);
	// Unfocused, the input is unchanged
	expect(has(blocked, /^html .*\[data-testid="reader-name"\]/, 'outline-style'), 'page record unaffected').toBe(false);
});

test('control: a copy button that stays hidden on hover is detected', async ({ browser }) => {
	const result = await captureOf(browser, 'detail--light', {
		injectCss: '[data-slot="highlight"]:hover [data-slot="highlight-copy"] { opacity: 0 !important; }'
	});
	const { blocked } = compareWithBaseline(result, { outputName: 'control--hover-copy' });
	expect(has(blocked, /^state hover-highlight: .*button\[aria-label=/, 'opacity'), 'hovered opacity reported').toBe(true);
	expect(has(blocked, /^screenshot detail--light\.state-hover-highlight\.png$/, 'pixels'), 'hover pixels reported').toBe(true);
});

test('control: a Sync icon that no longer turns while syncing is detected', async ({ browser }) => {
	const result = await captureOf(browser, 'library-syncing--light', {
		injectCss: '[data-slot="window-bar"] button svg { animation: none !important; }'
	});
	const { blocked } = compareWithBaseline(result, { outputName: 'control--no-spin' });
	expect(has(blocked, /Sincronizar com o Kobo.*svg/, 'animation-name'), 'animation-name reported').toBe(true);
});

test('control: Kobo lines that no longer fill with the progress are detected', async ({ browser }) => {
	// Every line in the filled colour, as if the count were 7: the 5 empty ones change
	const result = await captureOf(browser, 'library-empty-syncing--light', {
		injectCss: '.kobo-icon svg line { stroke: var(--highlight-line-new) !important; }'
	});
	const { blocked } = compareWithBaseline(result, { outputName: 'control--lines-filled' });
	expect(has(blocked, /svg > line/, 'stroke'), 'stroke reported').toBe(true);
	expect(has(blocked, /^screenshot library-empty-syncing--light\.png$/, 'pixels'), 'pixels reported').toBe(true);
});

test('control: missing baseline files and missing captures always fail', async ({ browser }) => {
	const result = await captureOf(browser, 'grid--light');
	const id = result.snapshot.id;
	const stored = JSON.parse(readFileSync(join(BASELINE_DIR, `${id}.json`), 'utf8')) as { shots: Record<string, string> };
	// An allowlist that tries to approve everything it can name
	const permissive: AllowEntry[] = Object.entries(stored.shots).map(([file, sha256]) => ({
		type: 'screenshot',
		capture: '*',
		file,
		sha256,
		reason: 'control: must not apply'
	}));

	// Sanity: unchanged, against the real baseline, nothing differs
	expect(compareWithBaseline(result, { outputName: 'control--clean' }).diffs).toEqual([]);

	const copy = join(OUTPUT_DIR, 'control-baseline');
	const reset = () => {
		rmSync(copy, { recursive: true, force: true });
		cpSync(BASELINE_DIR, copy, { recursive: true });
	};

	// A deleted baseline PNG
	reset();
	rmSync(join(copy, 'png', `${stored.shots[`${id}.png`]}.png`));
	let { blocked } = compareWithBaseline(result, { outputName: 'control--missing-png', baselineDir: copy, allowlist: permissive });
	expect(blocked.some((d) => d.kind === 'structure' && d.element === `screenshot ${id}.png`), 'missing baseline PNG reported').toBe(true);

	// A deleted baseline JSON
	reset();
	rmSync(join(copy, `${id}.json`));
	({ blocked } = compareWithBaseline(result, { outputName: 'control--missing-json', baselineDir: copy, allowlist: permissive }));
	expect(blocked.some((d) => d.kind === 'structure' && d.element === `${id}.json`), 'missing baseline JSON reported').toBe(true);
	expect(blocked.filter((d) => d.element.startsWith('screenshot ')).length, 'every screenshot without a baseline').toBe(1 + result.focusShots.length + result.stateShots.length);
	rmSync(copy, { recursive: true, force: true });

	// A state (and its screenshot) in the baseline but not captured
	const lost = result.snapshot.states.at(-1)!;
	const partial: CaptureResult = {
		...result,
		snapshot: { ...result.snapshot, states: result.snapshot.states.slice(0, -1) },
		stateShots: result.stateShots.slice(0, -1)
	};
	({ blocked } = compareWithBaseline(partial, { outputName: 'control--missing-state', allowlist: permissive }));
	expect(has(blocked, new RegExp(`^state ${lost.name}$`), '(state)'), 'missing state reported').toBe(true);
	expect(has(blocked, new RegExp(`^screenshot ${id}\\.state-${lost.name}\\.png$`), 'pixels'), 'missing state screenshot reported').toBe(true);
	expect(blocked.every((d) => d.kind === 'structure')).toBe(true);
});

test('control: an approved change approves nothing else', async ({ browser }) => {
	const approved = '[data-slot="book-card-title"] { color: rgb(220, 38, 38) !important; }';
	const a = await captureOf(browser, 'grid--light', { injectCss: approved });
	const first = compareWithBaseline(a, { outputName: 'control--approved', allowlist: [] });
	expect(first.blocked.some((d) => d.kind === 'pixels')).toBe(true);
	// Exactly what a reviewer would copy from the report
	const allowlist: AllowEntry[] = first.diffs.map((d): AllowEntry => {
		const reason = 'control: reviewed red card titles';
		if (d.kind === 'pixels') return { type: 'screenshot', capture: d.scenario, file: d.element.replace('screenshot ', ''), sha256: d.sha256!, reason };
		if (d.kind === 'box') return { type: 'box', capture: d.scenario, element: d.element, before: d.before, after: d.after, reason };
		if (d.kind === 'style') return { type: 'style', capture: d.scenario, element: d.element, property: d.property, before: d.before, after: d.after, reason };
		throw new Error(`unexpected ${d.kind} difference: ${JSON.stringify(d)}`);
	});
	expect(compareWithBaseline(a, { outputName: 'control--approved', allowlist }).blocked, 'the reviewed change alone passes').toEqual([]);

	// A style entry with a different `after` does not approve the change
	const style = allowlist.findIndex((e) => e.type === 'style' && e.property === 'color');
	expect(style).toBeGreaterThanOrEqual(0);
	const wrongAfter = allowlist.map((e, i) => (i === style ? { ...e, after: 'rgb(0, 0, 0)' } : e));
	const wrong = compareWithBaseline(a, { outputName: 'control--wrong-after', allowlist: wrongAfter }).blocked;
	expect(wrong.map((d) => d.property)).toEqual(['color']);

	// The same approval with an unrelated change on top: the pixels are no longer the reviewed ones
	const b = await captureOf(browser, 'grid--light', {
		injectCss: `${approved}\n[data-testid="books-grid"] { padding-top: 1px !important; }`
	});
	const both = compareWithBaseline(b, { outputName: 'control--approved-plus-unrelated', allowlist }).blocked;
	expect(has(both, /^screenshot grid--light\.png$/, 'pixels'), 'unrelated pixel change still reported').toBe(true);
	expect(has(both, /\[data-testid="books-grid"\]/, 'padding-top'), 'unrelated style change still reported').toBe(true);
	expect(existsSync(join(OUTPUT_DIR, 'diff', 'control--approved-plus-unrelated.png'))).toBe(true);
});

test('control: a hidden selected-book indicator is detected', async ({ browser }) => {
	const result = await captureOf(browser, 'grid-selected--light', {
		injectCss: '[data-testid="book-card"] [data-slot="selection-frame"], [data-testid="book-card"] [data-slot="selection-box"][data-state="checked"] { opacity: 0 !important; }'
	});
	const { blocked } = compareWithBaseline(result, { outputName: 'control--selected-hidden' });
	expect(has(blocked, /\[data-testid="book-card"\].*\bspan\b/, 'opacity'), 'indicator opacity reported').toBe(true);
	expect(has(blocked, /^screenshot grid-selected--light\.png$/, 'pixels'), 'pixels reported').toBe(true);
});

test('control: a hidden automatic-update switch is detected', async ({ browser }) => {
	const result = await captureOf(browser, 'settings-updates--light', {
		injectCss: '[data-testid="check-for-updates"] { visibility: hidden !important; }'
	});
	const { blocked } = compareWithBaseline(result, { outputName: 'control--switch-hidden' });
	expect(has(blocked, /^html .*\[data-testid="check-for-updates"\]/, 'visibility'), 'visibility reported').toBe(true);
	// Hidden, it can no longer be focused: the state is missing, which nothing can allow
	expect(blocked.some((d) => d.kind === 'structure' && d.element === 'state focus-switch'), 'missing focus state reported').toBe(true);
	expect(has(blocked, /^state hover-switch-row: .*\[data-testid="check-for-updates"\]/, 'visibility'), 'hover state reported').toBe(true);
	expect(has(blocked, /^screenshot settings-updates--light\.png$/, 'pixels'), 'pixels reported').toBe(true);
});

test('control: a changed keyframe midpoint is detected', async ({ browser }) => {
	// Same name, same first and last frames: only the middle of the turn differs
	const result = await captureOf(browser, 'library-syncing--light', {
		injectCss: '@keyframes spin { 50% { transform: rotate(10deg); } to { transform: rotate(360deg); } }'
	});
	const { blocked } = compareWithBaseline(result, { outputName: 'control--keyframes' });
	expect(has(blocked, /^animation .* @spin 50%$/, 'transform'), 'midpoint transform reported').toBe(true);
	expect(has(blocked, /^animation .* @spin 25%$/, 'transform'), 'quarter transform reported').toBe(true);
	expect(blocked.every((d) => d.element.startsWith('animation ')), 'nothing else (first frame unchanged)').toBe(true);
});

test('control: a layout change that only shows at the minimum window size is detected', async ({ browser }) => {
	const narrowOnly = '@media (max-width: 899px) { [data-testid="books-grid"] { column-gap: 12px !important; } }';
	const min = await captureOf(browser, 'grid--light--min', { injectCss: narrowOnly });
	const atMin = compareWithBaseline(min, { outputName: 'control--min-size' }).blocked;
	expect(has(atMin, /\[data-testid="books-grid"\]/, 'column-gap'), 'gap reported at the minimum size').toBe(true);
	expect(has(atMin, /\[data-testid="book-card"\]/, 'box'), 'moved cards reported').toBe(true);
	// The default window never sees it: without the minimum-size captures it would pass
	const wide = await captureOf(browser, 'grid--light', { injectCss: narrowOnly });
	expect(compareWithBaseline(wide, { outputName: 'control--min-size-at-default' }).diffs).toEqual([]);
});
