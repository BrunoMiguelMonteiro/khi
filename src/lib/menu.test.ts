import { describe, it, expect, vi, beforeEach } from 'vitest';

type Options = Record<string, any>;
const made = vi.hoisted(() => ({ items: [] as Options[], submenus: [] as Options[], menus: [] as Options[] }));

vi.mock('@tauri-apps/api/menu', () => ({
	MenuItem: { new: vi.fn(async (o: Options) => (made.items.push(o), { kind: 'item', ...o })) },
	PredefinedMenuItem: { new: vi.fn(async (o: Options) => ({ kind: 'predefined', ...o })) },
	Submenu: { new: vi.fn(async (o: Options) => (made.submenus.push(o), { kind: 'submenu', ...o })) },
	Menu: { new: vi.fn(async (o: Options) => (made.menus.push(o), { ...o, setAsAppMenu: vi.fn() })) }
}));
vi.mock('@tauri-apps/api/event', () => ({ emit: vi.fn() }));
vi.mock('@tauri-apps/api/image', () => ({ Image: { fromPath: vi.fn() } }));
vi.mock('@tauri-apps/api/path', () => ({ resolveResource: vi.fn(() => Promise.reject('no bundle')) }));
vi.mock('$lib/bindings', () => ({ commands: { openSettings: vi.fn(() => Promise.resolve(null)) } }));

import { emit } from '@tauri-apps/api/event';
import { commands } from '$lib/bindings';
import { createApplicationMenu } from './menu';

/** A stand-in translator: Portuguese for the keys the menu needs. */
const PT: Record<string, string> = {
	'settings.title': 'Definições',
	'settings.windowTitle': 'Definições',
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
		await createApplicationMenu(t);
		const item = made.items.find((o) => o.id === 'settings');
		expect(item?.accelerator).toBe('CmdOrCtrl+,');

		item!.action();

		expect(commands.openSettings).toHaveBeenCalledWith('Definições');
		expect(emit).not.toHaveBeenCalledWith('open-settings');
	});

	it('menu_has_close_window', async () => {
		await createApplicationMenu(t);
		const windowMenu = made.submenus.find((o) => o.text === 'Janela');
		const predefined = windowMenu?.items.map((i: Options) => i.item);

		expect(predefined).toEqual(['Minimize', 'CloseWindow']);
		expect(made.menus[0].items).toContainEqual(expect.objectContaining({ text: 'Janela' }));
	});
});
