import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'svelte';
import { library } from '$lib/stores/library.svelte';
import { settings } from '$lib/stores/settings.svelte';
import AppearanceHarness from './AppearancePane.harness.svelte';
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

async function show() {
	await openStores(rust);
	const user = userEvent.setup();
	render(AppearanceHarness, { onerror });
	return user;
}

describe('AppearancePane', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		rust = rustKeeps();
		library.readers = [];
		library.activeReaderId = null;
	});

	it('has one group without a heading, with the three rows of the Figma and their help', async () => {
		await show();

		expect(screen.queryByRole('heading')).toBeNull();
		expect(screen.getByText('Theme')).toBeInTheDocument();
		expect(screen.getByText('Accent color')).toBeInTheDocument();
		expect(screen.getByText('“System” uses the accent color you chose in macOS.')).toBeInTheDocument();
		expect(screen.getByText('Language')).toBeInTheDocument();
		expect(screen.getByText('Also used in the exported Markdown.')).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: /save|cancel|reset/i })).toBeNull();
		expect(screen.queryByText(/library view/i)).toBeNull();
	});

	it('the theme is a pop-up of System, Light and Dark, saved at the moment', async () => {
		const user = await show();
		const trigger = screen.getByRole('combobox', { name: 'Theme' });
		expect(trigger).toHaveTextContent('Light');

		await openSelect(user, trigger);
		expect((await screen.findAllByRole('option', { hidden: true })).map((o) => o.textContent?.trim())).toEqual(['System', 'Light', 'Dark']);
		await user.click(optionNamed('Dark'));

		await waitFor(() => expect(rust.patches).toEqual([{ theme: 'dark' }]));
		// The window follows at once
		flushSync();
		expect(document.documentElement).toHaveClass('dark');
	});

	it('the accent is Sistema and the seven swatches, saved at the moment', async () => {
		const user = await show();
		const group = screen.getByRole('radiogroup', { name: 'Accent color' });
		expect(group.querySelectorAll('[role="radio"]')).toHaveLength(8);
		expect(screen.getByRole('radio', { name: 'System' })).toBeChecked();

		await user.click(screen.getByRole('radio', { name: 'Turquoise' }));

		await waitFor(() => expect(rust.patches).toEqual([{ accentColor: 'turquesa' }]));
		expect(screen.getByRole('radio', { name: 'Turquoise' })).toBeChecked();
		expect(settings.uiPreferences.accentColor).toBe('turquesa');
	});

	it('the language is a pop-up with each language in its own, saved at the moment', async () => {
		const user = await show();
		const trigger = screen.getByRole('combobox', { name: 'Language' });
		expect(trigger).toHaveTextContent('English');

		await openSelect(user, trigger);
		expect((await screen.findAllByRole('option', { hidden: true })).map((o) => o.textContent?.trim())).toEqual(['English', 'Español', 'Français', 'Português']);
		await user.click(optionNamed('Português'));

		await waitFor(() => expect(rust.patches).toEqual([{ language: 'pt' }]));
		expect(settings.language).toBe('pt');
	});

	it('two choices in a row are both written', async () => {
		rust.held = [];
		const user = await show();

		await user.click(screen.getByRole('radio', { name: 'Pink' }));
		await user.click(screen.getByRole('radio', { name: 'Violet' }));
		rust.release();

		await waitFor(() => expect(rust.patches).toHaveLength(2));
		expect(rust.file.uiPreferences.accentColor).toBe('violeta');
		expect(settings.uiPreferences.accentColor).toBe('violeta');
	});

	it('a write Rust refuses puts the choice back and is reported', async () => {
		const user = await show();
		const { invoke } = await import('@tauri-apps/api/core');
		const answer = vi.mocked(invoke).getMockImplementation()!;
		vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) =>
			cmd === 'update_settings' ? Promise.reject('disk full') : answer(cmd, args as never)
		);

		await user.click(screen.getByRole('radio', { name: 'Orange' }));

		await waitFor(() => expect(onerror).toHaveBeenCalledWith('Error saving settings'));
		await waitFor(() => expect(screen.getByRole('radio', { name: 'System' })).toBeChecked());
	});

	it('a new choice after a failed write clears the error', async () => {
		const user = await show();
		const { invoke } = await import('@tauri-apps/api/core');
		const answer = vi.mocked(invoke).getMockImplementation()!;
		let refuse = true;
		vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) =>
			cmd === 'update_settings' && refuse ? Promise.reject('disk full') : answer(cmd, args as never)
		);
		await user.click(screen.getByRole('radio', { name: 'Orange' }));
		await waitFor(() => expect(onerror).toHaveBeenCalledWith('Error saving settings'));
		onerror.mockClear();

		refuse = false;
		await user.click(screen.getByRole('radio', { name: 'Violet' }));

		expect(onerror).toHaveBeenCalledWith(null);
	});
});
