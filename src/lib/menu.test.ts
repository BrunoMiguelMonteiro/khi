import { describe, it, expect, vi, beforeEach } from 'vitest';

type Options = Record<string, any>;
const made = vi.hoisted(() => ({ items: [] as Options[], submenus: [] as Options[], menus: [] as Options[] }));

const stateful = (o: Options) => {
	made.items.push(o);
	o.setEnabled = vi.fn(async () => {});
	o.setChecked = vi.fn(async () => {});
	o.setText = vi.fn(async () => {});
	return o;
};
vi.mock('@tauri-apps/api/menu', () => ({
	MenuItem: { new: vi.fn(async (o: Options) => stateful(o)) },
	CheckMenuItem: { new: vi.fn(async (o: Options) => stateful(o)) },
	PredefinedMenuItem: { new: vi.fn(async (o: Options) => ({ kind: 'predefined', ...o })) },
	Submenu: {
		new: vi.fn(async (o: Options) => {
			made.submenus.push(o);
			o.append = vi.fn(async (item: Options) => void o.items.push(item));
			o.remove = vi.fn(async (item: Options) => void o.items.splice(o.items.indexOf(item), 1));
			return o;
		})
	},
	Menu: { new: vi.fn(async (o: Options) => (made.menus.push(o), { ...o, setAsAppMenu: vi.fn() })) }
}));
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn() }));
vi.mock('@tauri-apps/api/image', () => ({ Image: { fromPath: vi.fn() } }));
vi.mock('@tauri-apps/api/path', () => ({ resolveResource: vi.fn(() => Promise.reject('no bundle')) }));
vi.mock('$lib/components/ui/toast/toast-state.svelte', () => ({ notify: vi.fn() }));
vi.mock('@tauri-apps/plugin-opener', () => ({ revealItemInDir: vi.fn(() => Promise.resolve()) }));
vi.mock('$lib/bindings', () => ({ commands: { openSettings: vi.fn(() => Promise.resolve(null)) } }));

import { emit } from '@tauri-apps/api/event';
import { commands } from '$lib/bindings';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { notify } from '$lib/components/ui/toast/toast-state.svelte';
import { Submenu } from '@tauri-apps/api/menu';
import { createApplicationMenu, setRevealLastExportEnabled, applyMenuState, setMenuActions } from './menu';
import { menuState, type MenuStateInput } from './menu-state';

/** A stand-in translator: Portuguese for the keys the menu needs. */
const PT: Record<string, string> = {
	'settings.title': 'Definições',
	'settings.windowTitle': 'Definições',
	'app.menuFile': 'Ficheiro',
	'app.menuRevealLastExport': 'Mostrar última exportação no Finder',
	'notifications.showInFinderError': 'Não foi possível mostrar a exportação no Finder.',
	'app.menuEdit': 'Editar',
	'app.menuWindow': 'Janela',
	'app.menuView': 'Visualização',
	'app.menuBook': 'Livro'
};
const t = ((key: string) => PT[key] ?? key) as Parameters<typeof createApplicationMenu>[0];

describe('application menu', () => {
	beforeEach(() => {
		made.items.length = 0;
		made.submenus.length = 0;
		made.menus.length = 0;
		vi.clearAllMocks();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	it('menu_settings_invokes_open_settings', async () => {
		let activeReaderId: number | null = 1;
		await createApplicationMenu(t, () => activeReaderId);
		const item = made.items.find((o) => o.id === 'settings');
		expect(item?.accelerator).toBe('CmdOrCtrl+,');

		// The Reader on screen when ⌘, is pressed, not when the menu was built
		activeReaderId = 2;
		item!.action();

		expect(commands.openSettings).toHaveBeenCalledWith('Definições', 2);
		expect(emit).not.toHaveBeenCalledWith('open-settings');
	});

	it('menu_has_close_window', async () => {
		await createApplicationMenu(t);
		const windowMenu = made.submenus.find((o) => o.text === 'Janela');
		const fileMenu = made.submenus.find((o) => o.text === 'Ficheiro');

		expect(windowMenu?.items.map((i: Options) => i.item)).toEqual(['Minimize', 'Maximize']);
		expect(fileMenu?.items.at(-1).item).toBe('CloseWindow');
		expect(made.menus[0].items).toContainEqual(expect.objectContaining({ text: 'Janela' }));
	});

	it('menu_has_a_file_menu_between_khi_and_edit', async () => {
		await createApplicationMenu(t);

		const titles = made.menus[0].items.map((i: Options) => i.text);
		expect(titles).toEqual(['Khi', 'Ficheiro', 'Editar', 'Visualização', 'Livro', 'Janela']);
		const file = made.submenus.find((o) => o.text === 'Ficheiro');
		const reveal = file?.items.find((i: Options) => i.id === 'reveal-last-export');
		expect(reveal).toMatchObject({ text: 'Mostrar última exportação no Finder' });
		// No shortcut: the menu item alone
		expect(reveal.accelerator).toBeUndefined();
	});

	it('reveal_last_export_is_disabled_before_the_first_export', async () => {
		await createApplicationMenu(t, () => 1, () => []);
		const item = made.items.find((o) => o.id === 'reveal-last-export')!;
		expect(item.enabled).toBe(false);

		// Chosen anyway, it does nothing
		item.action();
		expect(revealItemInDir).not.toHaveBeenCalled();
	});

	it('reveal_last_export_shows_the_files_of_the_last_export', async () => {
		let last = ['/x/A.md', '/x/B.md'];
		await createApplicationMenu(t, () => 1, () => last);
		const item = made.items.find((o) => o.id === 'reveal-last-export')!;
		expect(item.enabled).toBe(true);

		// The files of the last export when it is chosen, not when the menu was built
		last = ['/y/C.md'];
		item.action();

		expect(revealItemInDir).toHaveBeenCalledWith(['/y/C.md']);
	});

	it('an_export_enables_the_item_without_rebuilding_the_menu', async () => {
		await createApplicationMenu(t, () => 1, () => []);
		const item = made.items.find((o) => o.id === 'reveal-last-export')!;

		await setRevealLastExportEnabled(true);

		expect(item.setEnabled).toHaveBeenCalledWith(true);
		expect(made.menus).toHaveLength(1);
	});

	it('a_failed_reveal_is_logged_and_says_so_in_a_notice', async () => {
		vi.mocked(revealItemInDir).mockRejectedValueOnce('gone');
		const log = vi.spyOn(console, 'error').mockImplementation(() => {});
		await createApplicationMenu(t, () => 1, () => ['/x/A.md']);

		made.items.find((o) => o.id === 'reveal-last-export')!.action();
		await new Promise((r) => setTimeout(r, 0));

		expect(log).toHaveBeenCalled();
		expect(notify).toHaveBeenCalledWith('Não foi possível mostrar a exportação no Finder.');
		log.mockRestore();
	});

	it('a_rebuild_applies_the_current_state_to_the_new_item', async () => {
		await createApplicationMenu(t, () => 1, () => ['/x/A.md']);
		const item = made.items.find((o) => o.id === 'reveal-last-export')!;
		expect(item.setEnabled).toHaveBeenCalledWith(true);

		made.items.length = 0;
		await createApplicationMenu(t, () => 1, () => []);
		expect(made.items.find((o) => o.id === 'reveal-last-export')!.setEnabled).toHaveBeenCalledWith(false);
	});

	describe('page state', () => {
		const input: MenuStateInput = {
			mainFocused: true, editableFocused: false, unknownDevice: false, deleting: false, updaterBusy: false,
			uiState: 'library', inDetail: false, canSync: true, declinedKobo: false, isImporting: false,
			canDelete: false, deleteBusy: false, activeReaderId: 1, viewMode: 'grid', sortBy: 'title',
			readers: [{ id: 1, name: 'Ana' }], exportCount: 3
		};
		const state = (patch: Partial<MenuStateInput> = {}) => menuState({ ...input, ...patch }, t);
		const item = (id: string) => made.items.find((o) => o.id === id)!;
		const actions = () => ({ sync: vi.fn(), exportBooks: vi.fn(), deleteBook: vi.fn(), back: vi.fn(), setView: vi.fn(), setSort: vi.fn(), selectReader: vi.fn() });

		it('the shortcuts are the menu items', async () => {
			await createApplicationMenu(t);
			expect(['sync', 'export', 'view-grid', 'view-list', 'back', 'delete'].map((id) => item(id).accelerator)).toEqual([
				'CmdOrCtrl+R', 'CmdOrCtrl+E', 'CmdOrCtrl+1', 'CmdOrCtrl+2', 'CmdOrCtrl+[', 'CmdOrCtrl+Backspace'
			]);
		});

		it('items start disabled, until the page says otherwise', async () => {
			await createApplicationMenu(t);
			expect(['sync', 'export', 'view-grid', 'back', 'delete'].map((id) => item(id).enabled)).toEqual([false, false, false, false, false]);
		});

		it('a state that arrived before the menu is applied when it exists', async () => {
			await applyMenuState(state());
			setMenuActions(actions());
			await createApplicationMenu(t, () => 1, () => []);
			expect(item('sync').setEnabled).toHaveBeenCalledWith(true);
			expect(item('view-grid').setChecked).toHaveBeenCalledWith(true);
			expect(item('export').setText).toHaveBeenCalled();
		});

		it('only what changed is sent, and nothing is rebuilt', async () => {
			setMenuActions(actions());
			await createApplicationMenu(t, () => 1, () => []);
			await applyMenuState(state());
			vi.mocked(item('sync').setEnabled).mockClear();
			await applyMenuState(state({ viewMode: 'list' }));

			expect(item('sync').setEnabled).not.toHaveBeenCalled();
			expect(item('view-list').setChecked).toHaveBeenLastCalledWith(true);
			expect(made.menus).toHaveLength(1);
		});

		it('the actions are the page functions, and a check chosen is put back to the page state', async () => {
			const a = actions();
			setMenuActions(a);
			await createApplicationMenu(t, () => 1, () => []);
			await applyMenuState(state());
			item('sync').action();
			await applyMenuState(state({ inDetail: true, canDelete: true }));
			item('delete').action();
			await applyMenuState(state());
			item('sort-author').action();
			item('view-grid').action();
			await applyMenuState(state());

			expect(a.sync).toHaveBeenCalledTimes(1);
			expect(a.deleteBook).toHaveBeenCalledTimes(1);
			expect(a.setSort).toHaveBeenCalledWith('author');
			expect(a.setView).toHaveBeenCalledWith('grid');
			// The native toggle is overridden even though the page state did not change
			const calls = vi.mocked(item('view-grid').setChecked).mock.calls;
			expect(calls.length).toBeGreaterThan(1);
			expect(calls.at(-1)).toEqual([true]);
		});

		it('a held shortcut runs its action once, and again after the gap', async () => {
			vi.useFakeTimers();
			try {
				const a = actions();
				setMenuActions(a);
				await createApplicationMenu(t, () => 1, () => []);
				await applyMenuState(state());
				for (let i = 0; i < 6; i++) {
					item('export').action();
					vi.advanceTimersByTime(40);
				}
				expect(a.exportBooks).toHaveBeenCalledTimes(1);

				// Another item is not held by it
				item('sync').action();
				expect(a.sync).toHaveBeenCalledTimes(1);

				vi.advanceTimersByTime(400);
				item('export').action();
				expect(a.exportBooks).toHaveBeenCalledTimes(2);
			} finally {
				vi.useRealTimers();
			}
		});

		it('an item the page state has disabled does nothing, and a check is still put back', async () => {
			const a = actions();
			setMenuActions(a);
			await createApplicationMenu(t, () => 1, () => []);
			await applyMenuState(state({ canSync: false, viewMode: 'grid' }));
			expect(a.sync).not.toHaveBeenCalled();
			item('sync').action();
			expect(a.sync).not.toHaveBeenCalled();

			await applyMenuState(state({ editableFocused: true }));
			vi.mocked(item('view-grid').setChecked).mockClear();
			item('view-grid').action();
			await new Promise((r) => setTimeout(r, 0));
			expect(a.setView).not.toHaveBeenCalled();
			expect(item('view-grid').setChecked).toHaveBeenLastCalledWith(true);
		});

		it('a state applied while the menu is being rebuilt lands on the new menu', async () => {
			const two = { readers: [{ id: 1, name: 'Ana' }, { id: 2, name: 'Rui' }] };
			setMenuActions(actions());
			await createApplicationMenu(t, () => 1, () => []);
			await applyMenuState(state());
			const oldView = made.submenus.find((o) => o.text === 'Visualização')!;
			made.items.length = 0;
			made.submenus.length = 0;

			// The rebuild waits in the middle, before its View menu exists
			let release!: () => void;
			const gate = new Promise<void>((r) => (release = r));
			const real = vi.mocked(Submenu.new).getMockImplementation()!;
			vi.mocked(Submenu.new).mockImplementation(async (o: Options) => {
				if (o.text === 'Visualização') await gate;
				return real(o as never);
			});
			const rebuilt = createApplicationMenu(t, () => 1, () => []);
			await new Promise((r) => setTimeout(r, 0));
			const applied = applyMenuState(state(two));
			await new Promise((r) => setTimeout(r, 0));
			release();
			await Promise.all([rebuilt, applied]);
			vi.mocked(Submenu.new).mockImplementation(real);

			const newView = made.submenus.find((o) => o.text === 'Visualização')!;
			const readers = (v: Options) => v.items.filter((i: Options) => String(i.id).startsWith('reader-')).map((i: Options) => i.id);
			expect(readers(oldView)).toEqual([]);
			expect(readers(newView)).toEqual(['reader-1', 'reader-2']);

			await applyMenuState(state({ canSync: false }));
			expect(readers(newView)).toEqual([]);
			expect(item('sync').setEnabled).toHaveBeenLastCalledWith(false);
		});

		it('a reader that cannot be removed does not freeze the other items', async () => {
			const log = vi.spyOn(console, 'error').mockImplementation(() => {});
			setMenuActions(actions());
			await createApplicationMenu(t, () => 1, () => []);
			await applyMenuState(state({ readers: [{ id: 1, name: 'Ana' }, { id: 2, name: 'Rui' }] }));
			const view = made.submenus.find((o) => o.text === 'Visualização')!;
			view.remove = vi.fn(async () => { throw new Error('NotAChildOfThisMenu'); });

			await applyMenuState(state({ readers: [{ id: 1, name: 'Ana' }], canSync: false }));
			expect(item('sync').setEnabled).toHaveBeenLastCalledWith(false);
			await applyMenuState(state({ readers: [{ id: 1, name: 'Ana' }], canSync: true }));
			expect(item('sync').setEnabled).toHaveBeenLastCalledWith(true);
			log.mockRestore();
		});

		it('the reader list comes and goes with the readers, without rebuilding the menu', async () => {
			const a = actions();
			setMenuActions(a);
			await createApplicationMenu(t, () => 1, () => []);
			const view = made.submenus.find((o) => o.text === 'Visualização')!;
			const base = view.items.length;
			const two = { readers: [{ id: 1, name: 'Ana' }, { id: 2, name: 'Rui' }] };

			await applyMenuState(state());
			expect(view.items).toHaveLength(base);

			await applyMenuState(state(two));
			expect(view.items.slice(base).map((i: Options) => i.id)).toEqual([undefined, 'reader-1', 'reader-2']);
			item('reader-2').action();
			expect(a.selectReader).toHaveBeenCalledWith(2);

			// Same readers: left as they are
			const before = view.items.slice();
			await applyMenuState(state({ ...two, viewMode: 'list' }));
			expect(view.items).toEqual(before);

			await applyMenuState(state());
			expect(view.items).toHaveLength(base);
			expect(made.menus).toHaveLength(1);
		});
	});
});
