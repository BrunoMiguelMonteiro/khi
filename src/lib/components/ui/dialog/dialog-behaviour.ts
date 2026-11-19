import { getContext, onDestroy, setContext } from "svelte";

/*
	Keys and focus of the Janela modal (Q-A, Q-E), shared by Dialog and AlertDialog.
	Esc is Bits UI's; ⌘. and Return are handled on the window's keydown.
*/

const ROOT = Symbol("dialog-root");

type DialogRoot = {
  /** Closes the window the way Esc and Cancelar do: open = false and onOpenChange(false). */
  cancel: () => void;
  /** The Trigger that opened the window, which gets focus back on close. */
  opener: { current: HTMLElement | null };
};

export function setDialogRoot(cancel: () => void) {
  setContext<DialogRoot>(ROOT, { cancel, opener: { current: null } });
}

function getDialogRoot(): DialogRoot {
  return (
    getContext<DialogRoot | undefined>(ROOT) ?? {
      cancel: () => {},
      opener: { current: null },
    }
  );
}

/**
 * The Trigger's handlers. WebKit on macOS doesn't focus a button on click, so Bits UI's memory of
 * the focus before opening may not be the opener; the Trigger records itself instead.
 */
export function dialogTrigger() {
  const { opener } = getDialogRoot();
  const record = (e: Event) => {
    if (e.currentTarget instanceof HTMLElement)
      opener.current = e.currentTarget;
  };
  return {
    click: record,
    keydown(e: KeyboardEvent) {
      if (e.key === "Enter" || e.key === " ") record(e);
    },
  };
}

/** The default button (the Principal action), the one Return presses; set by the Action. */
const DEFAULT_BUTTON = "[data-dialog-default]";

const ONE_LINE_FIELDS = [
  "",
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
].map((type) => (type ? `input[type="${type}"]` : "input:not([type])"));
const ONE_LINE_FIELD = ONE_LINE_FIELDS.join(", ");

/** The fields that take initial focus (Q-E): one-line text inputs and text areas. */
const TEXT_FIELD = [...ONE_LINE_FIELDS, "textarea"]
  .map((s) => `${s}:not(:disabled)`)
  .join(", ");

/** Return that commits an IME composition: WebKit sends isComposing, or keyCode 229 after compositionend. */
const isImeKey = (e: KeyboardEvent) => e.isComposing || e.keyCode === 229;

const hasModifier = (e: KeyboardEvent) =>
  e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;

/** ⌘. is Cancel on macOS (HIG Keyboards; alerts › Buttons). */
const isCommandPeriod = (e: KeyboardEvent) =>
  e.key === "." && e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;

/**
 * Return goes to the default button only from the window itself or a one-line text field. A
 * button, link, checkbox, select, menu or text area handles Return itself, and a second action
 * on top of it would act twice (as in the UpdateDialog fix).
 */
/** An initialFocus is taken only if it is an enabled text field of this window (Q-E). */
const isFocusableField = (
  el: HTMLElement | null | undefined,
  content: HTMLElement,
) => !!el && content.contains(el) && el.matches(TEXT_FIELD);

function returnIsFree(target: EventTarget | null, content: HTMLElement) {
  if (target === content) return true;
  return target instanceof HTMLInputElement && target.matches(ONE_LINE_FIELD);
}

type Options = {
  content: () => HTMLElement | null;
  initialFocus: () => HTMLElement | null | undefined;
};

/** The Content's handlers. Call during component initialisation (it reads the Root's context). */
export function dialogBehaviour({ content, initialFocus }: Options) {
  const { cancel, opener } = getDialogRoot();
  let escapeWhileComposing = false;
  let pendingFocus: ReturnType<typeof setTimeout> | undefined;
  const cancelPendingFocus = () => clearTimeout(pendingFocus);
  onDestroy(cancelPendingFocus);

  return {
    /** Q-E: the given text field, else the first text field, else the window itself; never a button. */
    openAutoFocus(e: Event) {
      e.preventDefault();
      cancelPendingFocus();
      const node = content();
      if (!node) return;
      const given = initialFocus();
      const target = isFocusableField(given, node)
        ? given!
        : (node.querySelector<HTMLElement>(TEXT_FIELD) ?? node);
      target.focus({ preventScroll: true });
      if (document.activeElement === target) return;
      // Not focusable yet (still being laid out): once more after a turn, if the window is still open.
      pendingFocus = setTimeout(() => {
        if (
          node.isConnected &&
          node.dataset.state === "open" &&
          node.contains(target)
        )
          target.focus({ preventScroll: true });
      }, 0);
    },

    /** Focus back to the Trigger that opened the window; otherwise Bits UI's own memory. */
    closeAutoFocus(e: Event) {
      cancelPendingFocus();
      const trigger = opener.current;
      opener.current = null;
      if (!trigger?.isConnected) return;
      e.preventDefault();
      trigger.focus({ preventScroll: true });
    },

    /** In capture, before Bits UI's Esc listener on the document. */
    keydownCapture(e: KeyboardEvent) {
      escapeWhileComposing = e.key === "Escape" && isImeKey(e);
    },

    keydown(e: KeyboardEvent) {
      if (e.defaultPrevented || isImeKey(e)) return;
      const node = content();
      if (!node) return;

      if (isCommandPeriod(e)) {
        e.preventDefault();
        cancel();
        return;
      }

      if (
        e.key !== "Enter" ||
        e.repeat ||
        hasModifier(e) ||
        !returnIsFree(e.target, node)
      )
        return;
      const button = node.querySelector<HTMLElement>(DEFAULT_BUTTON);
      if (!button || button.getAttribute("aria-disabled") === "true") return;
      e.preventDefault();
      button.click();
    },

    /** Esc that cancels an IME composition doesn't also close the window. */
    escapeKeydown(e: KeyboardEvent) {
      if (escapeWhileComposing || e.isComposing) e.preventDefault();
      escapeWhileComposing = false;
    },
  };
}
