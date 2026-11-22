import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import pt from './locales/pt.json';

function entries(tree: object, prefix = ''): [string, string][] {
	return Object.entries(tree).flatMap(([k, v]) =>
		typeof v === 'object' ? entries(v, `${prefix}${k}.`) : [[`${prefix}${k}`, String(v)] as [string, string]]
	);
}

const offenders = (tree: object, bad: (value: string) => boolean) =>
	entries(tree)
		.filter(([, v]) => bad(v))
		.map(([k]) => k);

describe('copy rules', () => {
	it.each([
		['en', en],
		['pt', pt]
	])('%s: no three ASCII dots, the ellipsis character is used', (_name, tree) => {
		expect(offenders(tree, (v) => v.includes('...'))).toEqual([]);
	});

	it.each([
		['en', en],
		['pt', pt]
	])('%s: the accent hint names the System option between curly quotes', (_name, tree) => {
		expect(tree.settings.accent.hint).toContain(`\u201C${tree.settings.accent.system}\u201D`);
	});

	it('en: no straight apostrophe between letters or after a placeholder, the typographic one is used', () => {
		expect(offenders(en, (v) => /[\p{L}}]'\p{L}/u.test(v))).toEqual([]);
	});

	it('en: never "the Kobo"', () => {
		expect(offenders(en, (v) => /the Kobo/i.test(v))).toEqual([]);
	});
});
