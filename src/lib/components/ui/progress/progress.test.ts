import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { compileAppCss } from '$lib/test/css';
import Progress from './progress.svelte';

/** Atualizações · Barra de progresso: 6 px, muted + primary, radius 3 (Figma 78:24014 for the determinate one; Q2 for the other). */
describe('Progress', () => {
	it('determinate: a 6 px bar, muted track and primary fill, with its value', () => {
		render(Progress, { value: 62.4, 'aria-label': 'Downloading' });

		const bar = screen.getByRole('progressbar', { name: 'Downloading' });
		expect(bar).toHaveAttribute('aria-valuemin', '0');
		expect(bar).toHaveAttribute('aria-valuemax', '100');
		expect(bar).toHaveAttribute('aria-valuenow', '62');
		expect(bar).toHaveClass('h-1.5', 'rounded-full', 'bg-muted', 'overflow-hidden');
		const fill = bar.firstElementChild as HTMLElement;
		expect(fill).toHaveClass('bg-primary', 'rounded-full');
		expect(fill.style.width).toBe('62.4%');
	});

	it('determinate: the value stays between 0 and 100', () => {
		const { rerender } = render(Progress, { value: 180, 'aria-label': 'x' });
		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');

		rerender({ value: -5, 'aria-label': 'x' });
		expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
	});

	it('indeterminate (Q2): a segment of a third that slides in a loop, and no aria-valuenow', () => {
		render(Progress, { value: null, 'aria-label': 'Checking' });

		const bar = screen.getByRole('progressbar', { name: 'Checking' });
		expect(bar).not.toHaveAttribute('aria-valuenow');
		expect(bar).not.toHaveAttribute('aria-valuemin');
		expect(bar).toHaveClass('h-1.5', 'rounded-full', 'bg-muted');
		const segment = bar.firstElementChild as HTMLElement;
		expect(segment).toHaveClass('w-1/3', 'bg-primary', 'rounded-full', 'animate-indeterminate');
	});

	it('indeterminate with Reduzir movimento: no animation, parked in the middle', () => {
		render(Progress, { value: null, 'aria-label': 'Checking' });

		const segment = screen.getByRole('progressbar').firstElementChild as HTMLElement;
		expect(segment).toHaveClass('motion-reduce:animate-none', 'motion-reduce:translate-x-full');
	});

	it('the animation is defined in the project CSS: keyframes on `translate` and an infinite loop', async () => {
		const { css } = await compileAppCss(['animate-indeterminate', 'motion-reduce:animate-none', 'motion-reduce:translate-x-full']);

		expect(css).toMatch(/@keyframes indeterminate-slide\s*\{[\s\S]*?translate:/);
		expect(css).toMatch(/\.animate-indeterminate\s*\{[^}]*animation:[^;}]*indeterminate-slide[^;}]*infinite/);
		expect(css).toMatch(/motion-reduce[^{]*\{[\s\S]*?animation:\s*none/);
		expect(css).toMatch(/prefers-reduced-motion:\s*reduce/);
	});
});
