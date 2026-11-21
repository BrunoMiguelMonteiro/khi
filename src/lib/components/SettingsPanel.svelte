<!--
  SettingsPanel: the Settings window (Task 45). A bar of 89 px drawn under the Overlay title bar,
  whose first row is the traffic lights (the native title is hidden) and whose second row is the tabs, over
  the pane. The window is as tall as the pane (the page measures `frame`); every control writes at
  the moment it changes, so there is no Save, Cancel or Reset.
-->
<script lang="ts">
	import CircleArrowDown from 'lucide-svelte/icons/circle-arrow-down';
	import FileOutput from 'lucide-svelte/icons/file-output';
	import Palette from 'lucide-svelte/icons/palette';
	import Tablet from 'lucide-svelte/icons/tablet';
	import type { SettingsPane } from '$lib/bindings';
	import { _ } from '$lib/i18n';
	import { settings } from '../stores/settings.svelte';
	import { updater } from '../stores/updater.svelte';
	import AppearancePane from './settings/AppearancePane.svelte';
	import ExportPane from './settings/ExportPane.svelte';
	import KoboPane from './settings/KoboPane.svelte';
	import UpdatesPane from './settings/UpdatesPane.svelte';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

	interface Props {
		/** The pane on show. */
		pane: SettingsPane;
		onpane?: (pane: SettingsPane) => void;
		/** The window's content, which the page measures to size the window. */
		frame?: HTMLElement | null;
		/** «Check Now»; by default this window's updater checks. */
		onCheckNow?: () => void;
	}

	let { pane, onpane, frame = $bindable(null), onCheckNow = () => updater.checkNow() }: Props = $props();

	let koboPane: ReturnType<typeof KoboPane> | undefined;
	/** A name half-typed in the Kobo pane is saved before another Reader is followed. */
	export function commitName(): Promise<void> {
		return koboPane?.commitName() ?? Promise.resolve();
	}

	/** What failed to save, for the user: the pane keeps its old value. */
	let saveError = $state<string | null>(null);

	const tabs = $derived([
		{ value: 'kobo', icon: Tablet, label: $_('settings.tabs.kobo') },
		{ value: 'appearance', icon: Palette, label: $_('settings.tabs.appearance') },
		{ value: 'export', icon: FileOutput, label: $_('settings.tabs.export') },
		{ value: 'updates', icon: CircleArrowDown, label: $_('updates.settings.tab') }
	] as const);
	const title = $derived(tabs.find((tab) => tab.value === pane)?.label ?? '');
</script>

<!-- Tabs is the window's frame: the bar and the pane, as tall as they are -->
<Tabs
	bind:ref={frame}
	bind:value={() => pane, (value) => onpane?.(value as SettingsPane)}
	data-slot="settings-window"
	class="bg-background text-foreground"
>
	<!-- 89 px: py-2, the first row (the traffic lights), gap-2, and the tabs -->
	<div
		data-slot="settings-bar"
		data-tauri-drag-region
		class="flex h-[89px] shrink-0 flex-col gap-2 border-b-(length:--stroke-border) border-border bg-background py-2"
	>
		<h1 class="sr-only">{title}</h1>
		<div data-tauri-drag-region class="min-h-0 flex-1"></div>
		<TabsList aria-label={$_('settings.tabs.label')} class="border-b-0">
			{#each tabs as tab (tab.value)}
				<TabsTrigger value={tab.value} icon={tab.icon}>{tab.label}</TabsTrigger>
			{/each}
		</TabsList>
	</div>

	<TabsContent value="kobo" class="flex flex-col gap-6 p-6">
		<KoboPane bind:this={koboPane} onerror={(message) => (saveError = message)} />
	</TabsContent>
	<TabsContent value="appearance" class="flex flex-col gap-6 p-6">
		<AppearancePane onerror={(message) => (saveError = message)} />
	</TabsContent>
	<TabsContent value="export" class="flex flex-col gap-6 p-6">
		<ExportPane onerror={(message) => (saveError = message)} />
	</TabsContent>
	<TabsContent value="updates" class="flex flex-col gap-6 p-6">
		<UpdatesPane
			version={updater.currentVersion}
			lastChecked={updater.lastChecked}
			busy={updater.busy}
			onCheckNow={() => onCheckNow()}
			onerror={(message) => (saveError = message)}
		/>
	</TabsContent>

	{#if saveError}
		<p role="alert" class="px-6 pb-6 text-callout text-destructive-text">{saveError}</p>
	{/if}
</Tabs>
