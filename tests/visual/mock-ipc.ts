/**
 * A stand-in for the Tauri runtime, installed with `page.addInitScript` so it
 * exists before any app module runs. It provides the same internals the real
 * runtime injects (`window.__TAURI_INTERNALS__`, the event plugin internals)
 * and answers every IPC call the app makes with Rust's real return shapes.
 *
 * Every call is logged. A call nobody stubbed is logged as unknown and
 * rejected, and the test fails on it even if the app catches the rejection.
 *
 * `installTauriMock` is serialised into the page by Playwright: it must not
 * reference anything outside its own body.
 */
import type { AppSettings_Serialize, KoboDevice_Serialize, LibraryBook_Serialize, Reader_Serialize } from '../../src/lib/bindings';

export interface MockConfig {
	settings: AppSettings_Serialize;
	defaultSettings: AppSettings_Serialize;
	defaultExportPath: string;
	appVersion: string;
	readers: Reader_Serialize[];
	lastReader: number | null;
	/** What `scan_for_device` finds at startup. */
	deviceAtStartup: KoboDevice_Serialize | null;
	/** Kobo serial → Reader id (`reader_for_kobo`). */
	koboOwners: Record<string, number>;
	library: Record<number, LibraryBook_Serialize[]>;
	/** What `library_summary` answers; `lastSyncAt` only for a Kobo that is the Reader's, as Rust does. */
	summary: { newSince: string | null; lastSyncAt: string | null };
	/** What `plugin:updater|check` returns: `null` when up to date. */
	update: unknown;
	/** `check`: `plugin:updater|check` fails (state 6, «Sem ligação»). `install`: the download works and the install fails (state 7). */
	updateFailure?: 'check' | 'install';
	/** `export_library_books` is rejected with this, as Rust's `ExportFailure` is. */
	exportFailure?: unknown;
	/** The window this page runs in: `main`, or `settings` (the `/definicoes` route). */
	windowLabel: 'main' | 'settings';
}

export interface IpcCall {
	cmd: string;
	args: unknown;
	known: boolean;
}

export interface KhiMock {
	calls: IpcCall[];
	unknown: IpcCall[];
	pending: number;
	lastCallAt: number;
	listeners: Record<string, number[]>;
	emitted: string[];
	/** Commands whose calls are currently held: they never answer. */
	held: string[];
	emit(event: string, payload?: unknown): void;
	/** The next call of `cmd` is held: it is logged but never answers, and does not count as pending. */
	hold(cmd: string): void;
	/** Answers the held call of `cmd` as it would have been answered unheld (a Sync then reports its progress and its end). */
	release(cmd: string): void;
}

declare global {
	interface Window {
		__KHI_MOCK__: KhiMock;
	}
}

export function installTauriMock(config: MockConfig): void {
	const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

	const callbacks = new Map<number, (data: unknown) => unknown>();
	let nextCallback = 1;
	function transformCallback(callback?: (data: unknown) => unknown, once = false): number {
		const id = nextCallback++;
		callbacks.set(id, (data) => {
			if (once) callbacks.delete(id);
			return callback?.(data);
		});
		return id;
	}
	function unregisterCallback(id: number) {
		callbacks.delete(id);
	}
	function runCallback(id: number, data: unknown) {
		const callback = callbacks.get(id);
		if (callback) callback(data);
	}

	// event name → [eventId, callbackId]
	const listeners = new Map<string, Array<[number, number]>>();
	let nextEventId = 1;

	const mock: KhiMock = {
		calls: [],
		unknown: [],
		pending: 0,
		lastCallAt: 0,
		listeners: {},
		emitted: [],
		held: [],
		emit(event, payload = null) {
			for (const [eventId, callbackId] of listeners.get(event) ?? []) {
				runCallback(callbackId, { event, id: eventId, payload });
			}
		},
		hold(cmd) {
			toHold.add(cmd);
		},
		release(cmd) {
			const answer = releasers.get(cmd);
			if (!answer) throw new Error(`[visual mock] no held call of ${cmd} to release`);
			releasers.delete(cmd);
			mock.held = mock.held.filter((held) => held !== cmd);
			answer();
		}
	};
	const toHold = new Set<string>();
	const releasers = new Map<string, () => void>();
	const syncListenerView = () => {
		mock.listeners = Object.fromEntries([...listeners].map(([event, list]) => [event, list.map(([id]) => id)]));
	};

	let nextRid = 1;
	const UNKNOWN = Symbol('unknown');
	/** A call that answers with a rejection, as Rust's `Err` does. */
	const REJECT = Symbol('reject');
	const rejection = (reason: unknown) => ({ [REJECT]: reason });

	/** What `Update.download` listens to: a `Channel` whose messages come in order, `Started` then `Progress`. */
	const channelIndex = new Map<number, number>();
	function sendDownload(args: Record<string, any>, total: number, done: number) {
		const channel = args.onEvent as { id: number } | undefined;
		if (!channel) return;
		const send = (message: unknown) => {
			const index = channelIndex.get(channel.id) ?? 0;
			channelIndex.set(channel.id, index + 1);
			runCallback(channel.id, { index, message });
		};
		send({ event: 'Started', data: { contentLength: total } });
		send({ event: 'Progress', data: { chunkLength: done } });
	}
	type Args = Record<string, any>;

	function handle(cmd: string, args: Args): unknown {
		switch (cmd) {
			// Event plugin (tauri::event)
			case 'plugin:event|listen': {
				const eventId = nextEventId++;
				const list = listeners.get(args.event) ?? [];
				list.push([eventId, args.handler]);
				listeners.set(args.event, list);
				syncListenerView();
				return eventId;
			}
			case 'plugin:event|unlisten': {
				const list = listeners.get(args.event) ?? [];
				listeners.set(args.event, list.filter(([id]) => id !== args.eventId));
				syncListenerView();
				return null;
			}
			case 'plugin:event|emit':
				mock.emitted.push(args.event);
				mock.emit(args.event, args.payload);
				return null;

			// Core plugins used by @tauri-apps/api
			case 'plugin:app|version':
				return config.appVersion;
			case 'plugin:window|set_theme':
			case 'plugin:window|set_title':
			case 'plugin:window|set_size':
			case 'plugin:window|close':
			case 'plugin:window|destroy':
			case 'plugin:window|show':
			case 'plugin:window|set_focus':
			case 'plugin:window|unminimize':
				return null;
			case 'plugin:window|is_fullscreen':
				return false;
			case 'plugin:window|title':
				return 'Khi';
			case 'plugin:menu|new':
				return [nextRid++, args.options?.id ?? `mock-menu-${nextRid}`];
			case 'plugin:menu|set_as_app_menu':
			case 'plugin:menu|set_enabled':
				return null;
			case 'plugin:path|resolve_directory':
				// homeDir() (BaseDirectory.Home is 21); the rest is resolveResource
				if (args.directory === 21) return '/Users/leitor';
				return `/Applications/Khi.app/Contents/Resources/${args.path}`;
			case 'plugin:image|from_path':
				return nextRid++;
			case 'plugin:resources|close':
				return null;

			// tauri-plugin-updater and tauri-plugin-process
			case 'get_system_accent':
				// Multicolor, the macOS default: Sistema is the system blue tones, so the baselines keep the app's blue
				return { name: 'multicolor', light: '#007AFF', dark: '#007AFF' };
			case 'plugin:updater|check':
				if (config.updateFailure === 'check') return rejection('offline');
				return config.update ?? null;
			case 'plugin:updater|download':
				// The Figma's 6,9 MB, all of it; the resource of the downloaded bytes
				sendDownload(args, 6_900_000, 6_900_000);
				return nextRid++;
			case 'plugin:updater|install':
				return config.updateFailure === 'install' ? rejection('install failed') : null;
			case 'plugin:process|restart':
				return null;
			// tauri-plugin-opener: «Mostrar no Finder» (the call is logged; nothing opens)
			case 'plugin:opener|reveal_item_in_dir':
				return null;

			// Khi's own commands (src/lib/bindings.ts)
			case 'scan_for_device':
				return config.deviceAtStartup;
			case 'get_default_export_path':
				return config.defaultExportPath;
			case 'get_default_settings':
			case 'reset_settings':
				return config.defaultSettings;
			case 'validate_export_path':
				return true;
			case 'load_settings':
				return config.settings;
			case 'update_settings': {
				// As Rust: each leaf of the patch over the file, which it answers
				const file = config.settings as Record<string, any>;
				for (const [leaf, value] of Object.entries(args.patch ?? {})) {
					const parent = leaf in file.exportConfig ? file.exportConfig : leaf in file.uiPreferences ? file.uiPreferences : file;
					parent[leaf] = clone(value);
				}
				return config.settings;
			}
			case 'settings_reader':
				// Opened by the harness, not by the main window: Settings fall back to `last_reader`
				return null;
			case 'pick_export_folder':
				return null;
			case 'open_settings':
				return null;
			case 'traffic_lights_max_x':
				// 68 - the bar's px-4 = 52, the Figma's room for the traffic lights: the baselines stay as they are
				return 68;
			case 'clear_cover_cache':
				return null;
			case 'list_readers':
				return config.readers;
			case 'create_reader': {
				const reader = { id: config.readers.length + 1, name: args.name, exportPath: null };
				config.readers.push(reader);
				return reader;
			}
			case 'rename_reader':
			case 'associate_kobo':
			case 'delete_book':
			case 'mark_book_opened':
			case 'set_reader_export_path':
				return null;
			case 'reader_export_folder':
			case 'reader_default_export_folder': {
				// As Rust decides it: the Reader's own folder, else the base and the Reader's name
				const owner = config.readers.find((r) => r.id === args.readerId);
				const own = owner?.exportPath;
				return (cmd === 'reader_export_folder' && own) || `${config.defaultExportPath}/${owner?.name ?? ''}`;
			}
			case 'reader_for_kobo':
				return config.koboOwners[args.serial] ?? null;
			case 'last_reader':
				return config.lastReader;
			case 'library_summary': {
				const ownsKobo = args.koboSerial != null && config.koboOwners[args.koboSerial] === args.readerId;
				return { newSince: config.summary.newSince, lastSyncAt: ownsKobo ? config.summary.lastSyncAt : null };
			}
			case 'get_library':
				return config.library[args.readerId] ?? [];
			case 'export_library_books':
				if (config.exportFailure !== undefined) return rejection(config.exportFailure);
				return (args.bookIds as number[]).map((id) => `${config.defaultExportPath}/${id}.md`);
			case 'sync_kobo': {
				const readerId = config.koboOwners[args.device?.serialNumber] ?? null;
				const total = readerId === null ? 0 : (config.library[readerId] ?? []).length;
				const report = { added: 0, updated: 0, removed: 0, restored: 0, books: total };
				for (let done = 1; done <= total; done++) mock.emit('sync-progress', { done, total });
				if (readerId !== null) mock.emit('sync-finished', { readerId, report });
				return report;
			}
			default:
				return UNKNOWN;
		}
	}

	/** What a held call does before it stalls: a Sync reports some progress, as Rust does mid-way. */
	function startHeld(cmd: string, args: Args) {
		// A download that stalls half-way: the Figma's «4,3 MB de 6,9 MB»
		if (cmd === 'plugin:updater|download') sendDownload(args, 6_900_000, 4_300_000);
		if (cmd === 'sync_kobo') {
			const readerId = config.koboOwners[args.device?.serialNumber] ?? null;
			const total = readerId === null ? 0 : (config.library[readerId] ?? []).length;
			for (let done = 1; done <= Math.min(2, total); done++) mock.emit('sync-progress', { done, total });
		}
	}

	async function invoke(cmd: string, args: Args = {}): Promise<unknown> {
		// Real IPC serialises the arguments (a Channel becomes `__CHANNEL__:id`)
		const sent = clone(args) ?? {};
		if (toHold.delete(cmd)) {
			mock.calls.push({ cmd, args: sent, known: true });
			mock.lastCallAt = performance.now();
			mock.held.push(cmd);
			startHeld(cmd, args);
			// Never answers until a scenario releases it
			return new Promise((resolve) => {
				releasers.set(cmd, () => {
					mock.lastCallAt = performance.now();
					resolve(clone(handle(cmd, args)));
				});
			});
		}
		const result = handle(cmd, args);
		const call: IpcCall = { cmd, args: sent, known: result !== UNKNOWN };
		mock.calls.push(call);
		mock.lastCallAt = performance.now();
		mock.pending++;
		// Real IPC always answers asynchronously, after the current task
		await new Promise((resolve) => setTimeout(resolve, 0));
		mock.pending--;
		mock.lastCallAt = performance.now();
		if (result === UNKNOWN) {
			mock.unknown.push(call);
			throw `[visual mock] unknown IPC command: ${cmd}`;
		}
		if (result && typeof result === 'object' && REJECT in result) throw (result as { [REJECT]: unknown })[REJECT];
		return clone(result);
	}

	(window as any).isTauri = true;
	(window as any).__TAURI_INTERNALS__ = {
		invoke,
		transformCallback,
		unregisterCallback,
		runCallback,
		callbacks,
		convertFileSrc(filePath: string, protocol = 'asset') {
			return `${protocol}://localhost/${encodeURIComponent(filePath)}`;
		},
		metadata: {
			currentWindow: { label: config.windowLabel },
			currentWebview: { windowLabel: config.windowLabel, label: config.windowLabel }
		},
		plugins: { path: { sep: '/', delimiter: ':' } }
	};
	(window as any).__TAURI_EVENT_PLUGIN_INTERNALS__ = {
		unregisterListener(event: string, eventId: number) {
			const list = listeners.get(event) ?? [];
			const entry = list.find(([id]) => id === eventId);
			if (entry) unregisterCallback(entry[1]);
		}
	};
	window.__KHI_MOCK__ = mock;
}
