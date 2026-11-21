import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { library } from '$lib/stores/library.svelte';
import KoboPane from './KoboPane.svelte';
import { rustKeeps, openStores, ANA, BRUNO, type Rust } from './test-support';

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};

let rust: Rust;
const onerror = vi.fn();

async function show(readers = [BRUNO], activeReaderId: number | null = BRUNO.id) {
	rust = rustKeeps(readers);
	await openStores(rust, activeReaderId);
	const user = userEvent.setup();
	const view = render(KoboPane, { onerror });
	return { user, ...view };
}
const renames = () => rust.calls.filter((c) => c.cmd === 'rename_reader').map((c) => c.args);
const nameField = () => screen.getByTestId('reader-name') as HTMLInputElement;

async function openSelect(user: ReturnType<typeof userEvent.setup>, trigger: HTMLElement) {
	trigger.focus();
	await user.keyboard(' ');
	await screen.findByRole('listbox', { hidden: true });
}
const optionNamed = (text: string) =>
	screen.getAllByRole('option', { hidden: true }).find((option) => option.textContent?.trim() === text)!;

describe('KoboPane', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		library.readers = [];
		library.activeReaderId = null;
	});

	describe('one reader', () => {
		it('has «Reader name» and «Sync on connect» in one group with no heading', async () => {
			await show();

			expect(screen.queryByRole('heading')).toBeNull();
			expect(document.querySelectorAll('[data-slot="form-group"]')).toHaveLength(1);
			expect(screen.getByText('Reader name')).toBeInTheDocument();
			expect(screen.getByText('Shown in the title with two or more readers.')).toBeInTheDocument();
			expect(nameField()).toHaveValue('Bruno');
			expect(screen.getByText('Sync on connect')).toBeInTheDocument();
			expect(screen.getByText('Syncs when you connect a known Kobo.')).toBeInTheDocument();
			expect(screen.getByRole('switch', { name: 'Sync on connect' })).toBeChecked();
			expect(screen.queryByRole('combobox')).toBeNull();
		});

		it('the name field is 160 px wide, as in the Figma, so the help fits on one line', async () => {
			await show();

			expect(nameField()).toHaveClass('w-40');
			expect(nameField()).not.toHaveClass('w-55');
		});

		it('the switch is saved at the moment', async () => {
			const { user } = await show();

			await user.click(screen.getByRole('switch', { name: 'Sync on connect' }));

			await waitFor(() => expect(rust.patches).toEqual([{ syncOnConnect: false }]));
		});

		it('the switch after an error clears it', async () => {
			const { user } = await show();
			onerror('Error saving settings');
			onerror.mockClear();

			await user.click(screen.getByRole('switch', { name: 'Sync on connect' }));

			expect(onerror).toHaveBeenCalledWith(null);
		});
	});

	describe('two or more readers (M2)', () => {
		it('has «Reader» and «Name» in a first group, and the switch for all in a second', async () => {
			await show([BRUNO, ANA]);

			const groups = [...document.querySelectorAll('[data-slot="form-group"]')];
			expect(groups).toHaveLength(2);
			expect(screen.getByText('The reader whose name you want to change.')).toBeInTheDocument();
			expect(screen.getByRole('combobox', { name: 'Reader' })).toHaveTextContent('Bruno');
			expect(screen.getByText('Shown in the Library title.')).toBeInTheDocument();
			expect(screen.getByLabelText('Name')).toBe(nameField());
			expect(nameField()).toHaveValue('Bruno');
			expect(screen.queryByText('Reader name')).toBeNull();
			expect(groups[1]).toContainElement(screen.getByRole('switch', { name: 'Sync on connect' }));
			expect(screen.getByText('Applies to every reader: syncs when you connect a known Kobo.')).toBeInTheDocument();
		});

		it('opens on the reader the main window has open', async () => {
			await show([BRUNO, ANA], ANA.id);

			expect(screen.getByRole('combobox', { name: 'Reader' })).toHaveTextContent('Ana');
			expect(nameField()).toHaveValue('Ana');
		});

		it('the pop-up lists every reader and switches the name field to the one chosen', async () => {
			const { user } = await show([BRUNO, ANA]);

			await openSelect(user, screen.getByRole('combobox', { name: 'Reader' }));
			expect(screen.getAllByRole('option', { hidden: true }).map((o) => o.textContent?.trim())).toEqual(['Bruno', 'Ana']);
			await user.click(optionNamed('Ana'));

			await waitFor(() => expect(nameField()).toHaveValue('Ana'));
			expect(library.activeReaderId).toBe(ANA.id);
		});

		it('changing the pop-up with a name half-typed saves it first', async () => {
			const { user } = await show([BRUNO, ANA]);
			await user.clear(nameField());
			await user.type(nameField(), 'Bruno M.');

			await openSelect(user, screen.getByRole('combobox', { name: 'Reader' }));
			await user.click(optionNamed('Ana'));

			await waitFor(() => expect(library.activeReaderId).toBe(ANA.id));
			expect(renames()).toEqual([{ id: 1, name: 'Bruno M.' }]);
			expect(nameField()).toHaveValue('Ana');
			// The pop-up lists the new name
			expect(rust.readers[0].name).toBe('Bruno M.');
		});

		it('changing the pop-up with the name emptied drops it and saves nothing', async () => {
			const { user } = await show([BRUNO, ANA]);
			await user.clear(nameField());

			await openSelect(user, screen.getByRole('combobox', { name: 'Reader' }));
			await user.click(optionNamed('Ana'));

			await waitFor(() => expect(library.activeReaderId).toBe(ANA.id));
			expect(renames()).toEqual([]);
			expect(rust.readers[0].name).toBe('Bruno');
		});
	});

	describe('no readers', () => {
		it('has only the switch, with the help of one reader', async () => {
			await show([], null);

			expect(document.querySelectorAll('[data-slot="form-group"]')).toHaveLength(1);
			expect(screen.queryByTestId('reader-name')).toBeNull();
			expect(screen.queryByRole('combobox')).toBeNull();
			expect(screen.getByRole('switch', { name: 'Sync on connect' })).toBeInTheDocument();
			expect(screen.getByText('Syncs when you connect a known Kobo.')).toBeInTheDocument();
		});
	});

	describe('the name', () => {
		it('Return saves it', async () => {
			const { user } = await show();
			await user.clear(nameField());
			await user.type(nameField(), 'Bruno M.{Enter}');

			await waitFor(() => expect(renames()).toEqual([{ id: 1, name: 'Bruno M.' }]));
			await waitFor(() => expect(nameField()).toHaveValue('Bruno M.'));
		});

		it('leaving the field saves it', async () => {
			const { user } = await show();
			await user.clear(nameField());
			await user.type(nameField(), 'Bruno M.');
			expect(renames()).toEqual([]);

			await user.tab();

			await waitFor(() => expect(renames()).toEqual([{ id: 1, name: 'Bruno M.' }]));
		});

		it('Return and then leaving saves once', async () => {
			const { user } = await show();
			await user.clear(nameField());
			await user.type(nameField(), 'Bruno M.{Enter}');
			await user.tab();
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(renames()).toHaveLength(1);
		});

		it('is trimmed', async () => {
			const { user } = await show();
			await user.clear(nameField());
			await user.type(nameField(), '  Bruno M.  {Enter}');

			await waitFor(() => expect(renames()).toEqual([{ id: 1, name: 'Bruno M.' }]));
		});

		it('an empty name goes back to the saved one and saves nothing', async () => {
			const { user } = await show();
			await user.clear(nameField());
			await user.type(nameField(), '   {Enter}');

			await waitFor(() => expect(nameField()).toHaveValue('Bruno'));
			expect(renames()).toEqual([]);
		});

		it('a name that did not change saves nothing', async () => {
			const { user } = await show();
			await user.click(nameField());
			await user.tab();

			expect(renames()).toEqual([]);
		});

		it('Esc puts the saved name back, saves nothing, and does not reach the window', async () => {
			const { user } = await show();
			const reachedWindow = vi.fn();
			window.addEventListener('keydown', reachedWindow);
			await user.clear(nameField());
			await user.type(nameField(), 'Bruno M.');

			await user.keyboard('{Escape}');

			expect(nameField()).toHaveValue('Bruno');
			expect(reachedWindow).not.toHaveBeenCalledWith(expect.objectContaining({ key: 'Escape' }));
			// Leaving the field afterwards does not save what was put back
			await user.tab();
			expect(renames()).toEqual([]);
			window.removeEventListener('keydown', reachedWindow);
		});

		it('a failed rename shows a translated message, not the raw error', async () => {
			const { user } = await show();
			const { invoke } = await import('@tauri-apps/api/core');
			const answer = vi.mocked(invoke).getMockImplementation()!;
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) =>
				cmd === 'rename_reader' ? Promise.reject('Library database error: disk I/O error') : answer(cmd, args as never)
			);
			await user.clear(nameField());
			await user.type(nameField(), 'Bruno M.{Enter}');

			await waitFor(() => expect(onerror).toHaveBeenCalledWith('Couldn’t rename the reader'));
			expect(onerror).not.toHaveBeenCalledWith(expect.stringContaining('disk I/O'));
		});

		it('a name typed is kept when the list of readers reloads', async () => {
			const { user } = await show([BRUNO, ANA]);
			await user.clear(nameField());
			await user.type(nameField(), 'Bru');

			// The main window renamed Ana, say: readers-changed reloads the list
			rust.readers[1].name = 'Ana M.';
			await library.loadReaders();

			expect(nameField()).toHaveValue('Bru');
		});

		it('the field keeps its focus and its draft when a second reader turns the pane into M2', async () => {
			const { user } = await show([BRUNO]);
			await user.clear(nameField());
			await user.type(nameField(), 'Bru');
			const before = nameField();
			expect(before).toHaveFocus();

			// A second Kobo connects: readers-changed reloads the list with two readers
			rust.readers.push({ ...ANA });
			await library.loadReaders();
			await screen.findByRole('combobox', { name: 'Reader' });

			// The same element, not a new one in another group
			expect(nameField()).toBe(before);
			expect(nameField()).toHaveFocus();
			expect(nameField()).toHaveValue('Bru');
			expect(renames()).toEqual([]);
		});
	});

	describe('commitName', () => {
		it('saves a name half-typed, for the page to call before it follows another reader', async () => {
			const { user, component } = await show([BRUNO, ANA]);
			await user.clear(nameField());
			await user.type(nameField(), 'Bruno M.');

			await (component as { commitName(): Promise<void> }).commitName();

			expect(renames()).toEqual([{ id: 1, name: 'Bruno M.' }]);
		});
	});
});
