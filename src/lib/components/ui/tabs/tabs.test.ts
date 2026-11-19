import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { tick } from "svelte";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss, selectorFor } from "$lib/test/css";
import Fixture from "./tabs.fixture.svelte";

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

/** Renders the fixture, whose own state is bound as `<Tabs bind:value />`; `bound` follows it. */
function renderBound(initial = "export") {
  const bound: { value: string | undefined } = { value: initial };
  render(Fixture, { props: { value: initial, onbound: (v: string | undefined) => (bound.value = v) } });
  const list = screen.getByRole("tablist");
  const [exportTab, appearance, kobo] = screen.getAllByRole("tab");
  return { list, exportTab, appearance, kobo, tabs: [exportTab, appearance, kobo], bound };
}

// Componentes (D7) · 12 · Separador das Definições (55:4977).
const LIST_BINDINGS: Binding[] = [
  { binding: "centred", utility: "justify-center", css: "justify-content: center;" },
  { binding: "spacing/1 (gap)", utility: "gap-1", css: "gap: var(--spacing);" },
  {
    binding: "filete: stroke/border, bottom only",
    utility: "border-b-(length:--stroke-border)",
    css: "border-bottom-width: var(--stroke-border);",
  },
  { binding: "filete: border (stroke)", utility: "border-border", css: "border-color: var(--border);" },
];
const TAB_BINDINGS: Binding[] = [
  { binding: "vertical", utility: "flex-col", css: "flex-direction: column;" },
  { binding: "counter axis centre", utility: "items-center", css: "align-items: center;" },
  { binding: "spacing/2 (left, right)", utility: "px-2", css: "padding-inline: calc(var(--spacing) * 2);" },
  { binding: "spacing/1 (top, bottom)", utility: "py-1", css: "padding-block: var(--spacing);" },
  { binding: "spacing/1 (gap)", utility: "gap-1", css: "gap: var(--spacing);" },
  { binding: "radius/control", utility: "rounded-control", css: "border-radius: var(--radius-control);" },
  {
    binding: "Rótulo: Interface/Subheadline (Regular in every state)",
    utility: "text-subheadline",
    css: "font-size: 11px;\n    line-height: 14px;\n    font-weight: 400;",
  },
  { binding: "Normal: muted-foreground (Rótulo)", utility: "text-muted-foreground", css: "color: var(--muted-foreground);" },
  {
    binding: "Foco: stroke/ring outside, ring at ring-opacity",
    utility: "focus-visible:focus-ring",
    css: ":focus-visible {\n    outline: var(--stroke-ring) solid",
  },
];
const SELECIONADO_BINDINGS: Binding[] = [
  {
    binding: "Selecionado: primary-tint (fill)",
    utility: "data-active:bg-primary-tint",
    css: "background-color: var(--primary-tint);",
  },
  {
    binding: "Selecionado: primary-tint-foreground (Rótulo, Ícone)",
    utility: "data-active:text-primary-tint-foreground",
    css: "color: var(--primary-tint-foreground);",
  },
];
const OUTLINE_BINDINGS: Binding[] = [
  { binding: "Selecionado: stroke/border (inside)", utility: "data-active:inset-ring", css: "inset 0 0 0 1px" },
  {
    binding: "Selecionado: contrast-outline-strong (stroke)",
    utility: "data-active:inset-ring-contrast-outline-strong",
    css: "--tw-inset-ring-color: var(--contrast-outline-strong);",
  },
];
const HOVER_BINDINGS: Binding[] = [
  {
    binding: "Hover: accent (fill), never over the selected tint",
    utility: "not-data-disabled:not-data-active:hover:bg-accent",
    css: "background-color: var(--accent);",
  },
  {
    binding: "duration/hover",
    utility: "duration-(--duration-hover)",
    css: "transition-duration: var(--duration-hover);",
  },
  { binding: "ease/hover", utility: "ease-hover", css: "transition-timing-function: var(--ease-hover);" },
];

describe("Tabs", () => {
  it("tablist_single_tab_stop_and_arrows_select", async () => {
    const user = userEvent.setup();
    const { list, exportTab, appearance, kobo, tabs, bound } = renderBound();
    expect(screen.getByRole("tablist", { name: "Settings tabs" })).toBe(list);
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(["Export", "Appearance", "Kobo"]);
    expect(tabs.map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    await user.tab();
    expect(document.activeElement).toBe(exportTab);
    // Automatic activation: the arrows choose.
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(appearance);
    expect(bound.value).toBe("appearance");
    expect(appearance.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Appearance panel");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(bound.value).toBe("export");
    await user.keyboard("{ArrowLeft}");
    expect(bound.value).toBe("kobo");
    expect(document.activeElement).toBe(kobo);
    await user.tab();
    expect(tabs).not.toContain(document.activeElement);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(kobo);
    // The approved text, word for word.
    const pt = locale("pt").settings.tabs;
    expect([pt.label, pt.export, pt.appearance, pt.kobo]).toEqual([
      "Separadores das definições",
      "Exportação",
      "Aparência",
      "Kobo",
    ]);
    const en = locale("en").settings.tabs;
    expect([en.label, en.export, en.appearance, en.kobo]).toEqual(["Settings tabs", "Export", "Appearance", "Kobo"]);
  });

  it("active_variant_matches_bits_ui_state", async () => {
    const user = userEvent.setup();
    const { exportTab, appearance, kobo } = renderBound();
    expect(exportTab.getAttribute("data-state")).toBe("active");
    const fill = await selectorFor("data-active:bg-primary-tint");
    expect([exportTab, appearance, kobo].map((t) => t.matches(fill))).toEqual([true, false, false]);
    await user.click(kobo);
    expect([exportTab, appearance, kobo].map((t) => t.matches(fill))).toEqual([false, false, true]);
    // Clicking the selected tab keeps it.
    await user.click(kobo);
    expect(kobo.getAttribute("aria-selected")).toBe("true");
  });

  it("selected_uses_tint_regular_weight", async () => {
    const { list, tabs } = renderBound("appearance");
    await expectBindings(list, LIST_BINDINGS);
    // The filete is the bottom only.
    expect([...list.classList].filter((c) => /^border/.test(c)).sort()).toEqual(
      ["border-b-(length:--stroke-border)", "border-border"].sort(),
    );
    for (const tab of tabs) {
      await expectBindings(tab, [...TAB_BINDINGS, ...SELECIONADO_BINDINGS]);
      // Regular in all three states (Q-K): no weight of its own, in any state.
      expect([...tab.classList].filter((c) => /font-|semibold|medium|bold/.test(c))).toEqual([]);
    }
    // Ícone and Rótulo take the tab's colour.
    for (const el of tabs[1].querySelectorAll("*"))
      expect([...el.classList].filter((c) => /^text-(?!subheadline)/.test(c) && !c.startsWith("text-["))).toEqual([]);
  });

  it("hover_uses_accent_with_hover_duration", async () => {
    const user = userEvent.setup();
    const { exportTab, appearance, kobo } = renderBound();
    for (const tab of [exportTab, appearance]) await expectBindings(tab, HOVER_BINDINGS);
    // Hover and press are gated by not-data-disabled: (by name: jsdom gets :not(:where(…)) wrong).
    for (const c of [...appearance.classList].filter((c) => /(^|:)(hover|active):/.test(c)))
      expect(c).toMatch(/^not-data-disabled:/);
    // Only the hover fill animates: a tab with no pointer over it, or the selected one, has no
    // transition, so changing tab is instant for the old tab and the new one.
    expect([...appearance.classList].filter((c) => c.includes("transition"))).toEqual([
      "not-data-disabled:not-data-active:hover:transition-[background-color]",
    ]);
    expect(await ruleOf("not-data-disabled:not-data-active:hover:transition-[background-color]")).toContain(
      "transition-property: background-color;",
    );
    await user.click(kobo);
    expect(kobo.getAttribute("data-state")).toBe("active");
  });

  it("icon_is_20", async () => {
    const { tabs } = renderBound();
    const names = ["lucide-file-output", "lucide-palette", "lucide-tablet"];
    tabs.forEach((tab, i) => {
      const svg = tab.querySelector("svg")!;
      expect(svg.classList.contains(names[i]), names[i]).toBe(true);
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.getAttribute("width")).toBe("20");
      // The icon comes first, above the label.
      expect(tab.firstElementChild).toBe(svg);
    });
    await expectBindings(tabs[0].querySelector("svg")!, [
      { binding: "size/icon-lg", utility: "size-icon-lg", css: "width: var(--size-icon-lg);" },
    ]);
  });

  it("selected_has_contrast_outline", async () => {
    const { exportTab, appearance } = renderBound();
    for (const tab of [exportTab, appearance]) await expectBindings(tab, OUTLINE_BINDINGS);
    const ring = await selectorFor("data-active:inset-ring-contrast-outline-strong");
    expect(exportTab.matches(ring)).toBe(true);
    expect(appearance.matches(ring)).toBe(false);
    expect(appearance.matches(await selectorFor("data-active:inset-ring"))).toBe(false);
    // Only through the token, never contrast-more:.
    expect([...exportTab.classList].filter((c) => c.includes("contrast-more"))).toEqual([]);
  });

  it("no_value_selects_first_enabled_tab", async () => {
    let bound: string | undefined;
    const { unmount } = render(Fixture, { props: { onbound: (v: string | undefined) => (bound = v) } });
    await tick();
    let [exportTab, appearance, kobo] = screen.getAllByRole("tab");
    expect(bound).toBe("export");
    expect([exportTab, appearance, kobo].map((t) => t.getAttribute("aria-selected"))).toEqual(["true", "false", "false"]);
    expect([exportTab, appearance, kobo].map((t) => t.getAttribute("tabindex"))).toEqual(["0", "-1", "-1"]);
    expect(screen.getByRole("tabpanel").textContent).toContain("Export panel");
    unmount();

    // A disabled first tab is passed over.
    render(Fixture, { props: { exportDisabled: true, onbound: (v: string | undefined) => (bound = v) } });
    await tick();
    [exportTab, appearance, kobo] = screen.getAllByRole("tab");
    expect(bound).toBe("appearance");
    expect(appearance.getAttribute("aria-selected")).toBe("true");
    expect([exportTab, appearance, kobo].map((t) => t.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"]);
    expect(screen.getByRole("tabpanel").textContent).toContain("Appearance panel");
    await userEvent.setup().tab();
    expect(document.activeElement).toBe(appearance);
  });
});
