/**
 * One test per capture. `npm run test:visual` compares with `baseline/`;
 * `npm run test:visual:update` rewrites it.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { capture } from './harness';
import { captures } from './scenarios';
import { OUTPUT_DIR, compareWithBaseline, writeBaseline } from './baseline-store';

for (const item of captures()) {
	test(item.id, async ({ browser }, testInfo) => {
		const result = await capture(browser, item);

		mkdirSync(join(OUTPUT_DIR, 'ipc'), { recursive: true });
		writeFileSync(join(OUTPUT_DIR, 'ipc', `${item.id}.json`), JSON.stringify(result.calls.map((c) => c.cmd)));
		expect(result.problems, 'unknown IPC calls, page errors or console errors').toEqual([]);

		if (testInfo.config.updateSnapshots === 'all') {
			// A baseline without a state would never compare it
			expect(result.unreachable, 'states that could not be reached').toEqual([]);
			writeBaseline(result);
			return;
		}
		const { blocked, report } = compareWithBaseline(result);
		if (blocked.length) await testInfo.attach('report', { body: report, contentType: 'text/markdown' });
		expect(blocked, `${blocked.length} unexplained difference(s); see tests/visual/output/report.md`).toEqual([]);
	});
}
