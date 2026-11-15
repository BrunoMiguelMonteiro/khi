import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ReaderPicker from './ReaderPicker.svelte';

const bruno = { id: 1, name: 'Bruno', exportPath: null };
const ana = { id: 2, name: 'Ana', exportPath: null };

describe('ReaderPicker', () => {
	it('picker hidden with one reader', () => {
		render(ReaderPicker, { readers: [bruno], activeReaderId: 1, onSelect: vi.fn() });

		expect(screen.queryByTestId('reader-picker')).toBeNull();
	});

	it('shows every reader and switches on change', async () => {
		const onSelect = vi.fn();
		render(ReaderPicker, { readers: [bruno, ana], activeReaderId: 1, onSelect });

		const select = screen.getByTestId('reader-picker') as HTMLSelectElement;
		expect(select.value).toBe('1');
		expect(screen.getByRole('option', { name: 'Ana' })).toBeInTheDocument();

		await fireEvent.change(select, { target: { value: '2' } });

		expect(onSelect).toHaveBeenCalledWith(2);
	});

	it('stays on the open reader until the chosen one opens', async () => {
		const { rerender } = render(ReaderPicker, { readers: [bruno, ana], activeReaderId: 1, onSelect: vi.fn() });
		const select = screen.getByTestId('reader-picker') as HTMLSelectElement;

		await fireEvent.change(select, { target: { value: '2' } });
		expect(select.value).toBe('1');

		await rerender({ readers: [bruno, ana], activeReaderId: 2, onSelect: vi.fn() });
		expect(select.value).toBe('2');
	});
});
