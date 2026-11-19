import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const tokensPath = resolve(root, 'src/lib/styles/tokens.css');
const figma = JSON.parse(readFileSync(resolve(root, 'design/tokens.json'), 'utf8'));
const effects = JSON.parse(readFileSync(resolve(root, 'design/effects.json'), 'utf8'));
const tailwindTheme = readFileSync(resolve(root, 'node_modules/tailwindcss/theme.css'), 'utf8');

// Review Focus 4, from the plan («Fundações»): the outside judge of the Figma contrast modes.
const DISABLED_VAR = '--disabled-foreground';
const DISABLED_MORE_CONTRAST_LIGHT = '#636366';
const DISABLED_MORE_CONTRAST_DARK = '#8E8E92';
// Review Focus 5.
const ENTER_DISTANCE_VAR = '--distance-enter';

const light: Record<string, string> = figma.cor.claro;
const dark: Record<string, string> = figma.cor.escuro;
const lightContrast: Record<string, string> = figma.cor['claro-contraste'];
const darkContrast: Record<string, string> = figma.cor['escuro-contraste'];
const NEW_COLORS = ['scrim', 'input-strong', 'switch-on'];
const raio: Record<string, number> = figma.raio;
const medidas: Record<string, number> = figma.medidas;
const movimento: Record<string, number | string> = figma.movimento;
const spacing: Record<string, number> = figma.spacing;

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
		const m = part.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
		expect(m, `unparsed declaration: ${part.trim()}`).not.toBeNull();
		expect(map.has(m![1]), `${m![1]} declared twice`).toBe(false);
		map.set(m![1], m![2]);
	}
	return map;
}

function find(list: Block[], prelude: string): Decls {
	const found = list.filter((b) => b.prelude === prelude);
	expect(found, `exactly one "${prelude}" block`).toHaveLength(1);
	return decls(found[0].body);
}

const CONTRAST_MEDIA = '@media (prefers-contrast: more)';

// Only rules, no stray declarations or text between them.
function onlyRules(css: string): Block[] {
	const list = blocks(css);
	let rest = css;
	for (const b of list) rest = rest.replace(b.prelude, '').replace(`{${b.body}}`, '');
	expect(rest.trim(), 'nothing outside the rules').toBe('');
	return list;
}

function load() {
	expect(existsSync(tokensPath), 'src/lib/styles/tokens.css exists').toBe(true);
	const css = readFileSync(tokensPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
	const top = blocks(css);
	const contrastMedia = top.filter((b) => b.prelude.includes('prefers-contrast'));
	expect(contrastMedia.map((b) => b.prelude), 'exactly one contrast block').toEqual([
		CONTRAST_MEDIA
	]);
	const contrast = onlyRules(contrastMedia[0].body);
	expect(
		contrast.map((b) => b.prelude),
		'the contrast block holds exactly :root then .dark'
	).toEqual([':root', '.dark']);
	const reduced = blocks(
		top.find((b) => b.prelude === '@media (prefers-reduced-motion: reduce)')?.body ?? ''
	);
	return {
		top,
		root: find(top, ':root'),
		dark: find(top, '.dark'),
		theme: find(top, '@theme static'),
		themeInline: find(top, '@theme inline'),
		contrastRoot: find(contrast, ':root'),
		contrastDark: find(contrast, '.dark'),
		reducedRoot: find(reduced, ':root'),
		reducedBlocks: reduced
	};
}

const lower = (s: string | undefined) => s?.toLowerCase();
const isEase = (key: string) => key.startsWith('ease-');

function motionValue(key: string, value: number | string): string {
	if (typeof value === 'string') return value;
	if (key.startsWith('distance-')) return `${value}px`;
	if (key.startsWith('scale-')) return `${value}`;
	return `${value}ms`;
}

describe('tokens.css (Figma variables)', () => {
	it('every_light_color_matches_figma', () => {
		const { root } = load();
		for (const [key, value] of Object.entries(light)) {
			expect(lower(root.get(`--${key}`)), `--${key}`).toBe(value.toLowerCase());
		}
		expect(root.get('--ring-opacity')).toBe(String(figma.cor['ring-opacity']));
	});

	it('every_dark_color_matches_figma', () => {
		const { dark: darkDecls } = load();
		for (const [key, value] of Object.entries(dark)) {
			expect(lower(darkDecls.get(`--${key}`)), `--${key}`).toBe(value.toLowerCase());
		}
	});

	it('no_color_outside_figma', () => {
		const t = load();
		const sizeAndMotion = [
			...Object.keys(medidas),
			...Object.keys(movimento).filter((k) => !isEase(k))
		].map((k) => `--${k}`);
		const expectedRoot = [
			...Object.keys(light).map((k) => `--${k}`),
			'--ring-opacity',
			...sizeAndMotion
		];
		expect([...t.root.keys()].sort()).toEqual(expectedRoot.sort());
		expect([...t.dark.keys()].sort()).toEqual(Object.keys(dark).map((k) => `--${k}`).sort());

		for (const block of [t.contrastRoot, t.contrastDark, t.reducedRoot]) {
			for (const name of block.keys()) expect(t.root.has(name), name).toBe(true);
		}
		expect(t.reducedBlocks.map((b) => b.prelude)).toEqual([':root']);

		const colorAliases = [...t.themeInline].filter(([name]) => name.startsWith('--color-'));
		expect(colorAliases.map(([name]) => name).sort()).toEqual(
			Object.keys(light).map((k) => `--color-${k}`).sort()
		);
		for (const [name, value] of colorAliases) {
			expect(value).toBe(`var(--${name.slice('--color-'.length)})`);
		}
		expect(t.theme.has('--color-ring-opacity')).toBe(false);
		expect(t.themeInline.has('--color-ring-opacity')).toBe(false);
		for (const name of t.theme.keys()) expect(name.startsWith('--color-'), name).toBe(false);
		// The only colours in @theme static are the Figma effect styles (design/effects.json),
		// whose values effects.test.ts checks.
		const shadowNames = Object.keys(effects.sombra).map((k) => `--shadow-sombra-${k}`);
		for (const [name, value] of t.theme) {
			if (/#[0-9a-f]{3,8}\b|\b(rgba?|hsla?|oklch|oklab|lab|lch|color)\(/i.test(value)) {
				expect(shadowNames, `${name} colour comes from effects.json`).toContain(name);
			}
		}
		for (const [name, value] of t.themeInline) expect(value).not.toBe(`var(${name})`);
	});

	it('radii_and_sizes_in_px', () => {
		const { root, theme, themeInline } = load();
		expect(theme.get('--radius-control')).toBe('6px');
		for (const [key, value] of Object.entries(raio)) {
			expect(theme.get(`--radius-${key}`), `--radius-${key}`).toBe(`${value}px`);
		}
		expect(root.get('--size-control')).toBe('28px');
		expect(root.get('--size-toolbar')).toBe('52px');
		for (const [key, value] of Object.entries(medidas)) {
			expect(root.get(`--${key}`), `--${key}`).toBe(`${value}px`);
		}
		expect(themeInline.get('--spacing-control')).toBe('var(--size-control)');
		const sizes = Object.keys(medidas).filter((k) => k.startsWith('size-'));
		for (const key of sizes) {
			const alias = `--spacing-${key.slice('size-'.length)}`;
			expect(themeInline.get(alias), alias).toBe(`var(--${key})`);
		}
		const spacingAliases = [...themeInline.keys()].filter((n) => n.startsWith('--spacing'));
		expect(spacingAliases).toHaveLength(sizes.length);
	});

	it('motion_matches_figma', () => {
		const { root, theme } = load();
		for (const [key, value] of Object.entries(movimento)) {
			const decl = isEase(key) ? theme.get(`--${key}`) : root.get(`--${key}`);
			expect(decl, `--${key}`).toBe(motionValue(key, value));
		}
	});

	it('figma_spacing_is_tailwind_scale', () => {
		const { theme, themeInline } = load();
		expect(Object.keys(spacing)).toContain('0-5');
		for (const [key, value] of Object.entries(spacing)) {
			expect(value, `spacing/${key}`).toBe(Number(key.replace('-', '.')) * 4);
		}
		expect(tailwindTheme).toMatch(/--spacing:\s*0\.25rem;/);
		for (const name of [...theme.keys(), ...themeInline.keys()]) {
			expect(name, 'Tailwind spacing scale is not redefined').not.toMatch(/^--spacing(-[\d-]+)?$/);
		}
	});

	it('contrast_modes_exist_with_every_color', () => {
		const keys = Object.keys(light).sort();
		expect(keys).toHaveLength(65);
		for (const mode of [dark, lightContrast, darkContrast]) {
			expect(mode).toBeDefined();
			expect(Object.keys(mode).sort()).toEqual(keys);
		}
	});

	it('contrast_block_is_figma_mode_diff', () => {
		// :root is the light diff. .dark also matches <html class="dark"> after the contrast
		// :root, so it redeclares every light-diff key too, with the Escuro · Contraste value.
		const { contrastRoot, contrastDark } = load();
		const changed = (base: Record<string, string>, mode: Record<string, string>) =>
			Object.keys(mode).filter((key) => mode[key].toLowerCase() !== base[key].toLowerCase());
		const entries = (keys: string[], mode: Record<string, string>) =>
			[...new Set(keys)].map((key) => [`--${key}`, mode[key].toLowerCase()]).sort();
		const actual = (block: Decls) =>
			[...block].map(([name, value]) => [name, value.toLowerCase()]).sort();
		const lightKeys = changed(light, lightContrast);
		expect(lightKeys.length).toBeGreaterThan(0);
		expect(actual(contrastRoot)).toEqual(entries(lightKeys, lightContrast));
		expect(actual(contrastDark)).toEqual(
			entries([...lightKeys, ...changed(dark, darkContrast)], darkContrast)
		);
	});

	it('contrast_effective_palettes_are_figma_modes', () => {
		// Cascade order on <html> (same specificity, so source order wins).
		const t = load();
		const palette = (...layers: Decls[]) => {
			const out: Record<string, string> = {};
			for (const layer of layers) for (const [name, value] of layer) out[name] = value;
			return Object.keys(light).map((key) => [`--${key}`, lower(out[`--${key}`])]);
		};
		const expected = (mode: Record<string, string>) =>
			Object.keys(light).map((key) => [`--${key}`, mode[key].toLowerCase()]);
		expect(palette(t.root, t.contrastRoot), 'light + contrast').toEqual(expected(lightContrast));
		expect(palette(t.root, t.dark, t.contrastRoot, t.contrastDark), 'dark + contrast').toEqual(
			expected(darkContrast)
		);
	});

	it('contrast_raises_disabled_as_foundations', () => {
		expect(lower(lightContrast[DISABLED_VAR.slice(2)])).toBe(
			DISABLED_MORE_CONTRAST_LIGHT.toLowerCase()
		);
		expect(lower(darkContrast[DISABLED_VAR.slice(2)])).toBe(
			DISABLED_MORE_CONTRAST_DARK.toLowerCase()
		);
	});

	it('new_colors_come_from_figma', () => {
		const { root, dark: darkDecls, themeInline } = load();
		for (const key of NEW_COLORS) {
			expect(lower(root.get(`--${key}`)), `--${key}`).toBe(light[key].toLowerCase());
			expect(lower(darkDecls.get(`--${key}`)), `.dark --${key}`).toBe(dark[key].toLowerCase());
			expect(themeInline.get(`--color-${key}`), `--color-${key}`).toBe(`var(--${key})`);
		}
	});

	it('increased_contrast_raises_disabled', () => {
		const { root, contrastRoot, contrastDark } = load();
		expect(root.has(DISABLED_VAR)).toBe(true);
		expect(lower(contrastRoot.get(DISABLED_VAR))).toBe(DISABLED_MORE_CONTRAST_LIGHT.toLowerCase());
		expect(lower(contrastDark.get(DISABLED_VAR))).toBe(DISABLED_MORE_CONTRAST_DARK.toLowerCase());
	});

	it('reduced_motion_drops_distance', () => {
		const { root, reducedRoot } = load();
		expect(reducedRoot.get(ENTER_DISTANCE_VAR)).toBe('0px');
		const durations = Object.keys(movimento).filter((k) => k.startsWith('duration-'));
		expect(durations.length).toBeGreaterThan(0);
		for (const key of durations) {
			const name = `--${key}`;
			expect(reducedRoot.get(name) ?? root.get(name), name).toBe(root.get(name));
		}
	});

	it('overrides_come_after_base_rules', () => {
		// Same specificity: the @media overrides only win if they follow :root and .dark.
		const { top } = load();
		const at = (prelude: string) => top.findIndex((b) => b.prelude === prelude);
		const lastBase = Math.max(at(':root'), at('.dark'));
		expect(lastBase).toBeGreaterThanOrEqual(0);
		for (const media of [
			'@media (prefers-contrast: more)',
			'@media (prefers-reduced-motion: reduce)'
		]) {
			expect(at(media), media).toBeGreaterThan(lastBase);
		}
		const contrast = blocks(top[at('@media (prefers-contrast: more)')].body);
		const inner = (prelude: string) => contrast.findIndex((b) => b.prelude === prelude);
		expect(inner('.dark'), '.dark after :root inside the contrast block').toBeGreaterThan(
			inner(':root')
		);
	});

	it('app_css_imports_tokens', () => {
		const appCss = readFileSync(resolve(root, 'src/app.css'), 'utf8');
		expect(appCss).toMatch(/@import ['"]\.\/lib\/styles\/tokens\.css['"];/);
	});
});
