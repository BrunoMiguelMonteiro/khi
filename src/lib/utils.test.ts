import { describe, expect, it } from 'vitest';
import figma from '../../design/tokens.json';
import textStyles from '../../design/text-styles.json';
import { cn, khiTheme } from './utils';

const sizeKeys = Object.keys(figma.medidas)
	.filter((key) => key.startsWith('size-'))
	.map((key) => key.slice('size-'.length));

describe('cn()', () => {
	it('later_padding_wins', () => {
		expect(cn('px-2', 'px-4')).toBe('px-4');
	});

	it('text_style_and_color_coexist', () => {
		const classes = cn('text-body', 'text-foreground').split(' ');
		expect(classes).toContain('text-body');
		expect(classes).toContain('text-foreground');
		expect(cn('text-tertiary-foreground', 'text-subheadline-semibold')).toBe(
			'text-tertiary-foreground text-subheadline-semibold'
		);
	});

	it('later_text_style_wins', () => {
		expect(cn('text-body', 'text-callout')).toBe('text-callout');
		expect(cn('text-cover-title', 'text-sm')).toBe('text-sm');
	});

	it('later_figma_color_wins', () => {
		expect(cn('text-foreground', 'text-tertiary-foreground')).toBe('text-tertiary-foreground');
		expect(cn('bg-primary', 'bg-primary-hover')).toBe('bg-primary-hover');
	});

	it('later_figma_radius_wins', () => {
		expect(cn('rounded-control', 'rounded-group')).toBe('rounded-group');
		expect(cn('rounded-md', 'rounded-menu')).toBe('rounded-menu');
	});

	it('later_figma_size_wins', () => {
		expect(cn('h-control', 'h-toolbar')).toBe('h-toolbar');
		expect(cn('size-icon', 'size-icon-lg')).toBe('size-icon-lg');
		expect(cn('h-control', 'w-control')).toBe('h-control w-control');
	});

	it('later_figma_ease_wins', () => {
		expect(cn('ease-out', 'ease-hover')).toBe('ease-hover');
	});

	it('config_matches_figma_exports', () => {
		expect(khiTheme.text).toEqual(Object.keys(textStyles.styles));
		expect(khiTheme.radius).toEqual(Object.keys(figma.raio));
		expect(khiTheme.spacing).toEqual(sizeKeys);
		const tailwindEases = ['in', 'out', 'in-out'];
		const figmaEases = Object.keys(figma.movimento)
			.filter((key) => key.startsWith('ease-'))
			.map((key) => key.slice('ease-'.length))
			.filter((key) => !tailwindEases.includes(key));
		expect(khiTheme.ease).toEqual(figmaEases);
	});
});
