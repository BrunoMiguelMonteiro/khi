/*
	Componentes (D7) · 15 · Janela modal (58:6822), shared by Dialog and AlertDialog.
	Static, whole class strings, so Tailwind finds them.
*/

/** Escurecer (Q-G): the Figma scrim, fading with the window in duration/in and duration/out. */
export const dialogOverlay = [
  "fixed inset-0 z-50 bg-scrim",
  "data-open:animate-in data-open:fade-in-0 data-open:duration-(--duration-in) data-open:ease-out",
  "data-closed:animate-out data-closed:fade-out-0 data-closed:duration-(--duration-out) data-closed:ease-out",
  "data-closed:fill-mode-forwards",
].join(" ");

/**
 * Janela (58:6782): 380 wide, spacing/6 padding, spacing/2 gap, radius/menu, popover, 1 px border
 * inside, Sombra/Janela. Movimento 4 (J2): opens in duration/in with a fade and a scale from
 * --scale-modal-from, from the centre, ease/out; closes in duration/out with the reverse. With
 * Reduzir movimento only the fade stays (J1). `tabindex="-1"` comes from the Content.
 */
export const dialogContent = [
  "fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 origin-center",
  "flex w-95 flex-col gap-2 p-6 outline-none",
  "rounded-menu border-(length:--stroke-border) border-border bg-popover text-foreground shadow-sombra-janela",
  "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-(--scale-modal-from) data-open:motion-reduce:zoom-in-100",
  "data-open:duration-(--duration-in) data-open:ease-out",
  "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-(--scale-modal-from) data-closed:motion-reduce:zoom-out-100",
  "data-closed:duration-(--duration-out) data-closed:ease-out data-closed:fill-mode-forwards",
].join(" ");

/** Título: Interface/Title 3, foreground. */
export const dialogTitle = "text-title-3 text-foreground";

/** Texto: Interface/Body, foreground. */
export const dialogDescription = "text-body text-foreground";

/** Botões: on the right, spacing/4 above, spacing/2 apart. */
export const dialogFooter = "flex justify-end gap-2 pt-4";

/**
 * `principal` is the default button, the one Return presses. `destructive` (Q-A) is the
 * Secundário button with destructive-text, never the default, and not a new Button variant.
 */
export type DialogActionVariant = "principal" | "destructive";

export const destructiveText = "text-destructive-text";
