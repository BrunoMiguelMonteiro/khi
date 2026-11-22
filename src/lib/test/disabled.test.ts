import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectDisabledInert } from './disabled';

const REASON = 'Sem destaques para exportar';

function mount(html: string) {
	document.body.innerHTML = html;
	return (selector: string) => document.querySelector<HTMLElement>(selector)!;
}

function checkbox({ inert, describedBy = true }: { inert: boolean; describedBy?: boolean }) {
	const $ = mount(`
		<label for="c">Mostrar removidos</label>
		<input id="c" type="checkbox" aria-disabled="true" data-disabled=""
			${describedBy ? 'aria-describedby="r"' : ''} />
		<span id="r">${REASON}</span>`);
	const input = $('#c') as HTMLInputElement;
	const callback = vi.fn();
	input.addEventListener('change', callback);
	if (inert) input.addEventListener('click', (e) => e.preventDefault());
	return { control: input, label: $('label'), read: () => input.checked, callback };
}

function popupButton({ keyboardOpens, delay }: { keyboardOpens: boolean; delay?: number }) {
	const $ = mount(`
		<button id="b" aria-disabled="true" data-disabled="" aria-describedby="r">Ordenar</button>
		<span id="r">${REASON}</span>`);
	const button = $('#b');
	const callback = vi.fn();
	const openNow = () => {
		callback();
		document.body.insertAdjacentHTML('beforeend', '<div role="listbox"></div>');
	};
	const open = () => (delay === undefined ? openNow() : setTimeout(openNow, delay));
	button.addEventListener('click', (e) => e.preventDefault());
	if (keyboardOpens) button.addEventListener('keydown', (e) => e.key === 'Enter' && open());
	return {
		control: button,
		read: () => button.textContent,
		popup: () => document.querySelector('[role="listbox"]'),
		callback
	};
}

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
});

describe('expectDisabledInert', () => {
	it('passes_on_an_inert_checkbox', async () => {
		await expectDisabledInert({ ...checkbox({ inert: true }), reason: REASON });
	});

	it('fails_when_the_value_changes', async () => {
		await expect(
			expectDisabledInert({ ...checkbox({ inert: false }), reason: REASON })
		).rejects.toThrow(/value/);
	});

	it('fails_without_the_reason', async () => {
		await expect(
			expectDisabledInert({ ...checkbox({ inert: true, describedBy: false }), reason: REASON })
		).rejects.toThrow(/aria-describedby/);
	});

	it('passes_on_an_inert_popup_trigger', async () => {
		await expectDisabledInert({ ...popupButton({ keyboardOpens: false }), reason: REASON });
	});

	it('fails_when_return_opens_the_popup', async () => {
		await expect(
			expectDisabledInert({ ...popupButton({ keyboardOpens: true }), reason: REASON })
		).rejects.toThrow(/Return/);
	});

	it('fails_when_return_opens_the_popup_after_a_delay', async () => {
		await expect(
			expectDisabledInert({ ...popupButton({ keyboardOpens: true, delay: 80 }), reason: REASON })
		).rejects.toThrow(/Return/);
	});

	it('fails_when_return_opens_the_popup_after_a_delay_with_fake_timers', async () => {
		vi.useFakeTimers();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		await expect(
			expectDisabledInert({ ...popupButton({ keyboardOpens: true, delay: 80 }), reason: REASON, user })
		).rejects.toThrow(/Return/);
	});

	it('passes_on_an_inert_popup_trigger_with_fake_timers', async () => {
		vi.useFakeTimers();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		await expectDisabledInert({ ...popupButton({ keyboardOpens: false }), reason: REASON, user });
	});

	it('uses_the_callers_settle', async () => {
		const settle = vi.fn(() => new Promise<void>((r) => setTimeout(r, 100)));
		await expect(
			expectDisabledInert({ ...popupButton({ keyboardOpens: true, delay: 80 }), reason: REASON, settle })
		).rejects.toThrow(/Return/);
		expect(settle).toHaveBeenCalledTimes(2);
	});
});
