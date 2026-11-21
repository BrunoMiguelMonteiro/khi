import { describe, it, expect, vi, beforeEach } from 'vitest';

type Options = Record<string, any>;
const made = vi.hoisted(() => ({ items: [] as Options[], submenus: [] as Options[], menus: [] as Options[] }));

vi.mock('@tauri-apps/api/menu', () => ({
	MenuItem: { new: vi.fn(async (o: Options) => (made.items.push(o), (o.setEnabled = vi.fn(async () => {})), { kind: 'item', ...o })) },
	PredefinedMenuItem: { new: vi.fn(async (o: Options) => ({ kind: 'predefined', ...o })) },
	Submenu: { new: vi.fn(async (o: Options) => (made.submenus.push(o), { kind: 'submenu', ...o })) },
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
import { createApplicationMenu, setRevealLastExportEnabled } from './menu';

/** A stand-in translator: Portuguese for the keys the menu needs. */
const PT: Record<string, string> = {
	'settings.title': 'Definições',
	'settings.windowTitle': 'Definições',
	'app.menuFile': 'Ficheiro',
	'app.menuRevealLastExport': 'Mostrar última exportação no Finder',
	'notifications.showInFinderError': 'Não foi possível mostrar a exportação no Finder.',
	'app.menuEdit': 'Editar',
	'app.menuWindow': 'Janela'
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
		const predefined = windowMenu?.items.map((i: Options) => i.item);

		expect(predefined).toEqual(['Minimize', 'CloseWindow']);
		expect(made.menus[0].items).toContainEqual(expect.objectContaining({ text: 'Janela' }));
	});

	it('menu_has_a_file_menu_between_khi_and_edit', async () => {
		await createApplicationMenu(t);

		const titles = made.menus[0].items.map((i: Options) => i.text);
		expect(titles).toEqual(['Khi', 'Ficheiro', 'Editar', 'Janela']);
		const file = made.submenus.find((o) => o.text === 'Ficheiro');
		expect(file?.items).toHaveLength(1);
		expect(file?.items[0]).toMatchObject({ id: 'reveal-last-export', text: 'Mostrar última exportação no Finder' });
		// No shortcut: the menu item alone
		expect(file?.items[0].accelerator).toBeUndefined();
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
});
