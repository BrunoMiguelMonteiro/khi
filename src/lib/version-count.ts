/**
 * «Desde então saíram duas versões» (Task 46, as in the Figma): the number of versions since the
 * installed one is written out from two to ten; from eleven up it stays in digits. One has its own
 * sentence (`_one`), so it never comes here as a word.
 */
const WORDS: Record<string, string[]> = {
	// Feminine: «versões»
	pt: ['duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez'],
	en: ['two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
};

export function versionCountWord(count: number, lang: string, options: { sentenceStart?: boolean } = {}): string {
	const words = WORDS[lang] ?? WORDS.en;
	const word = Number.isInteger(count) && count >= 2 && count <= 10 ? words[count - 2] : String(count);
	return options.sentenceStart ? word.charAt(0).toUpperCase() + word.slice(1) : word;
}
