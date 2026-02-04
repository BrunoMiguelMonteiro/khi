import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import KoboIcon from './KoboIcon.svelte';

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
});
