import { Menu, Submenu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { emit } from '@tauri-apps/api/event';
import { Image } from '@tauri-apps/api/image';
import { resolveResource } from '@tauri-apps/api/path';
import type { MessageFormatter } from '$lib/i18n';

export async function createApplicationMenu(t: MessageFormatter) {
    try {
        // App Menu (macOS: Khi)
        const settingsItem = await MenuItem.new({
            id: 'settings',
            text: t('settings.title') + '...',
            accelerator: 'CmdOrCtrl+,',
            action: () => {
                emit('open-settings');
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
                            version: '0.1.0',
                            copyright: 'Copyright © 2026 Bruno Monteiro. All rights reserved.',
                            ...(icon && { icon }),
                        }
                    }
                }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                settingsItem,
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'Services' }),
                await PredefinedMenuItem.new({ item: 'Hide' }),
                await PredefinedMenuItem.new({ item: 'HideOthers' }),
                await PredefinedMenuItem.new({ item: 'ShowAll' }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'Quit' })
            ]
        });

        // Edit Menu (Essential for input fields)
        const editMenu = await Submenu.new({
            text: 'Edit',
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

        // Create the menu
        const menu = await Menu.new({
            id: 'main-menu',
            items: [appMenu, editMenu]
        });

        // Set as application menu
        await menu.setAsAppMenu();
    } catch (error) {
        console.error('[MENU] Failed to create application menu:', error);
    }
}
