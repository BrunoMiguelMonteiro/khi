import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';

/** Calls of the window, in order: the height has to come before the window shows. */
const calls = vi.hoisted(() => [] as string[]);

/** The page's handler for a close from the red button or ⌘W. */
const closing = vi.hoisted(() => ({ handler: null as ((event: { preventDefault(): void }) => unknown) | null }));

const appWindow = vi.hoisted(() => ({
	label: 'settings',
	close: vi.fn(() => Promise.resolve()),
	destroy: vi.fn(() => Promise.resolve()),
	onCloseRequested: vi.fn((handler: (event: { preventDefault(): void }) => unknown) => {
		closing.handler = handler;
		return Promise.resolve(() => {});
	}),
	setTitle: vi.fn((_title: string) => Promise.resolve()),
	setTheme: vi.fn(() => Promise.resolve()),
	setSize: vi.fn((_size: { width: number; height: number }) => Promise.resolve()),
	show: vi.fn(() => Promise.resolve())
}));

const handlers = vi.hoisted(() => new Map<string, (event: { payload: unknown }) => void>());

vi.mock('@tauri-apps/api/window', () => ({ getCurrentWindow: () => appWindow }));
vi.mock('@tauri-apps/api/event', () => ({
	emit: vi.fn(() => Promise.resolve()),
	listen: vi.fn((event: string, handler: (event: { payload: unknown }) => void) => {
		handlers.set(event, handler);
		return Promise.resolve(() => {});
	})
}));
// The real translations: the window title has to follow a language change
vi.mock('$lib/i18n', async () => await vi.importActual('$lib/i18n'));

import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import userEvent from '@testing-library/user-event';
import { flushSync } from 'svelte';
import { locale } from '$lib/i18n';
import { library } from '$lib/stores/library.svelte';
import { settings } from '$lib/stores/settings.svelte';
import { updater } from '$lib/stores/updater.svelte';
import Page from './+page.svelte';

// Bits UI's Select and Tabs call these; jsdom has none
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.scrollIntoView ??= () => {};

/** The window's height per pane, as the page would measure it (the Figma's, Task 45). */
const HEIGHTS: Record<string, number> = { export: 382, appearance: 287, kobo: 243, updates: 243, agents: 414 };

/** jsdom has no layout: the frame's height is the active pane's, and the observer is driven by hand. */
const observers = new Set<() => void>();
class FakeResizeObserver {
	constructor(private callback: () => void) {}
	observe() {
		observers.add(this.callback);
	}
	unobserve() {}
	disconnect() {
		observers.delete(this.callback);
	}
}
function activePane(): string {
	return document.querySelector('[role="tab"][data-state="active"]')?.getAttribute('data-value') ?? 'kobo';
}
/** The content changed size: what a ResizeObserver reports after layout. */
const resized = () => observers.forEach((callback) => callback());

const reader = { id: 1, name: 'Bruno', exportPath: null as string | null };
const other = { id: 2, name: 'Ana', exportPath: null as string | null };
/** The Readers Rust has: a new Kobo adds one. */
let readers = [reader];

/** What `settings_reader` answers: the Reader the main window sent. */
let sentReader: number | null = null;
/** What `last_reader` answers: the Reader opened last, if any. */
let lastOpened: number | null = reader.id;
/** settings.json as Rust keeps it. */
let file = structuredClone(onDisk());

describe('/definicoes · window', () => {
	beforeEach(async () => {
		vi.clearAllMocks();
		calls.length = 0;
		observers.clear();
		handlers.clear();
		sentReader = null;
		closing.handler = null;
		lastOpened = reader.id;
		readers = [reader];
		file = structuredClone(onDisk());
		library.activeReaderId = null;
		library.readers = [];
		locale.set('en');
		vi.stubGlobal('ResizeObserver', FakeResizeObserver);
		vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
			const pane = activePane();
			const height =
				this.getAttribute('data-slot') !== 'settings-window' ? 0 : pane === 'kobo' && readers.length >= 2 ? 320 : HEIGHTS[pane];
			return { x: 0, y: 0, top: 0, left: 0, right: 540, bottom: height, width: 540, height, toJSON() {} };
		});
		appWindow.setSize.mockImplementation(() => {
			calls.push('setSize');
			return Promise.resolve();
		});
		appWindow.show.mockImplementation(() => {
			calls.push('show');
			return Promise.resolve();
		});
		vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) => {
			if (cmd === 'list_readers') return Promise.resolve(structuredClone(readers));
			if (cmd === 'rename_reader') {
				const { id, name } = args as { id: number; name: string };
				readers = readers.map((r) => (r.id === id ? { ...r, name } : r));
				return Promise.resolve(null);
			}
			if (cmd === 'settings_reader') return Promise.resolve(sentReader);
			if (cmd === 'last_reader') return Promise.resolve(lastOpened);
			if (cmd === 'load_settings') return Promise.resolve(structuredClone(file));
			if (cmd === 'update_settings') {
				const { patch } = args as { patch: Record<string, unknown> };
				for (const [leaf, value] of Object.entries(patch)) {
					const parent: Record<string, unknown> =
						leaf in file.exportConfig ? file.exportConfig : leaf in file.uiPreferences ? file.uiPreferences : (file as never);
					parent[leaf] = structuredClone(value);
				}
				return Promise.resolve(structuredClone(file));
			}
			return Promise.resolve(null);
		});
		// The layout loads the settings before the page is used
		await settings.load();
		flushSync();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('opens on Export and fits the window to it', async () => {
		render(Page);

		await waitFor(() => expect(appWindow.setSize).toHaveBeenCalled());
		const size = appWindow.setSize.mock.calls[0][0];
		expect([size.width, size.height]).toEqual([540, 382]);
		expect(screen.getByRole('tab', { name: 'Export' })).toHaveAttribute('aria-selected', 'true');
	});

	it('the tabs are Kobo, Appearance, Export, Updates and Agents, in that order', async () => {
		render(Page);

		expect(screen.getAllByRole('tab').map((tab) => tab.textContent?.trim())).toEqual(['Kobo', 'Appearance', 'Export', 'Updates', 'Agents']);
	});

	it('without a stored pane the window opens on Kobo, the first tab', async () => {
		delete (file.uiPreferences as { settingsPane?: string }).settingsPane;
		await settings.load();
		flushSync();
		render(Page);

		expect(screen.getByRole('tab', { name: 'Kobo' })).toHaveAttribute('aria-selected', 'true');
	});

	it('fits_the_window_when_the_pane_changes', async () => {
		render(Page);
		await waitFor(() => expect(appWindow.setSize).toHaveBeenCalledTimes(1));

		await fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
		resized();
		await waitFor(() => expect(appWindow.setSize).toHaveBeenCalledTimes(2));
		expect(appWindow.setSize.mock.calls[1][0]).toMatchObject({ width: 540, height: 287 });

		await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));
		resized();
		await waitFor(() => expect(appWindow.setSize).toHaveBeenCalledTimes(3));
		expect(appWindow.setSize.mock.calls[2][0]).toMatchObject({ width: 540, height: 243 });
	});

	it('a height that did not change does not ask for a size again', async () => {
		render(Page);
		await waitFor(() => expect(appWindow.setSize).toHaveBeenCalledTimes(1));

		resized();
		resized();
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(appWindow.setSize).toHaveBeenCalledTimes(1);
	});

	it('shows_the_window_only_after_its_first_size', async () => {
		render(Page);

		await waitFor(() => expect(appWindow.show).toHaveBeenCalledTimes(1));
		expect(calls).toEqual(['setSize', 'show']);
	});

	it('show waits for setSize to finish, and shows once', async () => {
		let sized!: () => void;
		appWindow.setSize.mockImplementation(() => {
			calls.push('setSize');
			return new Promise<void>((resolve) => (sized = resolve));
		});
		render(Page);
		await waitFor(() => expect(appWindow.setSize).toHaveBeenCalledTimes(1));
		await new Promise((resolve) => setTimeout(resolve, 20));

		// setSize has not finished: the window stays hidden
		expect(appWindow.show).not.toHaveBeenCalled();

		sized();
		await waitFor(() => expect(appWindow.show).toHaveBeenCalledTimes(1));
		resized();
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(appWindow.show).toHaveBeenCalledTimes(1);
	});

	it('names_the_window_after_the_pane', async () => {
		render(Page);
		await waitFor(() => expect(appWindow.setTitle).toHaveBeenCalledWith('Export'));

		await fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));
		await waitFor(() => expect(appWindow.setTitle).toHaveBeenLastCalledWith('Appearance'));
		await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));
		await waitFor(() => expect(appWindow.setTitle).toHaveBeenLastCalledWith('Kobo'));
		await fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));
		await waitFor(() => expect(appWindow.setTitle).toHaveBeenLastCalledWith('Updates'));
		await fireEvent.click(screen.getByRole('tab', { name: 'Agents' }));
		await waitFor(() => expect(appWindow.setTitle).toHaveBeenLastCalledWith('Agents'));
	});

	it('the Agents pane fits the window and is remembered as the pane on show', async () => {
		render(Page);
		await waitFor(() => expect(appWindow.setSize).toHaveBeenCalledTimes(1));

		await fireEvent.click(screen.getByRole('tab', { name: 'Agents' }));
		resized();

		await waitFor(() => expect(appWindow.setSize).toHaveBeenCalledTimes(2));
		expect(appWindow.setSize.mock.calls[1][0]).toMatchObject({ width: 540, height: 414 });
		await waitFor(() => expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { settingsPane: 'agents' } }));
		expect(await screen.findByRole('switch', { name: 'Allow agents' })).toBeInTheDocument();
	});

	it('the title follows the language', async () => {
		render(Page);
		await waitFor(() => expect(appWindow.setTitle).toHaveBeenCalledWith('Export'));

		// English → Portuguese, from Settings itself or from a settings-changed
		settings.setLanguage('pt');
		flushSync();

		await waitFor(() => expect(appWindow.setTitle).toHaveBeenLastCalledWith('Exportação'));
	});

	it('the bar draws no title of its own: the native one shows', async () => {
		render(Page);
		await waitFor(() => expect(appWindow.show).toHaveBeenCalled());

		// A heading for screen readers only; the first row of the bar stays empty
		const bar = document.querySelector('[data-slot="settings-bar"]')!;
		expect(bar).toHaveAttribute('data-tauri-drag-region');
		expect(screen.queryAllByText('Export', { selector: 'h1:not(.sr-only)' })).toHaveLength(0);
	});

	it('reopens_on_the_last_pane', async () => {
		file.uiPreferences.settingsPane = 'kobo';
		await settings.load();
		flushSync();
		render(Page);

		await waitFor(() => expect(screen.getByRole('tab', { name: 'Kobo' })).toHaveAttribute('aria-selected', 'true'));
		await waitFor(() => expect(appWindow.setSize.mock.calls.at(-1)?.[0]).toMatchObject({ height: 243 }));
		expect(appWindow.setTitle).toHaveBeenLastCalledWith('Kobo');
		// The window is shown with the right height already
		expect(appWindow.setSize.mock.calls.every(([size]) => size.height === 243)).toBe(true);
	});

	it('the pane chosen is saved as the last one', async () => {
		render(Page);
		await waitFor(() => expect(appWindow.show).toHaveBeenCalled());

		await fireEvent.click(screen.getByRole('tab', { name: 'Appearance' }));

		await waitFor(() =>
			expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { settingsPane: 'appearance' } })
		);
		expect(file.uiPreferences.settingsPane).toBe('appearance');
	});

	describe('Esc', () => {
		it('closes the window when nothing else is open', async () => {
			render(Page);
			await fireEvent.keyDown(window, { key: 'Escape' });
			expect(appWindow.close).toHaveBeenCalled();
		});

		it('closes it from a tab too', async () => {
			const user = userEvent.setup();
			render(Page);
			screen.getByRole('tab', { name: 'Export' }).focus();

			await user.keyboard('{Escape}');

			expect(appWindow.close).toHaveBeenCalledTimes(1);
		});

		it('in the name field only puts the name back', async () => {
			const user = userEvent.setup();
			readers = [reader];
			render(Page);
			await user.click(screen.getByRole('tab', { name: 'Kobo' }));
			const field = await screen.findByTestId('reader-name');
			await waitFor(() => expect(field).toHaveValue('Bruno'));
			await user.clear(field);
			await user.type(field, 'Bruno M.');

			await user.keyboard('{Escape}');

			expect(field).toHaveValue('Bruno');
			expect(appWindow.close).not.toHaveBeenCalled();
			// A second Esc, now outside the typing, closes
			await user.tab();
			await user.keyboard('{Escape}');
			expect(appWindow.close).toHaveBeenCalledTimes(1);
			expect(invoke).not.toHaveBeenCalledWith('rename_reader', expect.anything());
		});

		it('with a pop-up open only closes the list', async () => {
			const user = userEvent.setup();
			render(Page);
			const trigger = screen.getByRole('combobox', { name: 'Date format' });
			trigger.focus();
			await user.keyboard(' ');
			await screen.findByRole('listbox', { hidden: true });

			await user.keyboard('{Escape}');

			await waitFor(() => expect(screen.queryByRole('listbox', { hidden: true })).toBeNull());
			expect(appWindow.close).not.toHaveBeenCalled();
			// The next Esc, with the list shut, closes the window
			await user.keyboard('{Escape}');
			expect(appWindow.close).toHaveBeenCalledTimes(1);
		});
	});

	it('has no Save, Cancel or Reset anywhere, in any pane', async () => {
		render(Page);
		for (const name of ['Export', 'Appearance', 'Kobo', 'Updates', 'Agents']) {
			await fireEvent.click(screen.getByRole('tab', { name }));
			expect(screen.queryByRole('button', { name: /save|cancel|reset/i })).toBeNull();
		}
		expect(screen.queryByText(/library view mode|reset to defaults/i)).toBeNull();
		expect(screen.queryByRole('button', { name: /close settings/i })).toBeNull();
	});

	describe('readers', () => {
		it('shows the last Reader when the main window sent none', async () => {
			readers = [reader, other];
			render(Page);
			await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));
			await waitFor(() => expect(screen.getByTestId('reader-name')).toHaveValue('Bruno'));
		});

		it('settings_reader_preselects_the_reader_the_main_window_has_open', async () => {
			sentReader = other.id;
			readers = [reader, other];
			render(Page);
			await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));

			await waitFor(() => expect(screen.getByTestId('reader-name')).toHaveValue('Ana'));
			expect(screen.getByRole('combobox', { name: 'Reader' })).toHaveTextContent('Ana');
			expect(invoke).not.toHaveBeenCalledWith('last_reader');
		});

		it('⌘, again with another Reader on screen: the window follows it', async () => {
			readers = [reader, other];
			render(Page);
			await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));
			await waitFor(() => expect(handlers.has('settings-reader')).toBe(true));
			await waitFor(() => expect(screen.getByTestId('reader-name')).toHaveValue('Bruno'));

			handlers.get('settings-reader')!({ payload: other.id });

			await waitFor(() => expect(screen.getByTestId('reader-name')).toHaveValue('Ana'));
			expect(library.activeReaderId).toBe(other.id);
		});

		it('…and saves a name half-typed first, instead of dropping it', async () => {
			const user = userEvent.setup();
			readers = [reader, other];
			render(Page);
			await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));
			await waitFor(() => expect(handlers.has('settings-reader')).toBe(true));
			const field = await screen.findByTestId('reader-name');
			await waitFor(() => expect(field).toHaveValue('Bruno'));
			await user.clear(field);
			await user.type(field, 'Bruno M.');

			handlers.get('settings-reader')!({ payload: other.id });

			await waitFor(() => expect(library.activeReaderId).toBe(other.id));
			expect(invoke).toHaveBeenCalledWith('rename_reader', { id: 1, name: 'Bruno M.' });
		});

		it('readers_changed_turns_one_reader_into_two_live', async () => {
			render(Page);
			await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));
			await waitFor(() => expect(screen.getByText('Reader name')).toBeInTheDocument());
			expect(screen.queryByRole('combobox', { name: 'Reader' })).toBeNull();
			await waitFor(() => expect(handlers.has('readers-changed')).toBe(true));

			// A new Kobo connected and Ana was created in the main window
			readers = [reader, other];
			handlers.get('readers-changed')!({ payload: null });

			expect(await screen.findByRole('combobox', { name: 'Reader' })).toHaveTextContent('Bruno');
			expect(screen.getByText('Shown in the Library title.')).toBeInTheDocument();
			expect(screen.queryByText('Reader name')).toBeNull();
		});

		it('a Reader created with Settings open becomes the active one, so the folder is its own (R21)', async () => {
			const user = userEvent.setup();
			// The first start: no Reader yet, so none is open
			readers = [];
			lastOpened = null;
			render(Page);
			await waitFor(() => expect(handlers.has('readers-changed')).toBe(true));
			await waitFor(() => expect(library.readers).toEqual([]));

			// A new Kobo is connected and its Reader created; the main window has not opened it yet
			readers = [reader];
			handlers.get('readers-changed')!({ payload: null });
			await waitFor(() => expect(library.activeReaderId).toBe(reader.id));

			vi.mocked(invoke).mockClear();
			const real = vi.mocked(invoke).getMockImplementation()!;
			vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) =>
				cmd === 'pick_export_folder' ? Promise.resolve('/Volumes/Notes') : real(cmd, args as never)
			);
			await user.click(await screen.findByRole('button', { name: 'Choose…' }));

			await waitFor(() => expect(invoke).toHaveBeenCalledWith('set_reader_export_path', { readerId: 1, path: '/Volumes/Notes' }));
			const patches = vi.mocked(invoke).mock.calls.filter(([cmd]) => cmd === 'update_settings');
			expect(patches).toEqual([]);
		});

		it('renaming here is announced to the list at once', async () => {
			const user = userEvent.setup();
			readers = [reader, other];
			render(Page);
			await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));
			const field = await screen.findByTestId('reader-name');
			await waitFor(() => expect(field).toHaveValue('Bruno'));
			await user.clear(field);
			await user.type(field, 'Bruno M.{Enter}');

			await waitFor(() => expect(library.readers.map((r) => r.name)).toEqual(['Bruno M.', 'Ana']));
		});
	});

	it('the save error shows when a write fails and goes away with the next write that works', async () => {
		const user = userEvent.setup();
		render(Page);
		const real = vi.mocked(invoke).getMockImplementation()!;
		let refuse = true;
		vi.mocked(invoke).mockImplementation((cmd: string, args?: unknown) =>
			cmd === 'update_settings' && refuse ? Promise.reject('disk full') : real(cmd, args as never)
		);

		await user.click(await screen.findByRole('checkbox', { name: 'Author' }));
		expect(await screen.findByRole('alert')).toHaveTextContent('Error saving settings');

		refuse = false;
		await user.click(screen.getByRole('checkbox', { name: 'Author' }));

		await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
	});

	it('the height follows the content when a pane grows without a tab change (1 reader to M2)', async () => {
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));
		resized();
		await waitFor(() => expect(appWindow.setSize).toHaveBeenLastCalledWith(expect.objectContaining({ height: 243 })));
		await waitFor(() => expect(handlers.has('readers-changed')).toBe(true));
		const sizes = appWindow.setSize.mock.calls.length;

		readers = [reader, other];
		handlers.get('readers-changed')!({ payload: null });
		await screen.findByRole('combobox', { name: 'Reader' });
		resized();

		await waitFor(() => expect(appWindow.setSize.mock.calls.length).toBe(sizes + 1));
		expect(appWindow.setSize).toHaveBeenLastCalledWith(expect.objectContaining({ width: 540, height: 320 }));
	});

	it('the Updates switch is saved at the moment', async () => {
		const user = userEvent.setup();
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));

		await user.click(await screen.findByRole('switch', { name: 'Automatically check for updates' }));

		await waitFor(() => expect(invoke).toHaveBeenCalledWith('update_settings', { patch: { checkForUpdates: false } }));
		expect(file.uiPreferences.checkForUpdates).toBe(false);
	});

	it('the red button or ⌘W with a name half-typed saves it before the window closes', async () => {
		const user = userEvent.setup();
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: 'Kobo' }));
		const field = await screen.findByTestId('reader-name');
		await waitFor(() => expect(field).toHaveValue('Bruno'));
		await user.clear(field);
		await user.type(field, 'Bruno M.');
		await waitFor(() => expect(closing.handler).not.toBeNull());
		const preventDefault = vi.fn();

		// The webview never blurred: the native close is held, the name saved, then the window closes
		await closing.handler!({ preventDefault });

		expect(preventDefault).toHaveBeenCalled();
		expect(invoke).toHaveBeenCalledWith('rename_reader', { id: 1, name: 'Bruno M.' });
		expect(appWindow.destroy).toHaveBeenCalledTimes(1);
	});

	it('Check Now asks the main window, which has the updater', async () => {
		const checkNow = vi.spyOn(updater, 'checkNow');
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));

		await fireEvent.click(screen.getByRole('button', { name: 'Check Now' }));

		expect(emit).toHaveBeenCalledWith('check-for-updates');
		expect(checkNow).not.toHaveBeenCalled();
	});

	it('asks the main window for its updater state when it opens, in case it checked before', async () => {
		render(Page);

		await waitFor(() => expect(emit).toHaveBeenCalledWith('updates-state-request'));
	});

	it('asks for the updater state only once it listens for the answer', async () => {
		let register!: (unlisten: () => void) => void;
		const order: string[] = [];
		vi.mocked(listen).mockImplementation(((event: string, handler: (event: { payload: unknown }) => void) => {
			handlers.set(event, handler);
			if (event !== 'updates-state') return Promise.resolve(() => {});
			return new Promise<() => void>((resolve) => {
				register = (unlisten) => {
					order.push('listening');
					resolve(unlisten);
				};
			});
		}) as typeof listen);
		vi.mocked(emit).mockImplementation(((event: string) => {
			if (event === 'updates-state-request') order.push('request');
			return Promise.resolve();
		}) as typeof emit);
		render(Page);
		await waitFor(() => expect(handlers.has('updates-state')).toBe(true));
		await new Promise((resolve) => setTimeout(resolve, 20));
		// The main window may answer in the instant after the request: nobody is listening yet
		expect(order).toEqual([]);

		register(() => {});
		await waitFor(() => expect(order).toEqual(['listening', 'request']));
	});

	it('a listener for the updater that registers after the page is gone is removed at once', async () => {
		const late = vi.fn();
		let register!: (unlisten: () => void) => void;
		vi.mocked(listen).mockImplementation(((event: string, handler: (event: { payload: unknown }) => void) => {
			handlers.set(event, handler);
			if (event !== 'updates-state') return Promise.resolve(() => {});
			return new Promise<() => void>((resolve) => (register = resolve));
		}) as typeof listen);
		const page = render(Page);
		await waitFor(() => expect(handlers.has('updates-state')).toBe(true));
		vi.mocked(emit).mockClear();

		page.unmount();
		register(late);
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(late).toHaveBeenCalledOnce();
		// And it does not ask a window nobody listens in
		expect(emit).not.toHaveBeenCalledWith('updates-state-request');
	});

	it('shows what the main window reports: «Checked today at…» and Check Now waiting while it checks', async () => {
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));
		await waitFor(() => expect(handlers.has('updates-state')).toBe(true));
		expect(screen.getByText('Not checked yet.')).toBeInTheDocument();
		const checkNowButton = screen.getByRole('button', { name: 'Check Now' });
		expect(checkNowButton).not.toHaveAttribute('aria-disabled', 'true');

		const at = new Date();
		at.setHours(17, 10, 0, 0);
		handlers.get('updates-state')!({ payload: { state: 'checking', lastChecked: at.toISOString(), busy: true } });

		await waitFor(() => expect(checkNowButton).toHaveAttribute('aria-disabled', 'true'));
		const time = new Intl.DateTimeFormat('en', { hour: '2-digit', minute: '2-digit' }).format(at);
		expect(screen.getByText(`Checked today at ${time}.`)).toBeInTheDocument();

		handlers.get('updates-state')!({ payload: { state: 'upToDate', lastChecked: at.toISOString() } });
		await waitFor(() => expect(checkNowButton).not.toHaveAttribute('aria-disabled', 'true'));
	});

	it('Check Now waits while the main window runs its silent check on launch, which it shows no dialog for', async () => {
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));
		await waitFor(() => expect(handlers.has('updates-state')).toBe(true));

		handlers.get('updates-state')!({ payload: { state: 'idle', lastChecked: null, busy: true } });

		await waitFor(() => expect(screen.getByRole('button', { name: 'Check Now' })).toHaveAttribute('aria-disabled', 'true'));
	});

	it('Check Now clicked while the main window checks asks for nothing', async () => {
		render(Page);
		await fireEvent.click(screen.getByRole('tab', { name: 'Updates' }));
		await waitFor(() => expect(handlers.has('updates-state')).toBe(true));
		handlers.get('updates-state')!({ payload: { state: 'downloading', lastChecked: null, busy: true } });
		await waitFor(() => expect(screen.getByRole('button', { name: 'Check Now' })).toHaveAttribute('aria-disabled', 'true'));
		vi.mocked(emit).mockClear();

		await fireEvent.click(screen.getByRole('button', { name: 'Check Now' }));

		expect(emit).not.toHaveBeenCalledWith('check-for-updates');
	});
});

function onDisk() {
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
