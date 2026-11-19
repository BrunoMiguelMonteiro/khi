import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss } from "$lib/test/css";
import { buttonVariants } from "../button";
import Fixture from "./dialog.fixture.svelte";

type Binding = { binding: string; utility: string; css: string };
type Kind = "apagar" | "kobo" | "sem-campo";

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

const TITLE = {
  apagar: "Apagar este livro?",
  kobo: "Kobo novo",
  "sem-campo": "Kobo novo",
};
const ROLE = {
  apagar: "alertdialog",
  kobo: "dialog",
  "sem-campo": "dialog",
} as const;
const OPENER = { apagar: "Apagar livro", kobo: "Abrir", "sem-campo": "Abrir" };

async function setup(kind: Kind) {
  const onconfirm = vi.fn();
  const onOpenChange = vi.fn();
  render(Fixture, { kind, onconfirm, onOpenChange });
  const user = userEvent.setup();
  const opener = screen.getByRole("button", { name: OPENER[kind] });
  const open = async () => {
    await user.click(opener);
    return screen.findByRole(ROLE[kind], { name: TITLE[kind] });
  };
  const window = await open();
  // Bits UI moves focus after a frame; every test starts from the settled initial focus.
  await waitFor(() =>
    expect(window.contains(document.activeElement)).toBe(true),
  );
  return { user, opener, window, open, onconfirm, onOpenChange };
}

const closed = (kind: Kind) =>
  waitFor(() => expect(screen.queryByRole(ROLE[kind])).toBeNull());

// Componentes (D7) · 15 · Janela modal (58:6822), Apagar livro (58:6782).
const WINDOW_BINDINGS: Binding[] = [
  {
    binding: "width 380",
    utility: "w-95",
    css: "width: calc(var(--spacing) * 95);",
  },
  {
    binding: "spacing/6 (padding)",
    utility: "p-6",
    css: "padding: calc(var(--spacing) * 6);",
  },
  {
    binding: "spacing/2 (item spacing)",
    utility: "gap-2",
    css: "gap: calc(var(--spacing) * 2);",
  },
  {
    binding: "radius/menu",
    utility: "rounded-menu",
    css: "border-radius: var(--radius-menu);",
  },
  {
    binding: "popover (fill)",
    utility: "bg-popover",
    css: "background-color: var(--popover);",
  },
  {
    binding: "stroke/border (inside)",
    utility: "border-(length:--stroke-border)",
    css: "border-width: var(--stroke-border);",
  },
  {
    binding: "border (stroke)",
    utility: "border-border",
    css: "border-color: var(--border);",
  },
  {
    binding: "Sombra/Janela",
    utility: "shadow-sombra-janela",
    css: "--tw-shadow: 0 8px 24px var(--tw-shadow-color, rgb(0 0 0 / 0.18));",
  },
];

const TITLE_BINDINGS: Binding[] = [
  {
    binding: "Interface/Title 3",
    utility: "text-title-3",
    css: "font-size: 15px;\n    line-height: 20px;\n    font-weight: 600;",
  },
  {
    binding: "foreground (title)",
    utility: "text-foreground",
    css: "color: var(--foreground);",
  },
];

const TEXT_BINDINGS: Binding[] = [
  {
    binding: "Interface/Body",
    utility: "text-body",
    css: "font-size: 13px;\n    line-height: 16px;",
  },
  {
    binding: "foreground (text)",
    utility: "text-foreground",
    css: "color: var(--foreground);",
  },
];

const BUTTONS_BINDINGS: Binding[] = [
  {
    binding: "spacing/4 (top)",
    utility: "pt-4",
    css: "padding-top: calc(var(--spacing) * 4);",
  },
  {
    binding: "spacing/2 (item spacing)",
    utility: "gap-2",
    css: "gap: calc(var(--spacing) * 2);",
  },
  {
    binding: "align end",
    utility: "justify-end",
    css: "justify-content: flex-end;",
  },
];

// Movimento 4 (J2): 200 ms in, 150 ms out, ease/out, fade and 0.97 → 1 from the centre.
const MOTION: Binding[] = [
  {
    binding: "open fade",
    utility: "data-open:fade-in-0",
    css: "--tw-enter-opacity: 0;",
  },
  {
    binding: "open scale 0.97",
    utility: "data-open:zoom-in-(--scale-modal-from)",
    css: "--tw-enter-scale: var(--scale-modal-from);",
  },
  {
    binding: "duration/in",
    utility: "data-open:duration-(--duration-in)",
    css: "transition-duration: var(--duration-in);",
  },
  {
    binding: "ease/out (open)",
    utility: "data-open:ease-out",
    css: "--tw-ease: var(--ease-out);",
  },
  {
    binding: "close fade",
    utility: "data-closed:fade-out-0",
    css: "--tw-exit-opacity: 0;",
  },
  {
    binding: "close scale 0.97",
    utility: "data-closed:zoom-out-(--scale-modal-from)",
    css: "--tw-exit-scale: var(--scale-modal-from);",
  },
  {
    binding: "duration/out",
    utility: "data-closed:duration-(--duration-out)",
    css: "transition-duration: var(--duration-out);",
  },
  {
    binding: "ease/out (close)",
    utility: "data-closed:ease-out",
    css: "--tw-ease: var(--ease-out);",
  },
  {
    binding: "from the centre",
    utility: "origin-center",
    css: "transform-origin: center;",
  },
];

// Reduzir movimento keeps only the fade (J1).
const REDUCED: Binding[] = [
  {
    binding: "reduced open",
    utility: "data-open:motion-reduce:zoom-in-100",
    css: "--tw-enter-scale: 1;",
  },
  {
    binding: "reduced close",
    utility: "data-closed:motion-reduce:zoom-out-100",
    css: "--tw-exit-scale: 1;",
  },
];

describe("Janela modal", () => {
  // jsdom has no layout, so tabbable (Bits UI's focus scope) takes every element as hidden.
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
      new DOMRect(0, 0, 1, 1),
    ] as unknown as DOMRectList);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("alert_dialog_role_name_and_description", async () => {
    const { window } = await setup("apagar");
    expect(window.getAttribute("role")).toBe("alertdialog");
    expect(window.getAttribute("aria-modal")).toBe("true");
    expect(window).toHaveAccessibleName("Apagar este livro?");
    expect(window).toHaveAccessibleDescription(
      "Todos os destaques foram removidos do Kobo. O livro e os destaques saem da Biblioteca de vez.",
    );
  });

  it("dialog_role_name_and_description", async () => {
    const { window } = await setup("kobo");
    expect(window.getAttribute("role")).toBe("dialog");
    expect(window.getAttribute("aria-modal")).toBe("true");
    expect(window).toHaveAccessibleName("Kobo novo");
    expect(window).toHaveAccessibleDescription(
      "De quem é este Kobo? Os destaques ficam na Biblioteca desse leitor.",
    );
  });

  it("focus_goes_to_window_without_text_field", async () => {
    for (const kind of ["apagar", "sem-campo"] as const) {
      const { window } = await setup(kind);
      // Not the first button (Bits UI's Dialog default): Return or Space there would act at once.
      expect(document.activeElement, kind).toBe(window);
      expect(window.getAttribute("tabindex"), kind).toBe("-1");
      cleanup();
    }
  });

  it("focus_goes_to_text_field_when_present", async () => {
    await setup("kobo");
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Nome do leitor" }),
    );
  });

  it("focus_is_trapped_and_returns_to_opener", async () => {
    const { user, opener, window } = await setup("apagar");
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    const confirm = screen.getByRole("button", { name: "Apagar" });
    await user.tab();
    expect(document.activeElement).toBe(cancel);
    await user.tab();
    expect(document.activeElement).toBe(confirm);
    await user.tab();
    expect(document.activeElement).toBe(cancel);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirm);
    expect(window.contains(document.activeElement)).toBe(true);

    await user.click(cancel);
    await closed("apagar");
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });

  it("escape_and_cmd_period_cancel", async () => {
    for (const kind of ["apagar", "kobo"] as const) {
      const { user, opener, open, onconfirm, onOpenChange } = await setup(kind);

      // Esc that ends an IME composition only ends the composition.
      onOpenChange.mockClear();
      fireEvent.keyDown(document.activeElement!, {
        key: "Escape",
        isComposing: true,
      });
      fireEvent.keyDown(document.activeElement!, {
        key: "Escape",
        keyCode: 229,
      });
      expect(onOpenChange, kind).not.toHaveBeenCalled();
      expect(
        screen.getByRole(ROLE[kind]).getAttribute("data-state"),
        kind,
      ).toBe("open");

      await user.keyboard("{Escape}");
      await closed(kind);
      expect(onOpenChange, kind).toHaveBeenLastCalledWith(false);
      await waitFor(() => expect(document.activeElement).toBe(opener));

      const window = await open();
      await waitFor(() =>
        expect(window.contains(document.activeElement)).toBe(true),
      );
      onOpenChange.mockClear();
      // ⌘ with another key, or Control-period, is not Cancel.
      await user.keyboard("{Meta>}k{/Meta}{Control>}.{/Control}");
      expect(onOpenChange, kind).not.toHaveBeenCalled();
      expect(window.getAttribute("data-state"), kind).toBe("open");
      await user.keyboard("{Meta>}.{/Meta}");
      await closed(kind);
      expect(onOpenChange, kind).toHaveBeenCalledExactlyOnceWith(false);
      await waitFor(() => expect(document.activeElement).toBe(opener));

      expect(onconfirm, kind).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("return_does_not_confirm_without_default_button", async () => {
    const { user, window, onconfirm } = await setup("apagar");
    await user.keyboard("{Enter}");
    expect(onconfirm).not.toHaveBeenCalled();
    expect(screen.getByRole("alertdialog")).toBe(window);
    expect(window.querySelector("[data-dialog-default]")).toBeNull();
  });

  it("return_confirms_default_button", async () => {
    const { user, onconfirm } = await setup("kobo");
    const field = screen.getByRole("textbox", { name: "Nome do leitor" });
    await user.type(field, "Ana");

    // An IME composition commits with Return: WebKit's keydown has isComposing, or keyCode 229
    // when compositionend comes first; neither confirms.
    fireEvent.keyDown(field, { key: "Enter", isComposing: true });
    fireEvent.keyDown(field, { key: "Enter", keyCode: 229 });
    // Return with a modifier is not Return.
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(onconfirm).not.toHaveBeenCalled();

    await user.keyboard("{Enter}");
    expect(onconfirm).toHaveBeenCalledOnce();

    // A focused button handles Return itself: Cancelar cancels, it does not also confirm.
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    cancel.focus();
    await user.keyboard("{Enter}");
    await closed("kobo");
    expect(onconfirm).toHaveBeenCalledOnce();
  });

  it("return_confirms_default_button_from_window", async () => {
    const { user, window, onconfirm } = await setup("sem-campo");
    expect(document.activeElement).toBe(window);
    await user.keyboard("{Enter}");
    expect(onconfirm).toHaveBeenCalledOnce();
  });

  it("destructive_action_is_secondary_with_destructive_text", async () => {
    await setup("apagar");
    const confirm = screen.getByRole("button", { name: "Apagar" });
    const cancel = screen.getByRole("button", { name: "Cancelar" });
    const secondary = buttonVariants({ variant: "secundario" })
      .split(/\s+/)
      .filter((c) => c !== "text-foreground");
    for (const c of secondary)
      expect(confirm.classList.contains(c), c).toBe(true);
    expect(confirm.classList.contains("text-destructive-text")).toBe(true);
    expect(confirm.classList.contains("text-foreground")).toBe(false);
    expect(confirm.classList.contains("bg-primary")).toBe(false);
    expect(await ruleOf("text-destructive-text")).toContain(
      "color: var(--destructive-text);",
    );
    for (const c of buttonVariants({ variant: "secundario" }).split(/\s+/))
      expect(cancel.classList.contains(c), `Cancelar ${c}`).toBe(true);
  });

  it("default_action_is_principal", async () => {
    await setup("sem-campo");
    const confirm = screen.getByRole("button", { name: "Criar leitor" });
    for (const c of buttonVariants({ variant: "principal" }).split(/\s+/))
      expect(confirm.classList.contains(c), c).toBe(true);
    expect(confirm.hasAttribute("data-dialog-default")).toBe(true);
  });

  it("overlay_uses_scrim", async () => {
    for (const [kind, slot] of [
      ["apagar", "alert-dialog-overlay"],
      ["kobo", "dialog-overlay"],
    ] as const) {
      await setup(kind);
      const overlay = document.querySelector(`[data-slot="${slot}"]`)!;
      expect(overlay, kind).not.toBeNull();
      await expectBindings(overlay, [
        {
          binding: "scrim (fill)",
          utility: "bg-scrim",
          css: "background-color: var(--scrim);",
        },
        {
          binding: "covers the window",
          utility: "inset-0",
          css: "inset: 0px;",
        },
        ...MOTION.filter((m) => /fade|duration|ease/.test(m.binding)),
      ]);
      cleanup();
    }
  });

  it("matches_figma_bindings", async () => {
    for (const [kind, prefix] of [
      ["apagar", "alert-dialog"],
      ["kobo", "dialog"],
    ] as const) {
      const { window } = await setup(kind);
      await expectBindings(window, WINDOW_BINDINGS);
      await expectBindings(
        document.querySelector(`[data-slot="${prefix}-title"]`)!,
        TITLE_BINDINGS,
      );
      await expectBindings(
        document.querySelector(`[data-slot="${prefix}-description"]`)!,
        TEXT_BINDINGS,
      );
      await expectBindings(
        document.querySelector(`[data-slot="${prefix}-footer"]`)!,
        BUTTONS_BINDINGS,
      );
      cleanup();
    }
  });

  it("motion_scales_from_centre_reduced_is_fade", async () => {
    const tokens = readFileSync(
      resolve(process.cwd(), "src/lib/styles/tokens.css"),
      "utf8",
    );
    expect(tokens).toMatch(/--scale-modal-from: 0\.97;/);
    for (const kind of ["apagar", "kobo"] as const) {
      const { window } = await setup(kind);
      await expectBindings(window, [...MOTION, ...REDUCED]);
      for (const { utility } of REDUCED)
        expect(await ruleOf(utility), utility).toContain(
          "prefers-reduced-motion: reduce",
        );
      // The fade stays under Reduzir movimento.
      expect(
        [...window.classList].filter((c) => /motion-reduce:.*fade/.test(c)),
      ).toEqual([]);
      cleanup();
    }
  });
});
