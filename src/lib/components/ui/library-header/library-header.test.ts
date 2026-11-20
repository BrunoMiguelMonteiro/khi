import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `prefersReducedMotion` (svelte/motion) reads its media query when the module loads: the stub goes in first.
const reduceMotion = vi.hoisted(() => {
  const query = { matches: false };
  const original = window.matchMedia;
  window.matchMedia = ((q: string) =>
    /reduced-motion/.test(q)
      ? Object.assign(query, {
          media: q,
          addEventListener: () => {},
          removeEventListener: () => {},
        })
      : original(q)) as typeof window.matchMedia;
  return query;
});
import { render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { tick } from "svelte";
import Fixture from "./library-header-fixture.svelte";
import ToggleFixture from "./library-header-toggle.fixture.svelte";
import PropsFixture from "./library-header-props.fixture.svelte";
import { LibraryHeader } from "./index";
import type { LibraryHeaderState } from "./index";

const NOVOS: LibraryHeaderState = {
  kind: "novos",
  highlights: 12,
  books: 3,
  since: new Date(2026, 10, 9, 10, 0),
};

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
    const { container, unmount } = renderHeader(NOVOS, {
      onShowOnly: vi.fn(),
    });
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

  it("novos_without_since_omits_date", () => {
    const { since: _since, ...withoutSince } = NOVOS as Extract<
      LibraryHeaderState,
      { kind: "novos" }
    >;
    const { container } = renderHeader(withoutSince);
    expect(
      container
        .querySelector('[data-slot="library-header-message"]')
        ?.textContent?.trim(),
    ).toBe("12 new highlights in 3 books");
    expect(
      container.querySelector('[data-slot="library-header-detail"]'),
    ).toBeNull();
    expect(screen.getByRole("button", { name: "Export 3 books" })).toBeTruthy();
  });

  it("show_only_hidden_without_handler", () => {
    const { unmount } = renderHeader(NOVOS);
    expect(screen.queryByRole("button", { name: "Show only these" })).toBeNull();
    expect(screen.getByRole("button", { name: "Export 3 books" })).toBeTruthy();
    unmount();

    renderHeader(NOVOS, { onShowOnly: vi.fn() });
    expect(
      screen.getByRole("button", { name: "Show only these" }),
    ).toBeTruthy();
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

  it("header_hides_count_before_total_known", () => {
    const { container } = renderHeader({ kind: "aSincronizar", done: 0, total: 0 });
    expect(
      container
        .querySelector('[data-slot="library-header-message"]')
        ?.textContent?.trim(),
    ).toBe("Syncing with the Kobo");
    // No «· 0 of 0 books»: the Kobo has not said how many there are
    expect(
      container.querySelector('[data-slot="library-header-detail"]'),
    ).toBeNull();
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

  it("no_news_without_sync_time_omits_time", () => {
    const { container } = renderHeader({ kind: "semNovidades" });
    expect(
      container
        .querySelector('[data-slot="library-header-message"]')
        ?.textContent?.trim(),
    ).toBe("No new highlights");
    expect(
      container.querySelector('[data-slot="library-header-detail"]'),
    ).toBeNull();
  });
});

describe("LibraryHeader announcements", () => {
  it("has_no_polite_region_of_its_own", async () => {
    const { rerender } = renderHeader(NOVOS);
    expect(document.querySelector("[aria-live]")).toBeNull();
    await rerender({ state: { kind: "aSincronizar", done: 1, total: 11 } });
    expect(document.querySelector("[aria-live]")).toBeNull();
    // The error alert stays: it is the header's
    await rerender({ state: { kind: "erro", message: "" } });
    expect(document.querySelector('[role="alert"]')).not.toBeNull();
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
    // Only the error text is announced: the button is outside the alert.
    const retry = screen.getByRole("button", { name: "Try again" });
    expect(alert.contains(retry)).toBe(false);
    expect(alert.querySelector("button")).toBeNull();
    const icon = container.querySelector(
      '[data-slot="library-header"] svg.lucide-circle-alert',
    );
    expect(icon?.classList.contains("text-destructive")).toBe(true);
    expect(
      container
        .querySelector('[data-slot="library-header-detail"]')
        ?.classList.contains("text-muted-foreground"),
    ).toBe(true);
    expect(onRetry).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("retry_hidden_without_handler", () => {
    const { unmount } = renderHeader({ kind: "erro", message: "x" });
    expect(screen.getByRole("alert").textContent).toContain("Could not sync");
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    unmount();

    renderHeader({ kind: "erro", message: "x" }, { onRetry: vi.fn() });
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("alert_region_persists_and_fills_on_the_transition_to_error", async () => {
    const { rerender } = renderHeader({
      kind: "aSincronizar",
      done: 1,
      total: 4,
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("");
    await rerender({
      state: { kind: "erro", message: "Could not read the Kobo" },
    });
    expect(screen.getByRole("alert")).toBe(alert);
    expect(alert.textContent).toContain("Could not sync the Kobo");
    expect(alert.textContent).toContain("Could not read the Kobo");
    expect(alert.querySelector("button")).toBeNull();
    await rerender({ state: NOVOS });
    expect(alert.textContent).toBe("");
  });

  it("only_the_error_is_an_alert", () => {
    renderHeader(NOVOS);
    expect(screen.getByRole("alert").textContent).toBe("");
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
    // Only the fake clock: with shouldAdvanceTime a busy machine adds real
    // time, and the 2 s are over before they are checked
    vi.useFakeTimers();
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

  it("exporting_wins_over_a_stale_exported", async () => {
    render(LibraryHeader, {
      props: { state: NOVOS, exporting: true, exported: true },
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByRole("button", { name: "Exporting…" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "✓ Exported" })).toBeNull();
  });

  it("a_new_export_clears_the_old_success_and_its_timer", async () => {
    // Only `exporting` changes, as from a real parent; `exported` stays true.
    const { component } = render(PropsFixture, { props: { state: NOVOS } });
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByRole("button", { name: "✓ Exported" })).toBeTruthy();
    await vi.advanceTimersByTimeAsync(1500);
    component.setExport({ exporting: true });
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.getByRole("button", { name: "Exporting…" })).toBeTruthy();
    await vi.advanceTimersByTimeAsync(100);
    component.setExport({ exporting: false });
    // The first window would have closed at 2000 ms; the new one runs 2 s from here.
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByRole("button", { name: "✓ Exported" })).toBeTruthy();
    await vi.advanceTimersByTimeAsync(1100);
    expect(screen.getByRole("button", { name: "Export 3 books" })).toBeTruthy();
  });
});

describe("LibraryHeader outro", () => {
  const durations = () =>
    vi.mocked(Element.prototype.animate).mock.calls.map(
      ([, options]) => (options as { duration: number }).duration,
    );

  beforeEach(() => {
    Element.prototype.getAnimations = () => [];
    // jsdom has no Web Animations: each one ends after its duration, as Svelte's outro waits for it
    Element.prototype.animate = vi.fn((_k: unknown, options: { duration: number }) => {
      const animation = {
        onfinish: null as null | (() => void),
        cancel: () => clearTimeout(timer),
      };
      const timer = setTimeout(() => animation.onfinish?.(), options.duration);
      return animation;
    }) as never;
  });
  afterEach(() => {
    reduceMotion.matches = false;
  });

  async function leave() {
    const user = userEvent.setup();
    render(ToggleFixture, { props: { state: NOVOS } });
    await user.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() =>
      expect(
        document.querySelector('[data-slot="library-header"]'),
      ).toBeNull(),
    );
  }

  it("outro_fades_in_150ms", async () => {
    await leave();
    expect(durations()).toContain(150);
  });

  it("outro_is_instant_with_reduced_motion", async () => {
    reduceMotion.matches = true;
    await leave();
    expect(durations()).not.toContain(150);
    expect(
      document.querySelector('[data-slot="library-header"]'),
    ).toBeNull();
  });

  const headers = () =>
    document.querySelectorAll('[data-slot="library-header"]');
  const strips = () =>
    document.querySelectorAll('[data-slot="library-header-strip"]');

  it("kind_change_enters_anew_without_the_outro", async () => {
    const { rerender } = renderHeader({ kind: "aSincronizar", done: 3, total: 11 });
    const before = strips()[0];

    // The end of a Sync: «novos» comes in again (a new strip, so the animate-in plays again), and the
    // old one goes at once: there are never two for the 150 ms of a fade
    await rerender({ state: NOVOS });
    await tick();
    expect(headers()).toHaveLength(1);
    expect(strips()).toHaveLength(1);
    expect(strips()[0]).not.toBe(before);
    expect(before.isConnected).toBe(false);
    expect(headers()[0].getAttribute("data-state")).toBe("novos");
    expect(durations()).not.toContain(150);
  });

  it("same_kind_keeps_the_same_strip", async () => {
    const { rerender } = renderHeader({ kind: "aSincronizar", done: 3, total: 11 });
    const before = strips()[0];
    await rerender({ state: { kind: "aSincronizar", done: 4, total: 11 } });
    expect(strips()[0]).toBe(before);
  });

  it("leaving_after_a_kind_change_still_fades_in_150ms", async () => {
    const user = userEvent.setup();
    const { rerender } = render(ToggleFixture, {
      props: { state: { kind: "aSincronizar", done: 3, total: 11 } },
    });
    await rerender({ state: NOVOS });
    await tick();
    expect(durations()).not.toContain(150);

    await user.click(screen.getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(headers()).toHaveLength(0));
    expect(durations()).toContain(150);
  });
});
