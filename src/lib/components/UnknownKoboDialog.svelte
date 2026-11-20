<!--
  UnknownKoboDialog: asks whose Kobo this is before its first Sync (R7). Ecrã 6 · Kobo novo (Figma 58:6794
  with Readers, 62:2147 with «Novo leitor…»), on the Janela modal (Task 23): a pop-up of the Readers, a
  separator and «Novo leitor…», which brings the «Nome» row. With no Reader at all the Kobo is never asked
  about (R1): the store makes one named after it.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { _ } from '$lib/i18n';
	import * as Dialog from './ui/dialog';
	import { FormRow } from './ui/form';
	import { Input } from './ui/input';
	import { Select, type SelectItem } from './ui/select';
	import type { Reader } from '../types';

	interface Props {
		readers: Reader[];
		/** The Reader whose Library is open, if any: the pop-up starts on it (Q3). */
		activeReaderId?: number | null;
		/** The Reader of the last session: the pop-up starts on it with no Library open (Q3). */
		lastReaderId?: number | null;
		/** A promise keeps the window busy until it answers. */
		onChoose: (readerId: number) => void | Promise<void>;
		onCreate: (name: string) => void | Promise<void>;
		/** Esc, ⌘., Cancelar: the Kobo is not asked about again until it is unplugged and plugged back in. */
		onCancel: () => void;
	}

	let { readers, activeReaderId = null, lastReaderId = null, onChoose, onCreate, onCancel }: Props = $props();

	const NEW = 'new';

	/** The open Library's Reader, else the last one, else the first (Q3); an id that is no Reader is skipped. */
	function preselected(): string {
		const known = (id: number | null) => (id !== null && readers.some((reader) => reader.id === id) ? id : null);
		return String(known(activeReaderId) ?? known(lastReaderId) ?? readers[0]?.id ?? NEW);
	}

	// While a Reader is being made or chosen, the window answers nothing: Cancelar, Esc and ⌘. would leave it behind
	let busy = $state(false);
	let content = $state<HTMLElement | null>(null);
	let choice = $state(untrack(preselected));
	// Empty (Q4): the Kobo's name is not a name for its Reader
	let name = $state('');
	let nameField = $state<HTMLInputElement | null>(null);
	const trimmed = $derived(name.trim());
	const creating = $derived(choice === NEW);

	const items = $derived<SelectItem[]>([
		...readers.map((reader) => ({ value: String(reader.id), label: reader.name })),
		{ value: NEW, label: $_('readers.newReaderOption'), separatorBefore: readers.length > 0 }
	]);

	// The name takes focus once the pop-up has given it back: Bits UI returns focus to its trigger as it closes
	let focusName = false;
	function handleChoice(value: string) {
		focusName = value === NEW;
	}
	function handlePopUpOpenChange(isOpen: boolean) {
		if (isOpen) return;
		// Closed with a choice or without one: the window keeps the focus, so Return still presses its default button
		const toName = focusName;
		focusName = false;
		setTimeout(() => (toName ? nameField : content)?.focus({ preventScroll: true }), 0);
	}

	async function confirm() {
		if (busy) return;
		busy = true;
		try {
			if (creating) {
				if (trimmed !== '') await onCreate(trimmed);
			} else await onChoose(Number(choice));
		} finally {
			busy = false;
		}
	}
</script>

<!-- Always open: the page unmounts it, and a refusal (busy) must leave it standing -->
<Dialog.Root
	bind:open={() => true, (isOpen) => !isOpen && !busy && onCancel()}
>
	<Dialog.Content bind:ref={content} data-testid="unknown-kobo-dialog">
		<Dialog.Title>{$_('readers.unknownKoboTitle')}</Dialog.Title>
		<Dialog.Description>{$_('readers.unknownKoboSubtitle')}</Dialog.Description>

		<div class="flex flex-col gap-2 pt-4">
			<FormRow label={$_('readers.label')} class="min-h-0 gap-2 p-0 [&_[data-slot=form-row-label]]:text-right">
				{#snippet control({ labelId })}
					<Select
						bind:value={choice}
						{items}
						aria-labelledby={labelId}
						class="w-67"
						onValueChange={handleChoice}
						onOpenChange={handlePopUpOpenChange}
					/>
				{/snippet}
			</FormRow>
			{#if creating}
				<FormRow label={$_('readers.name')} class="min-h-0 gap-2 p-0 [&_[data-slot=form-row-label]]:text-right">
					{#snippet control({ labelId })}
						<Input bind:value={name} bind:ref={nameField} aria-labelledby={labelId} class="w-67" />
					{/snippet}
				</FormRow>
			{/if}
		</div>

		<Dialog.Footer>
			<Dialog.Close disabled={busy}>{$_('readers.cancel')}</Dialog.Close>
			<Dialog.Action disabled={busy || (creating && trimmed === '')} onclick={confirm}>
				{creating ? $_('readers.create') : $_('readers.choose')}
			</Dialog.Action>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
