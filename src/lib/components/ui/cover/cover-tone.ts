/** Capas 1: the eight generated-cover tones, in the order of the Figma variants. */
export const COVER_TONES = [
  "verde",
  "ardosia",
  "castanho",
  "ameixa",
  "azul",
  "oliva",
  "petroleo",
  "tijolo",
] as const;

export type CoverTone = (typeof COVER_TONES)[number];

/** Each tone's fill, whole classes so Tailwind finds them (never `bg-cover-${tone}`). */
export const COVER_BG: Record<CoverTone, string> = {
  verde: "bg-cover-verde",
  ardosia: "bg-cover-ardosia",
  castanho: "bg-cover-castanho",
  ameixa: "bg-cover-ameixa",
  azul: "bg-cover-azul",
  oliva: "bg-cover-oliva",
  petroleo: "bg-cover-petroleo",
  tijolo: "bg-cover-tijolo",
};

/** The book's tone, from its id alone (FNV-1a), so it never changes with the title or between runs. */
export function coverTone(bookId: number | string): CoverTone {
  let hash = 0x811c9dc5;
  for (const char of String(bookId)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return COVER_TONES[hash % COVER_TONES.length];
}
