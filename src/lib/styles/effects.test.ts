import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileAppCss } from '$lib/test/css';

const root = process.cwd();
const effects = JSON.parse(readFileSync(resolve(root, 'design/effects.json'), 'utf8'));
const tokensCss = readFileSync(resolve(root, 'src/lib/styles/tokens.css'), 'utf8').replace(
	/\/\*[\s\S]*?\*\//g,
	''
);

type Shadow = { x: number; y: number; blur: number; spread: number; color: string; alpha: number };
const sombra: Record<string, Shadow> = effects.sombra;

// Task 5, Passo 3 of the plan: the outside judge of the export (x y blur, alpha).
// mt-[3.217px] is named only in tests: test_files_are_not_scanned (ui-rules.test.ts) proves it is
// not in the CSS, so no test file is scanned.

const PLAN_VALUES: Record<string, [number, number, number, number]> = {
	segmento: [0, 1, 2, 0.12],
	menu: [0, 8, 24, 0.16],
	janela: [0, 8, 24, 0.18],
	aviso: [0, 4, 16, 0.14]
};

function themeStatic(): Map<string, string> {
	const start = tokensCss.indexOf('@theme static {');
	expect(start, '@theme static in tokens.css').toBeGreaterThan(-1);
	const body = tokensCss.slice(start + '@theme static {'.length, tokensCss.indexOf('}', start));
	const map = new Map<string, string>();
	for (const part of body.split(';')) {
		const m = part.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
		if (m) map.set(m[1], m[2]);
	}
	return map;
}

const hexByte = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);

describe('effects.json (Figma effect styles)', () => {
	it('effects_json_has_four_shadows', () => {
		expect(Object.keys(sombra).sort()).toEqual(Object.keys(PLAN_VALUES).sort());
		for (const [name, s] of Object.entries(sombra)) {
			expect(Object.keys(s).sort(), name).toEqual(
				['alpha', 'blur', 'color', 'spread', 'x', 'y'].sort()
			);
			expect(s.color, name).toMatch(/^#[0-9A-F]{8}$/i);
			expect(hexByte(s.color, 3), `${name} hex alpha = alpha`).toBe(Math.round(s.alpha * 255));
			const [x, y, blur, alpha] = PLAN_VALUES[name];
			expect([s.x, s.y, s.blur, s.spread, s.alpha], name).toEqual([x, y, blur, 0, alpha]);
		}
	});

	it('shadows_match_figma_effects', async () => {
		const theme = themeStatic();
		const declared = [...theme.keys()].filter((k) => k.startsWith('--shadow-'));
		expect(declared.sort()).toEqual(Object.keys(sombra).map((k) => `--shadow-sombra-${k}`).sort());

		for (const [name, s] of Object.entries(sombra)) {
			const value = theme.get(`--shadow-sombra-${name}`)!;
			const m = value.match(
				/^(-?\d+)(?:px)? (-?\d+)(?:px)? (\d+)(?:px)? rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\)$/
			);
			expect(m, `${name}: x y blur rgb(r g b / a), spread 0 omitted`).not.toBeNull();
			const [, x, y, blur, r, g, b, a] = m!.map(Number);
			expect([x, y, blur], name).toEqual([s.x, s.y, s.blur]);
			expect(s.spread, `${name} spread`).toBe(0);
			expect([r, g, b], `${name} rgb`).toEqual([0, 1, 2].map((i) => hexByte(s.color, i)));
			expect(a, `${name} alpha`).toBe(s.alpha);
		}

		const candidates = Object.keys(sombra).map((k) => `shadow-sombra-${k}`);
		const { css } = await compileAppCss(candidates);
		for (const c of candidates) {
			expect(css, `.${c} emitted`).toMatch(new RegExp(`\\.${c} \\{[^}]*box-shadow:`));
		}
	});
});
