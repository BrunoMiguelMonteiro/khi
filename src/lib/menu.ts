import { Menu, Submenu, MenuItem, PredefinedMenuItem } from '@tauri-apps/api/menu';
import { emit } from '@tauri-apps/api/event';
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
            text: t('app.name'),
            items: [
                await PredefinedMenuItem.new({ item: 'About' }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                settingsItem,
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'Hide' }),
                await PredefinedMenuItem.new({ item: 'HideOthers' }),
                await PredefinedMenuItem.new({ item: 'ShowAll' }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'Quit' })
            ]
        });

        // Edit Menu (Essential for input fields)
        const editMenu = await Submenu.new({
            text: 'Edit', // macOS usually handles translation of standard menus automatically, but we set it just in case
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

        // Window Menu
        const windowMenu = await Submenu.new({
            text: 'Window',
            items: [
                await PredefinedMenuItem.new({ item: 'Minimize' }),
                await PredefinedMenuItem.new({ item: 'Zoom' }),
                await PredefinedMenuItem.new({ item: 'Separator' }),
                await PredefinedMenuItem.new({ item: 'CloseWindow' })
            ]
        });

        // Create the menu
        const menu = await Menu.new({
            items: [appMenu, editMenu, windowMenu]
        });

        // Set as application menu
        await menu.setAsAppMenu();
        
        console.log('Application menu created successfully');
    } catch (error) {
        console.error('Failed to create application menu:', error);
    }
}
