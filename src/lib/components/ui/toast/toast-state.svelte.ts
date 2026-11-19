// Componentes (D7) · 14 · Aviso (57:6346); Cor 6 and Movimento 3. Hand-made, not svelte-sonner:
// its timer does not pause while the focus is on the toast (plan, Task 22, Passo 1).

/** hold/toast: how long the toast stays, not counting the time it is paused. */
export const HOLD_MS = 4000;
/** duration/in: the exit, after which the toast leaves the DOM. */
export const EXIT_MS = 200;

export type ToastAction = { label: string; onClick: () => void };
export type ToastItem = { id: number; text: string; action?: ToastAction; closing: boolean };

class ToastState {
	current = $state<ToastItem | null>(null);
	#nextId = 1;
	#remaining = HOLD_MS;
	#startedAt = 0;
	#paused = false;
	#holdTimer: ReturnType<typeof setTimeout> | undefined;
	#exitTimer: ReturnType<typeof setTimeout> | undefined;

	/** Shows the toast, replacing the one on screen: one is visible at a time. */
	show(text: string, action?: ToastAction) {
		this.#clear();
		this.current = { id: this.#nextId++, text, action, closing: false };
		this.#remaining = HOLD_MS;
		this.#paused = false;
		this.#start();
	}

	/**
	 * Pointer or focus on the toast (WCAG 2.2.1): stops the hold and keeps the time that was left,
	 * so it resumes from there. Ignored once the exit has started.
	 */
	setPaused(paused: boolean) {
		if (!this.current || this.current.closing || paused === this.#paused) return;
		this.#paused = paused;
		if (paused) {
			clearTimeout(this.#holdTimer);
			this.#remaining -= Date.now() - this.#startedAt;
		} else {
			this.#start();
		}
	}

	/** Starts the exit of the toast on screen. */
	close() {
		const item = this.current;
		if (!item || item.closing) return;
		clearTimeout(this.#holdTimer);
		item.closing = true;
		this.#exitTimer = setTimeout(() => {
			if (this.current?.id === item.id) this.current = null;
		}, EXIT_MS);
	}

	#start() {
		this.#startedAt = Date.now();
		this.#holdTimer = setTimeout(() => this.close(), this.#remaining);
	}

	#clear() {
		clearTimeout(this.#holdTimer);
		clearTimeout(this.#exitTimer);
	}
}

export const toastState = new ToastState();

/** Shows a toast with the text and, optionally, a link-styled action. */
export function notify(text: string, options: { action?: ToastAction } = {}) {
	toastState.show(text, options.action);
}

/** Starts the exit of the toast on screen, if any. */
export function dismiss() {
	toastState.close();
}
