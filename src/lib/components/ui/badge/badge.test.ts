import { describe, expect, it } from "vitest";
import { render } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { compileAppCss } from "$lib/test/css";
import { Badge } from "./index";

const text = (s: string) =>
  createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

const badgeOf = (container: HTMLElement) => {
  const el = container.querySelector('[data-slot="badge"]');
  if (!(el instanceof HTMLElement)) throw new Error("no badge rendered");
  return el;
};

/** The declarations Tailwind emits for one class, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return (
    css.match(new RegExp(`\\.${candidate} \\{[\\s\\S]*?\\n  \\}`))?.[0] ?? ""
  );
}

// Componentes (D7) · 1 · Etiqueta (55:584): each Figma binding and the one class that carries it.
const FIGMA_BINDINGS = [
  // Figma binds spacing/1 to paddingLeft/paddingRight only; top/bottom are 0 (height 14 = line height).
  { binding: "spacing/1 (left, right)", utility: "px-1", css: "padding-inline: var(--spacing);" },
  {
    binding: "radius/badge",
    utility: "rounded-badge",
    css: "border-radius: var(--radius-badge);",
  },
  {
    binding: "primary-tint",
    utility: "bg-primary-tint",
    css: "background-color: var(--primary-tint);",
  },
  {
    binding: "primary-tint-foreground",
    utility: "text-primary-tint-foreground",
    css: "color: var(--primary-tint-foreground);",
  },
  {
    binding: "Interface/Subheadline Semibold",
    utility: "text-subheadline-semibold",
    css: "font-size: 11px;\n    line-height: 14px;\n    font-weight: 600;",
  },
  // Tema 3: 1 px inside stroke (stroke/border), transparent outside the contrast modes.
  { binding: "stroke/border (inside)", utility: "inset-ring", css: "inset 0 0 0 1px" },
  {
    binding: "contrast-outline-tint",
    utility: "inset-ring-contrast-outline-tint",
    css: "--tw-inset-ring-color: var(--contrast-outline-tint);",
  },
];

describe("Badge", () => {
  it("badge_uses_tint_tokens", async () => {
    const { container } = render(Badge, { children: text("6 novos") });
    const badge = badgeOf(container);
    expect(badge.tagName).toBe("SPAN");
    expect(badge.textContent).toBe("6 novos");
    for (const { binding, utility, css } of FIGMA_BINDINGS) {
      expect(badge.classList.contains(utility), `${binding} → ${utility}`).toBe(
        true,
      );
      expect(await ruleOf(utility), utility).toContain(css);
    }
    // One variant only: no other fill, text colour or radius competes with the tint.
    const colours = [...badge.classList].filter((c) =>
      /^(bg|rounded|border)-/.test(c),
    );
    expect(colours.sort()).toEqual(["bg-primary-tint", "rounded-badge"]);
    // The height hugs the text: no fixed height (Figma height is hug on purpose).
    expect(
      [...badge.classList].filter((c) => /^(h|size|min-h)-/.test(c)),
    ).toEqual([]);
  });

  it("badge_is_tabular", async () => {
    const { container } = render(Badge, { children: text("11") });
    expect(badgeOf(container).classList.contains("tabular-nums")).toBe(true);
    expect(await ruleOf("tabular-nums")).toMatch(
      /--tw-numeric-spacing: tabular-nums;/,
    );
  });

  it("badge_has_contrast_outline", async () => {
    const { container } = render(Badge, {
      children: text("Novo"),
      class: "ml-2",
    });
    const classes = [...badgeOf(container).classList];
    expect(classes).toContain("ml-2");
    // Tema 3: the outline is always drawn; contrast-outline-tint is transparent outside the
    // Figma contrast modes, so no contrast-more: variant is needed (tokens.css holds the modes).
    const ring = classes.filter((c) => c.includes("inset-ring"));
    expect(ring.sort()).toEqual(["inset-ring", "inset-ring-contrast-outline-tint"]);
  });
});
