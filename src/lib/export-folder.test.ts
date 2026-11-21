import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }));
import { invoke } from '@tauri-apps/api/core';
import { library } from '$lib/stores/library.svelte';
import { settings } from '$lib/stores/settings.svelte';
import { chooseExportFolder } from './export-folder';

/** What Rust answers: the folder the picker returns (null: cancelled) and the Reader's default folder. */
function rust(picked: string | null, defaultFolder = '/Users/leitor/Documents/Kobo/Bruno') {
	vi.mocked(invoke).mockImplementation((cmd: string) => {
		if (cmd === 'pick_export_folder') return Promise.resolve(picked);
		if (cmd === 'reader_default_export_folder') return Promise.resolve(defaultFolder);
		if (cmd === 'set_reader_export_path') return Promise.resolve(null);
		return Promise.resolve(null);
	});
}
const calls = (cmd: string) => vi.mocked(invoke).mock.calls.filter(([c]) => c === cmd);

describe('chooseExportFolder', () => {
	beforeEach(() => {
		vi.mocked(invoke).mockReset();
		library.readers = [{ id: 1, name: 'Bruno', exportPath: null }];
		library.activeReaderId = 1;
	});

	it('opens_the_picker_at_the_current_folder_and_saves_the_choice_on_the_reader', async () => {
		rust('/Volumes/Livros');

		expect(await chooseExportFolder('/Users/leitor/Documents/Kobo/Bruno', 1)).toBe(true);

		expect(invoke).toHaveBeenCalledWith('pick_export_folder', { defaultPath: '/Users/leitor/Documents/Kobo/Bruno' });
		expect(invoke).toHaveBeenCalledWith('set_reader_export_path', { readerId: 1, path: '/Volumes/Livros' });
	});

	it('the_readers_default_folder_is_stored_as_null', async () => {
		rust('/Users/leitor/Documents/Kobo/Bruno');

		expect(await chooseExportFolder('/x', 1)).toBe(true);

		expect(invoke).toHaveBeenCalledWith('set_reader_export_path', { readerId: 1, path: null });
	});

	it('cancelling_the_picker_saves_nothing', async () => {
		rust(null);

		expect(await chooseExportFolder('/x', 1)).toBe(false);

		expect(calls('set_reader_export_path')).toHaveLength(0);
		expect(calls('reader_default_export_folder')).toHaveLength(0);
	});

	it('without_a_reader_the_base_folder_is_saved_in_the_settings', async () => {
		rust('/Volumes/Livros');
		const setExportPath = vi.spyOn(settings, 'setExportPath').mockImplementation(() => {});
		const commit = vi.spyOn(settings, 'commit').mockResolvedValue(undefined as never);

		expect(await chooseExportFolder('/x', null)).toBe(true);

		expect(setExportPath).toHaveBeenCalledWith('/Volumes/Livros');
		expect(commit).toHaveBeenCalledWith(['exportConfig.exportPath']);
		expect(calls('set_reader_export_path')).toHaveLength(0);
		setExportPath.mockRestore();
		commit.mockRestore();
	});

	it('a_failed_save_is_thrown_so_the_caller_says_so', async () => {
		vi.mocked(invoke).mockImplementation((cmd: string) =>
			cmd === 'pick_export_folder'
				? Promise.resolve('/Volumes/Livros')
				: cmd === 'reader_default_export_folder'
					? Promise.resolve('/d')
					: Promise.reject('disk')
		);

		await expect(chooseExportFolder('/x', 1)).rejects.toBe('disk');
	});
});
