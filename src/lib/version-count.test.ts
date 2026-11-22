import { describe, it, expect } from 'vitest';
import { versionCountWord } from './version-count';

describe('versionCountWord', () => {
	it('writes two to ten out in Portuguese, feminine, as «saíram duas versões»', () => {
		expect([2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => versionCountWord(n, 'pt'))).toEqual([
			'duas',
			'três',
			'quatro',
			'cinco',
			'seis',
			'sete',
			'oito',
			'nove',
			'dez'
		]);
	});

	it('writes two to ten out in English', () => {
		expect([2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => versionCountWord(n, 'en'))).toEqual([
			'two',
			'three',
			'four',
			'five',
			'six',
			'seven',
			'eight',
			'nine',
			'ten'
		]);
	});

	it('uses digits from eleven up, in both languages', () => {
		expect(versionCountWord(11, 'pt')).toBe('11');
		expect(versionCountWord(12, 'en')).toBe('12');
		expect(versionCountWord(250, 'pt')).toBe('250');
	});

	it('uses digits for one and below: the singular has its own sentence, and 0 is not a count', () => {
		expect(versionCountWord(1, 'pt')).toBe('1');
		expect(versionCountWord(0, 'en')).toBe('0');
	});

	it('can open a sentence: English capitalises the word, digits stay as they are', () => {
		expect(versionCountWord(2, 'en', { sentenceStart: true })).toBe('Two');
		expect(versionCountWord(2, 'pt', { sentenceStart: true })).toBe('Duas');
		expect(versionCountWord(11, 'en', { sentenceStart: true })).toBe('11');
	});

	it('falls back to English for a language it does not know', () => {
		expect(versionCountWord(3, 'fr')).toBe('three');
	});
});
