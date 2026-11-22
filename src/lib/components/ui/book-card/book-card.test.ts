import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { isInaccessible } from "@testing-library/dom";
import { compileAppCss } from "$lib/test/css";
import { BookCard, type BookCardBook } from "./index";

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

const locale = (lang: "pt" | "en") =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), `src/lib/i18n/locales/${lang}.json`),
      "utf8",
    ),
  );

const slot = (root: ParentNode, name: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${name}"]`);

function must(el: HTMLElement | null, what: string): HTMLElement {
  if (!el) throw new Error(`no ${what} rendered`);
  return el;
}

const RING = "group-focus-visible/card:focus-ring";

const MAIAS: BookCardBook = {
  id: 42,
  title: "Os Maias",
  author: "Eça de Queirós",
  highlightCount: 58,
  newCount: 11,
};

function renderCard(
  book: Partial<BookCardBook> = {},
  selected?: boolean,
  selecting?: boolean,
) {
  const result = render(BookCard, {
    props: { book: { ...MAIAS, ...book }, selected, selecting },
  });
  const card = screen.getByRole("gridcell");
  const cover = must(slot(card, "cover"), "cover");
  return {
    ...result,
    card,
    cover,
    frame: slot(card, "selection-frame"),
    box: slot(card, "selection-box"),
  };
}

describe("BookCard", () => {
  it("name_reads_title_author_counts", () => {
    const { card } = renderCard();
    // The card is the grid's cell: it takes the focus and the grid's selection.
    expect(card.classList).toContain("group/card");
    expect(card.tabIndex).toBe(0);
    expect(card).toBe(
      screen.getByRole("gridcell", {
        name: "Os Maias, Eça de Queirós, 58 highlights, 11 new",
      }),
    );
    // Read once: the painted cover and the text under it are not read again.
    for (const el of screen.getAllByText("Os Maias"))
      expect(isInaccessible(el)).toBe(true);
    expect(isInaccessible(screen.getByText("58"))).toBe(true);
    expect(isInaccessible(screen.getByText("11 new"))).toBe(true);
    expect(
      must(slot(card, "book-card-title"), "title").textContent?.trim(),
    ).toBe("Os Maias");
  });

  it("name_drops_the_new_count_when_there_is_none_and_uses_the_singular", () => {
    renderCard({ highlightCount: 1, newCount: 0 });
    expect(screen.getByRole("gridcell").getAttribute("aria-label")).toBe(
      "Os Maias, Eça de Queirós, 1 highlight",
    );
  });

  it("unknown_author_fallback", () => {
    expect(locale("pt").book.unknownAuthor).toBe("Autor desconhecido");
    expect(locale("en").book.unknownAuthor).toBe("Unknown author");
    for (const author of [undefined, "", "  "]) {
      const { card, unmount } = renderCard({ author });
      expect(card.getAttribute("aria-label")).toBe(
        "Os Maias, Unknown author, 58 highlights, 11 new",
      );
      expect(
        must(slot(card, "book-card-author"), "author").textContent?.trim(),
      ).toBe("Unknown author");
      unmount();
    }
  });

  it("selection_frame_is_175_by_260_from_a_fixed_cover", async () => {
    const { card, cover, frame } = renderCard({}, true);
    // The cover is fixed at 171 wide (2:3), so 2 px out on every side gives the 175 × 260 frame.
    const width = await ruleOf("w-42.75");
    expect(card.classList.contains("w-42.75")).toBe(true);
    expect(width).toContain("width: calc(var(--spacing) * 42.75);");
    const spacing = 4;
    const coverWidth = 42.75 * spacing;
    expect(cover.classList.contains("aspect-2/3")).toBe(true);
    const coverHeight = (coverWidth * 3) / 2;
    const out = 0.5 * spacing;
    expect(must(frame, "frame").classList.contains("-inset-0.5")).toBe(true);
    expect(coverWidth + 2 * out).toBe(175);
    expect(Math.floor(coverHeight + 2 * out)).toBe(260);
    // Nothing on the cover wrapper or the cover itself sets another size.
    const sizing = (el: Element) =>
      [...el.classList].filter((c) => /^(w|h|size|min-w|max-w)-/.test(c));
    expect(sizing(cover)).toEqual([]);
    expect(sizing(must(cover.parentElement, "wrapper"))).toEqual([]);
  });

  it("selected_sets_aria_selected_and_frame", async () => {
    const off = renderCard({}, false);
    expect(off.card.getAttribute("aria-selected")).toBe("false");
    expect(off.frame).toBeNull();
    off.unmount();

    const { card, cover, frame, box } = renderCard({}, true);
    expect(card.getAttribute("aria-selected")).toBe("true");
    // Componentes (D7) · 18 · Cartão do livro (65:4268), Seleção: 2 px out from the cover, 3 px primary stroke outside.
    const selection = must(frame, "selection frame");
    await expectBindings(selection, [
      {
        binding: "x −2 y −2 out from the cover",
        utility: "-inset-0.5",
        css: "inset: calc(var(--spacing) * -0.5);",
      },
      {
        binding: "radius/control",
        utility: "rounded-control",
        css: "border-radius: var(--radius-control);",
      },
      {
        binding: "stroke/ring, outside",
        utility: "ring-(length:--stroke-ring)",
        css: "0 0 0 calc(var(--stroke-ring) + var(--tw-ring-offset-width))",
      },
      {
        binding: "primary",
        utility: "ring-primary",
        css: "--tw-ring-color: var(--primary);",
      },
    ]);
    expect(selection.getAttribute("aria-hidden")).toBe("true");
    // Around the cover, not the whole card.
    expect(selection.parentElement).toBe(cover.parentElement);
    expect(selection.parentElement).not.toBe(card);
    // Visto: the 20 disc at the centre of the 24 selection box (6 px in = 8 px from the corner), 2 px background stroke outside.
    const hit = must(box, "selection box");
    expect(hit.parentElement).toBe(cover.parentElement);
    const visto = must(
      hit.firstElementChild as HTMLElement | null,
      "check disc",
    );
    await expectBindings(visto, [
      {
        binding: "20 × 20",
        utility: "size-5",
        css: "width: calc(var(--spacing) * 5);",
      },
      {
        binding: "circle",
        utility: "rounded-full",
        css: "border-radius: var(--radius-full);",
      },
      {
        binding: "primary",
        utility: "bg-primary",
        css: "background-color: var(--primary);",
      },
      {
        binding: "2 px stroke outside",
        utility: "ring-2",
        css: "calc(2px + var(--tw-ring-offset-width))",
      },
      {
        binding: "background",
        utility: "ring-background",
        css: "--tw-ring-color: var(--background);",
      },
      {
        binding: "primary-foreground check",
        utility: "text-primary-foreground",
        css: "color: var(--primary-foreground);",
      },
    ]);
    expect(isInaccessible(visto)).toBe(true);
    const icon = must(visto.querySelector<HTMLElement>("svg"), "check icon");
    expect(icon.classList).toContain("lucide-check");
    expect(icon.classList).toContain("size-icon-sm");
    // Q-B: no animation on selection.
    for (const el of [card, selection, hit, visto]) {
      expect(
        [...el.classList].filter((c) => /transition|animate|duration/.test(c)),
        el.className,
      ).toEqual([]);
    }
  });

  it("selection_box_is_hidden_from_assistive_tech", () => {
    const { box } = renderCard();
    const el = must(box, "selection box");
    // The card is an option: no interactive child, and the box is not announced.
    expect(el.getAttribute("aria-hidden")).toBe("true");
    expect(el.hasAttribute("tabindex")).toBe(false);
    expect(el.tagName).not.toBe("BUTTON");
    expect(el.getAttribute("role")).toBeNull();
    expect(el.querySelector("button, [tabindex], [role]")).toBeNull();
  });

  it("selection_box_shows_check_when_selected", () => {
    const off = renderCard({}, false);
    expect(
      off.card.querySelectorAll('[data-slot="selection-box"]'),
    ).toHaveLength(1);
    expect(must(off.box, "box").getAttribute("data-state")).toBe("unchecked");
    expect(off.card.querySelector("svg.lucide-check")).toBeNull();
    off.unmount();

    const on = renderCard({}, true);
    expect(
      on.card.querySelectorAll('[data-slot="selection-box"]'),
    ).toHaveLength(1);
    expect(must(on.box, "box").getAttribute("data-state")).toBe("checked");
    // One check only: the old selection-check is gone.
    expect(on.card.querySelectorAll("svg.lucide-check")).toHaveLength(1);
    expect(slot(on.card, "selection-check")).toBeNull();
  });

  it("selection_box_is_24_in_both_states", async () => {
    const geometry = (el: HTMLElement) =>
      [...el.classList].filter((c) =>
        /^(size|right|bottom|top|left|absolute)/.test(c),
      );
    const off = renderCard({}, false);
    const unchecked = geometry(must(off.box, "box"));
    off.unmount();
    const on = renderCard({}, true);
    const checked = geometry(must(on.box, "box"));

    expect(unchecked).toEqual(checked);
    await expectBindings(must(on.box, "box"), [
      { binding: "24 × 24", utility: "size-6", css: "width: calc(var(--spacing) * 6);" },
      { binding: "6 from the right", utility: "right-1.5", css: "right: calc(var(--spacing) * 1.5);" },
      { binding: "6 from the bottom", utility: "bottom-1.5", css: "bottom: calc(var(--spacing) * 1.5);" },
    ]);
  });

  it("unchecked_box_is_revealed_by_hover_focus_and_selecting", async () => {
    const { box } = renderCard({}, false);
    const el = must(box, "selection box");
    // Hidden and click-through at rest, so the click lands on the cover.
    expect(el.classList).toContain("opacity-0");
    expect(el.classList).toContain("pointer-events-none");
    // Each trigger must show it AND make it clickable; every class has to compile to a rule (a variant
    // that does not exist emits nothing, and the box would stay click-through).
    for (const trigger of [
      "group-[:hover]/card",
      "group-focus-visible/card",
      "group-data-[selecting]/card",
    ]) {
      for (const utility of ["opacity-100", "pointer-events-auto"]) {
        const cls = `${trigger}:${utility}`;
        expect(el.classList, cls).toContain(cls);
        expect(await ruleOf(cls), cls).toContain(
          utility === "opacity-100" ? "opacity: 100%" : "pointer-events: auto",
        );
      }
    }
    // The interior darkens to 30 % on hover.
    const disc = must(el.firstElementChild as HTMLElement | null, "disc");
    expect(disc.classList).toContain("group-[:hover]/card:bg-selection-box-hover");
    expect(await ruleOf("group-[:hover]/card:bg-selection-box-hover")).toContain(
      "var(--color-selection-box-hover)",
    );
    // 150 ms ease-out fade, none with reduced motion.
    for (const cls of [
      "transition-opacity",
      "duration-(--duration-out)",
      "ease-out",
      "motion-reduce:transition-none",
    ])
      expect(el.classList, cls).toContain(cls);
  });

  it("selecting_marks_card", () => {
    const off = renderCard({}, false, false);
    expect(off.card.hasAttribute("data-selecting")).toBe(false);
    off.unmount();
    const on = renderCard({}, false, true);
    expect(on.card.hasAttribute("data-selecting")).toBe(true);
  });

  it("title_uses_line_clamp_2", async () => {
    const { card } = renderCard();
    const title = must(slot(card, "book-card-title"), "title");
    await expectBindings(title, [
      {
        binding: "Body Medium",
        utility: "text-body-medium",
        css: "font-weight: 500;",
      },
      {
        binding: "foreground",
        utility: "text-foreground",
        css: "color: var(--foreground);",
      },
      {
        binding: "maxLines 2",
        utility: "line-clamp-2",
        css: "-webkit-line-clamp: 2;",
      },
    ]);
    expect(title.classList).not.toContain("truncate");
    const author = must(slot(card, "book-card-author"), "author");
    await expectBindings(author, [
      { binding: "Callout", utility: "text-callout", css: "font-size: 12px;" },
      {
        binding: "muted-foreground",
        utility: "text-muted-foreground",
        css: "color: var(--muted-foreground);",
      },
      { binding: "one line", utility: "truncate", css: "white-space: nowrap;" },
    ]);
    // gap-2 between the cover and the text; gap-1 inside the text.
    await expectBindings(card, [
      {
        binding: "vertical",
        utility: "flex-col",
        css: "flex-direction: column;",
      },
      {
        binding: "spacing/2",
        utility: "gap-2",
        css: "gap: calc(var(--spacing) * 2);",
      },
    ]);
    await expectBindings(must(title.parentElement, "text"), [
      { binding: "spacing/1", utility: "gap-1", css: "gap: var(--spacing);" },
    ]);
  });

  it("count_is_tabular", async () => {
    const { card } = renderCard();
    const count = screen.getByText("58");
    const row = must(
      count.closest<HTMLElement>('[data-slot="book-card-highlights"]'),
      "highlights row",
    );
    await expectBindings(row, [
      {
        binding: "tabular figures",
        utility: "tabular-nums",
        css: "--tw-numeric-spacing: tabular-nums;",
      },
      { binding: "Callout", utility: "text-callout", css: "font-size: 12px;" },
      {
        binding: "tertiary-foreground",
        utility: "text-tertiary-foreground",
        css: "color: var(--tertiary-foreground);",
      },
      { binding: "spacing/1", utility: "gap-1", css: "gap: var(--spacing);" },
      {
        binding: "centred",
        utility: "items-center",
        css: "align-items: center;",
      },
    ]);
    // The highlighter icon at 12, before the number.
    const icon = must(
      row.querySelector<HTMLElement>("svg"),
      "highlighter icon",
    );
    expect(icon.classList).toContain("lucide-highlighter");
    expect(icon.classList).toContain("size-icon-sm");
    expect(
      icon.compareDocumentPosition(count) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(card.contains(row)).toBe(true);
  });

  it("focus_ring_is_painted_on_cover_or_selection_frame", async () => {
    const off = renderCard({}, false);
    expect(off.cover.classList).toContain(RING);
    for (const el of [
      off.card,
      ...off.card.querySelectorAll<HTMLElement>("*"),
    ]) {
      if (el !== off.cover)
        expect(el.classList.contains(RING), el.outerHTML.slice(0, 80)).toBe(
          false,
        );
    }
    // The cell itself never draws the browser's ring.
    expect(off.card.classList).toContain("outline-none");
    off.unmount();

    const on = renderCard({}, true);
    const frame = must(on.frame, "selection frame");
    expect(frame.classList).toContain(RING);
    for (const el of [on.card, ...on.card.querySelectorAll<HTMLElement>("*")]) {
      if (el !== frame)
        expect(el.classList.contains(RING), el.outerHTML.slice(0, 80)).toBe(
          false,
        );
    }
    // Q-J, F1: flush outside the 3 px selection stroke, so its radius is 6 + 3 = 9.
    const offset =
      "group-focus-visible/card:outline-offset-(length:--stroke-ring)";
    expect(frame.classList).toContain(offset);
    const { css } = await compileAppCss([RING, offset]);
    const ringAt = css.indexOf("outline-offset: 0;");
    const offsetAt = css.indexOf("outline-offset: var(--stroke-ring);");
    expect(ringAt).toBeGreaterThan(-1);
    // Same specificity: the offset wins only because it comes after focus-ring's own offset.
    expect(offsetAt).toBeGreaterThan(ringAt);
    // Never around the title.
    expect(
      must(slot(on.card, "book-card-title"), "title").className,
    ).not.toMatch(/focus/);
  });
});
