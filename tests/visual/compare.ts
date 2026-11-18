/**
 * Compares a capture with its baseline: every recorded property, every box,
 * the keyboard focus states and the screenshots, pixel by pixel.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import type { RecordedElement, FocusRecord } from './recorder';
import type { Snapshot } from './harness';

/**
 * - `style`: a computed property (or a pseudo-element's presence) changed.
 * - `box`: an element moved or was resized.
 * - `added` / `removed`: an element exists on one side only.
 * - `pixels`: a screenshot changed; `sha256` identifies the new pixels.
 * - `structure`: a missing baseline or capture file, a missing state or a
 *   different focus order. Never allowed: regenerate the baseline instead.
 */
export type DiffKind = 'style' | 'box' | 'added' | 'removed' | 'pixels' | 'structure';

export interface Diff {
	kind: DiffKind;
	scenario: string;
	element: string;
	property: string;
	before: string;
	after: string;
	/** For `pixels`: the hash of the new screenshot's pixels (`pixelHash`). */
	sha256?: string;
	/** Why it is expected, when an allowlist entry covers it. */
	allowedBy?: string;
}

interface EntryBase {
	/** Capture id pattern: `*` matches anything, `/…/` is a regular expression. */
	capture: string;
	reason: string;
}
/** A changed property, from exactly `before` to exactly `after`. */
export interface StyleEntry extends EntryBase {
	type: 'style';
	/** Element key pattern. */
	element: string;
	/** Exact property name, as in the report. */
	property: string;
	before: string;
	after: string;
}
/** A moved or resized element, from exactly `before` to exactly `after` (`x=… y=… w=… h=…`). */
export interface BoxEntry extends EntryBase {
	type: 'box';
	element: string;
	before: string;
	after: string;
}
/** An element that exists on one side only; `element` is the exact key, never a pattern. */
export interface PresenceEntry extends EntryBase {
	type: 'added' | 'removed';
	element: string;
}
/** A reviewed screenshot: exactly the pixels whose `pixelHash` is `sha256`, nothing else. */
export interface ScreenshotEntry extends EntryBase {
	type: 'screenshot';
	/** Exact file name, for example `grid--light.png`. */
	file: string;
	sha256: string;
}
export type AllowEntry = StyleEntry | BoxEntry | PresenceEntry | ScreenshotEntry;

const ENTRY_FIELDS: Record<AllowEntry['type'], string[]> = {
	style: ['capture', 'element', 'property', 'before', 'after', 'reason'],
	box: ['capture', 'element', 'before', 'after', 'reason'],
	added: ['capture', 'element', 'reason'],
	removed: ['capture', 'element', 'reason'],
	screenshot: ['capture', 'file', 'sha256', 'reason']
};

/** Checks every entry: a known type, exactly its fields, none empty. */
export function validateAllowlist(entries: unknown, source = 'allowlist'): AllowEntry[] {
	if (!Array.isArray(entries)) throw new Error(`${source} must be an array`);
	for (const entry of entries as Record<string, unknown>[]) {
		const fields = ENTRY_FIELDS[entry?.type as AllowEntry['type']];
		if (!fields) throw new Error(`${source}: unknown "type" (${Object.keys(ENTRY_FIELDS).join(', ')}): ${JSON.stringify(entry)}`);
		for (const field of fields) {
			if (typeof entry[field] !== 'string' || !(entry[field] as string).trim()) {
				throw new Error(`${source}: a ${entry.type} entry needs a non-empty "${field}": ${JSON.stringify(entry)}`);
			}
		}
		const extra = Object.keys(entry).filter((key) => key !== 'type' && !fields.includes(key));
		if (extra.length) throw new Error(`${source}: unexpected field(s) ${extra.join(', ')} in ${JSON.stringify(entry)}`);
		if (entry.type === 'screenshot' && !/^[0-9a-f]{64}$/.test(entry.sha256 as string)) {
			throw new Error(`${source}: "sha256" must be 64 lowercase hex digits: ${JSON.stringify(entry)}`);
		}
	}
	return entries as AllowEntry[];
}

export function loadAllowlist(path: string): AllowEntry[] {
	return validateAllowlist(JSON.parse(readFileSync(path, 'utf8')), path);
}

function pattern(source: string): RegExp {
	if (source.length > 2 && source.startsWith('/') && source.endsWith('/')) return new RegExp(source.slice(1, -1));
	const escaped = source.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
	return new RegExp(`^${escaped}$`);
}

/** Whether `entry` approves exactly this difference. */
function covers(entry: AllowEntry, d: Diff): boolean {
	if (!pattern(entry.capture).test(d.scenario)) return false;
	switch (entry.type) {
		case 'style':
			return d.kind === 'style' && pattern(entry.element).test(d.element) && entry.property === d.property && entry.before === d.before && entry.after === d.after;
		case 'box':
			return d.kind === 'box' && pattern(entry.element).test(d.element) && entry.before === d.before && entry.after === d.after;
		case 'added':
		case 'removed':
			return d.kind === entry.type && entry.element === d.element;
		case 'screenshot':
			return d.kind === 'pixels' && d.element === `screenshot ${entry.file}` && d.sha256 === entry.sha256;
	}
}

/** Marks the differences an entry approves. `structure` differences are never approved. */
export function applyAllowlist(diffs: Diff[], allowlist: AllowEntry[]): Diff[] {
	return diffs.map((d) => {
		if (d.kind === 'structure') return d;
		const hit = allowlist.find((entry) => covers(entry, d));
		return hit ? { ...d, allowedBy: hit.reason } : d;
	});
}

const boxText = (b: number[]) => `x=${b[0]} y=${b[1]} w=${b[2]} h=${b[3]}`;

function compareStyles(
	scenario: string,
	element: string,
	prefix: string,
	before: Record<string, string>,
	after: Record<string, string>,
	out: Diff[]
) {
	for (const prop of new Set([...Object.keys(before), ...Object.keys(after)])) {
		const a = before[prop] ?? '(not recorded)';
		const b = after[prop] ?? '(not recorded)';
		if (a !== b) out.push({ kind: 'style', scenario, element, property: prefix + prop, before: a, after: b });
	}
}

function comparePseudos(
	scenario: string,
	element: string,
	before: Record<string, Record<string, string>> = {},
	after: Record<string, Record<string, string>> = {},
	out: Diff[]
) {
	for (const pseudo of new Set([...Object.keys(before), ...Object.keys(after)])) {
		if (!before[pseudo] || !after[pseudo]) {
			out.push({
				kind: 'style',
				scenario,
				element,
				property: pseudo,
				before: before[pseudo] ? 'present' : 'absent',
				after: after[pseudo] ? 'present' : 'absent'
			});
		} else {
			compareStyles(scenario, element, `${pseudo} `, before[pseudo], after[pseudo], out);
		}
	}
}

/** Element styles are stored as deviations from `common`: rebuilt in full before comparing. */
const full = (common: Record<string, string>, e: RecordedElement) => ({ ...common, ...e.s });

/** Compares two element lists by key: presence, boxes, styles and pseudo-elements. */
function compareElements(
	scenario: string,
	label: string,
	before: { common: Record<string, string>; elements: RecordedElement[] },
	after: { common: Record<string, string>; elements: RecordedElement[] },
	out: Diff[]
) {
	const afterByKey = new Map(after.elements.map((e) => [e.k, e]));
	const beforeKeys = new Set(before.elements.map((e) => e.k));
	for (const a of before.elements) {
		const element = label + a.k;
		const b = afterByKey.get(a.k);
		if (!b) {
			out.push({ kind: 'removed', scenario, element, property: '(element)', before: 'present', after: 'missing' });
			continue;
		}
		if (boxText(a.b) !== boxText(b.b)) out.push({ kind: 'box', scenario, element, property: 'box', before: boxText(a.b), after: boxText(b.b) });
		compareStyles(scenario, element, '', full(before.common, a), full(after.common, b), out);
		comparePseudos(scenario, element, a.p, b.p, out);
	}
	for (const b of after.elements) {
		if (!beforeKeys.has(b.k)) out.push({ kind: 'added', scenario, element: label + b.k, property: '(element)', before: 'missing', after: 'present' });
	}
}

export function compareSnapshots(scenario: string, before: Snapshot, after: Snapshot): Diff[] {
	const out: Diff[] = [];
	if (before.dom.htmlClass !== after.dom.htmlClass) {
		out.push({ kind: 'style', scenario, element: 'html', property: 'class', before: before.dom.htmlClass, after: after.dom.htmlClass });
	}
	compareElements(scenario, '', before.dom, after.dom, out);

	const stops = Math.max(before.focus.length, after.focus.length);
	for (let i = 0; i < stops; i++) {
		const a: FocusRecord | undefined = before.focus[i];
		const b: FocusRecord | undefined = after.focus[i];
		const element = `focus #${i + 1}: ${a?.k ?? b?.k}`;
		if (!a || !b || a.k !== b.k) {
			out.push({ kind: 'structure', scenario, element, property: '(focused element)', before: a?.k ?? 'none', after: b?.k ?? 'none' });
			continue;
		}
		if (boxText(a.b) !== boxText(b.b)) out.push({ kind: 'box', scenario, element, property: 'box', before: boxText(a.b), after: boxText(b.b) });
		compareStyles(scenario, element, '', a.s, b.s, out);
		comparePseudos(scenario, element, a.p, b.p, out);
	}

	const beforeStates = new Map((before.states ?? []).map((s) => [s.name, s]));
	const afterStates = new Map((after.states ?? []).map((s) => [s.name, s]));
	for (const name of new Set([...beforeStates.keys(), ...afterStates.keys()])) {
		const a = beforeStates.get(name);
		const b = afterStates.get(name);
		const element = `state ${name}`;
		if (!a || !b) {
			out.push({ kind: 'structure', scenario, element, property: '(state)', before: a ? 'recorded' : 'none', after: b ? 'recorded' : 'none' });
			continue;
		}
		if (a.kind !== b.kind || a.target !== b.target) {
			out.push({ kind: 'structure', scenario, element, property: '(target)', before: `${a.kind} ${a.target}`, after: `${b.kind} ${b.target}` });
			continue;
		}
		compareElements(
			scenario,
			`${element}: `,
			{ common: before.dom.common, elements: a.elements },
			{ common: after.dom.common, elements: b.elements },
			out
		);
	}
	compareElements(
		scenario,
		'animation ',
		{ common: {}, elements: before.phases ?? [] },
		{ common: {}, elements: after.phases ?? [] },
		out
	);
	return out;
}

export interface PixelResult {
	differing: number;
	/** The baseline with differing pixels in red; `null` when identical. */
	diffPng: Buffer | null;
}

/** sha256 of a PNG's decoded RGBA pixels and size: the same for any encoding of the same image. */
export function pixelHash(png: Buffer): string {
	const image = PNG.sync.read(png);
	return createHash('sha256').update(`${image.width}x${image.height}\n`).update(image.data).digest('hex');
}

export function comparePngs(before: Buffer, after: Buffer): PixelResult {
	const a = PNG.sync.read(before);
	const b = PNG.sync.read(after);
	if (a.width !== b.width || a.height !== b.height) {
		return { differing: Math.max(a.width * a.height, b.width * b.height), diffPng: after };
	}
	const diff = new PNG({ width: a.width, height: a.height });
	// threshold 0: any change in any channel counts
	const differing = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0, includeAA: true });
	return { differing, diffPng: differing ? PNG.sync.write(diff) : null };
}

/** The markdown section of one capture: scenario → element → property (before → after). */
export function reportSection(id: string, diffs: Diff[]): string {
	const blocked = diffs.filter((d) => !d.allowedBy);
	const lines = [`## ${id}`, ''];
	if (!diffs.length) return [...lines, 'No differences.', ''].join('\n');
	lines.push(`${blocked.length} difference(s) not allowed, ${diffs.length - blocked.length} allowed.`, '');
	const byElement = new Map<string, Diff[]>();
	for (const d of diffs) byElement.set(d.element, [...(byElement.get(d.element) ?? []), d]);
	for (const [element, list] of byElement) {
		lines.push(`### \`${element}\``);
		for (const d of list) {
			const hash = d.sha256 ? ` (sha256 \`${d.sha256}\`)` : '';
			lines.push(`- ${d.kind} \`${d.property}\`: \`${d.before}\` → \`${d.after}\`${hash}${d.allowedBy ? ` _(allowed: ${d.allowedBy})_` : ''}`);
		}
		lines.push('');
	}
	return lines.join('\n');
}
