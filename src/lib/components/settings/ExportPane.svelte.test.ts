import { describe, it, expect, vi, beforeEach } from 'vitest';

/** What homeDir() answers (the package calls its own copy of invoke, which the invoke mock does not reach). */
const homeDirAnswer = vi.hoisted(() => ({ value: null as string | null }));
vi.mock('@tauri-apps/api/path', () => ({
	homeDir: () => (homeDirAnswer.value === null ? Promise.reject('no home') : Promise.resolve(homeDirAnswer.value))
}));

import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'svelte';
import { library } from '$lib/stores/library.svelte';
import { settings } from '$lib/stores/settings.svelte';
import ExportPane from './ExportPane.svelte';
import { rustKeeps, openStores, type Rust } from './test-support';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

/** The pop-up opens with Space, as in select.test.ts (jsdom has no pointer capture for a click). */
async function openSelect(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
	trigger.focus();
	await user.keyboard(' ');
	await screen.findByRole('listbox', { hidden: true });
}

/** The option of the open list with this text (Bits UI's options are `aria-hidden` while the page is inert). */
const optionNamed = (text: string) =>
	screen.getAllByRole('option', { hidden: true }).find((option) => option.textContent?.trim() === text)!;

let rust: Rust;
const onerror = vi.fn();

async function show(activeReaderId: number | null = 1) {
	homeDirAnswer.value = rust.home;
	await openStores(rust, activeReaderId);
	const user = userEvent.setup();
	render(ExportPane, { onerror });
	return user;
}
const updates = () => rust.patches;

describe('ExportPane', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		rust = rustKeeps();
		library.readers = [];
		library.activeReaderId = null;
	});

	it('has the two groups of the Figma, and no Save, Cancel or Reset', async () => {
		await show();

		expect(screen.getByRole('heading', { name: 'Files' })).toBeInTheDocument();
		expect(screen.getByRole('heading', { name: 'Metadata to Include' })).toBeInTheDocument();
		expect(screen.getByText('Export folder')).toBeInTheDocument();
		expect(screen.getByText('Date Format')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /save|cancel|reset/i })).toBeNull();
		expect(screen.queryByText(/library view/i)).toBeNull();
	});

	it('help_says_where_the_books_go: the Reader\'s folder, with their name', async () => {
		await show();
		expect(
			await screen.findByText("~/Documents/Kobo Highlights/Bruno · Bruno’s books are exported here.")
		).toBeInTheDocument();
	});

	it('help_with_a_folder_chosen_for_the_Reader', async () => {
		rust.readers[0].exportPath = '/Volumes/Notes';
		await show();
		expect(screen.getByText("/Volumes/Notes · Bruno’s books are exported here.")).toBeInTheDocument();
	});

	it('help_without_a_Reader: the base folder', async () => {
		await show(null);
		expect(await screen.findByText('~/Documents/Kobo Highlights · Books are exported here.')).toBeInTheDocument();
	});

	it('the metadata boxes are three columns of two', async () => {
		await show();
		const row = screen.getByRole('group', { name: 'Metadata to Include' });
		const columns = [...row.querySelectorAll('[data-slot="form-row-column"]')];

		const names = columns.map((c) => [...c.querySelectorAll('label')].map((l) => l.textContent?.trim()));
		expect(names).toEqual([
			['Author', 'Last Read Date'],
			['ISBN', 'Language'],
			['Publisher', 'Description']
		]);
		expect(screen.getByRole('checkbox', { name: 'Author' })).toBeChecked();
		expect(screen.getByRole('checkbox', { name: 'Description' })).not.toBeChecked();
	});

	it('a box is saved at the moment, with the whole group of metadata', async () => {
		const user = await show();

		await user.click(screen.getByRole('checkbox', { name: 'Description' }));

		await waitFor(() => expect(updates()).toHaveLength(1));
		expect(updates()[0]).toEqual({
			metadata: { author: true, isbn: true, publisher: true, dateLastRead: true, language: true, description: true }
		});
		expect(rust.file.exportConfig.metadata.description).toBe(true);
	});

	it('two_quick_clicks_on_the_boxes_lose_neither', async () => {
		rust.held = [];
		const user = await show();

		// The second box is ticked before Rust has answered the first
		await user.click(screen.getByRole('checkbox', { name: 'Author' }));
		await user.click(screen.getByRole('checkbox', { name: 'ISBN' }));
		rust.release();

		await waitFor(() => expect(updates()).toHaveLength(2));
		expect(updates()[1].metadata).toMatchObject({ author: false, isbn: false });
		expect(settings.exportConfig.metadata).toMatchObject({ author: false, isbn: false });
		expect(rust.file.exportConfig.metadata).toMatchObject({ author: false, isbn: false });
	});

	it('the date format is a pop-up, saved at the moment', async () => {
		const user = await show();
		const trigger = screen.getByRole('combobox', { name: 'Date Format' });
		expect(trigger).toHaveTextContent('ISO 8601 (2025-01-24)');

		await openSelect(user, trigger);
		await user.click(optionNamed('DD/MM/YYYY (24/01/2025)'));

		await waitFor(() => expect(updates()).toEqual([{ dateFormat: 'dd_mm_yyyy' }]));
	});

	it('«Choose…» with a Reader open sets that Reader\'s folder, at once', async () => {
		rust.picked = '/Volumes/Notes';
		const user = await show();

		await user.click(screen.getByRole('button', { name: 'Choose…' }));

		await waitFor(() =>
			expect(rust.calls).toContainEqual({ cmd: 'set_reader_export_path', args: { readerId: 1, path: '/Volumes/Notes' } })
		);
		// Not the base folder
		expect(updates()).toEqual([]);
		// And the help follows
		expect(await screen.findByText("/Volumes/Notes · Bruno’s books are exported here.")).toBeInTheDocument();
		// The dialog opened on the folder in use
		expect(rust.calls).toContainEqual({ cmd: 'pick_export_folder', args: { defaultPath: '/Users/test/Documents/Kobo Highlights/Bruno' } });
	});

	it('the help shows the home folder as «~», and the stored value stays absolute', async () => {
		rust.readers[0].exportPath = '/Users/test2/Notes';
		await show();

		// A path inside the home is abbreviated; one that only starts like it is not
		expect(await screen.findByText("/Users/test2/Notes · Bruno’s books are exported here.")).toBeInTheDocument();
	});

	it('without a home folder the help shows the full path', async () => {
		rust.home = null;
		await show();

		expect(
			await screen.findByText("/Users/test/Documents/Kobo Highlights/Bruno · Bruno’s books are exported here.")
		).toBeInTheDocument();
	});

	it('the folder is the one the export writes to: the safe name, and no doubled slash', async () => {
		rust.readers[0].name = 'Kobo: Libra';
		rust.file.exportConfig.exportPath = '/Users/test/Kobo/';
		rust.picked = '/Users/test/Kobo/Kobo- Libra';
		const user = await show();

		expect(
			await screen.findByText("~/Kobo/Kobo- Libra · Kobo: Libra’s books are exported here.")
		).toBeInTheDocument();

		// The folder picked is the default one, so it is stored as «follow the name»
		await user.click(screen.getByRole('button', { name: 'Choose…' }));
		await waitFor(() =>
			expect(rust.calls).toContainEqual({ cmd: 'set_reader_export_path', args: { readerId: 1, path: null } })
		);
		expect(rust.calls).toContainEqual({ cmd: 'pick_export_folder', args: { defaultPath: '/Users/test/Kobo/Kobo- Libra' } });
	});

	it('the default folder chosen for a Reader is stored as null, so it follows the name', async () => {
		rust.readers[0].exportPath = '/Volumes/Notes';
		rust.picked = '/Users/test/Documents/Kobo Highlights/Bruno';
		const user = await show();

		await user.click(screen.getByRole('button', { name: 'Choose…' }));

		await waitFor(() =>
			expect(rust.calls).toContainEqual({ cmd: 'set_reader_export_path', args: { readerId: 1, path: null } })
		);
	});

	it('«Choose…» without a Reader sets the base folder, at once', async () => {
		rust.picked = '/Volumes/Notes';
		const user = await show(null);

		await user.click(screen.getByRole('button', { name: 'Choose…' }));

		await waitFor(() => expect(updates()).toEqual([{ exportPath: '/Volumes/Notes' }]));
		expect(rust.calls.some((c) => c.cmd === 'set_reader_export_path')).toBe(false);
	});

	it('cancelling the dialog changes nothing', async () => {
		rust.picked = null;
		const user = await show();

		await user.click(screen.getByRole('button', { name: 'Choose…' }));
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(updates()).toEqual([]);
		expect(rust.calls.some((c) => c.cmd === 'set_reader_export_path')).toBe(false);
	});

	it('a write Rust refuses is reported, not swallowed', async () => {
		const user = await show();
		const real = (await import('@tauri-apps/api/core')).invoke;
		const answer = vi.mocked(real).getMockImplementation()!;
		vi.mocked(real).mockImplementation((cmd: string, args?: unknown) =>
			cmd === 'update_settings' ? Promise.reject('disk full') : answer(cmd, args as never)
		);

		await user.click(screen.getByRole('checkbox', { name: 'Author' }));

		await waitFor(() => expect(onerror).toHaveBeenCalledWith('Error saving settings'));
		// And the box is back
		await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Author' })).toBeChecked());
		flushSync();
	});
});
