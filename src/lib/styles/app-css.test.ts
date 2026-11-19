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
});
