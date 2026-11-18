/**
 * Baseline files (`baseline/`) and comparison output (`output/`).
 *
 * `baseline/<capture>.json` holds the recorded DOM, focus stops and states,
 * and maps each screenshot file name to the `pixelHash` of its pixels. The
 * PNGs themselves are stored once per distinct image, as
 * `baseline/png/<pixelHash>.png`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import type { CaptureResult, Snapshot } from './harness';
import { applyAllowlist, compareSnapshots, comparePngs, loadAllowlist, pixelHash, reportSection } from './compare';
import type { AllowEntry, Diff } from './compare';

const HERE = dirname(fileURLToPath(import.meta.url));
export const BASELINE_DIR = join(HERE, 'baseline');
export const OUTPUT_DIR = join(HERE, 'output');
export const ALLOWLIST = join(HERE, 'allowlist.json');

const PNG_DIR = 'png';

/** The screenshot files of a capture, by name: the page, each focus stop, each state. */
export function shotsOf(result: CaptureResult): Array<{ name: string; png: Buffer }> {
	const { id, states } = result.snapshot;
	return [
		{ name: `${id}.png`, png: result.screenshot },
		...result.focusShots.map((png, i) => ({ name: `${id}.focus-${i + 1}.png`, png })),
		...result.stateShots.map((png, i) => ({ name: `${id}.state-${states[i].name}.png`, png }))
	];
}

interface StoredSnapshot extends Snapshot {
	/** Screenshot file name → `pixelHash`, the name of its file in `png/`. */
	shots: Record<string, string>;
}

/** One element per line: readable, and a git diff shows which elements changed. */
function serialise(snapshot: Snapshot, shots: Record<string, string>): string {
	const { dom, focus, states, phases } = snapshot;
	const lines = [
		'{',
		`"id": ${JSON.stringify(snapshot.id)},`,
		`"htmlClass": ${JSON.stringify(dom.htmlClass)},`,
		`"shots": ${JSON.stringify(shots, null, 1)},`,
		`"common": ${JSON.stringify(dom.common, null, 1)},`,
		'"elements": [',
		dom.elements.map((e) => JSON.stringify(e)).join(',\n'),
		'],',
		'"focus": [',
		focus.map((f) => JSON.stringify(f)).join(',\n'),
		'],',
		'"states": [',
		states
			.map((s) =>
				[
					`{"name": ${JSON.stringify(s.name)}, "kind": ${JSON.stringify(s.kind)}, "target": ${JSON.stringify(s.target)}, "elements": [`,
					s.elements.map((e) => JSON.stringify(e)).join(',\n'),
					']}'
				].join('\n')
			)
			.join(',\n'),
		'],',
		'"phases": [',
		phases.map((p) => JSON.stringify(p)).join(',\n'),
		']',
		'}',
		''
	];
	return lines.join('\n');
}

function deserialise(text: string): StoredSnapshot {
	const raw = JSON.parse(text);
	return {
		id: raw.id,
		dom: { htmlClass: raw.htmlClass, common: raw.common, elements: raw.elements },
		focus: raw.focus,
		states: raw.states ?? [],
		phases: raw.phases ?? [],
		shots: raw.shots ?? {}
	};
}

/** Same pixels, smaller file: screenshots are opaque, so the alpha channel is dropped. */
function compact(png: Buffer): Buffer {
	const image = PNG.sync.read(png);
	for (let i = 3; i < image.data.length; i += 4) if (image.data[i] !== 255) return png;
	return PNG.sync.write(image, { colorType: 2, deflateLevel: 9 });
}

export function writeBaseline(result: CaptureResult, baselineDir = BASELINE_DIR) {
	const pngDir = join(baselineDir, PNG_DIR);
	mkdirSync(pngDir, { recursive: true });
	const shots: Record<string, string> = {};
	for (const { name, png } of shotsOf(result)) {
		const hash = pixelHash(png);
		shots[name] = hash;
		const file = join(pngDir, `${hash}.png`);
		if (!existsSync(file)) writeFileSync(file, compact(png));
	}
	writeFileSync(join(baselineDir, `${result.snapshot.id}.json`), serialise(result.snapshot, shots));
}

/** Deletes the PNGs no capture refers to any more (after a full update). */
export function pruneBaseline(baselineDir = BASELINE_DIR) {
	const pngDir = join(baselineDir, PNG_DIR);
	if (!existsSync(pngDir)) return 0;
	const used = new Set<string>();
	for (const file of readdirSync(baselineDir).filter((f) => f.endsWith('.json'))) {
		for (const hash of Object.values(deserialise(readFileSync(join(baselineDir, file), 'utf8')).shots)) used.add(`${hash}.png`);
	}
	let removed = 0;
	for (const file of readdirSync(pngDir)) {
		if (!used.has(file)) {
			rmSync(join(pngDir, file));
			removed++;
		}
	}
	return removed;
}

export interface Comparison {
	diffs: Diff[];
	blocked: Diff[];
	report: string;
}

export interface CompareOptions {
	/** Names the report section and output files (the control test's captures). */
	outputName?: string;
	baselineDir?: string;
	/** Defaults to `allowlist.json`. */
	allowlist?: AllowEntry[];
}

/**
 * Compares with the baseline; writes the report section, the current
 * screenshots and the diff images to `output/`. A missing baseline (JSON or
 * PNG) or a screenshot captured on one side only is a `structure` difference,
 * which no allowlist entry can approve.
 */
export function compareWithBaseline(result: CaptureResult, options: CompareOptions = {}): Comparison {
	const { id } = result.snapshot;
	const outputName = options.outputName ?? id;
	const baselineDir = options.baselineDir ?? BASELINE_DIR;
	const dirs = { actual: join(OUTPUT_DIR, 'actual'), diff: join(OUTPUT_DIR, 'diff'), report: join(OUTPUT_DIR, 'sections') };
	for (const dir of Object.values(dirs)) mkdirSync(dir, { recursive: true });

	const diffs: Diff[] = [];
	const jsonPath = join(baselineDir, `${id}.json`);
	const baseline = existsSync(jsonPath) ? deserialise(readFileSync(jsonPath, 'utf8')) : null;
	if (baseline) diffs.push(...compareSnapshots(id, baseline, result.snapshot));
	else diffs.push({ kind: 'structure', scenario: id, element: `${id}.json`, property: '(baseline)', before: 'missing', after: 'captured' });

	const baselineShots = new Map(Object.entries(baseline?.shots ?? {}));
	for (const { name, png } of shotsOf(result)) {
		const outName = name.replace(id, outputName);
		writeFileSync(join(dirs.actual, outName), png);
		const element = `screenshot ${name}`;
		const hash = baselineShots.get(name);
		baselineShots.delete(name);
		const basePath = hash ? join(baselineDir, PNG_DIR, `${hash}.png`) : null;
		if (!basePath || !existsSync(basePath)) {
			const before = hash ? `png/${hash}.png missing` : 'no baseline';
			diffs.push({ kind: 'structure', scenario: id, element, property: 'pixels', before, after: 'captured' });
			continue;
		}
		const actualHash = pixelHash(png);
		if (actualHash === hash) continue;
		const { differing, diffPng } = comparePngs(readFileSync(basePath), png);
		writeFileSync(join(dirs.diff, outName), diffPng!);
		diffs.push({
			kind: 'pixels',
			scenario: id,
			element,
			property: 'pixels',
			before: '0 differing',
			after: `${differing} differing (output/diff/${outName})`,
			sha256: actualHash
		});
	}
	if (baseline) {
		for (const name of baselineShots.keys()) {
			diffs.push({ kind: 'structure', scenario: id, element: `screenshot ${name}`, property: 'pixels', before: 'in baseline', after: 'not captured' });
		}
	}

	const judged = applyAllowlist(diffs, options.allowlist ?? loadAllowlist(ALLOWLIST));
	const report = reportSection(outputName, judged);
	writeFileSync(join(dirs.report, `${outputName}.md`), report);
	return { diffs: judged, blocked: judged.filter((d) => !d.allowedBy), report };
}
