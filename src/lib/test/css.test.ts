import { describe, expect, it } from 'vitest';
import { selectorFor } from './css';

function element(className: string, attrs: Record<string, string>) {
	const el = document.createElement('div');
	el.className = className;
	for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
	return el;
}

describe('selectorFor', () => {
	it('data_checked_matches_bits_ui_state', async () => {
		const candidate = 'data-checked:bg-primary';
		const selector = await selectorFor(candidate);
		expect(element(candidate, { 'data-state': 'checked' }).matches(selector)).toBe(true);
		expect(element(candidate, { 'data-state': 'unchecked' }).matches(selector)).toBe(false);
		expect(element('bg-primary', { 'data-state': 'checked' }).matches(selector)).toBe(false);
	});

	it('data_highlighted_matches_presence_attribute', async () => {
		const candidate = 'data-highlighted:bg-primary';
		const selector = await selectorFor(candidate);
		expect(element(candidate, { 'data-highlighted': '' }).matches(selector)).toBe(true);
		expect(element(candidate, {}).matches(selector)).toBe(false);
	});

	it('unknown_candidate_throws', async () => {
		await expect(selectorFor('not-a-khi-utility')).rejects.toThrow(/not-a-khi-utility/);
	});

	it('escaped_ampersand_in_arbitrary_variant_is_kept', async () => {
		const candidate = '[&>svg]:size-4';
		const selector = await selectorFor(candidate);
		const parent = element(candidate, {});
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		parent.append(svg);
		document.body.append(parent);
		expect(svg.matches(selector)).toBe(true);
		expect(parent.matches(selector)).toBe(false);
		const other = element('size-4', {});
		const svg2 = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		other.append(svg2);
		document.body.append(other);
		expect(svg2.matches(selector)).toBe(false);
		document.body.innerHTML = '';
	});
});
