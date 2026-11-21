import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { compileAppCss, selectorFor } from "$lib/test/css";
import { dismiss, notify } from "./index";
import Fixture from "./toast.fixture.svelte";

type Binding = { binding: string; utility: string; css: string };

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

async function expectBindings(el: Element, bindings: Binding[]) {
  for (const { binding, utility, css } of bindings) {
    expect(el.classList.contains(utility), `${binding} → ${utility}`).toBe(
      true,
    );
    expect(await ruleOf(utility), utility).toContain(css);
  }
}

const region = () =>
  document.querySelector<HTMLElement>('[data-slot="toaster"]');
const toasts = () => [
  ...document.querySelectorAll<HTMLElement>('[data-slot="toast"]'),
];
const toast = () => toasts()[0] ?? null;

const advance = async (ms: number) => {
  await vi.advanceTimersByTimeAsync(ms);
  await tick();
};

// Fake timers drive the hold, the exit and user-event's own pauses.
const setup = () => {
  const { unmount } = render(Fixture);
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  return { user, unmount };
};

const TEXT = "3 livros exportados";
const ACTION = "Mostrar no Finder";

// Componentes (D7) · 14 · Aviso (57:6346): each Figma binding and the one class that carries it.
const TOAST_BINDINGS: Binding[] = [
  {
    binding: "spacing/4 (left, right)",
    utility: "px-4",
    css: "padding-inline: calc(var(--spacing) * 4);",
  },
  {
    binding: "spacing/2 (top, bottom)",
    utility: "py-2",
    css: "padding-block: calc(var(--spacing) * 2);",
  },
  {
    binding: "spacing/2 (item spacing)",
    utility: "gap-2",
    css: "gap: calc(var(--spacing) * 2);",
  },
  {
    binding: "radius/group",
    utility: "rounded-group",
    css: "border-radius: var(--radius-group);",
  },
  {
    binding: "popover (fill)",
    utility: "bg-popover",
    css: "background-color: var(--popover);",
  },
  {
    binding: "stroke/border (inside)",
    utility: "border-(length:--stroke-border)",
    css: "border-width: var(--stroke-border);",
  },
  {
    binding: "border (stroke)",
    utility: "border-border",
    css: "border-color: var(--border);",
  },
  {
    binding: "Sombra/Aviso",
    utility: "shadow-sombra-aviso",
    css: "--tw-shadow: 0 4px 16px var(--tw-shadow-color, rgb(0 0 0 / 0.14));",
  },
];

const ICON_BINDINGS: Binding[] = [
  {
    binding: "size/icon 16",
    utility: "size-icon",
    css: "width: var(--size-icon);",
  },
  {
    binding: "foreground (icon)",
    utility: "text-foreground",
    css: "color: var(--foreground);",
  },
];

const TEXT_BINDINGS: Binding[] = [
  {
    binding: "Interface/Body Medium",
    utility: "text-body-medium",
    css: "font-size: 13px;\n    line-height: 16px;\n    font-weight: 500;",
  },
  {
    binding: "foreground (text)",
    utility: "text-foreground",
    css: "color: var(--foreground);",
  },
];

// Movimento 3: in over duration/toast-in with a fade and distance/enter from below, ease/out; out
// over duration/in with the inverse; Movimento 6: with Reduzir movimento only the fades stay.
const MOTION_BINDINGS: Binding[] = [
  { binding: "enter", utility: "animate-in", css: "animation: enter" },
  {
    binding: "fade in from 0",
    utility: "fade-in-0",
    css: "--tw-enter-opacity: 0;",
  },
  {
    binding: "distance/enter from below",
    utility: "slide-in-from-bottom-(length:--distance-enter)",
    css: "--tw-enter-translate-y: var(--distance-enter);",
  },
  {
    binding: "duration/toast-in",
    utility: "duration-(--duration-toast-in)",
    css: "--tw-duration: var(--duration-toast-in);",
  },
  {
    binding: "ease/out",
    utility: "ease-out",
    css: "--tw-ease: var(--ease-out);",
  },
  {
    binding: "exit",
    utility: "data-closed:animate-out",
    css: "animation: exit",
  },
  {
    binding: "fade out to 0",
    utility: "data-closed:fade-out-0",
    css: "--tw-exit-opacity: 0;",
  },
  {
    binding: "distance/enter, inverse",
    utility: "data-closed:slide-out-to-bottom-(length:--distance-enter)",
    css: "--tw-exit-translate-y: var(--distance-enter);",
  },
  {
    binding: "duration/in (exit)",
    utility: "data-closed:duration-(--duration-in)",
    css: "--tw-duration: var(--duration-in);",
  },
  {
    binding: "stays faded until removed",
    utility: "data-closed:fill-mode-forwards",
    css: "animation-fill-mode: forwards;",
  },
];

const REDUCED_MOTION: Binding[] = [
  {
    binding: "no slide in",
    utility: "motion-reduce:slide-in-from-bottom-0",
    css: "--tw-enter-translate-y: calc(0*100%);",
  },
  {
    binding: "no slide out",
    utility: "motion-reduce:data-closed:slide-out-to-bottom-0",
    css: "--tw-exit-translate-y: calc(0*100%);",
  },
];

describe("Toast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(async () => {
    dismiss();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it("announces_politely", async () => {
    setup();
    // The live region is in the DOM before the toast, so VoiceOver hears the addition.
    const live = region();
    expect(live).not.toBeNull();
    expect(live!.getAttribute("aria-live")).toBe("polite");
    expect(live!.getAttribute("aria-atomic")).toBe("true");
    expect(live!.textContent?.trim()).toBe("");

    notify(TEXT);
    await tick();
    expect(live!.contains(toast())).toBe(true);
    expect(live!.textContent?.trim()).toBe(TEXT);
    // Polite, not an alert: no assertive region and no alert role anywhere.
    expect(
      document.querySelector('[aria-live="assertive"], [role="alert"]'),
    ).toBeNull();
    // The icon is decorative, so the region reads the text alone.
    expect(toast()!.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
  });

  it("stays_4s_then_leaves", async () => {
    setup();
    notify(TEXT);
    await tick();
    expect(toast()!.dataset.state).toBe("open");
    // Movimento 3: 300 ms in, then the 4 s hold, then out; the entry does not eat the hold.
    await advance(300 + 3999);
    expect(toast()!.dataset.state).toBe("open");
    await advance(1);
    // Hold over: it starts the exit, which the exit classes select…
    const leaving = toast()!;
    expect(leaving.dataset.state).toBe("closed");
    expect(leaving.matches(await selectorFor("data-closed:animate-out"))).toBe(
      true,
    );
    // …and leaves the DOM when the 200 ms exit ends.
    await advance(199);
    expect(toast()).toBe(leaving);
    await advance(1);
    expect(toast()).toBeNull();
  });

  it("pauses_on_hover_and_resumes_remaining_time", async () => {
    const { user } = setup();
    notify(TEXT);
    await tick();
    await advance(300 + 1000);
    await user.hover(toast()!);
    await advance(10_000);
    expect(toast()!.dataset.state).toBe("open");
    await user.unhover(toast()!);
    // 3 s of the hold were left when the pointer arrived.
    await advance(2999);
    expect(toast()!.dataset.state).toBe("open");
    await advance(1);
    expect(toast()!.dataset.state).toBe("closed");
  });

  it("pauses_on_focus_and_resumes_remaining_time", async () => {
    const { user } = setup();
    notify(TEXT, { action: { label: ACTION, onClick: () => {} } });
    await tick();
    await advance(300 + 1000);
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: ACTION }),
    );
    await advance(10_000);
    expect(toast()!.dataset.state).toBe("open");
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Antes" }),
    );
    // 3 s were left when the focus arrived.
    await advance(2999);
    expect(toast()!.dataset.state).toBe("open");
    await advance(1);
    expect(toast()!.dataset.state).toBe("closed");
  });

  it("hold_starts_when_entry_animation_ends", async () => {
    setup();
    notify(TEXT);
    await tick();
    await advance(100);
    // The enter animation ended before the 300 ms fallback: the hold counts from here.
    await fireEvent.animationEnd(toast()!);
    await advance(3999);
    expect(toast()!.dataset.state).toBe("open");
    await advance(1);
    expect(toast()!.dataset.state).toBe("closed");
  });

  it("paused_during_entry_keeps_full_hold", async () => {
    const { user } = setup();
    notify(TEXT);
    await tick();
    await advance(100);
    await user.hover(toast()!);
    await advance(10_000);
    expect(toast()!.dataset.state).toBe("open");
    await user.unhover(toast()!);
    // The hold never started, so all 4 s are left.
    await advance(3999);
    expect(toast()!.dataset.state).toBe("open");
    await advance(1);
    expect(toast()!.dataset.state).toBe("closed");
  });

  it("replaced_under_pointer_stays_paused", async () => {
    const { user } = setup();
    notify("Primeiro");
    await tick();
    await advance(300 + 1000);
    await user.hover(toast()!);
    // A new toast takes the place of the hovered one while the pointer stays still.
    notify(TEXT);
    await tick();
    expect(toast()!.textContent).toContain(TEXT);
    await advance(10_000);
    expect(toast()!.dataset.state).toBe("open");
    // user-event still places its pointer on the removed toast: move it to the new one first.
    await user.hover(toast()!);
    await user.unhover(toast()!);
    await advance(3999);
    expect(toast()!.dataset.state).toBe("open");
    await advance(1);
    expect(toast()!.dataset.state).toBe("closed");
  });

  it("replaced_after_focus_counts_again", async () => {
    const { user } = setup();
    notify("Primeiro", { action: { label: ACTION, onClick: () => {} } });
    await tick();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: ACTION }),
    );
    // The focused action leaves with its toast, so nothing holds the new one.
    notify(TEXT);
    await tick();
    expect(toast()!.contains(document.activeElement)).toBe(false);
    await advance(300 + 3999);
    expect(toast()!.dataset.state).toBe("open");
    await advance(1);
    expect(toast()!.dataset.state).toBe("closed");
  });

  it("unmount_while_paused_drops_toast", async () => {
    const { user, unmount } = setup();
    notify(TEXT, { action: { label: ACTION, onClick: () => {} } });
    await tick();
    await advance(300 + 1000);
    await user.hover(toast()!);
    // The Toaster goes away with the pointer still on the toast, without dismiss().
    unmount();
    await advance(4500);
    setup();
    await tick();
    expect(toast()).toBeNull();
    expect(region()!.textContent?.trim()).toBe("");
  });

  it("action_is_link_styled_button", async () => {
    const { user } = setup();
    const onClick = vi.fn();
    notify(TEXT, { action: { label: ACTION, onClick } });
    await tick();
    const action = screen.getByRole("button", { name: ACTION });
    expect(action.getAttribute("type")).toBe("button");
    // Text in the link tone, not a Botão instance (no fill, no height, no side padding).
    await expectBindings(action, [
      ...TEXT_BINDINGS.filter((b) => b.utility !== "text-foreground"),
      {
        binding: "link (text)",
        utility: "text-link",
        css: "color: var(--link);",
      },
      {
        binding: "underline on hover",
        utility: "hover:underline",
        css: "text-decoration-line: underline;",
      },
      {
        binding: "focus ring (Task 5)",
        utility: "focus-visible:focus-ring",
        css: "outline:",
      },
    ]);
    expect(
      [...action.classList].filter((c) => /^(bg-|h-|px-|border)/.test(c)),
    ).toEqual([]);
    await user.click(action);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("error_toast_carries_the_alert_icon_and_keeps_the_action", async () => {
    setup();
    notify(TEXT);
    await tick();
    expect(toast()!.querySelector("svg")?.getAttribute("class")).toContain("circle-check");

    // Task 47: the export that failed (Detail) says so with circle-alert, and keeps its action
    const onClick = vi.fn();
    notify("Couldn’t export to ~/Documents/Kobo.", {
      icon: "error",
      action: { label: "Choose Folder…", onClick },
    });
    await tick();
    const svg = toast()!.querySelector("svg");
    expect(svg?.getAttribute("class")).toContain("circle-alert");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("button", { name: "Choose Folder…" })).toBeTruthy();
  });

  it("dismiss_by_id_closes_only_that_toast", async () => {
    setup();
    const first = notify("one");
    await tick();
    const second = notify("two");
    await tick();
    expect(first).not.toBe(second);

    // The first is gone already: its id closes nothing
    dismiss(first);
    await advance(50);
    expect(toast()?.getAttribute("data-state")).toBe("open");

    dismiss(second);
    await advance(50);
    expect(toast()?.getAttribute("data-state")).toBe("closed");
  });

  it("is_capped_to_the_window_and_keeps_its_action_whole", async () => {
    setup();
    notify("A very long text ".repeat(20), {
      action: { label: ACTION, onClick: vi.fn() },
    });
    await tick();
    const el = toast()!;
    await expectBindings(el, [
      { binding: "window less 24 px a side", utility: "max-w-[calc(100%-3rem)]", css: "max-width: calc(100% - 3rem);" },
    ]);
    // The text gives way with an ellipsis; the icon and the action never shrink
    const text = el.querySelector('[data-slot="toast-text"]')!;
    expect(text.classList.contains("truncate")).toBe(true);
    expect(text.classList.contains("min-w-0")).toBe(true);
    expect(el.querySelector('[data-slot="toast-action"]')!.classList.contains("shrink-0")).toBe(true);
    expect(await ruleOf("truncate")).toContain("text-overflow: ellipsis;");
  });

  it("only_one_visible", async () => {
    setup();
    notify("Primeiro");
    await tick();
    await advance(1000);
    notify(TEXT);
    await tick();
    expect(toasts()).toHaveLength(1);
    expect(toast()!.textContent).toContain(TEXT);
    expect(region()!.textContent).not.toContain("Primeiro");
    // The new one gets its own entry and 4 s.
    await advance(300 + 3999);
    expect(toast()!.dataset.state).toBe("open");
    await advance(1);
    expect(toast()!.dataset.state).toBe("closed");
  });

  it("matches_figma_bindings", async () => {
    setup();
    notify(TEXT, { action: { label: ACTION, onClick: () => {} } });
    await tick();
    const el = toast()!;
    await expectBindings(el, [...TOAST_BINDINGS, ...MOTION_BINDINGS]);
    await expectBindings(el.querySelector("svg")!, ICON_BINDINGS);
    await expectBindings(
      el.querySelector('[data-slot="toast-text"]')!,
      TEXT_BINDINGS,
    );
    // Bottom centre, 24 px from the window edge, above the content.
    await expectBindings(region()!, [
      {
        binding: "24 px from the bottom",
        utility: "bottom-6",
        css: "bottom: calc(var(--spacing) * 6);",
      },
      {
        binding: "centred",
        utility: "justify-center",
        css: "justify-content: center;",
      },
      {
        binding: "over the content",
        utility: "fixed",
        css: "position: fixed;",
      },
    ]);
    // Order: icon, text, link.
    expect([...el.children].map((c) => c.tagName.toLowerCase())).toEqual([
      "svg",
      "span",
      "button",
    ]);
  });

  it("reduced_motion_keeps_fade", async () => {
    setup();
    notify(TEXT);
    await tick();
    const el = toast()!;
    await expectBindings(el, REDUCED_MOTION);
    for (const { utility } of REDUCED_MOTION) {
      expect(await ruleOf(utility), utility).toContain(
        "prefers-reduced-motion: reduce",
      );
    }
    // The fades are not reset.
    expect(
      [...el.classList].filter((c) =>
        /^motion-reduce:.*(fade|animate-none)/.test(c),
      ),
    ).toEqual([]);
    // tokens.css also zeroes distance/enter under Reduzir movimento (Review Focus 5).
    const tokens = readFileSync(
      resolve(process.cwd(), "src/lib/styles/tokens.css"),
      "utf8",
    );
    expect(tokens).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{\s*--distance-enter: 0px;/,
    );
  });
});
