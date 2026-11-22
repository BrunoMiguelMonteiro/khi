import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import UnknownKoboDialog from './UnknownKoboDialog.svelte';

// jsdom has no pointer capture, which Bits UI's trigger releases on pointerdown.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};

const locale = (lang: 'pt' | 'en') =>
	JSON.parse(readFileSync(resolve(process.cwd(), `src/lib/i18n/locales/${lang}.json`), 'utf8'));

const readers = [
	{ id: 1, name: 'Bruno', exportPath: null },
	{ id: 2, name: 'Ana', exportPath: null },
	{ id: 3, name: 'Rui', exportPath: null }
];

type Props = {
	activeReaderId?: number | null;
	lastReaderId?: number | null;
	readers?: typeof readers;
	onCreate?: (name: string) => void | Promise<void>;
};

function setup(props: Props = {}) {
	const onChoose = vi.fn();
	const onCreate = vi.fn(props.onCreate);
	const onCancel = vi.fn();
	render(UnknownKoboDialog, {
		readers: props.readers ?? readers,
		activeReaderId: props.activeReaderId ?? null,
		lastReaderId: props.lastReaderId ?? null,
		onChoose,
		onCreate,
		onCancel
	});
	return { user: userEvent.setup(), onChoose, onCreate, onCancel };
}

const dialog = () => screen.getByRole('dialog');
const popup = () => screen.getByRole('combobox');
const nameField = () => screen.queryByRole('textbox', { name: 'Name' }) as HTMLInputElement | null;
// The floating list is `visibility: hidden` in jsdom until Floating UI measures it: queried with `hidden`
const listbox = () => screen.queryByRole('listbox', { hidden: true });
const principal = () => dialog().querySelector<HTMLElement>('[data-dialog-default]')!;

/** The pop-up opens with Space (jsdom has no pointer-events layout, and the modal window sets none on the page). */
async function openPopUp(user: ReturnType<typeof userEvent.setup>) {
	popup().focus();
	await user.keyboard(' ');
	await screen.findByRole('listbox', { hidden: true });
}

/** Opens the pop-up and picks an option by its name. */
async function pick(user: ReturnType<typeof userEvent.setup>, name: string) {
	await openPopUp(user);
	// By text: the hidden list has no computed accessible names yet
	const options = await screen.findAllByRole('option', { hidden: true });
	await user.click(options.find((option) => option.textContent?.trim() === name)!);
	await waitFor(() => expect(listbox()).toBeNull());
}

beforeEach(() => document.body.replaceChildren());

describe('UnknownKoboDialog · screen 6', () => {
	it('is_a_named_modal_dialog_with_its_description', async () => {
		setup();
		const el = await screen.findByRole('dialog', { name: 'Whose Kobo is this?' });
		expect(el.getAttribute('data-slot')).toBe('dialog-content');
		expect(el).toHaveAccessibleDescription('Highlights go to the Library of whoever you choose.');
		expect(screen.getByTestId('unknown-kobo-dialog')).toBe(el);
		// The old per-reader buttons and the hand-made scrim are gone
		expect(screen.queryByRole('button', { name: 'Ana' })).toBeNull();
		expect(document.querySelector('.bg-black\\/40')).toBeNull();
		expect(document.querySelector('[data-slot="dialog-overlay"]')).not.toBeNull();
	});

	it('texts_in_pt_and_en', () => {
		expect(locale('pt').readers).toMatchObject({
			unknownKoboTitle: 'De quem é este Kobo?',
			unknownKoboSubtitle: 'Os destaques ficam na Biblioteca de quem escolheres.',
			choose: 'Escolher',
			newReaderOption: 'Novo leitor…',
			name: 'Nome',
			create: 'Criar leitor'
		});
		expect(locale('en').readers).toMatchObject({
			unknownKoboTitle: 'Whose Kobo is this?',
			unknownKoboSubtitle: 'Highlights go to the Library of whoever you choose.',
			choose: 'Choose',
			newReaderOption: 'New reader…',
			name: 'Name',
			create: 'Create reader'
		});
		for (const lang of ['pt', 'en'] as const) {
			for (const gone of ['existing', 'newReader', 'newReaderName']) {
				expect(locale(lang).readers, `${lang} ${gone}`).not.toHaveProperty(gone);
			}
		}
	});

	it('has_a_pop_up_of_readers_then_a_separator_and_new_reader', async () => {
		const { user } = setup();
		await screen.findByRole('dialog');
		expect(screen.getByText('Reader')).toBeInTheDocument();
		await openPopUp(user);
		const options = (await screen.findAllByRole('option', { hidden: true })).map((o) => o.textContent?.trim());
		expect(options).toEqual(['Bruno', 'Ana', 'Rui', 'New reader…']);
		expect(document.querySelectorAll('[data-slot="select-separator"]')).toHaveLength(1);
	});

	it.each([
		['the open Library wins', { activeReaderId: 3, lastReaderId: 2 }, 'Rui'],
		['no Library open: the last Reader', { activeReaderId: null, lastReaderId: 2 }, 'Ana'],
		['neither: the first Reader', { activeReaderId: null, lastReaderId: null }, 'Bruno'],
		['an id that is not a Reader is skipped', { activeReaderId: 99, lastReaderId: 2 }, 'Ana']
	])('preselection (Q3): %s', async (_name, props, expected) => {
		setup(props);
		await screen.findByRole('dialog');
		expect(popup()).toHaveTextContent(expected);
	});

	it('focus_goes_to_the_window_not_to_the_pop_up', async () => {
		setup();
		await screen.findByRole('dialog');
		await waitFor(() => expect(document.activeElement).toBe(dialog()));
	});

	it('return_presses_choose_and_chooses_the_preselected_reader', async () => {
		const { user, onChoose } = setup({ activeReaderId: 2 });
		await screen.findByRole('dialog');
		await waitFor(() => expect(document.activeElement).toBe(dialog()));
		expect(principal()).toHaveTextContent('Choose');

		await user.keyboard('{Enter}');

		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onChoose).toHaveBeenCalledWith(2);
	});

	it('choose_button_chooses_the_picked_reader', async () => {
		const { user, onChoose } = setup({ activeReaderId: 2 });
		await screen.findByRole('dialog');
		await pick(user, 'Rui');

		await user.click(screen.getByRole('button', { name: 'Choose' }));

		expect(onChoose).toHaveBeenCalledWith(3);
	});

	it('return_and_escape_with_the_pop_up_open_act_only_on_the_pop_up', async () => {
		const { user, onChoose, onCancel } = setup({ activeReaderId: 1 });
		await screen.findByRole('dialog');
		await openPopUp(user);

		// Escape closes the pop-up, not the window
		await user.keyboard('{Escape}');
		await waitFor(() => expect(listbox()).toBeNull());
		expect(screen.queryByRole('dialog')).not.toBeNull();
		expect(onCancel).not.toHaveBeenCalled();

		// Return picks the highlighted option, and does not press Choose
		popup().focus();
		await user.keyboard('{ArrowDown}');
		await screen.findByRole('listbox', { hidden: true });
		await user.keyboard('{ArrowDown}{Enter}');
		await waitFor(() => expect(listbox()).toBeNull());
		expect(onChoose).not.toHaveBeenCalled();
		expect(onCancel).not.toHaveBeenCalled();
		expect(screen.queryByRole('dialog')).not.toBeNull();
	});

	it('new_reader_shows_an_empty_focused_name_and_create_reader', async () => {
		const { user } = setup({ activeReaderId: 1 });
		await screen.findByRole('dialog');
		expect(nameField()).toBeNull();

		await pick(user, 'New reader…');

		const field = await waitFor(() => {
			const el = nameField();
			expect(el).not.toBeNull();
			return el!;
		});
		// Empty (Q4), not the Kobo's name, and with the focus
		expect(field.value).toBe('');
		await waitFor(() => expect(document.activeElement).toBe(field));
		expect(principal()).toHaveTextContent('Create reader');
		expect(screen.queryByRole('button', { name: 'Choose' })).toBeNull();
	});

	it('create_reader_is_disabled_without_text_even_with_spaces', async () => {
		const { user, onCreate } = setup();
		await screen.findByRole('dialog');
		await pick(user, 'New reader…');
		expect(principal()).toHaveAttribute('aria-disabled', 'true');

		await user.type(nameField()!, '   ');
		expect(principal()).toHaveAttribute('aria-disabled', 'true');
		await user.click(principal());
		await user.keyboard('{Enter}');
		expect(onCreate).not.toHaveBeenCalled();

		await user.type(nameField()!, 'a');
		expect(principal()).not.toHaveAttribute('aria-disabled', 'true');
	});

	it('return_with_text_creates_the_reader_with_the_trimmed_name', async () => {
		const { user, onCreate, onChoose } = setup();
		await screen.findByRole('dialog');
		await pick(user, 'New reader…');
		await waitFor(() => expect(document.activeElement).toBe(nameField()));

		await user.keyboard('  Ana Sofia {Enter}');

		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(onCreate).toHaveBeenCalledWith('Ana Sofia');
		expect(onChoose).not.toHaveBeenCalled();
	});

	it('going_back_to_a_reader_hides_the_name_and_keeps_the_text', async () => {
		const { user } = setup();
		await screen.findByRole('dialog');
		await pick(user, 'New reader…');
		await user.type(nameField()!, 'Ana Sofia');

		await pick(user, 'Rui');
		expect(nameField()).toBeNull();
		expect(principal()).toHaveTextContent('Choose');

		await pick(user, 'New reader…');
		expect(nameField()!.value).toBe('Ana Sofia');
	});

	it('cancel_button_calls_oncancel', async () => {
		const { user, onCancel, onChoose } = setup();
		await screen.findByRole('dialog');

		await user.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onChoose).not.toHaveBeenCalled();
	});

	it('escape_calls_oncancel', async () => {
		const { user, onCancel } = setup();
		await screen.findByRole('dialog');
		await waitFor(() => expect(document.activeElement).toBe(dialog()));

		await user.keyboard('{Escape}');

		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('command_period_calls_oncancel', async () => {
		const { user, onCancel } = setup();
		await screen.findByRole('dialog');
		await waitFor(() => expect(document.activeElement).toBe(dialog()));

		await user.keyboard('{Meta>}.{/Meta}');

		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	it('return_after_picking_a_reader_presses_choose', async () => {
		const { user, onChoose } = setup({ activeReaderId: 1 });
		await screen.findByRole('dialog');
		await pick(user, 'Rui');
		// Bits UI gave the focus back to the pop-up's trigger: the window takes it, so Return is Choose's
		await waitFor(() => expect(document.activeElement).toBe(dialog()));

		await user.keyboard('{Enter}');

		expect(onChoose).toHaveBeenCalledTimes(1);
		expect(onChoose).toHaveBeenCalledWith(3);
	});

	it('return_after_closing_the_pop_up_with_escape_presses_choose', async () => {
		const { user, onChoose, onCancel } = setup({ activeReaderId: 2 });
		await screen.findByRole('dialog');
		await openPopUp(user);
		await user.keyboard('{Escape}');
		await waitFor(() => expect(listbox()).toBeNull());
		await waitFor(() => expect(document.activeElement).toBe(dialog()));

		await user.keyboard('{Enter}');

		expect(onCancel).not.toHaveBeenCalled();
		expect(onChoose).toHaveBeenCalledWith(2);
	});

	it('double_click_on_create_reader_creates_once', async () => {
		const { user, onCreate } = setup({ onCreate: () => new Promise<void>(() => {}) });
		await screen.findByRole('dialog');
		await pick(user, 'New reader…');
		await user.type(nameField()!, 'Marta');

		await user.dblClick(principal());

		expect(onCreate).toHaveBeenCalledTimes(1);
	});

	it('cancel_escape_and_command_period_are_refused_while_the_reader_is_being_created', async () => {
		let finish!: () => void;
		const { user, onCancel, onCreate } = setup({ onCreate: () => new Promise<void>((resolve) => (finish = resolve)) });
		await screen.findByRole('dialog');
		await pick(user, 'New reader…');
		await user.type(nameField()!, 'Marta{Enter}');
		expect(onCreate).toHaveBeenCalledTimes(1);

		expect(principal()).toHaveAttribute('aria-disabled', 'true');
		await user.click(screen.getByRole('button', { name: 'Cancel' }));
		await user.keyboard('{Escape}');
		await user.keyboard('{Meta>}.{/Meta}');
		await new Promise((resolve) => setTimeout(resolve, 50));

		expect(onCancel).not.toHaveBeenCalled();
		expect(screen.queryByRole('dialog')).not.toBeNull();

		// A failed create gives the window back
		finish();
		await waitFor(() => expect(principal()).not.toHaveAttribute('aria-disabled', 'true'));
	});

	it('labels_are_right_aligned_against_their_control', async () => {
		const { user } = setup();
		await screen.findByRole('dialog');
		await pick(user, 'New reader…');
		// Figma 58:6794 / 62:2147: the 56 px label hugs the control, as a macOS form
		for (const name of ['Reader', 'Name']) {
			const label = within(dialog()).getByText(name);
			expect(label.closest('[data-slot="form-row"]')!.className, name).toContain('text-right');
		}
	});
});
