import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import KoboIcon from './KoboIcon.svelte';

describe('KoboIcon', () => {
  it('renders correctly with default props', () => {
    const { container } = render(KoboIcon);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('viewBox', '0 0 140 180');
    // Default size is 128
    expect(svg).toHaveAttribute('width', '128');
    expect(svg).toHaveAttribute('height', '128');
  });

  it('renders with custom size', () => {
    const { container } = render(KoboIcon, { props: { size: 64 } });
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '64');
    expect(svg).toHaveAttribute('height', '64');
  });

  it('applies disabled classes when disabled is true', () => {
    const { container } = render(KoboIcon, { props: { disabled: true } });
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-neutral-300');
    expect(svg).toHaveClass('dark:text-neutral-700');
  });

  it('does not apply disabled classes when disabled is false', () => {
    const { container } = render(KoboIcon, { props: { disabled: false } });
    const svg = container.querySelector('svg');
    expect(svg).not.toHaveClass('text-neutral-300');
    expect(svg).not.toHaveClass('dark:text-neutral-700');
  });
});
