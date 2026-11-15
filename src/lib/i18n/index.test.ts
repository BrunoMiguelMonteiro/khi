import { describe, it, expect, vi, afterEach } from 'vitest';
import { get } from 'svelte/store';
import en from './locales/en.json';
import pt from './locales/pt.json';

// vitest-setup mocks $lib/i18n for every test; this file checks the real one
vi.unmock('$lib/i18n');
const { _, t, locale } = await import('$lib/i18n');

function keys(tree: object, prefix = ''): string[] {
	return Object.entries(tree).flatMap(([k, v]) =>
		typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`]
	);
}

describe('i18n', () => {
	afterEach(() => locale.set('en'));

	it('pt has every key en has', () => {
		expect(keys(pt).sort()).toEqual(keys(en).sort());
	});

	it('the reactive formatter follows the chosen locale', () => {
		locale.set('pt');
		expect(get(_)('notifications.syncError')).toBe('Erro ao sincronizar o Kobo');
	});

	it('t follows the chosen locale too', () => {
		locale.set('pt');
		expect(t('notifications.syncError')).toBe('Erro ao sincronizar o Kobo');
	});
});
