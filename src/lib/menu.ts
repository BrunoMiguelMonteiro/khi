import { Menu, Submenu, MenuItem, CheckMenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { emit } from '@tauri-apps/api/event';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { notify } from '$lib/components/ui/toast/toast-state.svelte';
import { commands } from '$lib/bindings';
import { Image } from '@tauri-apps/api/image';
import { resolveResource } from '@tauri-apps/api/path';
import type { MessageFormatter } from '$lib/i18n';
import type { SortPreference, ViewMode } from '$lib/types';
import { SORT_KEYS, SORT_ORDER, type MenuState, type MenuItemState } from '$lib/menu-state';

/** The page's own actions, the ones the toolbar calls: the menu has no second path. */
export interface MenuActions {
    sync: () => void;
    exportBooks: () => void;
    deleteBook: () => void;
    back: () => void;
    setView: (mode: ViewMode) => void;
    setSort: (sort: SortPreference) => void;
    selectReader: (id: number) => void;
}

/** Set once by the page; the items call whatever is current, so a rebuild needs nothing passed again. */
export function setMenuActions(next: MenuActions) {
    actions = next;
}

type StatefulItem = MenuItem | CheckMenuItem;

/** The items the page drives, by id, and what was last pushed to each: only changes cross to the menu. */
let refs = new Map<string, StatefulItem>();
let applied = new Map<string, MenuItemState>();
let latest: MenuState | undefined;
let viewSubmenu: Submenu | undefined;
let readerEntries: { id: number; key: string; item: CheckMenuItem }[] = [];
let readerSeparator: PredefinedMenuItem | undefined;
const noActions: MenuActions = { sync() {}, exportBooks() {}, deleteBook() {}, back() {}, setView() {}, setSort() {}, selectReader() {} };
let actions: MenuActions = noActions;
let queue: Promise<unknown> = Promise.resolve();

function enqueue(job: () => Promise<void>) {
    queue = queue.then(job).catch((error) => console.error('[MENU] Failed to update the menu:', error));
    return queue;
}

/** macOS repeats a held key equivalent on the menu, and Tauri gives no repeat flag: the same item
 * chosen again within this gap is that repeat. */
export const REPEAT_GAP_MS = 300;
const lastRun = new Map<string, number>();

/** What an item does when chosen: only if the page state still has it enabled, and not as a key repeat. */
function guarded(id: string, fn: () => void) {
    return () => {
        const now = Date.now();
        const before = lastRun.get(id);
        const repeat = before !== undefined && now - before >= 0 && now - before < REPEAT_GAP_MS;
        if (!repeat && latest?.items[id]?.enabled === true) {
            lastRun.set(id, now);
            fn();
        }
        // A check flips on its own when chosen: put it back to what the page says
        void resyncMenuState();
    };
}

async function syncReaders() {
    const wanted = latest?.readers ?? [];
    const key = JSON.stringify(wanted);
    if (!viewSubmenu) return;
    if (key === JSON.stringify(readerEntries.map((e) => ({ id: e.id, text: e.key })))) return;
    // Bookkeeping is dropped even if the menu refuses a removal, so one failure cannot repeat forever
    const stale = [...readerEntries.map((e) => e.item), ...(readerSeparator ? [readerSeparator] : [])];
    for (const entry of readerEntries) {
        refs.delete(`reader-${entry.id}`);
        applied.delete(`reader-${entry.id}`);
    }
    readerSeparator = undefined;
    readerEntries = [];
    for (const item of stale) {
        try {
            await viewSubmenu.remove(item);
        } catch (error) {
            console.error('[MENU] Failed to remove a Reader from the menu:', error);
        }
    }
    if (wanted.length === 0) return;
    readerSeparator = await PredefinedMenuItem.new({ item: 'Separator' });
    await viewSubmenu.append(readerSeparator);
    for (const reader of wanted) {
        const item = await CheckMenuItem.new({
            id: `reader-${reader.id}`,
            text: reader.text,
            enabled: false,
            checked: false,
            action: guarded(`reader-${reader.id}`, () => actions.selectReader(reader.id))
        });
        await viewSubmenu.append(item);
        refs.set(`reader-${reader.id}`, item);
        readerEntries.push({ id: reader.id, key: reader.text, item });
    }
}

async function flush(force: boolean) {
    if (!latest) return;
    const failures: unknown[] = [];
    try {
        await syncReaders();
    } catch (error) {
        failures.push(error);
    }
    for (const [id, state] of Object.entries(latest.items)) {
        const item = refs.get(id);
        if (!item) continue;
        const before = force ? undefined : applied.get(id);
        try {
            if (before?.enabled !== state.enabled) await item.setEnabled(state.enabled);
            if (state.checked !== undefined && before?.checked !== state.checked) await (item as CheckMenuItem).setChecked(state.checked);
            if (state.text !== undefined && before?.text !== state.text) await item.setText(state.text);
            applied.set(id, { ...state });
        } catch (error) {
            applied.delete(id);
            failures.push(error);
        }
    }
    if (failures.length > 0) throw failures[0];
}

/** The page's state for the menu: applied now, or as soon as the menu exists. */
export function applyMenuState(state: MenuState) {
    latest = state;
    return enqueue(() => flush(false));
}

/** A check flips on its own when chosen: put it back to what the page says. */
function resyncMenuState() {
    return enqueue(() => flush(true));
}



/** The File menu's item, kept so that an export can enable it without rebuilding the menu. */
let revealLastExportItem: MenuItem | undefined;

/** «Mostrar última exportação no Finder» works once an export has worked in this session. */
export async function setRevealLastExportEnabled(enabled: boolean) {
    try {
        await revealLastExportItem?.setEnabled(enabled);
    } catch (error) {
        console.error('[MENU] Failed to update the File menu:', error);
    }
}

/** `activeReaderId` and `lastExport` are read when the item is chosen: the menu is rebuilt
 * only when the language changes. */
export function createApplicationMenu(
    t: MessageFormatter,
    activeReaderId: () => number | null = () => null,
    lastExport: () => string[] = () => []
) {
    // Inside the queue, so a state being applied never meets a half-built menu
    return enqueue(() => buildApplicationMenu(t, activeReaderId, lastExport));
}

async function buildApplicationMenu(t: MessageFormatter, activeReaderId: () => number | null, lastExport: () => string[]) {
    const nextRefs = new Map<string, StatefulItem>();
    try {
        // App Menu (macOS: Khi)
        const settingsItem = await MenuItem.new({
            id: 'settings',
            text: t('settings.title') + '…',
            accelerator: 'CmdOrCtrl+,',
            action: () => {
                // Settings live in their own window (one only), opened by Rust
                commands.openSettings(t('settings.windowTitle'), activeReaderId()).catch((error) =>
                    console.error('[MENU] Failed to open settings:', error)
                );
            }
        });

        const checkForUpdatesItem = await MenuItem.new({
            id: 'check-for-updates',
            text: t('updates.menu.checkForUpdates'),
            action: () => {
                emit('check-for-updates');
            }
        });

        let icon: Image | undefined;
        try {
            const iconPath = await resolveResource('icons/icon_512x512.png');
            icon = await Image.fromPath(iconPath);
        } catch {
            console.warn('[MENU] Failed to load app icon for About panel');
        }

        const appMenu = await Submenu.new({
            text: 'Khi',
            items: [
                await PredefinedMenuItem.new({
                    text: t('app.native.about'),
                    item: {
                        About: {
                            name: 'Khi',
                            copyright: 'Copyright © 2026 Bruno Monteiro. All rights reserved.',
                            ...(icon && { icon }),
                        }
                    }
                }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                settingsItem,
                checkForUpdatesItem,
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'Services', text: t('app.native.services') }),
                await PredefinedMenuItem.new({ item: 'Hide', text: t('app.native.hide') }),
                await PredefinedMenuItem.new({ item: 'HideOthers', text: t('app.native.hideOthers') }),
                await PredefinedMenuItem.new({ item: 'ShowAll', text: t('app.native.showAll') }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'Quit', text: t('app.native.quit') })
            ]
        });

        // File Menu: the files of the last export of the session, which are chosen again in the Finder
        const revealLastExport = await MenuItem.new({
            id: 'reveal-last-export',
            text: t('app.menuRevealLastExport'),
            enabled: lastExport().length > 0,
            action: () => {
                const paths = lastExport();
                if (paths.length === 0) return;
                revealItemInDir(paths).catch((error) => {
                    console.error('[MENU] Failed to show the last export in the Finder:', error);
                    notify(t('notifications.showInFinderError'));
                });
            }
        });
        revealLastExportItem = revealLastExport;
        // A rebuild (the language changed) starts from the session's state, not from the one it was built with
        await setRevealLastExportEnabled(lastExport().length > 0);
        const syncItem = await MenuItem.new({
            id: 'sync',
            text: t('app.menuSync'),
            accelerator: 'CmdOrCtrl+R',
            enabled: false,
            action: guarded('sync', () => actions.sync())
        });
        const exportItem = await MenuItem.new({
            id: 'export',
            text: t('ui.windowBar.export', { count: 0 }),
            accelerator: 'CmdOrCtrl+E',
            enabled: false,
            action: guarded('export', () => actions.exportBooks())
        });
        const fileMenu = await Submenu.new({
            text: t('app.menuFile'),
            items: [
                syncItem,
                exportItem,
                await PredefinedMenuItem.new({ item: 'Separator' }),
                revealLastExport,
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'CloseWindow', text: t('app.native.closeWindow') })
            ]
        });

        // Edit Menu (Essential for input fields)
        const editMenu = await Submenu.new({
            text: t('app.menuEdit'),
            items: [
                await PredefinedMenuItem.new({ item: 'Undo', text: t('app.native.undo') }),
                await PredefinedMenuItem.new({ item: 'Redo', text: t('app.native.redo') }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'Cut', text: t('app.native.cut') }),
                await PredefinedMenuItem.new({ item: 'Copy', text: t('app.native.copy') }),
                await PredefinedMenuItem.new({ item: 'Paste', text: t('app.native.paste') }),
                await PredefinedMenuItem.new({ item: 'SelectAll', text: t('app.native.selectAll') })
            ]
        });

        // View Menu: the view, the sort and, with two Readers or more, their Libraries
        const gridItem = await CheckMenuItem.new({
            id: 'view-grid',
            text: t('app.menuViewGrid'),
            accelerator: 'CmdOrCtrl+1',
            enabled: false,
            checked: false,
            action: guarded('view-grid', () => actions.setView('grid'))
        });
        const listItem = await CheckMenuItem.new({
            id: 'view-list',
            text: t('app.menuViewList'),
            accelerator: 'CmdOrCtrl+2',
            enabled: false,
            checked: false,
            action: guarded('view-list', () => actions.setView('list'))
        });
        const sortItems: CheckMenuItem[] = [];
        for (const sort of SORT_ORDER) {
            const item = await CheckMenuItem.new({
                id: `sort-${sort}`,
                text: t(SORT_KEYS[sort]),
                enabled: false,
                checked: false,
                action: guarded(`sort-${sort}`, () => actions.setSort(sort))
            });
            sortItems.push(item);
            nextRefs.set(`sort-${sort}`, item);
        }
        const sortMenu = await Submenu.new({ text: t('app.menuSortBy'), items: sortItems });
        const viewMenu = await Submenu.new({
            text: t('app.menuView'),
            items: [gridItem, listItem, await PredefinedMenuItem.new({ item: 'Separator' }), sortMenu]
        });

        // Book Menu: only inside a book
        const backItem = await MenuItem.new({
            id: 'back',
            text: t('app.menuBackToLibrary'),
            accelerator: 'CmdOrCtrl+[',
            enabled: false,
            action: guarded('back', () => actions.back())
        });
        const deleteItem = await MenuItem.new({
            id: 'delete',
            text: t('app.menuDelete'),
            accelerator: 'CmdOrCtrl+Backspace',
            enabled: false,
            action: guarded('delete', () => actions.deleteBook())
        });
        const bookMenu = await Submenu.new({
            text: t('app.menuBook'),
            items: [backItem, await PredefinedMenuItem.new({ item: 'Separator' }), deleteItem]
        });
        for (const [id, item] of [['sync', syncItem], ['export', exportItem], ['view-grid', gridItem], ['view-list', listItem], ['back', backItem], ['delete', deleteItem]] as const) {
            nextRefs.set(id, item);
        }

        // Window Menu: ⌘M and Zoom (macOS maps Maximize to it)
        const windowMenu = await Submenu.new({
            text: t('app.menuWindow'),
            items: [
                await PredefinedMenuItem.new({ item: 'Minimize', text: t('app.native.minimize') }),
                await PredefinedMenuItem.new({ item: 'Maximize', text: t('app.native.maximize') })
            ]
        });

        // Create the menu
        const menu = await Menu.new({
            id: 'main-menu',
            items: [appMenu, fileMenu, editMenu, viewMenu, bookMenu, windowMenu]
        });

        // Set as application menu
        await menu.setAsAppMenu();
        // Only now does the new menu replace the old one's bookkeeping
        refs = nextRefs;
        applied = new Map();
        lastRun.clear();
        readerEntries = [];
        readerSeparator = undefined;
        viewSubmenu = viewMenu;
        // The page's state may have arrived before the menu did, or been for the one it replaces
        await flush(true);
    } catch (error) {
        console.error('[MENU] Failed to create application menu:', error);
    }
}
