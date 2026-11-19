import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { compileAppCss, selectorFor } from "$lib/test/css";
import Fixture from "./tooltip.fixture.svelte";

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

/** The open tooltip; a closing one stays in the DOM, hidden, until the next frame. */
const tooltip = () =>
  document.querySelector<HTMLElement>('[data-slot="tooltip-content"]:not([data-state="closed"])');
const anyTooltip = () => document.querySelector<HTMLElement>('[data-slot="tooltip-content"]');

// Fake timers drive both the Bits UI delays and user-event's own pauses.
const setup = () => {
  render(Fixture);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const sync = screen.getByRole("button", { name: "Sincronizar" });
  const exportar = screen.getByRole("button", { name: "Exportar" });
  return { user, sync, exportar };
};

const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  await tick();
};

// Componentes (D7) · 7 · Tooltip (55:2128): each Figma binding and the one class that carries it.
const FIGMA_BINDINGS = [
  // Height 24 is fixed in the Figma and not bound to a variable.
  { binding: "height 24 (fixed)", utility: "h-6", css: "height: calc(var(--spacing) * 6);" },
  // Figma binds spacing/2 to paddingLeft/paddingRight only; top/bottom are 0.
  {
    binding: "spacing/2 (left, right)",
    utility: "px-2",
    css: "padding-inline: calc(var(--spacing) * 2);",
  },
  {
    binding: "spacing/4 (item spacing, text → shortcut)",
    utility: "gap-4",
    css: "gap: calc(var(--spacing) * 4);",
  },
  {
    binding: "radius/control",
    utility: "rounded-control",
    css: "border-radius: var(--radius-control);",
  },
  { binding: "tooltip (fill)", utility: "bg-tooltip", css: "background-color: var(--tooltip);" },
  // Stroke INSIDE: a CSS border sits inside the 24 px box (border-box).
  {
    binding: "stroke/border (inside)",
    utility: "border-(length:--stroke-border)",
    css: "border-width: var(--stroke-border);",
  },
  {
    binding: "tooltip-border (stroke)",
    utility: "border-tooltip-border",
    css: "border-color: var(--tooltip-border);",
  },
  {
    binding: "Interface/Callout",
    utility: "text-callout",
    css: "font-size: 12px;\n    line-height: 15px;\n    font-weight: 400;",
  },
  {
    binding: "tooltip-foreground (text)",
    utility: "text-tooltip-foreground",
    css: "color: var(--tooltip-foreground);",
  },
  // Movimento 5: the first tooltip fades in over duration/tooltip with ease-out.
  {
    binding: "fade in (first tooltip)",
    utility: "data-[state=delayed-open]:animate-in",
    css: '[data-state="delayed-open"] {\n    animation: enter',
  },
  {
    binding: "fade from opacity 0",
    utility: "data-[state=delayed-open]:fade-in-0",
    css: "--tw-enter-opacity: 0;",
  },
  {
    binding: "duration/tooltip",
    utility: "data-[state=delayed-open]:duration-(--duration-tooltip)",
    css: "--tw-duration: var(--duration-tooltip);",
  },
  {
    binding: "ease-out",
    utility: "data-[state=delayed-open]:ease-out",
    css: "--tw-ease: var(--ease-out);",
  },
];

describe("Tooltip", () => {
  // Figma 55:2128 and Movimento 6: with Reduzir movimento the tooltip keeps its opacity fade.
  it("reduced_motion_keeps_fade", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/components/ui/tooltip/tooltip-content.svelte", "utf8");
    expect(src).toContain("data-[state=delayed-open]:fade-in-0");
    expect(src).not.toMatch(/motion-reduce:/);
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens_after_500ms_of_hover", async () => {
    const { user, sync } = setup();
    await user.hover(sync);
    await advance(500);
    const content = tooltip();
    expect(content).not.toBeNull();
    expect(content!.textContent).toContain("Sincronizar com o Kobo");
    // The first one fades in: Bits UI marks it delayed-open, which the fade classes select.
    expect(content!.dataset.state).toBe("delayed-open");
    expect(content!.matches(await selectorFor("data-[state=delayed-open]:animate-in"))).toBe(true);
  });

  it("does_not_open_before_500ms", async () => {
    const { user, sync } = setup();
    await user.hover(sync);
    await advance(499);
    expect(tooltip()).toBeNull();
    await advance(1);
    expect(tooltip()).not.toBeNull();
  });

  it("opens_on_keyboard_focus", async () => {
    const { user, sync } = setup();
    await user.tab();
    expect(document.activeElement).toBe(sync);
    await tick();
    expect(tooltip()?.textContent).toContain("Sincronizar com o Kobo");
  });

  it("next_tooltip_opens_without_delay", async () => {
    const { user, sync, exportar } = setup();
    await user.hover(sync);
    await advance(500);
    expect(tooltip()?.textContent).toContain("Sincronizar com o Kobo");
    await user.hover(exportar);
    await tick();
    const next = tooltip();
    expect(next?.textContent).toBe("Exportar");
    // No fade on the next one: instant-open is not selected by the fade classes.
    expect(next!.dataset.state).toBe("instant-open");
    expect(next!.matches(await selectorFor("data-[state=delayed-open]:animate-in"))).toBe(false);
  });

  it("closes_immediately_on_leave", async () => {
    const { user, sync } = setup();
    await user.hover(sync);
    await advance(500);
    const content = tooltip()!;
    await user.unhover(sync);
    await tick();
    // Hidden at once, with no exit animation to play…
    expect(content.dataset.state).toBe("closed");
    expect(content.matches(await selectorFor("data-closed:hidden"))).toBe(true);
    expect(await ruleOf("data-closed:hidden")).toContain("display: none;");
    // …and out of the DOM on Bits UI's next frame, not after a duration.
    await advance(16);
    expect(anyTooltip()).toBeNull();
  });

  it("matches_figma_bindings", async () => {
    const { user, sync } = setup();
    await user.hover(sync);
    await advance(500);
    const content = tooltip()!;
    for (const { binding, utility, css } of FIGMA_BINDINGS) {
      expect(content.classList.contains(utility), `${binding} → ${utility}`).toBe(true);
      expect(await ruleOf(utility), utility).toContain(css);
    }
    // One fill, one stroke colour and one text colour: nothing else competes with them.
    const colours = [...content.classList].filter((c) =>
      /^(bg|border|text)-(?!callout$|\()/.test(c),
    );
    expect(colours.sort()).toEqual(["bg-tooltip", "border-tooltip-border", "text-tooltip-foreground"]);
    // No shadow, no exit animation (instant exit), no movement, no arrow.
    const leftovers = [...content.classList].filter((c) =>
      /(^|:)(shadow|animate-out|fade-out|zoom|slide|ring)/.test(c),
    );
    expect(leftovers).toEqual([]);
    expect(content.querySelector("[data-arrow], svg")).toBeNull();
    expect(content.classList.contains("data-closed:hidden")).toBe(true);
    expect(content.dataset.side).toBe("bottom");
  });

  it("shortcut_uses_secondary_foreground", async () => {
    const { user, sync } = setup();
    await user.hover(sync);
    await advance(500);
    const shortcut = tooltip()!.querySelector<HTMLElement>('[data-slot="tooltip-shortcut"]');
    expect(shortcut?.textContent).toBe("⌘R");
    expect(shortcut!.classList.contains("text-tooltip-secondary-foreground")).toBe(true);
    expect(await ruleOf("text-tooltip-secondary-foreground")).toContain(
      "color: var(--tooltip-secondary-foreground);",
    );
    // «Só texto»: no shortcut element at all.
    await user.hover(screen.getByRole("button", { name: "Exportar" }));
    await tick();
    expect(tooltip()!.querySelector('[data-slot="tooltip-shortcut"]')).toBeNull();
  });

  it("trigger_is_described_by_tooltip", async () => {
    const { user, sync } = setup();
    expect(sync.hasAttribute("aria-describedby")).toBe(false);
    await user.tab();
    await tick();
    const id = sync.getAttribute("aria-describedby");
    expect(id).toBeTruthy();
    const description = document.getElementById(id!);
    expect(description?.getAttribute("role")).toBe("tooltip");
    expect(description?.textContent).toBe("Sincronizar com o Kobo ⌘R");
    expect(screen.getByRole("tooltip")).toBe(description);
  });
});
