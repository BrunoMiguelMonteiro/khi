import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { makeBook } from "$lib/test-fixtures";
import { LibraryList } from "./index";

const hl = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  text: id,
  dateCreated: "2026-01-01",
  ...extra,
});

const BOOKS = [
  makeBook({
    id: 1,
    title: "Os Maias",
    author: "Eça de Queirós",
    highlights: [hl("a", { isNew: true }), hl("b", { isNew: true }), hl("c")],
  }),
  makeBook({ id: 2, title: "Meditations", author: "Marcus Aurelius", highlights: [hl("d")] }),
  makeBook({ id: 3, title: "Ensaio", author: "Saramago", highlights: [] }),
  makeBook({ id: 4, title: "Quarto", author: "Autor", highlights: [] }),
  makeBook({ id: 5, title: "Quinto", author: "Autor", highlights: [] }),
];

function renderList(props: Record<string, unknown> = {}) {
  const onSelectionChange = vi.fn();
  const onOpen = vi.fn();
  const onSortChange = vi.fn();
  const result = render(LibraryList, {
    props: {
      books: BOOKS,
      selectedBookIds: [],
      onSelectionChange,
      onOpen,
      sort: "date_last_read",
      reversed: false,
      onSortChange,
      ...props,
    },
  });
  return { ...result, onSelectionChange, onOpen, onSortChange };
}

const rows = () => [...document.querySelectorAll<HTMLElement>('[data-slot="book-row"]')];
const box = (index: number) => rows()[index].querySelector<HTMLElement>('[data-slot="selection-box"]')!;

describe("LibraryList", () => {
  it("list_is_a_multiselect_grid_with_rows_and_column_headers", () => {
    renderList();
    const grid = screen.getByRole("grid");
    expect(grid.getAttribute("aria-multiselectable")).toBe("true");
    expect(grid.getAttribute("aria-label")).toBeTruthy();
    expect(rows()).toHaveLength(BOOKS.length);
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent?.trim())).toEqual([
      "Title",
      "Author",
      "Highlights",
      "Last read",
    ]);
    expect(rows()[0].getAttribute("aria-label")).toBe("Os Maias, Eça de Queirós, 3 highlights, 2 new");
  });

  it("click_opens", async () => {
    const user = userEvent.setup();
    const { onOpen, onSelectionChange } = renderList();

    await user.click(rows()[1]);

    expect(onOpen).toHaveBeenCalledWith(BOOKS[1]);
    expect(onSelectionChange).not.toHaveBeenCalled();
  });

  it("box_click_selects_without_opening", async () => {
    const user = userEvent.setup();
    const { onOpen, onSelectionChange } = renderList();

    await user.click(box(1));
    expect(onOpen).not.toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenLastCalledWith([2]);
  });

  it("box_click_on_a_selected_row_deselects", async () => {
    const user = userEvent.setup();
    const { onOpen, onSelectionChange } = renderList({ selectedBookIds: [1, 2] });

    await user.click(box(0));

    expect(onOpen).not.toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenLastCalledWith([2]);
  });

  it("cmd_click_toggles", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onOpen, rerender } = renderList();

    await user.keyboard("{Meta>}");
    await user.click(rows()[0]);
    await user.keyboard("{/Meta}");
    expect(onSelectionChange).toHaveBeenLastCalledWith([1]);
    await rerender({ selectedBookIds: [1] });

    await user.keyboard("{Meta>}");
    await user.click(rows()[2]);
    await user.keyboard("{/Meta}");
    expect(onSelectionChange).toHaveBeenLastCalledWith([1, 3]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shift_click_selects_range_from_anchor", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onOpen, rerender } = renderList();

    await user.click(box(0));
    await rerender({ selectedBookIds: [1] });
    await user.keyboard("{Shift>}");
    await user.click(rows()[3]);
    await user.keyboard("{/Shift}");

    expect(onSelectionChange).toHaveBeenLastCalledWith([1, 2, 3, 4]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("shift_range_survives_reorder", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, rerender } = renderList();

    await user.click(box(0)); // anchor: book 1
    await rerender({ books: [...BOOKS].reverse(), selectedBookIds: [1] });
    await user.keyboard("{Shift>}");
    await user.click(rows()[3]); // book 2, next to book 1 now
    await user.keyboard("{/Shift}");

    expect(onSelectionChange).toHaveBeenLastCalledWith([2, 1]);
  });

  it("arrows_move_focus_without_selecting", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onOpen } = renderList();
    rows()[0].focus();

    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows()[1]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(rows()[2]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(rows()[1]);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(document.activeElement).toBe(rows()[0]);

    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("home_end", async () => {
    const user = userEvent.setup();
    renderList();
    rows()[2].focus();

    await user.keyboard("{End}");
    expect(document.activeElement).toBe(rows()[4]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(rows()[0]);
  });

  it("space_toggles_enter_opens", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onOpen, rerender } = renderList();
    rows()[1].focus();

    await user.keyboard(" ");
    expect(onSelectionChange).toHaveBeenLastCalledWith([2]);
    expect(onOpen).not.toHaveBeenCalled();
    await rerender({ selectedBookIds: [2] });
    expect(rows()[1].getAttribute("aria-selected")).toBe("true");
    await user.keyboard(" ");
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);

    await user.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(BOOKS[1]);
  });

  it("escape_clears_only_with_selection", async () => {
    const user = userEvent.setup();
    const none = renderList();
    rows()[0].focus();
    const keydown = vi.fn((event: KeyboardEvent) => event.defaultPrevented);
    document.addEventListener("keydown", keydown);

    await user.keyboard("{Escape}");
    // Nothing to clear: the key is left to whoever else wants it
    expect(none.onSelectionChange).not.toHaveBeenCalled();
    expect(keydown.mock.results[0].value).toBe(false);
    document.removeEventListener("keydown", keydown);
    none.unmount();

    const some = renderList({ selectedBookIds: [1, 2] });
    rows()[0].focus();
    await user.keyboard("{Escape}");
    expect(some.onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("single_tab_stop", async () => {
    const user = userEvent.setup();
    renderList();
    expect(rows().filter((r) => r.getAttribute("tabindex") === "0")).toEqual([rows()[0]]);
    expect(rows().filter((r) => r.getAttribute("tabindex") === "-1")).toHaveLength(BOOKS.length - 1);

    // The stop follows the focus, and the box is not a stop of its own
    rows()[3].focus();
    await tick();
    expect(rows().filter((r) => r.getAttribute("tabindex") === "0")).toEqual([rows()[3]]);
    expect(box(3).hasAttribute("tabindex")).toBe(false);
    expect(box(3).getAttribute("aria-hidden")).toBe("true");
    expect(box(3).tagName).not.toBe("BUTTON");
    await user.tab();
    expect(rows()).not.toContain(document.activeElement as HTMLElement);
  });

  it("initial_active_row_gets_focus", () => {
    renderList({ initialActiveId: 3 });
    expect(rows()[2].getAttribute("tabindex")).toBe("0");
    expect(rows()[0].getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(rows()[2]);
  });

  it("active_row_removed_moves_to_neighbour", async () => {
    const { rerender } = renderList();
    rows()[3].focus();

    await rerender({ books: BOOKS.filter((b) => b.id !== 4) });

    expect(rows()[3].getAttribute("tabindex")).toBe("0");
    expect(rows()[0].getAttribute("tabindex")).toBe("-1");
  });

  it("hide_new_hides_badges", async () => {
    const badges = () => document.querySelectorAll('[data-slot="badge"]');
    const { rerender } = renderList({ hideNew: true });
    expect(badges()).toHaveLength(0);
    expect(rows()[0].getAttribute("aria-label")).not.toMatch(/new/i);

    await rerender({ hideNew: false });
    expect(badges()).toHaveLength(1);
    expect(badges()[0].classList.contains("animate-in")).toBe(true);
    expect(rows()[0].getAttribute("aria-label")).toMatch(/2 new/);
  });

  it("badges_do_not_fade_when_the_list_is_merely_shown", () => {
    renderList();
    const badge = document.querySelector('[data-slot="badge"]')!;
    expect(badge.classList.contains("animate-in")).toBe(false);
  });

  it("box_is_visible_at_rest_in_every_row_and_clicking_it_selects", async () => {
    const user = userEvent.setup();
    const { onOpen, onSelectionChange } = renderList();
    expect(rows().map((_, i) => box(i))).toHaveLength(BOOKS.length);
    for (let i = 0; i < BOOKS.length; i++) {
      expect(box(i).classList).not.toContain("opacity-0");
      expect(box(i).classList).not.toContain("pointer-events-none");
    }
    await user.click(box(3));
    expect(onSelectionChange).toHaveBeenCalledWith([4]);
    expect(onOpen).not.toHaveBeenCalled();
    await user.click(rows()[3]);
    expect(onOpen).toHaveBeenCalledWith(BOOKS[3]);
  });

  it("title_header_aligns_with_the_title_text", () => {
    renderList();
    // Box strip 36 + 4 + cover 32 + 16 = 88 from the row's start.
    expect(screen.getByRole("columnheader", { name: "Title" }).classList).toContain("pl-22");
  });

  describe("narrow window", () => {
    const original = window.innerWidth;
    const resizeTo = async (width: number) => {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
      window.dispatchEvent(new Event("resize"));
      await tick();
    };
    afterEach(() => resizeTo(original));

    it("below_900_there_is_no_last_read_header_or_cell", async () => {
      await resizeTo(899);
      renderList();
      expect(screen.queryByRole("columnheader", { name: "Last read" })).toBeNull();
      expect(screen.getAllByRole("columnheader")).toHaveLength(3);
      expect(document.querySelectorAll('[data-slot="book-row-last-read"]')).toHaveLength(0);
      expect(document.querySelector('[data-slot="book-row-author"]')!.classList).toContain("w-40");
    });

    it("at_900_the_column_is_there", async () => {
      await resizeTo(900);
      renderList();
      expect(screen.getByRole("columnheader", { name: "Last read" })).toBeTruthy();
      expect(document.querySelectorAll('[data-slot="book-row-last-read"]')).toHaveLength(BOOKS.length);
      expect(document.querySelector('[data-slot="book-row-author"]')!.classList).toContain("w-50");
    });

    it("resizing_across_900_adds_and_removes_the_column", async () => {
      await resizeTo(1000);
      renderList();
      expect(screen.getByRole("columnheader", { name: "Last read" })).toBeTruthy();
      await resizeTo(800);
      expect(screen.queryByRole("columnheader", { name: "Last read" })).toBeNull();
      await resizeTo(1000);
      expect(screen.getByRole("columnheader", { name: "Last read" })).toBeTruthy();
    });

    it("sorted_by_date_there_is_no_arrow_and_no_orphan_aria_sort", async () => {
      await resizeTo(800);
      renderList({ sort: "date_last_read", reversed: false });
      expect(document.querySelectorAll('[aria-sort="ascending"], [aria-sort="descending"]')).toHaveLength(0);
      expect(document.querySelectorAll('[data-slot="column-header"] svg')).toHaveLength(0);
    });
  });

  it("last_read_is_relative_and_a_dash_without_date", () => {
    renderList({
      books: [
        makeBook({ id: 1, title: "A", author: "X", dateLastRead: new Date().toISOString() }),
        makeBook({ id: 2, title: "B", author: "X" }),
      ],
    });
    const cells = [...document.querySelectorAll('[data-slot="book-row-last-read"]')].map((c) => c.textContent?.trim());
    expect(cells).toEqual(["Today", "—"]);
  });

  describe("column headers", () => {
    const header = (name: string) => screen.getByRole("columnheader", { name });

    it("active_column_shows_its_real_direction", async () => {
      const { rerender } = renderList({ sort: "date_last_read", reversed: false });
      expect(header("Last read").getAttribute("aria-sort")).toBe("descending");
      expect(header("Title").getAttribute("aria-sort")).toBe("none");

      await rerender({ reversed: true });
      expect(header("Last read").getAttribute("aria-sort")).toBe("ascending");

      await rerender({ sort: "title", reversed: false });
      expect(header("Title").getAttribute("aria-sort")).toBe("ascending");
      await rerender({ reversed: true });
      expect(header("Title").getAttribute("aria-sort")).toBe("descending");
      expect(header("Last read").getAttribute("aria-sort")).toBe("none");
    });

    it("click_reports_the_column", async () => {
      const user = userEvent.setup();
      const { onSortChange, onOpen } = renderList();

      await user.click(screen.getByRole("button", { name: "Author" }));
      expect(onSortChange).toHaveBeenLastCalledWith("author");
      await user.click(screen.getByRole("button", { name: "Highlights" }));
      expect(onSortChange).toHaveBeenLastCalledWith("highlight_count");
      await user.click(screen.getByRole("button", { name: "Title" }));
      expect(onSortChange).toHaveBeenLastCalledWith("title");
      await user.click(screen.getByRole("button", { name: "Last read" }));
      expect(onSortChange).toHaveBeenLastCalledWith("date_last_read");
      expect(onOpen).not.toHaveBeenCalled();
    });
  });
});

describe("LibraryList shift+arrows", () => {
  it("shift_ArrowDown_extends_and_shift_ArrowUp_shrinks_from_the_focused_book", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderList();
    rows()[0].focus();

    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(onSelectionChange).toHaveBeenLastCalledWith([1, 2]);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(onSelectionChange).toHaveBeenLastCalledWith([1, 2, 3]);
    expect(document.activeElement).toBe(rows()[2]);
    await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
    expect(onSelectionChange).toHaveBeenLastCalledWith([1, 2]);
  });

  it("shift_arrow_extends_from_the_anchor_set_by_space", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderList();
    rows()[1].focus();

    await user.keyboard(" ");
    await user.keyboard("{ArrowDown}");
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(onSelectionChange).toHaveBeenLastCalledWith([2, 3, 4]);
  });

  it("shift_arrow_at_the_last_item_changes_nothing", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderList();
    rows()[4].focus();

    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(rows()[4]);
  });
});
