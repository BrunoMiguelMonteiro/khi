import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { compileAppCss } from "$lib/test/css";
import Fixture from "./form-fixture.svelte";

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

const slots = (name: string) => [...document.querySelectorAll<HTMLElement>(`[data-slot="${name}"]`)];

const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
    .join(" ");

// Componentes (D7) · 11 · Linha de formulário (55:3552) and Grupo de formulário (55:3553).
const ROW_BINDINGS: Binding[] = [
  { binding: "size/form-row (min height)", utility: "min-h-form-row", css: "min-height: var(--size-form-row);" },
  { binding: "spacing/4 (left, right)", utility: "px-4", css: "padding-inline: calc(var(--spacing) * 4);" },
  { binding: "spacing/2 (top, bottom)", utility: "py-2", css: "padding-block: calc(var(--spacing) * 2);" },
  { binding: "spacing/4 (gap)", utility: "gap-4", css: "gap: calc(var(--spacing) * 4);" },
];
const DIVIDER_BINDINGS: Binding[] = [
  {
    binding: "Divisória: stroke/border, inside, top only",
    utility: "border-t-(length:--stroke-border)",
    css: "border-top-width: var(--stroke-border);",
  },
  { binding: "Divisória: border (stroke)", utility: "border-border", css: "border-color: var(--border);" },
];
const LABELS_BINDINGS: Binding[] = [{ binding: "spacing/1 (gap)", utility: "gap-1", css: "gap: var(--spacing);" }];
const LABEL_BINDINGS: Binding[] = [
  { binding: "Interface/Body", utility: "text-body", css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 400;" },
  { binding: "foreground (fill)", utility: "text-foreground", css: "color: var(--foreground);" },
];
const HELP_BINDINGS: Binding[] = [
  { binding: "Interface/Callout", utility: "text-callout", css: "font-size: 12px;\n    line-height: 15px;\n    font-weight: 400;" },
  { binding: "tertiary-foreground (fill)", utility: "text-tertiary-foreground", css: "color: var(--tertiary-foreground);" },
];
const GROUP_BINDINGS: Binding[] = [{ binding: "spacing/2 (gap)", utility: "gap-2", css: "gap: calc(var(--spacing) * 2);" }];
const HEADING_BINDINGS: Binding[] = [
  { binding: "Interface/Body Semibold", utility: "text-body-semibold", css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 600;" },
  { binding: "foreground (fill)", utility: "text-foreground", css: "color: var(--foreground);" },
  { binding: "spacing/4 (left, right)", utility: "px-4", css: "padding-inline: calc(var(--spacing) * 4);" },
];
const CARD_BINDINGS: Binding[] = [
  { binding: "card (fill)", utility: "bg-card", css: "background-color: var(--card);" },
  { binding: "radius/group", utility: "rounded-group", css: "border-radius: var(--radius-group);" },
  { binding: "stroke, inside", utility: "inset-ring", css: "inset 0 0 0 1px" },
  {
    binding: "contrast-outline (stroke)",
    utility: "inset-ring-contrast-outline",
    css: "--tw-inset-ring-color: var(--contrast-outline);",
  },
];

describe("FormRow and FormGroup", () => {
  it("control_is_named_by_row_label", () => {
    render(Fixture);
    expect(screen.getByRole("switch", { name: "Mostrar capas" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Pasta dos livros" })).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: "Agrupar por série" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Formato" })).toBeTruthy();
    // The label is the row's own text, with its own id: one name, read once.
    const [label] = slots("form-row-label");
    expect(label.id).toBeTruthy();
    expect(screen.getByRole("switch").getAttribute("aria-labelledby")).toBe(label.id);
  });

  it("control_is_described_by_help", () => {
    render(Fixture);
    expect(describedBy(screen.getByRole("switch"))).toBe("Mostra a capa de cada livro na grelha.");
    expect(describedBy(screen.getByRole("checkbox"))).toBe("Junta os volumes da mesma série.");
    // Without help, nothing describes the field.
    expect(screen.getByRole("textbox").hasAttribute("aria-describedby")).toBe(false);
    expect(describedBy(screen.getByRole("combobox"))).toBe("O formato dos ficheiros exportados.");
  });

  it("divider_adds_top_border", async () => {
    render(Fixture);
    const rows = slots("form-row");
    expect(rows).toHaveLength(4);
    await expectBindings(rows[0], ROW_BINDINGS);
    expect([...rows[0].classList].filter((c) => /^border/.test(c))).toEqual([]);
    for (const row of rows.slice(1)) {
      await expectBindings(row, [...ROW_BINDINGS, ...DIVIDER_BINDINGS]);
      // Top only: no other side, and the default width is not used.
      expect([...row.classList].filter((c) => /^border/.test(c)).sort()).toEqual(
        DIVIDER_BINDINGS.map((b) => b.utility).sort(),
      );
    }
    await expectBindings(slots("form-row-labels")[0], LABELS_BINDINGS);
    for (const label of slots("form-row-label")) await expectBindings(label, LABEL_BINDINGS);
    const helps = slots("form-row-help");
    expect(helps).toHaveLength(3);
    for (const help of helps) await expectBindings(help, HELP_BINDINGS);
  });

  it("group_card_has_no_border_but_contrast_outline", async () => {
    render(Fixture);
    const [group] = slots("form-group");
    await expectBindings(group, GROUP_BINDINGS);
    const heading = screen.getByRole("heading", { name: "Biblioteca" });
    expect(heading.dataset.slot).toBe("form-group-heading");
    await expectBindings(heading, HEADING_BINDINGS);
    // The group is the region its heading names.
    expect(group.getAttribute("aria-labelledby")).toBe(heading.id);
    const [card] = slots("form-group-card");
    await expectBindings(card, CARD_BINDINGS);
    expect([...card.classList].filter((c) => /^(border|ring|outline|shadow|contrast-more)/.test(c) || c.includes(":"))).toEqual(
      [],
    );
    // contrast-outline is transparent outside the contrast modes, so the outline only shows there.
    const tokens = (await compileAppCss(["inset-ring-contrast-outline"])).css;
    expect(tokens).toMatch(/--contrast-outline: #00000000;/);
  });

  it("group_without_heading_has_no_heading", () => {
    render(Fixture, { props: { heading: "" } });
    expect(screen.queryByRole("heading")).toBeNull();
    expect(slots("form-group")[0].hasAttribute("aria-labelledby")).toBe(false);
  });
});
