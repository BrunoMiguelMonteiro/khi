import type { SwatchName } from '$lib/accent/accent';

export { SWATCH_NAMES, type SwatchName } from '$lib/accent/accent';

/** Each swatch's fill, whole classes so Tailwind finds them (never `bg-swatch-${name}`). */
export const SWATCH_BG: Record<SwatchName, string> = {
	'azul-tinta': 'bg-swatch-azul-tinta',
	'verde-folha': 'bg-swatch-verde-folha',
	turquesa: 'bg-swatch-turquesa',
	laranja: 'bg-swatch-laranja',
	amarelo: 'bg-swatch-amarelo',
	rosa: 'bg-swatch-rosa',
	violeta: 'bg-swatch-violeta'
};
