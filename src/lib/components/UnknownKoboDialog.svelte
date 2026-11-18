<!--
  UnknownKoboDialog: asks whose Kobo this is before its first Sync (R7).
  Choose an existing Reader, or create one named after the Kobo by default (R1).
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { _ } from '$lib/i18n';
	import Button from './Button.svelte';
	import type { KoboDevice, Reader } from '../types';

	interface Props {
		device: KoboDevice;
		readers: Reader[];
		onChoose: (readerId: number) => void;
		onCreate: (name: string) => void;
	}

	let { device, readers, onChoose, onCreate }: Props = $props();

	// Starts from the Kobo's name; the user may type another (R1)
	let newName = $state(untrack(() => device.name));
	const trimmed = $derived(newName.trim());
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
	role="dialog"
	aria-modal="true"
	aria-labelledby="unknown-kobo-title"
	data-testid="unknown-kobo-dialog"
>
	<div class="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 p-6 shadow-xl flex flex-col gap-5">
		<div class="flex flex-col gap-1">
			<h2 id="unknown-kobo-title" class="m-0 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
				{$_('readers.unknownKoboTitle')}
			</h2>
			<p class="m-0 text-sm text-neutral-600 dark:text-neutral-400">{$_('readers.unknownKoboSubtitle')}</p>
		</div>

		{#if readers.length > 0}
			<section class="flex flex-col gap-2">
				<h3 class="m-0 text-sm font-medium text-neutral-700 dark:text-neutral-300">{$_('readers.existing')}</h3>
				<div class="flex flex-wrap gap-2">
					{#each readers as reader (reader.id)}
						<Button variant="secondary" onclick={() => onChoose(reader.id)}>{reader.name}</Button>
					{/each}
				</div>
			</section>
		{/if}

		<section class="flex flex-col gap-2">
			<h3 class="m-0 text-sm font-medium text-neutral-700 dark:text-neutral-300">{$_('readers.newReader')}</h3>
			<label for="new-reader-name" class="sr-only">{$_('readers.newReaderName')}</label>
			<div class="flex gap-2">
				<input
					id="new-reader-name"
					data-testid="new-reader-name"
					type="text"
					class="flex-1 rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100"
					bind:value={newName}
				/>
				<span data-testid="create-reader" class="contents">
					<Button disabled={trimmed === ''} onclick={() => onCreate(trimmed)}>{$_('readers.create')}</Button>
				</span>
			</div>
		</section>
	</div>
</div>
