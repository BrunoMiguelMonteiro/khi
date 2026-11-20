import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import EmptyStateSyncing from "./EmptyStateSyncing.svelte";

describe("EmptyStateSyncing", () => {
  it("is_not_a_live_region_and_holds_the_progress", () => {
    render(EmptyStateSyncing, { props: { progress: { done: 2, total: 5 } } });
    const progress = screen.getByText(/2/, { selector: "p" });
    expect(progress).toBeTruthy();
    expect(screen.getByTestId("syncing-state").contains(progress)).toBe(true);
    expect(progress.closest("[aria-live], [role=status]")).toBeNull();
    expect(document.querySelector("[aria-live], [role=status]")).toBeNull();
  });
});
