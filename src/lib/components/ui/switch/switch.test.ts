import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { compileAppCss, selectorFor } from "$lib/test/css";
import { expectDisabledInert } from "$lib/test/disabled";
import { Switch } from "./index";
import Fixture from "./switch.fixture.svelte";

type Binding = { binding: string; utility: string; css: string };

/** The utilities layer Tailwind emits for one class alone, compiled with the real app.css. */
async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? "";
}

async function expectBindings(el: Element, bindings: Binding[]) {
  for (const { binding, utility, css } of bindings) {
    expect(el.classList.contains(utility), `${binding} → ${utility}`).toBe(true);
    expect(await ruleOf(utility), utility).toContain(css);
  }
}

/** Renders the fixture, whose own state is bound as `<Switch bind:checked />`; `bound` follows it. */
function renderBound(initial: boolean, props: Record<string, unknown> = {}) {
  const bound = { checked: initial };
  render(Fixture, {
    props: { "aria-label": "Mostrar capas", ...props, checked: initial, onbound: (v: boolean) => (bound.checked = v) },
  });
  const control = document.querySelector<HTMLElement>('[data-slot="switch"]')!;
  const track = control.querySelector<HTMLElement>('[data-slot="switch-track"]')!;
  const thumb = control.querySelector<HTMLElement>('[data-slot="switch-thumb"]')!;
  return { control, track, thumb, bound };
}

/** Splits a selector list on top-level commas. */
function topLevel(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  return [...out, cur.trim()];
}

/** One selector per branch of every `:is()`/`:where()` (compound selectors only, as Tailwind emits). */
function expand(selector: string): string[] {
  return topLevel(selector).flatMap((one) => {
    const at = one.search(/:(is|where)\(/);
    if (at < 0) return [one];
    const open = one.indexOf("(", at);
    let depth = 1;
    let end = open + 1;
    for (; depth > 0; end++) depth += one[end] === "(" ? 1 : one[end] === ")" ? -1 : 0;
    const [head, tail] = [one.slice(0, at), one.slice(end)];
    return topLevel(one.slice(open + 1, end - 1)).flatMap((branch) => expand(head + branch + tail));
  });
}

/** element.matches for two stacked data-state variants (jsdom gets the nested `:not()` wrong). */
const matchesStacked = (el: Element, selector: string) => expand(selector).some((s) => el.matches(s));

// Componentes (D7) · 11 · Switch (55:3471): each Figma binding and the one class that carries it.
const TRACK_BINDINGS: Binding[] = [
  // 32 × 18 visible; spacing 8 and 4.5 are 32 and 18 px (no size variable in the Figma).
  { binding: "32 wide", utility: "w-8", css: "width: calc(var(--spacing) * 8);" },
  { binding: "18 high", utility: "h-4.5", css: "height: calc(var(--spacing) * 4.5);" },
  { binding: "spacing/0-5 (padding)", utility: "p-0.5", css: "padding: calc(var(--spacing) * 0.5);" },
  { binding: "radius 9 (half the height)", utility: "rounded-full", css: "border-radius: var(--radius-full);" },
  {
    binding: "Desligado: input-strong (fill)",
    utility: "bg-input-strong",
    css: "background-color: var(--input-strong);",
  },
  { binding: "Ligado: switch-on (fill)", utility: "data-checked:bg-switch-on", css: "background-color: var(--switch-on);" },
  {
    binding: "Desligado Desativado: disabled-border (fill)",
    utility: "data-disabled:bg-disabled-border",
    css: "background-color: var(--disabled-border);",
  },
  {
    binding: "Ligado Desativado: primary-disabled (fill)",
    utility: "data-disabled:data-checked:bg-primary-disabled",
    css: "background-color: var(--primary-disabled);",
  },
  // The control is the 32 × 20 hit area; the ring is painted on the track, with its radius 9.
  {
    binding: "Foco: stroke/ring outside, radius 9",
    utility: "group-focus-visible/switch:focus-ring",
    css: "outline: var(--stroke-ring) solid",
  },
];

const THUMB_BINDINGS: Binding[] = [
  { binding: "14 × 14", utility: "size-3.5", css: "calc(var(--spacing) * 3.5)" },
  { binding: "round", utility: "rounded-full", css: "border-radius: var(--radius-full);" },
  { binding: "switch-thumb (fill)", utility: "bg-switch-thumb", css: "background-color: var(--switch-thumb);" },
  {
    binding: "Sombra/Segmento (effect style)",
    utility: "shadow-sombra-segmento",
    // Tailwind inlines the theme shadow (tokens.css: --shadow-sombra-segmento).
    css: "--tw-shadow: 0 1px 2px var(--tw-shadow-color, rgb(0 0 0 / 0.12));",
  },
  // Ligado: across the 28 px inside the padding, 14 px to the right.
  { binding: "Ligado: at the right", utility: "data-checked:ml-3.5", css: "margin-left: calc(var(--spacing) * 3.5);" },
  { binding: "slides: margin only", utility: "transition-[margin-left]", css: "transition-property: margin-left;" },
  { binding: "duration/in", utility: "duration-(--duration-in)", css: "transition-duration: var(--duration-in);" },
  { binding: "ease/out", utility: "ease-out", css: "transition-timing-function: var(--ease-out);" },
  {
    binding: "Reduzir movimento: switches without sliding",
    utility: "motion-reduce:transition-none",
    css: "transition-property: none;",
  },
];

const describedBy = (el: HTMLElement) =>
  (el.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");

describe("Switch", () => {
  it("is_read_as_switch", () => {
    const { control } = renderBound(true);
    expect(screen.getByRole("switch", { name: "Mostrar capas" })).toBe(control);
    expect(control.getAttribute("aria-checked")).toBe("true");
    expect(control.tagName).toBe("BUTTON");
  });

  it("space_toggles", async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();
    const { control, bound } = renderBound(false, { onCheckedChange });
    await user.tab();
    expect(document.activeElement).toBe(control);
    await user.keyboard(" ");
    expect(bound.checked).toBe(true);
    expect(control.getAttribute("aria-checked")).toBe("true");
    await user.click(control);
    expect(bound.checked).toBe(false);
    expect(onCheckedChange.mock.calls).toEqual([[true], [false]]);
  });

  it("checked_variant_matches_bits_ui_state", async () => {
    for (const reason of [undefined, "Sem Kobo"]) {
      cleanup();
      const on = renderBound(true, { disabledReason: reason });
      // With a reason, the control is also the tooltip trigger, whose data-state must not replace its own.
      expect(on.control.getAttribute("data-state")).toBe("checked");
      expect(on.track.matches(await selectorFor("data-checked:bg-switch-on"))).toBe(true);
      expect(on.thumb.matches(await selectorFor("data-checked:ml-3.5"))).toBe(true);
      cleanup();
      const off = renderBound(false, { disabledReason: reason });
      expect(off.track.matches(await selectorFor("data-checked:bg-switch-on"))).toBe(false);
      expect(off.thumb.matches(await selectorFor("data-checked:ml-3.5"))).toBe(false);
    }
  });

  it("track_uses_input_strong_off_and_switch_on_on", async () => {
    const { control, track, thumb } = renderBound(false);
    await expectBindings(track, TRACK_BINDINGS);
    await expectBindings(thumb, THUMB_BINDINGS);
    // Fills: nothing beyond the Figma's.
    expect([...track.classList].filter((c) => /(^|:)(bg|border|inset-ring)-/.test(c)).sort()).toEqual(
      TRACK_BINDINGS.map((b) => b.utility)
        .filter((u) => u.includes("bg-"))
        .sort(),
    );
    // Hit area 32 × 20: 1 px of transparent padding above and below the track (decision B).
    for (const c of ["w-8", "h-5", "py-px", "group/switch", "outline-none"]) {
      expect(control.classList.contains(c), c).toBe(true);
    }
    expect([...control.classList].filter((c) => /(^|:)(bg|border|focus)/.test(c))).toEqual([]);
    expect(await ruleOf("h-5")).toContain("height: calc(var(--spacing) * 5);");
    expect(await ruleOf("py-px")).toContain("padding-block: 1px;");
    // The ring shows only with the keyboard.
    const user = userEvent.setup();
    await user.tab();
    expect(document.activeElement).toBe(control);
    const ring = await selectorFor("group-focus-visible/switch:focus-ring");
    expect(ring).not.toMatch(/(?<!\\):focus(?!-visible)/);
    expect(ring).toContain(":where(.group\\/switch):focus-visible ");
    expect(matchesStacked(track, ring)).toBe(true);
  });

  it("thumb_slides_except_with_reduced_motion", async () => {
    const { thumb } = renderBound(false);
    // Only the thumb moves, and with Reduzir movimento it jumps: the transition is off, the end position stays.
    const { css } = await compileAppCss(["motion-reduce:transition-none"]);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.motion-reduce\\:transition-none \{\s*transition-property: none;/);
    expect([...thumb.classList].filter((c) => c.startsWith("motion-reduce:"))).toEqual([
      "motion-reduce:transition-none",
    ]);
    expect([...thumb.classList].filter((c) => /translate|animate/.test(c))).toEqual([]);
  });

  it("disabled_is_inert_and_explains_itself", async () => {
    for (const initial of [false, true]) {
      cleanup();
      const onCheckedChange = vi.fn();
      const { control, bound } = renderBound(initial, {
        disabled: true,
        disabledReason: "Liga o Kobo para mudar",
        onCheckedChange,
      });
      expect(control.hasAttribute("disabled")).toBe(false);
      await expectDisabledInert({
        control,
        read: () => bound.checked,
        callback: onCheckedChange,
        reason: "Liga o Kobo para mudar",
      });
      expect(control.getAttribute("aria-checked")).toBe(String(initial));
    }
  });

  it("disabled_tracks_use_disabled_tokens", async () => {
    const off = await selectorFor("data-disabled:bg-disabled-border");
    const on = await selectorFor("data-disabled:data-checked:bg-primary-disabled");
    const a = renderBound(false, { disabled: true });
    expect(a.track.matches(off)).toBe(true);
    expect(matchesStacked(a.track, on)).toBe(false);
    cleanup();
    const b = renderBound(true, { disabled: true });
    expect(matchesStacked(b.track, on)).toBe(true);
    cleanup();
    expect(matchesStacked(renderBound(true).track, on)).toBe(false);
    // The checked-disabled fill comes after the checked and the disabled fills, so it wins.
    const { css } = await compileAppCss([
      "data-checked:bg-switch-on",
      "data-disabled:bg-disabled-border",
      "data-disabled:data-checked:bg-primary-disabled",
    ]);
    const at = (c: string) => css.indexOf(`.${c.replace(/[^\w-]/g, (x) => `\\${x}`)}`);
    expect(at("data-checked:bg-switch-on")).toBeLessThan(at("data-disabled:data-checked:bg-primary-disabled"));
    expect(at("data-disabled:bg-disabled-border")).toBeLessThan(at("data-disabled:data-checked:bg-primary-disabled"));
  });

  it("toggling_disabled_keeps_the_node_and_focus", async () => {
    const props = { "aria-label": "Mostrar capas", disabledReason: "Liga o Kobo para mudar" };
    const { rerender } = render(Fixture, { props: { ...props, disabled: false } });
    const control = document.querySelector<HTMLElement>('[data-slot="switch"]')!;
    control.focus();
    await rerender({ ...props, disabled: true });
    expect(document.querySelector('[data-slot="switch"]')).toBe(control);
    expect(document.activeElement).toBe(control);
    await waitFor(() => expect(describedBy(control)).toBe("Liga o Kobo para mudar"));
    await rerender({ ...props, disabled: false });
    expect(document.querySelector('[data-slot="switch"]')).toBe(control);
    expect(control.hasAttribute("aria-disabled")).toBe(false);
    await waitFor(() => expect(control.hasAttribute("aria-describedby")).toBe(false));
  });

  it("without_reason_needs_no_tooltip_provider", () => {
    render(Switch, { props: { "aria-label": "Mostrar capas", disabled: true } });
    expect(screen.getByRole("switch", { name: "Mostrar capas" }).getAttribute("aria-disabled")).toBe("true");
  });
});

/** A form in the document, its submit and reset counted; the fixture renders inside unless `outside`. */
function renderInForm(props: Record<string, unknown>, { outside = false } = {}) {
  const form = document.createElement("form");
  form.id = "settings";
  const onsubmit = vi.fn((e: Event) => e.preventDefault());
  const onreset = vi.fn();
  form.addEventListener("submit", onsubmit);
  form.addEventListener("reset", onreset);
  const host = document.createElement("div");
  document.body.append(form, host);
  const parent = outside ? host : form;
  const label = document.createElement("label");
  label.htmlFor = "covers-switch";
  label.textContent = "Mostrar capas";
  parent.append(label);
  render(Fixture, { target: parent, props: { id: "covers-switch", ...props } });
  const control = document.querySelector<HTMLButtonElement>('[data-slot="switch"]')!;
  return { form, control, label, onsubmit, onreset };
}

describe("Switch in a form", () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  it("disabled_does_not_submit_or_reset_its_form", async () => {
    const user = userEvent.setup();
    for (const type of ["submit", "reset"] as const) {
      // The harness does see them: an enabled switch of that type submits or resets its form.
      cleanup();
      document.body.replaceChildren();
      const enabled = renderInForm({ type });
      await user.click(enabled.control);
      expect((type === "submit" ? enabled.onsubmit : enabled.onreset).mock.calls.length, type).toBe(1);
      for (const disabledReason of [undefined, "Liga o Kobo para mudar"]) {
        cleanup();
        document.body.replaceChildren();
        const { control, label, onsubmit, onreset } = renderInForm({ type, disabled: true, disabledReason });
        await user.click(control);
        await user.click(label);
        expect(onsubmit, `${type} ${disabledReason}`).not.toHaveBeenCalled();
        expect(onreset, `${type} ${disabledReason}`).not.toHaveBeenCalled();
        expect(control.getAttribute("aria-checked")).toBe("false");
      }
    }
  });

  it("keeps_the_caller_type_with_a_reason", () => {
    for (const disabled of [false, true]) {
      for (const type of ["submit", "reset"] as const) {
        cleanup();
        const { control } = renderInForm({ type, disabled, disabledReason: "Sem Kobo" });
        expect(control.type, `${type} disabled=${disabled}`).toBe(type);
      }
      cleanup();
      expect(renderInForm({ disabled, disabledReason: "Sem Kobo" }).control.type).toBe("button");
    }
  });

  it("disabled_required_does_not_block_its_form", () => {
    const props = { name: "covers", value: "yes", required: true, checked: false };
    expect(renderInForm(props).form.checkValidity()).toBe(false);
    cleanup();
    document.body.replaceChildren();
    expect(renderInForm({ ...props, disabled: true }).form.checkValidity()).toBe(true);
    cleanup();
    document.body.replaceChildren();
    // Like a readonly field, the disabled value still submits.
    const { form } = renderInForm({ ...props, checked: true, disabled: true });
    expect(new FormData(form).getAll("covers")).toEqual(["yes"]);
  });

  it("external_form_gets_the_value", () => {
    for (const checked of [true, false]) {
      cleanup();
      document.body.replaceChildren();
      const { form } = renderInForm({ form: "settings", name: "covers", value: "yes", checked }, { outside: true });
      expect(new FormData(form).getAll("covers")).toEqual(checked ? ["yes"] : []);
    }
  });
});
