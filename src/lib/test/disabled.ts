import { waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { expect, vi } from 'vitest';

type UserEvent = ReturnType<typeof userEvent.setup>;
type Step = [name: string, act: () => Promise<void>];

export type DisabledInertOptions = {
	/** The element that takes focus and carries aria-disabled and data-disabled. */
	control: HTMLElement;
	/** The control's label, clicked as well when given. */
	label?: HTMLElement;
	/** The bound value (checked, selected value…); it must not change. */
	read: () => unknown;
	/** Finds the pop-up the control would open; it must stay absent. */
	popup?: () => Element | null;
	/** The component's callback (onclick, onCheckedChange…), a vi.fn(); it must not be called. */
	callback: { mock: { calls: unknown[][] } };
	/** The disabledReason text, read through aria-describedby once the control has focus. */
	reason: string;
	/** Pass the test's own user (e.g. set up with advanceTimers for fake timers). */
	user?: UserEvent;
	/** Runs after each action, before the checks; replaces the default {@link settle}. */
	settle?: () => Promise<void>;
};

/** How long a delayed reaction (a timer before the pop-up opens) gets before the checks. */
export const SETTLE_MS = 150;

/**
 * Lets a delayed reaction happen: microtasks, a Svelte tick, then SETTLE_MS of timers — advanced
 * when the test uses vi.useFakeTimers(), waited for in real time otherwise.
 */
export async function settle(): Promise<void> {
	await Promise.resolve();
	await tick();
	if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(SETTLE_MS);
	else await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
	await tick();
}

function describedBy(control: HTMLElement): string {
	return (control.getAttribute('aria-describedby') ?? '')
		.split(/\s+/)
		.filter(Boolean)
		.map((id) => document.getElementById(id)?.textContent ?? '')
		.join(' ');
}

/**
 * Phase 2 rule for a disabled control: it stays in the Tab order, explains itself on focus, and
 * Space, Return, a click on it and a click on its label change nothing, even after a delay.
 */
export async function expectDisabledInert(options: DisabledInertOptions): Promise<void> {
	const { control, label, read, popup, callback, reason } = options;
	const user = options.user ?? userEvent.setup();
	const afterAction = options.settle ?? settle;
	const before = read();

	expect(control.getAttribute('aria-disabled'), 'aria-disabled').toBe('true');
	expect(control.hasAttribute('data-disabled'), 'data-disabled').toBe(true);

	(document.activeElement as HTMLElement | null)?.blur();
	for (let i = 0; i < 100 && document.activeElement !== control; i++) await user.tab();
	expect(document.activeElement === control, 'the control is reachable with Tab').toBe(true);
	await waitFor(() =>
		expect(describedBy(control), 'the reason is in aria-describedby on focus').toContain(reason)
	);

	const steps: Step[] = [
		['Space', () => user.keyboard(' ')],
		['Return', () => user.keyboard('{Enter}')],
		['a click on the control', () => user.click(control)]
	];
	if (label) steps.push(['a click on the label', () => user.click(label)]);
	for (const [step, act] of steps) {
		control.focus();
		await act();
		await afterAction();
		expect(read(), `the value after ${step}`).toEqual(before);
		expect(popup?.() ?? null, `the pop-up after ${step}`).toBeNull();
		expect(callback.mock.calls.length, `the callback calls after ${step}`).toBe(0);
		expect(control.getAttribute('aria-disabled'), `aria-disabled after ${step}`).toBe('true');
	}
}
