import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss } from "$lib/test/css";
import { buttonVariants } from "../button";
import { toolbarButtonVariants } from "../toolbar-button";
import Fixture from "./view-group.fixture.svelte";

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

/** Renders the fixture, whose own state is bound as `<ViewGroup bind:value />`; `bound` follows it. */
function renderBound(initial: "grid" | "list" = "grid") {
  const bound = { value: initial };
  render(Fixture, { props: { value: initial, onbound: (v: "grid" | "list") => (bound.value = v) } });
  const group = document.querySelector<HTMLElement>('[data-slot="view-group"]');
  if (!group) throw new Error("no view group rendered");
  const grid = screen.getByRole("radio", { name: "View as grid" });
  const list = screen.getByRole("radio", { name: "View as list" });
  return { group, grid, list, bound };
}

const tooltip = () =>
  document.querySelector<HTMLElement>('[data-slot="tooltip-content"]:not([data-state="closed"])');

const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

const sorted = (classes: string) => classes.split(/\s+/).filter(Boolean).sort();

// Componentes (D7) · 8 · Grupo de vista (55:2440): two Botão de toolbar instances (55:1346), gap spacing/1.
const GROUP_BINDINGS: Binding[] = [
  { binding: "spacing/1 (gap)", utility: "gap-1", css: "gap: var(--spacing);" },
];
const BUTTON_BINDINGS: Binding[] = [
  {
    binding: "size/toolbar-button (width and height)",
    utility: "size-toolbar-button",
    css: "width: var(--size-toolbar-button);\n    height: var(--size-toolbar-button);",
  },
  { binding: "radius/control", utility: "rounded-control", css: "border-radius: var(--radius-control);" },
  { binding: "stroke/border (inside)", utility: "inset-ring", css: "inset 0 0 0 1px" },
  {
    binding: "Foco: stroke/ring outside, ring at ring-opacity",
    utility: "focus-visible:focus-ring",
    css: ":focus-visible {\n    outline: var(--stroke-ring) solid",
  },
];
const SELECIONADO_BINDINGS: Binding[] = [
  { binding: "Selecionado: primary-tint (fill)", utility: "bg-primary-tint", css: "background-color: var(--primary-tint);" },
  {
    binding: "Selecionado: primary-tint-foreground (icon)",
    utility: "text-primary-tint-foreground",
    css: "color: var(--primary-tint-foreground);",
  },
  {
    binding: "Selecionado: contrast-outline-tint (stroke, inside)",
    utility: "inset-ring-contrast-outline-tint",
    css: "--tw-inset-ring-color: var(--contrast-outline-tint);",
  },
];
const NORMAL_BINDINGS: Binding[] = [
  { binding: "Normal: foreground (icon)", utility: "text-foreground", css: "color: var(--foreground);" },
  {
    binding: "Normal: contrast-outline (stroke, inside)",
    utility: "inset-ring-contrast-outline",
    css: "--tw-inset-ring-color: var(--contrast-outline);",
  },
  {
    binding: "Hover: accent (fill)",
    utility: "not-data-disabled:hover:bg-accent",
    css: "background-color: var(--accent);",
  },
  {
    binding: "Premido: accent-pressed (fill)",
    utility: "not-data-disabled:active:bg-accent-pressed",
    css: "background-color: var(--accent-pressed);",
  },
];

describe("ViewGroup", () => {
  it("is_radiogroup_with_two_named_radios", () => {
    const { group, grid, list } = renderBound();
    expect(screen.getByRole("radiogroup", { name: "View" })).toBe(group);
    expect(screen.getAllByRole("radio")).toEqual([grid, list]);
    expect(grid.getAttribute("aria-checked")).toBe("true");
    expect(list.getAttribute("aria-checked")).toBe("false");
    // The names are aria-label; the 16 px icons are decorative.
    for (const radio of [grid, list]) {
      expect(radio.textContent?.trim()).toBe("");
      expect(radio.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
      expect(radio.querySelector("svg")?.classList.contains("size-icon")).toBe(true);
    }
    expect(grid.querySelector("svg")?.classList.contains("lucide-layout-grid")).toBe(true);
    expect(list.querySelector("svg")?.classList.contains("lucide-list")).toBe(true);
    // The approved text, word for word, in both languages.
    const pt = locale("pt").ui.viewGroup;
    expect([pt.label, pt.grid, pt.list]).toEqual(["Vista", "Ver em grelha", "Ver em lista"]);
    const en = locale("en").ui.viewGroup;
    expect([en.label, en.grid, en.list]).toEqual(["View", "View as grid", "View as list"]);
  });

  it("arrows_select", async () => {
    const user = userEvent.setup();
    const { grid, list, bound } = renderBound();
    await user.tab();
    expect(document.activeElement).toBe(grid);
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(list);
    expect(bound.value).toBe("list");
    expect(list.getAttribute("aria-checked")).toBe("true");
    await user.keyboard("{ArrowLeft}");
    expect(bound.value).toBe("grid");
    await user.keyboard("{ArrowDown}");
    expect(bound.value).toBe("list");
    await user.keyboard("{ArrowUp}");
    expect(bound.value).toBe("grid");
    expect(grid.getAttribute("aria-checked")).toBe("true");
  });

  it("clicking_selected_keeps_value", async () => {
    const user = userEvent.setup();
    const { grid, list, bound } = renderBound();
    await user.click(grid);
    expect(bound.value).toBe("grid");
    expect(grid.getAttribute("aria-checked")).toBe("true");
    await user.click(list);
    expect(bound.value).toBe("list");
    await user.click(list);
    expect(bound.value).toBe("list");
    expect(list.getAttribute("aria-checked")).toBe("true");
    await user.keyboard(" ");
    expect(bound.value).toBe("list");
  });

  it("single_tab_stop", async () => {
    const user = userEvent.setup();
    const { grid, list } = renderBound("list");
    expect(list.getAttribute("tabindex")).toBe("0");
    expect(grid.getAttribute("tabindex")).toBe("-1");
    await user.tab();
    expect(document.activeElement).toBe(list);
    await user.tab();
    expect(document.activeElement).not.toBe(grid);
    expect(document.activeElement).not.toBe(list);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(list);
  });

  it("selected_uses_tint_and_contrast_outline", async () => {
    const { group, grid, list } = renderBound();
    await expectBindings(group, GROUP_BINDINGS);
    // No outline, fill or animation of the group's own (55:2440).
    expect([...group.classList].filter((c) => /(^|:)(bg|border|inset-ring|ring|shadow|transition|animate)/.test(c))).toEqual([]);
    for (const radio of [grid, list]) await expectBindings(radio, BUTTON_BINDINGS);
    await expectBindings(grid, SELECIONADO_BINDINGS);
    await expectBindings(list, NORMAL_BINDINGS);
    expect(grid.classList.contains("inset-ring-contrast-outline")).toBe(false);
    expect(list.classList.contains("bg-primary-tint")).toBe(false);
    // The Botão de toolbar's own variants, not a copy.
    expect(sorted(grid.className)).toEqual(
      sorted(`${buttonVariants({ shape: "toolbar" })} ${toolbarButtonVariants({ pressed: true })}`),
    );
    expect(sorted(list.className)).toEqual(
      sorted(`${buttonVariants({ shape: "toolbar" })} ${toolbarButtonVariants({ pressed: false })}`),
    );
    expect([...grid.classList, ...list.classList].filter((c) => c.includes("contrast-more"))).toEqual([]);
    // The radio's own data-state survives the tooltip trigger's.
    expect(grid.getAttribute("data-state")).toBe("checked");
    expect(list.getAttribute("data-state")).toBe("unchecked");
    // Hover and press are gated by not-data-disabled: (by name: jsdom gets :not(:where(…)) wrong).
    const states = [...list.classList].filter((c) => /(^|:)(hover|active):/.test(c));
    expect(states.length).toBeGreaterThan(0);
    for (const c of states) expect(c).toMatch(/^not-data-disabled:(hover|active):/);
  });

  it("tooltips_show_shortcuts", async () => {
    const user = userEvent.setup();
    const { grid, list } = renderBound();
    await user.tab();
    expect(document.activeElement).toBe(grid);
    await waitFor(() => expect(tooltip()?.textContent).toBe("Grid ⌘1"));
    expect(describedBy(grid)).toBe("Grid ⌘1");
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(list);
    await waitFor(() => expect(describedBy(list)).toBe("List ⌘2"));
    // The name stays the radio's own; the tooltip only describes it.
    expect(list.getAttribute("aria-label")).toBe("View as list");
    const pt = locale("pt").ui.viewGroup;
    expect([pt.gridTooltip, pt.listTooltip]).toEqual(["Grelha", "Lista"]);
    const en = locale("en").ui.viewGroup;
    expect([en.gridTooltip, en.listTooltip]).toEqual(["Grid", "List"]);
  });
});
