<script lang="ts">
	// Test fixture for tabs.test.ts: the three Definições tabs of the v2, with value bound to the
	// fixture's own state; onbound reports each value.
	import FileOutput from 'lucide-svelte/icons/file-output';
	import Palette from 'lucide-svelte/icons/palette';
	import Tablet from 'lucide-svelte/icons/tablet';
	import { _ } from '$lib/i18n';
	import { Tabs, TabsContent, TabsList, TabsTrigger } from './index';

	let {
		value = $bindable('export'),
		onbound
	}: { value?: string; onbound?: (value: string) => void } = $props();

	$effect.pre(() => onbound?.(value));
</script>

<Tabs bind:value>
	<TabsList aria-label={$_('settings.tabs.label')}>
		<TabsTrigger value="export" icon={FileOutput}>{$_('settings.tabs.export')}</TabsTrigger>
		<TabsTrigger value="appearance" icon={Palette}>{$_('settings.tabs.appearance')}</TabsTrigger>
		<TabsTrigger value="kobo" icon={Tablet}>{$_('settings.tabs.kobo')}</TabsTrigger>
	</TabsList>
	<TabsContent value="export">Export panel</TabsContent>
	<TabsContent value="appearance">Appearance panel</TabsContent>
	<TabsContent value="kobo">Kobo panel</TabsContent>
</Tabs>
