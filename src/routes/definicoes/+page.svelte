<!--
  The Settings window (label `settings`), opened by Rust with ⌘, or the gear.
  The layout loads the settings, the theme and the language, as in the main
  window; the language previewed here changes only this window.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { emit, listen } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import { commands } from '$lib/bindings';
	import { t } from '$lib/i18n';
	import { library } from '$lib/stores/library.svelte';
	import { settings } from '$lib/stores/settings.svelte';

	const appWindow = getCurrentWindow();
	let panel: ReturnType<typeof SettingsPanel> | undefined;

	function close() {
		appWindow.close().catch((error) => console.error('Failed to close settings:', error));
	}

	/** The saved language names the window (Save, or Reset). */
	function updateTitle() {
		appWindow
			.setTitle(t('settings.windowTitle'))
			.catch((error) => console.error('Failed to set the window title:', error));
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') close();
	}

	/** The main window has the updater and its dialog. */
	function checkForUpdates() {
		emit('check-for-updates').catch((error) => console.error('Failed to ask for an update check:', error));
	}

	/** The Reader the main window shows, sent when it opened Settings; else
	 * the last one opened (R5). */
	async function loadReader() {
		try {
			await library.loadReaders();
			library.activeReaderId = (await commands.settingsReader()) ?? (await commands.lastReader());
		} catch (error) {
			console.error('Failed to load the reader:', error);
		}
	}

	/** ⌘, again with another Reader on screen: this window follows it, unless
	 * a name or folder is half-typed for the current one. */
	async function followReader(readerId: number) {
		if (panel?.hasReaderDraft()) return;
		try {
			await library.loadReaders();
			if (!panel?.hasReaderDraft()) library.activeReaderId = readerId;
		} catch (error) {
			console.error('Failed to load the reader:', error);
		}
	}

	onMount(() => {
		loadReader();
		// Red button, ⌘W or Esc without Save: the previewed language goes, and
		// nothing is emitted (only a save emits settings-changed)
		let unlisten: (() => void) | undefined;
		appWindow
			.onCloseRequested(() => settings.revertUnsavedLanguage())
			.then((fn) => (unlisten = fn))
			.catch((error) => console.error('Failed to watch the window closing:', error));
		let unlistenReader: (() => void) | undefined;
		listen<number>('settings-reader', (event) => followReader(event.payload))
			.then((fn) => (unlistenReader = fn))
			.catch((error) => console.error('Failed to listen for the Reader:', error));
		return () => {
			unlisten?.();
			unlistenReader?.();
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<SettingsPanel bind:this={panel} onClose={close} onSave={updateTitle} onCheckNow={checkForUpdates} />
