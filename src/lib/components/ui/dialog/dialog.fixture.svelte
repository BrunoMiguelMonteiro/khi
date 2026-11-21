<script lang="ts">
	// Test fixture for dialog.test.ts: the concrete windows (Apagar livro, Kobo novo) are Phase 5.
	import * as AlertDialog from '../alert-dialog';
	import * as Dialog from './index';
	import { Input } from '../input';

	let {
		kind = 'apagar',
		onconfirm = () => {},
		onOpenChange = () => {},
		onlink = () => {},
		focusAction = false,
		forceMount = false,
		contentClass = undefined
	}: {
		kind?: 'apagar' | 'kobo' | 'sem-campo' | 'campos';
		onconfirm?: () => void;
		onOpenChange?: (open: boolean) => void;
		onlink?: () => void;
		/** Pass the action button as initialFocus, which Q-E refuses. */
		focusAction?: boolean;
		/** Content stays in the DOM when closed, as during the exit animation. */
		forceMount?: boolean;
		/** Another class for the window, as the update dialog's 480 px width. */
		contentClass?: string;
	} = $props();

	let open = $state(false);
	let action = $state<HTMLElement | null>(null);
	const initialFocus = $derived(focusAction ? action : undefined);
</script>

<button type="button">Antes</button>

{#if kind === 'apagar'}
	<AlertDialog.Root bind:open {onOpenChange}>
		<AlertDialog.Trigger>Apagar livro</AlertDialog.Trigger>
		<AlertDialog.Content {initialFocus} class={contentClass} forceMount={forceMount || undefined}>
			<AlertDialog.Title>Apagar este livro?</AlertDialog.Title>
			<AlertDialog.Description>
				Todos os destaques foram removidos do Kobo. O livro e os destaques saem da Biblioteca de vez.
			</AlertDialog.Description>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancelar</AlertDialog.Cancel>
				<AlertDialog.Action bind:ref={action} variant="destructive" onclick={onconfirm}>Apagar</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{:else}
	<Dialog.Root bind:open {onOpenChange}>
		<Dialog.Trigger>Abrir</Dialog.Trigger>
		<Dialog.Content {initialFocus} class={contentClass} forceMount={forceMount || undefined}>
			<Dialog.Title>Kobo novo</Dialog.Title>
			<Dialog.Description>
				De quem é este Kobo? Os destaques ficam na Biblioteca desse leitor.
			</Dialog.Description>
			{#if kind === 'kobo'}
				<Input aria-label="Nome do leitor" />
			{:else if kind === 'campos'}
				<textarea aria-label="Nota"></textarea>
				<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
				<div role="region" tabindex="0" aria-label="Notas da versão">Notas</div>
				<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
				<div role="listbox" tabindex="0" aria-label="Lista"></div>
				<a
					href="#ajuda"
					onclick={(e) => {
						e.preventDefault();
						onlink();
					}}>Ajuda</a
				>
			{/if}
			<Dialog.Footer>
				<Dialog.Close>Cancelar</Dialog.Close>
				<Dialog.Action bind:ref={action} onclick={onconfirm}>Criar leitor</Dialog.Action>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
