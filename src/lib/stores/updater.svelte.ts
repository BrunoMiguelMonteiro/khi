/**
 * Updater Store: checks GitHub Releases for a new version of Khi, downloads
 * it with progress and restarts into it.
 *
 * The automatic check is silent: it only shows a dialog when there is a new
 * version the user has not skipped. Checking, «up to date» and errors are
 * shown only when the user asks (menu or Settings).
 */

import { check, type Update, type DownloadEvent } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

export type UpdaterState =
	| 'idle'
	| 'checking'
	| 'upToDate'
	| 'available'
	| 'downloading'
	| 'installing'
	| 'installed'
	| 'restartPending'
	| 'error';

export interface ReleaseNotes {
	version: string;
	date?: string;
	whatsNew: string[];
	bugFixes: string[];
}

/** While an update downloads, installs or waits to restart, a check does nothing. */
const BUSY_STATES: UpdaterState[] = ['downloading', 'installing', 'installed', 'restartPending'];

const DAY_MS = 24 * 60 * 60 * 1000;
const LAST_CHECKED_KEY = 'khi.updates.lastChecked';
const SKIPPED_VERSION_KEY = 'khi.updates.skippedVersion';

/** Compares dotted numeric versions: negative if a < b, 0 if equal, positive if a > b. */
export function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
	const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (diff !== 0) return diff;
	}
	return 0;
}

type RawNotes = { whats_new?: unknown; bug_fixes?: unknown };
type RawRelease = { version?: unknown; date?: unknown; notes?: Record<string, RawNotes> };

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** The notes of every release newer than `current`, newest first, in `lang`
 * (falling back to English), from the manifest's `khi_releases`. */
export function releasesSince(rawJson: Record<string, unknown>, current: string, lang: string): ReleaseNotes[] {
	const list = Array.isArray(rawJson.khi_releases) ? (rawJson.khi_releases as RawRelease[]) : [];
	return list
		.filter((r): r is RawRelease & { version: string } => typeof r?.version === 'string')
		.filter((r) => compareVersions(r.version, current) > 0)
		.sort((a, b) => compareVersions(b.version, a.version))
		.map((r) => {
			const notes = r.notes?.[lang] ?? r.notes?.en ?? {};
			return {
				version: r.version,
				date: typeof r.date === 'string' ? r.date : undefined,
				whatsNew: strings(notes.whats_new),
				bugFixes: strings(notes.bug_fixes)
			};
		});
}

function readStorage(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Storage unavailable: the app works, it just forgets
	}
}

class UpdaterStore {
	state = $state<UpdaterState>('idle');
	currentVersion = $state('');
	update = $state.raw<Update | null>(null);
	progress = $state<{ done: number; total: number | null }>({ done: 0, total: null });
	lastChecked = $state<Date | null>(null);
	/** What the `error` state is about: the check, or the download and install. */
	errorKind = $state<'check' | 'install'>('check');

	/** Bumped by every new action, so a cancelled one drops its late result. */
	private run = 0;
	private manual = false;

	constructor() {
		const saved = readStorage(LAST_CHECKED_KEY);
		const date = saved ? new Date(saved) : null;
		this.lastChecked = date && !isNaN(date.getTime()) ? date : null;
	}

	/** Shown in Settings; read once from the bundle. */
	async loadVersion() {
		try {
			this.currentVersion = await getVersion();
		} catch (error) {
			console.error('Failed to read the app version:', error);
		}
	}

	/** From the menu or Settings: every state is shown. */
	checkNow(): Promise<void> {
		return this.check(true);
	}

	/** On launch: at most once a day, silent unless there is a new version. */
	async checkOnLaunch(enabled: boolean, now: number = Date.now()): Promise<void> {
		if (!enabled) return;
		if (this.lastChecked && now - this.lastChecked.getTime() < DAY_MS) return;
		await this.check(false);
	}

	private async check(manual: boolean): Promise<void> {
		// An update on its way in (menu, Settings or launch): a new check would
		// drop it, as `run` cancels the download
		if (BUSY_STATES.includes(this.state)) return;
		const run = ++this.run;
		this.manual = manual;
		if (manual) this.state = 'checking';
		try {
			const update = await check();
			if (run !== this.run) {
				await update?.close();
				return;
			}
			this.markChecked();
			if (update && !manual && update.version === readStorage(SKIPPED_VERSION_KEY)) {
				await update.close();
				this.state = 'idle';
				return;
			}
			this.update = update;
			this.state = update ? 'available' : manual ? 'upToDate' : 'idle';
		} catch (error) {
			if (run !== this.run) return;
			console.error('Failed to check for updates:', error);
			this.errorKind = 'check';
			this.state = manual ? 'error' : 'idle';
		}
	}

	private markChecked() {
		this.lastChecked = new Date();
		writeStorage(LAST_CHECKED_KEY, this.lastChecked.toISOString());
	}

	/** «Install and Restart». Restarts at once unless `isBusy` says an export
	 * or Sync is running; then it waits for `restartWhenIdle`. */
	async install(isBusy: () => boolean): Promise<void> {
		const update = this.update;
		if (!update) return;
		const run = ++this.run;
		this.state = 'downloading';
		this.progress = { done: 0, total: null };
		try {
			await update.download((event: DownloadEvent) => {
				if (run !== this.run) return;
				if (event.event === 'Started') {
					this.progress = { done: 0, total: event.data.contentLength ?? null };
				} else if (event.event === 'Progress') {
					this.progress = { ...this.progress, done: this.progress.done + event.data.chunkLength };
				}
			});
			// The plugin cannot abort a download: a cancelled one is dropped here
			if (run !== this.run) return;
			this.state = 'installing';
			await update.install();
			if (isBusy()) {
				this.state = 'installed';
			} else {
				await relaunch();
			}
		} catch (error) {
			if (run !== this.run) return;
			console.error('Failed to install the update:', error);
			this.manual = true;
			this.errorKind = 'install';
			this.state = 'error';
		}
	}

	/** Called whenever the busy flag changes, after an update was installed. */
	async restartWhenIdle(busy: boolean) {
		if (busy || (this.state !== 'installed' && this.state !== 'restartPending')) return;
		await relaunch();
	}

	restartNow() {
		return relaunch();
	}

	/** «OK» on «installed»: hide the dialog, restart when the work ends. */
	dismissInstalled() {
		this.state = 'restartPending';
	}

	skip() {
		if (this.update) writeStorage(SKIPPED_VERSION_KEY, this.update.version);
		this.close();
	}

	/** «Later», «OK», «Cancel»: closes the dialog and drops any running step. */
	close() {
		this.run++;
		const update = this.update;
		this.update = null;
		this.state = 'idle';
		update?.close().catch(() => {});
	}

	/** «Try Again» after an error. */
	retry() {
		return this.check(this.manual);
	}
}

export const updater = new UpdaterStore();
