<script lang="ts">
	// Test fixture for dialog.test.ts: the concrete windows (Apagar livro, Kobo novo) are Phase 5.
	import * as AlertDialog from '../alert-dialog';
	import * as Dialog from './index';
	import { Input } from '../input';

	let {
		kind = 'apagar',
		onconfirm = () => {},
		onOpenChange = () => {}
	}: {
		kind?: 'apagar' | 'kobo' | 'sem-campo';
		onconfirm?: () => void;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	let open = $state(false);
</script>

<button type="button">Antes</button>

{#if kind === 'apagar'}
	<AlertDialog.Root bind:open {onOpenChange}>
		<AlertDialog.Trigger>Apagar livro</AlertDialog.Trigger>
		<AlertDialog.Content>
			<AlertDialog.Title>Apagar este livro?</AlertDialog.Title>
			<AlertDialog.Description>
				Todos os destaques foram removidos do Kobo. O livro e os destaques saem da Biblioteca de vez.
			</AlertDialog.Description>
			<AlertDialog.Footer>
				<AlertDialog.Cancel>Cancelar</AlertDialog.Cancel>
				<AlertDialog.Action variant="destructive" onclick={onconfirm}>Apagar</AlertDialog.Action>
			</AlertDialog.Footer>
		</AlertDialog.Content>
	</AlertDialog.Root>
{:else}
	<Dialog.Root bind:open {onOpenChange}>
		<Dialog.Trigger>Abrir</Dialog.Trigger>
		<Dialog.Content>
			<Dialog.Title>Kobo novo</Dialog.Title>
			<Dialog.Description>
				De quem é este Kobo? Os destaques ficam na Biblioteca desse leitor.
			</Dialog.Description>
			{#if kind === 'kobo'}
				<Input aria-label="Nome do leitor" />
			{/if}
			<Dialog.Footer>
				<Dialog.Close>Cancelar</Dialog.Close>
				<Dialog.Action onclick={onconfirm}>Criar leitor</Dialog.Action>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>
{/if}
