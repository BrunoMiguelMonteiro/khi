import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { compileAppCss } from '$lib/test/css';
import { Icon, type IconSize } from './index';

import ArrowDown from 'lucide-svelte/icons/arrow-down';
import ArrowUp from 'lucide-svelte/icons/arrow-up';
import ArrowUpDown from 'lucide-svelte/icons/arrow-up-down';
import Check from 'lucide-svelte/icons/check';
import ChevronDown from 'lucide-svelte/icons/chevron-down';
import ChevronLeft from 'lucide-svelte/icons/chevron-left';
import ChevronsUpDown from 'lucide-svelte/icons/chevrons-up-down';
import CircleAlert from 'lucide-svelte/icons/circle-alert';
import CircleCheck from 'lucide-svelte/icons/circle-check';
import Copy from 'lucide-svelte/icons/copy';
import Download from 'lucide-svelte/icons/download';
import FileOutput from 'lucide-svelte/icons/file-output';
import Highlighter from 'lucide-svelte/icons/highlighter';
import LayoutGrid from 'lucide-svelte/icons/layout-grid';
import List from 'lucide-svelte/icons/list';
import MessageSquare from 'lucide-svelte/icons/message-square';
import Palette from 'lucide-svelte/icons/palette';
import RefreshCw from 'lucide-svelte/icons/refresh-cw';
import Tablet from 'lucide-svelte/icons/tablet';
import Trash2 from 'lucide-svelte/icons/trash-2';
import Unlink from 'lucide-svelte/icons/unlink';
import X from 'lucide-svelte/icons/x';

const root = process.cwd();
const tokens = JSON.parse(readFileSync(resolve(root, 'design/tokens.json'), 'utf8'));

// Componentes (D7) · 0 · Ícones: the 21 of the ledger (55:33 to 55:136) and Ícone/copy (69:6930).
const FIGMA_ICONS = {
	'arrow-down': ArrowDown,
	'arrow-up': ArrowUp,
	'arrow-up-down': ArrowUpDown,
	check: Check,
	'chevron-down': ChevronDown,
	'chevron-left': ChevronLeft,
	'chevrons-up-down': ChevronsUpDown,
	'circle-alert': CircleAlert,
	'circle-check': CircleCheck,
	copy: Copy,
	download: Download,
	'file-output': FileOutput,
	highlighter: Highlighter,
	'layout-grid': LayoutGrid,
	list: List,
	'message-square': MessageSquare,
	palette: Palette,
	'refresh-cw': RefreshCw,
	tablet: Tablet,
	'trash-2': Trash2,
	unlink: Unlink,
	x: X
};

const SIZES: { size: IconSize; utility: string }[] = [
	{ size: 'sm', utility: 'size-icon-sm' },
	{ size: 'md', utility: 'size-icon' },
	{ size: 'lg', utility: 'size-icon-lg' }
];

const svgOf = (container: HTMLElement) => {
	const svg = container.querySelector('svg');
	if (!svg) throw new Error('no svg rendered');
	return svg;
};

describe('Icon', () => {
	it('decorative_icon_is_hidden', () => {
		const { container } = render(Icon, { icon: Download });
		const svg = svgOf(container);
		expect(svg.getAttribute('aria-hidden')).toBe('true');
		expect(svg.hasAttribute('role')).toBe(false);
		expect(svg.hasAttribute('aria-label')).toBe(false);
		expect(screen.queryByRole('img')).toBeNull();
	});

	it('labelled_icon_has_img_role', () => {
		const { container } = render(Icon, { icon: Download, label: 'Exportar' });
		const img = screen.getByRole('img', { name: 'Exportar' });
		expect(img).toBe(svgOf(container));
		expect(img.hasAttribute('aria-hidden')).toBe(false);
	});

	it('sizes_use_figma_tokens', async () => {
		for (const { size, utility } of SIZES) {
			const { container, unmount } = render(Icon, { icon: Download, size });
			const svg = svgOf(container);
			const others = SIZES.map((s) => s.utility).filter((u) => u !== utility);
			expect(svg.classList.contains(utility), `${size} → ${utility}`).toBe(true);
			expect(others.filter((o) => svg.classList.contains(o)), size).toEqual([]);
			expect(Number(svg.getAttribute('width')), size).toBe(tokens.medidas[utility]);
			expect(Number(svg.getAttribute('height')), size).toBe(tokens.medidas[utility]);
			unmount();

			const { css } = await compileAppCss([utility]);
			const rule = css.match(new RegExp(`\\.${utility} \\{([^}]*)\\}`))?.[1] ?? '';
			expect(rule, utility).toContain(`width: var(--${utility});`);
			expect(rule, utility).toContain(`height: var(--${utility});`);
		}
		const { container } = render(Icon, { icon: Download });
		expect(svgOf(container).classList.contains('size-icon'), 'default is md').toBe(true);
	});

	it('stroke_is_1_333_at_every_size', () => {
		for (const { size, utility } of SIZES) {
			const { container, unmount } = render(Icon, { icon: Download, size });
			const svg = svgOf(container);
			// The viewBox is 24 wide, so the drawn stroke is stroke-width × size / 24.
			const drawn = (Number(svg.getAttribute('stroke-width')) * tokens.medidas[utility]) / 24;
			expect(drawn, size).toBeCloseTo(1.333, 3);
			expect(svg.getAttribute('stroke')).toBe('currentColor');
			unmount();
		}
	});

	it('figma_icons_exist_in_lucide', () => {
		expect(Object.keys(FIGMA_ICONS)).toHaveLength(22);
		for (const [name, component] of Object.entries(FIGMA_ICONS)) {
			const { container, unmount } = render(Icon, { icon: component });
			const svg = svgOf(container);
			expect(svg.classList.contains(`lucide-${name}`), name).toBe(true);
			expect(svg.children.length, name).toBeGreaterThan(0);
			unmount();
		}
	});

	it('colour_comes_from_parent_class', () => {
		const { container } = render(Icon, { icon: Download, class: 'text-muted-foreground' });
		const svg = svgOf(container);
		expect(svg.classList.contains('text-muted-foreground')).toBe(true);
		expect(svg.classList.contains('size-icon')).toBe(true);
	});
});
