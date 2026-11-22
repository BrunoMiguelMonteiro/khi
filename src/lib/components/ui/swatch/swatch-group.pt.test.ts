import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import Fixture from "./swatch.fixture.svelte";

// vitest-setup mocks $lib/i18n with English only; this file checks the real one in Portuguese.
vi.unmock("$lib/i18n");
const { locale } = await import("$lib/i18n");

describe("SwatchGroup in Portuguese", () => {
  afterEach(() => locale.set("en"));

  it("radiogroup_named_cor_de_realce", () => {
    locale.set("pt");
    render(Fixture, { props: { value: "system" } });
    const group = document.querySelector<HTMLElement>('[data-slot="swatch-group"]');
    expect(screen.getByRole("radiogroup", { name: "Cor de realce" })).toBe(group);
  });
});
