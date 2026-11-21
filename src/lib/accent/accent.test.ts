import { afterEach, describe, expect, it, vi } from "vitest";
import tokens from "../../../design/tokens.json";
import table from "../../../design/accent-tones.json";
import type { SystemAccent } from "$lib/bindings";

const { listen } = vi.hoisted(() => ({ listen: vi.fn() }));
vi.mock("$lib/bindings", () => ({
  commands: { getSystemAccent: vi.fn() },
  events: { systemAccentChanged: { listen } },
}));

import {
  ACCENT_TONES,
  SWATCH_NAMES,
  accentTones,
  applyAccent,
  listenSystemAccent,
  type AccentMode,
} from "./accent";

const MODES: AccentMode[] = ["claro", "escuro"];
const SYSTEM_NAMES = ["grafite", "vermelho", "laranja", "amarelo", "verde", "azul", "roxo", "rosa"];
const SWATCHES = ["azul-tinta", "verde-folha", "turquesa", "laranja", "amarelo", "rosa", "violeta"];
const TONES = [
  "primary",
  "primary-foreground",
  "primary-hover",
  "primary-pressed",
  "link",
  "primary-tint",
  "primary-tint-foreground",
  "ring",
];

type Entry = { value: string; source: string };
type Accent = Record<AccentMode, Record<string, Entry>>;
const groups = table as unknown as { sistema: Record<string, Accent>; amostras: Record<string, Accent> };
const every = (): [string, Accent][] => [
  ...Object.entries(groups.sistema).map(([n, a]): [string, Accent] => [`sistema.${n}`, a]),
  ...Object.entries(groups.amostras).map(([n, a]): [string, Accent] => [`amostras.${n}`, a]),
];

const multicolor: SystemAccent = { name: "multicolor", light: "#007AFF", dark: "#007AFF" };

/** WCAG 2.x contrast ratio, not rounded. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("accent", () => {
  afterEach(() => {
    document.documentElement.removeAttribute("style");
  });

  it("every_accent_has_all_tones_with_source_in_both_modes", () => {
    expect(Object.keys(groups.sistema)).toEqual(SYSTEM_NAMES);
    expect(Object.keys(groups.amostras)).toEqual(SWATCHES);
    expect([...SWATCH_NAMES]).toEqual(SWATCHES);
    expect([...ACCENT_TONES]).toEqual(TONES);
    for (const [name, accent] of every()) {
      expect(Object.keys(accent), name).toEqual(MODES);
      for (const mode of MODES) {
        expect(Object.keys(accent[mode]), `${name} ${mode}`).toEqual(TONES);
        for (const [tone, { value, source }] of Object.entries(accent[mode])) {
          expect(value, `${name} ${mode} ${tone}`).toMatch(/^#[0-9A-F]{6}$/);
          expect(source, `${name} ${mode} ${tone}`).toMatch(/^(figma|sistema|derivado|tokens):\S/);
        }
      }
    }
  });

  it("blue_matches_tokens_exactly", () => {
    const blue = groups.sistema.azul;
    const cor = tokens.cor as unknown as Record<"claro" | "escuro", Record<string, string>>;
    for (const mode of MODES)
      for (const tone of TONES) expect(blue[mode][tone].value, `${mode} ${tone}`).toBe(cor[mode][tone]);
    const steps = (mode: AccentMode) =>
      ["primary", "primary-hover", "primary-pressed"].map((t) => blue[mode][t].value);
    expect(steps("claro")).toEqual(["#0066D6", "#005BBF", "#0050A8"]);
    expect(blue.claro["primary-foreground"].value).toBe("#FFFFFF");
    // In Escuro the press is lighter and the text dark.
    expect(steps("escuro")).toEqual(["#62A6FF", "#7FB6FF", "#9CC6FF"]);
    expect(blue.escuro["primary-foreground"].value).toBe("#051A36");
  });

  it("contrast_holds_unrounded", () => {
    const cor = tokens.cor as unknown as Record<"claro" | "escuro", Record<string, string>>;
    for (const [name, accent] of every())
      for (const mode of MODES) {
        const v = Object.fromEntries(Object.entries(accent[mode]).map(([t, e]) => [t, e.value]));
        const { background, card } = cor[mode];
        const pairs: [string, string, string, number][] = [
          ["primary-foreground / primary", v["primary-foreground"], v.primary, 4.5],
          ["primary-foreground / primary-hover", v["primary-foreground"], v["primary-hover"], 4.5],
          ["primary-foreground / primary-pressed", v["primary-foreground"], v["primary-pressed"], 4.5],
          ["link / background", v.link, background, 4.5],
          ["link / card", v.link, card, 4.5],
          ["primary-tint-foreground / primary-tint", v["primary-tint-foreground"], v["primary-tint"], 4.5],
          // Tema 3: the tint text is also the 1 px outline in the contrast modes.
          ["primary-tint-foreground outline / background", v["primary-tint-foreground"], background, 3],
          ["primary-tint-foreground outline / card", v["primary-tint-foreground"], card, 3],
        ];
        for (const [pair, fg, bg, min] of pairs)
          expect(contrast(fg, bg), `${name} ${mode} ${pair}`).toBeGreaterThanOrEqual(min);
      }
  });

  it("multicolor_uses_the_system_blue_tones", () => {
    // Sistema with Multicolor is the app's own blue (the system blue tones); Azul-tinta is only a swatch
    expect(accentTones("system", multicolor)).toBe(groups.sistema.azul);
    expect(accentTones("azul-tinta", multicolor)).toBe(groups.amostras["azul-tinta"]);
    expect(accentTones("system", { ...multicolor, name: "azul" })).toBe(groups.sistema.azul);
    expect(accentTones("system", { name: "roxo", light: "#953D96", dark: "#A550A7" })).toBe(
      groups.sistema.roxo,
    );
    // A chosen swatch ignores the system.
    expect(accentTones("verde-folha", { name: "rosa", light: "#F74F9E", dark: "#F74F9E" })).toBe(
      groups.amostras["verde-folha"],
    );
  });

  it("apply_accent_sets_css_variables", () => {
    const style = document.documentElement.style;
    applyAccent("system", multicolor, "claro");
    for (const tone of TONES)
      expect(style.getPropertyValue(`--${tone}`), tone).toBe(groups.sistema.azul.claro[tone].value);
    applyAccent("laranja", multicolor, "escuro");
    for (const tone of TONES)
      expect(style.getPropertyValue(`--${tone}`), tone).toBe(groups.amostras.laranja.escuro[tone].value);
    applyAccent("system", { name: "amarelo", light: "#FFC726", dark: "#FFC600" }, "escuro");
    expect(style.getPropertyValue("--primary")).toBe(groups.sistema.amarelo.escuro.primary.value);
    expect(style.getPropertyValue("--primary-foreground")).toBe(
      groups.sistema.amarelo.escuro["primary-foreground"].value,
    );
    // Only the tone variables, named as in tokens.css.
    expect(Array.from({ length: style.length }, (_, i) => style.item(i)).sort()).toEqual(TONES.map((t) => `--${t}`).sort());
  });

  it("listens_to_system_accent_changes", async () => {
    const unlisten = vi.fn();
    listen.mockResolvedValueOnce(unlisten);
    const seen: SystemAccent[] = [];
    const stop = await listenSystemAccent((accent) => seen.push(accent));
    const rosa: SystemAccent = { name: "rosa", light: "#F74F9E", dark: "#F74F9E" };
    listen.mock.calls[0][0]({ event: "system-accent-changed", id: 1, payload: rosa });
    expect(seen).toEqual([rosa]);
    stop();
    expect(unlisten).toHaveBeenCalledOnce();
  });
});
