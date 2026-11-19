import { describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import Download from "lucide-svelte/icons/download";
import { compileAppCss, selectorFor } from "$lib/test/css";
import { expectDisabledInert } from "$lib/test/disabled";
import { Button } from "./index";
import Fixture from "./button.fixture.svelte";

type Binding = { binding: string; utility: string; css: string };

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

function renderButton(props: Record<string, unknown> = {}) {
  render(Fixture, { props });
  const button = document.querySelector('[data-slot="button"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error("no button rendered");
  return button;
}

async function expectBindings(button: HTMLElement, bindings: Binding[]) {
  for (const { binding, utility, css } of bindings) {
    expect(button.classList.contains(utility), `${binding} → ${utility}`).toBe(true);
    expect(await ruleOf(utility), utility).toContain(css);
  }
}

const tooltip = () =>
  document.querySelector<HTMLElement>('[data-slot="tooltip-content"]:not([data-state="closed"])');

const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

/** Fill, stroke and text colour classes, whatever their variants: nothing beyond the Figma's. */
const colourClasses = (button: HTMLElement) =>
  [...button.classList]
    .filter((c) => /(^|:)(bg|border|text|inset-ring)-(?!body-medium$|\()/.test(c))
    .sort();

// Componentes (D7) · 2 · Botão (55:787), every variant: each Figma binding and the one class that carries it.
const COMMON_BINDINGS: Binding[] = [
  { binding: "size/control (height)", utility: "h-control", css: "height: var(--size-control);" },
  // Figma binds spacing/4 to paddingLeft/paddingRight only.
  {
    binding: "spacing/4 (left, right)",
    utility: "px-4",
    css: "padding-inline: calc(var(--spacing) * 4);",
  },
  { binding: "spacing/2 (item spacing)", utility: "gap-2", css: "gap: calc(var(--spacing) * 2);" },
  {
    binding: "radius/control",
    utility: "rounded-control",
    css: "border-radius: var(--radius-control);",
  },
  {
    binding: "Interface/Body Medium",
    utility: "text-body-medium",
    css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 500;",
  },
  {
    binding: "Foco: stroke/ring outside, ring at ring-opacity",
    utility: "focus-visible:focus-ring",
    css: ":focus-visible {\n    outline: var(--stroke-ring) solid",
  },
  // Hover and press: the fill changes in duration/hover with ease/hover; nothing else animates.
  {
    binding: "transition: background colour only",
    utility: "transition-[background-color]",
    css: "transition-property: background-color;",
  },
  {
    binding: "duration/hover",
    utility: "duration-(--duration-hover)",
    css: "transition-duration: var(--duration-hover);",
  },
  {
    binding: "ease/hover",
    utility: "ease-hover",
    css: "transition-timing-function: var(--ease-hover);",
  },
  {
    binding: "Premido: no transition (Phase 2 common rule)",
    utility: "not-data-disabled:active:transition-none",
    css: "transition-property: none;",
  },
];

const PRINCIPAL_BINDINGS: Binding[] = [
  { binding: "Normal: primary (fill)", utility: "bg-primary", css: "background-color: var(--primary);" },
  {
    binding: "primary-foreground (text)",
    utility: "text-primary-foreground",
    css: "color: var(--primary-foreground);",
  },
  {
    binding: "Hover: primary-hover (fill)",
    utility: "not-data-disabled:hover:bg-primary-hover",
    css: "background-color: var(--primary-hover);",
  },
  {
    binding: "Premido: primary-pressed (fill)",
    utility: "not-data-disabled:active:bg-primary-pressed",
    css: "background-color: var(--primary-pressed);",
  },
  {
    binding: "Desativado: primary-disabled (fill)",
    utility: "data-disabled:bg-primary-disabled",
    css: "background-color: var(--primary-disabled);",
  },
  {
    binding: "Desativado: disabled-foreground (text)",
    utility: "data-disabled:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
  // Tema 3: 1 px inside stroke (stroke/border), transparent outside the contrast modes.
  { binding: "stroke/border (inside)", utility: "inset-ring", css: "inset 0 0 0 1px" },
  {
    binding: "contrast-outline-primary",
    utility: "inset-ring-contrast-outline-primary",
    css: "--tw-inset-ring-color: var(--contrast-outline-primary);",
  },
  {
    binding: "Desativado: no contrast outline",
    utility: "data-disabled:inset-ring-transparent",
    css: "--tw-inset-ring-color: transparent;",
  },
];

const SECUNDARIO_BINDINGS: Binding[] = [
  {
    binding: "Normal: background (fill)",
    utility: "bg-background",
    css: "background-color: var(--background);",
  },
  // Stroke INSIDE: a CSS border sits inside the 28 px box (border-box).
  {
    binding: "stroke/border (inside)",
    utility: "border-(length:--stroke-border)",
    css: "border-width: var(--stroke-border);",
  },
  {
    binding: "input-strong (stroke, every state but Desativado)",
    utility: "border-input-strong",
    css: "border-color: var(--input-strong);",
  },
  { binding: "foreground (text)", utility: "text-foreground", css: "color: var(--foreground);" },
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
  {
    binding: "Desativado: disabled (fill)",
    utility: "data-disabled:bg-disabled",
    css: "background-color: var(--disabled);",
  },
  {
    binding: "Desativado: disabled-border (stroke)",
    utility: "data-disabled:border-disabled-border",
    css: "border-color: var(--disabled-border);",
  },
  {
    binding: "Desativado: disabled-foreground (text)",
    utility: "data-disabled:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
];

const LIGACAO_BINDINGS: Binding[] = [
  { binding: "link (text)", utility: "text-link", css: "color: var(--link);" },
  {
    binding: "Hover: underline",
    utility: "not-data-disabled:hover:underline",
    css: "text-decoration-line: underline;",
  },
  {
    binding: "Premido: primary-pressed (text)",
    utility: "not-data-disabled:active:text-primary-pressed",
    css: "color: var(--primary-pressed);",
  },
  {
    binding: "Desativado: disabled-foreground (text)",
    utility: "data-disabled:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
];

describe("Button", () => {
  it("principal_uses_primary_tokens_per_state", async () => {
    const button = renderButton({ variant: "principal" });
    await expectBindings(button, [...COMMON_BINDINGS, ...PRINCIPAL_BINDINGS]);
    expect(colourClasses(button)).toEqual(
      PRINCIPAL_BINDINGS.map((b) => b.utility)
        .filter((u) => u !== "inset-ring")
        .sort(),
    );
    // No stroke: the Principal has only the contrast outline.
    expect([...button.classList].filter((c) => /(^|:)border/.test(c))).toEqual([]);
  });

  it("secundario_uses_input_border_and_accent_states", async () => {
    const button = renderButton({ variant: "secundario" });
    await expectBindings(button, [...COMMON_BINDINGS, ...SECUNDARIO_BINDINGS]);
    expect(colourClasses(button)).toEqual(
      SECUNDARIO_BINDINGS.map((b) => b.utility)
        .filter((u) => !u.startsWith("border-("))
        .sort(),
    );
    // The stroke stays input-strong on hover, press and focus: no state variant touches it.
    expect(
      [...button.classList].filter((c) => /:border-/.test(c) && !c.startsWith("data-disabled:")),
    ).toEqual([]);
    // input-strong already darkens in the contrast modes, so there is no extra outline.
    expect([...button.classList].filter((c) => c.includes("inset-ring"))).toEqual([]);
  });

  it("secundario_is_the_default_variant", () => {
    const button = renderButton();
    expect(button.classList.contains("border-input-strong")).toBe(true);
    expect(button.classList.contains("bg-primary")).toBe(false);
  });

  it("ligacao_underlines_only_on_hover", async () => {
    const button = renderButton({ variant: "ligacao" });
    await expectBindings(button, [...COMMON_BINDINGS, ...LIGACAO_BINDINGS]);
    expect(colourClasses(button)).toEqual(
      LIGACAO_BINDINGS.map((b) => b.utility)
        .filter((u) => !u.endsWith("underline"))
        .sort(),
    );
    expect([...button.classList].filter((c) => c.includes("underline"))).toEqual([
      "not-data-disabled:hover:underline",
    ]);
    // Hover-only: Tailwind wraps it in (hover: hover) and in :hover.
    expect(await selectorFor("not-data-disabled:hover:underline")).toContain(":hover");
  });

  it("disabled_is_inert_and_explains_itself", async () => {
    for (const variant of ["principal", "secundario", "ligacao"] as const) {
      cleanup();
      const onclick = vi.fn();
      const onsubmit = vi.fn();
      const button = renderButton({
        variant,
        type: "submit",
        disabled: true,
        disabledReason: "Liga o Kobo para exportar",
        onclick,
        onsubmit,
      });
      // aria-disabled and not the native attribute, so it keeps its place in the Tab order.
      expect(button.disabled, variant).toBe(false);
      expect(button.hasAttribute("disabled"), variant).toBe(false);
      // The Bits UI trigger's own type="button" must not replace the caller's.
      expect(button.type, variant).toBe("submit");
      await expectDisabledInert({
        control: button,
        read: () => onsubmit.mock.calls.length,
        callback: onclick,
        reason: "Liga o Kobo para exportar",
      });
      expect(onsubmit, `${variant}: the form is not submitted`).not.toHaveBeenCalled();
    }
  });

  it("enabled_click_calls_onclick", async () => {
    const user = userEvent.setup();
    const onclick = vi.fn();
    const button = renderButton({ variant: "principal", onclick });
    expect(button.type).toBe("button");
    expect(button.hasAttribute("aria-disabled")).toBe(false);
    expect(button.hasAttribute("data-disabled")).toBe(false);
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onclick).toHaveBeenCalledTimes(3);
  });

  it("disabled_wins_over_conflicting_forwarded_props", async () => {
    const user = userEvent.setup();
    const onclick = vi.fn();
    const button = renderButton({
      variant: "principal",
      disabled: true,
      disabledReason: "Sem livros",
      onclick,
      "aria-disabled": false,
      "data-disabled": undefined,
    });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    expect(button.getAttribute("data-disabled")).toBe("");
    await user.click(button);
    expect(onclick).not.toHaveBeenCalled();
    for (const state of ["data-disabled:bg-primary-disabled", "data-disabled:inset-ring-transparent"]) {
      expect(button.matches(await selectorFor(state)), state).toBe(true);
    }
  });

  it("disabled_has_no_hover_class", async () => {
    for (const variant of ["principal", "secundario", "ligacao"] as const) {
      cleanup();
      const button = renderButton({ variant, disabled: true, disabledReason: "Sem livros" });
      // Every hover and press class is gated by not-data-disabled: (checked by name: jsdom
      // gets :not(:where(…)) wrong, see selectorFor).
      const states = [...button.classList].filter((c) => /(^|:)(hover|active):/.test(c));
      expect(states.length, variant).toBeGreaterThan(0);
      for (const c of states) expect(c, variant).toMatch(/^not-data-disabled:(hover|active):/);
      for (const c of states) {
        expect(await selectorFor(c), c).toMatch(/:not\(.*\[data-disabled\]/);
      }
    }
  });

  it("focus_ring_only_on_focus_visible", async () => {
    const user = userEvent.setup();
    const button = renderButton({ variant: "secundario" });
    const focusClasses = [...button.classList].filter((c) => /(^|:)focus(-visible|-within)?:/.test(c));
    expect(focusClasses).toEqual(["focus-visible:focus-ring"]);
    const selector = await selectorFor("focus-visible:focus-ring");
    expect(selector).toContain(":focus-visible");
    expect(selector).not.toMatch(/(?<!\\):focus(?!-visible)/);
    await user.tab();
    expect(document.activeElement).toBe(button);
    expect(button.matches(selector)).toBe(true);
    // The ring is an outline; the fill, stroke and text stay as they are.
    expect(button.classList.contains("outline-none")).toBe(true);
  });

  it("principal_has_contrast_outline", async () => {
    const button = renderButton({ variant: "principal", class: "ml-2" });
    const classes = [...button.classList];
    expect(classes).toContain("ml-2");
    // Tema 3: always drawn; contrast-outline-primary is transparent outside the Figma contrast
    // modes, so no contrast-more: variant. Desativado has no outline.
    expect(classes.filter((c) => c.includes("inset-ring")).sort()).toEqual([
      "data-disabled:inset-ring-transparent",
      "inset-ring",
      "inset-ring-contrast-outline-primary",
    ]);
    expect(classes.filter((c) => c.includes("contrast-more"))).toEqual([]);
    expect(button.matches(await selectorFor("data-disabled:inset-ring-transparent"))).toBe(false);
  });

  it("icon_sits_left_at_16_and_is_hidden_by_default", () => {
    const plain = renderButton({ variant: "principal" });
    expect(plain.querySelector("svg")).toBeNull();
    cleanup();
    const button = renderButton({ variant: "principal", icon: Download, text: "Exportar" });
    const svg = button.firstElementChild;
    expect(svg?.tagName.toLowerCase()).toBe("svg");
    expect(svg?.classList.contains("size-icon")).toBe(true);
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Exportar" })).toBe(button);
  });

  it("toggling_disabled_keeps_the_node_and_focus", async () => {
    const props = { variant: "principal" as const, disabledReason: "Liga o Kobo para exportar" };
    const { rerender } = render(Fixture, { props: { ...props, disabled: false } });
    const button = document.querySelector<HTMLButtonElement>('[data-slot="button"]')!;
    button.focus();
    await rerender({ ...props, disabled: true });
    expect(document.querySelector('[data-slot="button"]')).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute("aria-disabled")).toBe("true");
    // Focused as it becomes disabled: the reason is exposed without moving focus.
    await waitFor(() => expect(describedBy(button)).toBe("Liga o Kobo para exportar"));
    await rerender({ ...props, disabled: false });
    expect(document.querySelector('[data-slot="button"]')).toBe(button);
    expect(document.activeElement).toBe(button);
    expect(button.hasAttribute("aria-disabled")).toBe(false);
    await waitFor(() => expect(tooltip()).toBeNull());
    expect(button.hasAttribute("aria-describedby")).toBe(false);
    // Enabled, the reason never shows: not on focus…
    button.blur();
    await userEvent.setup().tab();
    expect(document.activeElement).toBe(button);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(tooltip()).toBeNull();
  });

  it("without_reason_needs_no_tooltip_provider", () => {
    render(Button, { props: { disabled: true } });
    expect(document.querySelector('[data-slot="button"]')?.getAttribute("aria-disabled")).toBe("true");
  });

  it("keeps_caller_id_tabindex_and_describedby", async () => {
    for (const disabled of [false, true]) {
      cleanup();
      const button = renderButton({
        disabled,
        disabledReason: "Sem livros",
        id: "caller",
        tabindex: -1,
        "aria-describedby": "help",
      });
      expect(button.id, `disabled=${disabled}`).toBe("caller");
      expect(button.getAttribute("tabindex"), `disabled=${disabled}`).toBe("-1");
      expect(button.getAttribute("aria-describedby"), `disabled=${disabled}`).toBe("help");
      if (!disabled) continue;
      button.focus();
      await waitFor(() => expect(tooltip()).not.toBeNull());
      expect(button.getAttribute("aria-describedby")).toBe(`help ${tooltip()!.id}`);
      expect(button.id).toBe("caller");
    }
  });

  it("disabled_ignores_onclickcapture", async () => {
    for (const disabled of [true, false]) {
      cleanup();
      const user = userEvent.setup();
      const onclickcapture = vi.fn();
      const button = renderButton({ disabled, disabledReason: "Sem livros", onclickcapture });
      await user.click(button);
      expect(onclickcapture, `disabled=${disabled}`).toHaveBeenCalledTimes(disabled ? 0 : 1);
    }
  });
});
