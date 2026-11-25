<!--
  The Settings window (label `settings`), opened by Rust with ⌘, or the gear.
  The layout loads the settings, the theme and the language, as in the main
  window. Every control writes at the moment it changes, so there is nothing
  to save or cancel: Esc, ⌘W and the red button only close the window.

  The window is as tall as the pane on show: this page measures it and sets
  the size, then shows the window (Rust built it hidden).
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { emit, listen } from '@tauri-apps/api/event';
	import { getCurrentWindow } from '@tauri-apps/api/window';
	import SettingsPanel from '$lib/components/SettingsPanel.svelte';
	import { TooltipProvider } from '$lib/components/ui/tooltip';
	import { commands, type SettingsPane } from '$lib/bindings';
	import { _ } from '$lib/i18n';
	import { library } from '$lib/stores/library.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { UPDATES_STATE_EVENT, UPDATES_STATE_REQUEST_EVENT, updater, type UpdatesStatePayload } from '$lib/stores/updater.svelte';

	const appWindow = getCurrentWindow();
	let panel: ReturnType<typeof SettingsPanel> | undefined;
	let frame = $state<HTMLElement | null>(null);

	const pane = $derived<SettingsPane>(settings.uiPreferences.settingsPane ?? 'kobo');
	const titles = $derived<Record<SettingsPane, string>>({
		export: $_('settings.tabs.export'),
		appearance: $_('settings.tabs.appearance'),
		kobo: $_('settings.tabs.kobo'),
		updates: $_('updates.settings.tab'),
		agents: $_('settings.tabs.agents')
	});

	function choosePane(next: SettingsPane) {
		settings.setSettingsPane(next);
		settings
			.commit(['uiPreferences.settingsPane'])
			.catch((error) => console.error('Failed to save the pane:', error));
	}

	function close() {
		appWindow.close().catch((error) => console.error('Failed to close settings:', error));
	}

	// The window is as tall as the pane, so the page never scrolls. A taller pane is drawn a frame before
	// the window grows: with a mouse macOS shows classic scrollbars, one appeared, took its width and the
	// pane shook.
	$effect(() => {
		const root = document.documentElement;
		root.style.overflow = 'hidden';
		return () => {
			root.style.overflow = '';
		};
	});

	// The height follows the pane; the window shows only after its first size, so it never appears
	// at another height. The calls go one after another.
	let lastHeight = 0;
	let lastTitle = '';
	let shown = false;
	let sizing: Promise<unknown> = Promise.resolve();
	function fit() {
		if (!frame || !settings.loaded) return;
		const height = Math.ceil(frame.getBoundingClientRect().height);
		if (height <= 0) return;
		if (height !== lastHeight) {
			lastHeight = height;
			// Animated once the window shows, as macOS's own Settings windows: an instant resize made the bar shake as it grew
			const animate = shown;
			sizing = sizing.then(() =>
				commands.sizeSettingsWindow(height, animate).catch((error) => console.error('Failed to size the window:', error))
			);
		}
		// The window's name (Window menu, Mission Control) is the pane's, in the language of the window; the
		// title itself is hidden. Set after the size: a title change puts the traffic lights back at the
		// height the window has then, and before the new size they jumped when the window grew.
		const title = titles[pane];
		if (title !== lastTitle) {
			lastTitle = title;
			sizing = sizing.then(() =>
				appWindow.setTitle(title).catch((error) => console.error('Failed to set the window title:', error))
			);
		}
		if (!shown) {
			shown = true;
			sizing = sizing.then(() =>
				appWindow.show().catch((error) => console.error('Failed to show the window:', error))
			);
		}
	}
	$effect(() => {
		if (!frame || typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(fit);
		observer.observe(frame);
		return () => observer.disconnect();
	});
	// Loaded, or another pane or language: the layout is settled after this tick
	$effect(() => {
		settings.loaded;
		pane;
		titles;
		tick().then(fit);
	});

	function handleKeydown(event: KeyboardEvent) {
		// Bits UI (a pop-up, a tooltip) has handled an Esc it owns: it only closes that, as in the main window
		if (event.key === 'Escape' && !event.defaultPrevented) close();
	}

	/** The main window has the updater and its dialog. */
	function checkForUpdates() {
		emit('check-for-updates').catch((error) => console.error('Failed to ask for an update check:', error));
	}

	/** The Reader the main window sent when it opened Settings; else the last one opened (R5); else
	 * the first there is (a Reader created with Settings open has not been opened anywhere yet). */
	async function currentReaderId(): Promise<number | null> {
		return (await commands.settingsReader()) ?? (await commands.lastReader()) ?? library.readers[0]?.id ?? null;
	}

	/** Loads the Readers and the one this window shows. */
	async function loadReader() {
		try {
			await library.loadReaders();
			library.activeReaderId = await currentReaderId();
		} catch (error) {
			console.error('Failed to load the reader:', error);
		}
	}

	/** ⌘, again with another Reader on screen: this window follows it, after saving a name half-typed. */
	async function followReader(readerId: number) {
		try {
			await panel?.commitName();
			await library.loadReaders();
			library.activeReaderId = readerId;
		} catch (error) {
			console.error('Failed to load the reader:', error);
		}
	}

	// The red button, ⌘W and Esc (which calls close()) all end in a close request. A name half-typed has not
	// left its field, so the request is held, the name saved, and the window destroyed (Tauri's own
	// handler does that, but only when nothing held the request).
	async function beforeClose(event: { preventDefault(): void }) {
		event.preventDefault();
		try {
			await panel?.commitName();
		} catch (error) {
			console.error('Failed to save the name before closing:', error);
		}
		appWindow.destroy().catch((error) => console.error('Failed to close settings:', error));
	}

	onMount(() => {
		loadReader();
		let unlistenClose: (() => void) | undefined;
		appWindow
			.onCloseRequested(beforeClose)
			.then((fn) => (unlistenClose = fn))
			.catch((error) => console.error('Failed to listen for the window closing:', error));
		let unlistenReader: (() => void) | undefined;
		listen<number>('settings-reader', (event) => followReader(event.payload))
			.then((fn) => (unlistenReader = fn))
			.catch((error) => console.error('Failed to listen for the Reader:', error));
		// A Reader created (a new Kobo), renamed or given another folder, here or in the main window
		let unlistenReaders: (() => void) | undefined;
		listen('readers-changed', async () => {
			try {
				await library.loadReaders();
				// The first Reader appears with Settings open: Export and Kobo show its folder and name
				if (library.activeReaderId === null) library.activeReaderId = await currentReaderId();
			} catch (error) {
				console.error('Failed to reload the readers:', error);
			}
		})
			.then((fn) => (unlistenReaders = fn))
			.catch((error) => console.error('Failed to listen for the readers:', error));
		// The updater is the main window's: this one shows its state (the time of the last check, and whether it is busy)
		let unlistenUpdates: (() => void) | undefined;
		let destroyed = false;
		// It may have checked before this window opened: it asks, but only once it listens for the answer
		listen<UpdatesStatePayload>(UPDATES_STATE_EVENT, (event) => updater.adopt(event.payload))
			.then((fn) => {
				if (destroyed) return fn();
				unlistenUpdates = fn;
				return emit(UPDATES_STATE_REQUEST_EVENT);
			})
			.catch((error) => console.error('Failed to follow the updater state:', error));
		return () => {
			destroyed = true;
			unlistenUpdates?.();
			unlistenClose?.();
			unlistenReader?.();
			unlistenReaders?.();
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<TooltipProvider>
	<SettingsPanel
		bind:this={panel}
		bind:frame
		{pane}
		onpane={choosePane}
		onCheckNow={checkForUpdates}
	/>
</TooltipProvider>
