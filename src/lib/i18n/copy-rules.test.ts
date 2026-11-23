import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
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
		['es', es],
		['fr', fr],
		['pt', pt]
	])('%s: no three ASCII dots, the ellipsis character is used', (_name, tree) => {
		expect(offenders(tree, (v) => v.includes('...'))).toEqual([]);
	});

	it.each([
		['en', en],
		['es', es],
		['pt', pt]
	])('%s: the accent hint names the System option between curly quotes', (_name, tree) => {
		expect(tree.settings.accent.hint).toContain(`\u201C${tree.settings.accent.system}\u201D`);
	});

	it('fr: the accent hint names the System option between guillemets, with narrow no-break spaces', () => {
		expect(fr.settings.accent.hint).toContain(`\u00AB\u202F${fr.settings.accent.system}\u202F\u00BB`);
	});

	it('fr: a narrow no-break space before ? ! ; and :', () => {
		expect(offenders(fr, (v) => /[^\u202F][?!;]|[^\u202F\d]:(?!\/)/u.test(v.replace(/\{[^}]*\}/g, 'x')))).toEqual([]);
	});

	it('en: no straight apostrophe between letters or after a placeholder, the typographic one is used', () => {
		expect(offenders(en, (v) => /[\p{L}}]'\p{L}/u.test(v))).toEqual([]);
	});

	it('en: never "the Kobo"', () => {
		expect(offenders(en, (v) => /the Kobo/i.test(v))).toEqual([]);
	});
});
