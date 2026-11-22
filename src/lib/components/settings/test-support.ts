/** What the Settings pane tests share: settings.json as Rust keeps it, and the Readers. */
import { vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { flushSync } from 'svelte';
import { library } from '$lib/stores/library.svelte';
import { settings } from '$lib/stores/settings.svelte';

export const BRUNO = { id: 1, name: 'Bruno', exportPath: null as string | null };
export const ANA = { id: 2, name: 'Ana', exportPath: null as string | null };

export function onDisk() {
	return {
		exportConfig: {
			exportPath: '/Users/test/Documents/Kobo Highlights',
			metadata: { author: true, isbn: true, publisher: true, dateLastRead: true, language: true, description: false },
			dateFormat: 'iso8601'
		},
		uiPreferences: {
			theme: 'light',
			windowWidth: 1200,
			windowHeight: 800,
			isMaximized: false,
			showOnboarding: true,
			libraryViewMode: 'grid',
			librarySort: 'title',
			librarySortReversed: false,
			syncOnConnect: true,
			checkForUpdates: true,
			settingsPane: 'export',
			accentColor: 'system'
		},
		language: 'en',
		version: '1.3.0'
	};
}

export type Rust = {
	file: ReturnType<typeof onDisk>;
	readers: { id: number; name: string; exportPath: string | null }[];
	/** The folder `pick_export_folder` answers; null is «cancelled». */
	picked: string | null;
	/** What `homeDir()` answers; null when there is none. */
	home: string | null;
	/** Holds every `update_settings` until `release()`, in the order they came. */
	held: (() => void)[] | null;
	/** `update_settings` calls, in order. */
	patches: Record<string, unknown>[];
	calls: { cmd: string; args: unknown }[];
	release(): void;
};

/** Mocks the commands the panes use, over `rust.file` and `rust.readers`. */
export function rustKeeps(readers = [BRUNO]): Rust {
	const rust: Rust = {
		file: onDisk(),
		readers: structuredClone(readers),
		picked: null,
		home: '/Users/test',
		held: null,
		patches: [],
		calls: [],
		release() {
			const held = rust.held ?? [];
			rust.held = null;
			held.forEach((answer) => answer());
		}
	};
	vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
		rust.calls.push({ cmd, args });
		const a = args as Record<string, any> | undefined;
		switch (cmd) {
			case 'load_settings':
				return Promise.resolve(structuredClone(rust.file));
			case 'update_settings': {
				rust.patches.push(structuredClone(a!.patch));
				for (const [leaf, value] of Object.entries(a!.patch as Record<string, unknown>)) {
					const parent: Record<string, unknown> =
						leaf in rust.file.exportConfig ? rust.file.exportConfig : leaf in rust.file.uiPreferences ? rust.file.uiPreferences : (rust.file as never);
					parent[leaf] = structuredClone(value);
				}
				const answer = structuredClone(rust.file);
				if (!rust.held) return Promise.resolve(answer);
				return new Promise((resolve) => rust.held!.push(() => resolve(answer)));
			}
			case 'pick_export_folder':
				return Promise.resolve(rust.picked);
			case 'list_readers':
				return Promise.resolve(structuredClone(rust.readers));
			case 'rename_reader': {
				const reader = rust.readers.find((r) => r.id === a!.id);
				if (reader) reader.name = a!.name;
				return Promise.resolve(null);
			}
			case 'reader_default_export_folder': {
				const reader = rust.readers.find((r) => r.id === a!.readerId);
				if (!reader) return Promise.reject('Not found');
				const safe = reader.name.replace(/[/:]/g, '-').trim() || 'Leitor';
				return Promise.resolve(`${rust.file.exportConfig.exportPath.replace(/\/$/, '')}/${safe}`);
			}
			case 'reader_export_folder': {
				// As Rust decides it: the Reader's own folder, else base/<name with `/` and `:` as `-`>
				const reader = rust.readers.find((r) => r.id === a!.readerId);
				if (!reader) return Promise.reject('Not found');
				const safe = reader.name.replace(/[/:]/g, '-').trim() || 'Leitor';
				const base = rust.file.exportConfig.exportPath.replace(/\/$/, '');
				return Promise.resolve(reader.exportPath ?? `${base}/${safe}`);
			}
			case 'set_reader_export_path': {
				const reader = rust.readers.find((r) => r.id === a!.readerId);
				if (reader) reader.exportPath = a!.path;
				return Promise.resolve(null);
			}
			default:
				return Promise.resolve(null);
		}
	});
	return rust;
}

/** The store as the layout leaves it: settings loaded, the Readers read, one of them open. */
export async function openStores(rust: Rust, activeReaderId: number | null = BRUNO.id) {
	await settings.load();
	await library.loadReaders();
	library.activeReaderId = activeReaderId;
	flushSync();
}
