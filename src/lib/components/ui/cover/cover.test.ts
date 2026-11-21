import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/svelte";
import { isInaccessible } from "@testing-library/dom";
import { tick } from "svelte";
import { Scanner } from "@tailwindcss/oxide";
import { compileAppCss } from "$lib/test/css";
import SizeFixture from "./cover-size.fixture.svelte";
import { COVER_BG, COVER_TONES, Cover, Thumbnail, coverTone } from "./index";

type Binding = { binding: string; utility: string; css: string };

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

const locale = (lang: "pt" | "en") =>
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), `src/lib/i18n/locales/${lang}.json`),
      "utf8",
    ),
  );

const slot = (root: ParentNode, name: string) =>
  root.querySelector<HTMLElement>(`[data-slot="${name}"]`);

function must(el: HTMLElement | null, what: string): HTMLElement {
  if (!el) throw new Error(`no ${what} rendered`);
  return el;
}

const BOOK = { title: "Os Maias", author: "Eça de Queirós", bookId: 42 };

// Capas 1: the eight tones, in the order of the Figma variants (Capa, 63:3281).
const TONES = [
  "verde",
  "ardosia",
  "castanho",
  "ameixa",
  "azul",
  "oliva",
  "petroleo",
  "tijolo",
];

// Componentes (D7) · 16 · Capa (63:3281).
const COVER_BINDINGS: Binding[] = [
  { binding: "2:3", utility: "aspect-2/3", css: "aspect-ratio: 2/3;" },
  {
    binding: "radius/cover",
    utility: "rounded-cover",
    css: "border-radius: var(--radius-cover);",
  },
  {
    binding: "spacing/3 (padding)",
    utility: "p-3",
    css: "padding: calc(var(--spacing) * 3);",
  },
  {
    binding: "spacing/1 (gap)",
    utility: "gap-1",
    css: "gap: var(--spacing);",
  },
];
// Componentes 6: 1 px inside, over the image, in cover-border.
const BORDER_BINDINGS: Binding[] = [
  {
    binding: "stroke/border (inside)",
    utility: "inset-ring",
    css: "inset 0 0 0 1px",
  },
  {
    binding: "cover-border",
    utility: "inset-ring-cover-border",
    css: "--tw-inset-ring-color: var(--cover-border);",
  },
];
const TITLE_BINDINGS: Binding[] = [
  {
    binding: "Capa/Título",
    utility: "text-cover-title",
    css: "font-size: 15px;",
  },
  {
    binding: "cover-foreground",
    utility: "text-cover-foreground",
    css: "color: var(--cover-foreground);",
  },
  {
    binding: "up to 4 lines with an ellipsis",
    utility: "line-clamp-4",
    css: "-webkit-line-clamp: 4;",
  },
];
const AUTHOR_BINDINGS: Binding[] = [
  {
    binding: "Capa/Autor",
    utility: "text-cover-author",
    css: "font-style: italic;",
  },
  {
    binding: "cover-foreground",
    utility: "text-cover-foreground",
    css: "color: var(--cover-foreground);",
  },
  {
    binding: "one line with an ellipsis",
    utility: "truncate",
    css: "text-overflow: ellipsis;",
  },
];
// Movimento 3: the badge leaves with a 150 ms fade on ease/out.
const BADGE_EXIT: Binding[] = [
  {
    binding: "fade",
    utility: "data-closed:fade-out-0",
    css: "--tw-exit-opacity: 0;",
  },
  {
    binding: "duration/out",
    utility: "data-closed:duration-(--duration-out)",
    css: "--tw-duration: var(--duration-out);",
  },
  {
    binding: "ease/out",
    utility: "data-closed:ease-out",
    css: "--tw-ease: var(--ease-out);",
  },
];

describe("coverTone", () => {
  it("cover_tone_is_stable_per_book", async () => {
    const ids = Array.from({ length: 50 }, (_, i) => i * 7 + 1);
    const first = ids.map((id) => coverTone(id));
    expect(ids.map((id) => coverTone(id))).toEqual(first);
    // The tone comes from the id alone: a string id is the same book.
    expect(ids.map((id) => coverTone(String(id)))).toEqual(first);
    // Pinned (FNV-1a): a new hash would recolour every library on update.
    expect([1, 2, 3, 42, 1000, 31337].map((id) => coverTone(id))).toEqual([
      "azul",
      "oliva",
      "castanho",
      "ameixa",
      "azul",
      "verde",
    ]);

    // The cover follows the book, not its title or author.
    const a = render(Cover, { props: { ...BOOK } });
    const b = render(Cover, {
      props: { ...BOOK, title: "A Cidade e as Serras", author: "Outro" },
    });
    const tone = COVER_BG[coverTone(BOOK.bookId)];
    expect(must(slot(a.container, "cover"), "cover").classList).toContain(tone);
    expect(must(slot(b.container, "cover"), "cover").classList).toContain(tone);
    await expectBindings(
      must(slot(a.container, "cover"), "cover"),
      COVER_BINDINGS,
    );
  });

  it("cover_tone_uses_all_eight_tones", () => {
    expect([...COVER_TONES]).toEqual(TONES);
    const counts = new Map<string, number>();
    for (let id = 1; id <= 800; id++) {
      const tone = coverTone(id);
      counts.set(tone, (counts.get(tone) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual([...TONES].sort());
    // Spread evenly: no tone takes more than twice, or less than half, its share of 100.
    for (const [tone, n] of counts) {
      expect(n, tone).toBeGreaterThanOrEqual(50);
      expect(n, tone).toBeLessThanOrEqual(200);
    }
  });
});

describe("Cover · title", () => {
  const NB = "\u00A0";
  const fonts: string[] = [];
  const measured = vi.fn();
  const stubMeasure = (width: number) => {
    vi.stubGlobal("CanvasRenderingContext2D", class {});
    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      fontStyle: "normal",
      fontWeight: "500",
      fontSize: "15px",
      fontFamily: "Literata",
    } as unknown as CSSStyleDeclaration);
    const ctx = {
      font: "",
      measureText: (text: string) => {
        fonts.push(ctx.font);
        measured();
        return { width: text.length * 7 };
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      ctx as unknown as RenderingContext,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width,
    } as DOMRect);
  };
  afterEach(() => {
    fonts.length = 0;
    measured.mockClear();
    Reflect.deleteProperty(document, "fonts");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("size_sm_uses_the_small_title_style", async () => {
    const sm = render(Cover, { props: { ...BOOK, size: "sm" } });
    const title = sm.getByText("Os Maias");
    await expectBindings(title, [
      {
        binding: "Capa/Título pequeno",
        utility: "text-cover-title-sm",
        css: "font-size: 13px;",
      },
    ]);
    expect(title.classList).not.toContain("text-cover-title");
    sm.unmount();
    // md is the default and keeps the large style.
    const md = render(Cover, { props: { ...BOOK } });
    expect(md.getByText("Os Maias").classList).toContain("text-cover-title");
    expect(md.getByText("Os Maias").classList).not.toContain(
      "text-cover-title-sm",
    );
  });

  it("title_is_portuguese_and_never_leaves_the_cover", async () => {
    const { getByText } = render(Cover, { props: { ...BOOK } });
    const title = getByText("Os Maias");
    expect(title.getAttribute("lang")).toBe("pt");
    expect(title.getAttribute("aria-hidden")).toBe("true");
    await expectBindings(title, [
      {
        binding: "never leaves the cover",
        utility: "wrap-anywhere",
        css: "overflow-wrap: anywhere;",
      },
    ]);
    // Not measured (jsdom): no hyphenation.
    expect(title.classList).toContain("hyphens-manual");
    expect(title.classList).not.toContain("hyphens-auto");
    expect(await ruleOf("hyphens-auto")).toContain("hyphens: auto;");
    expect(await ruleOf("hyphens-manual")).toContain("hyphens: manual;");
    // The author is a single truncated line: no hyphenation there.
    expect(getByText("Eça de Queirós").getAttribute("lang")).toBeNull();
  });

  it("title_hyphenates_only_when_a_word_does_not_fit_alone", async () => {
    stubMeasure(147);
    const fits = render(Cover, {
      props: { ...BOOK, title: "Ensaio sobre a Cegueira" },
    });
    await tick();
    const p = fits.container.querySelector("p")!;
    expect(p.classList).toContain("hyphens-manual");
    expect(p.classList).not.toContain("hyphens-auto");
    fits.unmount();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 72,
    } as DOMRect);
    const long = render(Cover, {
      props: { ...BOOK, title: "Desassossego" },
    });
    await tick();
    const q = long.container.querySelector("p")!;
    expect(q.classList).toContain("hyphens-auto");
    expect(q.classList).not.toContain("hyphens-manual");
  });

  it("title_measures_in_the_computed_font", async () => {
    stubMeasure(147);
    render(Cover, { props: { ...BOOK, title: "O Retorno" } });
    await tick();
    expect(fonts.length).toBeGreaterThan(0);
    expect(new Set(fonts)).toEqual(new Set(["normal 500 15px Literata"]));
  });

  it("title_shows_the_new_title_after_a_rerender", async () => {
    stubMeasure(147);
    const { container, rerender } = render(Cover, {
      props: { ...BOOK, title: "O Retorno" },
    });
    await tick();
    expect(container.querySelector("p")!.textContent).toBe(`O${NB}Retorno`);
    await rerender({ title: "A Sibila" });
    await tick();
    expect(container.querySelector("p")!.textContent).toBe(`A${NB}Sibila`);
  });

  it("title_measures_again_when_only_size_changes", async () => {
    stubMeasure(147);
    const { container, getByText } = render(SizeFixture);
    await tick();
    const p = container.querySelector("p")!;
    expect(p.textContent).toBe(`O${NB}Retorno`);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 40,
    } as DOMRect);
    await fireEvent.click(getByText("small"));
    await tick();
    // The same element (not mounted again) is measured again, with no resize or font event.
    expect(container.querySelector("p")).toBe(p);
    expect(p.classList).toContain("text-cover-title-sm");
    expect(p.textContent).toBe("O Retorno");
  });

  it("title_unmounted_before_the_fonts_are_ready_does_not_measure", async () => {
    stubMeasure(147);
    let loaded: () => void = () => {};
    const ready = new Promise<void>((r) => (loaded = r));
    Object.defineProperty(document, "fonts", {
      value: {
        ready,
        addEventListener: () => {},
        removeEventListener: () => {},
      },
      configurable: true,
    });
    const view = render(Cover, { props: { ...BOOK, title: "O Retorno" } });
    await tick();
    view.unmount();
    measured.mockClear();
    loaded();
    await ready;
    await tick();
    expect(measured).not.toHaveBeenCalled();
  });

  it("title_measures_again_on_the_fonts_loadingdone_event", async () => {
    stubMeasure(40);
    const listeners = new Set<() => void>();
    Object.defineProperty(document, "fonts", {
      value: {
        ready: new Promise(() => {}),
        addEventListener: (_: string, cb: () => void) => listeners.add(cb),
        removeEventListener: (_: string, cb: () => void) =>
          listeners.delete(cb),
      },
      configurable: true,
    });
    const view = render(Cover, { props: { ...BOOK, title: "O Retorno" } });
    await tick();
    expect(listeners.size).toBe(1);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 147,
    } as DOMRect);
    listeners.forEach((cb) => cb());
    await tick();
    expect(view.container.querySelector("p")!.textContent).toBe(
      `O${NB}Retorno`,
    );
    view.unmount();
    expect(listeners.size).toBe(0);
  });

  it("title_keeps_its_text_when_there_is_no_measure", async () => {
    // jsdom has no canvas: the title is shown as it is.
    const { container } = render(Cover, {
      props: { ...BOOK, title: "O Retorno" },
    });
    await tick();
    expect(container.querySelector("p")!.textContent).toBe("O Retorno");
  });

  it("title_binds_short_words_with_a_non_breaking_space_when_it_can_measure", async () => {
    stubMeasure(147);
    const { container } = render(Cover, {
      props: { ...BOOK, title: "O Retorno" },
    });
    await tick();
    expect(container.querySelector("p")!.textContent).toBe(`O${NB}Retorno`);
  });

  it("title_keeps_normal_spaces_when_the_pair_does_not_fit", async () => {
    stubMeasure(40);
    const { container } = render(Cover, {
      props: { ...BOOK, title: "O Retorno" },
    });
    await tick();
    expect(container.querySelector("p")!.textContent).toBe("O Retorno");
  });

  it("title_measures_again_when_the_cover_is_resized", async () => {
    stubMeasure(147);
    // Each observer only hears about the elements it observes.
    const observers: { cb: () => void; seen: Element[] }[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        entry = { cb: () => {}, seen: [] as Element[] };
        constructor(cb: () => void) {
          this.entry.cb = cb;
          observers.push(this.entry);
        }
        observe(el: Element) {
          this.entry.seen.push(el);
        }
        disconnect() {
          this.entry.seen.length = 0;
        }
      },
    );
    const resized = (el: Element) =>
      observers.filter((o) => o.seen.includes(el)).forEach((o) => o.cb());
    const { container } = render(Cover, {
      props: { ...BOOK, title: "O Retorno" },
    });
    await tick();
    const cover = must(slot(container, "cover"), "cover");
    expect(container.querySelector("p")!.textContent).toBe(`O${NB}Retorno`);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 40,
    } as DOMRect);
    resized(cover);
    await tick();
    expect(container.querySelector("p")!.textContent).toBe("O Retorno");
  });

  it("title_measures_again_when_the_fonts_finish_loading", async () => {
    stubMeasure(40);
    let loaded: () => void = () => {};
    const ready = new Promise<void>((r) => (loaded = r));
    Object.defineProperty(document, "fonts", {
      value: { ready },
      configurable: true,
    });
    const { container } = render(Cover, {
      props: { ...BOOK, title: "O Retorno" },
    });
    await tick();
    expect(container.querySelector("p")!.textContent).toBe("O Retorno");
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 147,
    } as DOMRect);
    loaded();
    await ready;
    await tick();
    expect(container.querySelector("p")!.textContent).toBe(`O${NB}Retorno`);
  });
});

describe("Cover", () => {
  it("cover_classes_are_compiled", async () => {
    expect(Object.keys(COVER_BG)).toEqual(TONES);
    // Scan the production sources as the Vite plugin does, then compile what it finds.
    const { sources } = await compileAppCss([]);
    const candidates = new Scanner({ sources }).scan();
    const { css } = await compileAppCss(candidates);
    for (const [tone, utility] of Object.entries(COVER_BG)) {
      expect(utility).toBe(`bg-cover-${tone}`);
      expect(candidates, utility).toContain(utility);
      expect(css, utility).toContain(
        `.${utility} {\n    background-color: var(--cover-${tone});`,
      );
    }
  });

  it("painted_text_is_hidden_from_voiceover", () => {
    const { container, getByText } = render(Cover, { props: { ...BOOK } });
    const cover = must(slot(container, "cover"), "cover");
    // Painted on the cover: seen, not read (the card names the book).
    expect(isInaccessible(getByText("Os Maias"))).toBe(true);
    expect(isInaccessible(getByText("Eça de Queirós"))).toBe(true);
    // The cover takes no focus: the card's gridcell does, and paints its ring here.
    expect(cover.hasAttribute("tabindex")).toBe(false);
    expect(cover.getAttribute("role")).toBeNull();

    // With an image: decorative, and no painted text over it.
    const img = render(Cover, { props: { ...BOOK, src: "cover.jpg" } });
    const picture = must(img.container.querySelector("img"), "img");
    // alt="": a presentational image, not an unnamed one.
    expect(picture.getAttribute("alt")).toBe("");
    expect(img.queryByRole("img")).toBeNull();
    expect(img.container.textContent?.trim()).toBe("");
  });

  it("title_uses_line_clamp_4", async () => {
    const { container, getByText } = render(Cover, { props: { ...BOOK } });
    await expectBindings(getByText("Os Maias"), TITLE_BINDINGS);
    await expectBindings(getByText("Eça de Queirós"), AUTHOR_BINDINGS);
    // The title wraps (up to four lines); only the author stays on one.
    expect(getByText("Os Maias").classList).not.toContain("truncate");
    const cover = must(slot(container, "cover"), "cover");
    expect(getByText("Os Maias").parentElement).toBe(cover);
    expect(getByText("Eça de Queirós").parentElement).toBe(cover);
  });

  it("cover_border_sits_over_the_image_and_ring_is_not_clipped", async () => {
    const { container } = render(Cover, {
      props: {
        ...BOOK,
        src: "cover.jpg",
        class: "group-focus-visible/card:focus-ring",
      },
    });
    const cover = must(slot(container, "cover"), "cover");
    const img = must(cover.querySelector("img"), "img");
    const border = must(slot(cover, "cover-border"), "cover border");
    // The ring is an outline on the cover: nothing on the cover clips it.
    expect(cover.classList).toContain("group-focus-visible/card:focus-ring");
    expect(cover.classList).not.toContain("overflow-hidden");
    expect(cover.classList).not.toContain("overflow-clip");
    // The image fills and crops itself; the border is painted after it, so over it.
    expect([...img.classList]).toEqual(
      expect.arrayContaining([
        "object-cover",
        "overflow-hidden",
        "rounded-cover",
        "size-full",
      ]),
    );
    expect(
      img.compareDocumentPosition(border) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expectBindings(border, [
      ...BORDER_BINDINGS,
      {
        binding: "radius/cover",
        utility: "rounded-cover",
        css: "border-radius: var(--radius-cover);",
      },
      {
        binding: "covers the image",
        utility: "inset-0",
        css: "inset: 0px;",
      },
    ]);
    expect(border.getAttribute("aria-hidden")).toBe("true");
    // A real cover shows the image, not a tone.
    for (const tone of Object.values(COVER_BG))
      expect(cover.classList).not.toContain(tone);
  });

  it("badge_shows_new_count_and_leaves_when_zero", async () => {
    const pt = locale("pt").book;
    const en = locale("en").book;
    expect([pt.newCount, pt.newCount_one, pt.newCount_other]).toEqual([
      "{count} novos",
      "1 novo",
      "{count} novos",
    ]);
    expect([en.newCount, en.newCount_one, en.newCount_other]).toEqual([
      "{count} new",
      "1 new",
      "{count} new",
    ]);

    // No new highlights: no badge at all, not an empty or invisible one.
    const none = render(Cover, { props: { ...BOOK, newCount: 0 } });
    expect(slot(none.container, "badge")).toBeNull();
    none.unmount();

    const { container, rerender } = render(Cover, {
      props: { ...BOOK, newCount: 11 },
    });
    let badge = must(slot(container, "badge"), "badge");
    expect(badge.textContent?.trim()).toBe("11 new");
    expect(isInaccessible(badge)).toBe(false);
    expect(badge.hasAttribute("data-closed")).toBe(false);
    // 8 px from the bottom and left edges (Capas 1).
    await expectBindings(badge, [
      { binding: "absolute", utility: "absolute", css: "position: absolute;" },
      {
        binding: "8 px from the bottom",
        utility: "bottom-2",
        css: "bottom: calc(var(--spacing) * 2);",
      },
      {
        binding: "8 px from the left",
        utility: "left-2",
        css: "left: calc(var(--spacing) * 2);",
      },
    ]);

    await rerender({ ...BOOK, newCount: 1 });
    expect(must(slot(container, "badge"), "badge").textContent?.trim()).toBe(
      "1 new",
    );

    // Exported: it keeps its last number while it fades out, then leaves.
    await rerender({ ...BOOK, newCount: 0 });
    badge = must(slot(container, "badge"), "badge");
    expect(badge.textContent?.trim()).toBe("1 new");
    expect(badge.hasAttribute("data-closed")).toBe(true);
    expect(badge.getAttribute("aria-hidden")).toBe("true");
    expect(badge.classList).toContain("data-closed:animate-out");
    expect(badge.classList).toContain("data-closed:fill-mode-forwards");
    await expectBindings(badge, BADGE_EXIT);
    // A fade only: no slide or zoom, so Reduzir movimento keeps it as is.
    expect(
      [...badge.classList].filter((c) =>
        /slide|zoom|spin|translate|scale/.test(c),
      ),
    ).toEqual([]);
    await fireEvent.animationEnd(badge);
    await tick();
    expect(slot(container, "badge")).toBeNull();

    // New highlights again: back at once, without the exit state.
    await rerender({ ...BOOK, newCount: 3 });
    badge = must(slot(container, "badge"), "badge");
    expect(badge.textContent?.trim()).toBe("3 new");
    expect(badge.hasAttribute("data-closed")).toBe(false);
  });
});

describe("Cover badge entrance (Task 38)", () => {
  const entrance = [
    "animate-in",
    "fade-in-0",
    "duration-(--duration-reveal)",
    "ease-out",
  ];

  it("badges_do_not_fade_when_the_cover_is_merely_shown", () => {
    const { container } = render(Cover, { props: { ...BOOK, newCount: 2 } });
    const badge = must(slot(container, "badge"), "badge");
    for (const c of entrance) expect(badge.classList.contains(c), c).toBe(false);
  });

  it("badge_fades_in_over_250ms_with_ease_out_when_told_to", async () => {
    const { container, rerender } = render(Cover, {
      props: { ...BOOK, newCount: 0 },
    });
    await rerender({ ...BOOK, newCount: 2, badgeEnter: true });
    const badge = must(slot(container, "badge"), "badge");
    await expectBindings(badge, [
      { binding: "enters", utility: "animate-in", css: "animation: enter " },
      { binding: "from transparent", utility: "fade-in-0", css: "--tw-enter-opacity: calc(0/100);" },
      { binding: "250 ms", utility: "duration-(--duration-reveal)", css: "--tw-duration: var(--duration-reveal);" },
      { binding: "ease out", utility: "ease-out", css: "--tw-ease: var(--ease-out);" },
    ]);
    // A fade only, so Reduzir movimento keeps it as is (Movimento 6)
    expect(
      [...badge.classList].filter((c) =>
        /slide|zoom|spin|translate|scale/.test(c),
      ),
    ).toEqual([]);
    // It keeps the entrance after the window closes: no class change mid-animation
    await rerender({ ...BOOK, newCount: 2, badgeEnter: false });
    expect(must(slot(container, "badge"), "badge").classList.contains("animate-in")).toBe(true);
  });
});

describe("Cover badge exit", () => {
  afterEach(() => vi.useRealTimers());

  async function closing() {
    const view = render(Cover, { props: { ...BOOK, newCount: 2 } });
    await view.rerender({ ...BOOK, newCount: 0 });
    expect(
      must(slot(view.container, "badge"), "badge").hasAttribute("data-closed"),
    ).toBe(true);
    return view;
  }

  it("animationcancel_clears_the_exiting_badge", async () => {
    const { container } = await closing();
    await fireEvent(
      must(slot(container, "badge"), "badge"),
      new Event("animationcancel", { bubbles: true }),
    );
    await tick();
    expect(slot(container, "badge")).toBeNull();
  });

  it("fallback_timeout_clears_it_when_no_event_fires", async () => {
    vi.useFakeTimers();
    const { container } = await closing();
    await vi.advanceTimersByTimeAsync(100);
    expect(slot(container, "badge")).not.toBeNull();
    await vi.advanceTimersByTimeAsync(200);
    expect(slot(container, "badge")).toBeNull();
  });

  it("new_count_during_the_exit_shows_and_the_timer_is_gone", async () => {
    vi.useFakeTimers();
    const { container, rerender, unmount } = await closing();
    await vi.advanceTimersByTimeAsync(100);
    await rerender({ ...BOOK, newCount: 5 });
    const badge = must(slot(container, "badge"), "badge");
    expect(badge.textContent?.trim()).toBe("5 new");
    expect(badge.hasAttribute("data-closed")).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(must(slot(container, "badge"), "badge").textContent?.trim()).toBe(
      "5 new",
    );
    unmount();
  });

  it("unmount_during_the_exit_clears_the_timer", async () => {
    vi.useFakeTimers();
    const { unmount } = await closing();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Thumbnail", () => {
  it("thumbnail_is_32_by_48_and_decorative", async () => {
    const { container } = render(Thumbnail, { props: { bookId: BOOK.bookId } });
    const thumb = must(slot(container, "thumbnail"), "thumbnail");
    // Componentes (D7) · 17 · Miniatura (63:3295).
    await expectBindings(thumb, [
      {
        binding: "32 wide",
        utility: "w-8",
        css: "width: calc(var(--spacing) * 8);",
      },
      {
        binding: "48 tall",
        utility: "h-12",
        css: "height: calc(var(--spacing) * 12);",
      },
      {
        binding: "radius 3 (M2)",
        utility: "rounded-[3px]",
        css: "border-radius: 3px;",
      },
    ]);
    // The same tone as the book's cover.
    expect(thumb.classList).toContain(COVER_BG[coverTone(BOOK.bookId)]);
    const border = must(slot(thumb, "cover-border"), "thumbnail border");
    await expectBindings(border, [
      ...BORDER_BINDINGS,
      {
        binding: "radius 3 (M2)",
        utility: "rounded-[3px]",
        css: "border-radius: 3px;",
      },
    ]);
    expect(thumb.getAttribute("aria-hidden")).toBe("true");
    expect(isInaccessible(thumb)).toBe(true);
    expect(thumb.textContent?.trim()).toBe("");

    const img = render(Thumbnail, { props: { bookId: 7, src: "cover.jpg" } });
    const thumbImg = must(slot(img.container, "thumbnail"), "thumbnail");
    const picture = must(thumbImg.querySelector("img"), "img");
    expect(picture.getAttribute("alt")).toBe("");
    expect(isInaccessible(picture)).toBe(true);
    const imgBorder = must(slot(thumbImg, "cover-border"), "border");
    expect(
      picture.compareDocumentPosition(imgBorder) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    for (const tone of Object.values(COVER_BG))
      expect(thumbImg.classList).not.toContain(tone);
  });
});
