<!--
  Definições · Exportação (Task 45): Ficheiros (the folder and the date format) and the metadata to
  include. Every control writes at the moment it changes: there is no Save.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { homeDir } from '@tauri-apps/api/path';
	import { commands } from '$lib/bindings';
	import { chooseExportFolder } from '$lib/export-folder';
	import { abbreviateHome } from '$lib/home-path';
	import { _ } from '$lib/i18n';
	import { settings } from '$lib/stores/settings.svelte';
	import { library } from '$lib/stores/library.svelte';
	import type { ExportConfig } from '$lib/types';
	import { Button } from '../ui/button';
	import { Checkbox } from '../ui/checkbox';
	import { FormGroup, FormRow } from '../ui/form';
	import { Select } from '../ui/select';

	let { onerror }: { onerror?: (message: string | null) => void } = $props();

	const exportConfig = $derived(settings.exportConfig);
	const activeReader = $derived(library.readers.find((r) => r.id === library.activeReaderId));

	// With a Reader open, the folder is that Reader's (R21): Rust says which, as the export decides it
	// (the Reader's own, or the base folder and the name made safe as one folder).
	let readerFolder = $state<string | null>(null);
	$effect(() => {
		const id = activeReader?.id;
		// A Reader renamed, given a folder, or a new base folder: ask again
		activeReader?.name;
		activeReader?.exportPath;
		exportConfig.exportPath;
		if (id === undefined) {
			readerFolder = null;
			return;
		}
		let current = true;
		commands
			.readerExportFolder(id)
			.then((path) => {
				if (current) readerFolder = path;
			})
			.catch((error) => console.error('Failed to read the Reader folder:', error));
		return () => (current = false);
	});
	const folder = $derived(activeReader ? (readerFolder ?? '') : exportConfig.exportPath);
	// The home folder is written «~», as in the Finder; read once, and the full path if there is none
	let home = $state<string | null>(null);
	onMount(() => {
		homeDir()
			.then((path) => (home = path))
			.catch(() => (home = null));
	});
	const shownFolder = $derived(abbreviateHome(folder, home));
	const folderHelp = $derived(
		activeReader
			? $_('settings.export.folderHelp', { path: shownFolder, name: activeReader.name })
			: $_('settings.export.folderHelpNoReader', { path: shownFolder })
	);

	const dateFormats: ExportConfig['dateFormat'][] = ['dd_month_yyyy', 'dd_mm_yyyy', 'iso8601'];
	const dateFormatItems = $derived(
		dateFormats.map((value) => ({ value, label: $_(`settings.export.dateFormats.${value}`) }))
	);

	const failed = () => onerror?.($_('settings.errors.save'));
	/** A new write: the error of the last one is old news. */
	const writing = () => onerror?.(null);

	/** The default folder is stored as null, so it keeps following the base folder and the Reader's name. */
	async function chooseFolder() {
		writing();
		try {
			await chooseExportFolder(folder, activeReader?.id ?? null);
		} catch (error) {
			console.error('Failed to choose the folder:', error);
			failed();
		}
	}

	function setDateFormat(value: string) {
		settings.setDateFormat(value as ExportConfig['dateFormat']);
		writing();
		settings.commit(['exportConfig.dateFormat']).catch(failed);
	}

	function setMetadata(key: keyof ExportConfig['metadata'], checked: boolean) {
		settings.setMetadataOption(key, checked);
		writing();
		settings.commit(['exportConfig.metadata']).catch(failed);
	}
</script>

<div data-slot="settings-pane-export" class="flex flex-col gap-6">
	<FormGroup heading={$_('settings.export.filesGroup')}>
		<FormRow label={$_('settings.export.exportPath')} help={folderHelp}>
			{#snippet control({ helpId })}
				<Button variant="secundario" onclick={chooseFolder} aria-describedby={helpId}>
					{$_('settings.export.choose')}
				</Button>
			{/snippet}
		</FormRow>
		<FormRow label={$_('settings.export.dateFormat')} divider>
			{#snippet control({ labelId })}
				<Select
					items={dateFormatItems}
					value={exportConfig.dateFormat}
					onValueChange={setDateFormat}
					aria-labelledby={labelId}
				/>
			{/snippet}
		</FormRow>
	</FormGroup>

	<FormGroup heading={$_('settings.export.metadataTitle')}>
		<FormRow label={$_('settings.export.metadataTitle')} columns={[firstColumn, secondColumn, thirdColumn]} />
	</FormGroup>
</div>

{#snippet box(key: keyof ExportConfig['metadata'])}
	<Checkbox
		label={$_(`settings.export.metadata.${key}`)}
		checked={exportConfig.metadata[key]}
		onCheckedChange={(checked) => setMetadata(key, checked)}
	/>
{/snippet}
<!-- Three columns of two Caixas, as in the Figma -->
{#snippet firstColumn()}
	{@render box('author')}
	{@render box('dateLastRead')}
{/snippet}
{#snippet secondColumn()}
	{@render box('isbn')}
	{@render box('language')}
{/snippet}
{#snippet thirdColumn()}
	{@render box('publisher')}
	{@render box('description')}
{/snippet}
