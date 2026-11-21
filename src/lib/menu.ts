import { Menu, Submenu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { emit } from '@tauri-apps/api/event';
import { revealItemInDir } from '@tauri-apps/plugin-opener';
import { notify } from '$lib/components/ui/toast/toast-state.svelte';
import { commands } from '$lib/bindings';
import { Image } from '@tauri-apps/api/image';
import { resolveResource } from '@tauri-apps/api/path';
import type { MessageFormatter } from '$lib/i18n';

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
export async function createApplicationMenu(
    t: MessageFormatter,
    activeReaderId: () => number | null = () => null,
    lastExport: () => string[] = () => []
) {
    try {
        // App Menu (macOS: Khi)
        const settingsItem = await MenuItem.new({
            id: 'settings',
            text: t('settings.title') + '...',
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
                await PredefinedMenuItem.new({ item: 'Services' }),
                await PredefinedMenuItem.new({ item: 'Hide' }),
                await PredefinedMenuItem.new({ item: 'HideOthers' }),
                await PredefinedMenuItem.new({ item: 'ShowAll' }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'Quit' })
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
        const fileMenu = await Submenu.new({
            text: t('app.menuFile'),
            items: [revealLastExport]
        });

        // Edit Menu (Essential for input fields)
        const editMenu = await Submenu.new({
            text: t('app.menuEdit'),
            items: [
                await PredefinedMenuItem.new({ item: 'Undo' }),
                await PredefinedMenuItem.new({ item: 'Redo' }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'Cut' }),
                await PredefinedMenuItem.new({ item: 'Copy' }),
                await PredefinedMenuItem.new({ item: 'Paste' }),
                await PredefinedMenuItem.new({ item: 'SelectAll' })
            ]
        });

        // Window Menu: ⌘M and ⌘W, for the main window and Settings
        const windowMenu = await Submenu.new({
            text: t('app.menuWindow'),
            items: [
                await PredefinedMenuItem.new({ item: 'Minimize' }),
                await PredefinedMenuItem.new({ item: 'CloseWindow' })
            ]
        });

        // Create the menu
        const menu = await Menu.new({
            id: 'main-menu',
            items: [appMenu, fileMenu, editMenu, windowMenu]
        });

        // Set as application menu
        await menu.setAsAppMenu();
    } catch (error) {
        console.error('[MENU] Failed to create application menu:', error);
    }
}
