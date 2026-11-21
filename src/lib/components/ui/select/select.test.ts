import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss, selectorFor } from "$lib/test/css";
import { expectDisabledInert } from "$lib/test/disabled";
import { menuContent, menuItem, menuSeparator } from "../menu/menu-classes";
import { Select } from "./index";
import Fixture from "./select.fixture.svelte";

// jsdom has no pointer capture, which Bits UI's trigger releases on pointerdown.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

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

const ITEMS = [
  { value: "md", label: "Markdown" },
  { value: "txt", label: "Texto simples" },
  { value: "html", label: "HTML" },
];

/** Renders the fixture, whose own state is bound as `<Select bind:value />`; `bound` follows it. */
function renderBound(initial: string | undefined, props: Record<string, unknown> = {}) {
  const bound = { value: initial };
  const result = render(Fixture, {
    props: { label: "Formato", items: ITEMS, ...props, value: initial, onbound: (v: string | undefined) => (bound.value = v) },
  });
  const trigger = document.querySelector<HTMLElement>('[data-slot="select-trigger"]');
  if (!trigger) throw new Error("no trigger rendered");
  return { trigger, bound, ...result };
}

const listbox = () => document.querySelector<HTMLElement>('[role="listbox"]');
const options = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
const highlighted = () => document.querySelector<HTMLElement>('[role="option"][data-highlighted]');

async function open(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
  trigger.focus();
  await user.keyboard(" ");
  await waitFor(() => expect(listbox()).not.toBeNull());
  return listbox()!;
}

/** Fill, stroke and text colour classes, whatever their variants: nothing beyond the Figma's. */
const colourClasses = (el: Element) =>
  [...el.classList].filter((c) => /(^|:)(bg|border|text|inset-ring)-(?!\(|body$)/.test(c)).sort();

// Componentes (D7) · 6 · Pop-up (55:2116): each Figma binding and the one class that carries it.
const TRIGGER_BINDINGS: Binding[] = [
  { binding: "size/control (height)", utility: "h-control", css: "height: var(--size-control);" },
  { binding: "spacing/4 (left)", utility: "pl-4", css: "padding-left: calc(var(--spacing) * 4);" },
  { binding: "spacing/2 (right)", utility: "pr-2", css: "padding-right: calc(var(--spacing) * 2);" },
  { binding: "spacing/2 (item spacing)", utility: "gap-2", css: "gap: calc(var(--spacing) * 2);" },
  { binding: "radius/control", utility: "rounded-control", css: "border-radius: var(--radius-control);" },
  {
    binding: "stroke/border (inside)",
    utility: "border-(length:--stroke-border)",
    css: "border-width: var(--stroke-border);",
  },
  {
    binding: "input-strong (stroke, Normal, Hover, Premido, Foco)",
    utility: "border-input-strong",
    css: "border-color: var(--input-strong);",
  },
  { binding: "Normal: background (fill)", utility: "bg-background", css: "background-color: var(--background);" },
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
    binding: "Foco: stroke/ring outside, ring with ring-opacity",
    utility: "focus-visible:focus-ring",
    css: ":focus-visible {\n    outline: var(--stroke-ring) solid",
  },
  {
    binding: "hover fill in duration/hover",
    utility: "duration-(--duration-hover)",
    css: "transition-duration: var(--duration-hover);",
  },
  { binding: "hover fill with ease/hover", utility: "ease-hover", css: "transition-timing-function: var(--ease-hover);" },
  {
    binding: "Premido: instant",
    utility: "not-data-disabled:active:transition-none",
    css: "transition-property: none;",
  },
  { binding: "Desativado: disabled (fill)", utility: "data-disabled:bg-disabled", css: "background-color: var(--disabled);" },
  {
    binding: "Desativado: disabled-border (stroke)",
    utility: "data-disabled:border-disabled-border",
    css: "border-color: var(--disabled-border);",
  },
];

const VALUE_BINDINGS: Binding[] = [
  {
    binding: "Valor: Interface/Body",
    utility: "text-body",
    css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 400;",
  },
  { binding: "Valor: foreground (fill)", utility: "text-foreground", css: "color: var(--foreground);" },
  {
    binding: "Valor Desativado: disabled-foreground (fill)",
    utility: "group-data-disabled/select:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
];

const CHEVRON_BINDINGS: Binding[] = [
  { binding: "Seta: size/icon-sm (12)", utility: "size-icon-sm", css: "var(--size-icon-sm)" },
  { binding: "Seta: muted-foreground", utility: "text-muted-foreground", css: "color: var(--muted-foreground);" },
  {
    binding: "Seta Desativado: disabled-foreground",
    utility: "group-data-disabled/select:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
];

// Componentes (D7) · 10 · Menu (55:3185 and 55:3156): the list is the Menu's surface and item.
const CONTENT_BINDINGS: Binding[] = [
  { binding: "spacing/1 (padding)", utility: "p-1", css: "padding: var(--spacing);" },
  { binding: "popover (fill)", utility: "bg-popover", css: "background-color: var(--popover);" },
  {
    binding: "stroke/border (inside)",
    utility: "inset-ring-(length:--stroke-border)",
    css: "inset 0 0 0 var(--stroke-border)",
  },
  { binding: "border (stroke)", utility: "inset-ring-border", css: "--tw-inset-ring-color: var(--border);" },
  { binding: "radius/menu", utility: "rounded-menu", css: "border-radius: var(--radius-menu);" },
  {
    binding: "Sombra/Menu (effect style)",
    utility: "shadow-sombra-menu",
    css: "--tw-shadow: 0 8px 24px var(--tw-shadow-color, rgb(0 0 0 / 0.16));",
  },
];

const MOTION_BINDINGS: Binding[] = [
  { binding: "opens with an animation", utility: "data-open:animate-in", css: "animation: enter" },
  { binding: "opens with a fade", utility: "data-open:fade-in-0", css: "--tw-enter-opacity: 0;" },
  { binding: "opens in duration/in", utility: "data-open:duration-(--duration-in)", css: "--tw-duration: var(--duration-in);" },
  { binding: "opens with ease/out", utility: "data-open:ease-out", css: "--tw-ease: var(--ease-out);" },
  { binding: "closes with an animation", utility: "data-closed:animate-out", css: "animation: exit" },
  { binding: "closes with a fade", utility: "data-closed:fade-out-0", css: "--tw-exit-opacity: 0;" },
  {
    binding: "closes in duration/out",
    utility: "data-closed:duration-(--duration-out)",
    css: "--tw-duration: var(--duration-out);",
  },
  {
    binding: "Reduzir movimento: opens without scaling",
    utility: "data-open:motion-reduce:zoom-in-100",
    css: "--tw-enter-scale: 1;",
  },
  {
    binding: "Reduzir movimento: closes without scaling",
    utility: "data-closed:motion-reduce:zoom-out-100",
    css: "--tw-exit-scale: 1;",
  },
];

const ITEM_BINDINGS: Binding[] = [
  { binding: "24 high", utility: "h-6", css: "height: calc(var(--spacing) * 6);" },
  { binding: "spacing/2 (left, right)", utility: "px-2", css: "padding-inline: calc(var(--spacing) * 2);" },
  { binding: "spacing/1 (top, bottom)", utility: "py-1", css: "padding-block: var(--spacing);" },
  { binding: "spacing/2 (item spacing)", utility: "gap-2", css: "gap: calc(var(--spacing) * 2);" },
  { binding: "radius/control", utility: "rounded-control", css: "border-radius: var(--radius-control);" },
  {
    binding: "Interface/Body",
    utility: "text-body",
    css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 400;",
  },
  { binding: "foreground (text)", utility: "text-foreground", css: "color: var(--foreground);" },
  { binding: "Realçado: primary (fill)", utility: "data-highlighted:bg-primary", css: "background-color: var(--primary);" },
  {
    binding: "Realçado: primary-foreground (text, mark)",
    utility: "data-highlighted:text-primary-foreground",
    css: "color: var(--primary-foreground);",
  },
  {
    binding: "Desativado: disabled-foreground (text)",
    utility: "data-disabled:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
];

describe("Select", () => {
  it("trigger_shows_value_and_chevrons", async () => {
    const { trigger } = renderBound("txt");
    expect(screen.getByRole("combobox", { name: "Formato" })).toBe(trigger);
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    const value = trigger.querySelector<HTMLElement>('[data-slot="select-value"]')!;
    expect(value.textContent).toBe("Texto simples");
    const chevron = trigger.querySelector('[data-slot="select-chevron"]')!;
    expect(chevron.classList.contains("lucide-chevrons-up-down")).toBe(true);
    expect(chevron.getAttribute("width")).toBe("12");
    expect(chevron.getAttribute("aria-hidden")).toBe("true");
    // Horizontal, value then arrow.
    expect(value.compareDocumentPosition(chevron) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expectBindings(trigger, TRIGGER_BINDINGS);
    await expectBindings(value, VALUE_BINDINGS);
    await expectBindings(chevron, CHEVRON_BINDINGS);
    // No contrast outline: input-strong already darkens in the contrast modes.
    expect(colourClasses(trigger)).toEqual(
      TRIGGER_BINDINGS.map((b) => b.utility)
        .filter((u) => /(^|:)(bg|border|text)-(?!\()/.test(u))
        .sort(),
    );
    // Every hover and press class is gated by not-data-disabled: (checked by name, see selectorFor).
    const states = [...trigger.classList].filter((c) => /(^|:)(hover|active):/.test(c));
    for (const c of states) expect(c).toMatch(/^not-data-disabled:(hover|active):/);
  });

  it("always_has_a_choice", () => {
    // pop-up-buttons.md: no empty state; without a value in the list, the first item is chosen.
    const { trigger, bound } = renderBound(undefined);
    expect(bound.value).toBe("md");
    expect(trigger.querySelector('[data-slot="select-value"]')!.textContent).toBe("Markdown");
    expect(trigger.hasAttribute("data-placeholder")).toBe(false);
  });

  it("opens_with_space_and_arrows_move_highlight", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { trigger, bound } = renderBound("md", { onValueChange });
    await user.tab();
    expect(document.activeElement).toBe(trigger);
    // The ring is keyboard-only.
    expect(trigger.matches(await selectorFor("focus-visible:focus-ring"))).toBe(true);
    await open(user, trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(options().map((o) => o.textContent?.trim())).toEqual(["Markdown", "Texto simples", "HTML"]);
    await waitFor(() => expect(highlighted()?.textContent?.trim()).toBe("Markdown"));
    await user.keyboard("{ArrowDown}");
    expect(highlighted()?.textContent?.trim()).toBe("Texto simples");
    await user.keyboard("{ArrowDown}");
    expect(highlighted()?.textContent?.trim()).toBe("HTML");
    await user.keyboard("{ArrowUp}");
    expect(highlighted()?.textContent?.trim()).toBe("Texto simples");
    await user.keyboard("{Enter}");
    expect(bound.value).toBe("txt");
    expect(onValueChange.mock.calls).toEqual([["txt"]]);
    await waitFor(() => expect(trigger.getAttribute("aria-expanded")).toBe("false"));
    expect(trigger.querySelector('[data-slot="select-value"]')!.textContent).toBe("Texto simples");
  });

  it("highlighted_item_uses_primary", async () => {
    const user = userEvent.setup();
    const { trigger } = renderBound("md");
    await open(user, trigger);
    await waitFor(() => expect(highlighted()).not.toBeNull());
    const [first, second] = options();
    for (const utility of ["data-highlighted:bg-primary", "data-highlighted:text-primary-foreground"]) {
      const selector = await selectorFor(utility);
      expect(first.matches(selector), utility).toBe(true);
      expect(second.matches(selector), utility).toBe(false);
    }
    // The highlight has no transition (Menu: not the shadcn accent, and no fade).
    for (const option of options()) {
      expect([...option.classList].filter((c) => /transition|duration|ease/.test(c))).toEqual([]);
    }
  });

  it("open_variant_matches_bits_ui_state", async () => {
    const user = userEvent.setup();
    const { trigger } = renderBound("md");
    await open(user, trigger);
    const content = document.querySelector<HTMLElement>('[data-slot="select-content"]')!;
    expect(content.getAttribute("data-state")).toBe("open");
    expect(trigger.getAttribute("data-state")).toBe("open");
    await expectBindings(content, MOTION_BINDINGS);
    for (const utility of ["data-open:animate-in", "data-open:fade-in-0", "data-open:duration-(--duration-in)"]) {
      expect(content.matches(await selectorFor(utility)), utility).toBe(true);
    }
    expect(content.matches(await selectorFor("data-closed:animate-out"))).toBe(false);
    // Reduzir movimento keeps the fade and drops the scale.
    const { css } = await compileAppCss(["data-open:motion-reduce:zoom-in-100"]);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect([...content.classList].filter((c) => /slide|translate|spin|rotate/.test(c))).toEqual([]);
  });

  it("current_value_has_check", async () => {
    const user = userEvent.setup();
    const { trigger } = renderBound("txt");
    await open(user, trigger);
    for (const option of options()) {
      const mark = option.querySelector<HTMLElement>('[data-slot="menu-mark"]')!;
      // Tipo=Com marca: a 12 × 12 column before the text, the check only on the value in force.
      expect(mark.classList.contains("size-icon-sm")).toBe(true);
      expect(mark.compareDocumentPosition(option.lastElementChild!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      const check = mark.querySelector("svg");
      const selected = option.getAttribute("aria-selected") === "true";
      expect(selected).toBe(option.textContent?.trim() === "Texto simples");
      expect(check !== null, option.textContent!).toBe(selected);
      if (check) {
        expect(check.classList.contains("lucide-check")).toBe(true);
        expect(check.getAttribute("width")).toBe("12");
        expect(check.getAttribute("stroke")).toBe("currentColor");
      }
    }
  });

  it("disabled_is_inert_and_explains_itself", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn();
    const { trigger, bound } = renderBound("md", {
      disabled: true,
      disabledReason: "Liga o Kobo para escolher",
      onValueChange,
      onOpenChange,
    });
    expect(trigger.hasAttribute("disabled")).toBe(false);
    await expectDisabledInert({
      control: trigger,
      read: () => bound.value,
      popup: listbox,
      callback: onValueChange,
      reason: "Liga o Kobo para escolher",
      user,
    });
    // The arrows don't open it, and typing doesn't choose (Bits UI typeahead on a closed trigger).
    trigger.focus();
    await user.keyboard("{ArrowDown}{ArrowUp}h");
    expect(listbox()).toBeNull();
    expect(bound.value).toBe("md");
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    const value = trigger.querySelector('[data-slot="select-value"]')!;
    const chevron = trigger.querySelector('[data-slot="select-chevron"]')!;
    for (const [el, utility] of [
      [trigger, "data-disabled:bg-disabled"],
      [trigger, "data-disabled:border-disabled-border"],
      [value, "group-data-disabled/select:text-disabled-foreground"],
      [chevron, "group-data-disabled/select:text-disabled-foreground"],
    ] as const) {
      expect(el.matches(await selectorFor(utility)), utility).toBe(true);
    }
  });

  it("content_uses_menu_surface", async () => {
    const user = userEvent.setup();
    const { trigger } = renderBound("md");
    await open(user, trigger);
    const content = document.querySelector<HTMLElement>('[data-slot="select-content"]')!;
    await expectBindings(content, CONTENT_BINDINGS);
    // The shared Menu surface and item (Task 17 reuses them).
    for (const c of menuContent.split(/\s+/)) expect(content.classList.contains(c), c).toBe(true);
    expect(colourClasses(content)).toEqual(["bg-popover", "inset-ring-border", "text-popover-foreground"]);
    // As wide as the trigger at least.
    expect(content.classList.contains("min-w-(--bits-select-anchor-width)")).toBe(true);
    for (const option of options()) {
      await expectBindings(option, ITEM_BINDINGS);
      for (const c of menuItem.split(/\s+/)) expect(option.classList.contains(c), c).toBe(true);
    }
  });

  it("separator_before_an_item_draws_the_menu_separator", async () => {
    const user = userEvent.setup();
    const { trigger } = renderBound("md", {
      items: [...ITEMS, { value: "novo", label: "Novo…", separatorBefore: true }],
    });
    await open(user, trigger);
    const separators = [...document.querySelectorAll<HTMLElement>('[data-slot="select-separator"]')];
    expect(separators).toHaveLength(1);
    const [separator] = separators;
    // Separador de menu (55:3159), out of the screen readers' listbox: it is no option
    expect(separator.getAttribute("aria-hidden")).toBe("true");
    for (const c of menuSeparator.split(/\s+/)) expect(separator.classList.contains(c), c).toBe(true);
    expect(options()).toHaveLength(4);
    // Right before «Novo…», after the others
    expect(separator.nextElementSibling?.textContent).toContain("Novo…");
    expect(separator.previousElementSibling?.getAttribute("role")).toBe("option");
  });

  it("without_reason_needs_no_tooltip_provider", () => {
    render(Select, { props: { label: "Formato", items: ITEMS, value: "md", disabled: true } });
    expect(screen.getByRole("combobox", { name: "Formato" }).getAttribute("aria-disabled")).toBe("true");
    cleanup();
  });
});

describe("Select options", () => {
  it("hovering_disabled_option_does_not_choose_it", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const items = [...ITEMS.slice(0, 2), { value: "html", label: "HTML", disabled: true }];
    const { trigger, bound } = renderBound("md", { items, onValueChange });
    await open(user, trigger);
    await waitFor(() => expect(highlighted()?.textContent?.trim()).toBe("Markdown"));
    const disabledOption = options()[2];
    expect(disabledOption.getAttribute("aria-disabled")).toBe("true");
    await user.hover(disabledOption);
    expect(trigger.getAttribute("aria-activedescendant")).toBe(options()[0].id);
    await user.keyboard("{Enter}");
    expect(bound.value).toBe("md");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("item_disabled_while_highlighted_is_not_chosen", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    const { trigger, bound, rerender } = renderBound("md", { onValueChange });
    await open(user, trigger);
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(highlighted()?.textContent?.trim()).toBe("HTML");
    await rerender({ items: [...ITEMS.slice(0, 2), { value: "html", label: "HTML", disabled: true }] });
    await user.keyboard("{Enter}");
    expect(bound.value).toBe("md");
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("disabled_refuses_parent_open", async () => {
    let boundOpen: boolean | undefined;
    const { trigger, rerender } = renderBound("md", {
      disabled: true,
      onboundopen: (v: boolean) => (boundOpen = v),
    });
    await rerender({ open: true });
    await waitFor(() => expect(boundOpen).toBe(false));
    expect(listbox()).toBeNull();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});

/** A form in the document; the fixture renders inside unless `outside`. */
function renderInForm(props: Record<string, unknown>, { outside = false } = {}) {
  const form = document.createElement("form");
  form.id = "settings";
  const host = document.createElement("div");
  document.body.append(form, host);
  render(Fixture, { target: outside ? host : form, props: { label: "Formato", items: ITEMS, ...props } });
  const backing = document.querySelector<HTMLSelectElement>('[data-slot="select-input"]');
  return { form, host, backing };
}

describe("Select in a form", () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("submits_its_value", () => {
    const { form, backing } = renderInForm({ name: "format", value: "txt" });
    expect(new FormData(form).getAll("format")).toEqual(["txt"]);
    // One field: Bits UI's own hidden input is not rendered.
    expect(form.querySelectorAll('[name="format"]')).toHaveLength(1);
    // Hidden from the tab order and assistive technology, but not barred from validation.
    expect(backing!.tabIndex).toBe(-1);
    expect(backing!.getAttribute("aria-hidden")).toBe("true");
    expect(backing!.willValidate).toBe(true);
  });

  it("external_form_gets_the_value", () => {
    const enclosing = document.createElement("form");
    document.body.append(enclosing);
    const { form, host } = renderInForm({ form: "settings", name: "format", value: "html" }, { outside: true });
    enclosing.append(host);
    expect(new FormData(form).getAll("format")).toEqual(["html"]);
    expect(new FormData(enclosing).getAll("format")).toEqual([]);
  });

  it("required_reaches_the_backing_field", () => {
    const { backing, form } = renderInForm({ name: "format", required: true });
    expect(backing!.required).toBe(true);
    expect(form.checkValidity()).toBe(true);
    const trigger = document.querySelector('[data-slot="select-trigger"]')!;
    expect(trigger.getAttribute("aria-required")).toBe("true");
    expect(trigger.hasAttribute("required")).toBe(false);
  });

  it("required_without_items_fails_validation", () => {
    const { form } = renderInForm({ name: "format", required: true, items: [] });
    expect(form.checkValidity()).toBe(false);
  });

  it("disabled_still_submits_but_is_not_required", () => {
    // As the Switch and the Caixa: a disabled control submits its value, like a readonly field.
    const { form, backing } = renderInForm({ name: "format", value: "txt", required: true, disabled: true });
    expect(new FormData(form).getAll("format")).toEqual(["txt"]);
    expect(backing!.required).toBe(false);
    expect(form.checkValidity()).toBe(true);
  });
});
