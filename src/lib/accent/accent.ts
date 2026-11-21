import table from '../../../design/accent-tones.json';
import { commands, events, type SystemAccent } from '$lib/bindings';

export type { SystemAccent };

/** The seven colour swatches, in the order of Componentes (D7) · 13 · Amostra de cor. */
export const SWATCH_NAMES = [
	'azul-tinta',
	'verde-folha',
	'turquesa',
	'laranja',
	'amarelo',
	'rosa',
	'violeta'
] as const;
export type SwatchName = (typeof SWATCH_NAMES)[number];
export type AccentChoice = 'system' | SwatchName;

/** The tones the accent sets, named as the variables in tokens.css. */
export const ACCENT_TONES = [
	'primary',
	'primary-foreground',
	'primary-hover',
	'primary-pressed',
	'link',
	'primary-tint',
	'primary-tint-foreground',
	'ring'
] as const;
export type AccentTone = (typeof ACCENT_TONES)[number];

/** Claro and Escuro, the keys of design/accent-tones.json. */
export type AccentMode = 'claro' | 'escuro';
export type AccentTones = Record<AccentMode, Record<AccentTone, { value: string; source: string }>>;

type SystemName = Exclude<SystemAccent['name'], 'multicolor'>;
const tones = table as unknown as {
	sistema: Record<SystemName, AccentTones>;
	amostras: Record<SwatchName, AccentTones>;
};

/** The precomputed tones for a choice: Sistema follows macOS, and Multicolor gives the app's own blue (the system blue tones, as in tokens.css; Azul-tinta is only a swatch). */
export function accentTones(choice: AccentChoice, system: SystemAccent): AccentTones {
	if (choice !== 'system') return tones.amostras[choice];
	if (system.name === 'multicolor') return tones.sistema.azul;
	return tones.sistema[system.name];
}

/**
 * Writes the chosen accent's tones on the root, over tokens.css. Inline values beat `.dark`, so
 * call it again when the mode changes.
 */
export function applyAccent(
	choice: AccentChoice,
	system: SystemAccent,
	mode: AccentMode,
	root: HTMLElement = document.documentElement
): void {
	const entry = accentTones(choice, system)[mode];
	for (const tone of ACCENT_TONES) root.style.setProperty(`--${tone}`, entry[tone].value);
}

/** The accent chosen in System Settings now. */
export function getSystemAccent(): Promise<SystemAccent> {
	return commands.getSystemAccent();
}

/**
 * Calls `onChange` each time the accent in System Settings changes (already deduplicated in Rust);
 * resolves to the function that stops listening.
 */
export async function listenSystemAccent(onChange: (accent: SystemAccent) => void): Promise<() => void> {
	return events.systemAccentChanged.listen((event) => onChange(event.payload));
}
