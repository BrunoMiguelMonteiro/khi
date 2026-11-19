import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import RefreshCw from "lucide-svelte/icons/refresh-cw";
import { compileAppCss, selectorFor } from "$lib/test/css";
import { expectDisabledInert } from "$lib/test/disabled";
import Fixture from "./toolbar-button.fixture.svelte";

type Binding = { binding: string; utility: string; css: string };

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

const SYNC = { icon: RefreshCw, label: "Sincronizar", tooltip: "Sincronizar com o Kobo" };

function renderToolbarButton(props: Record<string, unknown> = {}) {
  render(Fixture, { props: { ...SYNC, ...props } });
  const button = document.querySelector('[data-slot="toolbar-button"]');
  if (!(button instanceof HTMLButtonElement)) throw new Error("no toolbar button rendered");
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

const ringClasses = (el: HTMLElement) =>
  [...el.classList].filter((c) => c.includes("inset-ring")).sort();

// Componentes (D7) · 3 · Botão de toolbar (55:1346): each Figma binding and the one class that carries it.
const FIGMA_BINDINGS: Binding[] = [
  {
    binding: "size/toolbar-button (width and height)",
    utility: "size-toolbar-button",
    css: "width: var(--size-toolbar-button);\n    height: var(--size-toolbar-button);",
  },
  {
    binding: "radius/control",
    utility: "rounded-control",
    css: "border-radius: var(--radius-control);",
  },
  { binding: "foreground (icon)", utility: "text-foreground", css: "color: var(--foreground);" },
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
  // Tema 3: 1 px inside stroke (stroke/border), transparent outside the contrast modes.
  { binding: "stroke/border (inside)", utility: "inset-ring", css: "inset 0 0 0 1px" },
  {
    binding: "contrast-outline",
    utility: "inset-ring-contrast-outline",
    css: "--tw-inset-ring-color: var(--contrast-outline);",
  },
  {
    binding: "Desativado: toolbar-icon-disabled (icon)",
    utility: "data-disabled:text-toolbar-icon-disabled",
    css: "color: var(--toolbar-icon-disabled);",
  },
  {
    binding: "Foco: stroke/ring outside, ring at ring-opacity",
    utility: "focus-visible:focus-ring",
    css: ":focus-visible {\n    outline: var(--stroke-ring) solid",
  },
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
];

const SELECIONADO_BINDINGS: Binding[] = [
  {
    binding: "Selecionado: primary-tint (fill)",
    utility: "bg-primary-tint",
    css: "background-color: var(--primary-tint);",
  },
  {
    binding: "Selecionado: primary-tint-foreground (icon)",
    utility: "text-primary-tint-foreground",
    css: "color: var(--primary-tint-foreground);",
  },
  {
    binding: "Selecionado: contrast-outline-tint",
    utility: "inset-ring-contrast-outline-tint",
    css: "--tw-inset-ring-color: var(--contrast-outline-tint);",
  },
];

describe("ToolbarButton", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("has_aria_label_and_tooltip_with_shortcut", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const button = renderToolbarButton({ shortcut: "⌘R" });
    expect(screen.getByRole("button", { name: "Sincronizar" })).toBe(button);
    expect(button.getAttribute("aria-label")).toBe("Sincronizar");
    await user.hover(button);
    await vi.advanceTimersByTimeAsync(499);
    expect(tooltip()).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    await tick();
    expect(tooltip()?.textContent).toBe("Sincronizar com o Kobo ⌘R");
    expect(describedBy(button)).toBe("Sincronizar com o Kobo ⌘R");
  });

  it("tooltip_defaults_to_label", async () => {
    const user = userEvent.setup();
    const button = renderToolbarButton({ tooltip: undefined, label: "Exportar" });
    await user.tab();
    expect(document.activeElement).toBe(button);
    await tick();
    expect(tooltip()?.textContent).toBe("Exportar");
  });

  it("normal_has_no_background_or_border", async () => {
    const button = renderToolbarButton();
    await expectBindings(button, FIGMA_BINDINGS);
    // No fill, no stroke and no padding at rest: fills come only with hover and press.
    expect([...button.classList].filter((c) => /^(bg|border)-/.test(c))).toEqual([]);
    expect([...button.classList].filter((c) => /(^|:)(border|p[xytrbl]?-)/.test(c))).toEqual([]);
    expect(ringClasses(button)).toEqual(["inset-ring", "inset-ring-contrast-outline"]);
    expect(button.hasAttribute("aria-pressed")).toBe(false);
    // The 16 px icon, centred and decorative (the name is in aria-label).
    expect(button.classList.contains("justify-center")).toBe(true);
    expect(button.classList.contains("items-center")).toBe(true);
    const svg = button.querySelector("svg");
    expect(svg?.classList.contains("size-icon")).toBe(true);
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(button.textContent?.trim()).toBe("");
  });

  it("pressed_sets_aria_pressed_and_tint", async () => {
    const button = renderToolbarButton({ pressed: true });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await expectBindings(button, SELECIONADO_BINDINGS);
    expect(button.classList.contains("text-foreground")).toBe(false);
    // The tint holds on hover and press.
    expect([...button.classList].filter((c) => /(^|:)(hover|active):(bg|text)-/.test(c))).toEqual([]);
    cleanup();
    const off = renderToolbarButton({ pressed: false });
    expect(off.getAttribute("aria-pressed")).toBe("false");
    expect(off.classList.contains("bg-primary-tint")).toBe(false);
  });

  it("pressed_has_contrast_outline", () => {
    const button = renderToolbarButton({ pressed: true });
    expect(ringClasses(button)).toEqual(["inset-ring", "inset-ring-contrast-outline-tint"]);
    expect([...button.classList].filter((c) => c.includes("contrast-more"))).toEqual([]);
  });

  it("disabled_is_inert_and_explains_itself", async () => {
    const onclick = vi.fn();
    const button = renderToolbarButton({
      disabled: true,
      disabledReason: "Liga o Kobo para sincronizar",
      onclick,
    });
    expect(button.disabled).toBe(false);
    expect(button.getAttribute("aria-label")).toBe("Sincronizar");
    await expectDisabledInert({
      control: button,
      read: () => button.getAttribute("aria-pressed"),
      callback: onclick,
      reason: "Liga o Kobo para sincronizar",
    });
    expect(button.matches(await selectorFor("data-disabled:text-toolbar-icon-disabled"))).toBe(true);
    // Hover and press are gated by not-data-disabled: (by name: jsdom gets :not(:where(…)) wrong).
    const states = [...button.classList].filter((c) => /(^|:)(hover|active):/.test(c));
    expect(states.length).toBeGreaterThan(0);
    for (const c of states) expect(c).toMatch(/^not-data-disabled:(hover|active):/);
  });

  it("enabled_click_calls_onclick", async () => {
    const user = userEvent.setup();
    const onclick = vi.fn();
    const button = renderToolbarButton({ onclick });
    expect(button.type).toBe("button");
    await user.click(button);
    expect(onclick).toHaveBeenCalledTimes(1);
  });

  it("enabled_submit_submits_its_form", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn();
    const button = renderToolbarButton({ type: "submit", onsubmit });
    expect(button.type).toBe("submit");
    await user.click(button);
    expect(onsubmit).toHaveBeenCalledTimes(1);
  });

  it("disabled_submit_keeps_its_type_and_does_not_submit", async () => {
    const user = userEvent.setup();
    const onsubmit = vi.fn();
    const button = renderToolbarButton({
      type: "submit",
      disabled: true,
      disabledReason: "Sem livros",
      onsubmit,
    });
    expect(button.type).toBe("submit");
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    expect(onsubmit).not.toHaveBeenCalled();
  });

  it("keeps_caller_id_tabindex_and_describedby", async () => {
    for (const disabled of [false, true]) {
      cleanup();
      const button = renderToolbarButton({
        disabled,
        disabledReason: "Sem livros",
        id: "caller",
        tabindex: -1,
        "aria-describedby": "help",
      });
      expect(button.id, `disabled=${disabled}`).toBe("caller");
      expect(button.getAttribute("tabindex"), `disabled=${disabled}`).toBe("-1");
      expect(button.getAttribute("aria-describedby"), `disabled=${disabled}`).toBe("help");
      button.focus();
      await waitFor(() => expect(tooltip()).not.toBeNull());
      expect(button.getAttribute("aria-describedby"), `disabled=${disabled}`).toBe(
        `help ${tooltip()!.id}`,
      );
      expect(button.id, `disabled=${disabled}`).toBe("caller");
      expect(button.getAttribute("tabindex"), `disabled=${disabled}`).toBe("-1");
    }
  });

  it("disabled_ignores_onclickcapture", async () => {
    for (const disabled of [true, false]) {
      cleanup();
      const user = userEvent.setup();
      const onclickcapture = vi.fn();
      const button = renderToolbarButton({ disabled, disabledReason: "Sem livros", onclickcapture });
      await user.click(button);
      expect(onclickcapture, `disabled=${disabled}`).toHaveBeenCalledTimes(disabled ? 0 : 1);
    }
  });

  it("label_owns_the_accessible_name", () => {
    const other = document.createElement("span");
    other.id = "other-name";
    other.textContent = "Outro nome";
    document.body.append(other);
    try {
      // aria-labelledby is not in ToolbarButtonProps; a cast forwards it anyway.
      const button = renderToolbarButton({ "aria-labelledby": "other-name" });
      expect(screen.getByRole("button", { name: "Sincronizar" })).toBe(button);
      expect(button.hasAttribute("aria-labelledby")).toBe(false);
      expect(button.getAttribute("aria-label")).toBe("Sincronizar");
    } finally {
      other.remove();
    }
  });
});
