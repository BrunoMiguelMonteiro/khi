import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss } from "$lib/test/css";
import { TitleMenu } from "./index";

// jsdom has no pointer capture, which Bits UI's triggers release on pointerdown.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

const ANA = { id: "ana", name: "Ana" };
const RUI = { id: "rui", name: "Rui" };

function renderMenu(
  readers = [ANA, RUI],
  activeReaderId = "ana",
  onselect = vi.fn(),
) {
  const result = render(TitleMenu, {
    props: { readers, activeReaderId, onselect },
  });
  return { ...result, onselect };
}

const items = () => [
  ...document.querySelectorAll<HTMLElement>('[data-slot="dropdown-menu-item"]'),
];
const item = (name: string) =>
  items().find((i) => i.textContent?.trim() === name)!;

const trigger = () => screen.getByRole("button", { name: "Ana's Library" });
const menu = () =>
  document.querySelector<HTMLElement>('[data-slot="dropdown-menu-content"]');

async function open() {
  const user = userEvent.setup();
  const view = renderMenu();
  await user.click(trigger());
  await waitFor(() => expect(menu()).not.toBeNull());
  return { user, ...view };
}

describe("TitleMenu", () => {
  it("single_reader_is_plain_text", () => {
    const { container } = renderMenu([ANA]);
    const title = container.querySelector('[data-slot="title-menu-title"]');
    expect(title?.textContent?.trim()).toBe("Library");
    expect(title?.classList).toContain("text-title-3");
    expect(title?.classList).toContain("text-foreground");
    expect(screen.queryByRole("button")).toBeNull();
    expect(container.querySelector("svg")).toBeNull();
    expect(menu()).toBeNull();
  });

  it("several_readers_open_menu_with_check_on_active", async () => {
    const { container } = renderMenu();
    const button = trigger();
    for (const c of [
      "h-toolbar-button",
      "px-2",
      "gap-1",
      "rounded-control",
      "text-title-3",
      "text-foreground",
    ])
      expect(button.classList.contains(c), c).toBe(true);
    expect(await ruleOf("h-toolbar-button")).toContain(
      "height: var(--size-toolbar-button)",
    );
    const chevron = container.querySelector("svg.lucide-chevron-down");
    expect(chevron?.classList.contains("text-muted-foreground")).toBe(true);
    expect(chevron?.getAttribute("aria-hidden")).toBe("true");

    const user = userEvent.setup();
    await user.click(button);
    await waitFor(() => expect(menu()).not.toBeNull());
    const rows = items();
    expect(rows.map((i) => i.textContent?.trim())).toEqual(["Ana", "Rui"]);
    expect(rows.map((i) => i.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);
    expect(rows[0].querySelector("svg.lucide-check")).not.toBeNull();
    expect(rows[1].querySelector("svg.lucide-check")).toBeNull();
    expect(rows.map((i) => i.getAttribute("role"))).toEqual([
      "menuitemcheckbox",
      "menuitemcheckbox",
    ]);
    expect(menu()?.classList.contains("w-50")).toBe(true);
  });

  it("has_menu_popup_and_expanded_state", async () => {
    const { user } = await open();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(menu()).toBeNull());
    expect(trigger().getAttribute("aria-haspopup")).toBe("menu");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    await user.click(trigger());
    await waitFor(() =>
      expect(trigger().getAttribute("aria-expanded")).toBe("true"),
    );
  });

  it("open_uses_accent_pressed", async () => {
    const button = (renderMenu(), trigger());
    expect(button.classList.contains("data-open:bg-accent-pressed")).toBe(true);
    expect(await ruleOf("data-open:bg-accent-pressed")).toContain(
      "var(--accent-pressed)",
    );
    expect(button.getAttribute("data-state")).toBe("closed");
    await userEvent.setup().click(button);
    await waitFor(() => expect(button.getAttribute("data-state")).toBe("open"));
  });

  it("selecting_reader_calls_onselect", async () => {
    const { user, onselect } = await open();
    await user.click(item("Rui"));
    expect(onselect).toHaveBeenCalledTimes(1);
    expect(onselect).toHaveBeenCalledWith("rui");
    await waitFor(() => expect(menu()).toBeNull());
  });

  it("active_mark_follows_the_prop_not_the_click", async () => {
    const { user, onselect } = await open();
    await user.click(item("Ana"));
    expect(onselect).toHaveBeenCalledWith("ana");
    await waitFor(() => expect(menu()).toBeNull());
    await waitFor(() =>
      expect(document.body.style.pointerEvents).not.toBe("none"),
    );
    await user.click(trigger());
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(items().map((i) => i.getAttribute("aria-checked"))).toEqual([
      "true",
      "false",
    ]);
  });

  it("title_and_check_follow_a_changed_active_reader", async () => {
    const user = userEvent.setup();
    const { rerender } = renderMenu();
    await rerender({ readers: [ANA, RUI], activeReaderId: "rui" });
    await user.click(screen.getByRole("button", { name: "Rui's Library" }));
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(item("Rui").getAttribute("aria-checked")).toBe("true");
    expect(item("Ana").getAttribute("aria-checked")).toBe("false");
  });

  it("stale_active_reader_falls_back_to_the_plain_title_and_keeps_the_menu", async () => {
    const user = userEvent.setup();
    renderMenu([ANA, RUI], "gone");
    const button = screen.getByRole("button", { name: "Library" });
    expect(button.getAttribute("aria-haspopup")).toBe("menu");
    await user.click(button);
    await waitFor(() => expect(menu()).not.toBeNull());
    expect(items().map((i) => i.getAttribute("aria-checked"))).toEqual([
      "false",
      "false",
    ]);
  });
});
