import { describe, it, expect } from 'vitest';
import { abbreviateHome } from './home-path';

describe('abbreviateHome', () => {
	const home = '/Users/leitor';

	it('the home itself is «~»', () => {
		expect(abbreviateHome('/Users/leitor', home)).toBe('~');
		expect(abbreviateHome('/Users/leitor/', home)).toBe('~/');
	});

	it('a path inside the home starts with «~/»', () => {
		expect(abbreviateHome('/Users/leitor/Documents/Kobo', home)).toBe('~/Documents/Kobo');
	});

	it('a path that only looks like the home is left alone', () => {
		expect(abbreviateHome('/Users/leitor2/x', home)).toBe('/Users/leitor2/x');
		expect(abbreviateHome('/Users/leitorX', home)).toBe('/Users/leitorX');
	});

	it('a path outside the home is left alone', () => {
		expect(abbreviateHome('/Volumes/Notes', home)).toBe('/Volumes/Notes');
	});

	it('without a home, or with an empty one, the full path stays', () => {
		expect(abbreviateHome('/Users/leitor/x', null)).toBe('/Users/leitor/x');
		expect(abbreviateHome('/Users/leitor/x', '')).toBe('/Users/leitor/x');
	});

	it('a home that ends in «/» still matches', () => {
		expect(abbreviateHome('/Users/leitor/x', '/Users/leitor/')).toBe('~/x');
	});
});
