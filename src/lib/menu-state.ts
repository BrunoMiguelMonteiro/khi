import type { MessageFormatter } from '$lib/i18n';
import type { SortPreference, UiState, ViewMode } from '$lib/types';

export const SORT_ORDER: SortPreference[] = ['title', 'author', 'date_last_read', 'highlight_count'];
export const SORT_KEYS: Record<SortPreference, string> = {
	title: 'screens.library.sort.title',
	author: 'screens.library.sort.author',
	date_last_read: 'screens.library.sort.recent',
	highlight_count: 'screens.library.sort.count'
};

export interface MenuStateInput {
	/** The main window is the one in front: Settings has its own text fields. */
	mainFocused: boolean;
	/** A text field of the main window has the caret: it keeps its keys. */
	editableFocused: boolean;
	unknownDevice: boolean;
	deleting: boolean;
	updaterBusy: boolean;
	uiState: UiState;
	inDetail: boolean;
	canSync: boolean;
	declinedKobo: boolean;
	isImporting: boolean;
	canDelete: boolean;
	deleteBusy: boolean;
	activeReaderId: number | null;
	viewMode: ViewMode;
	sortBy: SortPreference;
	readers: { id: number; name: string }[];
	exportCount: number;
}

export interface MenuItemState {
	enabled: boolean;
	checked?: boolean;
	text?: string;
}

export interface MenuState {
	items: Record<string, MenuItemState>;
	/** The reader list of the View menu; empty below two readers. */
	readers: { id: number; text: string }[];
}

/**
 * An enabled native item with an accelerator takes the key before the page, even from a text field,
 * and a disabled one lets it through. So an item is enabled exactly when its shortcut worked on the page.
 */
export function menuState(s: MenuStateInput, t: MessageFormatter): MenuState {
	const modal = s.unknownDevice || s.deleting || s.updaterBusy;
	const keys = s.mainFocused && !s.editableFocused && !modal;
	const free = s.mainFocused && !modal;
	const inLibrary = s.uiState === 'library';
	const noDevice = s.uiState === 'no-device';
	const showReaders = s.readers.length >= 2;

	const items: Record<string, MenuItemState> = {
		sync: {
			enabled: keys && (inLibrary || (noDevice && s.declinedKobo)) && s.canSync && !s.isImporting,
			text: t('app.menuSync')
		},
		export: {
			enabled: keys && (inLibrary || s.inDetail) && !s.isImporting,
			text: s.inDetail ? t('app.menuExportBook') : t('ui.windowBar.export', { count: s.exportCount })
		},
		'view-grid': { enabled: keys && inLibrary, checked: s.viewMode === 'grid' },
		'view-list': { enabled: keys && inLibrary, checked: s.viewMode === 'list' },
		back: { enabled: keys && s.inDetail },
		delete: {
			enabled: keys && s.inDetail && s.canDelete && !s.deleteBusy && s.activeReaderId !== null
		}
	};
	const toolbarSort = free && !s.inDetail && s.activeReaderId !== null;
	for (const sort of SORT_ORDER) {
		items[`sort-${sort}`] = { enabled: toolbarSort, checked: s.sortBy === sort, text: t(SORT_KEYS[sort]) };
	}
	const readers = showReaders ? s.readers.map((r) => ({ id: r.id, text: t('screens.library.titleOf', { reader: r.name }) })) : [];
	for (const r of readers) {
		items[`reader-${r.id}`] = { enabled: free && !s.inDetail && !s.isImporting, checked: r.id === s.activeReaderId, text: r.text };
	}
	return { items, readers };
}
