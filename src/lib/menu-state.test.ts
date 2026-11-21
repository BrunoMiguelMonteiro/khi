import { describe, it, expect } from 'vitest';
import { menuState, type MenuStateInput } from './menu-state';

const t = (key: string, params?: Record<string, string | number>) => (params ? `${key}:${JSON.stringify(params)}` : key);

const library: MenuStateInput = {
	mainFocused: true,
	editableFocused: false,
	unknownDevice: false,
	deleting: false,
	updaterBusy: false,
	uiState: 'library',
	inDetail: false,
	canSync: true,
	declinedKobo: false,
	isImporting: false,
	canDelete: false,
	deleteBusy: false,
	activeReaderId: 1,
	viewMode: 'grid',
	sortBy: 'date_last_read',
	readers: [{ id: 1, name: 'Ana' }],
	exportCount: 12
};
const detail: MenuStateInput = { ...library, uiState: 'book-details', inDetail: true, exportCount: 1 };

const enabled = (input: MenuStateInput) =>
	Object.fromEntries(Object.entries(menuState(input, t).items).map(([id, s]) => [id, s.enabled]));

describe('menuState', () => {
	it('library: sync, export and the views work; the Book menu is off', () => {
		expect(enabled(library)).toMatchObject({
			sync: true,
			export: true,
			'view-grid': true,
			'view-list': true,
			'sort-title': true,
			back: false,
			delete: false
		});
	});

	it('export text follows the toolbar: count in the library, the book in a book', () => {
		expect(menuState(library, t).items.export.text).toBe('ui.windowBar.export:{"count":12}');
		expect(menuState(detail, t).items.export.text).toBe('app.menuExportBook');
	});

	it('checks follow the view and the sort', () => {
		const s = menuState({ ...library, viewMode: 'list', sortBy: 'author' }, t).items;
		expect([s['view-grid'].checked, s['view-list'].checked]).toEqual([false, true]);
		expect(s['sort-author'].checked).toBe(true);
		expect(s['sort-title'].checked).toBe(false);
	});

	it('detail: only export, back and (when deletable) delete work', () => {
		expect(enabled(detail)).toMatchObject({ sync: false, export: true, 'view-grid': false, 'view-list': false, 'sort-title': false, back: true, delete: false });
		expect(enabled({ ...detail, canDelete: true }).delete).toBe(true);
		expect(enabled({ ...library, canDelete: true }).delete).toBe(false);
	});

	it('delete waits for a Sync or an export, and for a window', () => {
		const d = { ...detail, canDelete: true };
		expect(enabled({ ...d, deleteBusy: true }).delete).toBe(false);
		expect(enabled({ ...d, deleting: true }).delete).toBe(false);
		expect(enabled({ ...d, activeReaderId: null }).delete).toBe(false);
	});

	it('no Kobo: Sync is off, unless a declined Kobo is to be asked about again', () => {
		const none = { ...library, uiState: 'no-device' as const, canSync: false };
		expect(enabled(none)).toMatchObject({ sync: false, export: false, 'view-grid': false });
		expect(enabled({ ...none, canSync: true, declinedKobo: true }).sync).toBe(true);
		expect(enabled({ ...none, canSync: true }).sync).toBe(false);
		expect(enabled({ ...library, canSync: false }).sync).toBe(false);
	});

	it('syncing: only the views switch', () => {
		const syncing = { ...library, isImporting: true, canSync: false };
		expect(enabled(syncing)).toMatchObject({ sync: false, export: false, 'view-grid': true, 'view-list': true });
		expect(enabled({ ...detail, isImporting: true }).export).toBe(false);
	});

	it.each([
		['unknownDevice', { unknownDevice: true }],
		['deleting', { deleting: true }],
		['updater busy', { updaterBusy: true }],
		['main window not focused', { mainFocused: false }],
		['an editable element focused', { editableFocused: true }]
	])('%s: every shortcut item is off', (_name, patch) => {
		for (const base of [library, { ...detail, canDelete: true }]) {
			const s = enabled({ ...base, ...patch });
			for (const id of ['sync', 'export', 'view-grid', 'view-list', 'back', 'delete']) expect(s[id]).toBe(false);
		}
	});

	it('the toolbar-only items ignore a focused text field but not a window', () => {
		expect(enabled({ ...library, editableFocused: true })['sort-title']).toBe(true);
		expect(enabled({ ...library, deleting: true })['sort-title']).toBe(false);
		expect(enabled({ ...library, mainFocused: false })['sort-title']).toBe(false);
	});

	it('readers appear only from two', () => {
		expect(menuState(library, t).readers).toEqual([]);
		const two = menuState({ ...library, readers: [{ id: 1, name: 'Ana' }, { id: 2, name: 'Rui' }], activeReaderId: 2 }, t);
		expect(two.readers).toEqual([
			{ id: 1, text: 'screens.library.titleOf:{"reader":"Ana"}' },
			{ id: 2, text: 'screens.library.titleOf:{"reader":"Rui"}' }
		]);
		expect(two.items['reader-1']).toMatchObject({ enabled: true, checked: false });
		expect(two.items['reader-2'].checked).toBe(true);
	});

	it('readers wait for a Sync and are not in a book', () => {
		const two = { ...library, readers: [{ id: 1, name: 'Ana' }, { id: 2, name: 'Rui' }] };
		expect(menuState({ ...two, isImporting: true }, t).items['reader-1'].enabled).toBe(false);
		expect(menuState({ ...two, uiState: 'book-details', inDetail: true }, t).items['reader-1'].enabled).toBe(false);
	});

	it('no Reader open: view and sort are off', () => {
		expect(enabled({ ...library, activeReaderId: null })['sort-title']).toBe(false);
	});
});
