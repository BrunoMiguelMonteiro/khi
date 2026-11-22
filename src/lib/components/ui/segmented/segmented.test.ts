import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { compileAppCss } from "$lib/test/css";
import Fixture from "./segmented.fixture.svelte";

type Binding = { binding: string; utility: string; css: string };
type Counts = { all: number; new: number; withNotes: number };

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

/** Renders the fixture, whose own state is bound as `<Segmented bind:value />`; `bound` follows it. */
function renderBound(
  counts: Counts = { all: 9, new: 2, withNotes: 3 },
  value?: string,
  extra: { name?: string; disabled?: boolean } = {},
) {
  const bound: { value: string | undefined } = { value };
  const { rerender } = render(Fixture, {
    props: { counts, value, ...extra, onbound: (v: string | undefined) => (bound.value = v) },
  });
  const rail = document.querySelector<HTMLElement>('[data-slot="segmented"]');
  if (!rail) throw new Error("no segmented rendered");
  const [all, news, notes] = screen.getAllByRole("radio");
  return { rail, all, news, notes, bound, rerender };
}

const submitted = () =>
  new FormData(screen.getByTestId<HTMLFormElement>("filter-form")).get("filter");

const part = (segment: HTMLElement, slot: "label" | "count") =>
  segment.querySelector<HTMLElement>(`[data-slot="segment-${slot}"]`)!;

const tooltip = () =>
  document.querySelector<HTMLElement>('[data-slot="tooltip-content"]:not([data-state="closed"])');

// Componentes (D7) · 9 · Segmentado (55:2588): calha muted, padding spacing/0-5, radius/control.
const RAIL_BINDINGS: Binding[] = [
  { binding: "muted (fill)", utility: "bg-muted", css: "background-color: var(--muted);" },
  { binding: "spacing/0-5 (padding)", utility: "p-0.5", css: "padding: calc(var(--spacing) * 0.5);" },
  { binding: "radius/control", utility: "rounded-control", css: "border-radius: var(--radius-control);" },
  { binding: "three equal segments", utility: "auto-cols-fr", css: "grid-auto-columns: minmax(0, 1fr);" },
];
// Segmento (55:2574): 96 × 24, radius/segment; Rótulo gap spacing/1.
const SEGMENT_BINDINGS: Binding[] = [
  { binding: "size/segment (height)", utility: "h-segment", css: "height: var(--size-segment);" },
  { binding: "96 (minimum width)", utility: "min-w-24", css: "min-width: calc(var(--spacing) * 24);" },
  { binding: "radius/segment", utility: "rounded-segment", css: "border-radius: var(--radius-segment);" },
  { binding: "spacing/1 (Rótulo gap)", utility: "gap-1", css: "gap: var(--spacing);" },
  {
    binding: "Foco: stroke/ring outside, ring at ring-opacity",
    utility: "focus-visible:focus-ring",
    css: ":focus-visible {\n    outline: var(--stroke-ring) solid",
  },
  {
    binding: "fill change in duration/hover",
    utility: "duration-(--duration-hover)",
    css: "transition-duration: var(--duration-hover);",
  },
  { binding: "ease/hover", utility: "ease-hover", css: "transition-timing-function: var(--ease-hover);" },
];
const SELECIONADO_BINDINGS: Binding[] = [
  {
    binding: "Selecionado: segmented-selected (fill)",
    utility: "bg-segmented-selected",
    css: "background-color: var(--segmented-selected);",
  },
  { binding: "Selecionado: Sombra/Segmento", utility: "shadow-sombra-segmento", css: "--tw-shadow: 0 1px 2px var(--tw-shadow-color, rgb(0 0 0 / 0.12));" },
];
const TEXT_BINDINGS: Binding[] = [
  { binding: "Texto: Interface/Callout", utility: "text-callout", css: "font-size: 12px;\n    line-height: 15px;\n    font-weight: 400;" },
  { binding: "Texto: foreground (fill)", utility: "text-foreground", css: "color: var(--foreground);" },
];
const COUNT_BINDINGS: Binding[] = [
  { binding: "Contagem: Interface/Callout", utility: "text-callout", css: "font-size: 12px;\n    line-height: 15px;\n    font-weight: 400;" },
  {
    binding: "Contagem: tertiary-foreground (fill)",
    utility: "text-tertiary-foreground",
    css: "color: var(--tertiary-foreground);",
  },
  { binding: "tabular figures", utility: "tabular-nums", css: "--tw-numeric-spacing: tabular-nums;" },
];

describe("Segmented", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("radiogroup_named_mostrar", () => {
    const { rail, all, news, notes, bound } = renderBound();
    expect(screen.getByRole("radiogroup", { name: "Show" })).toBe(rail);
    expect(rail.getAttribute("aria-orientation") ?? "horizontal").toBe("horizontal");
    // Todos by default.
    expect(bound.value).toBe("all");
    expect([all, news, notes].map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    expect(locale("pt").ui.segmented.label).toBe("Mostrar");
    expect(locale("en").ui.segmented.label).toBe("Show");
  });

  it("segment_name_includes_count", () => {
    const { all, news, notes } = renderBound();
    expect(screen.getByRole("radio", { name: "All, 9" })).toBe(all);
    expect(screen.getByRole("radio", { name: "New, 2" })).toBe(news);
    expect(screen.getByRole("radio", { name: "With notes, 3" })).toBe(notes);
    expect([part(news, "label").textContent, part(news, "count").textContent]).toEqual(["New", "2"]);
    const pt = locale("pt").ui.segmented;
    expect([pt.all, pt.new, pt.withNotes]).toEqual(["Todos", "Novos", "Com notas"]);
    const en = locale("en").ui.segmented;
    expect([en.all, en.new, en.withNotes]).toEqual(["All", "New", "With notes"]);
  });

  it("arrows_select_and_skip_zero_count_segment", async () => {
    const user = userEvent.setup();
    const { all, news, notes, bound } = renderBound({ all: 5, new: 0, withNotes: 5 });
    await user.tab();
    expect(document.activeElement).toBe(all);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(notes);
    expect(bound.value).toBe("withNotes");
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(all);
    expect(bound.value).toBe("all");
    await user.keyboard("{ArrowLeft}");
    expect(bound.value).toBe("withNotes");
    expect(news.getAttribute("aria-checked")).toBe("false");
  });

  it("clicking_selected_keeps_value", async () => {
    const user = userEvent.setup();
    const { all, notes, bound } = renderBound();
    await user.click(all);
    expect(bound.value).toBe("all");
    await user.click(notes);
    expect(bound.value).toBe("withNotes");
    await user.click(notes);
    expect(bound.value).toBe("withNotes");
    await user.keyboard(" ");
    expect(bound.value).toBe("withNotes");
    expect(notes.getAttribute("aria-checked")).toBe("true");
  });

  it("single_tab_stop", async () => {
    const user = userEvent.setup();
    const { all, news, notes } = renderBound(undefined, "new");
    expect([all, news, notes].map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    await user.tab();
    expect(document.activeElement).toBe(news);
    await user.tab();
    expect([all, news, notes]).not.toContain(document.activeElement);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(news);
  });

  it("zero_count_segment_cannot_be_selected", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { news, bound } = renderBound({ all: 5, new: 0, withNotes: 5 });
    expect(news.getAttribute("aria-disabled")).toBe("true");
    expect(news.hasAttribute("data-disabled")).toBe(true);
    expect(news.getAttribute("tabindex")).toBe("-1");
    expect(screen.getByRole("radio", { name: "New, 0" })).toBe(news);
    await user.click(news);
    expect(bound.value).toBe("all");
    expect(news.getAttribute("aria-checked")).toBe("false");
    expect(document.activeElement).not.toBe(news);
    // Native disabled would swallow the pointer, and with it the tooltip.
    expect(news.hasAttribute("disabled")).toBe(false);
    // After the click, which closes a tooltip, the pointer leaves and comes back.
    await user.unhover(news);
    await user.hover(news);
    await vi.advanceTimersByTimeAsync(500);
    await tick();
    expect(tooltip()?.textContent).toBe("No new highlights in this book");
    for (const slot of ["label", "count"] as const) {
      const el = part(news, slot);
      expect(el.classList.contains("text-disabled-foreground"), slot).toBe(true);
      expect(await ruleOf("text-disabled-foreground")).toContain("color: var(--disabled-foreground);");
    }
    const pt = locale("pt").ui.segmented;
    expect([pt.noNew, pt.noNotes]).toEqual([
      "Não há destaques novos neste livro",
      "Não há destaques com notas neste livro",
    ]);
    const en = locale("en").ui.segmented;
    expect([en.noNew, en.noNotes]).toEqual(["No new highlights in this book", "No highlights with notes in this book"]);
  });

  it("selected_uses_segmented_selected_and_shadow", async () => {
    const { rail, all, news } = renderBound();
    await expectBindings(rail, RAIL_BINDINGS);
    for (const segment of [all, news]) await expectBindings(segment, SEGMENT_BINDINGS);
    await expectBindings(all, SELECIONADO_BINDINGS);
    for (const utility of ["bg-segmented-selected", "shadow-sombra-segmento"])
      expect(news.classList.contains(utility), utility).toBe(false);
    // Texto: Callout Medium when selected, Callout otherwise; never semibold.
    await expectBindings(part(news, "label"), TEXT_BINDINGS);
    expect(part(all, "label").classList.contains("text-callout-medium")).toBe(true);
    expect(await ruleOf("text-callout-medium")).toContain("font-size: 12px;\n    line-height: 15px;\n    font-weight: 500;");
    expect(part(all, "label").classList.contains("text-callout")).toBe(false);
    expect(part(news, "label").classList.contains("text-callout-medium")).toBe(false);
    for (const el of [rail, all, news, part(all, "label"), part(all, "count")])
      expect([...el.classList].filter((c) => /font-(semibold|bold)/.test(c))).toEqual([]);
    await expectBindings(part(news, "count"), COUNT_BINDINGS);
    // The fill changes without sliding: no indicator of its own.
    expect(rail.querySelectorAll("[data-slot]").length).toBe(9);
    expect([...all.classList].filter((c) => /translate|animate/.test(c))).toEqual([]);
  });

  it("matches_figma_sample", async () => {
    const sample = JSON.parse(readFileSync(resolve(process.cwd(), "design/components-sample.json"), "utf8"))[
      "segment-selected-count"
    ];
    expect(sample.figma).toMatch(/^55:2588 › Segmento escolhido/);
    const { all, news } = renderBound();
    const expected: [HTMLElement, string][] = [
      [all, `bg-${sample.segment.fill}`],
      [part(all, "label"), `text-${sample.text.fill}`],
      [part(all, "count"), `text-${sample.count.fill}`],
      [part(news, "count"), `text-${sample["unselected-count"].fill}`],
    ];
    for (const [el, utility] of expected) {
      expect(el.classList.contains(utility), utility).toBe(true);
      expect(await ruleOf(utility), utility).toMatch(/(background-color|color): var\(--/);
    }
    expect(part(all, "count").classList.contains("text-tertiary-foreground")).toBe(false);
  });

  it("no_hover_class_on_segments", () => {
    const { rail } = renderBound({ all: 5, new: 0, withNotes: 5 });
    const els = [rail, ...rail.querySelectorAll<HTMLElement>("*")];
    expect(els.flatMap((el) => [...el.classList].filter((c) => /(^|:)(hover|active):/.test(c)))).toEqual([]);
  });

  it("selected_has_contrast_outline", async () => {
    const { all, news } = renderBound();
    await expectBindings(all, [
      { binding: "stroke/border (inside)", utility: "inset-ring", css: "inset 0 0 0 1px" },
      {
        binding: "Selecionado: contrast-outline-strong (stroke)",
        utility: "inset-ring-contrast-outline-strong",
        css: "--tw-inset-ring-color: var(--contrast-outline-strong);",
      },
    ]);
    // Only the selected one is outlined, never through contrast-more:.
    expect([...news.classList].filter((c) => c.includes("inset-ring"))).toEqual([]);
    expect([...all.classList].filter((c) => c.includes("contrast-more"))).toEqual([]);
  });

  it("zero_count_value_falls_back_to_first_enabled_segment", async () => {
    // A parent that assigns an empty segment, at first and later.
    const { all, news, notes, bound, rerender } = renderBound({ all: 5, new: 0, withNotes: 5 }, "new", {
      name: "filter",
    });
    await tick();
    expect(bound.value).toBe("all");
    expect(submitted()).toBe("all");
    expect([all, news, notes].map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    await rerender({ value: "withNotes" });
    expect(bound.value).toBe("withNotes");
    await rerender({ value: "new" });
    await tick();
    expect(bound.value).toBe("all");
    expect(submitted()).toBe("all");
    expect(news.getAttribute("aria-checked")).toBe("false");
    expect([all, news, notes].map((r) => r.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
  });

  it("selected_segment_whose_count_drops_to_zero_is_left", async () => {
    const user = userEvent.setup();
    const { all, news, notes, bound, rerender } = renderBound({ all: 5, new: 2, withNotes: 0 }, "new", {
      name: "filter",
    });
    expect(submitted()).toBe("new");
    // The last new highlight is read: Novos empties while chosen.
    await rerender({ counts: { all: 5, new: 0, withNotes: 0 } });
    await tick();
    expect(bound.value).toBe("all");
    expect(submitted()).toBe("all");
    expect([all, news, notes].map((r) => r.getAttribute("aria-checked"))).toEqual(["true", "false", "false"]);
    await user.tab();
    expect(document.activeElement).toBe(all);
    // Nothing left to choose: the value clears.
    await rerender({ counts: { all: 0, new: 0, withNotes: 0 } });
    await tick();
    expect(bound.value).toBeUndefined();
    expect(submitted() ?? "").toBe("");
    expect([all, news, notes].map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "false", "false"]);
  });

  it("disabled_group_refuses_click_and_keyboard", async () => {
    const user = userEvent.setup();
    const { all, news, notes, bound } = renderBound(undefined, undefined, { disabled: true });
    expect(bound.value).toBe("all");
    for (const segment of [all, news, notes]) expect(segment.hasAttribute("disabled"), segment.textContent!).toBe(true);
    await user.click(notes);
    expect(bound.value).toBe("all");
    expect(notes.getAttribute("aria-checked")).toBe("false");
    await user.tab();
    expect([all, news, notes]).not.toContain(document.activeElement);
    all.focus();
    await user.keyboard("{ArrowRight} ");
    expect(bound.value).toBe("all");
  });
});
