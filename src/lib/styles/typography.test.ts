import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const typographyPath = resolve(root, 'src/lib/styles/typography.css');
const literataDir = resolve(root, 'node_modules/@fontsource-variable/literata');
const figma = JSON.parse(readFileSync(resolve(root, 'design/text-styles.json'), 'utf8'));

type Style = {
	family: 'system' | 'literata';
	fontWeight: number;
	fontStyle: 'normal' | 'italic';
	fontSize: number;
	lineHeight: number;
	letterSpacing: number;
};
const styles: Record<string, Style> = figma.styles;
const SYSTEM_STACK_START = '-apple-system, BlinkMacSystemFont, system-ui';
const LITERATA = "'Literata Variable'";
const SUBSETS = ['latin', 'latin-ext'];
const FACE_DESCRIPTORS = ['font-family', 'font-style', 'font-weight', 'font-display', 'unicode-range'];
const LICENSE_PATH = resolve(root, 'static/licenses/Literata-OFL.txt');

type Decls = Map<string, string>;
type Block = { prelude: string; body: string };

function blocks(css: string): Block[] {
	const out: Block[] = [];
	let i = 0;
	while (i < css.length) {
		const open = css.indexOf('{', i);
		if (open === -1) break;
		let depth = 1;
		let j = open + 1;
		while (j < css.length && depth > 0) {
			if (css[j] === '{') depth++;
			else if (css[j] === '}') depth--;
			j++;
		}
		const prelude = css
			.slice(i, open)
			.replace(/^[\s\S]*;/, '')
			.trim();
		out.push({ prelude, body: css.slice(open + 1, j - 1) });
		i = j;
	}
	return out;
}

function decls(body: string): Decls {
	const map: Decls = new Map();
	// Split on ';' so a last declaration without a trailing semicolon is still seen.
	for (const part of body.split(';')) {
		if (!part.trim()) continue;
		const m = part.match(/^\s*(-?-?[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
		expect(m, `unparsed declaration: ${part.trim()}`).not.toBeNull();
		expect(map.has(m![1]), `${m![1]} declared twice`).toBe(false);
		map.set(m![1], m![2].replace(/\s+/g, ' '));
	}
	return map;
}

function load() {
	expect(existsSync(typographyPath), 'src/lib/styles/typography.css exists').toBe(true);
	const css = readFileSync(typographyPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	const top = blocks(css);
	const themes = top.filter((b) => b.prelude === '@theme');
	expect(themes, 'exactly one @theme block').toHaveLength(1);
	const utilities = new Map<string, Decls>();
	for (const b of top) {
		const m = b.prelude.match(/^@utility\s+(\S+)$/);
		if (!m) continue;
		expect(utilities.has(m[1]), `${m[1]} defined twice`).toBe(false);
		utilities.set(m[1], decls(b.body));
	}
	return {
		theme: decls(themes[0].body),
		utilities,
		fontFaces: top.filter((b) => b.prelude === '@font-face').map((b) => decls(b.body))
	};
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

/** Every block at any depth, so rules inside @layer are found too. */
function allBlocks(css: string): Block[] {
	return blocks(css).flatMap((b) => [b, ...(b.prelude.startsWith('@') ? allBlocks(b.body) : [])]);
}

const woff2Name = (face: Decls) => face.get('src')?.match(/([\w-]+)\.woff2/)?.[1];

/** The package's own @font-face descriptors, by woff2 file name. */
function packageFaces(): Map<string, Decls> {
	const faces = new Map<string, Decls>();
	for (const file of ['opsz.css', 'opsz-italic.css']) {
		const css = stripComments(readFileSync(resolve(literataDir, file), 'utf8'));
		for (const b of blocks(css).filter((b) => b.prelude === '@font-face')) {
			const face = decls(b.body);
			faces.set(woff2Name(face)!, face);
		}
	}
	return faces;
}

async function compileAppCss(candidates: string[]) {
	const load = async (id: string, base: string) => {
		const packages: Record<string, string> = {
			tailwindcss: 'node_modules/tailwindcss/index.css',
			'tw-animate-css': 'node_modules/tw-animate-css/dist/tw-animate.css'
		};
		const path = id in packages ? resolve(root, packages[id]) : resolve(base, id);
		return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
	};
	const appPath = resolve(root, 'src/app.css');
	const compiler = await compile(readFileSync(appPath, 'utf8'), {
		base: dirname(appPath),
		from: appPath,
		loadStylesheet: load
	});
	return { sources: compiler.sources, css: compiler.build(candidates) };
}

/** Resolves `var(--x)` against the @theme block, one level deep. */
function family(theme: Decls, value: string | undefined): string | undefined {
	const m = value?.match(/^var\((--[\w-]+)\)$/);
	return m ? theme.get(m[1]) : value;
}

const byFamily = (f: Style['family']) =>
	Object.entries(styles).filter(([, s]) => s.family === f);

describe('typography.css (Figma text styles)', () => {
	it('every_text_style_has_a_utility', () => {
		const { utilities } = load();
		expect(Object.keys(styles)).toHaveLength(figma._meta.count);
		expect([...utilities.keys()].sort()).toEqual(
			Object.keys(styles)
				.map((k) => `text-${k}`)
				.sort()
		);
		for (const [key, s] of Object.entries(styles)) {
			const u = utilities.get(`text-${key}`)!;
			const name = `text-${key}`;
			expect(u.get('font-size'), `${name} font-size`).toBe(`${s.fontSize}px`);
			expect(u.get('line-height'), `${name} line-height`).toBe(`${s.lineHeight}px`);
			expect(u.get('font-weight'), `${name} font-weight`).toBe(String(s.fontWeight));
			expect(u.get('font-style'), `${name} font-style`).toBe(s.fontStyle);
			expect(s.letterSpacing, `${name} letterSpacing`).toBe(0);
			expect(u.has('letter-spacing'), `${name} letter-spacing`).toBe(false);
		}
	});

	it('reading_uses_literata_with_optical_sizing', () => {
		const { theme, utilities, fontFaces } = load();
		const literata = byFamily('literata');
		expect(literata.map(([k]) => k)).toContain('reading');
		for (const [key] of literata) {
			const u = utilities.get(`text-${key}`)!;
			expect(family(theme, u.get('font-family')), `text-${key}`).toMatch(
				new RegExp(`^${LITERATA}(,|$)`)
			);
			expect(u.get('font-optical-sizing'), `text-${key}`).toBe('auto');
		}

		// Embedded and offline: one face per subset and style, each with the opsz axis.
		const faces = fontFaces.filter((f) => f.get('font-family') === LITERATA);
		const expected = SUBSETS.flatMap((subset) =>
			['normal', 'italic'].map((style) => `${subset}-opsz-${style}`)
		);
		expect(faces.map((f) => f.get('font-style')).sort()).toEqual(
			expected.map((e) => e.split('-').pop()).sort()
		);
		for (const name of expected) {
			const face = faces.find((f) => f.get('src')?.includes(`/literata-${name}.woff2`));
			expect(face, name).toBeDefined();
			expect(face!.get('src')).toMatch(/^url\(['"]?@fontsource-variable\/literata\/files\//);
			expect(face!.get('font-weight')).toBe('200 900');
			expect(existsSync(resolve(literataDir, `files/literata-${name}.woff2`)), name).toBe(true);
		}
		const pkg = JSON.parse(readFileSync(resolve(literataDir, 'metadata.json'), 'utf8'));
		expect(pkg.variable.opsz).toBeDefined();
	});

	it('interface_uses_system_font', () => {
		const { theme, utilities } = load();
		// --font-sans stays on the Tailwind v3 stack (app.css) until Phase 5 for visual parity.
		expect(theme.get('--font-system')).toMatch(new RegExp(`^${SYSTEM_STACK_START}`));
		const system = byFamily('system');
		expect(system.length).toBeGreaterThan(0);
		for (const [key] of system) {
			const u = utilities.get(`text-${key}`)!;
			expect(u.get('font-family'), `text-${key}`).toBe('var(--font-system)');
			expect(u.has('font-optical-sizing'), `text-${key}`).toBe(false);
		}
	});

	it('font_faces_match_package_descriptors', () => {
		const { fontFaces } = load();
		const pkg = packageFaces();
		const faces = fontFaces.filter((f) => f.get('font-family') === LITERATA);
		expect(faces.length).toBeGreaterThan(0);
		for (const face of faces) {
			const name = woff2Name(face)!;
			const source = pkg.get(name);
			expect(source, `${name} in the package opsz CSS`).toBeDefined();
			expect([...face.keys()].sort(), name).toEqual([...source!.keys()].sort());
			for (const key of FACE_DESCRIPTORS) {
				expect(face.get(key), `${name} ${key}`).toBe(source!.get(key));
			}
		}
	});

	it('app_css_compiles_text_styles', async () => {
		const candidates = Object.keys(styles).map((k) => `text-${k}`);
		const { sources, css } = await compileAppCss(candidates);
		const all = allBlocks(stripComments(css));

		const rootTheme = new Map(
			all
				.filter((b) => b.prelude.startsWith(':root'))
				.flatMap((b) => [...decls(b.body)])
		);
		for (const [key, s] of Object.entries(styles)) {
			const rules = all.filter((b) => b.prelude === `.text-${key}`);
			expect(rules, `.text-${key} emitted`).toHaveLength(1);
			const u = decls(rules[0].body);
			expect(u.get('font-size'), `.text-${key}`).toBe(`${s.fontSize}px`);
			const fam = u.get('font-family')!.match(/^var\((--[\w-]+)\)$/)![1];
			expect(rootTheme.get(fam), `${fam} emitted for .text-${key}`).toMatch(
				s.family === 'literata' ? new RegExp(`^${LITERATA},`) : new RegExp(`^${SYSTEM_STACK_START}`)
			);
		}

		const faces = all
			.filter((b) => b.prelude === '@font-face')
			.map((b) => decls(b.body))
			.filter((f) => f.get('font-family') === LITERATA);
		expect(faces.map(woff2Name).sort()).toEqual(
			SUBSETS.flatMap((s) => [`literata-${s}-opsz-italic`, `literata-${s}-opsz-normal`]).sort()
		);

		const excluded = sources.filter((s) => s.negated).map((s) => s.pattern);
		expect(excluded).toContain('./lib/styles/typography.test.ts');
		expect(excluded).toContain('./lib/utils.test.ts');
	});

	it('literata_licence_ships_with_the_app', () => {
		// OFL 1.1 §2: redistributed fonts carry the copyright notice and the licence.
		expect(existsSync(LICENSE_PATH), 'static/licenses/Literata-OFL.txt').toBe(true);
		const text = readFileSync(LICENSE_PATH, 'utf8');
		expect(text).toContain('SIL OPEN FONT LICENSE Version 1.1');
		expect(text).toContain('Copyright 2017 The Literata Project Authors');
		expect(text).toBe(readFileSync(resolve(literataDir, 'LICENSE'), 'utf8'));
	});
});
