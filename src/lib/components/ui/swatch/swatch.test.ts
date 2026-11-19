import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { Scanner } from "@tailwindcss/oxide";
import { compileAppCss } from "$lib/test/css";
import { expectDisabledInert } from "$lib/test/disabled";
import { SWATCH_BG, SWATCH_NAMES, type SwatchValue } from "./index";
import Fixture from "./swatch.fixture.svelte";

type Binding = { binding: string; utility: string; css: string };

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

async function expectBindings(el: Element, bindings: Binding[]) {
  for (const { binding, utility, css } of bindings) {
    expect(el.classList.contains(utility), `${binding} → ${utility}`).toBe(true);
    expect(await ruleOf(utility), utility).toContain(css);
  }
}

const locale = (lang: "pt" | "en") =>
  JSON.parse(readFileSync(resolve(process.cwd(), `src/lib/i18n/locales/${lang}.json`), "utf8"));

const NAMES_EN = ["System", "Ink blue", "Leaf green", "Turquoise", "Orange", "Yellow", "Pink", "Violet"];
const NAMES_PT = ["Sistema", "Azul-tinta", "Verde-folha", "Turquesa", "Laranja", "Amarelo", "Rosa", "Violeta"];

/** Renders the fixture, whose own state is bound as `<SwatchGroup bind:value />`; `bound` follows it. */
function renderBound(initial: SwatchValue = "system", extra: Record<string, unknown> = {}) {
  const bound = { value: initial };
  render(Fixture, { props: { value: initial, ...extra, onbound: (v: SwatchValue) => (bound.value = v) } });
  const group = document.querySelector<HTMLElement>('[data-slot="swatch-group"]');
  if (!group) throw new Error("no swatch group rendered");
  const swatches = screen.getAllByRole("radio");
  return { group, swatches, bound };
}

const tooltip = () =>
  document.querySelector<HTMLElement>('[data-slot="tooltip-content"]:not([data-state="closed"])');

const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

// Componentes (D7) · 13 · Amostra de cor (56:5146): eight 18 × 18 swatches, spacing/2 apart.
const GROUP_BINDINGS: Binding[] = [
  { binding: "spacing/2 (gap)", utility: "gap-2", css: "gap: calc(var(--spacing) * 2);" },
];
// The swatch is the 20 × 20 radio, the click area; its 18 × 18 visual paints the fill and the rings.
const TARGET_BINDINGS: Binding[] = [
  {
    binding: "click area 20 × 20",
    utility: "size-5",
    css: "width: calc(var(--spacing) * 5);\n    height: calc(var(--spacing) * 5);",
  },
  { binding: "laid out as 18 × 18, so the row keeps gap-2", utility: "-m-px", css: "margin: -1px;" },
  // Selecionada (Seleção, 22 × 22 at −2, outside stroke): from the 20 × 20 target, 3 px out.
  {
    binding: "Seleção: 22 × 22 + 2 px out",
    utility: "data-checked:after:-inset-0.75",
    css: "inset: calc(var(--spacing) * -0.75);",
  },
  { binding: "Seleção: round", utility: "data-checked:after:rounded-full", css: "border-radius: var(--radius-full);" },
  {
    binding: "Seleção: stroke/swatch",
    utility: "data-checked:after:border-(length:--stroke-swatch)",
    css: "border-width: var(--stroke-swatch);",
  },
  {
    binding: "Seleção: foreground",
    utility: "data-checked:after:border-foreground",
    css: "border-color: var(--foreground);",
  },
  {
    binding: "Seleção: not hit-testable",
    utility: "data-checked:after:pointer-events-none",
    css: "pointer-events: none;",
  },
];
const SWATCH_BINDINGS: Binding[] = [
  { binding: "18 × 18", utility: "size-4.5", css: "width: calc(var(--spacing) * 4.5);" },
  { binding: "radius 9 (round)", utility: "rounded-full", css: "border-radius: var(--radius-full);" },
  {
    binding: "not hit-testable: the target is the radio",
    utility: "pointer-events-none",
    css: "pointer-events: none;",
  },
  {
    binding: "Foco: stroke/ring outside, ring at ring-opacity, flush on the 18 × 18",
    utility: "group-focus-visible/swatch:focus-ring",
    css: "outline: var(--stroke-ring) solid",
  },
];
const visual = (swatch: HTMLElement) => {
  const el = [...swatch.children].find(
    (child): child is HTMLElement => child instanceof HTMLElement && child.dataset.slot === "swatch-visual",
  );
  if (!el) throw new Error("no swatch visual");
  return el;
};
const SISTEMA_BINDINGS: Binding[] = [
  { binding: "Sistema: background (fill)", utility: "bg-background", css: "background-color: var(--background);" },
  {
    binding: "Sistema: stroke/swatch (inside)",
    utility: "border-(length:--stroke-swatch)",
    css: "border-width: var(--stroke-swatch);",
  },
  { binding: "Sistema: primary (stroke)", utility: "border-primary", css: "border-color: var(--primary);" },
];
const DOT_BINDINGS: Binding[] = [
  { binding: "Ponto: 6 × 6", utility: "size-1.5", css: "width: calc(var(--spacing) * 1.5);" },
  { binding: "Ponto: round", utility: "rounded-full", css: "border-radius: var(--radius-full);" },
  { binding: "Ponto: primary (fill)", utility: "bg-primary", css: "background-color: var(--primary);" },
];

describe("SwatchGroup", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("radiogroup_named_cor_de_destaque", async () => {
    const { group, swatches } = renderBound();
    expect(screen.getByRole("radiogroup", { name: "Accent color" })).toBe(group);
    expect(swatches).toHaveLength(8);
    expect(swatches[0].getAttribute("aria-checked")).toBe("true");
    for (const s of swatches.slice(1)) expect(s.getAttribute("aria-checked")).toBe("false");
    await expectBindings(group, GROUP_BINDINGS);
    // The approved text, word for word, in both languages.
    expect(locale("pt").settings.accent.label).toBe("Cor de destaque");
    expect(locale("en").settings.accent.label).toBe("Accent color");
  });

  it("each_swatch_has_name_and_tooltip", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { swatches } = renderBound();
    expect(swatches.map((s) => s.getAttribute("aria-label"))).toEqual(NAMES_EN);
    for (const [i, swatch] of swatches.entries()) {
      expect(swatch.textContent?.trim()).toBe("");
      await user.hover(swatch);
      await vi.advanceTimersByTimeAsync(500);
      await waitFor(() => expect(tooltip()?.textContent).toBe(NAMES_EN[i]));
      await user.unhover(swatch);
      await vi.advanceTimersByTimeAsync(500);
    }
    const pt = locale("pt").settings.accent;
    expect([pt.system, ...Object.values(pt.swatches)]).toEqual(NAMES_PT);
    const en = locale("en").settings.accent;
    expect([en.system, ...Object.values(en.swatches)]).toEqual(NAMES_EN);
    expect(pt.hint).toBe("Sistema usa a cor escolhida no macOS.");
  });

  it("arrows_select", async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    const { swatches, bound } = renderBound("system", { onValueChange: changed });
    await user.tab();
    expect(document.activeElement).toBe(swatches[0]);
    expect(describedBy(swatches[0])).toBe("System");
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(swatches[1]);
    expect(bound.value).toBe("azul-tinta");
    expect(changed).toHaveBeenLastCalledWith("azul-tinta");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(bound.value).toBe("turquesa");
    await user.keyboard("{ArrowLeft}");
    expect(bound.value).toBe("verde-folha");
    expect(swatches[2].getAttribute("aria-checked")).toBe("true");
    // It wraps, as the macOS row does not end in a dead key.
    await user.keyboard("{ArrowLeft}{ArrowLeft}{ArrowLeft}");
    expect(bound.value).toBe("violeta");
    await user.click(swatches[5]);
    expect(bound.value).toBe("amarelo");
    // One Tab stop: the selected swatch.
    expect(swatches.filter((s) => s.getAttribute("tabindex") === "0")).toEqual([swatches[5]]);
  });

  it("swatch_classes_are_compiled", async () => {
    expect(Object.keys(SWATCH_BG)).toEqual([...SWATCH_NAMES]);
    // Scan the production sources as the Vite plugin does, then compile what it finds.
    const { sources } = await compileAppCss([]);
    const candidates = new Scanner({ sources }).scan();
    const { css } = await compileAppCss(candidates);
    for (const [name, utility] of Object.entries(SWATCH_BG)) {
      expect(utility).toBe(`bg-swatch-${name}`);
      expect(candidates, utility).toContain(utility);
      expect(css, utility).toContain(`.${utility} {\n    background-color: var(--swatch-${name});`);
    }
    // Each colour swatch carries its own class.
    const { swatches } = renderBound();
    for (const [i, name] of SWATCH_NAMES.entries()) {
      const swatch = swatches[i + 1];
      expect(visual(swatch).classList.contains(SWATCH_BG[name]), name).toBe(true);
      await expectBindings(swatch, TARGET_BINDINGS);
      await expectBindings(visual(swatch), SWATCH_BINDINGS);
      expect(swatch.querySelector('[data-slot="swatch-dot"]')).toBeNull();
    }
  });

  it("system_swatch_has_ring_and_dot", async () => {
    const { swatches } = renderBound("verde-folha");
    const system = swatches[0];
    await expectBindings(system, TARGET_BINDINGS);
    await expectBindings(visual(system), [...SWATCH_BINDINGS, ...SISTEMA_BINDINGS]);
    // The stroke is on the visual, so the 20 × 20 target and the ring do not move with it.
    expect(system.className).not.toMatch(/(^|\s)border/);
    const dot = visual(system).querySelector<HTMLElement>('[data-slot="swatch-dot"]');
    if (!dot) throw new Error("no dot");
    await expectBindings(dot, DOT_BINDINGS);
    expect(dot.getAttribute("aria-hidden")).toBe("true");
    // No motion: the colour applies at once.
    for (const s of [...swatches, ...swatches.map(visual)])
      expect([...s.classList].filter((c) => /(^|:)(transition|duration|animate)/.test(c))).toEqual([]);
    // The selection ring follows the radio's own state, not the tooltip trigger's.
    expect(system.getAttribute("data-state")).toBe("unchecked");
    expect(swatches[2].getAttribute("data-state")).toBe("checked");
  });

  it("disabled_keeps_value", async () => {
    const changed = vi.fn();
    const { swatches, bound } = renderBound("turquesa", {
      disabled: true,
      disabledReason: "Not available",
      onValueChange: changed,
    });
    const selected = swatches[3];
    await expectDisabledInert({
      control: selected,
      read: () => bound.value,
      callback: changed,
      reason: "Not available",
    });
    for (const s of swatches) {
      expect(s.getAttribute("aria-disabled")).toBe("true");
      expect(s.hasAttribute("disabled")).toBe(false);
    }
    // The arrows move focus to read the other names and the reason, but choose nothing.
    const user = userEvent.setup();
    selected.focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(swatches[4]);
    expect(swatches[4].getAttribute("aria-label")).toBe(NAMES_EN[4]);
    await waitFor(() => expect(describedBy(swatches[4])).toContain("Not available"));
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(document.activeElement).toBe(swatches[2]);
    // It wraps, as when enabled.
    await user.keyboard("{Home}{ArrowLeft}");
    expect(document.activeElement).toBe(swatches[7]);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(swatches[0]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(swatches[7]);
    expect(bound.value).toBe("turquesa");
    expect(changed).not.toHaveBeenCalled();
    for (const [i, s] of swatches.entries()) expect(s.getAttribute("aria-checked")).toBe(String(i === 3));
    await user.click(swatches[1]);
    expect(bound.value).toBe("turquesa");
  });
});
