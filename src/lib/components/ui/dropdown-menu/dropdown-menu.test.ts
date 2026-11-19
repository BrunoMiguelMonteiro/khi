import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss, selectorFor } from "$lib/test/css";
import { menuContent, menuItem } from "../menu/menu-classes";
import Fixture from "./dropdown-menu.fixture.svelte";

// jsdom has no pointer capture, which Bits UI's triggers release on pointerdown.
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

const menu = () => document.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]');
const items = () => [...document.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"]')];
const item = (text: string) => items().find((i) => i.textContent?.includes(text))!;
const highlighted = () => document.querySelector<HTMLElement>('[data-slot="dropdown-menu-item"][data-highlighted]');
const shortcutOf = (el: Element) => el.querySelector<HTMLElement>('[data-slot="dropdown-menu-shortcut"]')!;

/** Opens the menu from the keyboard, as Bits UI does on Enter, with the first item highlighted. */
async function openMenu(props: Record<string, unknown> = {}) {
  const user = userEvent.setup();
  const result = render(Fixture, { props });
  const trigger = screen.getByRole("button", { name: "Ações" });
  trigger.focus();
  await user.keyboard("{Enter}");
  await waitFor(() => expect(menu()).not.toBeNull());
  await waitFor(() => expect(highlighted()).not.toBeNull());
  return { user, trigger, content: menu()!, ...result };
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
 * element.matches for the group variants of the shortcut: jsdom (nwsapi) gets the nested
 * `:is(:where(.group…)…)` wrong, so each branch is matched on its own (as in checkbox.test.ts).
 */
const matchesGroup = async (el: Element, utility: string) =>
  expand(await selectorFor(utility)).some((s) => el.matches(s));

/** Fill, stroke and text colour classes, whatever their variants. */
const colourClasses = (el: Element) =>
  [...el.classList].filter((c) => /(^|:)(bg|border|text|inset-ring)-(?!\(|body$)/.test(c)).sort();

// Componentes (D7) · 10 · Menu: each Figma binding and the one class that carries it.
const CONTENT_BINDINGS: Binding[] = [
  { binding: "width 200", utility: "w-50", css: "width: calc(var(--spacing) * 50);" },
  { binding: "spacing/1 (padding)", utility: "p-1", css: "padding: var(--spacing);" },
  { binding: "popover (fill)", utility: "bg-popover", css: "background-color: var(--popover);" },
  {
    binding: "stroke/border (inside)",
    utility: "border-(length:--stroke-border)",
    css: "border-width: var(--stroke-border);",
  },
  { binding: "border (stroke)", utility: "border-border", css: "border-color: var(--border);" },
  { binding: "radius/menu", utility: "rounded-menu", css: "border-radius: var(--radius-menu);" },
  {
    binding: "Sombra/Menu (effect style)",
    utility: "shadow-sombra-menu",
    css: "--tw-shadow: 0 8px 24px var(--tw-shadow-color, rgb(0 0 0 / 0.16));",
  },
];

const ITEM_BINDINGS: Binding[] = [
  { binding: "24 high", utility: "h-6", css: "height: calc(var(--spacing) * 6);" },
  { binding: "spacing/2 (left, right)", utility: "px-2", css: "padding-inline: calc(var(--spacing) * 2);" },
  { binding: "spacing/1 (top, bottom)", utility: "py-1", css: "padding-block: var(--spacing);" },
  { binding: "spacing/2 (item spacing)", utility: "gap-2", css: "gap: calc(var(--spacing) * 2);" },
  { binding: "radius/control", utility: "rounded-control", css: "border-radius: var(--radius-control);" },
  {
    binding: "Texto: Interface/Body",
    utility: "text-body",
    css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 400;",
  },
  { binding: "Texto: foreground", utility: "text-foreground", css: "color: var(--foreground);" },
  { binding: "Realçado: primary (fill)", utility: "data-highlighted:bg-primary", css: "background-color: var(--primary);" },
  {
    binding: "Realçado: primary-foreground (texto, marca)",
    utility: "data-highlighted:text-primary-foreground",
    css: "color: var(--primary-foreground);",
  },
  {
    binding: "Desativado: disabled-foreground (texto)",
    utility: "data-disabled:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
];

const SHORTCUT_BINDINGS: Binding[] = [
  {
    binding: "Atalho: Interface/Body",
    utility: "text-body",
    css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 400;",
  },
  { binding: "Atalho: tertiary-foreground", utility: "text-tertiary-foreground", css: "color: var(--tertiary-foreground);" },
  {
    binding: "Atalho realçado: primary-foreground",
    utility: "group-data-highlighted/menu-item:text-primary-foreground",
    css: "color: var(--primary-foreground);",
  },
  {
    binding: "Atalho desativado: disabled-foreground",
    utility: "group-data-disabled/menu-item:text-disabled-foreground",
    css: "color: var(--disabled-foreground);",
  },
];

const SEPARATOR_BINDINGS: Binding[] = [
  { binding: "stroke/border (1 px line)", utility: "h-(--stroke-border)", css: "height: var(--stroke-border);" },
  { binding: "border (fill)", utility: "bg-border", css: "background-color: var(--border);" },
  { binding: "spacing/1 (top, bottom)", utility: "my-1", css: "margin-block: var(--spacing);" },
  { binding: "spacing/2 (sides)", utility: "mx-2", css: "margin-inline: calc(var(--spacing) * 2);" },
];

// By class name: the fades are verified on screen (jsdom runs no animations).
const MOTION_BINDINGS: Binding[] = [
  { binding: "opens with an animation", utility: "data-open:animate-in", css: "animation: enter" },
  { binding: "opens with a fade", utility: "data-open:fade-in-0", css: "--tw-enter-opacity: 0;" },
  { binding: "opens in duration/in (200)", utility: "data-open:duration-(--duration-in)", css: "--tw-duration: var(--duration-in);" },
  { binding: "opens with ease/out", utility: "data-open:ease-out", css: "--tw-ease: var(--ease-out);" },
  { binding: "closes with an animation", utility: "data-closed:animate-out", css: "animation: exit" },
  { binding: "closes with a fade", utility: "data-closed:fade-out-0", css: "--tw-exit-opacity: 0;" },
  {
    binding: "closes in duration/out (150)",
    utility: "data-closed:duration-(--duration-out)",
    css: "--tw-duration: var(--duration-out);",
  },
  { binding: "Reduzir movimento: opens without scaling", utility: "data-open:motion-reduce:zoom-in-100", css: "--tw-enter-scale: 1;" },
  { binding: "Reduzir movimento: closes without scaling", utility: "data-closed:motion-reduce:zoom-out-100", css: "--tw-exit-scale: 1;" },
];

describe("DropdownMenu", () => {
  it("content_is_200_wide_with_menu_surface", async () => {
    const { content } = await openMenu();
    expect(content.getAttribute("role")).toBe("menu");
    await expectBindings(content, CONTENT_BINDINGS);
    for (const c of menuContent.split(/\s+/)) expect(content.classList.contains(c), c).toBe(true);
    expect(colourClasses(content)).toEqual(["bg-popover", "border-border", "text-popover-foreground"]);
    for (const el of items()) {
      await expectBindings(el, ITEM_BINDINGS);
      for (const c of menuItem.split(/\s+/)) expect(el.classList.contains(c), c).toBe(true);
    }
  });

  it("content_width_can_be_overridden", async () => {
    const { content } = await openMenu({ contentClass: "w-64" });
    expect(content.classList.contains("w-64")).toBe(true);
    expect(content.classList.contains("w-50")).toBe(false);
  });

  it("highlighted_item_uses_primary_without_transition", async () => {
    const { user } = await openMenu();
    const [first, second] = items();
    expect(highlighted()).toBe(first);
    for (const utility of ["data-highlighted:bg-primary", "data-highlighted:text-primary-foreground"]) {
      const selector = await selectorFor(utility);
      expect(first.matches(selector), utility).toBe(true);
      expect(second.matches(selector), utility).toBe(false);
    }
    await user.keyboard("{ArrowDown}");
    expect(highlighted()).toBe(second);
    expect(second.matches(await selectorFor("data-highlighted:bg-primary"))).toBe(true);
    // Not the shadcn accent, and instant: no transition on any item.
    for (const el of items()) {
      expect([...el.classList].filter((c) => /transition|duration|ease|accent/.test(c))).toEqual([]);
    }
  });

  it("matches_figma_sample", async () => {
    const sample = JSON.parse(readFileSync(resolve(process.cwd(), "design/components-sample.json"), "utf8"))[
      "menu-highlighted"
    ];
    expect(sample.figma).toMatch(/^55:3185 › Item de menu realçado/);
    const { user } = await openMenu();
    await user.keyboard("{ArrowDown}");
    const checked = item("Agrupar por série");
    expect(highlighted()).toBe(checked);
    const check = checked.querySelector('[data-slot="menu-mark"] svg')!;
    expect(check.getAttribute("stroke")).toBe("currentColor");
    const expected: [Element, string][] = [
      [checked, `data-highlighted:bg-${sample.item.fill}`],
      [checked, `data-highlighted:text-${sample.text.fill}`],
      // The check takes the item's text colour (currentColor).
      [checked, `data-highlighted:text-${sample.check.stroke}`],
    ];
    for (const [el, utility] of expected) {
      expect(el.classList.contains(utility), utility).toBe(true);
      expect(el.matches(await selectorFor(utility)), utility).toBe(true);
    }
    const exportItem = item("Exportar");
    await user.keyboard("{ArrowUp}");
    expect(highlighted()).toBe(exportItem);
    const utility = `group-data-highlighted/menu-item:text-${sample.shortcut.fill}`;
    expect(shortcutOf(exportItem).classList.contains(utility)).toBe(true);
    expect(await matchesGroup(shortcutOf(exportItem), utility)).toBe(true);
  });

  it("shortcut_turns_primary_foreground_when_highlighted", async () => {
    const { user } = await openMenu();
    const exportItem = item("Exportar");
    const shortcut = shortcutOf(exportItem);
    expect(shortcut.textContent).toBe("⌘E");
    await expectBindings(shortcut, SHORTCUT_BINDINGS);
    // After the text, at the trailing edge.
    expect(shortcut.classList.contains("ms-auto")).toBe(true);
    const highlightedUtility = "group-data-highlighted/menu-item:text-primary-foreground";
    expect(await matchesGroup(shortcut, highlightedUtility)).toBe(true);
    await user.keyboard("{ArrowDown}");
    expect(await matchesGroup(shortcut, highlightedUtility)).toBe(false);
    const disabledShortcut = shortcutOf(item("Remover"));
    expect(await matchesGroup(disabledShortcut, "group-data-disabled/menu-item:text-disabled-foreground")).toBe(true);
    expect(await matchesGroup(shortcut, "group-data-disabled/menu-item:text-disabled-foreground")).toBe(false);
  });

  it("checked_item_shows_check", async () => {
    const { user } = await openMenu();
    const checked = item("Agrupar por série");
    expect(checked.getAttribute("role")).toBe("menuitemcheckbox");
    expect(checked.getAttribute("aria-checked")).toBe("true");
    const mark = checked.querySelector<HTMLElement>('[data-slot="menu-mark"]')!;
    // Tipo=Com marca: a 12 × 12 column before the text.
    expect(mark.classList.contains("size-icon-sm")).toBe(true);
    expect(mark.compareDocumentPosition(checked.lastElementChild!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const check = mark.querySelector("svg")!;
    expect(check.classList.contains("lucide-check")).toBe(true);
    expect(check.getAttribute("width")).toBe("12");
    expect(check.getAttribute("aria-hidden")).toBe("true");
    // Items without checked have no mark column; Enter toggles the mark and closes the menu.
    expect(item("Exportar").querySelector('[data-slot="menu-mark"]')).toBeNull();
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(menu()).toBeNull());
    await user.keyboard("{Enter}");
    await waitFor(() => expect(menu()).not.toBeNull());
    const reopened = item("Agrupar por série");
    expect(reopened.getAttribute("aria-checked")).toBe("false");
    expect(reopened.querySelector('[data-slot="menu-mark"] svg')).toBeNull();
  });

  it("disabled_item_is_skipped_and_does_not_fire", async () => {
    const onremove = vi.fn();
    const { user } = await openMenu({ onremove });
    const removeItem = item("Remover");
    expect(removeItem.getAttribute("aria-disabled")).toBe("true");
    expect(removeItem.matches(await selectorFor("data-disabled:text-disabled-foreground"))).toBe(true);
    // The arrows skip it, as on macOS: from «Agrupar» straight to «Mostrar no Finder».
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(highlighted()?.textContent).toContain("Mostrar no Finder");
    await user.click(removeItem);
    expect(onremove).not.toHaveBeenCalled();
    expect(menu()).not.toBeNull();
  });

  it("separator_uses_border_and_spacing", async () => {
    await openMenu();
    const separator = document.querySelector<HTMLElement>('[data-slot="dropdown-menu-separator"]')!;
    expect(separator.getAttribute("role")).toBe("separator");
    await expectBindings(separator, SEPARATOR_BINDINGS);
    expect(colourClasses(separator)).toEqual(["bg-border"]);
  });

  it("open_and_close_durations", async () => {
    const { content, user, trigger } = await openMenu();
    expect(content.getAttribute("data-state")).toBe("open");
    await expectBindings(content, MOTION_BINDINGS);
    for (const utility of ["data-open:animate-in", "data-open:duration-(--duration-in)"]) {
      expect(content.matches(await selectorFor(utility)), utility).toBe(true);
    }
    expect(content.matches(await selectorFor("data-closed:duration-(--duration-out)"))).toBe(false);
    const { css } = await compileAppCss(["data-closed:motion-reduce:zoom-out-100"]);
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect([...content.classList].filter((c) => /slide|translate|spin|rotate/.test(c))).toEqual([]);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(menu()).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
});
