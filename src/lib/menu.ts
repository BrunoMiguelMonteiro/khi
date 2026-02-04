import { Menu, Submenu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { emit } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
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

        const appMenu = await Submenu.new({
            text: 'Khi',
            items: [
                // About item invoking native panel via Rust command
                await MenuItem.new({
                    id: 'about',
                    text: 'About Khi',
                    action: () => {
                        invoke('show_about'); 
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
