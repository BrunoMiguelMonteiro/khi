<!--
  Definições · Kobo (Task 45). One Reader: its name, and «Sincronizar ao ligar», in one group. Two or
  more (M2): a «Leitor» pop-up and the «Nome» of the one chosen, then «Sincronizar ao ligar» in a
  group of its own, which holds for every Reader. No Reader (the first start): only the switch.
  The name lives in the Library, not in settings.json: it is saved with Return or on leaving the field.
-->
<script lang="ts">
	import { _ } from '$lib/i18n';
	import { library } from '$lib/stores/library.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import { FormGroup, FormRow } from '../ui/form';
	import { Input } from '../ui/input';
	import { Select } from '../ui/select';
	import { Switch } from '../ui/switch';

	let { onerror }: { onerror?: (message: string | null) => void } = $props();

	const readers = $derived(library.readers);
	// The Reader the main window has open; if there is none yet, the first
	const current = $derived(readers.find((r) => r.id === library.activeReaderId) ?? readers[0]);
	const readerItems = $derived(readers.map((r) => ({ value: String(r.id), label: r.name })));

	/** The name being typed, until it is saved (Return, or leaving the field). */
	let draft = $state<string | null>(null);
	let committing = false;

	// Another Reader is shown: what was typed belonged to the last one. The id, not the object: a reload of
	// the list hands out new objects for the same Readers
	const currentId = $derived(current?.id);
	$effect.pre(() => {
		currentId;
		draft = null;
	});

	/** Saves the name typed: empty or unchanged saves nothing, and the field goes back to the saved name. */
	export async function commitName(): Promise<void> {
		if (draft === null || !current || committing) return;
		const name = draft.trim();
		const reader = current;
		if (name === '' || name === reader.name) {
			draft = null;
			return;
		}
		committing = true;
		onerror?.(null);
		try {
			await library.renameReader(reader.id, name);
		} catch (error) {
			console.error('Failed to rename the reader:', error);
			onerror?.($_('settings.errors.renameReader'));
		} finally {
			committing = false;
			draft = null;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			commitName();
		} else if (event.key === 'Escape') {
			// Only the name goes back: the window stays
			event.stopPropagation();
			draft = null;
			(event.currentTarget as HTMLInputElement).value = current?.name ?? '';
		}
	}

	async function chooseReader(value: string) {
		await commitName();
		library.activeReaderId = Number(value);
		draft = null;
	}

	function setSyncOnConnect(checked: boolean) {
		settings.setSyncOnConnect(checked);
		onerror?.(null);
		settings.commit(['uiPreferences.syncOnConnect']).catch(() => onerror?.($_('settings.errors.save')));
	}
</script>

{#snippet nameField(labelId: string, helpId: string | undefined)}
	<Input
		data-testid="reader-name"
		class="w-40"
		value={draft ?? current?.name ?? ''}
		oninput={(event) => (draft = event.currentTarget.value)}
		onblur={commitName}
		onkeydown={handleKeydown}
		aria-labelledby={labelId}
		aria-describedby={helpId}
	/>
{/snippet}

{#snippet syncSwitch(labelId: string, helpId: string | undefined)}
	<Switch
		checked={settings.uiPreferences.syncOnConnect}
		onCheckedChange={setSyncOnConnect}
		aria-labelledby={labelId}
		aria-describedby={helpId}
	/>
{/snippet}

<!--
  The name's row is in one place of the tree for one Reader and for several, so the field keeps its
  focus and its draft when a second Reader turns the pane into M2: only what is around it changes.
-->
<div data-slot="settings-pane-kobo" class="flex flex-col gap-6">
	<FormGroup>
		{#if readers.length >= 2}
			<FormRow label={$_('settings.reader.title')} help={$_('settings.kobo.readerPickHelp')}>
				{#snippet control({ labelId, helpId })}
					<Select
						items={readerItems}
						value={String(current?.id)}
						onValueChange={chooseReader}
						aria-labelledby={labelId}
						aria-describedby={helpId}
					/>
				{/snippet}
			</FormRow>
		{/if}
		{#if current}
			<FormRow
				label={readers.length >= 2 ? $_('settings.reader.name') : $_('settings.kobo.readerName')}
				help={readers.length >= 2 ? $_('settings.kobo.nameHelp') : $_('settings.kobo.readerNameHelp')}
				divider={readers.length >= 2}
			>
				{#snippet control({ labelId, helpId })}
					{@render nameField(labelId, helpId)}
				{/snippet}
			</FormRow>
		{/if}
		<!-- With one Reader (or none) the switch is in this group; with several it has a group of its own -->
		{#if readers.length < 2}
			<FormRow
				label={$_('settings.device.syncOnConnect')}
				help={$_('settings.kobo.syncOnConnectHelp')}
				divider={Boolean(current)}
			>
				{#snippet control({ labelId, helpId })}
					{@render syncSwitch(labelId, helpId)}
				{/snippet}
			</FormRow>
		{/if}
	</FormGroup>
	{#if readers.length >= 2}
		<FormGroup>
			<FormRow label={$_('settings.device.syncOnConnect')} help={$_('settings.kobo.syncOnConnectAllHelp')}>
				{#snippet control({ labelId, helpId })}
					{@render syncSwitch(labelId, helpId)}
				{/snippet}
			</FormRow>
		</FormGroup>
	{/if}
</div>
