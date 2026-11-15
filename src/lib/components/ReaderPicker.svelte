<!--
  ReaderPicker: switches the Reader whose Library is on screen.
  Only shown when there is more than one Reader (R4).
-->
<script lang="ts">
	import { _ } from '$lib/i18n';
	import type { Reader } from '../types';

	interface Props {
		readers: Reader[];
		activeReaderId: number | null;
		onSelect: (readerId: number) => void;
	}

	let { readers, activeReaderId, onSelect }: Props = $props();

	/** The picker shows the open Reader: a choice asks to open another and
	 * the picker follows activeReaderId, so a failed open leaves it as is. */
	function handleChange(event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		const chosen = Number(select.value);
		select.value = activeReaderId === null ? '' : String(activeReaderId);
		onSelect(chosen);
	}
</script>

{#if readers.length > 1}
	<label class="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
		<span class="sr-only">{$_('readers.label')}</span>
		<select
			data-testid="reader-picker"
			class="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-2 py-1 text-sm"
			value={activeReaderId === null ? '' : String(activeReaderId)}
			onchange={handleChange}
		>
			{#each readers as reader (reader.id)}
				<option value={String(reader.id)}>{reader.name}</option>
			{/each}
		</select>
	</label>
{/if}
