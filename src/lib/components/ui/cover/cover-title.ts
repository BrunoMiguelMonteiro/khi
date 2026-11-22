/** Measures the width in px of one line of text, in the title's font. */
export type Measure = (text: string) => number;

const NBSP = ' ';

/** A short word has one or two letters (\p{L}, so «É» and «Às» count) and no digits: numbers and lone punctuation stay as they are. */
function isShort(word: string): boolean {
	if (/\p{N}/u.test(word)) return false;
	const letters = word.match(/\p{L}/gu)?.length ?? 0;
	return letters >= 1 && letters <= 2;
}

/**
 * Binds each short word to the next one with U+00A0, but only when the pair fits in `width`,
 * so the short word never ends a line and never forces an overflow.
 *
 * Chains («de a Z»): a unit grows left to right while its last word is short and the whole
 * unit, joined, still fits; the first word that does not fit gets a normal space.
 * Only a single space between two words is a candidate: spaces at the ends, doubled or already
 * U+00A0 stay as they are, and the other pairs still bind.
 * Without a measure or a usable width the title is returned as it is.
 */
export function bindShortWords(title: string, width: number, measure: Measure | null): string {
	if (!measure || !(width > 0)) return title;
	const words = title.split(' ');
	let out = words[0];
	let unit = words[0];
	for (let i = 1; i < words.length; i++) {
		const prev = words[i - 1];
		const word = words[i];
		const joined = unit + NBSP + word;
		if (prev !== '' && word !== '' && isShort(prev) && measure(joined) <= width) {
			out += NBSP + word;
			unit = joined;
		} else {
			out += ' ' + word;
			unit = word;
		}
	}
	return out;
}

/**
 * The title as the cover shows it: short words bound (`bindShortWords`), and `hyphenate` when a
 * word alone is wider than `width`. Only then may the browser hyphenate: with `hyphens: auto` on
 * every title WebKit splits words that fit the line («Ce-gueira»).
 */
export function coverTitle(title: string, width: number, measure: Measure | null): { text: string; hyphenate: boolean } {
	if (!measure || !(width > 0)) return { text: title, hyphenate: false };
	const hyphenate = title.split(/[ \u00A0]/).some((word) => word !== '' && measure(word) > width);
	return { text: bindShortWords(title, width, measure), hyphenate };
}

/** A measure on a canvas, in the computed font of `el`. Null where there is no canvas (jsdom). */
export function canvasMeasure(el: HTMLElement): Measure | null {
	if (typeof CanvasRenderingContext2D === 'undefined') return null;
	const ctx = document.createElement('canvas').getContext('2d');
	if (!ctx) return null;
	const style = getComputedStyle(el);
	ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
	return (text) => ctx.measureText(text).width;
}
