import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import DeleteBookDialog from './DeleteBookDialog.svelte';

const locale = (lang: 'pt' | 'en') =>
	JSON.parse(readFileSync(resolve(process.cwd(), `src/lib/i18n/locales/${lang}.json`), 'utf8'));

function setup(onConfirm: () => void | Promise<void> = () => {}) {
	const confirm = vi.fn(onConfirm);
	const onCancel = vi.fn();
	render(DeleteBookDialog, { onConfirm: confirm, onCancel });
	return { user: userEvent.setup(), confirm, onCancel };
}

const dialog = () => screen.getByRole('alertdialog');
const cancelButton = () => screen.getByRole('button', { name: 'Cancel' });
const deleteButton = () => screen.getByRole('button', { name: 'Delete' });
const cmdPeriod = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: '.', code: 'Period', metaKey: true });
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => document.body.replaceChildren());

describe('DeleteBookDialog · screen 9', () => {
	it('is_a_named_alert_dialog_with_its_description', async () => {
		setup();
		await screen.findByRole('alertdialog');
		expect(dialog()).toHaveAccessibleName('Delete this book?');
		expect(dialog()).toHaveAccessibleDescription(
			'All its highlights were removed from your Kobo. The book and its highlights will be permanently removed from the Library.'
		);
		expect(dialog()).toHaveAttribute('aria-modal', 'true');
	});

	it('focus_stays_on_the_window_not_on_a_button', async () => {
		// Q-E: at entry only a text field takes the focus; this window has none
		setup();
		await screen.findByRole('alertdialog');
		await waitFor(() => expect(document.activeElement).toBe(dialog()));
		await settle();
		expect(document.activeElement).toBe(dialog());
		expect(document.activeElement?.tagName).not.toBe('BUTTON');
	});

	it('delete_is_secondary_in_destructive_text_with_no_default_button', async () => {
		setup();
		await screen.findByRole('alertdialog');
		expect(deleteButton().className).toContain('text-destructive-text');
		expect(deleteButton().hasAttribute('data-dialog-default')).toBe(false);
		expect(dialog().querySelector('[data-dialog-default]')).toBeNull();
		expect(cancelButton().hasAttribute('data-dialog-default')).toBe(false);
	});

	it('return_does_not_delete', async () => {
		const { user, confirm, onCancel } = setup();
		await screen.findByRole('alertdialog');
		// On the window itself, where a default button would be pressed
		dialog().focus();
		await user.keyboard('{Enter}');
		await settle();
		expect(confirm).not.toHaveBeenCalled();
		expect(onCancel).not.toHaveBeenCalled();
		// On Cancelar, Return cancels
		cancelButton().focus();
		await user.keyboard('{Enter}');
		expect(confirm).not.toHaveBeenCalled();
		await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
	});

	it('esc_and_cmd_period_and_cancel_cancel', async () => {
		const { user, confirm, onCancel } = setup();
		await screen.findByRole('alertdialog');
		await user.keyboard('{Escape}');
		await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
		cmdPeriod();
		await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(2));
		await user.click(cancelButton());
		await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(3));
		expect(confirm).not.toHaveBeenCalled();
		// The page unmounts it: the window itself stays standing
		expect(dialog()).toBeInTheDocument();
	});

	it('delete_confirms_once_without_cancelling', async () => {
		const { user, confirm, onCancel } = setup();
		await screen.findByRole('alertdialog');
		await user.click(deleteButton());
		await settle();
		expect(confirm).toHaveBeenCalledTimes(1);
		expect(onCancel).not.toHaveBeenCalled();
		expect(dialog()).toBeInTheDocument();
	});

	it('delete_by_the_keyboard_confirms_once_without_cancelling', async () => {
		const { user, confirm, onCancel } = setup();
		await screen.findByRole('alertdialog');
		deleteButton().focus();
		await user.keyboard('{Enter}');
		await settle();
		expect(confirm).toHaveBeenCalledTimes(1);
		await user.keyboard(' ');
		await settle();
		expect(confirm).toHaveBeenCalledTimes(2);
		expect(onCancel).not.toHaveBeenCalled();
	});

	it('a_held_key_does_not_repeat_the_delete', async () => {
		const { confirm } = setup();
		await screen.findByRole('alertdialog');
		deleteButton().focus();
		fireEvent.keyDown(deleteButton(), { key: 'Enter', repeat: true });
		await settle();
		expect(confirm).not.toHaveBeenCalled();
		fireEvent.keyDown(deleteButton(), { key: 'Enter' });
		await settle();
		expect(confirm).toHaveBeenCalledTimes(1);
	});

	it('busy_answers_nothing_and_a_second_click_does_not_delete_twice', async () => {
		let finish!: () => void;
		const { user, confirm, onCancel } = setup(() => new Promise<void>((resolve) => (finish = resolve)));
		await screen.findByRole('alertdialog');
		await user.click(deleteButton());
		await user.click(deleteButton());
		await user.dblClick(deleteButton());
		expect(confirm).toHaveBeenCalledTimes(1);
		// Cancelar is off, and Esc and ⌘. leave the window standing
		expect(cancelButton()).toHaveAttribute('aria-disabled', 'true');
		await user.click(cancelButton());
		await user.keyboard('{Escape}');
		cmdPeriod();
		await settle();
		expect(onCancel).not.toHaveBeenCalled();
		expect(dialog()).toBeInTheDocument();
		// Answered: it answers again
		finish();
		await waitFor(() => expect(cancelButton()).not.toHaveAttribute('aria-disabled', 'true'));
		await user.click(cancelButton());
		await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
	});

	it('strings_are_in_both_locales', () => {
		expect(locale('pt').screens.bookDetails).toMatchObject({
			deleteBookTitle: 'Apagar este livro?',
			deleteBookBody: 'Todos os destaques foram removidos do Kobo. O livro e os destaques saem da Biblioteca de vez.',
			deleteBookConfirm: 'Apagar',
			cancel: 'Cancelar',
			deleteBookError: 'Não foi possível apagar o livro.'
		});
		expect(locale('en').screens.bookDetails).toMatchObject({
			deleteBookTitle: 'Delete this book?',
			deleteBookConfirm: 'Delete',
			cancel: 'Cancel',
			deleteBookError: 'Couldn’t delete the book.'
		});
	});
});
