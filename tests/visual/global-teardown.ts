import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FullConfig } from '@playwright/test';
import { OUTPUT_DIR, pruneBaseline } from './baseline-store';

/** Joins every capture's section into `output/report.md`, differences first. */
export default function globalTeardown(config: FullConfig) {
	if (config.updateSnapshots === 'all') {
		const removed = pruneBaseline();
		if (removed) console.log(`Removed ${removed} baseline PNG(s) no capture refers to`);
		return;
	}
	const dir = join(OUTPUT_DIR, 'sections');
	if (!existsSync(dir)) return;
	const sections = readdirSync(dir)
		.sort()
		.map((file) => readFileSync(join(dir, file), 'utf8'));
	const clean = sections.filter((s) => s.includes('No differences.'));
	const dirty = sections.filter((s) => !s.includes('No differences.'));
	const header = [
		'# Visual parity report',
		'',
		`${sections.length} captures compared: ${clean.length} identical, ${dirty.length} with differences.`,
		'Captures named `control--…` are the control test\'s deliberate change and are expected to differ.',
		''
	];
	writeFileSync(join(OUTPUT_DIR, 'report.md'), [...header, ...dirty, ...clean].join('\n'));
	console.log(`Visual parity report: ${join(OUTPUT_DIR, 'report.md')}`);
}
