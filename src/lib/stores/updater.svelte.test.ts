import { describe, it, expect, vi, beforeEach } from 'vitest';

const check = vi.fn();
const relaunch = vi.fn();

vi.mock('@tauri-apps/plugin-updater', () => ({ check: (...args: unknown[]) => check(...args) }));
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: () => relaunch() }));
vi.mock('@tauri-apps/api/app', () => ({ getVersion: vi.fn().mockResolvedValue('1.3.0') }));

const RAW = {
	khi_releases: [
		{ version: '1.2.0', date: '2026-02-07', notes: { pt: { whats_new: ['Copiar citação'], bug_fixes: [] }, en: { whats_new: ['Copy citation'], bug_fixes: ['Fixed spacing'] } } },
		{ version: '1.4.0', date: '2026-03-01', notes: { en: { whats_new: ['Updates'], bug_fixes: [] } } },
		{ version: '1.3.0', date: '2026-02-09', notes: { pt: { whats_new: ['Capítulos'], bug_fixes: ['Avisos'] } } }
	]
};

function fakeUpdate(version = '1.4.0', downloadEvents: unknown[] = []) {
	return {
		version,
		currentVersion: '1.2.0',
		rawJson: RAW,
		download: vi.fn(async (onEvent: (e: unknown) => void) => downloadEvents.forEach(onEvent)),
		install: vi.fn().mockResolvedValue(undefined),
		close: vi.fn().mockResolvedValue(undefined)
	};
}

const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (k: string) => storage.get(k) ?? null,
	setItem: (k: string, v: string) => void storage.set(k, v),
	clear: () => storage.clear()
});

async function freshStore() {
	vi.resetModules();
	return import('./updater.svelte');
}

beforeEach(() => {
	check.mockReset();
	relaunch.mockReset();
	localStorage.clear();
});

describe('releasesSince', () => {
	it('lists only newer releases, newest first, in the chosen language with English fallback', async () => {
		const { releasesSince } = await freshStore();

		const notes = releasesSince(RAW, '1.2.0', 'pt');

		expect(notes.map((n) => n.version)).toEqual(['1.4.0', '1.3.0']);
		expect(notes[0].whatsNew).toEqual(['Updates']);
		expect(notes[1]).toEqual({ version: '1.3.0', date: '2026-02-09', whatsNew: ['Capítulos'], bugFixes: ['Avisos'] });
	});

	it('copes with a manifest without khi_releases', async () => {
		const { releasesSince } = await freshStore();
		expect(releasesSince({}, '1.0.0', 'en')).toEqual([]);
	});

	it('compares versions numerically', async () => {
		const { compareVersions } = await freshStore();
		expect(compareVersions('1.10.0', '1.9.0')).toBeGreaterThan(0);
		expect(compareVersions('1.3', '1.3.0')).toBe(0);
	});
});

describe('updater', () => {
	it('a manual check with nothing new says it is up to date; an automatic one stays silent', async () => {
		const { updater } = await freshStore();
		check.mockResolvedValue(null);

		await updater.checkNow();
		expect(updater.state).toBe('upToDate');

		updater.close();
		await updater.checkOnLaunch(true, Date.now() + 2 * 24 * 60 * 60 * 1000);
		expect(updater.state).toBe('idle');
	});

	it('remembers when it last checked and checks on launch at most once a day', async () => {
		const { updater } = await freshStore();
		check.mockResolvedValue(null);

		await updater.checkOnLaunch(true);
		await updater.checkOnLaunch(true, Date.now() + 60 * 60 * 1000);
		expect(check).toHaveBeenCalledTimes(1);
		expect(localStorage.getItem('khi.updates.lastChecked')).not.toBeNull();

		await updater.checkOnLaunch(true, Date.now() + 25 * 60 * 60 * 1000);
		expect(check).toHaveBeenCalledTimes(2);
	});

	it('does not check on launch when the setting is off', async () => {
		const { updater } = await freshStore();
		await updater.checkOnLaunch(false);
		expect(check).not.toHaveBeenCalled();
	});

	it('a skipped version is not offered on launch, but is when the user asks', async () => {
		const { updater } = await freshStore();
		check.mockImplementation(async () => fakeUpdate('1.4.0'));

		await updater.checkNow();
		expect(updater.state).toBe('available');
		updater.skip();
		expect(localStorage.getItem('khi.updates.skippedVersion')).toBe('1.4.0');

		await updater.checkOnLaunch(true, Date.now() + 2 * 24 * 60 * 60 * 1000);
		expect(updater.state).toBe('idle');

		await updater.checkNow();
		expect(updater.state).toBe('available');
	});

	it('a cancelled check drops its late result', async () => {
		const { updater } = await freshStore();
		let resolve!: (u: unknown) => void;
		check.mockReturnValue(new Promise((r) => (resolve = r)));

		const pending = updater.checkNow();
		expect(updater.state).toBe('checking');
		updater.close();
		const update = fakeUpdate();
		resolve(update);
		await pending;

		expect(updater.state).toBe('idle');
		expect(update.close).toHaveBeenCalled();
	});

	it('a failed check shows an error only when the user asked', async () => {
		const { updater } = await freshStore();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		check.mockRejectedValue(new Error('offline'));

		await updater.checkOnLaunch(true);
		expect(updater.state).toBe('idle');

		await updater.checkNow();
		expect(updater.state).toBe('error');
	});

	it('tells a failed download or install apart from a failed check', async () => {
		const { updater } = await freshStore();
		vi.spyOn(console, 'error').mockImplementation(() => {});
		check.mockRejectedValueOnce(new Error('offline'));

		await updater.checkNow();
		expect(updater.errorKind).toBe('check');

		const update = fakeUpdate();
		update.download.mockRejectedValue(new Error('connection reset'));
		check.mockResolvedValue(update);
		await updater.retry();
		await updater.install(() => false);

		expect(updater.state).toBe('error');
		expect(updater.errorKind).toBe('install');
		expect(updater.update?.version).toBe('1.4.0');
		expect(relaunch).not.toHaveBeenCalled();
	});

	it('downloads with progress, installs and restarts at once when nothing is running', async () => {
		const { updater } = await freshStore();
		const update = fakeUpdate('1.4.0', [
			{ event: 'Started', data: { contentLength: 6_900_000 } },
			{ event: 'Progress', data: { chunkLength: 4_300_000 } }
		]);
		check.mockResolvedValue(update);
		await updater.checkNow();

		await updater.install(() => false);

		expect(updater.progress).toEqual({ done: 4_300_000, total: 6_900_000 });
		expect(update.install).toHaveBeenCalled();
		expect(relaunch).toHaveBeenCalledTimes(1);
	});

	it('waits for a running export before restarting', async () => {
		const { updater } = await freshStore();
		check.mockResolvedValue(fakeUpdate());
		await updater.checkNow();

		await updater.install(() => true);
		expect(updater.state).toBe('installed');
		expect(relaunch).not.toHaveBeenCalled();

		updater.dismissInstalled();
		await updater.restartWhenIdle(true);
		expect(relaunch).not.toHaveBeenCalled();
		await updater.restartWhenIdle(false);
		expect(relaunch).toHaveBeenCalledTimes(1);
	});

	it('never restarts when no update was installed', async () => {
		const { updater } = await freshStore();
		await updater.restartWhenIdle(false);
		expect(relaunch).not.toHaveBeenCalled();
	});
});
