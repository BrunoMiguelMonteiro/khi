import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss } from "$lib/test/css";
import type { Highlight as HighlightData } from "$lib/types";
import { Highlight } from "./index";

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

const slot = (root: ParentNode, name: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${name}"]`);

function must(el: HTMLElement | null, what: string): HTMLElement {
  if (!el) throw new Error(`no ${what} rendered`);
  return el;
}

const DATA: HighlightData = {
  id: "h1",
  text: "Tudo o que é sólido desmancha no ar.",
  dateCreated: "2026-11-10T12:00:00Z",
  annotation: null,
  chapterTitle: "Capítulo 2",
  containerPath: null,
  removedAt: null,
  chapterProgress: null,
};

function renderHighlight(
  highlight: Partial<HighlightData> = {},
  props: Record<string, unknown> = {},
) {
  const result = render(Highlight, {
    props: { highlight: { ...DATA, ...highlight }, ...props },
  });
  const root = must(slot(result.container, "highlight"), "highlight");
  return { ...result, root, line: must(slot(root, "highlight-line"), "line") };
}

const copyButton = () => screen.getByRole("button", { name: "Copy quote" });

describe("Highlight", () => {
  it("line_token_per_state", async () => {
    const expected = {
      normal: ["bg-highlight-line", "var(--highlight-line)"],
      novo: ["bg-highlight-line-new", "var(--highlight-line-new)"],
    } as const;
    for (const state of ["normal", "novo"] as const) {
      const { line, unmount } = renderHighlight({}, { state });
      const [utility, css] = expected[state];
      expect(line.classList.contains(utility), `${state} → ${utility}`).toBe(
        true,
      );
      expect(await ruleOf(utility), utility).toContain(css);
      expect(line.classList.contains("w-(--stroke-highlight-line)")).toBe(true);
      expect(await ruleOf("w-(--stroke-highlight-line)")).toContain(
        "var(--stroke-highlight-line)",
      );
      unmount();
    }
  });

  it("removed_is_dashed_with_label", async () => {
    const { root, line } = renderHighlight({}, { state: "removido" });
    // 4 px dash, 4 px gap, in the Normal line colour.
    const dashed = line.className
      .split(/\s+/)
      .find((c) => c.includes("repeating-linear-gradient"));
    expect(dashed).toBeTruthy();
    expect(dashed).toContain("var(--highlight-line)_0_4px");
    expect(dashed).toContain("transparent_4px_8px");
    expect(line.classList.contains("bg-highlight-line")).toBe(false);
    const label = must(slot(root, "highlight-removed"), "removed label");
    expect(label.textContent?.trim()).toBe("Removed from Kobo");
    expect(label.classList).toContain("text-callout");
    expect(label.classList).toContain("text-tertiary-foreground");
    expect(label.querySelector("svg")?.getAttribute("aria-hidden")).toBe(
      "true",
    );
    expect(await ruleOf("text-tertiary-foreground")).toContain(
      "var(--tertiary-foreground)",
    );
  });

  it("note_icon_is_labelled_nota", () => {
    const { root } = renderHighlight({ annotation: "Voltar a isto" });
    const note = must(slot(root, "highlight-note"), "note");
    expect(note.textContent).toContain("Voltar a isto");
    expect(note.classList).toContain("text-body");
    expect(note.classList).toContain("text-muted-foreground");
    const icon = note.querySelector("svg");
    expect(icon?.getAttribute("role")).toBe("img");
    expect(icon?.getAttribute("aria-label")).toBe("Note");
    expect(screen.getByRole("img", { name: "Note" })).toBe(icon);
  });

  it("note_is_absent_when_blank", () => {
    const { root } = renderHighlight({ annotation: "  " });
    expect(slot(root, "highlight-note")).toBeNull();
  });

  it("copy_button_appears_on_focus_and_is_next_tab_stop", async () => {
    const user = userEvent.setup();
    const { root } = renderHighlight(
      { annotation: "Nota" },
      { oncopy: vi.fn() },
    );
    // Hover and focus share one fade of 120 ms (ease-hover), and Reduzir movimento keeps it.
    for (const c of [
      "hover:bg-accent",
      "focus-within:bg-accent",
      "p-4",
      "-m-4",
      "transition-colors",
      "duration-hover",
      "ease-hover",
    ])
      expect(root.classList.contains(c), c).toBe(true);
    expect(root.className).not.toMatch(/motion-reduce/);
    const button = copyButton();
    for (const c of [
      "opacity-0",
      "group-hover/highlight:opacity-100",
      "group-focus-within/highlight:opacity-100",
      "size-6",
    ])
      expect(button.classList.contains(c), c).toBe(true);
    // Hidden at rest, but still the next stop after the text: the first Tab lands on it.
    expect(button.tabIndex).toBe(0);
    await user.tab();
    expect(document.activeElement).toBe(button);
    await user.tab();
    expect(document.activeElement).not.toBe(button);
  });
});

describe("Highlight copy", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("copy_shows_check_for_2s", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const oncopy = vi.fn().mockResolvedValue(true);
    renderHighlight({}, { oncopy });
    await user.click(copyButton());
    expect(oncopy).toHaveBeenCalledTimes(1);
    const button = screen.getByRole("button", { name: "Copied!" });
    expect(button.querySelector(".lucide-check")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(1999);
    expect(screen.getByRole("button", { name: "Copied!" })).toBe(button);
    await vi.advanceTimersByTimeAsync(2);
    expect(screen.getByRole("button", { name: "Copy quote" })).toBe(button);
    expect(button.querySelector(".lucide-copy")).not.toBeNull();
  });

  it("copy_error_label", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const oncopy = vi.fn().mockResolvedValue(false);
    renderHighlight({}, { oncopy });
    await user.click(copyButton());
    const button = screen.getByRole("button", { name: "Copy failed" });
    expect(button.querySelector(".lucide-check")).toBeNull();
    await vi.advanceTimersByTimeAsync(2001);
    expect(screen.getByRole("button", { name: "Copy quote" })).toBe(button);
  });

  it("copies_the_quote_to_the_clipboard_by_default", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderHighlight();
    await user.click(copyButton());
    expect(writeText).toHaveBeenCalledWith(DATA.text);
    vi.unstubAllGlobals();
  });
});

describe("Highlight name", () => {
  it("accessible_summary_reads_chapter_date_new_note", () => {
    const { root, unmount } = renderHighlight(
      { annotation: "Nota" },
      { state: "novo" },
    );
    expect(root.getAttribute("role")).toBe("group");
    expect(root.getAttribute("aria-label")).toBe(
      "Capítulo 2, November 10, new, with note",
    );
    unmount();
    const plain = renderHighlight({ chapterTitle: null });
    expect(plain.root.getAttribute("aria-label")).toBe("November 10");
  });

  it("summary_and_removed_strings_are_approved_in_both_locales", async () => {
    const pt = (await import("$lib/i18n/locales/pt.json")).default.highlight;
    const en = (await import("$lib/i18n/locales/en.json")).default.highlight;
    expect([pt.new, pt.withNote, pt.removedFromKobo]).toEqual([
      "novo",
      "com nota",
      "Removido do Kobo",
    ]);
    expect([en.new, en.withNote, en.removedFromKobo]).toEqual([
      "new",
      "with note",
      "Removed from Kobo",
    ]);
  });
});
