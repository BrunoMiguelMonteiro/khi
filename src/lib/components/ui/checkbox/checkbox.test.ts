import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss, selectorFor } from "$lib/test/css";
import { expectDisabledInert } from "$lib/test/disabled";
import { Checkbox } from "./index";
import Fixture from "./checkbox.fixture.svelte";

type Binding = { binding: string; utility: string; css: string };

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

async function expectBindings(el: HTMLElement, bindings: Binding[]) {
  for (const { binding, utility, css } of bindings) {
    expect(el.classList.contains(utility), `${binding} → ${utility}`).toBe(true);
    expect(await ruleOf(utility), utility).toContain(css);
  }
}

/** Renders the fixture, whose own state is bound as `<Checkbox bind:checked />`; `bound` follows it. */
function renderBound(initial: boolean, props: Record<string, unknown> = {}) {
  const bound = { checked: initial };
  const result = render(Fixture, {
    props: {
      label: "Mostrar a capa",
      ...props,
      checked: initial,
      onbound: (v: boolean) => (bound.checked = v),
    },
  });
  const box = document.querySelector<HTMLElement>('[data-slot="checkbox"]');
  if (!box) throw new Error("no checkbox rendered");
  const label = document.querySelector<HTMLElement>('[data-slot="checkbox-label"]');
  return { box, label, bound, ...result };
}

/** Splits a selector list on top-level commas. */
function topLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  return [...out, cur.trim()];
}

/** One selector per branch of every `:is()`/`:where()` (compound selectors only, as Tailwind emits). */
function expand(selector: string): string[] {
  return topLevel(selector).flatMap((one) => {
    const at = one.search(/:(is|where)\(/);
    if (at < 0) return [one];
    const open = one.indexOf("(", at);
    let depth = 1;
    let end = open + 1;
    for (; depth > 0; end++) depth += one[end] === "(" ? 1 : one[end] === ")" ? -1 : 0;
    const [head, tail] = [one.slice(0, at), one.slice(end)];
    return topLevel(one.slice(open + 1, end - 1)).flatMap((branch) => expand(head + branch + tail));
  });
}

/**
 * element.matches for two stacked data-state variants: jsdom (nwsapi) gets a `:not()` nested in
 * `:is(…:where(…))` wrong, so each branch is matched on its own.
 */
const matchesStacked = (el: Element, selector: string) => expand(selector).some((s) => el.matches(s));

const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

// Componentes (D7) · 4 · Caixa (55:1684): each Figma binding and the one class that carries it.
const BOX_BINDINGS: Binding[] = [
  // 14 × 14: no size variable in the Figma; spacing 3.5 is 14 px.
  { binding: "14 × 14", utility: "size-3.5", css: "calc(var(--spacing) * 3.5)" },
  {
    binding: "radius/checkbox (every corner)",
    utility: "rounded-checkbox",
    css: "border-radius: var(--radius-checkbox);",
  },
  {
    binding: "Foco: stroke/ring outside, following radius/checkbox",
    utility: "focus-visible:focus-ring",
    css: ":focus-visible {\n    outline: var(--stroke-ring) solid",
  },
];

const UNCHECKED_BINDINGS: Binding[] = [
  {
    binding: "Desligada: background (fill)",
    utility: "bg-background",
    css: "background-color: var(--background);",
  },
  // Stroke INSIDE: a CSS border sits inside the 14 px box (border-box).
  {
    binding: "stroke/border (inside)",
    utility: "border-(length:--stroke-border)",
    css: "border-width: var(--stroke-border);",
  },
  {
    binding: "input-strong (stroke, Normal, Premido and Foco)",
    utility: "border-input-strong",
    css: "border-color: var(--input-strong);",
  },
  {
    binding: "Desligada Premido: accent-pressed (fill)",
    utility: "not-data-disabled:data-unchecked:active:bg-accent-pressed",
    css: "background-color: var(--accent-pressed);",
  },
  {
    binding: "Desligada Desativado: disabled (fill)",
    utility: "data-disabled:bg-disabled",
    css: "background-color: var(--disabled);",
  },
  {
    binding: "Desligada Desativado: disabled-border (stroke)",
    utility: "data-disabled:border-disabled-border",
    css: "border-color: var(--disabled-border);",
  },
];

const CHECKED_BINDINGS: Binding[] = [
  {
    binding: "Ligada: primary (fill)",
    utility: "data-checked:bg-primary",
    css: "background-color: var(--primary);",
  },
  { binding: "Ligada: no stroke", utility: "data-checked:border-0", css: "border-width: 0px;" },
  {
    binding: "Ligada: primary-foreground (mark stroke)",
    utility: "text-primary-foreground",
    css: "color: var(--primary-foreground);",
  },
  {
    binding: "Ligada Premido: primary-pressed (fill)",
    utility: "not-data-disabled:data-checked:active:bg-primary-pressed",
    css: "background-color: var(--primary-pressed);",
  },
  {
    binding: "Ligada Desativado: toolbar-icon-disabled (fill)",
    utility: "data-disabled:data-checked:bg-toolbar-icon-disabled",
    css: "background-color: var(--toolbar-icon-disabled);",
  },
  {
    binding: "Ligada Desativado: disabled-mark (mark stroke)",
    utility: "data-disabled:text-disabled-mark",
    css: "color: var(--disabled-mark);",
  },
];

const LABEL_BINDINGS: Binding[] = [
  {
    binding: "Interface/Body",
    utility: "text-body",
    css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 400;",
  },
  { binding: "foreground (label)", utility: "text-foreground", css: "color: var(--foreground);" },
  {
    binding: "Desativado: disabled-foreground (label)",
    utility: "data-disabled:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
];

/** Fill, stroke and text colour classes, whatever their variants: nothing beyond the Figma's. */
const colourClasses = (el: HTMLElement) =>
  [...el.classList].filter((c) => /(^|:)(bg|border|text|inset-ring)-(?!\(|body$|0$)/.test(c)).sort();

describe("Checkbox", () => {
  it("role_checkbox_with_label_name", () => {
    const { box, label } = renderBound(false);
    expect(screen.getByRole("checkbox", { name: "Mostrar a capa" })).toBe(box);
    expect(box.getAttribute("aria-checked")).toBe("false");
    // Horizontal, box then label, spacing/2 apart.
    const root = box.parentElement!;
    expect(root.classList.contains("gap-2")).toBe(true);
    expect(root.classList.contains("inline-flex")).toBe(true);
    expect(box.compareDocumentPosition(label!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("space_and_label_click_toggle", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const { box, label, bound } = renderBound(false, { onCheckedChange });
    await user.tab();
    expect(document.activeElement).toBe(box);
    await user.keyboard(" ");
    expect(bound.checked).toBe(true);
    expect(box.getAttribute("aria-checked")).toBe("true");
    await user.click(label!);
    expect(bound.checked).toBe(false);
    await user.click(box);
    expect(bound.checked).toBe(true);
    expect(onCheckedChange.mock.calls).toEqual([[true], [false], [true]]);
  });

  it("checked_variant_matches_bits_ui_state", async () => {
    const selector = await selectorFor("data-checked:bg-primary");
    const off = renderBound(false).box;
    expect(off.matches(selector)).toBe(false);
    cleanup();
    const on = renderBound(true).box;
    expect(on.matches(selector)).toBe(true);
    cleanup();
    // With a reason, the box is also the tooltip trigger, whose data-state must not replace its own.
    const explained = renderBound(true, { disabledReason: "Sem livros" }).box;
    expect(explained.getAttribute("data-state")).toBe("checked");
    expect(explained.matches(selector)).toBe(true);
    cleanup();
    const onAgain = renderBound(true).box;
    // The mark is drawn only when checked; no mixed state.
    expect(onAgain.querySelector('[data-slot="checkbox-mark"]')).not.toBeNull();
    expect(off.querySelector('[data-slot="checkbox-mark"]')).toBeNull();
  });

  it("unchecked_uses_input_strong_and_background", async () => {
    const { box, label } = renderBound(false);
    await expectBindings(box, [...BOX_BINDINGS, ...UNCHECKED_BINDINGS]);
    await expectBindings(label!, LABEL_BINDINGS);
    // The stroke stays input-strong when pressed and focused: no state variant touches it.
    expect(
      [...box.classList].filter((c) => /:border-/.test(c) && !/^data-(disabled|checked):/.test(c)),
    ).toEqual([]);
    // input-strong already darkens in the contrast modes, so there is no extra outline.
    expect([...box.classList].filter((c) => /inset-ring|contrast-more/.test(c))).toEqual([]);
  });

  it("checked_uses_primary_tokens", async () => {
    const { box } = renderBound(true);
    await expectBindings(box, [...BOX_BINDINGS, ...CHECKED_BINDINGS]);
    expect(colourClasses(box)).toEqual(
      [...UNCHECKED_BINDINGS, ...CHECKED_BINDINGS]
        .map((b) => b.utility)
        .filter((u) => !u.startsWith("border-(") && !u.endsWith("border-0"))
        .sort(),
    );
    const mark = box.querySelector<SVGElement>('[data-slot="checkbox-mark"]')!;
    // 10 × 10 check in currentColor, so the box's text colour is the mark's stroke.
    expect(mark.getAttribute("width")).toBe("10");
    expect(mark.getAttribute("height")).toBe("10");
    expect(mark.getAttribute("stroke")).toBe("currentColor");
    expect(mark.getAttribute("aria-hidden")).toBe("true");
  });

  it("press_is_instant_and_ring_is_keyboard_only", async () => {
    const user = userEvent.setup();
    const { box } = renderBound(false);
    // No hover state in the Figma, so no transition at all (Phase 2 rule: press is instant).
    expect([...box.classList].filter((c) => /transition|duration|ease|hover:/.test(c))).toEqual([]);
    const focusClasses = [...box.classList].filter((c) => /(^|:)focus(-visible|-within)?:/.test(c));
    expect(focusClasses).toEqual(["focus-visible:focus-ring"]);
    const selector = await selectorFor("focus-visible:focus-ring");
    expect(selector).not.toMatch(/(?<!\\):focus(?!-visible)/);
    await user.tab();
    expect(box.matches(selector)).toBe(true);
    expect(box.classList.contains("outline-none")).toBe(true);
    // Every press class is gated by not-data-disabled: (checked by name, see selectorFor).
    const presses = [...box.classList].filter((c) => /(^|:)active:/.test(c));
    expect(presses.length).toBe(2);
    for (const c of presses) expect(c).toMatch(/^not-data-disabled:/);
  });

  it("disabled_is_inert_and_explains_itself", async () => {
    for (const initial of [false, true]) {
      cleanup();
      const onCheckedChange = vi.fn();
      const { box, label, bound } = renderBound(initial, {
        disabled: true,
        disabledReason: "Liga o Kobo para mudar",
        onCheckedChange,
      });
      // Bits UI readonly, not native disabled: focusable, and read as dimmed rather than read-only.
      expect(box.hasAttribute("disabled")).toBe(false);
      expect(box.hasAttribute("aria-readonly")).toBe(false);
      expect(label!.hasAttribute("data-disabled")).toBe(true);
      await expectDisabledInert({
        control: box,
        label: label!,
        read: () => bound.checked,
        callback: onCheckedChange,
        reason: "Liga o Kobo para mudar",
      });
      expect(box.getAttribute("aria-checked")).toBe(String(initial));
    }
  });

  it("disabled_checked_uses_toolbar_icon_disabled_and_disabled_mark", async () => {
    const { box, label } = renderBound(true, { disabled: true, disabledReason: "Sem livros" });
    for (const state of [
      "data-disabled:data-checked:bg-toolbar-icon-disabled",
      "data-disabled:text-disabled-mark",
    ]) {
      expect(box.classList.contains(state), state).toBe(true);
      expect(matchesStacked(box, await selectorFor(state)), state).toBe(true);
    }
    expect(label!.matches(await selectorFor("data-disabled:text-disabled-foreground"))).toBe(true);
    // Neither the unchecked disabled box nor the checked enabled one takes the checked-disabled fill.
    const fill = await selectorFor("data-disabled:data-checked:bg-toolbar-icon-disabled");
    cleanup();
    expect(matchesStacked(renderBound(false, { disabled: true }).box, fill)).toBe(false);
    cleanup();
    expect(matchesStacked(renderBound(true).box, fill)).toBe(false);
    // The checked-disabled fill comes after both the checked and the disabled fills, so it wins.
    const { css } = await compileAppCss([
      "data-checked:bg-primary",
      "data-disabled:bg-disabled",
      "data-disabled:data-checked:bg-toolbar-icon-disabled",
    ]);
    const at = (c: string) => css.indexOf(`.${c.replace(/[^\w-]/g, (x) => `\\${x}`)}`);
    expect(at("data-checked:bg-primary")).toBeLessThan(at("data-disabled:data-checked:bg-toolbar-icon-disabled"));
    expect(at("data-disabled:bg-disabled")).toBeLessThan(at("data-disabled:data-checked:bg-toolbar-icon-disabled"));
  });

  it("matches_figma_sample", async () => {
    const sample = JSON.parse(
      readFileSync(resolve(process.cwd(), "design/components-sample.json"), "utf8"),
    )["checkbox-checked-disabled"];
    expect(sample.figma).toMatch(/^55:1684 › Valor=Ligada, Estado=Desativado/);
    const { box, label } = renderBound(true, { disabled: true, disabledReason: "Sem livros" });
    const mark = box.querySelector('[data-slot="checkbox-mark"]')!;
    expect(mark.getAttribute("stroke")).toBe("currentColor");
    const expected: [HTMLElement, string][] = [
      [box, `data-disabled:data-checked:bg-${sample.box.fill}`],
      [box, `data-disabled:text-${sample.mark.stroke}`],
      [label!, `data-disabled:text-${sample.label.fill}`],
    ];
    for (const [el, utility] of expected) {
      expect(el.classList.contains(utility), utility).toBe(true);
      expect(matchesStacked(el, await selectorFor(utility)), utility).toBe(true);
    }
  });

  it("toggling_disabled_keeps_the_node_and_focus", async () => {
    const props = { label: "Mostrar a capa", disabledReason: "Liga o Kobo para mudar" };
    const { rerender } = render(Fixture, { props: { ...props, disabled: false } });
    const box = document.querySelector<HTMLElement>('[data-slot="checkbox"]')!;
    box.focus();
    await rerender({ ...props, disabled: true });
    expect(document.querySelector('[data-slot="checkbox"]')).toBe(box);
    expect(document.activeElement).toBe(box);
    expect(box.getAttribute("aria-disabled")).toBe("true");
    await waitFor(() => expect(describedBy(box)).toBe("Liga o Kobo para mudar"));
    await rerender({ ...props, disabled: false });
    expect(document.querySelector('[data-slot="checkbox"]')).toBe(box);
    expect(box.hasAttribute("aria-disabled")).toBe(false);
    await waitFor(() => expect(box.hasAttribute("aria-describedby")).toBe(false));
  });

  it("without_reason_needs_no_tooltip_provider", () => {
    render(Checkbox, { props: { label: "Mostrar a capa", disabled: true } });
    const box = screen.getByRole("checkbox", { name: "Mostrar a capa" });
    expect(box.getAttribute("aria-disabled")).toBe("true");
  });

  it("disabled_wins_over_conflicting_forwarded_props", () => {
    const { box } = renderBound(false, {
      disabled: true,
      disabledReason: "Sem livros",
      "aria-disabled": false,
      "data-disabled": undefined,
      readonly: false,
    });
    expect(box.getAttribute("aria-disabled")).toBe("true");
    expect(box.getAttribute("data-disabled")).toBe("");
  });

  it("keeps_caller_labelledby_and_describedby", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<span id="row-label">Capas</span><span id="row-help">Mostra a capa na lista</span>',
    );
    const { box } = renderBound(false, {
      label: undefined,
      "aria-labelledby": "row-label",
      "aria-describedby": "row-help",
    });
    expect(screen.getByRole("checkbox", { name: "Capas" })).toBe(box);
    expect(describedBy(box)).toBe("Mostra a capa na lista");
    expect(document.querySelector('[data-slot="checkbox-label"]')).toBeNull();
    document.getElementById("row-label")?.remove();
    document.getElementById("row-help")?.remove();
  });
});
