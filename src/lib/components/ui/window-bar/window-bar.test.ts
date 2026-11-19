import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import { compileAppCss } from "$lib/test/css";
import { expectDisabledInert } from "$lib/test/disabled";
import Fixture from "./window-bar.fixture.svelte";

// jsdom has no pointer capture, which Bits UI's triggers release on pointerdown.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

const locale = (lang: "pt" | "en") =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), `src/lib/i18n/locales/${lang}.json`),
      "utf8",
    ),
  );

const READERS = [
  { id: 1, name: "Ana" },
  { id: 2, name: "Rui" },
];

const LIBRARY = {
  screen: "library" as const,
  readers: READERS,
  activeReaderId: 1,
  exportCount: 3,
};

function renderBar(props: Record<string, unknown> = {}) {
  const result = render(Fixture, { props: { ...LIBRARY, ...props } });
  const bar = document.querySelector<HTMLElement>('[data-slot="window-bar"]');
  if (!bar) throw new Error("no window bar rendered");
  return { ...result, bar };
}

const tooltip = () =>
  document.querySelector<HTMLElement>(
    '[data-slot="tooltip-content"]:not([data-state="closed"])',
  );

/** Everything focusable or named in the bar, in document order. */
const controls = (bar: HTMLElement) => [
  ...bar.querySelectorAll<HTMLElement>('button, [role="radiogroup"]'),
];

afterEach(() => vi.useRealTimers());

describe("WindowBar", () => {
  it("library_has_title_view_sort_sync_export_in_order", async () => {
    const { bar } = renderBar();
    const title = screen.getByRole("button", { name: "Ana's Library" });
    const view = screen.getByRole("radiogroup", { name: "View" });
    const sort = screen.getByRole("button", { name: "Sort by" });
    const sync = screen.getByRole("button", { name: "Sync with the Kobo" });
    const exportButton = screen.getByRole("button", { name: "Export 3 books" });
    const order = controls(bar);
    const at = (el: HTMLElement) => order.indexOf(el);
    expect([title, view, sort, sync, exportButton].map(at)).toEqual(
      [title, view, sort, sync, exportButton].map(at).sort((a, b) => a - b),
    );
    expect(new Set([title, view, sort, sync, exportButton].map(at)).size).toBe(
      5,
    );
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(sort.querySelector("svg.lucide-arrow-up-down")).not.toBeNull();
    expect(sync.querySelector("svg.lucide-refresh-cw")).not.toBeNull();
    expect(exportButton.querySelector("svg.lucide-download")).not.toBeNull();
    for (const c of [
      "h-toolbar",
      "px-4",
      "gap-4",
      "bg-background",
      "border-b",
      "border-border",
    ])
      expect(bar.classList.contains(c), c).toBe(true);
    expect(await ruleOf("h-toolbar")).toContain("height: var(--size-toolbar)");
    expect(await ruleOf("bg-background")).toContain("var(--background)");
  });

  it("sort_menu_lists_options_with_check_and_calls_onsort", async () => {
    const user = userEvent.setup();
    const onsort = vi.fn();
    renderBar({ sort: "author", onsort });
    await user.click(screen.getByRole("button", { name: "Sort by" }));
    await waitFor(() =>
      expect(
        document.querySelectorAll('[data-slot="dropdown-menu-item"]').length,
      ).toBe(4),
    );
    const rows = [
      ...document.querySelectorAll<HTMLElement>(
        '[data-slot="dropdown-menu-item"]',
      ),
    ];
    expect(rows.map((r) => r.textContent?.trim())).toEqual([
      "Title (A-Z)",
      "Author (A-Z)",
      "Recently Read",
      "Highlight Count",
    ]);
    expect(rows.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false",
      "false",
    ]);
    await user.click(rows[3]);
    expect(onsort).toHaveBeenCalledWith("highlight_count");
  });

  it("detail_has_back_and_export_and_optional_delete", async () => {
    const onback = vi.fn();
    const user = userEvent.setup();
    const { bar, unmount } = renderBar({
      screen: "detail",
      exportCount: 1,
      onback,
    });
    const back = screen.getByRole("button", { name: "Back" });
    const exportButton = screen.getByRole("button", { name: "Export 1 book" });
    expect(back.querySelector("svg.lucide-chevron-left")).not.toBeNull();
    expect(back.compareDocumentPosition(exportButton)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.queryByRole("button", { name: "Delete book…" })).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sort by" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Sync with the Kobo" }),
    ).toBeNull();
    expect(bar.textContent).not.toContain("Library");
    await user.click(back);
    expect(onback).toHaveBeenCalledTimes(1);
    unmount();

    renderBar({ screen: "detail", exportCount: 1, canDelete: true });
    const del = screen.getByRole("button", { name: "Delete book…" });
    expect(del.querySelector("svg.lucide-trash-2")).not.toBeNull();
    expect(
      del.compareDocumentPosition(
        screen.getByRole("button", { name: "Export 1 book" }),
      ),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("tooltips_are_the_approved_strings", async () => {
    const pt = locale("pt").ui;
    // The words, in pt.json, one by one.
    expect(pt.windowBar).toMatchObject({
      sync: "Sincronizar com o Kobo",
      export_one: "Exportar 1 livro",
      export_other: "Exportar {count} livros",
      back: "Voltar",
      delete: "Apagar livro…",
      sort: "Ordenar por",
    });
    expect([pt.viewGroup.gridTooltip, pt.viewGroup.listTooltip]).toEqual([
      "Grelha",
      "Lista",
    ]);
    expect(locale("en").ui.windowBar).toMatchObject({
      sync: "Sync with the Kobo",
      export_one: "Export 1 book",
      export_other: "Export {count} books",
      back: "Back",
      delete: "Delete book…",
      sort: "Sort by",
    });

    // And on screen, with the shortcuts, in the app's test language (en).
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBar({ screen: "library", canDelete: true });
    const library: [string, string][] = [
      ["Sync with the Kobo", "Sync with the Kobo ⌘R"],
      ["Export 3 books", "Export 3 books ⌘E"],
      ["Sort by", "Sort by"],
      ["View as grid", "Grid ⌘1"],
      ["View as list", "List ⌘2"],
    ];
    for (const [name, text] of library) {
      const el = screen.getByRole(
        name.startsWith("View") ? "radio" : "button",
        { name },
      );
      await user.hover(el);
      await vi.advanceTimersByTimeAsync(500);
      await tick();
      expect(tooltip()?.textContent, name).toBe(text);
      await user.unhover(el);
      await tick();
    }
    document.body.innerHTML = "";
  });

  it("detail_tooltips_have_shortcuts", async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderBar({ screen: "detail", canDelete: true });
    for (const [name, text] of [
      ["Back", "Back ⌘["],
      ["Delete book…", "Delete book… ⌘⌫"],
      ["Export 3 books", "Export 3 books ⌘E"],
    ]) {
      const el = screen.getByRole("button", { name });
      await user.hover(el);
      await vi.advanceTimersByTimeAsync(500);
      await tick();
      expect(tooltip()?.textContent, name).toBe(text);
      await user.unhover(el);
      await tick();
    }
  });
});

describe("WindowBar sync", () => {
  const spinner = () =>
    screen
      .getByRole("button", { name: "Sync with the Kobo" })
      .querySelector("svg") as SVGElement;
  const spins = () =>
    [...spinner().closest("button")!.classList].some((c) =>
      c.includes("animate-spin"),
    );

  it("sync_stop_waits_for_animationiteration", async () => {
    const { rerender } = renderBar({ syncing: true });
    expect(spins()).toBe(true);
    await rerender({ ...LIBRARY, syncing: false });
    // Still turning: it stops at the end of the lap, not when the sync ends.
    expect(spins()).toBe(true);
    spinner().dispatchEvent(new Event("animationiteration", { bubbles: true }));
    await tick();
    expect(spins()).toBe(false);
  });

  it("iteration_during_sync_keeps_turning_and_resync_restarts", async () => {
    const { rerender } = renderBar({ syncing: true });
    spinner().dispatchEvent(new Event("animationiteration", { bubbles: true }));
    await tick();
    expect(spins()).toBe(true);
    await rerender({ ...LIBRARY, syncing: false });
    await rerender({ ...LIBRARY, syncing: true });
    spinner().dispatchEvent(new Event("animationiteration", { bubbles: true }));
    await tick();
    expect(spins()).toBe(true);
  });

  /** A controllable (prefers-reduced-motion: reduce) for the test; the original is restored after. */
  function mockReducedMotion(initial: boolean) {
    const original = window.matchMedia;
    const listeners = new Set<(e: { matches: boolean }) => void>();
    let matches = initial;
    window.matchMedia = ((query: string) => ({
      get matches() {
        return query.includes("reduce") && matches;
      },
      media: query,
      addEventListener: (_: string, l: (e: { matches: boolean }) => void) =>
        listeners.add(l),
      removeEventListener: (_: string, l: (e: { matches: boolean }) => void) =>
        listeners.delete(l),
    })) as unknown as typeof window.matchMedia;
    return {
      set(value: boolean) {
        matches = value;
        for (const l of listeners) l({ matches: value });
      },
      restore: () => (window.matchMedia = original),
    };
  }

  it("reduced_motion_never_leaves_a_stale_spin", async () => {
    const media = mockReducedMotion(true);
    try {
      const { rerender } = renderBar({ syncing: true });
      await tick();
      expect(spins()).toBe(false);
      await rerender({ ...LIBRARY, syncing: false });
      media.set(false);
      await tick();
      expect(spins()).toBe(false);
    } finally {
      media.restore();
    }
  });

  it("turning_off_reduced_motion_mid_sync_resumes_and_turning_it_on_stops", async () => {
    const media = mockReducedMotion(false);
    try {
      renderBar({ syncing: true });
      await tick();
      expect(spins()).toBe(true);
      media.set(true);
      await tick();
      expect(spins()).toBe(false);
      media.set(false);
      await tick();
      expect(spins()).toBe(true);
    } finally {
      media.restore();
    }
  });

  it("switching_to_detail_and_back_after_the_sync_ended_is_not_turning", async () => {
    const { rerender } = renderBar({ syncing: true });
    await rerender({ ...LIBRARY, syncing: false });
    expect(spins()).toBe(true);
    await rerender({ ...LIBRARY, screen: "detail", syncing: false });
    await rerender({ ...LIBRARY, syncing: false });
    expect(spins()).toBe(false);
  });

  it("spin_is_1s_linear_and_off_with_reduced_motion", async () => {
    renderBar({ syncing: true });
    const button = screen.getByRole("button", { name: "Sync with the Kobo" });
    const classes = [...button.classList];
    expect(classes).toContain("[&_svg]:animate-spin");
    expect(classes).toContain("motion-reduce:[&_svg]:animate-none");
    expect(await ruleOf("[&_svg]:animate-spin")).toContain(
      "animation: var(--animate-spin)",
    );
    const { css } = await compileAppCss(["animate-spin"]);
    expect(css).toMatch(/--animate-spin:\s*spin 1s linear infinite/);
  });

  it("disabled_sync_is_inert_and_explains_itself", async () => {
    const onsync = vi.fn();
    renderBar({ onsync, syncDisabledReason: "Connect the Kobo to sync" });
    const button = screen.getByRole("button", { name: "Sync with the Kobo" });
    await expectDisabledInert({
      control: button,
      read: () => button.getAttribute("aria-disabled"),
      callback: onsync,
      reason: "Connect the Kobo to sync",
    });
  });

  it("enabled_sync_calls_onsync", async () => {
    const user = userEvent.setup();
    const onsync = vi.fn();
    renderBar({ onsync });
    await user.click(
      screen.getByRole("button", { name: "Sync with the Kobo" }),
    );
    expect(onsync).toHaveBeenCalledTimes(1);
  });
});
