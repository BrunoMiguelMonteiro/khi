import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss, selectorFor } from "$lib/test/css";
import { Input } from "./index";

const inputOf = (container: HTMLElement) => {
  const el = container.querySelector('[data-slot="input"]');
  if (!(el instanceof HTMLInputElement)) throw new Error("no input rendered");
  return el;
};

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

/** Renders with a bound value, as `<Input bind:value />` would (Svelte 5 binds through accessors). */
function renderBound(initial: string, props: Record<string, unknown> = {}) {
  const bound = { value: initial };
  const { container } = render(Input, {
    props: {
      ...props,
      get value() {
        return bound.value;
      },
      set value(v: string) {
        bound.value = v;
      },
    },
  });
  return { input: inputOf(container), bound };
}

// Componentes (D7) · 5 · Campo de texto (55:1908): each Figma binding and the one class that carries it.
const FIGMA_BINDINGS = [
  {
    binding: "size/control (height)",
    utility: "h-control",
    css: "height: var(--size-control);",
  },
  // Figma binds spacing/2 to paddingLeft/paddingRight only; top/bottom are 0.
  {
    binding: "spacing/2 (left, right)",
    utility: "px-2",
    css: "padding-inline: calc(var(--spacing) * 2);",
  },
  {
    binding: "radius/control",
    utility: "rounded-control",
    css: "border-radius: var(--radius-control);",
  },
  // Stroke INSIDE: a CSS border sits inside the 28 px box (border-box).
  {
    binding: "stroke/border (inside)",
    utility: "border-(length:--stroke-border)",
    css: "border-width: var(--stroke-border);",
  },
  {
    binding: "input-strong (stroke)",
    utility: "border-input-strong",
    css: "border-color: var(--input-strong);",
  },
  {
    binding: "background (fill)",
    utility: "bg-background",
    css: "background-color: var(--background);",
  },
  {
    binding: "Interface/Body",
    utility: "text-body",
    css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 400;",
  },
  {
    binding: "foreground (value)",
    utility: "text-foreground",
    css: "color: var(--foreground);",
  },
  {
    binding: "tertiary-foreground (placeholder)",
    utility: "placeholder:text-tertiary-foreground",
    css: "::placeholder {\n    color: var(--tertiary-foreground);",
  },
  {
    binding: "truncation ENDING",
    utility: "truncate",
    css: "text-overflow: ellipsis;",
  },
  {
    binding: "Foco: stroke/ring outside, ring at ring-opacity",
    utility: "focus-visible:focus-ring",
    css: ":focus-visible {\n    outline: var(--stroke-ring) solid",
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
    binding: "Desativado: disabled-foreground (value)",
    utility: "data-disabled:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
  {
    binding: "Desativado: disabled-foreground (placeholder)",
    utility: "data-disabled:placeholder:text-disabled-foreground",
    css: "::placeholder {\n    color: var(--disabled-foreground);",
  },
];

describe("Input", () => {
  it("input_has_figma_bindings", async () => {
    const { input } = renderBound("Kobo", { placeholder: "Nome" });
    for (const { binding, utility, css } of FIGMA_BINDINGS) {
      expect(input.classList.contains(utility), `${binding} → ${utility}`).toBe(
        true,
      );
      expect(await ruleOf(utility), utility).toContain(css);
    }
    // One stroke colour, one fill and one text colour at rest: nothing else competes with them.
    const colours = [...input.classList].filter((c) =>
      /^(bg|border|text)-(?!body$|\()/.test(c),
    );
    expect(colours.sort()).toEqual([
      "bg-background",
      "border-input-strong",
      "text-foreground",
    ]);
    // Shadcn leftovers that the Figma does not have.
    const leftovers = [...input.classList].filter((c) =>
      /(^|:)(file|aria-invalid|dark|md):|(^|:)(shadow|ring)-/.test(c),
    );
    expect(leftovers).toEqual([]);
  });

  it("default_width_is_220", async () => {
    const { input } = renderBound("");
    expect(input.classList.contains("w-55")).toBe(true);
    // --spacing is 0.25rem (4 px), so w-55 is 220 px.
    expect(await ruleOf("w-55")).toContain("width: calc(var(--spacing) * 55);");
    const { container } = render(Input, { class: "w-full" });
    const wide = container.querySelectorAll('[data-slot="input"]');
    const last = wide[wide.length - 1];
    expect(last.classList.contains("w-full")).toBe(true);
    expect(last.classList.contains("w-55")).toBe(false);
  });

  it("placeholder_uses_tertiary_foreground", async () => {
    const { input } = renderBound("", { placeholder: "Nome do ficheiro" });
    expect(input.placeholder).toBe("Nome do ficheiro");
    expect(input.value).toBe("");
    expect(
      input.classList.contains("placeholder:text-tertiary-foreground"),
    ).toBe(true);
    expect(await selectorFor("placeholder:text-tertiary-foreground")).toBe(
      ".placeholder\\:text-tertiary-foreground::placeholder",
    );
  });

  it("focus_keeps_border_and_shows_ring", async () => {
    const user = userEvent.setup();
    const { input } = renderBound("Kobo");
    await user.tab();
    expect(document.activeElement).toBe(input);
    expect(input.matches(await selectorFor("focus-visible:focus-ring"))).toBe(
      true,
    );
    // The stroke stays input-strong: no focus variant touches border, fill or text, and no transition.
    const focusClasses = [...input.classList].filter((c) =>
      /(^|:)focus(-visible|-within)?:/.test(c),
    );
    expect(focusClasses).toEqual(["focus-visible:focus-ring"]);
    expect(input.classList.contains("border-input-strong")).toBe(true);
    expect(
      [...input.classList].filter((c) =>
        /transition|duration|ease|animate/.test(c),
      ),
    ).toEqual([]);
  });

  it("disabled_is_inert", async () => {
    const user = userEvent.setup();
    const oninput = vi.fn();
    const { input, bound } = renderBound("Kobo", {
      disabled: true,
      placeholder: "Nome",
      oninput,
    });
    // Native readonly, not native disabled, so it stays in the Tab order.
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    expect(input.getAttribute("aria-disabled")).toBe("true");
    expect(input.hasAttribute("data-disabled")).toBe(true);

    await user.tab();
    expect(document.activeElement).toBe(input);
    await user.keyboard("abc {Backspace}{Enter}");
    await user.click(input);
    await user.type(input, "xyz");
    await user.paste("pasted");
    expect(bound.value).toBe("Kobo");
    expect(input.value).toBe("Kobo");
    expect(oninput).not.toHaveBeenCalled();
    for (const state of [
      "data-disabled:bg-disabled",
      "data-disabled:border-disabled-border",
      "data-disabled:text-disabled-foreground",
    ]) {
      expect(input.matches(await selectorFor(state)), state).toBe(true);
    }
  });

  it("enabled_typing_updates_bound_value", async () => {
    const user = userEvent.setup();
    const { input, bound } = renderBound("Ko");
    await user.type(input, "bo");
    expect(bound.value).toBe("Kobo");
    expect(input.readOnly).toBe(false);
    expect(input.hasAttribute("aria-disabled")).toBe(false);
    expect(input.hasAttribute("data-disabled")).toBe(false);
    for (const state of [
      "data-disabled:bg-disabled",
      "data-disabled:border-disabled-border",
    ]) {
      expect(input.matches(await selectorFor(state)), state).toBe(false);
    }
  });

  it("disabled_wins_over_conflicting_forwarded_props", async () => {
    const user = userEvent.setup();
    const { input, bound } = renderBound("Kobo", {
      disabled: true,
      readOnly: false,
      "aria-disabled": false,
      "data-disabled": "false",
    });
    expect(input.readOnly).toBe(true);
    expect(input.disabled).toBe(false);
    expect(input.getAttribute("aria-disabled")).toBe("true");
    expect(input.getAttribute("data-disabled")).toBe("");
    expect(input.matches(await selectorFor("data-disabled:bg-disabled"))).toBe(
      true,
    );

    await user.tab();
    expect(document.activeElement).toBe(input);
    await user.keyboard("abc");
    await user.type(input, "xyz");
    expect(bound.value).toBe("Kobo");
    expect(input.value).toBe("Kobo");
  });

  it("unsupported_type_renders_as_text", () => {
    const { input } = renderBound("", { type: "checkbox" });
    expect(input.type).toBe("text");
    const { input: email } = renderBound("", { type: "email" });
    expect(email.type).toBe("email");
  });
});
