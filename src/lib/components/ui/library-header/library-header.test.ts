import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import Fixture from "./library-header-fixture.svelte";
import type { LibraryHeaderState } from "./index";

const NOVOS: LibraryHeaderState = {
  kind: "novos",
  highlights: 12,
  books: 3,
  since: new Date(2026, 10, 9, 10, 0),
};

const live = () =>
  must(document.querySelector<HTMLElement>("[aria-live]"), "live region");

function must<T>(el: T | null, what: string): T {
  if (!el) throw new Error(`no ${what} rendered`);
  return el;
}

function renderHeader(
  state: LibraryHeaderState,
  callbacks: Record<string, unknown> = {},
) {
  return render(Fixture, { props: { state, ...callbacks } });
}

describe("LibraryHeader text", () => {
  it("novos_text_with_plurals", () => {
    const { container, unmount } = renderHeader(NOVOS);
    const root = must(
      container.querySelector<HTMLElement>('[data-slot="library-header"]'),
      "header",
    );
    expect(
      must(
        root.querySelector('[data-slot="library-header-message"]'),
        "message",
      ).textContent?.trim(),
    ).toBe("12 new highlights in 3 books");
    expect(
      must(
        root.querySelector('[data-slot="library-header-detail"]'),
        "detail",
      ).textContent?.trim(),
    ).toBe("since Nov 9");
    expect(
      screen.getByRole("button", { name: "Show only these" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Export 3 books" })).toBeTruthy();
    unmount();

    renderHeader({ ...NOVOS, highlights: 1, books: 1 });
    expect(
      document
        .querySelector('[data-slot="library-header-message"]')
        ?.textContent?.trim(),
    ).toBe("1 new highlight in 1 book");
    expect(screen.getByRole("button", { name: "Export 1 book" })).toBeTruthy();
  });

  it("syncing_text_counts_books", () => {
    const { container } = renderHeader({
      kind: "aSincronizar",
      done: 4,
      total: 11,
    });
    expect(
      container
        .querySelector('[data-slot="library-header-message"]')
        ?.textContent?.trim(),
    ).toBe("Syncing with the Kobo");
    expect(
      container
        .querySelector('[data-slot="library-header-detail"]')
        ?.textContent?.trim(),
    ).toBe("· 4 of 11 books");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("no_news_shows_sync_time", () => {
    const { container } = renderHeader({
      kind: "semNovidades",
      syncedAt: new Date(2026, 10, 19, 10, 42),
    });
    expect(
      container
        .querySelector('[data-slot="library-header-message"]')
        ?.textContent?.trim(),
    ).toBe("No new highlights");
    expect(
      container
        .querySelector('[data-slot="library-header-detail"]')
        ?.textContent?.trim(),
    ).toMatch(/^synced at 10:42/);
  });
});

describe("LibraryHeader announcements", () => {
  it("announces_start_and_end_only", async () => {
    const { rerender } = renderHeader(NOVOS);
    expect(live().getAttribute("aria-live")).toBe("polite");
    const header = document.querySelector('[data-slot="library-header"]');
    expect(header?.contains(live())).toBe(false);

    await rerender({ state: { kind: "aSincronizar", done: 0, total: 11 } });
    expect(live().textContent?.trim()).toBe("Syncing with the Kobo");
    // Each book changes the screen, not the region.
    const seen: string[] = [];
    const observer = new MutationObserver(() =>
      seen.push(live().textContent ?? ""),
    );
    observer.observe(live(), {
      childList: true,
      characterData: true,
      subtree: true,
    });
    for (const done of [1, 2, 3, 10]) {
      await rerender({ state: { kind: "aSincronizar", done, total: 11 } });
    }
    await Promise.resolve();
    expect(seen).toEqual([]);
    expect(live().textContent?.trim()).toBe("Syncing with the Kobo");
    expect(screen.getByText("· 10 of 11 books")).toBeTruthy();

    await rerender({ state: NOVOS });
    expect(live().textContent?.trim()).toBe("12 new highlights in 3 books");
    observer.disconnect();

    await rerender({
      state: { kind: "semNovidades", syncedAt: new Date(2026, 10, 19, 10, 42) },
    });
    expect(live().textContent?.trim()).toBe("No new highlights");
  });
});

describe("LibraryHeader error", () => {
  it("error_is_alert_and_retry_calls_on_retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { container } = renderHeader(
      { kind: "erro", message: "Could not read the Kobo" },
      { onRetry },
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Could not sync the Kobo");
    expect(alert.textContent).toContain("Could not read the Kobo");
    expect(alert.querySelector("svg.lucide-circle-alert")).not.toBeNull();
    expect(
      alert
        .querySelector("svg.lucide-circle-alert")
        ?.classList.contains("text-destructive"),
    ).toBe(true);
    expect(
      container
        .querySelector('[data-slot="library-header-detail"]')
        ?.classList.contains("text-muted-foreground"),
    ).toBe(true);
    expect(onRetry).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("only_the_error_is_an_alert", () => {
    renderHeader(NOVOS);
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("LibraryHeader actions", () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
  afterEach(() => vi.useRealTimers());

  it("show_only_and_export_call_callbacks", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onShowOnly = vi.fn();
    const onExport = vi.fn();
    renderHeader(NOVOS, { onShowOnly, onExport });
    await user.click(screen.getByRole("button", { name: "Show only these" }));
    expect(onShowOnly).toHaveBeenCalledTimes(1);
    expect(onExport).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Export 3 books" }));
    expect(onExport).toHaveBeenCalledTimes(1);
    expect(onShowOnly).toHaveBeenCalledTimes(1);
  });

  it("export_button_shows_exported_for_2s", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderHeader(NOVOS, { onExport: vi.fn() });
    await user.click(screen.getByRole("button", { name: "Export 3 books" }));
    const button = screen.getByRole("button", { name: "Exporting…" });
    expect(button.getAttribute("aria-disabled")).toBe("true");
    await vi.advanceTimersByTimeAsync(501);
    expect(screen.getByRole("button", { name: "✓ Exported" })).toBe(button);
    await vi.advanceTimersByTimeAsync(1990);
    expect(screen.getByRole("button", { name: "✓ Exported" })).toBe(button);
    await vi.advanceTimersByTimeAsync(20);
    expect(screen.getByRole("button", { name: "Export 3 books" })).toBe(button);
  });
});
