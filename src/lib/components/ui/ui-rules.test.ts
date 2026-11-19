import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Scanner } from '@tailwindcss/oxide';
import { compileAppCss, selectorFor } from '$lib/test/css';

const root = process.cwd();
const uiDir = resolve(root, 'src/lib/components/ui');
const variantsCss = readFileSync(resolve(root, 'src/lib/styles/shadcn-variants.css'), 'utf8');
const componentsCss = readFileSync(resolve(root, 'src/lib/styles/components.css'), 'utf8');
const tokensCss = readFileSync(resolve(root, 'src/lib/styles/tokens.css'), 'utf8');

type Source = { file: string; text: string };

// Named only here; test_files_are_not_scanned proves it does not reach the CSS.
const TEST_ONLY_CLASS = 'mt-[3.217px]';

/** Every .svelte and .ts under ui/ that is not a test. Empty until the first component (Task 7). */
function uiSources(): Source[] {
	if (!existsSync(uiDir)) return [];
	return readdirSync(uiDir, { recursive: true, encoding: 'utf8' })
		.filter((f) => /\.(svelte|ts)$/.test(f) && !/\.(test|spec)\.ts$/.test(f))
		.map((f) => ({ file: relative(root, join(uiDir, f)), text: readFileSync(join(uiDir, f), 'utf8') }));
}

const stripComments = (s: string) =>
	s.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// --- The rules: each returns the offending snippets, so the self-tests below can prove them. ---

// Colour literals: `[#`, 3/4/6/8-digit hex and the CSS colour functions. `color-mix(` is not one:
// mixing tokens (`var(--primary)`, `transparent`) is allowed, and a literal inside it is caught here.
// Named colours (`bg-[red]`) are not checked.
const COLOR_LITERAL =
	/\[#|#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])|(?<![\w-])(?:rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(/gi;

function colorLiterals(text: string): string[] {
	return [...stripComments(text).matchAll(COLOR_LITERAL)].map((m) => m[0]);
}

// There is no --duration-* theme namespace, so a bare `duration-hover` emits no CSS: the token
// is used as `duration-(--duration-hover)`.
const durationTokens = [...new Set([...tokensCss.matchAll(/--duration-([\w-]+)\s*:/g)].map((m) => m[1]))];

function bareDurations(text: string, tokens = durationTokens): string[] {
	const names = tokens.join('|');
	return [...stripComments(text).matchAll(new RegExp(`(?<![\\w-])duration-(?:${names})(?![\\w-])`, 'g'))].map((m) => m[0]);
}

function lucideImports(text: string): string[] {
	return [...text.matchAll(/['"]@lucide\/svelte[^'"]*['"]/g)].map((m) => m[0]);
}

// Tailwind 4 presence variants (`&[data-x]`) that Bits UI sets as bare attributes. Add one here
// only after checking that Bits UI sets it without a value; otherwise copy a shadcn variant.
const PRESENCE_VARIANTS = ['data-highlighted', 'data-selected'];
const declaredVariants = [...variantsCss.matchAll(/@custom-variant\s+(data-[\w-]+)/g)].map((m) => m[1]);

function dataVariantsUsed(text: string): string[] {
	// `data-x:` alone or after `not-`, `group-`, `peer-`, `has-`, `in-`; arbitrary `data-[…]:` is fine.
	return [...new Set([...text.matchAll(/(?<![\w])(data-[a-z][a-z0-9-]*):/g)].map((m) => m[1]))];
}

function undeclaredVariants(text: string, declared = declaredVariants): string[] {
	return dataVariantsUsed(text).filter((v) => !declared.includes(v) && !PRESENCE_VARIANTS.includes(v));
}

const COLOR_UTILITY =
	'(?:bg|text|border(?:-[trblxyse])?|ring|inset-ring|outline|fill|stroke|shadow|inset-shadow|divide|from|via|to|decoration|accent|caret|placeholder)';

function interpolatedClasses(text: string): string[] {
	// `${` in a template literal, and Svelte's `{…}` inside a class attribute, are both a class
	// built from text, which Tailwind cannot find. The colour utility starts the class or follows a
	// variant's `:` (`[&>svg]:fill-…`), and the `{` may come after `/`, `[`, `(` (`bg-primary/${o}`).
	const re = new RegExp(`(?<=^|[\\s'"\`:!])${COLOR_UTILITY}-[^\\s'"\`{}]*\\$?\\{`, 'g');
	return [...stripComments(text).matchAll(re)].map((m) => m[0]);
}

/**
 * The `motion-reduce:` utilities that neutralise a moving utility, or null when it does not move.
 * A plain transform (`rotate-45` on an arrow, `-translate-x-1/2` to centre) is fixed; it moves
 * only when a variant or a `class:` directive switches it, so `conditional` says which.
 */
function resets(utility: string, conditional: boolean): RegExp | null {
	const u = utility.replace(/^-/, '');
	const enterExit = (re: string) => new RegExp(`^(?:animate-none|${re})$`);
	let m: RegExpMatchArray | null;
	if ((m = u.match(/^animate-(.+)$/))) return ['in', 'out', 'none'].includes(m[1]) ? null : /^animate-none$/;
	if ((m = u.match(/^slide-(in-from|out-to)-(top|bottom|left|right|start|end)\b/)))
		return /-0$/.test(u) ? null : enterExit(`slide-${m[1]}-${m[2]}-0`);
	if ((m = u.match(/^zoom-(in|out)\b/))) return /-100$/.test(u) ? null : enterExit(`zoom-${m[1]}-100`);
	if ((m = u.match(/^spin-(in|out)\b/))) return /-0$/.test(u) ? null : enterExit(`spin-${m[1]}-0`);
	if (!conditional) return null;
	if ((m = u.match(/^translate-(?:([xyz])-)?/)))
		return /^translate-(?:none|(?:[xyz]-)?0)$/.test(u)
			? null
			: new RegExp(`^translate-(?:none|0${m[1] ? `|${m[1]}-0` : ''})$`);
	if ((m = u.match(/^scale-(?:([xyz])-)?/)))
		return /^scale-(?:none|(?:[xyz]-)?100)$/.test(u)
			? null
			: new RegExp(`^scale-(?:none|100${m[1] ? `|${m[1]}-100` : ''})$`);
	if ((m = u.match(/^rotate-(?:([xyz])-)?/)))
		return /^rotate-(?:none|(?:[xyz]-)?0)$/.test(u)
			? null
			: new RegExp(`^rotate-(?:none|0${m[1] ? `|${m[1]}-0` : ''})$`);
	return null;
}

/** Splits `a:[&>svg]:b:util` on the top-level `:`, so a `:` inside brackets stays put. */
function splitVariants(cls: string): { variants: string[]; utility: string } {
	const parts: string[] = [];
	let depth = 0;
	let cur = '';
	for (const ch of cls) {
		if (ch === '[' || ch === '(') depth++;
		if (ch === ']' || ch === ')') depth--;
		if (ch === ':' && depth === 0) {
			parts.push(cur);
			cur = '';
		} else cur += ch;
	}
	return { variants: parts, utility: cur.replace(/^!|!$/g, '') };
}

type Element = { classes: string[]; directives: string[] };

/** The `{…}` starting at `open`, with nested braces; returns the index after the closing `}`. */
function braceEnd(text: string, open: number): number {
	let depth = 0;
	for (let j = open; j < text.length; j++) {
		const ch = text[j];
		if (ch === '"' || ch === "'" || ch === '`') {
			const close = text.indexOf(ch, j + 1);
			if (close > -1 && depth > 0) j = close;
			continue;
		}
		if (ch === '{') depth++;
		else if (ch === '}' && --depth === 0) return j + 1;
	}
	return text.length;
}

const literals = (s: string) => [...s.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2]);
const words = (s: string) => s.split(/[\s'"`,(){}]+/).filter(Boolean);

/**
 * Each element's classes: in .svelte markup, a start tag's `class=` value plus its `class:name`
 * directives; in scripts and .ts, each string literal (a tailwind-variants slot, a cn() argument).
 */
function elements(file: string, text: string): Element[] {
	const src = stripComments(text);
	if (!file.endsWith('.svelte')) return literals(src).map((l) => ({ classes: words(l), directives: [] }));
	const scripts = [...src.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
	const markup = src.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '').replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');
	const out: Element[] = scripts.flatMap(literals).map((l) => ({ classes: words(l), directives: [] }));
	for (const tag of markup.matchAll(/<([A-Za-z][\w.:-]*)/g)) {
		const el: Element = { classes: [], directives: [] };
		let i = tag.index! + tag[0].length;
		while (i < markup.length && markup[i] !== '>') {
			const rest = markup.slice(i);
			const attr = !/\s/.test(markup[i])
				? null
				: rest.match(/^\s*(class(?::([^\s=/>]+))?)\s*=\s*/) ?? rest.match(/^\s*class:([^\s=/>]+)/);
			if (attr && attr[0].trimStart().startsWith('class:') && !attr[0].includes('=')) {
				el.directives.push(attr[1]);
				i += attr[0].length;
				continue;
			}
			if (attr) {
				i += attr[0].length;
				let value: string;
				if (markup[i] === '{') {
					const end = braceEnd(markup, i);
					value = markup.slice(i + 1, end - 1);
					i = end;
				} else if (markup[i] === '"' || markup[i] === "'") {
					const end = markup.indexOf(markup[i], i + 1);
					value = markup.slice(i + 1, end);
					i = end + 1;
				} else {
					value = rest.slice(attr[0].length).match(/^[^\s>]*/)![0];
					i += value.length;
				}
				if (attr[2]) el.directives.push(attr[2]);
				else el.classes.push(...words(value));
				continue;
			}
			if (markup[i] === '{') i = braceEnd(markup, i);
			else if (markup[i] === '"' || markup[i] === "'") i = markup.indexOf(markup[i], i + 1) + 1 || markup.length;
			else i++;
		}
		if (el.classes.length || el.directives.length) out.push(el);
	}
	return out;
}

/**
 * Movement 6: each moving class needs, on the same element, a `motion-reduce:` class that resets the
 * same property with the same state variants (`hover:scale-105` → `motion-reduce:hover:scale-100`);
 * without them the state's rule is as specific or more and comes later, so it wins.
 */
function motionWithoutReducedPair(file: string, text: string): string[] {
	const offenders: string[] = [];
	for (const { classes, directives } of elements(file, text)) {
		const all = [...classes.map((c) => ({ c, directive: false })), ...directives.map((c) => ({ c, directive: true }))];
		const parsed = all.map(({ c, directive }) => ({ c, directive, ...splitVariants(c) }));
		for (const { c, directive, variants, utility } of parsed) {
			if (variants.includes('motion-reduce') || variants.includes('motion-safe')) continue;
			const reset = resets(utility, directive || variants.length > 0);
			if (!reset) continue;
			const paired = parsed.some(
				(r) =>
					r.variants.includes('motion-reduce') &&
					reset.test(r.utility) &&
					variants.every((v) => r.variants.includes(v))
			);
			if (!paired) offenders.push(c);
		}
	}
	return offenders;
}

const FOCUS_RING_WORDS = new Set(['outline', 'outline-offset', 'solid', 'color-mix', 'in', 'srgb', 'calc', 'transparent']);

function focusRingLiterals(css: string): string[] {
	const body = stripComments(css).match(/@utility\s+focus-ring\s*\{([^}]*)\}/)?.[1];
	if (body === undefined) return ['@utility focus-ring missing'];
	const missing = ['--stroke-ring', '--ring', '--ring-opacity'].filter(
		(v) => !new RegExp(`var\\(${v}\\)`).test(body)
	);
	const rest = body.replace(/var\(--[\w-]+\)/g, ' ');
	const words = [...rest.matchAll(/(?<![\w.])[a-z#][\w#-]*/gi)].map((m) => m[0]).filter((w) => !FOCUS_RING_WORDS.has(w));
	const numbers = [...rest.matchAll(/\d[\d.]*[a-z%]*/gi)].map((m) => m[0]).filter((n) => n !== '0' && n !== '100%');
	return [...missing.map((v) => `no var(${v})`), ...words, ...numbers];
}

// --- Self-tests: each rule catches a violation, so it is not vacuous while ui/ is empty. ---

describe('ui rules catch violations (fixtures)', () => {
	it('color_literals', () => {
		expect(colorLiterals('<div class="bg-[#fff] text-primary"></div>')).toEqual(['[#']);
		expect(colorLiterals("const c = '#0066D6';")).toEqual(['#0066D6']);
		expect(colorLiterals('<div style="color: rgb(0 0 0)"></div>')).toEqual(['rgb(']);
		expect(colorLiterals('{#if open}{#each items as i}{/each}{/if} <div class="bg-primary">')).toEqual([]);
		for (const fn of ['rgba', 'hsl', 'hsla', 'oklch', 'oklab', 'lab', 'lch', 'hwb', 'color']) {
			expect(colorLiterals(`<div class="bg-[${fn}(0_0_0)]"></div>`), fn).toEqual([`${fn}(`]);
		}
		for (const hex of ['#fff', '#ffff', '#0066d6', '#0066d6cc']) {
			expect(colorLiterals(`const c = '${hex}';`), hex).toEqual([hex]);
		}
		expect(colorLiterals("const c = '#fffff';")).toEqual([]);
		// color-mix() of tokens is allowed; a literal inside it is caught by the other patterns.
		expect(colorLiterals('<div class="bg-[color-mix(in_srgb,var(--primary)_50%,transparent)]">')).toEqual([]);
		expect(colorLiterals('<div class="bg-[color-mix(in_srgb,#fff_50%,transparent)]">')).toEqual(['#fff']);
	});

	it('bare_duration_tokens', () => {
		expect(durationTokens).toEqual(expect.arrayContaining(['hover', 'reveal', 'in']));
		expect(bareDurations('<div class="transition duration-hover ease-hover">')).toEqual(['duration-hover']);
		expect(bareDurations('<div class="duration-(--duration-reveal) duration-150 md:duration-in">')).toEqual(['duration-in']);
		expect(bareDurations('<!-- duration-hover --> /* duration-out */')).toEqual([]);
	});

	it('lucide_imports', () => {
		expect(lucideImports("import X from '@lucide/svelte/icons/x';")).toHaveLength(1);
		expect(lucideImports("import X from 'lucide-svelte/icons/x';")).toEqual([]);
	});

	it('data_variants', () => {
		const text = '<div class="data-open:bg-primary not-data-disabled:hover:bg-accent data-highlighted:bg-primary data-bogus:hidden data-[side=top]:mt-1" data-state="open">';
		expect(undeclaredVariants(text, ['data-open', 'data-disabled'])).toEqual(['data-bogus']);
		expect(dataVariantsUsed(text).sort()).toEqual(['data-bogus', 'data-disabled', 'data-highlighted', 'data-open']);
	});

	it('interpolated_classes', () => {
		expect(interpolatedClasses('const c = `bg-swatch-${name}`;')).toHaveLength(1);
		expect(interpolatedClasses('<div class="hover:text-{tone}">')).toHaveLength(1);
		expect(interpolatedClasses('const c = `size-4 ${tones[t]}`; const t = { a: "bg-swatch-red" };')).toEqual([]);
		expect(interpolatedClasses('const c = `bg-primary/${opacity}`;')).toHaveLength(1);
		expect(interpolatedClasses('const c = `bg-[var(--swatch-${name})]`;')).toHaveLength(1);
		expect(interpolatedClasses('<div class="data-open:border-t-[var(--x-{tone})]">')).toHaveLength(1);
		expect(interpolatedClasses('const c = `[&>svg]:fill-${tone}`;')).toHaveLength(1);
		expect(interpolatedClasses('<div class="bg-primary {extra}">')).toEqual([]);
	});

	it('motion_reduced_pair', () => {
		expect(motionWithoutReducedPair('a.svelte', '<div class="data-open:zoom-in-95 fade-in-0"></div>')).toHaveLength(1);
		expect(motionWithoutReducedPair('a.ts', "const v = 'slide-in-from-top-2 fade-in-0';")).toHaveLength(1);
		expect(
			motionWithoutReducedPair('a.svelte', '<div class={cn("data-open:zoom-in-95", "data-open:motion-reduce:zoom-in-100")}></div>')
		).toEqual([]);
		expect(motionWithoutReducedPair('a.svelte', '<div class="motion-safe:animate-spin"></div>')).toEqual([]);
		// Any motion-reduce: is not enough: it must reset the same property.
		expect(motionWithoutReducedPair('a.svelte', '<div class="animate-spin motion-reduce:opacity-50"></div>')).toHaveLength(1);
		expect(motionWithoutReducedPair('a.svelte', '<div class="animate-spin motion-reduce:animate-none"></div>')).toEqual([]);
		expect(
			motionWithoutReducedPair('a.svelte', '<div class="hover:scale-105 motion-reduce:translate-none"></div>')
		).toHaveLength(1);
		expect(motionWithoutReducedPair('a.svelte', '<div class="hover:scale-105 motion-reduce:hover:scale-100"></div>')).toEqual([]);
		// The reset must carry the state variants too, or the more specific `:hover` rule wins.
		expect(motionWithoutReducedPair('a.svelte', '<div class="hover:scale-105 motion-reduce:scale-100"></div>')).toHaveLength(1);
		expect(
			motionWithoutReducedPair('a.svelte', '<div class="data-open:animate-in data-open:slide-in-from-top-2 data-open:motion-reduce:animate-none"></div>')
		).toEqual([]);
		expect(
			motionWithoutReducedPair('a.svelte', '<div class="data-open:slide-in-from-top-2 data-open:motion-reduce:slide-in-from-top-0"></div>')
		).toEqual([]);
		expect(motionWithoutReducedPair('a.ts', "const v = 'data-open:spin-in-45 motion-reduce:data-open:spin-in-0';")).toEqual([]);
		// Svelte class: directives belong to the same element.
		expect(motionWithoutReducedPair('a.svelte', '<div class="size-4" class:translate-x-2={open}></div>')).toHaveLength(1);
		expect(
			motionWithoutReducedPair('a.svelte', '<div class="size-4 motion-reduce:translate-x-0" class:translate-x-2={open}></div>')
		).toEqual([]);
		expect(
			motionWithoutReducedPair('a.svelte', '<div class:translate-x-2={open} class:motion-reduce:translate-none={true}></div>')
		).toEqual([]);
		expect(
			motionWithoutReducedPair('a.svelte', '<div class:translate-x-2={a > b}></div><span class="motion-reduce:translate-none"></span>')
		).toHaveLength(1);
		// A fixed transform (a tooltip arrow, centring) does not move: no state, no animation.
		expect(motionWithoutReducedPair('a.svelte', '<div class="rotate-45 -translate-x-1/2"></div>')).toEqual([]);
		expect(motionWithoutReducedPair('a.svelte', '<div class="data-open:animate-in fade-in-0"></div>')).toEqual([]);
	});

	it('focus_ring_literals', () => {
		const ok = '@utility focus-ring { outline: var(--stroke-ring) solid color-mix(in srgb, var(--ring) calc(var(--ring-opacity) * 100%), transparent); outline-offset: 0; }';
		expect(focusRingLiterals(ok)).toEqual([]);
		expect(focusRingLiterals(ok.replace('var(--ring) ', 'blue '))).toEqual(['no var(--ring)', 'blue']);
		expect(focusRingLiterals(ok.replace('var(--stroke-ring)', '3px'))).toEqual(['no var(--stroke-ring)', '3px']);
		expect(focusRingLiterals(ok.replace('var(--ring) ', '#0066D6 '))).toContain('#0066D6');
	});
});

// --- The rules over src/lib/components/ui/. ---

describe('ui components follow the Phase 2 rules', () => {
	const sources = uiSources();

	it('ui_has_no_color_literals', () => {
		for (const { file, text } of sources) expect(colorLiterals(text), file).toEqual([]);
	});

	it('ui_uses_duration_tokens_in_the_variable_form', () => {
		for (const { file, text } of sources) expect(bareDurations(text), file).toEqual([]);
	});

	it('ui_imports_lucide_svelte_only', () => {
		for (const { file, text } of sources) expect(lucideImports(text), file).toEqual([]);
	});

	it('ui_data_variants_are_declared', () => {
		expect(declaredVariants.sort()).toEqual(
			['data-active', 'data-checked', 'data-closed', 'data-disabled', 'data-horizontal', 'data-open', 'data-unchecked', 'data-vertical'].sort()
		);
		for (const { file, text } of sources) expect(undeclaredVariants(text), file).toEqual([]);
	});

	// TODO(Task 30): enable at the end of Phase 2, when every copied variant must be in use.
	it.skip('ui_copied_variants_are_all_used', () => {
		const used = new Set(sources.flatMap(({ text }) => dataVariantsUsed(text)));
		expect(declaredVariants.filter((v) => !used.has(v))).toEqual([]);
	});

	it('ui_has_no_interpolated_classes', () => {
		for (const { file, text } of sources) expect(interpolatedClasses(text), file).toEqual([]);
	});

	it('ui_motion_has_reduced_pair', () => {
		for (const { file, text } of sources) expect(motionWithoutReducedPair(file, text), file).toEqual([]);
	});

	it('focus_ring_uses_ring_tokens', async () => {
		expect(focusRingLiterals(componentsCss)).toEqual([]);
		const ring =
			'outline: var(--stroke-ring) solid color-mix(in srgb, var(--ring) calc(var(--ring-opacity) * 100%), transparent)';
		for (const candidate of ['focus-visible:focus-ring', 'group-focus-visible/card:focus-ring']) {
			const selector = await selectorFor(candidate);
			expect(selector, candidate).toContain(':focus-visible');
			const { css } = await compileAppCss([candidate]);
			expect(css, candidate).toContain(`${selector} {`);
			expect(css, candidate).toContain(ring);
		}
	});

	it('test_files_are_not_scanned', async () => {
		const { sources } = await compileAppCss([]);
		const excluded = sources.filter((s) => s.negated).map((s) => s.pattern);
		expect(excluded).toContain('./**/*.test.ts');
		expect(excluded).toContain('./lib/test/**');

		// Scan as the Vite plugin does: no test file is read, so a class only a test names is not emitted.
		const scanner = new Scanner({ sources });
		const candidates = scanner.scan();
		expect(scanner.files.filter((f) => /\.test\.ts$|\/lib\/test\//.test(f))).toEqual([]);
		const { css } = await compileAppCss(candidates);
		expect(css).not.toContain(TEST_ONLY_CLASS.replace(/[[\].]/g, (c) => `\\${c}`));
	});
});
