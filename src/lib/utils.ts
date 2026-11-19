import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/*
  Khi theme keys tailwind-merge cannot guess. Without them it reads a text style
  as a colour (dropping the real colour) and keeps two conflicting Figma radii,
  sizes or eases. Literal class names stay out of this file: Tailwind scans it.
  utils.test.ts checks the keys against design/text-styles.json and
  design/tokens.json. Figma colours need nothing: tailwind-merge already takes
  any unknown text, bg or border suffix as a colour.
*/
export const khiTheme = {
	text: [
		'title-1',
		'title-3',
		'body',
		'body-medium',
		'body-semibold',
		'callout',
		'callout-medium',
		'subheadline',
		'subheadline-semibold',
		'reading',
		'cover-title',
		'cover-title-sm',
		'cover-author'
	],
	radius: ['control', 'group', 'menu', 'cover', 'badge', 'checkbox', 'segment', 'thumb'],
	spacing: [
		'control',
		'segment',
		'toolbar-button',
		'toolbar',
		'form-row',
		'icon',
		'icon-sm',
		'icon-lg'
	],
	ease: ['hover']
};

const twMerge = extendTailwindMerge({ extend: { theme: khiTheme } });

export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };
