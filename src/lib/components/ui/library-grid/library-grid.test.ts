import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { makeBook } from "$lib/test-fixtures";
import { LibraryGrid } from "./index";

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

function renderGrid(props: Record<string, unknown> = {}) {
  const onSelectionChange = vi.fn();
  const onOpen = vi.fn();
  const result = render(LibraryGrid, {
    props: { books: BOOKS, selectedBookIds: [], onSelectionChange, onOpen, ...props },
  });
  return { ...result, onSelectionChange, onOpen };
}

const options = () => screen.getAllByRole("option");

// jsdom has no layout: three cards per row, as a measured grid would give.
const offsetTop = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetTop");
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get(this: HTMLElement) {
      const index = options().indexOf(this);
      return index < 0 ? 0 : Math.floor(index / 3) * 300;
    },
  });
});
afterEach(() => {
  if (offsetTop) Object.defineProperty(HTMLElement.prototype, "offsetTop", offsetTop);
});

describe("LibraryGrid", () => {
  it("grid_is_multiselect_listbox_with_one_tab_stop", () => {
    renderGrid();
    const list = screen.getByRole("listbox");
    expect(list.getAttribute("aria-multiselectable")).toBe("true");
    expect(list.getAttribute("aria-label")).toBeTruthy();
    expect(options()).toHaveLength(BOOKS.length);
    const stops = options().filter((o) => o.getAttribute("tabindex") === "0");
    expect(stops).toHaveLength(1);
    expect(stops[0]).toBe(options()[0]);
    expect(options().filter((o) => o.getAttribute("tabindex") === "-1")).toHaveLength(BOOKS.length - 1);
  });

  it("arrows_move_focus_without_selecting", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onOpen } = renderGrid();
    options()[0].focus();

    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(options()[1]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(options()[4]);
    await user.keyboard("{ArrowUp}");
    expect(document.activeElement).toBe(options()[1]);
    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(options()[0]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(options()[4]);
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(options()[0]);

    // The roving tab stop follows the focus
    expect(options().filter((o) => o.getAttribute("tabindex") === "0")).toEqual([options()[0]]);
    expect(onSelectionChange).not.toHaveBeenCalled();
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("enter_opens_focused_book", async () => {
    const user = userEvent.setup();
    const { onOpen } = renderGrid();
    options()[1].focus();

    await user.keyboard("{Enter}");

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(BOOKS[1]);
  });

  it("space_toggles_selection", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, rerender } = renderGrid();
    options()[1].focus();

    await user.keyboard(" ");
    expect(onSelectionChange).toHaveBeenLastCalledWith([2]);

    await rerender({ selectedBookIds: [2] });
    expect(options()[1].getAttribute("aria-selected")).toBe("true");
    await user.keyboard(" ");
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it("cmd_click_toggles_and_shift_click_selects_range", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onOpen, rerender } = renderGrid();

    await user.keyboard("{Meta>}");
    await user.click(options()[0]);
    await user.keyboard("{/Meta}");
    expect(onSelectionChange).toHaveBeenLastCalledWith([1]);
    await rerender({ selectedBookIds: [1] });

    await user.keyboard("{Shift>}");
    await user.click(options()[2]);
    await user.keyboard("{/Shift}");
    expect(onSelectionChange).toHaveBeenLastCalledWith([1, 2, 3]);
    expect(onOpen).not.toHaveBeenCalled();

    // A plain click opens
    await user.click(options()[3]);
    expect(onOpen).toHaveBeenCalledWith(BOOKS[3]);
  });

  it("escape_clears_selection", async () => {
    const user = userEvent.setup();
    const { onSelectionChange } = renderGrid({ selectedBookIds: [1, 2] });
    options()[0].focus();

    await user.keyboard("{Escape}");

    expect(onSelectionChange).toHaveBeenCalledWith([]);
  });

  it("card_shows_new_count", () => {
    renderGrid();
    expect(screen.getByRole("option", { name: "Os Maias, Eça de Queirós, 3 highlights, 2 new" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Meditations, Marcus Aurelius, 1 highlight" })).toBeTruthy();
  });

  it("shift_click_without_anchor_selects_not_opens", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, onOpen } = renderGrid();

    await user.keyboard("{Shift>}");
    await user.click(options()[2]);
    await user.keyboard("{/Shift}");

    // ⇧ and ⌘ never open: with no anchor the book is toggled and becomes the anchor
    expect(onOpen).not.toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenLastCalledWith([3]);
  });

  it("shift_range_survives_reorder", async () => {
    const user = userEvent.setup();
    const { onSelectionChange, rerender } = renderGrid();

    await user.keyboard("{Meta>}");
    await user.click(options()[0]); // anchor: book 1
    await user.keyboard("{/Meta}");
    // A sort change puts the books in another order: 5, 4, 3, 2, 1
    await rerender({ books: [...BOOKS].reverse(), selectedBookIds: [1] });
    await user.keyboard("{Shift>}");
    await user.click(options()[3]); // book 2, next to book 1 now
    await user.keyboard("{/Shift}");

    expect(onSelectionChange).toHaveBeenLastCalledWith([2, 1]);
  });

  it("back_returns_focus_to_opened_book", () => {
    renderGrid({ initialActiveId: 3 });
    expect(options()[2].getAttribute("tabindex")).toBe("0");
    expect(options()[0].getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(options()[2]);
  });

  it("active_book_removed_moves_to_neighbour", async () => {
    const { rerender } = renderGrid();
    options()[3].focus(); // book 4 holds the tab stop

    await rerender({ books: BOOKS.filter((b) => b.id !== 4) });

    // Book 5 slid into its place: the stop stays at that index, not at 0
    expect(options()[3].getAttribute("tabindex")).toBe("0");
    expect(options()[0].getAttribute("tabindex")).toBe("-1");
  });

  describe("selection box", () => {
    const box = (index: number) =>
      options()[index].querySelector<HTMLElement>('[data-slot="selection-box"]')!;

    it("click_on_selection_box_selects_without_opening", async () => {
      const user = userEvent.setup();
      const { onSelectionChange, onOpen } = renderGrid();

      await user.click(box(1));

      expect(onOpen).not.toHaveBeenCalled();
      expect(onSelectionChange).toHaveBeenLastCalledWith([2]);
    });

    it("click_on_checked_box_deselects_without_opening", async () => {
      const user = userEvent.setup();
      const { onSelectionChange, onOpen } = renderGrid({ selectedBookIds: [1, 2] });

      await user.click(box(0));

      expect(onOpen).not.toHaveBeenCalled();
      expect(onSelectionChange).toHaveBeenLastCalledWith([2]);
    });

    it("shift_click_on_selection_box_selects_range", async () => {
      const user = userEvent.setup();
      const { onSelectionChange, onOpen, rerender } = renderGrid();

      await user.click(box(0));
      await rerender({ selectedBookIds: [1] });
      await user.keyboard("{Shift>}");
      await user.click(box(2));
      await user.keyboard("{/Shift}");

      expect(onSelectionChange).toHaveBeenLastCalledWith([1, 2, 3]);
      expect(onOpen).not.toHaveBeenCalled();
    });

    it("click_on_cover_still_opens", async () => {
      const user = userEvent.setup();
      const { onSelectionChange, onOpen } = renderGrid();

      await user.click(options()[1].querySelector<HTMLElement>('[data-slot="cover"]')!);

      expect(onOpen).toHaveBeenCalledWith(BOOKS[1]);
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("click_on_cover_opens_while_selecting", async () => {
      const user = userEvent.setup();
      const { onSelectionChange, onOpen } = renderGrid({ selectedBookIds: [1] });

      await user.click(options()[2].querySelector<HTMLElement>('[data-slot="cover"]')!);

      expect(onOpen).toHaveBeenCalledWith(BOOKS[2]);
      expect(onSelectionChange).not.toHaveBeenCalled();
    });

    it("cards_are_selecting_when_any_book_is_selected", async () => {
      const { rerender } = renderGrid();
      expect(options().filter((o) => o.hasAttribute("data-selecting"))).toHaveLength(0);

      await rerender({ selectedBookIds: [3] });

      expect(options().filter((o) => o.hasAttribute("data-selecting"))).toHaveLength(
        BOOKS.length,
      );
    });

    it("stale_selected_id_does_not_mark_selecting", () => {
      renderGrid({ selectedBookIds: [999] });
      expect(options().filter((o) => o.hasAttribute("data-selecting"))).toHaveLength(0);
    });
  });
});

describe("LibraryGrid · hideNew (Task 38)", () => {
  const badges = () => document.querySelectorAll('[data-slot="badge"]');

  it("hide_new_hides_badges", async () => {
    const { rerender } = renderGrid({ hideNew: true });
    // The Os Maias card has news, but a Sync is running: no badge, none in the card's name either
    expect(badges()).toHaveLength(0);
    expect(options()[0].getAttribute("aria-label")).not.toMatch(/new/i);

    await rerender({ hideNew: false });
    expect(badges()).toHaveLength(1);
    expect(options()[0].getAttribute("aria-label")).toMatch(/2 new/);
  });

  it("badges_show_by_default", () => {
    renderGrid();
    expect(badges()).toHaveLength(1);
  });

  it("badges_do_not_fade_when_the_grid_remounts", () => {
    renderGrid();
    expect(badges()).toHaveLength(1);
    expect(badges()[0].classList.contains("animate-in")).toBe(false);
  });

  it("badges_do_not_fade_when_the_grid_mounts_after_a_hidden_one", async () => {
    const first = renderGrid({ hideNew: true });
    first.unmount();
    renderGrid();
    expect(badges()[0].classList.contains("animate-in")).toBe(false);
  });

  it("badges_fade_in_when_the_sync_ends", async () => {
    const { rerender } = renderGrid({ hideNew: true });
    expect(badges()).toHaveLength(0);
    await rerender({ hideNew: false });
    const badge = badges()[0];
    expect(badge).toBeTruthy();
    for (const c of ["animate-in", "fade-in-0", "duration-(--duration-reveal)", "ease-out"]) {
      expect(badge.classList.contains(c), c).toBe(true);
    }
  });

  it("badges_do_not_fade_for_books_that_were_not_in_the_grid_while_syncing", async () => {
    const { rerender } = renderGrid({ hideNew: true });
    // The sync ends and, within the window, another reader's books come in
    const other = [makeBook({ id: 90, title: "Outro", author: "X", highlights: [hl("z", { isNew: true })] })];
    await rerender({ hideNew: false, books: other });
    expect(badges()).toHaveLength(1);
    expect(badges()[0].classList.contains("animate-in")).toBe(false);
  });
});
