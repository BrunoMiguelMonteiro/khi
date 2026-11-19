import { getContext, setContext } from "svelte";

/*
	Keys and focus of the Janela modal (Q-A, Q-E), shared by Dialog and AlertDialog.
	Esc is Bits UI's; ⌘. and Return are handled on the window's keydown.
*/

const CANCEL = Symbol("dialog-cancel");

/** The Root closes the window the way Esc and Cancelar do: open = false and onOpenChange(false). */
export function setDialogCancel(cancel: () => void) {
  setContext(CANCEL, cancel);
}

function getDialogCancel(): () => void {
  return getContext<(() => void) | undefined>(CANCEL) ?? (() => {});
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
  const cancel = getDialogCancel();
  let escapeWhileComposing = false;

  return {
    /** Q-E: the given field, else the first text field, else the window itself; never a button. */
    openAutoFocus(e: Event) {
      e.preventDefault();
      const node = content();
      const target =
        initialFocus() ?? node?.querySelector<HTMLElement>(TEXT_FIELD) ?? node;
      // After Bits UI's own deferral, so the window is in place when it takes focus.
      setTimeout(() => {
        if (target?.isConnected) target.focus({ preventScroll: true });
      }, 0);
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
