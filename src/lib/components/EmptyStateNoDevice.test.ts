import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import EmptyStateNoDevice from "./EmptyStateNoDevice.svelte";

const locale = (lang: "pt" | "en") =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), `src/lib/i18n/locales/${lang}.json`),
      "utf8",
    ),
  );

describe("EmptyStateNoDevice · screen 6 · first start", () => {
  it("says_to_plug_in_the_kobo_and_that_the_library_keeps_the_highlights", () => {
    render(EmptyStateNoDevice);
    expect(
      screen.getByRole("heading", { name: "Connect your Kobo" }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Your highlights stay in the Library even with the Kobo unplugged, and you export to Markdown whenever you like.",
      ),
    ).toBeTruthy();
  });

  it("texts_in_pt_follow_the_figma", () => {
    expect(locale("pt").screens.noKobo).toEqual({
      title: "Liga o teu Kobo",
      subtitle:
        "Os destaques ficam guardados na Biblioteca, mesmo com o Kobo desligado, e exportas para Markdown quando quiseres.",
    });
  });

  it("is_a_polite_status_region", () => {
    render(EmptyStateNoDevice);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toContain("Connect your Kobo");
  });

  it("draws_the_dashed_kobo_at_96", () => {
    const { container } = render(EmptyStateNoDevice);
    const icon = container.querySelector<HTMLElement>(".kobo-icon")!;
    expect(icon.style.width).toBe("96px");
    // The dashed drawing, not the solid one: it has dashed strokes
    expect(icon.innerHTML).toContain("stroke-dasharray");
  });

  it("has_the_skeleton_of_the_syncing_state", () => {
    const { container } = render(EmptyStateNoDevice);
    const root = screen.getByRole("status");
    expect(root.className).toContain("gap-6");
    expect(root.className).toContain("bg-background");
    expect(root.className).not.toContain("neutral");
    const text = container.querySelector<HTMLElement>(".w-\\[320px\\]")!;
    expect(text.className).toContain("gap-2");
    const title = screen.getByRole("heading");
    expect(title.className).toContain("text-title-3");
    expect(title.className).toContain("text-foreground");
    const subtitle = text.querySelector("p")!;
    expect(subtitle.className).toContain("text-body");
    expect(subtitle.className).toContain("text-muted-foreground");
  });
});
