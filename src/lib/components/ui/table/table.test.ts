import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss, selectorFor } from "$lib/test/css";
import { BookRow, ColumnHeader, type BookRowBook } from "./index";
import RowsFixture from "./book-rows.fixture.svelte";

// The tables built around the rendered rows are not in testing-library's container: shuffled runs would see each other's rows.
afterEach(() => {
  document.body.querySelectorAll("table").forEach((table) => table.remove());
});

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

const slot = (root: ParentNode, name: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${name}"]`);

function must(el: HTMLElement | null, what: string): HTMLElement {
  if (!el) throw new Error(`no ${what} rendered`);
  return el;
}

const MAIAS: BookRowBook = {
  id: 42,
  title: "Os Maias",
  author: "Eça de Queirós",
  highlightCount: 58,
  newCount: 11,
  lastRead: "há 2 dias",
};

/** A row needs a table around it, or the parser drops the tr. */
function renderRow(
  book: Partial<BookRowBook> = {},
  selected?: boolean,
  extra: { narrow?: boolean } = {},
) {
  const table = document.createElement("table");
  const body = document.createElement("tbody");
  table.append(body);
  document.body.append(table);
  const result = render(BookRow, {
    target: body,
    props: { book: { ...MAIAS, ...book }, selected, ...extra },
  });
  const row = screen.getByRole("row");
  const cell = (name: string) => must(slot(row, `book-row-${name}`), name);
  return { ...result, row, cell };
}

function renderHeader(
  props: {
    label?: string;
    sort?: "none" | "asc" | "desc";
    align?: "start" | "end";
  } = {},
) {
  const onclick = vi.fn();
  const table = document.createElement("table");
  const head = document.createElement("thead");
  const tr = document.createElement("tr");
  head.append(tr);
  table.append(head);
  document.body.append(table);
  render(ColumnHeader, {
    target: tr,
    props: { label: "Título", onclick, ...props },
  });
  const th = screen.getByRole("columnheader");
  const button = screen.getByRole("button");
  return { th, button, onclick };
}

const SEPARATOR = [
  "after:absolute",
  "after:inset-x-0",
  "after:bottom-0",
  "after:h-px",
  "after:bg-border",
];

describe("BookRow", () => {
  it("row_columns_have_figma_widths", async () => {
    const { row, cell } = renderRow();
    // Componentes (D7) · 19 · Linha da lista (66:4618): 56 high (Task 41, M2), no left padding (the box strip starts the row), pr-2, gap-4, radius/control.
    await expectBindings(row, [
      { binding: "horizontal", utility: "flex", css: "display: flex;" },
      {
        binding: "centred",
        utility: "items-center",
        css: "align-items: center;",
      },
      {
        binding: "56 high",
        utility: "h-14",
        css: "height: calc(var(--spacing) * 14);",
      },
      {
        binding: "spacing/2 at the end only",
        utility: "pr-2",
        css: "padding-right: calc(var(--spacing) * 2);",
      },
      { binding: "none at the start", utility: "pl-0", css: "padding-left: 0px;" },
      {
        binding: "spacing/4",
        utility: "gap-4",
        css: "gap: calc(var(--spacing) * 4);",
      },
      {
        binding: "radius/control",
        utility: "rounded-control",
        css: "border-radius: var(--radius-control);",
      },
    ]);
    // A flex tr is still a row to VoiceOver.
    expect(row.getAttribute("role")).toBe("row");
    const cells = [...row.children] as HTMLElement[];
    expect(cells.map((c) => c.dataset.slot)).toEqual([
      "book-row-title",
      "book-row-author",
      "book-row-highlights",
      "book-row-last-read",
    ]);
    // Título takes the rest; Autor 200, Destaques 88, Última leitura 120, none of them shrinking.
    await expectBindings(cell("title"), [
      { binding: "fills", utility: "flex-1", css: "flex: 1;" },
      {
        binding: "can shrink below its text",
        utility: "min-w-0",
        css: "min-width: 0px;",
      },
    ]);
    for (const [name, utility, px] of [
      ["author", "w-50", "50"],
      ["highlights", "w-22", "22"],
      ["last-read", "w-30", "30"],
    ]) {
      await expectBindings(cell(name), [
        {
          binding: `${Number(px) * 4} wide`,
          utility,
          css: `width: calc(var(--spacing) * ${px});`,
        },
        { binding: "fixed", utility: "shrink-0", css: "flex-shrink: 0;" },
      ]);
    }
    // Title: the 36 pt selection strip, Miniatura 4 after it, the title 16 after that, on one line, then the badge 8 after it.
    const title = cell("title");
    expect(must(slot(title, "thumbnail"), "thumbnail").previousElementSibling).toBe(
      slot(title, "selection-box"),
    );
    const text = must(slot(title, "book-row-title-text"), "title text");
    expect(text.textContent?.trim()).toBe("Os Maias");
    await expectBindings(text, [
      {
        binding: "Body Medium",
        utility: "text-body-medium",
        css: "font-weight: 500;",
      },
      {
        binding: "one line",
        utility: "truncate",
        css: "text-overflow: ellipsis;",
      },
      {
        binding: "shrinks first",
        utility: "min-w-0",
        css: "min-width: 0px;",
      },
    ]);
    const badge = must(slot(title, "badge"), "badge");
    expect(badge.textContent?.trim()).toBe("11 new");
    expect(text.nextElementSibling).toBe(badge);
    expect(badge.classList).toContain("shrink-0");
    // Autor and Última leitura: Body, muted.
    for (const name of ["author", "last-read"]) {
      await expectBindings(cell(name), [
        { binding: "Body", utility: "text-body", css: "font-size: 13px;" },
        {
          binding: "muted-foreground",
          utility: "text-muted-foreground",
          css: "color: var(--muted-foreground);",
        },
        {
          binding: "one line",
          utility: "truncate",
          css: "text-overflow: ellipsis;",
        },
      ]);
    }
    expect(cell("author").textContent?.trim()).toBe("Eça de Queirós");
    expect(cell("last-read").textContent?.trim()).toBe("há 2 dias");
  });

  it("row_without_new_highlights_has_no_badge_and_unknown_author", () => {
    const { row, cell } = renderRow({ newCount: 0, author: " " });
    expect(slot(row, "badge")).toBeNull();
    expect(cell("author").textContent?.trim()).toBe("Unknown author");
  });

  it("selected_row_is_primary_with_badge_kept", async () => {
    const off = renderRow({}, false);
    expect(off.row.getAttribute("aria-selected")).toBe("false");
    await expectBindings(off.row, [
      {
        binding: "hover: accent",
        utility: "hover:bg-accent",
        css: "background-color: var(--accent);",
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
        binding: "background only",
        utility: "transition-[background-color]",
        css: "transition-property: background-color;",
      },
    ]);
    expect(off.cell("title").classList).toContain("text-foreground");
    expect(off.cell("highlights").classList).toContain("text-foreground");
    expect(off.row.classList).not.toContain("bg-primary");
    const offBadge = must(slot(off.row, "badge"), "badge").className;
    off.unmount();

    const { row, cell } = renderRow({}, true);
    expect(row.getAttribute("aria-selected")).toBe("true");
    await expectBindings(row, [
      {
        binding: "primary",
        utility: "bg-primary",
        css: "background-color: var(--primary);",
      },
      {
        binding: "primary-foreground",
        utility: "text-primary-foreground",
        css: "color: var(--primary-foreground);",
      },
    ]);
    // All the text in primary-foreground: no cell keeps its own colour.
    for (const name of ["title", "author", "highlights", "last-read"]) {
      expect(cell(name).classList, name).toContain("text-primary-foreground");
      expect(
        [...cell(name).classList].filter((c) =>
          /^text-(foreground|muted-foreground)$/.test(c),
        ),
        name,
      ).toEqual([]);
    }
    // No animation, no hover, no unselected focus ring; the focus indicator is the inset border on ::after (Task 41).
    expect(
      [...row.classList].filter((c) =>
        /ring|hover|transition|duration|ease|animate/.test(c),
      ),
    ).toEqual([]);
    expect(must(slot(row, "badge"), "badge").className).toBe(offBadge);
  });

  it("selection_box_is_visible_at_rest_in_every_row", async () => {
    for (const selected of [false, true]) {
      const { row, unmount } = renderRow({}, selected);
      const box = must(slot(row, "selection-box"), "box");
      expect(box.classList, String(selected)).not.toContain("opacity-0");
      expect(box.classList, String(selected)).not.toContain("pointer-events-none");
      expect(box.className).not.toMatch(/group-.*:opacity-100/);
      const disc = must(box.querySelector<HTMLElement>(":scope > span"), "disc");
      if (!selected) {
        expect(disc.classList).toContain("border-[1.5px]");
        expect(disc.classList).toContain("border-selection-outline");
      }
      unmount();
    }
    const { row } = renderRow();
    const box = must(slot(row, "selection-box"), "box");
    // The click strip: 36 wide, the whole row tall.
    await expectBindings(box, [
      { binding: "36 wide", utility: "w-9", css: "width: calc(var(--spacing) * 9);" },
      { binding: "row tall", utility: "inset-y-0", css: "inset-block: 0px;" },
    ]);
    // The empty disc: 20 px, a 1.5 px outline in selection-outline, the hover value with the pointer on the row.
    const disc = must(box.querySelector<HTMLElement>(":scope > span"), "disc");
    await expectBindings(disc, [
      { binding: "20 px", utility: "size-5", css: "width: calc(var(--spacing) * 5);" },
      { binding: "1.5 px outline", utility: "border-[1.5px]", css: "border-width: 1.5px;" },
      { binding: "rest", utility: "border-selection-outline", css: "var(--selection-outline)" },
      {
        binding: "row hover",
        utility: "group-[:hover]/row:border-selection-outline-hover",
        css: "var(--selection-outline-hover)",
      },
    ]);
    expect(disc.classList).not.toContain("bg-selection-box");
  });

  it("selected_row_shows_a_2px_inset_primary_foreground_ring_only_when_focused", async () => {
    const { row, unmount } = renderRow({}, true);
    await expectBindings(row, [
      { binding: "ring drawn on ::after", utility: "after:absolute", css: "position: absolute;" },
      { binding: "recessed 2 px", utility: "after:inset-0.5", css: "inset: calc(var(--spacing) * 0.5);" },
      { binding: "2 px", utility: "after:border-2", css: "border-width: 2px;" },
      {
        binding: "primary-foreground",
        utility: "after:border-primary-foreground",
        css: "border-color: var(--primary-foreground);",
      },
      { binding: "hidden at rest", utility: "after:hidden", css: "display: none;" },
      { binding: "shown on keyboard focus", utility: "focus-visible:after:block", css: "display: block;" },
    ]);
    expect(row.classList).not.toContain("focus-visible:focus-ring");
    unmount();
    const idle = renderRow({ id: 43 }, false);
    expect(idle.row.classList).toContain("focus-visible:focus-ring");
    expect(idle.row.className).not.toContain("after:border-primary-foreground");
  });

  it("narrow_row_drops_last_read_and_shrinks_author_to_160", async () => {
    const wide = renderRow();
    expect(wide.cell("author").classList).toContain("w-50");
    expect(slot(wide.row, "book-row-last-read")).not.toBeNull();
    wide.unmount();

    const { row, cell } = renderRow({}, false, { narrow: true });
    expect(slot(row, "book-row-last-read")).toBeNull();
    expect(row.textContent).not.toContain("há 2 dias");
    await expectBindings(cell("author"), [
      { binding: "160 wide", utility: "w-40", css: "width: calc(var(--spacing) * 40);" },
    ]);
    expect(cell("author").classList).not.toContain("w-50");
  });

  it("separator_hidden_on_hover_and_selected", async () => {
    const off = renderRow({}, false);
    // A 1 px border fill at the bottom, the full width.
    for (const utility of SEPARATOR)
      expect(off.row.classList, utility).toContain(utility);
    await expectBindings(off.row, [
      {
        binding: "positioned for the separator",
        utility: "relative",
        css: "position: relative;",
      },
      { binding: "1 px", utility: "after:h-px", css: "height: 1px;" },
      {
        binding: "border",
        utility: "after:bg-border",
        css: "background-color: var(--border);",
      },
      {
        binding: "gone on hover",
        utility: "hover:after:hidden",
        css: "display: none;",
      },
    ]);
    const hidden = await selectorFor("hover:after:hidden");
    expect(hidden).toContain(":hover");
    expect(hidden).toContain("::after");
    off.unmount();

    const { row } = renderRow({}, true);
    // Only the focus ring (border, recess, rounding) is left on ::after: no separator.
    expect(
      [...row.classList].filter(
        (c) => c.startsWith("after:") && !/inset-0\.5|border|rounded|hidden|pointer-events/.test(c),
      ),
    ).toEqual(["after:absolute"]);
  });

  it("separator_is_hidden_on_the_last_row_and_before_a_selected_or_hovered_row", async () => {
    const books = [1, 2, 3].map((id) => ({ ...MAIAS, id }));
    const { container } = render(RowsFixture, {
      props: { books, selectedId: 2 },
    });
    const rows = [...container.querySelectorAll('[data-slot="book-row"]')];
    expect(rows).toHaveLength(3);
    const LAST = "last:after:hidden";
    const BEFORE_SELECTED = "has-[+[aria-selected=true]]:after:hidden";
    const BEFORE_HOVERED = "has-[+:hover]:after:hidden";
    for (const c of [LAST, BEFORE_SELECTED, BEFORE_HOVERED])
      // The selected row draws no separator of its own.
      for (const row of [rows[0], rows[2]])
        expect(row.classList, c).toContain(c);
    expect(rows.map((r) => r.getAttribute("aria-selected"))).toEqual([
      "false",
      "true",
      "false",
    ]);
    expect(rows[2].nextElementSibling).toBeNull();
    expect(await selectorFor(LAST)).toContain(":last-child");
    const selected = await selectorFor(BEFORE_SELECTED);
    expect(selected).toContain(":has(");
    expect(selected).toContain("aria-selected");
    expect(selected).toContain("::after");
    const hovered = await selectorFor(BEFORE_HOVERED);
    expect(hovered).toContain(":has(");
    expect(hovered).toContain(":hover");
    // Where the line really disappears next to the hovered or selected row is checked on screen (Phase 5).
  });

  it("highlights_count_is_tabular_and_right_aligned", async () => {
    const { cell } = renderRow();
    const highlights = cell("highlights");
    expect(highlights.textContent?.trim()).toBe("58");
    await expectBindings(highlights, [
      {
        binding: "tabular figures",
        utility: "tabular-nums",
        css: "--tw-numeric-spacing: tabular-nums;",
      },
      {
        binding: "right-aligned",
        utility: "text-right",
        css: "text-align: right;",
      },
      { binding: "Body", utility: "text-body", css: "font-size: 13px;" },
      {
        binding: "foreground",
        utility: "text-foreground",
        css: "color: var(--foreground);",
      },
    ]);
  });
});

describe("ColumnHeader", () => {
  it("header_maps_sort_to_aria_sort", async () => {
    for (const [sort, aria] of [
      ["asc", "ascending"],
      ["desc", "descending"],
      ["none", "none"],
    ] as const) {
      const { th, button } = renderHeader({ sort });
      expect(th.getAttribute("aria-sort"), sort).toBe(aria);
      const arrow = button.querySelector("svg");
      if (sort === "none") {
        expect(arrow, sort).toBeNull();
        expect(button.classList).toContain("text-muted-foreground");
        expect(button.classList).not.toContain("text-foreground");
      } else {
        expect(
          arrow?.classList.contains(
            sort === "asc" ? "lucide-arrow-up" : "lucide-arrow-down",
          ),
          sort,
        ).toBe(true);
        expect(arrow?.classList.contains("size-icon-sm"), sort).toBe(true);
        expect(arrow?.getAttribute("aria-hidden"), sort).toBe("true");
        await expectBindings(button, [
          {
            binding: "active",
            utility: "text-foreground",
            css: "color: var(--foreground);",
          },
        ]);
        expect(button.classList).not.toContain("text-muted-foreground");
      }
      document.body.innerHTML = "";
    }
    // Componentes (D7) · 19 · Cabeçalho de coluna (66:4649): 28 high, px-2, gap-1, Callout Medium.
    const { button } = renderHeader();
    await expectBindings(button, [
      {
        binding: "28 high",
        utility: "h-7",
        css: "height: calc(var(--spacing) * 7);",
      },
      {
        binding: "spacing/2",
        utility: "px-2",
        css: "padding-inline: calc(var(--spacing) * 2);",
      },
      { binding: "spacing/1", utility: "gap-1", css: "gap: var(--spacing);" },
      {
        binding: "Callout Medium",
        utility: "text-callout-medium",
        css: "font-weight: 500;",
      },
      {
        binding: "keyboard ring",
        utility: "focus-visible:focus-ring",
        css: "var(--stroke-ring)",
      },
    ]);
    expect(button.getAttribute("type")).toBe("button");
  });

  it("header_click_calls_onclick", async () => {
    const user = userEvent.setup();
    const { button, onclick, th } = renderHeader({ sort: "asc" });
    expect(button.textContent?.trim()).toBe("Título");
    await user.click(button);
    expect(onclick).toHaveBeenCalledTimes(1);
    // The caller decides the order: a click alone changes nothing.
    expect(th.getAttribute("aria-sort")).toBe("ascending");
    await user.keyboard("{Enter}");
    expect(onclick).toHaveBeenCalledTimes(2);
  });

  it("right_aligned_header_puts_arrow_first", async () => {
    const end = renderHeader({
      label: "Destaques",
      sort: "desc",
      align: "end",
    });
    const [first, last] = [
      end.button.firstElementChild,
      end.button.lastElementChild,
    ];
    expect(first?.tagName.toLowerCase()).toBe("svg");
    expect(last?.textContent?.trim()).toBe("Destaques");
    await expectBindings(end.button, [
      {
        binding: "right",
        utility: "justify-end",
        css: "justify-content: flex-end;",
      },
    ]);
    document.body.innerHTML = "";

    const start = renderHeader({
      label: "Título",
      sort: "desc",
      align: "start",
    });
    expect(start.button.firstElementChild?.textContent?.trim()).toBe("Título");
    expect(start.button.lastElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(start.button.classList).not.toContain("justify-end");
  });
});
