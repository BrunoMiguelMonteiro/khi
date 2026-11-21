import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const appCss = readFileSync(resolve(root, 'src/app.css'), 'utf8');
const tauriConf = JSON.parse(readFileSync(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'));

function themeBlocks(css: string): string {
	return [...css.matchAll(/@theme[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join('\n');
}

describe('app.css (Tailwind v4)', () => {
	it('dark_variant_follows_class', () => {
		expect(appCss).toContain('@custom-variant dark (&:where(.dark, .dark *));');
	});

	it('old_neutral_palette_is_kept', () => {
		const theme = themeBlocks(appCss);
		expect(theme).toContain('--color-neutral-50: #F9FAFB;');
		expect(theme).toContain('--color-neutral-100: #F3F4F6;');
		expect(theme).toContain('--color-neutral-200: #E5E7EB;');
		expect(theme).toContain('--color-neutral-300: #D1D5DB;');
		expect(theme).toContain('--color-neutral-400: #9CA3AF;');
		expect(theme).toContain('--color-neutral-500: #6B7280;');
		expect(theme).toContain('--color-neutral-600: #525252;');
		expect(theme).toContain('--color-neutral-700: #404040;');
		expect(theme).toContain('--color-neutral-800: #262626;');
		expect(theme).toContain('--color-neutral-900: #171717;');
		expect(theme).toContain('--color-neutral-950: #0A0A0A;');
	});

	it('macos_minimum_is_13_3', () => {
		expect(tauriConf.bundle.macOS.minimumSystemVersion).toBe('13.3');
	});

	describe('selection-outline contrast (Task 41)', () => {
		const tokens = readFileSync(resolve(root, 'src/lib/styles/tokens.css'), 'utf8');

		// The first block with this selector that declares the variable (tokens.css has other :root blocks, e.g. media queries).
		function value(css: string, selector: ':root' | '.dark', name: string): string {
			for (const m of css.matchAll(new RegExp(`(^|\\n)${selector.replace('.', '\\.')}\\s*\\{([^}]*)\\}`, 'g'))) {
				const hit = m[2].match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
				if (hit) return hit[1];
			}
			throw new Error(`${name} not declared in ${selector}`);
		}
		const channel = (c: number) => {
			const s = c / 255;
			return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		};
		const luminance = (hex: string) => {
			const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16)));
			return 0.2126 * r + 0.7152 * g + 0.0722 * b;
		};
		const ratio = (a: string, b: string) => {
			const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
			return (hi + 0.05) / (lo + 0.05);
		};

		for (const [mode, selector] of [['light', ':root'], ['dark', '.dark']] as const) {
			it(`${mode}: rest on background and hover on accent are at least 3:1`, () => {
				const rest = value(appCss, selector, '--selection-outline');
				const hover = value(appCss, selector, '--selection-outline-hover');
				expect(ratio(rest, value(tokens, selector, '--background'))).toBeGreaterThanOrEqual(3);
				expect(ratio(hover, value(tokens, selector, '--accent'))).toBeGreaterThanOrEqual(3);
			});
		}
	});
});

describe('scroll bar (Task 52)', () => {
	const NAMES = ['--scrollbar-thumb', '--scrollbar-thumb-hover'];

	function blockBody(css: string, prelude: RegExp): string {
		const m = css.match(prelude);
		if (!m || m.index === undefined) throw new Error(`no block ${prelude}`);
		let depth = 1;
		let i = m.index + m[0].length;
		const start = i;
		while (i < css.length && depth > 0) {
			if (css[i] === '{') depth++;
			else if (css[i] === '}') depth--;
			i++;
		}
		return css.slice(start, i - 1);
	}

	const contrastBlock = () => blockBody(appCss, /@media \(prefers-contrast: more\)\s*\{/);

	it('tokens_exist_in_light_dark_and_both_contrast_blocks', () => {
		const light = blockBody(appCss, /(^|\n):root\s*\{(?=[^}]*--scrollbar-thumb)/);
		const dark = blockBody(appCss, /(^|\n)\.dark\s*\{(?=[^}]*--scrollbar-thumb)/);
		const contrast = contrastBlock();
		const hcLight = blockBody(contrast, /(^|\n)\s*:root\s*\{/);
		const hcDark = blockBody(contrast, /(^|\n)\s*\.dark\s*\{/);
		for (const body of [light, dark, hcLight, hcDark]) {
			for (const name of NAMES) expect(body).toMatch(new RegExp(`${name}:\\s*#[0-9a-fA-F]{6};`));
		}
	});

	it('root_sets_scrollbar_color_from_the_token', () => {
		expect(appCss).toMatch(/:root\s*\{[^}]*scrollbar-color:\s*var\(--scrollbar-thumb\)\s+transparent;/);
	});

	it('webkit_scrollbar_rules_only_inside_supports_not_scrollbar_color', () => {
		const supports = blockBody(appCss, /@supports not \(scrollbar-color:\s*red transparent\)\s*\{/);
		expect(supports).toContain('::-webkit-scrollbar-thumb');
		expect(supports).toContain('::-webkit-scrollbar-track');
		const outside = appCss.replace(supports, '');
		expect(outside).not.toContain('::-webkit-scrollbar');
	});
});
