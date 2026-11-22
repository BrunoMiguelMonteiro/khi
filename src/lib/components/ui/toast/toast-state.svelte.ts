// Componentes (D7) · 14 · Aviso (57:6346); Cor 6 and Movimento 3. Hand-made, not svelte-sonner:
// its timer does not pause while the focus is on the toast (plan, Task 22, Passo 1).

/** duration/toast-in: the entry; the hold starts when it ends (Movimento 3: in, then 4 s, then out). */
export const ENTER_MS = 300;
/** hold/toast: how long the toast stays after its entry, not counting the time it is paused. */
export const HOLD_MS = 4000;
/** duration/in: the exit, after which the toast leaves the DOM. */
export const EXIT_MS = 200;

export type ToastAction = { label: string; onClick: () => void };
export type ToastItem = {
  id: number;
  text: string;
  action?: ToastAction;
  /** `success` (circle-check) by default; `error` is the circle-alert of a failure. */
  icon: "success" | "error";
  closing: boolean;
};

class ToastState {
  current = $state<ToastItem | null>(null);
  #nextId = 1;
  #remaining = HOLD_MS;
  #startedAt = 0;
  /** Pointer or focus on the Toaster; kept across toasts, since the Toaster outlives them. */
  #paused = false;
  /** The entry is over and the hold is counting (or paused). */
  #holding = false;
  #enterTimer: ReturnType<typeof setTimeout> | undefined;
  #holdTimer: ReturnType<typeof setTimeout> | undefined;
  #exitTimer: ReturnType<typeof setTimeout> | undefined;

  /** Shows the toast, replacing the one on screen: one is visible at a time. */
  show(text: string, action?: ToastAction, icon: ToastItem["icon"] = "success"): number {
    this.#clear();
    const item: ToastItem = {
      id: this.#nextId++,
      text,
      action,
      icon,
      closing: false,
    };
    this.current = item;
    this.#remaining = HOLD_MS;
    this.#holding = false;
    // The enter animation's end calls entered(); the timer covers no animation (jsdom, no CSS).
    this.#enterTimer = setTimeout(() => this.entered(item.id), ENTER_MS);
    return item.id;
  }

  /** The entry of the toast `id` is over: the hold starts, unless the toast is paused. */
  entered(id: number) {
    if (this.current?.id !== id || this.current.closing || this.#holding)
      return;
    clearTimeout(this.#enterTimer);
    this.#holding = true;
    if (!this.#paused) this.#start();
  }

  /**
   * Pointer or focus on the toast (WCAG 2.2.1): stops the hold and keeps the time that was left,
   * so it resumes from there. During the entry it only defers the hold; after the exit has
   * started it changes nothing on screen.
   */
  setPaused(paused: boolean) {
    if (paused === this.#paused) return;
    this.#paused = paused;
    if (!this.current || this.current.closing || !this.#holding) return;
    if (paused) {
      clearTimeout(this.#holdTimer);
      this.#remaining -= Date.now() - this.#startedAt;
    } else {
      this.#start();
    }
  }

  /** Starts the exit of the toast on screen. */
  close(id?: number) {
    const item = this.current;
    if (!item || item.closing) return;
    // A toast that was replaced is not this one's: its id closes nothing
    if (id !== undefined && item.id !== id) return;
    clearTimeout(this.#enterTimer);
    clearTimeout(this.#holdTimer);
    item.closing = true;
    this.#exitTimer = setTimeout(() => {
      if (this.current?.id === item.id) this.current = null;
    }, EXIT_MS);
  }

  /** Drops the toast and every timer at once, with no exit: the Toaster is gone. */
  reset() {
    this.#clear();
    this.current = null;
    this.#remaining = HOLD_MS;
    this.#paused = false;
    this.#holding = false;
  }

  #start() {
    this.#startedAt = Date.now();
    this.#holdTimer = setTimeout(() => this.close(), this.#remaining);
  }

  #clear() {
    clearTimeout(this.#enterTimer);
    clearTimeout(this.#holdTimer);
    clearTimeout(this.#exitTimer);
  }
}

export const toastState = new ToastState();

// A hot update replaces this module; the old singleton must not keep a toast or a timer alive.
import.meta.hot?.dispose(() => toastState.reset());

/** Shows a toast with the text and, optionally, a link-styled action and the failure's icon. */
export function notify(text: string, options: { action?: ToastAction; icon?: ToastItem["icon"] } = {}): number {
  return toastState.show(text, options.action, options.icon);
}

/** Starts the exit of the toast on screen, if any; with an `id` (what `notify` returned), only if it is still that one. */
export function dismiss(id?: number) {
  toastState.close(id);
}
