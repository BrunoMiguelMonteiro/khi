import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import KoboIcon from './KoboIcon.svelte';
import { compileAppCss } from '$lib/test/css';

async function ruleOf(candidate: string) {
  const { css } = await compileAppCss([candidate]);
  return css.match(/@layer utilities \{[\s\S]*?\n\}/)?.[0] ?? '';
}

describe('KoboIcon', () => {
  it('renders correctly with default props', () => {
    const { container } = render(KoboIcon);
    const wrapper = container.querySelector('.kobo-icon');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveAttribute('role', 'img');
    expect(wrapper).toHaveAttribute('aria-label', 'Kobo e-reader device');
    // Default size is 128px
    expect(wrapper).toHaveStyle('width: 128px');
    // Should contain SVG markup
    const svg = wrapper?.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('renders with custom size', () => {
    const { container } = render(KoboIcon, { props: { size: 64 } });
    const wrapper = container.querySelector('.kobo-icon');
    expect(wrapper).toHaveStyle('width: 64px');
  });

  it('applies disabled classes when disabled is true', () => {
    const { container } = render(KoboIcon, { props: { disabled: true } });
    const wrapper = container.querySelector('.kobo-icon');
    expect(wrapper).toHaveClass('text-neutral-300');
    expect(wrapper).toHaveClass('dark:text-neutral-700');
    // Should not have active state classes
    expect(wrapper).not.toHaveClass('text-neutral-900');
    expect(wrapper).not.toHaveClass('dark:text-neutral-100');
  });

  it('does not apply disabled classes when disabled is false', () => {
    const { container } = render(KoboIcon, { props: { disabled: false } });
    const wrapper = container.querySelector('.kobo-icon');
    // Should have active state classes (variant solid is default)
    expect(wrapper).toHaveClass('text-neutral-900');
    expect(wrapper).toHaveClass('dark:text-neutral-100');
  });

  describe('filledLines (Task 38, X2)', () => {
    const lines = (c: HTMLElement) => [...c.querySelectorAll('svg line')];
    const filled = (c: HTMLElement) => lines(c).filter((l) => l.hasAttribute('data-filled'));

    it('marks the first N of the 7 text lines as filled', () => {
      const { container } = render(KoboIcon, { props: { filledLines: 2 } });
      expect(lines(container)).toHaveLength(7);
      expect(filled(container)).toEqual(lines(container).slice(0, 2));
    });

    it('follows the count', async () => {
      const { container, rerender } = render(KoboIcon, { props: { filledLines: 0 } });
      expect(filled(container)).toHaveLength(0);
      await rerender({ filledLines: 7 });
      expect(filled(container)).toHaveLength(7);
      await rerender({ filledLines: 3 });
      expect(filled(container)).toHaveLength(3);
    });

    it('is decoration, not an image, and keeps the solid outline', () => {
      const { container } = render(KoboIcon, { props: { filledLines: 1 } });
      const wrapper = container.querySelector('.kobo-icon')!;
      expect(wrapper).toHaveAttribute('aria-hidden', 'true');
      expect(wrapper).not.toHaveAttribute('role');
      expect(wrapper).not.toHaveAttribute('aria-label');
      expect(container.querySelectorAll('[stroke-dasharray]')).toHaveLength(0);
    });

    it('colours the lines with the highlight tokens, in 250 ms ease-out, whatever the motion setting', async () => {
      const { container } = render(KoboIcon, { props: { filledLines: 1 } });
      const wrapper = container.querySelector('.kobo-icon')!;
      const has = (c: string) => expect(wrapper.classList.contains(c), c).toBe(true);
      const empty = '[&_line]:stroke-highlight-line';
      const body = '[&_rect]:stroke-highlight-line';
      const full = '[&_line[data-filled]]:stroke-highlight-line-new';
      const transition = '[&_line]:transition-[stroke]';
      const duration = '[&_line]:duration-(--duration-reveal)';
      const ease = '[&_line]:ease-out';
      [empty, body, full, transition, duration, ease].forEach(has);
      expect(await ruleOf(body)).toContain('stroke: var(--highlight-line)');
      expect(wrapper.className).not.toMatch(/neutral/);
      expect(await ruleOf(empty)).toContain('stroke: var(--highlight-line)');
      expect(await ruleOf(full)).toContain('stroke: var(--highlight-line-new)');
      expect(await ruleOf(duration)).toContain('var(--duration-reveal)');
      expect(await ruleOf(ease)).toContain('var(--ease-out)');
      // Colour only: no motion-reduce override anywhere, so Reduzir movimento keeps the change
      expect([...wrapper.classList].filter((c) => c.includes('motion-reduce:') && c.includes('line'))).toEqual([]);
    });

    it('is not decorated when filledLines is not given', () => {
      const { container } = render(KoboIcon);
      expect(container.querySelector('.kobo-icon')).toHaveClass('text-neutral-300', 'dark:text-neutral-700');
      expect(filled(container)).toHaveLength(0);
      expect(container.querySelector('.kobo-icon')).toHaveAttribute('role', 'img');
    });
  });
});
